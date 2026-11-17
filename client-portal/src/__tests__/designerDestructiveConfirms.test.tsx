/**
 * Destructive-action confirms (owner 11-17 hardening: nothing overwrites work
 * silently).
 *
 * Four actions used to replace whatever was on the canvas without a word:
 *   (a) Generate  — the AI result replaces the grid (and costs an allowance unit)
 *   (b) Upload    — tracing an image replaces the grid
 *   (c) Reset / Clear grid — wipes every stitch
 *   (d) "Use 42×42" (the mask floor button) — restarts the canvas
 *
 * Each one now asks first, with the SAME amber ConfirmPanel the preset click and
 * the resize warning already use, and only when there is a stitch to lose: on an
 * empty canvas every one of them still runs straight through with no extra tap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Designer } from '../pages/Designer';
import { api, type AIPatternResponse } from '../services/api';

const DRAFT_KEY = 'stitchwise_designer_save';

/** Four stitches, all inside a 28×28 canvas so a resize never clips them. */
const STALE_DRAFT = JSON.stringify({
  grid: { '0,0': '#e11d48', '1,1': '#1e293b', '2,2': '#92400e', '4,4': '#1e40af' },
  stitchTypes: { '1,1': 'cross' },
});

const renderDesigner = () =>
  render(
    <BrowserRouter>
      <Designer />
    </BrowserRouter>,
  );

/** Put four real stitches on the canvas via the restore banner's Keep. */
function canvasWithStitches() {
  localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
  renderDesigner();
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
  expect(screen.getByText(/Total stitches:/).closest('p')?.textContent).toContain('4');
}

const totalStitches = () => screen.queryByText(/Total stitches/);

/** The Custom Size W/H inputs, found under their own label. */
function typeCustomSize(nextW: string, nextH: string) {
  const block = screen.getByText('Custom Size').parentElement as HTMLElement;
  const inputs = block.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
  fireEvent.change(inputs[0], { target: { value: nextW } });
  fireEvent.change(inputs[1], { target: { value: nextH } });
}

function aiResponse(size: number): AIPatternResponse {
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''));
  const c = Math.floor(size / 2) - 1;
  grid[c][c] = '#e11d48';
  grid[c][c + 1] = '#1e293b';
  grid[c + 1][c] = '#1e293b';
  grid[c + 1][c + 1] = '#e11d48';
  return {
    success: true,
    grid,
    stitchTypes: grid.map(row => row.map(() => 'cross')),
    width: size,
    height: size,
    dmcPalette: [
      { code: 'MAN-1', name: '#e11d48', hex: '#e11d48', count: 2 },
      { code: 'MAN-2', name: '#1e293b', hex: '#1e293b', count: 2 },
    ],
    totalStitches: 4,
    promptUsed: 'a bear',
    processingTimeMs: 1,
    previewUrl: 'data:image/png;base64,QUlTQU1QTEU=',
  };
}

