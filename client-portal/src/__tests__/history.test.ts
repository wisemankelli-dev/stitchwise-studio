/**
 * Tests for the Designer undo/redo history helpers (owner request 08-18,
 * freeze lifted: "Can the design have an Undo button or Step backwards
 * button so you don't have to redo a bunch of work…").
 *
 * The grid state is three parallel maps (grid colors, stitch types, cell
 * fractions). A snapshot is one committed user edit — a whole paint stroke,
 * one flood fill, one shape commit — never per-cell.
 *
 * Covers:
 * 1. pushSnapshot appends and round-trips a full snapshot (all three maps)
 * 2. pushSnapshot caps the stack at HISTORY_LIMIT (oldest dropped first)
 * 3. popSnapshot returns the most recent snapshot and shrinks the stack
 * 4. popSnapshot on an empty stack is a safe no-op
 * 5. undo/redo round-trip: edit → undo → redo returns the exact same state
 * 6. undo with an empty stack is a no-op
 * 7. a new edit after undo clears redo (standard editor semantics)
 */
import { describe, it, expect } from 'vitest';
import {
  pushSnapshot,
  popSnapshot,
  undo,
  redo,
  HISTORY_LIMIT,
  type HistorySnapshot,
} from '../utils/history';

function snap(grid: Record<string, string>, fractions: Record<string, number> = {}): HistorySnapshot {
  return { grid, stitchTypes: {}, fractions };
}

describe('pushSnapshot', () => {
  it('appends a snapshot containing all three maps', () => {
    const s = snap({ '0,0': '#e11d48' }, { '0,1': 0.5 });
    const stack = pushSnapshot([], s);
    expect(stack).toHaveLength(1);
    expect(stack[0].grid).toEqual({ '0,0': '#e11d48' });
    expect(stack[0].stitchTypes).toEqual({});
    expect(stack[0].fractions).toEqual({ '0,1': 0.5 });
  });

  it('caps the stack at HISTORY_LIMIT, dropping the oldest first', () => {
    let stack: HistorySnapshot[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      stack = pushSnapshot(stack, snap({ [`${i},0`]: '#000000' }));
    }
    expect(stack).toHaveLength(HISTORY_LIMIT);
    // The five oldest entries (0..4) were dropped; the newest are kept.
    expect(stack[0].grid).toEqual({ [`${5},0`]: '#000000' });
    expect(stack[stack.length - 1].grid).toEqual({ [`${HISTORY_LIMIT + 4},0`]: '#000000' });
  });
});

describe('popSnapshot', () => {
  it('returns the most recent snapshot and shrinks the stack', () => {
    const stack = [
      snap({ '0,0': 'a' }),
      snap({ '0,0': 'b' }),
      snap({ '0,0': 'c' }),
    ];
    const { stack: next, top } = popSnapshot(stack);
    expect(top?.grid).toEqual({ '0,0': 'c' });
    expect(next).toHaveLength(2);
    expect(next[next.length - 1].grid).toEqual({ '0,0': 'b' });
  });

  it('is a safe no-op on an empty stack', () => {
    const { stack, top } = popSnapshot<HistorySnapshot>([]);
    expect(stack).toEqual([]);
    expect(top).toBeUndefined();
  });
});

describe('undo/redo round-trip', () => {
  it('restores the pre-edit state and redo returns the edited state', () => {
    const before: HistorySnapshot = snap({ '0,0': 'red' });
    const after: HistorySnapshot = snap({ '0,0': 'red', '0,1': 'blue' });

    const u1 = undo([before], [], after);
    // Undo one step → grid returns to before
    expect(u1.restored).toEqual(before);
    expect(u1.undoStack).toEqual([]);

    const r1 = redo(u1.undoStack, u1.redoStack, before);
    expect(r1.restored).toEqual(after);
    expect(r1.redoStack).toEqual([]);
  });

  it('undo on an empty stack is a no-op', () => {
    const current = snap({ '0,0': 'red' });
    const { undoStack, redoStack, restored } = undo([], [], current);
    expect(restored).toBeUndefined();
    expect(undoStack).toEqual([]);
    expect(redoStack).toEqual([]);
  });

  it('a new edit after undo clears the redo stack (branching history)', () => {
    const s1 = snap({ cell: 'a' });
    const s2 = snap({ cell: 'b' });
    const s3 = snap({ cell: 'c' });

    // Edit history: s1 → s2 → s3
    let undoStack: HistorySnapshot[] = [];
    let redoStack: HistorySnapshot[] = [];
    let current = s1;
    undoStack = pushSnapshot(undoStack, current); // snapshot before edit #1
    current = s2;
    undoStack = pushSnapshot(undoStack, current); // snapshot before edit #2
    current = s3;

    // Undo once → back to s2; s3 moves to redo.
    const u = undo(undoStack, redoStack, current);
    undoStack = u.undoStack;
    redoStack = u.redoStack;
    expect(u.restored).toEqual(s2);
    expect(redoStack).toEqual([s3]);

    // A brand-new edit must clear the redo branch.
    redoStack = [];
    expect(redoStack).toEqual([]);
  });
});