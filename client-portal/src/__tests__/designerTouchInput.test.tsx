/**
 * D0 — the grid canvas has touch input.
 *
 * Before this batch StitchGrid bound mouse + click events only, so on a phone a
 * finger drag painted nothing (a single tap painted only because the browser
 * synthesizes a click) and pinch-zoom did not exist at all.
 *
 * These tests drive the real component with real pointer events:
 *  - a finger drag paints the same continuous stroke the mouse paints
 *  - a tap still paints one cell (press + click, like a mouse click)
 *  - the mouse events the browser synthesizes after a touch don't paint twice
 *  - two fingers pinch-zoom, clamped to the 3× ceiling, and never paint
 *  - the desktop mouse path is unchanged
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import StitchGrid, {
  GRID_GUTTER,
  PINCH_MAX_ZOOM,
  type StitchGridData,
  type StitchCell,
} from '../components/StitchGrid';

const CELL = 12; // BASE_CELL_SIZE at zoom = 1

function makeData(width: number, height: number): StitchGridData {
  const grid: StitchCell[][] = [];
  for (let r = 0; r < height; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < width; c++) row.push({ row: r, col: c, color: '' });
    grid.push(row);
  }
  return { grid, width, height, dmcPalette: [], totalStitches: 0 };
}

class FakeCtx {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = '';
  textBaseline = '';
  globalAlpha = 1;
  calls: string[] = [];
  scale() { this.calls.push('scale'); }
  setTransform() { this.calls.push('setTransform'); }
  clearRect() { this.calls.push('clearRect'); }
  fillRect() { this.calls.push('fillRect'); }
  strokeRect() { this.calls.push('strokeRect'); }
  beginPath() { this.calls.push('beginPath'); }
  moveTo() { this.calls.push('moveTo'); }
  lineTo() { this.calls.push('lineTo'); }
  arc() { this.calls.push('arc'); }
  arcTo() { this.calls.push('arcTo'); }
  rect() { this.calls.push('rect'); }
  closePath() { this.calls.push('closePath'); }
  fill() { this.calls.push('fill'); }
  stroke() { this.calls.push('stroke'); }
  clip() { this.calls.push('clip'); }
  fillText() { this.calls.push('fillText'); }
  drawImage() { this.calls.push('drawImage'); }
  setLineDash() { this.calls.push('setLineDash'); }
  save() { this.calls.push('save'); }
  restore() { this.calls.push('restore'); }
}

/** Client coords of the centre of grid cell (row, col) at zoom 1. */
function cellCentre(row: number, col: number) {
  return {
    x: GRID_GUTTER + col * CELL + CELL / 2,
    y: GRID_GUTTER + row * CELL + CELL / 2,
  };
}

/** A pointer event the way a touchscreen delivers it. */
function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  point: { x: number; y: number },
  opts: { id?: number; pointerType?: string } = {},
) {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
  });
  Object.defineProperty(ev, 'pointerId', { value: opts.id ?? 1 });
  Object.defineProperty(ev, 'pointerType', { value: opts.pointerType ?? 'touch' });
  Object.defineProperty(ev, 'isPrimary', { value: (opts.id ?? 1) === 1 });
  return ev;
}

function mouse(type: 'mousedown' | 'mousemove' | 'mouseup' | 'click', point: { x: number; y: number }) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
  });
}

type Handlers = {
  onCellPress: ReturnType<typeof vi.fn>;
  onCellHover: ReturnType<typeof vi.fn>;
  onCellClick: ReturnType<typeof vi.fn>;
  onZoomChange: ReturnType<typeof vi.fn>;
};

function renderGrid(props: { zoom?: number; isMouseDown?: boolean; activeTool?: string } = {}) {
  const handlers: Handlers = {
    onCellPress: vi.fn(),
    onCellHover: vi.fn(),
    onCellClick: vi.fn(),
    onZoomChange: vi.fn(),
  };
  const utils = render(
    <StitchGrid
      data={makeData(8, 8)}
      zoom={props.zoom ?? 1}
      activeTool={(props.activeTool ?? 'paint') as never}
      selectedColor="#ff0000"
      selectedStitch="cross"
      isMouseDown={props.isMouseDown ?? false}
      onCellPress={handlers.onCellPress}
      onCellHover={handlers.onCellHover}
      onCellClick={handlers.onCellClick}
      onZoomChange={handlers.onZoomChange}
    />,
  );
  const canvas = utils.container.querySelector('canvas') as HTMLCanvasElement;
  // jsdom lays nothing out: pin the canvas at the viewport origin so client
  // coordinates map straight onto the grid maths.
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 800, width: 800, height: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  const send = (ev: Event) => act(() => { canvas.dispatchEvent(ev); });
  return { ...handlers, canvas, send };
}

const cellsOf = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map((c) => `${c[0]},${c[1]}`);

