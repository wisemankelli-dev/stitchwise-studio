/**
 * The two remaining SILENT failures in the Designer (owner 11-17: "make the
 * designer bulletproof").
 *
 *  (1) DRAFT WRITE — the debounced `localStorage` write was unguarded, so a full
 *      browser store threw a QuotaExceededError out of a setTimeout: the draft
 *      vanished with no word to the customer, who then lost the design on
 *      refresh. It must end with a visible, persistent reason instead.
 *
 *  (2) IMAGE IMPORT — `convertImageFile` only wired `img.onload`. A damaged or
 *      unsupported file fires `onerror` (nobody was listening), so
 *      `isProcessingImage` stayed true and Upload sat on "Processing…" forever.
 *      Every failure path must stop the spinner AND say why.
 *
 * Both are driven through the REAL Designer component (RTL + jsdom, the same
 * harness as designerDraftRestore.test.tsx) on BOTH trees — the desktop
 * two-column layout and the phone shell — because the owner's customers mostly
 * arrive on a phone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  Designer,
  saveDesignerDraft,
  describeDraftSaveFailure,
  describeImageImportFailure,
  DRAFT_STORAGE_FULL_MESSAGE,
} from '../pages/Designer';

const DRAFT_KEY = 'stitchwise_designer_save';

/** Four stitches — the shape a real browser had stored. */
const STALE_DRAFT = JSON.stringify({
  grid: { '0,0': '#e11d48', '1,1': '#1e293b', '2,2': '#92400e', '4,4': '#1e40af' },
  stitchTypes: { '1,1': 'cross' },
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

/**
 * An <img> that refuses to decode — the browser fires `onerror` and never
 * `onload`, which is exactly what a damaged/unsupported file does.
 */
class UndecodableImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 0;
  height = 0;
  private _src = '';
  set src(value: string) {
    this._src = value;
    setTimeout(() => { this.onerror?.(); }, 0);
  }
  get src() {
    return this._src;
  }
}

const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  localStorage.clear();
  stubViewport(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (1) A failed draft write must SAY so
// ══════════════════════════════════════════════════════════════════════════
describe('Designer — a failed draft write is never silent', () => {
  it('saveDesignerDraft returns the reason instead of throwing, and writes nothing', () => {
    const writes: Array<[string, string]> = [];
    const reason = saveDesignerDraft(
      { grid: { '0,0': '#e11d48' }, stitchTypes: {} },
      { setItem: () => { throw quotaError(); } },
    );
    expect(reason).toBe(DRAFT_STORAGE_FULL_MESSAGE);
    expect(reason).toMatch(/storage is full/i);

    // A healthy store still writes the same key, and reports success.
    const healthy = { setItem: (k: string, v: string) => { writes.push([k, v]); } };
    expect(saveDesignerDraft({ grid: { '0,0': '#e11d48' }, stitchTypes: {} }, healthy)).toBeNull();
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe(DRAFT_KEY);
    expect(JSON.parse(writes[0][1]).grid).toEqual({ '0,0': '#e11d48' });
  });

  it('maps every browser quota error name, and still says something otherwise', () => {
    for (const name of ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED', 'QUOTA_EXCEEDED_ERR']) {
      const err = new Error('full');
      err.name = name;
      expect(describeDraftSaveFailure(err)).toBe(DRAFT_STORAGE_FULL_MESSAGE);
    }
    const other = describeDraftSaveFailure(new Error('blocked'));
    expect(other.length).toBeGreaterThan(20);
    expect(other).not.toBe(DRAFT_STORAGE_FULL_MESSAGE);
    // An unknown/absent error must never produce an empty (i.e. silent) message.
    expect(describeDraftSaveFailure(null).length).toBeGreaterThan(20);
  });

  it('a QuotaExceededError in the debounced write shows a persistent reason (desktop)', async () => {
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT); // lands before the store is full
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quotaError(); });
    renderDesigner();

    // Keep the restored draft → the canvas changes → the 2 s debounce fires.
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByTestId('draft-save-error')).toBeNull(); // not before the write

    const alert = await waitFor(() => screen.getByTestId('draft-save-error'), { timeout: 5000 });
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toMatch(/storage is full/i);

    // PERSISTENT: still there well after the 2.5 s flash a toast would use, and
    // nothing was written over the stored draft.
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.getByTestId('draft-save-error')).toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_KEY)).toBe(STALE_DRAFT);

    // It stays until the customer dismisses it.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('draft-save-error')).toBeNull();
  }, 20000);

  it('a QuotaExceededError in the debounced write shows a persistent reason (phone)', async () => {
    stubViewport(false);
    localStorage.setItem(DRAFT_KEY, STALE_DRAFT);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quotaError(); });
    renderDesigner();

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    const alert = await waitFor(() => screen.getByTestId('phone-draft-save-error'), { timeout: 5000 });
    expect(alert.textContent).toMatch(/storage is full/i);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('phone-draft-save-error')).toBeNull();
  }, 20000);
});

// ══════════════════════════════════════════════════════════════════════════
// (2) A bad image must end Upload with a reason
// ══════════════════════════════════════════════════════════════════════════
describe('Designer — an unreadable image never sticks on "Processing…"', () => {
  it('gives a distinct, non-empty reason for every stage it can fail at', () => {
    const read = describeImageImportFailure('read');
    const decode = describeImageImportFailure('decode');
    const trace = describeImageImportFailure('trace');
    for (const msg of [read, decode, trace]) expect(msg.length).toBeGreaterThan(30);
    expect(new Set([read, decode, trace]).size).toBe(3);
    expect(decode).toMatch(/couldn't be opened/i);
  });

  it('an undecodable file ends Upload with the reason instead of "Processing…" (desktop)', async () => {
    vi.stubGlobal('Image', UndecodableImage);
    renderDesigner();

    const input = document.getElementById('image-upload') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['definitely not an image'], 'broken.png', { type: 'image/png' })] },
    });

    const alert = await waitFor(() => screen.getByTestId('image-import-error'), { timeout: 5000 });
    expect(alert.textContent).toMatch(/couldn't be opened/i);
    // The spinner is gone: Upload is usable again.
    expect(screen.queryByText('Processing...')).toBeNull();
    // Nothing was traced onto the canvas.
    expect(screen.queryByText(/Total stitches/)).toBeNull();
  }, 20000);

  it('an undecodable file ends Upload with the reason in the phone File tab', async () => {
    stubViewport(false);
    vi.stubGlobal('Image', UndecodableImage);
    renderDesigner();

    fireEvent.click(screen.getByTestId('phone-bar-tools'));
    fireEvent.click(screen.getByRole('tab', { name: 'File' }));
    const input = document.getElementById('phone-image-upload') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['definitely not an image'], 'broken.png', { type: 'image/png' })] },
    });

    const alert = await waitFor(() => screen.getByTestId('phone-image-import-error'), { timeout: 5000 });
    expect(alert.textContent).toMatch(/couldn't be opened/i);
    expect(screen.queryByText('Processing…')).toBeNull();
  }, 20000);
});