describe('Designer — destructive actions ask before overwriting work', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── (a) Generate ────────────────────────────────────────────────────────
  it('Generate on a drawn canvas asks first; Cancel keeps the stitches and spends nothing', async () => {
    const gen = vi.spyOn(api, 'generatePatternFromText').mockResolvedValue(aiResponse(100));
    canvasWithStitches();
    fireEvent.change(screen.getByPlaceholderText(/Describe your pattern in detail/), {
      target: { value: 'a bear' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    // ASK — and nothing has been generated or charged.
    expect(screen.getByTestId('confirm-generate')).toBeInTheDocument();
    expect(gen).not.toHaveBeenCalled();
    expect(totalStitches()?.closest('p')?.textContent).toContain('4');

    // Cancel closes the panel, keeps the stitches, still nothing generated.
    fireEvent.click(within(screen.getByTestId('confirm-generate')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('confirm-generate')).not.toBeInTheDocument();
    expect(gen).not.toHaveBeenCalled();
    expect(totalStitches()?.closest('p')?.textContent).toContain('4');

    // Asking again and confirming really generates.
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fireEvent.click(within(screen.getByTestId('confirm-generate')).getByRole('button', { name: 'Generate anyway' }));
    await waitFor(() => expect(gen).toHaveBeenCalledTimes(1));
  });

  it('Generate on an EMPTY canvas generates immediately, with no confirm', async () => {
    const gen = vi.spyOn(api, 'generatePatternFromText').mockResolvedValue(aiResponse(54));
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: /^Bag Charm/ }));
    fireEvent.change(screen.getByPlaceholderText(/Describe your pattern in detail/), {
      target: { value: 'a bear' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(screen.queryByTestId('confirm-generate')).not.toBeInTheDocument();
    await waitFor(() => expect(gen).toHaveBeenCalledTimes(1));
  });

  // ── (b) Image upload ────────────────────────────────────────────────────
  it('uploading an image over a drawn canvas asks first; Cancel traces nothing', () => {
    canvasWithStitches();
    const input = document.getElementById('image-upload') as HTMLInputElement;
    const file = new File(['x'], 'rose.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });
    const panel = screen.getByTestId('confirm-upload');
    expect(panel).toBeInTheDocument();
    expect(panel.textContent).toContain('replaces the stitches you have drawn');

    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('confirm-upload')).not.toBeInTheDocument();
    // Nothing was traced: the stitches are still the ones that were there.
    expect(totalStitches()?.closest('p')?.textContent).toContain('4');
  });

  // ── (c) Reset / Clear grid ──────────────────────────────────────────────
  it('Clear Grid asks first; Cancel keeps every stitch, confirming clears the canvas', () => {
    canvasWithStitches();

    fireEvent.click(screen.getByRole('button', { name: /Clear Grid/ }));
    const panel = screen.getByTestId('confirm-clear');
    expect(panel).toBeInTheDocument();
    expect(totalStitches()?.closest('p')?.textContent).toContain('4');

    fireEvent.click(within(panel).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByTestId('confirm-clear')).not.toBeInTheDocument();
    expect(totalStitches()?.closest('p')?.textContent).toContain('4');

    fireEvent.click(screen.getByRole('button', { name: /Clear Grid/ }));
    fireEvent.click(within(screen.getByTestId('confirm-clear')).getByRole('button', { name: 'Clear grid' }));
    expect(totalStitches()).not.toBeInTheDocument();
  });

  it('Reset asks with its own wording and only wipes once confirmed', () => {
    canvasWithStitches();

    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    const panel = screen.getByTestId('confirm-clear');
    expect(panel.textContent).toContain('Reset this canvas?');
    expect(totalStitches()?.closest('p')?.textContent).toContain('4');

    fireEvent.click(within(panel).getByRole('button', { name: 'Reset canvas' }));
    expect(totalStitches()).not.toBeInTheDocument();
  });

  it('Clear Grid on an EMPTY canvas clears immediately, with no confirm', () => {
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: /Clear Grid/ }));
    expect(screen.queryByTestId('confirm-clear')).not.toBeInTheDocument();
  });

  // ── (d) "Use 42×42" (the mask floor button) ─────────────────────────────
  it('"Use 42×42" asks before it restarts the canvas; Cancel leaves the size alone', () => {
    canvasWithStitches();
    fireEvent.change(screen.getByPlaceholderText(/Describe your pattern in detail/), {
      target: { value: 'a red rose ornament' },
    });
    // 28×28 is below the ornament's floor, so the steering panel offers the fix.
    typeCustomSize('28', '28');
    expect(screen.getByTestId('mask-min-grid-steering')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use 42×42' }));
    const panel = screen.getByTestId('confirm-mask-floor');
    expect(panel.textContent).toContain('Make room for the mask?');
    // Still 28×28 — the canvas has not moved yet.
    expect((screen.getAllByDisplayValue('28') as HTMLInputElement[]).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('confirm-mask-floor')).not.toBeInTheDocument();
    expect((screen.getAllByDisplayValue('28') as HTMLInputElement[]).length).toBeGreaterThanOrEqual(2);

    // The panel's own confirm button carries the action's name, not a bare "Yes".
    fireEvent.click(screen.getByRole('button', { name: 'Use 42×42' }));
    fireEvent.click(within(screen.getByTestId('confirm-mask-floor')).getByRole('button', { name: 'Use 42×42' }));
    expect(screen.queryByTestId('mask-min-grid-steering')).not.toBeInTheDocument();
    expect((screen.getAllByDisplayValue('42') as HTMLInputElement[]).length).toBeGreaterThanOrEqual(2);
  });
});
