/**
 * Batch A (designer-hardening.md) — the Designer must stop lying about saves.
 *
 * Root cause pinned here: the pattern methods fell through to an in-memory mock
 * on ANY non-2xx, so a 401 from a real backend came back as a fake
 * `pattern-<timestamp>` success and the Designer printed `Saved "name"!`.
 *
 * Contract:
 * 1. a live backend that answers 401 → the call throws, the Designer says the
 *    save failed AND why, and the message stays on screen;
 * 2. with no backend at all (local dev) the in-memory mock still works.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Designer } from '../pages/Designer';
import { api, PatternRequestError } from '../services/api';

/** Minimal fetch Response stand-in — no dependency on a global Response. */
const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as unknown as Response;

const renderDesigner = () => render(
  <BrowserRouter>
    <Designer />
  </BrowserRouter>
);

/** Health probe answers 200 so the client stays on the live path; everything else 401. */
const unauthorizedBackend = () => vi.fn(async (url: RequestInfo | URL) => {
  if (String(url).endsWith('/api/health')) return jsonResponse(200, { status: 'ok' });
  return jsonResponse(401, { error: 'Authentication required' });
});

describe('Pattern Designer — a refused save must not report success (Batch A)', () => {
  beforeEach(() => {
    localStorage.clear();
    api.isLiveBackend = true;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    api.isLiveBackend = true;
  });

  it('shows "Save failed" with the reason, and no "Saved!" — when the backend answers 401', async () => {
    const fetchMock = unauthorizedBackend();
    vi.stubGlobal('fetch', fetchMock);

    renderDesigner();
    fireEvent.change(screen.getByPlaceholderText('Pattern name...'), { target: { value: 'Refused heart' } });
    fireEvent.click(screen.getByTitle('Save pattern to your library'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Save failed/);
    expect(alert.textContent).toMatch(/sign-in has expired/i);
    expect(screen.queryByText(/Saved "Refused heart"!/)).toBeNull();
    // The POST really went to the network rather than straight to the mock.
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/patterns')).toBe(true);

    // A data-loss message must not self-clear (the old code wiped it after 2.5 s).
    await new Promise(resolve => setTimeout(resolve, 2700));
    expect(screen.getByRole('alert').textContent).toMatch(/Save failed/);
  }, 15000);

  it('throws instead of returning a mock id for save / list / load / delete on a 401', async () => {
    vi.stubGlobal('fetch', unauthorizedBackend());

    await expect(api.savePattern('x', [[{ color: '' }]], [], 16, 0)).rejects.toBeInstanceOf(PatternRequestError);
    await expect(api.listPatterns()).rejects.toThrow(/sign-in has expired/i);
    await expect(api.loadPattern('abc')).rejects.toBeInstanceOf(PatternRequestError);
    await expect(api.deletePattern('abc')).rejects.toBeInstanceOf(PatternRequestError);
  });

  it('keeps the local mock working when there is genuinely no backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    api.isLiveBackend = false;

    const saved = await api.savePattern('Offline sketch', [[{ color: '#ff0000' }]], [], 16, 1);
    expect(saved.id).toMatch(/^pattern-\d+$/);
    expect(await api.listPatterns()).toHaveLength(1);
    expect(await api.loadPattern(saved.id)).not.toBeNull();
    await expect(api.deletePattern(saved.id)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders a failed pattern list as "Couldn\'t load your patterns", not "No saved patterns yet"', async () => {
    vi.stubGlobal('fetch', unauthorizedBackend());

    renderDesigner();
    await waitFor(() => expect(api.isLiveBackend).toBe(true));
    fireEvent.click(screen.getByTitle('Load a saved pattern'));

    expect(await screen.findByText("Couldn't load your patterns")).toBeInTheDocument();
    expect(screen.queryByText('No saved patterns yet')).toBeNull();
    expect(screen.getByTitle('Try loading your patterns again')).toBeInTheDocument();
  });
});
