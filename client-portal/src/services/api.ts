/**
 * StitchWise Studio API Client Service Layer
 * Defines data models and provides communication endpoints.
 * Includes robust mocks with artificial network latency that persist state locally.
 */

// Data Interfaces
export interface Project {
  id: string;
  name: string;
  owner: string;
  avatar: string;
  role: 'owner' | 'collaborator';
  lastUpdated: string;
  gridSize: string;
  collaboratorsCount: number;
  activeSessionId: string;
  complexity: 'Hobbyist' | 'Pro' | 'Masterpiece';
  previewColor: string;
  description?: string;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'hobbyist' | 'designer' | 'studio_admin';
  subscriptionTier: 'Hobbyist' | 'Pro Crafter' | 'Design Studio';
  avatarUrl?: string;
}

export interface StitchRequest {
  paths: string;
  format: 'DST' | 'PES' | 'EXP';
  colorPalette?: string[];
  stitchCount?: number;
}

export interface StitchResponse {
  success: boolean;
  stitchFileUrl: string;
  format: 'DST' | 'PES' | 'EXP';
  stitchCount: number;
  estimatedThreadSkeins: number;
  checksum: string;
  processingTimeMs: number;
}

// Utility function to simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fallback initial projects if nothing is in localStorage yet
const INITIAL_PROJECTS: Project[] = [
  {
    id: 'rose-heart',
    name: 'Rose Heart Patch',
    owner: 'You',
    avatar: '👑',
    role: 'owner',
    lastUpdated: '5 minutes ago',
    gridSize: '16x16 Grid',
    collaboratorsCount: 3,
    activeSessionId: 'rose-heart-collab',
    complexity: 'Hobbyist',
    previewColor: 'from-rose-500 to-amber-500',
    description: 'A beautiful rose patch designed on a basic canvas.'
  },
  {
    id: 'spring-tulip',
    name: 'Spring Tulip Border',
    owner: 'You',
    avatar: '👑',
    role: 'owner',
    lastUpdated: '2 days ago',
    gridSize: '24x24 Grid',
    collaboratorsCount: 1,
    activeSessionId: 'tulip-collab',
    complexity: 'Pro',
    previewColor: 'from-emerald-500 to-teal-400',
    description: 'Elegant border with tulip motifs, optimized for domestic machine loop sizes.'
  }
];

class ApiClient {
  private isLiveBackend: boolean = false; // Toggle to true when backend is ready
  private apiBaseUrl: string = '/api';

