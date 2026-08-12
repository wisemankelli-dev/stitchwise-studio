/**
 * Tests for Pattern Designer studio Save/Load controls (QA-V6 F-2, 2026-08-12).
 *
 * Covers:
 * 1. Save + Load controls are present in the studio toolbar
 * 2. Pattern persistence round-trip through the patterns API (save → list → load → delete)
 * 3. Load restores the grid into Designer state via the UI
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Designer } from '../pages/Designer';
import { api } from '../services/api';

const renderDesigner = () => render(
  <BrowserRouter>
    <Designer />
  </BrowserRouter>
);

describe('Pattern Designer — Save/Load (F-2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Save + Load controls in the studio toolbar', () => {
    renderDesigner();
    expect(screen.getByPlaceholderText('Pattern name...')).toBeInTheDocument();
    expect(screen.getByTitle('Save pattern to your library')).toBeInTheDocument();
    expect(screen.getByTitle('Load a saved pattern')).toBeInTheDocument();
  });

  it('saving a pattern shows a confirmation and persists it via the API', async () => {
    renderDesigner();
    fireEvent.change(screen.getByPlaceholderText('Pattern name...'), { target: { value: 'QA-F2-heart' } });
    fireEvent.click(screen.getByTitle('Save pattern to your library'));
    await waitFor(() => expect(screen.getByText(/Saved "QA-F2-heart"!/)).toBeInTheDocument());
    const patterns = await api.listPatterns();
    expect(patterns.some(p => p.name === 'QA-F2-heart')).toBe(true);
  });

  it('round-trips a pattern grid through the patterns API (save → list → load → delete)', async () => {
    const grid = [
      [{ color: '#ff0000' }, { color: '' }, { color: '#ff0000' }],
      [{ color: '' }, { color: '#0000ff' }, { color: '' }],
      [{ color: '#ff0000' }, { color: '' }, { color: '#ff0000' }],
    ];
    const palette = [
      { code: 'MAN-1', name: '#ff0000', hex: '#ff0000', count: 4 },
      { code: 'MAN-2', name: '#0000ff', hex: '#0000ff', count: 1 },
    ];
    const saved = await api.savePattern('Roundtrip', grid, palette, 16, 5);
    expect(saved.name).toBe('Roundtrip');
    expect(saved.gridSize).toBe(16);
    expect(saved.stitchCount).toBe(5);

    const list = await api.listPatterns();
    expect(list.some(p => p.id === saved.id)).toBe(true);

    const loaded = await api.loadPattern(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.grid).toHaveLength(3);
    expect(loaded?.grid[0][0].color).toBe('#ff0000');
    expect(loaded?.grid[1][1].color).toBe('#0000ff');
    expect(loaded?.palette).toHaveLength(2);

    await api.deletePattern(saved.id);
    const after = await api.listPatterns();
    expect(after.some(p => p.id === saved.id)).toBe(false);
  });

  it('Load dropdown lists saved patterns and loading restores the canvas', async () => {
    // Pre-seed a pattern through the API
    const grid = [[{ color: '#00ff00' }]];
    const palette = [{ code: 'MAN-1', name: '#00ff00', hex: '#00ff00', count: 1 }];
    const saved = await api.savePattern('Seeded Green', grid, palette, 16, 1);

    renderDesigner();
    fireEvent.click(screen.getByTitle('Load a saved pattern'));
    await screen.findByText('Seeded Green');
    fireEvent.click(screen.getByText('Seeded Green'));
    await waitFor(() => expect(screen.getByText(/Loaded "Seeded Green"/)).toBeInTheDocument());
    // The name field is populated with the loaded pattern's name
    expect((screen.getByPlaceholderText('Pattern name...') as HTMLInputElement).value).toBe('Seeded Green');

    await api.deletePattern(saved.id);
  });
});
