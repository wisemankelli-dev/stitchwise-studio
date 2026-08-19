/**
 * Undo/redo history helpers for the Pattern Designer (owner request 08-18:
 * "Can the design have an Undo button or Step backwards button…").
 *
 * Pure functions over immutable stacks — kept free of React so the behavior is
 * trivially unit-testable. Designer.tsx wires these to the grid state:
 * - `pushSnapshot` appends one snapshot (pre-edit state) and caps the stack.
 * - `popSnapshot` removes + returns the top snapshot (the state to restore).
 *
 * One undo step = one committed user edit (a whole paint stroke, one flood
 * fill, one shape placement, one letter placement…), never per-cell.
 */
export interface HistorySnapshot {
  grid: Record<string, string>;
  stitchTypes: Record<string, string>;
  fractions: Record<string, number>;
}

/** Cap on the undo history, bounding memory on large canvases (240×240 = 57k cells). */
export const HISTORY_LIMIT = 50;

/**
 * Append a snapshot to the stack. When the stack exceeds `limit`, the OLDEST
 * entries are dropped so memory stays bounded.
 */
export function pushSnapshot<T>(stack: T[], snap: T, limit: number = HISTORY_LIMIT): T[] {
  const next = [...stack, snap];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/**
 * Remove and return the top of the stack (the most recent snapshot).
 * Returns an unchanged stack and `top: undefined` when empty.
 */
export function popSnapshot<T>(stack: T[]): { stack: T[]; top: T | undefined } {
  if (stack.length === 0) return { stack, top: undefined };
  return { stack: stack.slice(0, -1), top: stack[stack.length - 1] };
}

/**
 * Simulate the undo/redo state machine that Designer.tsx runs (pure version,
 * used by tests to prove the round-trip): `undo` moves the current snapshot
 * from the undo stack onto the redo stack and returns the restored snapshot.
 */
export function undo<T>(undoStack: T[], redoStack: T[], current: T): { undoStack: T[]; redoStack: T[]; restored: T | undefined } {
  const popped = popSnapshot(undoStack);
  if (!popped.top) return { undoStack: popped.stack, redoStack, restored: undefined };
  return {
    undoStack: popped.stack,
    redoStack: pushSnapshot(redoStack, current),
    restored: popped.top,
  };
}

/**
 * `redo` moves the current snapshot from the redo stack back onto the undo
 * stack and returns the restored snapshot.
 */
export function redo<T>(undoStack: T[], redoStack: T[], current: T): { undoStack: T[]; redoStack: T[]; restored: T | undefined } {
  const popped = popSnapshot(redoStack);
  if (!popped.top) return { undoStack, redoStack: popped.stack, restored: undefined };
  return {
    undoStack: pushSnapshot(undoStack, current),
    redoStack: popped.stack,
    restored: popped.top,
  };
}
