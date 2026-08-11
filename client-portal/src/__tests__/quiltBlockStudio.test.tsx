/**
 * Tests for Quilt Block Studio — owner-spec redesign (2026-08-11).
 *
 * Covers:
 * 1. Blank grid sheet (no floating shapes on open)
 * 2. Shapes Library (click a shape to add it)
 * 3. Block sizes limited to 6/8/10/12 inch blocks ONLY
 * 4. Selection → full editing inspector (Fabric Color/Texture/Size/Rotation)
 * 5. Double-click duplicate, Delete-key removal, Reset
 * 6. Legacy save migration (gridX/gridY/size → free x/y/w/h)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QuiltBlockStudio, migrateShape } from '../pages/QuiltBlockStudio';

const renderStudio = () => render(
  <BrowserRouter>
    <QuiltBlockStudio />
  </BrowserRouter>
);

describe('Quilt Block Studio — owner-spec redesign', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens as a BLANK grid sheet (no floating shapes)', () => {
    renderStudio();
    expect(screen.getByText('Quilt Block Studio')).toBeInTheDocument();
    expect(screen.getByText('0 shapes')).toBeInTheDocument();
    // No shape elements in the canvas
    expect(document.querySelectorAll('[data-shape-id]').length).toBe(0);
  });

  it('renders the Shapes Library with every shape type', () => {
    renderStudio();
    ['Square', 'Rectangle', 'Triangle', 'Circle', 'Diamond', 'Octagon', 'Pentagon', 'Hexagon', 'Half-Square Tri.', 'Quarter-Square Tri.'].forEach(label => {
      expect(screen.getByTitle(`Add ${label} to the block`)).toBeInTheDocument();
    });
  });

  it('offers ONLY the four owner-spec block sizes (6/8/10/12)', () => {
    renderStudio();
    [6, 8, 10, 12].forEach(n => {
      expect(screen.getByTitle(`${n}" x ${n}" block`)).toBeInTheDocument();
    });
    expect(screen.queryByTitle('16" x 16" block')).toBeNull();
  });

  it('clicking a shape in the library adds it to the block and selects it', () => {
    renderStudio();
    fireEvent.click(screen.getByTitle('Add Square to the block'));
    expect(screen.getByText('1 shapes')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-shape-id]').length).toBe(1);
    // Inspector opens for the selected shape (type is lowercased in DOM, capitalized via CSS)
    expect(screen.getByText(/square shape/i)).toBeInTheDocument();
  });

  it('shows the full editing inspector when a shape is selected', () => {
    renderStudio();
    fireEvent.click(screen.getByTitle('Add Triangle to the block'));
    expect(screen.getByText('Fabric Color')).toBeInTheDocument();
    expect(screen.getByText('Fabric Texture')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Rotation')).toBeInTheDocument();
  });

  it('double-clicking a shape duplicates it', () => {
    renderStudio();
    fireEvent.click(screen.getByTitle('Add Circle to the block'));
    expect(document.querySelectorAll('[data-shape-id]').length).toBe(1);
    const shapeEl = document.querySelector('[data-shape-id]');
    fireEvent.doubleClick(shapeEl as Element);
    expect(document.querySelectorAll('[data-shape-id]').length).toBe(2);
    expect(screen.getByText('2 shapes')).toBeInTheDocument();
  });

  it('Delete key removes the selected shape', () => {
    renderStudio();
    fireEvent.click(screen.getByTitle('Add Square to the block'));
    expect(screen.getByText('1 shapes')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.getByText('0 shapes')).toBeInTheDocument();
  });

  it('Reset clears all shapes', () => {
    renderStudio();
    fireEvent.click(screen.getByTitle('Add Square to the block'));
    fireEvent.click(screen.getByTitle('Add Triangle to the block'));
    expect(screen.getByText('2 shapes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.getByText('0 shapes')).toBeInTheDocument();
  });

  it('migrates legacy grid-model saves into the free-position model', () => {
    const legacy = {
      id: 's1', type: 'square', color: '#fbcfe8', pattern: 'solid',
      gridX: 2, gridY: 3, size: 2, rotation: 90, zIndex: 1,
    };
    const migrated = migrateShape(legacy);
    expect(migrated.x).toBe(2 * 50);   // gridX * legacy cellPx
    expect(migrated.y).toBe(3 * 50);   // gridY * legacy cellPx
    expect(migrated.width).toBe(2 * 50); // size * legacy cellPx
    expect(migrated.height).toBe(2 * 50);
    expect(migrated.rotation).toBe(90);
    expect(migrated.scale).toBe(1);
  });

  it('keeps already-migrated (free-position) shapes untouched on load', () => {
    const modern = {
      id: 's2', type: 'circle', color: '#ffffff', pattern: 'stripe',
      x: 123, y: 45, width: 80, height: 80, rotation: 30, scale: 1.4, zIndex: 2,
    };
    const m = migrateShape(modern);
    expect(m.x).toBe(123);
    expect(m.y).toBe(45);
    expect(m.width).toBe(80);
    expect(m.scale).toBe(1.4);
  });
});
