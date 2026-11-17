/**
 * Phone shell (below lg) — pins the layout the owner asked for on 11-17:
 * the grid opens at the top of a viewport-height page, the left panel is not
 * stacked above it, and the Colour/Tools controls live in one sheet that is
 * closed by default. Desktop must keep the two-column DOM it has today.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Designer } from '../pages/Designer';

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

describe('Designer — phone shell', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    localStorage.clear();
    stubViewport(false);
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalInnerWidth });
  });

  it('renders the phone shell, not the desktop two-column layout', () => {
    stubViewport(false);
    renderDesigner();

    expect(screen.getByTestId('designer-phone-shell')).toBeInTheDocument();
    // The left panel is what put the canvas 2,722 px down the page — it must
    // not be in the phone DOM at all.
    expect(screen.queryByText('Designer Thread Box')).toBeNull();
    expect(screen.queryByText('Solo Designer Studio')).toBeNull();
    expect(screen.queryAllByText('Active Thread Color')).toHaveLength(0);

    // 52 px top bar, 44 px toolbar, stage, 60 px bar — all present.
    expect(screen.getByTestId('phone-top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('phone-canvas-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('phone-canvas-stage')).toBeInTheDocument();
    expect(screen.getByTestId('phone-bottom-bar')).toBeInTheDocument();
  });

  it('puts the canvas stage above the bottom bar and opens with the sheet closed', () => {
    stubViewport(false);
    renderDesigner();

    const stage = screen.getByTestId('phone-canvas-stage');
    const bar = screen.getByTestId('phone-bottom-bar');
    expect(stage.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByTestId('phone-bottom-sheet')).toBeNull();
    // The grid is on screen from the first paint.
    expect(stage.querySelector('canvas')).toBeTruthy();
  });

  it('opens one sheet with the Colour tab, then switches to Tools', () => {
    stubViewport(false);
    renderDesigner();

    fireEvent.click(screen.getByTestId('phone-bar-colour'));
    expect(screen.getByTestId('phone-bottom-sheet')).toBeInTheDocument();
    expect(screen.getAllByText('Active Thread Color')).toHaveLength(1);
    // 44 px swatches on the phone, not the 32 px desktop ones.
    const swatch = screen.getByTitle('Rose Red');
    expect(swatch.className).toContain('max-lg:h-11');
    expect(swatch.className).toContain('max-lg:w-11');

    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));
    expect(screen.queryByText('Active Thread Color')).toBeNull();
    expect(screen.getByText('Stitch Style')).toBeInTheDocument();
    expect(screen.getByTestId('tool-buttons')).toBeInTheDocument();
    expect(screen.getAllByText('Paint').length).toBeGreaterThan(0);
  });

  it('arms a tool from the Tools tab and closes the sheet', () => {
    stubViewport(false);
    renderDesigner();

    fireEvent.click(screen.getByTestId('phone-bar-tools'));
    const textTool = screen.getByTitle('Text');
    fireEvent.click(textTool);
    expect(textTool.getAttribute('aria-pressed')).toBe('true');
    // The alphabet controls live in the sheet, so they are reachable.
    expect(screen.getByLabelText('Text to place')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByTestId('phone-bottom-sheet')).toBeNull();
  });

  it('opens all five tabs from one sheet, and the ✨ AI button opens the AI tab', () => {
    stubViewport(false);
    renderDesigner();

    fireEvent.click(screen.getByTestId('phone-bar-ai'));
    expect(screen.getByTestId('phone-bottom-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('phone-ai-panel')).toBeInTheDocument();
    for (const label of ['Colour', 'Tools', 'Canvas', 'AI', 'File']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
    // The ✨ button only opens the sheet: nothing has been generated.
    expect(screen.getByTestId('phone-bar-ai').getAttribute('aria-expanded')).toBe('true');
  });

  it('puts the allowance line directly above Generate in the AI tab', () => {
    stubViewport(false);
    renderDesigner();

    fireEvent.click(screen.getByTestId('phone-bar-ai'));
    const cost = screen.getByTestId('ai-generation-cost');
    const generate = screen.getByTestId('phone-generate');
    // Cost line first in document order, and the button right after it.
    expect(cost.compareDocumentPosition(generate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(generate.textContent).toContain('Generate');
  });

  it('reaches grid size and presets from the Canvas tab', () => {
    stubViewport(false);
    renderDesigner();

    fireEvent.click(screen.getByRole('tab', { name: 'Canvas' }));
    expect(screen.getByTestId('phone-canvas-panel')).toBeInTheDocument();

    // The nine product presets the desktop left column has.
    expect(screen.getByText('Bag Charm')).toBeInTheDocument();
    expect(screen.getByText('Stocking')).toBeInTheDocument();

    // Custom size + Apply, and the grid-lines / full-screen switches, all ≥44 px.
    const apply = screen.getByTestId('phone-apply-size');
    expect(apply.className).toContain('h-11');
    expect(screen.getByLabelText('Grid width in stitches')).toBeInTheDocument();
    expect(screen.getByTestId('phone-toggle-grid-lines').className).toContain('min-h-[44px]');
    expect(screen.getByTestId('phone-toggle-fullscreen').className).toContain('min-h-[44px]');
  });

  it('reaches save, export and upload from the File tab', () => {
    stubViewport(false);
    renderDesigner();

    fireEvent.click(screen.getByRole('tab', { name: 'File' }));
    expect(screen.getByTestId('phone-file-panel')).toBeInTheDocument();
    expect(screen.getByTestId('phone-file-save').className).toContain('h-11');
    expect(screen.getByTestId('phone-file-export-pdf')).toBeInTheDocument();
    expect(screen.getByText('Upload Image')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of colors')).toBeInTheDocument();
    expect(screen.getByLabelText('Pattern name')).toBeInTheDocument();
  });

  it('keeps the desktop two-column DOM on desktop', () => {
    stubViewport(true);
    renderDesigner();

    expect(screen.queryByTestId('designer-phone-shell')).toBeNull();
    expect(screen.getByText('Designer Thread Box')).toBeInTheDocument();
    expect(screen.getByText('Solo Designer Studio')).toBeInTheDocument();
    expect(screen.getAllByText('Active Thread Color')).toHaveLength(1);
  });
});