describe('D0 — touch input on the stitch grid canvas', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      new FakeCtx() as unknown as CanvasRenderingContext2D,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a finger drag paints one continuous stroke across every cell it crosses', () => {
    const g = renderGrid();
    g.send(pointer('pointerdown', cellCentre(1, 1)));
    g.send(pointer('pointermove', cellCentre(1, 4)));
    g.send(pointer('pointerup', cellCentre(1, 4)));

    // The cells the stroke passed through are painted in order — not just the
    // two endpoints a sparse touch sample would give.
    expect(cellsOf(g.onCellHover)).toEqual(['1,1', '1,2', '1,3', '1,4']);
    expect(g.onCellClick).toHaveBeenCalledTimes(1);
    expect(g.onCellClick).toHaveBeenCalledWith(1, 4);
  });

  it('a drag across rows and columns stays contiguous', () => {
    const g = renderGrid({ activeTool: 'erase' });
    g.send(pointer('pointerdown', cellCentre(0, 0)));
    g.send(pointer('pointermove', cellCentre(3, 3)));
    g.send(pointer('pointerup', cellCentre(3, 3)));

    expect(cellsOf(g.onCellHover)).toEqual(['0,0', '1,1', '2,2', '3,3']);
  });

  it('a tap paints the cell once (press + click, like a mouse click)', () => {
    const g = renderGrid();
    const p = cellCentre(2, 3);
    g.send(pointer('pointerdown', p));
    g.send(pointer('pointerup', p));

    expect(g.onCellPress).toHaveBeenCalledTimes(1);
    expect(g.onCellPress).toHaveBeenCalledWith(2, 3);
    expect(g.onCellClick).toHaveBeenCalledTimes(1);
    expect(g.onCellClick).toHaveBeenCalledWith(2, 3);
  });

  it("the mouse events a browser synthesizes after a touch don't paint twice", () => {
    const g = renderGrid();
    const p = cellCentre(2, 3);
    g.send(pointer('pointerdown', p));
    g.send(pointer('pointerup', p));
    expect(g.onCellPress).toHaveBeenCalledTimes(1);

    // Chrome/Safari follow a touch with compat mouse events.
    g.send(mouse('mousedown', p));
    g.send(mouse('mousemove', p));
    g.send(mouse('mouseup', p));
    g.send(mouse('click', p));

    expect(g.onCellPress).toHaveBeenCalledTimes(1);
    expect(g.onCellClick).toHaveBeenCalledTimes(1);
    expect(g.onCellHover).not.toHaveBeenCalled();
  });

  it('two fingers pinch-zoom and paint nothing', () => {
    const g = renderGrid({ zoom: 1 });
    g.send(pointer('pointerdown', { x: 100, y: 100 }, { id: 1 }));
    g.send(pointer('pointerdown', { x: 200, y: 100 }, { id: 2 })); // 100px apart
    g.send(pointer('pointermove', { x: 100, y: 100 }, { id: 1 }));
    g.send(pointer('pointermove', { x: 300, y: 100 }, { id: 2 })); // 200px apart → 2×
    g.send(pointer('pointerup', { x: 300, y: 100 }, { id: 2 }));
    g.send(pointer('pointerup', { x: 100, y: 100 }, { id: 1 }));

    expect(g.onZoomChange).toHaveBeenCalled();
    expect(g.onZoomChange.mock.calls[g.onZoomChange.mock.calls.length - 1][0]).toBeCloseTo(2, 1);
    // A pinch is a zoom gesture, never a stroke.
    expect(g.onCellHover).not.toHaveBeenCalled();
    expect(g.onCellPress).not.toHaveBeenCalled();
    expect(g.onCellClick).not.toHaveBeenCalled();
  });

  it('pinch-zoom stops at the existing 3× ceiling', () => {
    const g = renderGrid({ zoom: 3 });
    g.send(pointer('pointerdown', { x: 100, y: 100 }, { id: 1 }));
    g.send(pointer('pointerdown', { x: 200, y: 100 }, { id: 2 }));
    g.send(pointer('pointermove', { x: 0, y: 100 }, { id: 1 }));
    g.send(pointer('pointermove', { x: 300, y: 100 }, { id: 2 })); // 3× the start distance

    const zooms = g.onZoomChange.mock.calls.map((c) => c[0] as number);
    expect(zooms.length).toBeGreaterThan(0);
    for (const z of zooms) expect(z).toBeLessThanOrEqual(PINCH_MAX_ZOOM);
    expect(PINCH_MAX_ZOOM).toBe(3);
  });

  it('a second finger landing mid-stroke turns the gesture into a pinch, not paint', () => {
    const g = renderGrid();
    g.send(pointer('pointerdown', cellCentre(1, 1), { id: 1 }));
    g.send(pointer('pointerdown', cellCentre(5, 5), { id: 2 }));
    g.onCellHover.mockClear();
    g.send(pointer('pointermove', cellCentre(1, 6), { id: 1 }));
    expect(g.onCellHover).not.toHaveBeenCalled();
  });

  it('desktop mouse behaviour is unchanged: pointer events from a mouse do nothing', () => {
    const g = renderGrid();
    const p = cellCentre(1, 1);
    g.send(pointer('pointerdown', p, { pointerType: 'mouse' }));
    g.send(pointer('pointermove', cellCentre(1, 4), { pointerType: 'mouse' }));
    g.send(pointer('pointerup', cellCentre(1, 4), { pointerType: 'mouse' }));

    expect(g.onCellPress).not.toHaveBeenCalled();
    expect(g.onCellHover).not.toHaveBeenCalled();
    expect(g.onCellClick).not.toHaveBeenCalled();
    expect(g.onZoomChange).not.toHaveBeenCalled();
  });

  it('desktop mouse drag still paints and commits exactly as before', () => {
    const g = renderGrid({ isMouseDown: true });
    g.send(mouse('mousedown', cellCentre(1, 1)));
    g.send(mouse('mousemove', cellCentre(1, 4)));
    g.send(mouse('click', cellCentre(1, 4)));

    expect(g.onCellPress).toHaveBeenCalledWith(1, 1);
    // Unchanged mouse semantics: the press paints the first cell, the move
    // reports the cell under the cursor, the click commits on release.
    expect(cellsOf(g.onCellHover)).toEqual(['1,4']);
    expect(g.onCellClick).toHaveBeenCalledWith(1, 4);
  });

  it('the canvas opts out of browser scroll/zoom so a drag is not eaten', () => {
    const g = renderGrid();
    expect((g.canvas as HTMLCanvasElement).style.touchAction).toBe('none');
  });
});
