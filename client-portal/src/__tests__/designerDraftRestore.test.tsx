/**
 * Designer draft-restore guard (owner 09-14 "stick figure in every mask").
 *
 * Regression coverage for the four required fixes:
 *  (a) mount-restore shows a banner + does NOT silently populate the canvas
 *      (and a restored draft is never reframed into an active product mask);
 *  (b) preset/mask click with stitches (no AI provenance) ASKS instead of a
 *      silent reframe/clear; Start fresh really starts blank;
 *  (c) saving a canvas with NO AI sourceImage shows a one-click confirm so a
 *      restored-stale-grid save can't happen silently;
 *  (d) a fresh AI result replaces the stored pre-AI draft so the next session
 *      restores the new pattern, never the old stick figure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Designer } from '../pages/Designer';
import { api, type AIPatternResponse } from '../services/api';

const DRAFT_KEY = 'stitchwise_designer_save';

/** Old-format draft (pre-09-14): no dims, no provenance — the exact shape
 *  Kelli's browser had stored. Four cells incl. the "stick figure" markers. */
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

describe('Designer — draft restore guard (owner 09-14)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── (a) Mount restore shows a banner, canvas stays blank ────────────────
  it('shows a "Restored draft" banner instead of silently populating the canvas', () => {
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
    renderDesigner();
    // Banner is visible…
    expect(screen.getByText(/Restored draft from your last session/)).toBeInTheDocument();
    expect(screen.getByText(/Clear \+ start blank/)).toBeInTheDocument();
    // …but the canvas is still blank: no palette legend (0 stitches).
    expect(screen.queryByText(/Total stitches/)).not.toBeInTheDocument();
  });

  it('Keep applies the draft to the canvas; banner disappears', () => {
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText(/Restored draft from your last session/)).not.toBeInTheDocument();
    expect(screen.getByText(/Total stitches:/).closest('p')?.textContent).toContain('4');
  });

  it('Clear + start blank removes the draft and the canvas stays empty; the draft localStorage is gone', () => {
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: /Clear \+ start blank/ }));
    expect(screen.queryByText(/Restored draft from your last session/)).not.toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.queryByText(/Total stitches/)).not.toBeInTheDocument();
  });

  // ── (b) Preset click = fresh-canvas intent (no silent reframe into mask) ─
  it('preset click with stitches asks "Start fresh" — no silent reframe into mask', () => {
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' })); // 4 stitches on canvas
    expect(screen.getByText(/Total stitches:/).closest('p')?.textContent).toContain('4');

    fireEvent.click(screen.getByRole('button', { name: /^Stocking/ }));
    // ASK, don't silently reframe: the confirm panel appears and stitches stay.
    expect(screen.getByText(/Start a fresh Stocking canvas\?/)).toBeInTheDocument();
    expect(screen.getByText(/Start fresh/)).toBeInTheDocument();
    // Cancel keeps everything.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Start a fresh Stocking canvas\?/)).not.toBeInTheDocument();
    expect(screen.getByText(/Total stitches:/).closest('p')?.textContent).toContain('4');

    // Clicking the preset again asks once more; Start fresh clears to the blank 154×238 stocking.
    fireEvent.click(screen.getByRole('button', { name: /^Stocking/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
    expect(screen.queryByText(/Total stitches/)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('154')).toBeInTheDocument(); // width input = 11″×14ct
    expect(screen.getByDisplayValue('238')).toBeInTheDocument(); // height input = 17″×14ct
  });

  it('preset click on an EMPTY canvas starts fresh immediately without asking', () => {
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: /^Stocking/ }));
    expect(screen.queryByText(/Start a fresh Stocking canvas\?/)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('154')).toBeInTheDocument();
    expect(screen.getByDisplayValue('238')).toBeInTheDocument();
  });

  // ── (c) Save guard without AI sourceImage ───────────────────────────────
  it('saving a canvas with no AI source image asks once (Save anyway persists, Cancel aborts)', async () => {
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' })); // 4 stitches, no AI source
    fireEvent.change(screen.getByPlaceholderText('Pattern name...'), { target: { value: 'StaleGrid' } });
    fireEvent.click(screen.getByTitle('Save pattern to your library'));
    expect(screen.getByText(/no AI source image/)).toBeInTheDocument();

    // Cancel aborts the save.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/no AI source image/)).not.toBeInTheDocument();

    // Save anyway persists.
    fireEvent.click(screen.getByTitle('Save pattern to your library'));
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(screen.getByText(/Saved "StaleGrid"!/)).toBeInTheDocument());
  });

  it('saving an AI-generated pattern (has sourceImage) skips the confirm', async () => {
    renderDesigner();
    // Give the canvas AI provenance by generating (mocked) on a fresh Bag Charm 28×28.
    const gen = vi.spyOn(api, 'generatePatternFromText').mockResolvedValue(aiResponse(28, 28));
    fireEvent.click(screen.getByRole('button', { name: /^Bag Charm/ }));
    fireEvent.change(screen.getByPlaceholderText(/Describe a pattern/), { target: { value: 'a bear' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(gen).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Total stitches:/).closest('p')?.textContent).toContain('4'));

    fireEvent.change(screen.getByPlaceholderText('Pattern name...'), { target: { value: 'AIResult' } });
    fireEvent.click(screen.getByTitle('Save pattern to your library'));
    await waitFor(() => expect(screen.getByText(/Saved "AIResult"!/)).toBeInTheDocument());
    expect(screen.queryByText(/no AI source image/)).not.toBeInTheDocument();
  });

  // ── (d) AI success replaces the stale pre-AI draft ──────────────────────
  it('a fresh AI generation replaces the stored draft (old stick figure gone)', async () => {
    const gen = vi.spyOn(api, 'generatePatternFromText').mockResolvedValue(aiResponse(28, 28));
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
    renderDesigner();
    expect(screen.getByText(/Restored draft from your last session/)).toBeInTheDocument();

    // Generate on a Bag Charm fresh canvas (28×28) — target dims match the response.
    fireEvent.click(screen.getByRole('button', { name: /^Bag Charm/ }));
    fireEvent.change(screen.getByPlaceholderText(/Describe a pattern/), { target: { value: 'a teddy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(gen).toHaveBeenCalled());

    // The restore banner is gone and the draft now holds the FRESH result.
    await waitFor(() => expect(screen.queryByText(/Restored draft from your last session/)).not.toBeInTheDocument());
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();
    const draft = JSON.parse(raw as string);
    expect(draft.hasAiArtwork).toBe(true);
    expect(draft.aiPrompt).toBe('a teddy');
    expect(draft.gridWidth).toBe(28);
    expect(draft.gridHeight).toBe(28);
    // The pre-AI stick figure (old-format cells) is replaced by the fresh
    // result — the stored draft must NOT be the old grid anymore.
    expect(draft.grid).toEqual({
      '0,0': '#e11d48',
      '0,1': '#1e293b',
      '1,0': '#1e293b',
      '1,1': '#e11d48',
    });
  });
});

/** Build a healthy backend-style response at size×size with a 2×2 bear. */
function aiResponse(size: number, preview = 'data:image/png;base64,QUlTQU1QTEU='): AIPatternResponse {
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''));
  grid[0][0] = '#e11d48';
  grid[0][1] = '#1e293b';
  grid[1][0] = '#1e293b';
  grid[1][1] = '#e11d48';
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
    promptUsed: 'a teddy',
    processingTimeMs: 1,
    previewUrl: preview,
  };
}