  constructor() {
    // Detect environment or check search params to force mock mode if desired
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mock') === 'false') {
        this.isLiveBackend = true;
      }
    }
  }

  /**
   * Generates stitch instructions and coordinates from vector or raster path data.
   */
  async generateStitches(paths: string, format: 'DST' | 'PES' | 'EXP'): Promise<StitchResponse> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/stitch/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths, format })
        });
        if (!response.ok) throw new Error('Stitch generation API error');
        return await response.json();
      } catch (err) {
        console.error('Failed to contact backend, falling back to mock stitch generation', err);
      }
    }

    // Mock Implementation
    await delay(2500); // Simulate AI digitizer thinking time
    const count = Math.floor(Math.random() * 3000) + 1200;
    const skeins = parseFloat((count / 1500 + 0.5).toFixed(1));
    return {
      success: true,
      stitchFileUrl: `/downloads/pattern_${Math.floor(Math.random() * 900000 + 100000)}.${format.toLowerCase()}`,
      format,
      stitchCount: count,
      estimatedThreadSkeins: skeins,
      checksum: Math.random().toString(36).substring(2, 10).toUpperCase(),
      processingTimeMs: 2500
    };
  }

  /**
   * Converts user-uploaded image/pattern files into stitch formats (.DST, .PES, .EXP).
   */
  async convertStitches(file: File, format: 'DST' | 'PES' | 'EXP'): Promise<StitchResponse> {
    if (this.isLiveBackend) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);

        const response = await fetch(`${this.apiBaseUrl}/stitch/convert`, {
          method: 'POST',
          body: formData
        });
        if (!response.ok) throw new Error('File conversion API error');
        return await response.json();
      } catch (err) {
        console.error('Failed to contact backend, falling back to mock conversion', err);
      }
    }

    // Mock Implementation
    await delay(2000); // Simulate conversion latency
    const count = Math.floor(Math.random() * 4000) + 1000;
    const skeins = parseFloat((count / 1400 + 0.4).toFixed(1));
    return {
      success: true,
      stitchFileUrl: `/downloads/converted_${Date.now()}.${format.toLowerCase()}`,
      format,
      stitchCount: count,
      estimatedThreadSkeins: skeins,
      checksum: Math.random().toString(36).substring(2, 10).toUpperCase(),
      processingTimeMs: 2000
    };
  }

  /**
   * Retrieves all projects available to the active user session.
   */
  async getProjects(): Promise<Project[]> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/projects`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        return await response.json();
      } catch (err) {
        console.error('Failed to contact backend, falling back to cached projects', err);
      }
    }

    // Mock/localStorage Implementation
    await delay(600); // Simulate minor database query latency
    const stored = localStorage.getItem('stitchwise_projects');
    if (!stored) {
      localStorage.setItem('stitchwise_projects', JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    return JSON.parse(stored);
  }

  /**
   * Registers a new project in the system.
   */
  async createProject(data: Partial<Project>): Promise<Project> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to register project');
        return await response.json();
      } catch (err) {
        console.error('Failed to create project on backend, using local persistence fallback', err);
      }
    }

    // Mock/localStorage Implementation
    await delay(800);
    const projects = await this.getProjects();
    const newProject: Project = {
      id: data.id || `project-${Date.now()}`,
      name: data.name || 'Untitled Pattern',
      owner: 'You',
      avatar: data.avatar || '🧵',
      role: 'owner',
      lastUpdated: 'Just now',
      gridSize: data.gridSize || '16x16 Grid',
      collaboratorsCount: 0,
      activeSessionId: `session-${Math.floor(Math.random() * 900000 + 100000)}`,
      complexity: data.complexity || 'Hobbyist',
      previewColor: data.previewColor || 'from-brand-500 to-rose-400',
      description: data.description || '',
      createdAt: new Date().toISOString()
    };

    projects.unshift(newProject);
    localStorage.setItem('stitchwise_projects', JSON.stringify(projects));
    return newProject;
  }

  /**
   * Fetches the current user profile including active subscription tiers.
   */
  async getUserProfile(): Promise<User> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/user/profile`);
        if (!response.ok) throw new Error('Failed to fetch user profile');
        return await response.json();
      } catch (err) {
        console.error('Failed to fetch user from backend, using local fallback', err);
      }
    }

    // Mock/localStorage Implementation
    await delay(400);
    const activeTier = (localStorage.getItem('stitchwise_tier') as any) || 'Hobbyist';
    return {
      id: 'usr-928174',
      name: 'Elena Crafter',
      email: 'elena@stitchwise.studio',
      role: activeTier === 'Design Studio' ? 'studio_admin' : 'hobbyist',
      subscriptionTier: activeTier,
      avatarUrl: '🌸'
    };
  }

  /**
   * Update the user subscription tier.
   */
  async updateSubscriptionTier(tier: 'Hobbyist' | 'Pro Crafter' | 'Design Studio'): Promise<User> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/user/subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier })
        });
        if (!response.ok) throw new Error('Failed to update subscription');
        return await response.json();
      } catch (err) {
        console.error('Failed to update subscription on backend', err);
      }
    }

    await delay(800);
    localStorage.setItem('stitchwise_tier', tier);
    return await this.getUserProfile();
  }
}

export const api = new ApiClient();
