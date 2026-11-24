/**
 * A restored draft comes back WHOLE — on desktop and on a phone.
 * Spec: /home/team/shared/designer-hardening-provenance.md
 *
 *  (1) THE 2-SECOND WIPE — the debounced persist effect's empty-canvas branch
 *      runs on mount, so ~2 s after the Designer opened it removeItem()'d the
 *      very draft the banner was offering. The safety net only worked if Keep
 *      was clicked first. A pending restore must freeze persistence.
 *  (2) cellFractions were never written (or read), so a restored circle/line/
 *      half-tool edge came back as solid squares.
 *  (3) aiArtworkUrl was stored only as a boolean, so a restored draft lost its
 *      AI artwork: empty AiPanel thumbnail, and Save tripped the "no AI source
 *      image" confirm and stored sourceImage: undefined for good.
 *  (4) The restore banner existed only in the desktop tree — a phone showed
 *      nothing at all. (The phone banner landed with the phone shell; this
 *      test pins it so it can never quietly go back to desktop-only.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  Designer,
  capDraftArtwork,
  persistDesignerDraft,
  DRAFT_ARTWORK_MAX_CHARS,
  DRAFT_ARTWORK_DROPPED_MESSAGE,
} from '../pages/Designer';
import { api } from '../services/api';

const DRAFT_KEY = 'stitchwise_designer_save';

const FOUR_CELLS = { '0,0': '#e11d48', '1,1': '#1e293b', '2,2': '#92400e', '4,4': '#1e40af' };

/** A real saved draft: four stitches, its canvas size, and provenance. */
const savedDraft = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    grid: FOUR_CELLS,
    stitchTypes: { '1,1': 'cross' },
    gridWidth: 10,
    gridHeight: 10,
    savedAt: '2026-11-20T10:00:00.000Z',
    ...extra,
  });

function stubViewport(isDesktop: boolean) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: isDesktop ? 1280 : 390,
  });
}

const renderDesigner = () =>
  render(
    <BrowserRouter>
      <Designer />
    </BrowserRouter>,
  );

const quotaError = () => {
  const err = new Error('The quota has been exceeded.');
  err.name = 'QuotaExceededError';
  return err;
};

describe('Designer — a restored draft is never wiped and never loses its provenance', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    stubViewport(true);
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  // ── (1) the 2-second wipe ───────────────────────────────────────────────
  it('opening the Designer with a saved draft does NOT delete it after the debounce (desktop)', async () => {
    const stored = savedDraft();
    localStorage.setItem(DRAFT_KEY, stored);
    renderDesigner();
    expect(screen.getByText(/Restored draft from your last session/)).toBeInTheDocument();

    // The persist effect fires at 2 s. Wait past it — twice.
    await new Promise((r) => setTimeout(r, 2600));
    expect(localStorage.getItem(DRAFT_KEY)).toBe(stored);
    await new Promise((r) => setTimeout(r, 2600));
    expect(localStorage.getItem(DRAFT_KEY)).toBe(stored);
    // …and the offer is still on screen for the customer to act on.
    expect(screen.getByText(/Restored draft from your last session/)).toBeInTheDocument();
  }, 20000);

  // ── (2) partial cells ───────────────────────────────────────────────────
  it('a draft with partial-cell fills restores the fractions, not solid cells', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      savedDraft({
        grid: { '0,0': '#e11d48', '0,1': '#1e293b' },
        cellFractions: { '0,0': 0.5, '0,1': 0.25 },
      }),
    );
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    // The fractions reached the canvas state: the next persist writes them
    // back out. (Before the fix they were dropped by parse AND by the writer,
    // so the round-trip stored no cellFractions at all.)
    await waitFor(
      () => {
        const raw = localStorage.getItem(DRAFT_KEY);
        expect(raw).not.toBeNull();
        const draft = JSON.parse(raw as string);
        // Wait for the debounced persist to have actually rewritten the draft
        // (savedAt moves), otherwise we would be reading the seeded copy back.
        expect(draft.savedAt).not.toBe('2026-11-20T10:00:00.000Z');
        expect(draft.cellFractions).toEqual({ '0,0': 0.5, '0,1': 0.25 });
      },
      { timeout: 8000 },
    );
  }, 20000);

  // ── (3) AI artwork ──────────────────────────────────────────────────────
  it('a draft with AI artwork restores it, and Save then stores a sourceImage', async () => {
    const artwork = 'data:image/png;base64,QUlERVJXRUQ=';
    localStorage.setItem(
      DRAFT_KEY,
      savedDraft({ hasAiArtwork: true, aiPrompt: 'a teddy', aiArtworkUrl: artwork }),
    );
    const save = vi
      .spyOn(api, 'savePattern')
      .mockResolvedValue({ id: 'pattern-1', name: 'Teddy' } as never);

    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    // The artwork thumbnail is back…
    await waitFor(() => expect(screen.getByAltText('AI-generated artwork')).toBeInTheDocument());
    expect(screen.getByAltText('AI-generated artwork').getAttribute('src')).toBe(artwork);

    // …so saving does NOT trip the "no AI source image" confirm, and the
    // provenance travels with the pattern instead of being lost for good.
    fireEvent.change(screen.getByPlaceholderText('Pattern name...'), { target: { value: 'Teddy' } });
    fireEvent.click(screen.getByTitle('Save pattern to your library'));
    expect(screen.queryByText(/no AI source image/)).toBeNull();

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][5]).toMatchObject({ prompt: 'a teddy', sourceImage: artwork });
  }, 20000);

  // ── (4) the phone tree ──────────────────────────────────────────────────
  it('the phone layout shows the restore banner — and the draft survives it', async () => {
    stubViewport(false);
    const stored = savedDraft();
    localStorage.setItem(DRAFT_KEY, stored);
    renderDesigner();

    const banner = screen.getByTestId('restored-draft-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/Restored draft/);
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 2600));
    expect(localStorage.getItem(DRAFT_KEY)).toBe(stored);
  }, 20000);

  // ── the writer itself: a big image must never cost the pattern ──────────
  it('caps oversized artwork, and when the store fills it keeps the grid and says so', () => {
    const huge = `data:image/png;base64,${'A'.repeat(DRAFT_ARTWORK_MAX_CHARS)}`;
    const capped = capDraftArtwork({ grid: FOUR_CELLS, stitchTypes: {}, aiArtworkUrl: huge });
    expect(capped.aiArtworkUrl).toBeUndefined();
    expect(capped.grid).toEqual(FOUR_CELLS);

    // Small artwork is kept untouched.
    const small = capDraftArtwork({ grid: FOUR_CELLS, stitchTypes: {}, aiArtworkUrl: 'data:image/png;base64,QQ==' });
    expect(small.aiArtworkUrl).toBe('data:image/png;base64,QQ==');

    // A full store: the artwork write fails, the retry without it succeeds —
    // the grid is saved and the customer is told the image was not.
    const writes: string[] = [];
    let calls = 0;
    const store = {
      setItem: (_k: string, v: string) => {
        calls += 1;
        if (calls === 1) throw quotaError();
        writes.push(v);
      },
    };
    const reason = persistDesignerDraft(
      { grid: FOUR_CELLS, stitchTypes: {}, aiArtworkUrl: 'data:image/png;base64,QQ==' },
      store,
    );
    expect(reason).toBe(DRAFT_ARTWORK_DROPPED_MESSAGE);
    expect(calls).toBe(2);
    const stored = JSON.parse(writes[0]);
    expect(stored.grid).toEqual(FOUR_CELLS);
    expect(stored.aiArtworkUrl).toBeUndefined();
  });
});
