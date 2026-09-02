/**
 * Tests for the Crafter Dashboard "My Patterns" section.
 *
 * Owner-approved (09-03): the Dashboard must list ALL of a member's saved
 * projects — cross-stitch patterns (GET /api/projects), Collage projects
 * (api.listCollageProjects), and Quilt Block projects (api.listQuiltBlocks) —
 * each labelled by type, with a working "open" link, and per-user isolation
 * (only the logged-in member's own projects in each category).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { api } from '../services/api';
import type { Project, CollageProject, QuiltBlockDesign } from '../services/api';

vi.mock('../services/api', () => {
  const actual = vi.importActual('../services/api');
  return {
    ...(actual as object),
    api: {
      getUserProfile: vi.fn(),
      getProjects: vi.fn(),
      listCollageProjects: vi.fn(),
      listQuiltBlocks: vi.fn(),
      getMarketplaceListings: vi.fn(),
    },
  };
});

const mockProject = (over: Partial<Project> = {}): Project =>
  ({
    id: 'proj-1',
    name: 'My Cross Stitch',
    gridSize: 50,
    previewColor: 'from-blush-400 to-blush-300',
    owner: 'me@test.com',
    lastUpdated: '2026-09-01',
    ...over,
  }) as Project;

const mockCollage = (over: Partial<CollageProject> = {}): CollageProject =>
  ({
    id: 'collage-1',
    name: 'My Rooster Collage',
    layers: [{ id: 'bg', name: 'Background', color: '#fff', pattern: 'solid', opacity: 1 }],
    pieces: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...over,
  }) as CollageProject;

const mockQuilt = (over: Partial<QuiltBlockDesign> = {}): QuiltBlockDesign =>
  ({
    id: 'quilt-1',
    name: 'My Star Quilt',
    shapes: [{ id: 's1', type: 'star', color: '#fff', pattern: 'solid', x: 0, y: 0, width: 1, height: 1, rotation: 0, scale: 1, zIndex: 0 }],
    blockSize: 12,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
    ...over,
  }) as QuiltBlockDesign;

describe('Dashboard — My Patterns lists all project types', () => {
  beforeEach(() => {
    vi.mocked(api.getUserProfile).mockResolvedValue({ subscriptionTier: 'Hobbyist' } as never);
    vi.mocked(api.getProjects).mockResolvedValue([mockProject()]);
    vi.mocked(api.listCollageProjects).mockResolvedValue([mockCollage()]);
    vi.mocked(api.listQuiltBlocks).mockResolvedValue([mockQuilt()]);
    vi.mocked(api.getMarketplaceListings).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders cross-stitch, collage, and quilt block cards with type badges', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    // Wait for data to load.
    await waitFor(() => {
      expect(screen.getByText('My Cross Stitch')).toBeTruthy();
      expect(screen.getByText('My Rooster Collage')).toBeTruthy();
      expect(screen.getByText('My Star Quilt')).toBeTruthy();
    });
    // Type badges.
    expect(screen.getByText('Cross-stitch')).toBeTruthy();
    expect(screen.getByText('Collage', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('Quilt Block', { selector: 'span' })).toBeTruthy();
    // Total count badge includes all three.
    expect(screen.getByText('3 created')).toBeTruthy();
  });

  it('links each card to the correct studio editor', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('My Cross Stitch')).toBeTruthy();
    });
    const collageStudio = screen.getAllByText('Open Studio')[0];
    const quiltStudio = screen.getAllByText('Open Studio')[1];
    expect(collageStudio.closest('a')?.getAttribute('href')).toMatch(/\/collage$/);
    expect(quiltStudio.closest('a')?.getAttribute('href')).toMatch(/\/quilt-block$/);
    // Cross-stitch still opens the project detail editor.
    expect(screen.getByText('Open Editor').getAttribute('href')).toMatch(/\/projects\/proj-1$/);
  });

  it('shows an empty state when the member has no projects of any type', async () => {
    vi.mocked(api.getProjects).mockResolvedValue([]);
    vi.mocked(api.listCollageProjects).mockResolvedValue([]);
    vi.mocked(api.listQuiltBlocks).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/No saved projects yet/)).toBeTruthy();
      expect(screen.getByText('0 created')).toBeTruthy();
    });
  });
});