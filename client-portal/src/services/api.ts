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
  updatedAt?: string;
  data?: string;
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

/** Marketplace listing data model */
export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  previewUrl?: string;
  designerName: string;
  designerId: string;
  rating: number;
  salesCount: number;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
}

/** Community Showcase entry data model */
export interface ShowcaseEntry {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  title: string;
  description?: string;
  tips?: string;
  imageUrl: string;
  projectType: 'embroidery' | 'collage' | 'quilt-block';
  metadata: {
    stitchCount?: number;
    threadColors?: string[];
    fabricType?: string;
    patternSource?: string;
    timeSpent?: string;
  };
  likes: number;
  createdAt: string;
}

// ==================== AI EMBROIDERY PATTERN TYPES ====================

/** Response from AI pattern generation */
export interface AIPatternResponse {
  success: boolean;
  grid: string[][];               // 2D array of hex color codes: grid[row][col]
  stitchTypes: string[][];        // 2D array of stitch type strings
  width: number;
  height: number;
  dmcPalette: { code: string; name: string; hex: string; count: number }[];
  totalStitches: number;
  promptUsed?: string;
  processingTimeMs: number;
  /** Base64 data URL of the AI-generated preview image */
  previewUrl?: string;
  /** Fabric context returned by backend */
  fabric?: FabricInfo;
  fabricPiece?: FabricPieceInfo;
}

/** Cell format returned by the text-to-line-art-pattern endpoint */
export interface LineArtCell {
  color: string;
  dmcCode?: string;
  dmcName?: string;
  stitchType?: 'cross' | 'satin' | 'back' | 'french';
}

/** Response format from POST /api/ai/text-to-line-art-pattern */
export interface LineArtPatternResponse {
  grid: LineArtCell[][];
}

/** Fabric count and resulting physical dimensions */
export interface FabricInfo {
  count: number;    // stitches per inch (e.g. 14)
  inches: number;   // pattern size in inches
}

/** Fabric piece sizing with margins */
export interface FabricPieceInfo {
  patternInches: number;   // design size (same as fabric.inches)
  fabricInches: number;    // total fabric needed (pattern + margins)
  fabricStitches: number;  // fabric size in stitches
  marginInches: number;    // margin on each side (default 3)
}


/** Response from POST /api/ai/embroidery/text-to-pattern (async) */
export interface AIPatternJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  result?: AIPatternResponse | null;
  error?: string | null;
}

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
  },
  {
    id: 'vintage-floral',
    name: 'Vintage Floral Border',
    owner: 'Elena Crafter',
    avatar: '🌸',
    role: 'collaborator',
    lastUpdated: '2 hours ago',
    gridSize: '32x32 Grid',
    collaboratorsCount: 4,
    activeSessionId: 'floral-workshop',
    complexity: 'Masterpiece',
    previewColor: 'from-violet-500 to-fuchsia-400',
    description: 'Intricate vintage floral compilation shared for joint editing and thread density calibration.'
  },
  {
    id: 'golden-retriever',
    name: 'Golden Retriever Portrait',
    owner: 'Dave Digitizer',
    avatar: '🐕',
    role: 'collaborator',
    lastUpdated: 'Yesterday',
    gridSize: '16x16 Grid',
    collaboratorsCount: 2,
    activeSessionId: 'retriever-workshop',
    complexity: 'Masterpiece',
    previewColor: 'from-amber-600 to-yellow-400',
    description: 'Photorealistic pet portrait utilizing advanced satin-stitch shading and blending palettes.'
  },
  {
    id: 'cyberpunk-dragon',
    name: 'Cyberpunk Dragon Patch',
    owner: 'StitchMaster Pro',
    avatar: '🐉',
    role: 'collaborator',
    lastUpdated: '3 days ago',
    gridSize: '48x48 Grid',
    collaboratorsCount: 5,
    activeSessionId: 'dragon-workshop',
    complexity: 'Pro',
    previewColor: 'from-pink-600 to-rose-400',
    description: 'High-density futuristic dragon emblem suitable for jacket back embroidery.'
  }
];

class ApiClient {
  public isLiveBackend: boolean = true; // Auto-detect — try backend first, fall to mock on failure
  private apiBaseUrl: string = '/api';

  constructor() {
    if (typeof window !== 'undefined') {
      // Verify backend is actually reachable
      this.checkBackendHealth();
    }
  }

  private async checkBackendHealth(): Promise<void> {
    try {
      const resp = await fetch(`${this.apiBaseUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        this.isLiveBackend = true;
        console.log('[api] Backend detected — using live API');
      } else {
        this.isLiveBackend = false;
        console.warn('[api] Backend unhealthy — using mock data');
      }
    } catch {
      this.isLiveBackend = false;
      console.warn('[api] Backend unreachable — using mock data');
    }
  }

  /**
   * Builds active Authorization and Content-Type headers dynamically.
   */
  private getHeaders(additionalHeaders: Record<string, string> = {}, skipContentType: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      ...additionalHeaders
    };
    if (!skipContentType) {
      headers['Content-Type'] = 'application/json';
    }
    const token = localStorage.getItem('stitchwise_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Throws an Error carrying the HTTP status so pages can show honest,
   * specific messages (e.g. "Please sign in to use AI generation" on 401).
   */
  private throwApiError(message: string, response: Response): never {
    const err = new Error(message) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  /**
   * Authenticates user using email and password.
   */
  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ email, password })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || 'Login failed');
        }
        const result = await response.json();
        if (result.token) {
          localStorage.setItem('stitchwise_token', result.token);
          if (result.user) {
            localStorage.setItem('stitchwise_active_user_id', result.user.id);
            localStorage.setItem('stitchwise_tier', result.user.subscriptionTier);
          }
        }
        return { success: true, ...result };
      } catch (err: any) {
        console.error('Login error:', err);
        return { success: false, error: err.message || 'Login failed' };
      }
    }

    // Mock/localStorage Implementation
    const usersStr = localStorage.getItem('stitchwise_users');
    let users: any[] = usersStr ? JSON.parse(usersStr) : [];
    
    // Seed default user if database empty
    if (users.length === 0) {
      const defaultUser = {
        id: 'usr-928174',
        name: 'Elena Crafter',
        email: 'elena@stitchwise.studio',
        password: 'password123',
        role: 'hobbyist',
        subscriptionTier: 'Hobbyist',
        avatarUrl: '🌸'
      };
      users.push(defaultUser);
      localStorage.setItem('stitchwise_users', JSON.stringify(users));
    }

    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!foundUser || foundUser.password !== password) {
      return { success: false, error: 'Invalid email or password' };
    }

    const token = `mock-jwt-header.${btoa(JSON.stringify({ userId: foundUser.id, email: foundUser.email }))}.mock-signature`;
    localStorage.setItem('stitchwise_token', token);
    localStorage.setItem('stitchwise_active_user_id', foundUser.id);
    localStorage.setItem('stitchwise_tier', foundUser.subscriptionTier);

    return {
      success: true,
      token,
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role as any,
        subscriptionTier: foundUser.subscriptionTier as any,
        avatarUrl: foundUser.avatarUrl
      }
    };
  }

  /**
   * Registers a new user.
   */
  async signup(name: string, email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/auth/signup`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ name, email, password })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || 'Signup failed');
        }
        const result = await response.json();
        if (result.token) {
          localStorage.setItem('stitchwise_token', result.token);
          if (result.user) {
            localStorage.setItem('stitchwise_active_user_id', result.user.id);
            localStorage.setItem('stitchwise_tier', result.user.subscriptionTier);
          }
        }
        return { success: true, ...result };
      } catch (err: any) {
        console.error('Signup error:', err);
        return { success: false, error: err.message || 'Signup failed' };
      }
    }

    // Mock/localStorage Implementation
    const usersStr = localStorage.getItem('stitchwise_users');
    let users: any[] = usersStr ? JSON.parse(usersStr) : [];

    // Seed default user if database empty
    if (users.length === 0) {
      const defaultUser = {
        id: 'usr-928174',
        name: 'Elena Crafter',
        email: 'elena@stitchwise.studio',
        password: 'password123',
        role: 'hobbyist',
        subscriptionTier: 'Hobbyist',
        avatarUrl: '🌸'
      };
      users.push(defaultUser);
    }

    const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return { success: false, error: 'Email already registered' };
    }

    const newUser = {
      id: `usr-${Math.floor(Math.random() * 900000 + 100000)}`,
      name,
      email,
      password,
      role: 'hobbyist',
      subscriptionTier: 'Hobbyist',
      avatarUrl: '🧵'
    };

    users.push(newUser);
    localStorage.setItem('stitchwise_users', JSON.stringify(users));

    const token = `mock-jwt-header.${btoa(JSON.stringify({ userId: newUser.id, email: newUser.email }))}.mock-signature`;
    localStorage.setItem('stitchwise_token', token);
    localStorage.setItem('stitchwise_active_user_id', newUser.id);
    localStorage.setItem('stitchwise_tier', 'Hobbyist');

    return {
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: 'hobbyist',
        subscriptionTier: 'Hobbyist',
        avatarUrl: newUser.avatarUrl
      }
    };
  }

  /**
   * Logs out the user and clears dynamic tokens.
   */
  logout(): void {
    localStorage.removeItem('stitchwise_token');
    localStorage.removeItem('stitchwise_active_user_id');
    localStorage.setItem('stitchwise_tier', 'Hobbyist');
  }

  /**
   * Returns whether a valid session token exists in local storage.
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('stitchwise_token');
  }

  /**
   * Generates stitch instructions and coordinates from vector or raster path data.
   */
  async generateStitches(
    paths: string, 
    format: 'DST' | 'PES' | 'EXP', 
    options?: { fillType?: string; [key: string]: any }
  ): Promise<StitchResponse> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/stitch/generate`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ paths, format, fillType: options?.fillType, ...options })
        });
        if (!response.ok) throw new Error('Stitch generation API error');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
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
  async convertStitches(
    file: File, 
    format: 'DST' | 'PES' | 'EXP', 
    options?: { fillType?: string; [key: string]: any }
  ): Promise<StitchResponse> {
    if (this.isLiveBackend) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);
        if (options?.fillType) {
          formData.append('fillType', options.fillType);
        }

        const response = await fetch(`${this.apiBaseUrl}/stitch/convert`, {
          method: 'POST',
          headers: this.getHeaders({}, true),
          body: formData
        });
        if (!response.ok) throw new Error('File conversion API error');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
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
        const response = await fetch(`${this.apiBaseUrl}/projects`, {
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch projects');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }

    // Mock/localStorage Implementation
    const stored = localStorage.getItem('stitchwise_projects');
    if (!stored) {
      localStorage.setItem('stitchwise_projects', JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    return JSON.parse(stored);
  }

  /**
   * Retrieves a single project by ID, optionally since a given timestamp (for polling).
   */
  async getProject(id: string, since?: string): Promise<Project | null> {
    if (this.isLiveBackend) {
      try {
        const url = since
          ? `${this.apiBaseUrl}/projects/${id}?since=${encodeURIComponent(since)}`
          : `${this.apiBaseUrl}/projects/${id}`;

        const response = await fetch(url, {
          headers: this.getHeaders()
        });

        if (response.status === 304) {
          return null; // No changes
        }

        if (!response.ok) throw new Error('Failed to fetch project');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const projects = await this.getProjects();
    return projects.find((p) => p.id === id) || null;
  }

  /**
   * Registers a new project in the system.
   */
  async createProject(data: Partial<Project>): Promise<Project> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/projects`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to register project');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }

    // Mock/localStorage Implementation
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
   * Updates an existing project's metadata by ID.
   */
  async updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/projects/${id}`, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update project');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const projects = await this.getProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const updatedProject = {
      ...projects[idx],
      ...data,
      lastUpdated: 'Just now'
    };

    projects[idx] = updatedProject;
    localStorage.setItem('stitchwise_projects', JSON.stringify(projects));
    return updatedProject;
  }

  /**
   * Generates a unique, shareable collaboration session link.
   */
  async createShareLink(projectId: string): Promise<string> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/projects/${projectId}/share`, {
          method: 'POST',
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to create share link');
        const result = await response.json();
        return result.shareLink;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const project = await this.getProject(projectId);
    const sessionId = project?.activeSessionId || `session-${Math.floor(Math.random() * 900000 + 100000)}`;
    return `${window.location.origin}/designer?session=${sessionId}`;
  }

  /**
   * Invites a collaborator via email to join the embroidery project workshop.
   */
  async inviteCollaborator(projectId: string, email: string): Promise<boolean> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/projects/${projectId}/invite`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ email })
        });
        return response.ok;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const project = await this.getProject(projectId);
    if (!project) return false;

    // Simulate collaborator addition by incrementing count
    await this.updateProject(projectId, {
      collaboratorsCount: (project.collaboratorsCount || 0) + 1
    });
    return true;
  }

  /**
   * Fetches the current user profile including active subscription tiers.
   */
  async getUserProfile(): Promise<User> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/user/profile`, {
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch user profile');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }

    // Mock/localStorage Implementation
    const activeUserId = localStorage.getItem('stitchwise_active_user_id');
    const usersStr = localStorage.getItem('stitchwise_users');
    const users = usersStr ? JSON.parse(usersStr) : [];
    
    let activeUser = users.find((u: any) => u.id === activeUserId);
    
    if (!activeUser) {
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

    const currentTier = (localStorage.getItem('stitchwise_tier') as any) || activeUser.subscriptionTier;
    return {
      id: activeUser.id,
      name: activeUser.name,
      email: activeUser.email,
      role: currentTier === 'Design Studio' ? 'studio_admin' : 'hobbyist',
      subscriptionTier: currentTier,
      avatarUrl: activeUser.avatarUrl || '🧵'
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
          headers: this.getHeaders(),
          body: JSON.stringify({ tier })
        });
        if (!response.ok) throw new Error('Failed to update subscription');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    localStorage.setItem('stitchwise_tier', tier);
    
    // Persist subscription tier in our user list for completeness
    const activeUserId = localStorage.getItem('stitchwise_active_user_id');
    if (activeUserId) {
      const usersStr = localStorage.getItem('stitchwise_users');
      if (usersStr) {
        const users = JSON.parse(usersStr);
        const idx = users.findIndex((u: any) => u.id === activeUserId);
        if (idx !== -1) {
          users[idx].subscriptionTier = tier;
          localStorage.setItem('stitchwise_users', JSON.stringify(users));
        }
      }
    }
    
    return await this.getUserProfile();
  }

  /**
   * Fetches the user's active subscription tier from the backend or local fallback.
   */
  async getSubscriptionTier(): Promise<{ tier: 'Hobbyist' | 'Pro Crafter' | 'Design Studio' }> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/me/tier`, {
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch active tier');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    
    const tier = (localStorage.getItem('stitchwise_tier') as any) || 'Hobbyist';
    return { tier };
  }

  /**
   * Generates a Stripe Checkout session link for the given tier and billing period.
   */
  async createCheckoutSession(tier: string, billingPeriod: 'monthly' | 'annually'): Promise<{ success: boolean; url?: string; error?: string }> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/payments/create-checkout-session`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ tier, billingPeriod })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to create checkout session');
        }
        return await response.json();
      } catch (err: any) {
        console.error('Checkout session creation error:', err);
        return { success: false, error: err.message || 'Failed to connect to payment server' };
      }
    }

    // Mock/localStorage Implementation: Simulate redirect back to /pricing with parameters
    const redirectUrl = `${window.location.origin}/pricing?checkout-success=true&tier=${encodeURIComponent(tier)}`;
    return {
      success: true,
      url: redirectUrl
    };
  }

  /**
   * Generates a Stripe Customer Portal link or fallback status.
   */
  async createPortalSession(): Promise<{ success: boolean; url?: string; error?: string }> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/payments/create-portal-session`, {
          method: 'POST',
          headers: this.getHeaders()
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to create portal session');
        }
        return await response.json();
      } catch (err: any) {
        console.error('Portal session creation error:', err);
        return { success: false, error: err.message || 'Failed to connect to billing server' };
      }
    }

    // Mock/localStorage Implementation: Simulate customer portal by returning a mock URL
    const redirectUrl = `${window.location.origin}/pricing?portal-success=true`;
    return {
      success: true,
      url: redirectUrl
    };
  }

  // ==================== AI EMBROIDERY PATTERN GENERATION ====================

  /**
   * Step 1: Generate AI art from a text prompt.
   * POST /api/ai/generate-art
   */
  async generateArt(prompt: string): Promise<{ imageDataUrl: string; pipeline: string }> {
    if (!this.isLiveBackend) {
      throw new Error('Backend not available. Art generation requires a live backend connection.');
    }
    const response = await fetch(`${this.apiBaseUrl}/ai/generate-art`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ prompt }),
    });
    // Async job pattern (202 { jobId }): poll until done, retry once on error
    // (the retry re-POSTs so the backend creates a fresh job).
    if (response.status === 202) {
      const { jobId } = await response.json();
      return this.submitAndPollAIJob(
        async () => {
          const res = await fetch(`${this.apiBaseUrl}/ai/generate-art`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ prompt }),
          });
          if (res.status !== 202) {
            throw new Error('AI art generation did not return an async job');
          }
          const { jobId: id } = await res.json();
          if (!id) throw new Error('AI art generation failed: missing jobId');
          return id;
        },
        result => {
          const r = (result ?? {}) as { imageDataUrl?: string; pipeline?: string };
          if (!r.imageDataUrl) throw new Error('AI art generation returned no image');
          return { imageDataUrl: r.imageDataUrl, pipeline: r.pipeline || 'dall-e' };
        },
        jobId,
      );
    }
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `Art generation failed (${response.status})`);
    }
    return await response.json();
  }

  /**
   * Step 2: Convert generated art to a stitch pattern.
   * POST /api/ai/transpose-to-pattern
   */
  async transposeToPattern(
    imageDataUrl: string,
    gridSize?: number,
    maxColors?: number,
    prompt?: string,
  ): Promise<LineArtPatternResponse> {
    if (!this.isLiveBackend) {
      throw new Error('Backend not available. Pattern transposition requires a live backend connection.');
    }
    const body: Record<string, unknown> = { imageDataUrl };
    if (gridSize && gridSize >= 16) body.gridSize = gridSize;
    if (maxColors) body.maxColors = maxColors;
    if (prompt) body.prompt = prompt;
    const response = await fetch(`${this.apiBaseUrl}/ai/transpose-to-pattern`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `Pattern transposition failed (${response.status})`);
    }
    return await response.json();
  }

  // ==================== ASYNC AI PATTERN JOB TYPES ====================

  /**
   * Generate an embroidery pattern directly from a text prompt (single-phase).
   * POST /api/ai/embroidery/text-to-pattern
   *
   * Returns HTTP 200 (synchronous) for procedural/shape patterns,
   * or HTTP 202 (async) for AI-generated patterns that require polling.
   */
  async generatePatternFromText(
    prompt: string,
    options?: { gridSize?: number; maxColors?: number }
  ): Promise<AIPatternResponse> {
    if (!this.isLiveBackend) {
      throw new Error('Backend not available. Pattern generation requires a live backend connection.');
    }

    const response = await fetch(`${this.apiBaseUrl}/ai/embroidery/text-to-pattern`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ prompt, ...options }),
    });

    // Sync response (HTTP 200) - procedural/shape patterns
    if (response.status === 200) {
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || data.message || 'Pattern generation failed');
      }
      return data;
    }

    // Async response (HTTP 202) - AI-generated patterns need polling
    if (response.status === 202) {
      const { jobId } = await response.json();
      return this.pollPatternJob(jobId);
    }

    const errData = await response.json().catch(() => ({}));
    const err = new Error(errData.error || errData.message || `Pattern generation failed (${response.status})`) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  /**
   * Poll a pattern generation job until it completes or fails.
   * GET /api/ai/embroidery/jobs/:jobId
   */
  private async pollPatternJob(jobId: string): Promise<AIPatternResponse> {
    const MAX_POLLS = 150; // 5 minutes max at 2s intervals (premium pro model can take 2–4 min)
    const POLL_INTERVAL = 2000; // 2 seconds

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

      const response = await fetch(`${this.apiBaseUrl}/ai/embroidery/jobs/${jobId}`, {
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        throw new Error('Job not found');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const err = new Error(errData.error || `Job polling failed (${response.status})`) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      const job: AIPatternJobResponse = await response.json();

      if (job.status === 'done' && job.result) {
        return job.result;
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Pattern generation job failed');
      }

      // status is 'queued' or 'processing' — continue polling
    }

    throw new Error('Pattern generation timed out. Please try again.');
  }
  /**
   * Poll an async AI job (GET /api/ai/jobs/:id) every 2s until it finishes.
   * Throws on error/failed status or when the deadline passes.
   */
  private async pollAIJob(jobId: string, timeoutMs = 300_000): Promise<{ status: string; result: unknown; error?: string }> {
    const POLL_INTERVAL = 2000; // 2 seconds
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      const response = await fetch(`${this.apiBaseUrl}/ai/jobs/${jobId}`, {
        headers: this.getHeaders(),
      });
      if (response.status === 404) {
        throw new Error('Job not found');
      }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const err = new Error(errData.error || `Job polling failed (${response.status})`) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }
      const job = await response.json();
      if (job.status === 'done') {
        return { status: 'done', result: job.result };
      }
      if (job.status === 'error' || job.status === 'failed') {
        return { status: 'error', result: undefined, error: job.error || 'AI generation job failed' };
      }
      // status is 'pending' or 'processing' — keep polling
    }
    throw new Error('AI generation timed out. Please try again.');
  }
  /**
   * Submit an async AI job and poll it, retrying the submission once if the
   * first job errors (the backend already retries models internally, so this
   * covers transient/gateway failures on the POST itself).
   */
  private async submitAndPollAIJob<T>(
    submit: () => Promise<string>,
    normalize: (result: unknown) => T | Promise<T>,
    firstJobId?: string,
  ): Promise<T> {
    let lastError: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      // First attempt reuses the job from the initial POST; a retry re-POSTs
      // through submit() so the backend creates a fresh job.
      const jobId = attempt === 0 && firstJobId ? firstJobId : await submit();
      const job = await this.pollAIJob(jobId);
      if (job.status === 'done') {
        return await normalize(job.result);
      }
      lastError = job.error;
    }
    throw new Error(lastError || 'AI generation failed. Please try again.');
  }
  /**
   * POST text-to-collage and return the async jobId (throws on error/validation).
   * Used for the initial submit and for the one-shot retry (fresh job each time).
   */
  private async postCollageJob(prompt: string, options?: { gridSize?: number }): Promise<string> {
    const res = await fetch(`${this.apiBaseUrl}/ai/collage/text-to-collage`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ prompt, ...options }),
    });
    if (res.status === 202) {
      const { jobId } = await res.json();
      if (!jobId) throw new Error('AI collage generation failed: missing jobId');
      return jobId;
    }
    if (!res.ok) this.throwApiError('AI collage generation failed', res);
    throw new Error('AI collage generation did not return an async job');
  }
  /**
   * Unwrap a collage generation result into the client-facing shape.
   * The backend wraps the payload in { success, data: CollageGenerationResult };
   * older responses may be flat — handle both.
   */
  private normalizeCollageResult(json: unknown, prompt: string): AICollageResponse {
    const data =
      json && typeof json === 'object' && (json as { data?: unknown }).data && typeof (json as { data?: unknown }).data === 'object'
        ? (json as { data?: unknown }).data
        : json;
    const d = (data ?? {}) as { layers?: FabricLayer[]; pieces?: CollagePiece[]; referenceImage?: string; artworkUrl?: string; previewUrl?: string; canvasWidth?: number; canvasHeight?: number; processingTimeMs?: number };
    return {
      success: true,
      layers: Array.isArray(d.layers) ? d.layers : [],
      pieces: Array.isArray(d.pieces) ? d.pieces : undefined,
      // referenceImage is the exact full art the pieces were cut from (normalized
      // outlines are relative to it) — use it as the primary reference; fall back
      // to the preview/artwork URLs for older backend responses.
      referenceArt: d.referenceImage || d.artworkUrl || d.previewUrl || undefined,
      canvasWidth: d.canvasWidth ?? 500,
      canvasHeight: d.canvasHeight ?? 500,
      promptUsed: prompt,
      processingTimeMs: d.processingTimeMs ?? 0,
      totalLayers: Array.isArray(d.layers) ? d.layers.length : 0,
    };
  }

  /**
   * Generates an embroidery pattern from an uploaded image using AI.
   * POST /api/ai/embroidery/image-to-pattern
   */
  async generatePatternFromImage(
    file: File,
    gridSize?: number,
    stitchType?: string
  ): Promise<AIPatternResponse> {
    if (this.isLiveBackend) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (gridSize) formData.append('gridSize', String(gridSize));
        if (stitchType) formData.append('stitchType', stitchType);

        const response = await fetch(`${this.apiBaseUrl}/ai/embroidery/image-to-pattern`, {
          method: 'POST',
          headers: this.getHeaders({}, true),
          body: formData,
        });
        if (!response.ok) this.throwApiError('AI image-to-pattern generation failed', response);
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const size = gridSize || 16;
    const primaryStitch = stitchType || 'cross';

    const dmcPalette = [
      { code: '310', name: 'Black', hex: '#1e293b', count: 0 },
      { code: '321', name: 'Christmas Red', hex: '#e11d48', count: 0 },
      { code: '742', name: 'Tangerine', hex: '#d97706', count: 0 },
      { code: '444', name: 'Lemon', hex: '#facc15', count: 0 },
      { code: '700', name: 'Green', hex: '#16a34a', count: 0 },
      { code: '798', name: 'Delft Blue', hex: '#0284c7', count: 0 },      { code: '3865', name: 'Winter White', hex: '#fef3c7', count: 0 },      { code: '434', name: 'Brown', hex: '#78350f', count: 0 },
    ];

    const grid: string[][] = [];
    const stTypes: string[][] = [];
    const colorCounts: Record<string, number> = {};
    dmcPalette.forEach(c => colorCounts[c.hex] = 0);

    for (let r = 0; r < size; r++) {
      const row: string[] = [];
      const stRow: string[] = [];
      for (let c = 0; c < size; c++) {
        const cx = size / 2, cy = size / 2;
        const dist = Math.hypot(r - cy, c - cx) / (size / 2);
        const angle = Math.atan2(r - cy, c - cx);

        let color = '#fafaf9';
        let st = primaryStitch;

        if (dist < 0.15) {
          color = '#facc15';
          st = 'french';
        } else if (dist < 0.3) {
          const petalAngle = Math.cos(angle * 5);
          if (petalAngle > 0.3) color = '#e11d48';
          else if (petalAngle > -0.3) color = '#d97706';
          else color = '#f472b6';
          st = Math.random() > 0.6 ? 'satin' : primaryStitch;
        } else if (dist < 0.45) {
          color = Math.cos(angle * 6 + 0.5) > 0 ? '#f472b6' : '#0284c7';
        } else if (dist < 0.6) {
          if (Math.cos(angle * 4) > 0.5) { color = '#16a34a'; st = 'back'; }
        } else if (dist < 0.75) {
          if (Math.sin(angle * 3) > 0.6) { color = '#78350f'; st = 'back'; }
        } else if (dist < 0.9) {
          if (Math.random() > 0.7) color = '#7c3aed';
        }

        row.push(color);
        stRow.push(st);
        if (color !== '#fafaf9') colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
      grid.push(row);
      stTypes.push(stRow);
    }

    const total = Object.values(colorCounts).reduce((a, b) => a + b, 0);
    const activePalette = dmcPalette.map(c => ({
      ...c,
      count: colorCounts[c.hex] || 0,
    })).filter(c => c.count > 0);

    return {
      success: true,
      grid,
      stitchTypes: stTypes,
      width: size,
      height: size,
      dmcPalette: activePalette,
      totalStitches: total,
      promptUsed: `Image: ${file.name}`,
      processingTimeMs: 3500,
      fabric: { count: 14, inches: Math.round(size / 14 * 100) / 100 },
      fabricPiece: {
        patternInches: Math.round(size / 14 * 100) / 100,
        fabricInches: Math.round((size / 14 + 6) * 100) / 100,
        fabricStitches: size + Math.round(6 * 14),
        marginInches: 3,
      },
    };
  }

  // ==================== AI COLLAGE GENERATION ====================

  /**
   * Collage fabric textures and colors used in smart mock fallback
   */
  private COLLAGE_FABRIC_TEXTURES = [
    'solid', 'linen', 'polka', 'stripe', 'plaid'
  ];

  private COLLAGE_FABRIC_COLORS = [
    '#ffffff', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6',
    '#ec4899', '#db2777', '#86efac', '#fef3c7', '#bfdbfe',
    '#c4b5fd', '#fca5a5', '#d9f99d', '#fed7aa', '#e2e8f0',
  ];

  /**
   * Picks a random element from an array
   */
  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Generates a collage design from a text prompt using AI.
   * POST /api/ai/collage/text-to-collage
   */
  async generateCollageFromText(
    prompt: string,
    options?: { gridSize?: number }
  ): Promise<AICollageResponse> {
    if (this.isLiveBackend) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      try {
        const response = await fetch(`${this.apiBaseUrl}/ai/collage/text-to-collage`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ prompt, ...options }),
          signal: controller.signal,
        });
        // Async job pattern: the backend returns 202 { jobId } and runs the slow
        // gpt-image-1 generation in the background (the platform gateway cuts
        // requests at ~30s, so synchronous generation fails through the public
        // URL). Poll the job until it is done, then unwrap the result.
        if (response.status === 202) {
          const { jobId } = await response.json();
          clearTimeout(timeout); // no long-lived request on the async path
          return this.submitAndPollAIJob(
            () => this.postCollageJob(prompt, options),
            result => this.normalizeCollageResult(result, prompt),
            jobId,
          );
        }
        if (!response.ok) this.throwApiError('AI collage generation failed', response);
        const json = await response.json();
        return this.normalizeCollageResult(json, prompt);
      } catch (err) {
        clearTimeout(timeout);
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }

    const isFloral = /flower|floral|rose|blossom|garden|botanical|petal|bloom/i.test(prompt);
    const isHeart = /heart|love|romantic|valentine/i.test(prompt);
    const isGeometric = /geometric|mandala|symmetry|pattern|tile/i.test(prompt);
    const isNature = /leaf|leaves|tree|branch|vine|nature|woodland|forest/i.test(prompt);
    const isVintage = /vintage|retro|antique|shabby|rustic|lace/i.test(prompt);
    const isAbstract = /abstract|modern|contemporary|artistic/i.test(prompt);

    const layers: FabricLayer[] = [];

    // Always start with a base fabric
    const bgColor = '#ffffff'; // base fabric is always white
    layers.push({
      id: 'bg', name: 'Base Fabric', color: bgColor, pattern: 'solid',
      x: 100, y: 100, width: 400, height: 400, rotation: 0, opacity: 1, zIndex: 0,
    });

    if (isFloral) {
      // Generate floral arrangement: large bloom center, smaller petals, leaves
      layers.push({
        id: `layer-${Date.now()}-1`, name: 'Large Bloom', color: '#f9a8d4', pattern: this.pickRandom(['solid', 'polka']),
        x: 180, y: 150, width: 150, height: 150, rotation: 0, opacity: 0.9, zIndex: 1,
      });
      layers.push({
        id: `layer-${Date.now()}-2`, name: 'Inner Petal', color: '#f472b6', pattern: 'solid',
        x: 215, y: 185, width: 80, height: 80, rotation: 0, opacity: 1, zIndex: 2,
      });
      layers.push({
        id: `layer-${Date.now()}-3`, name: 'Leaf Left', color: '#86efac', pattern: 'stripe',
        x: 110, y: 220, width: 90, height: 50, rotation: -30, opacity: 0.85, zIndex: 3,
      });
      layers.push({
        id: `layer-${Date.now()}-4`, name: 'Leaf Right', color: '#86efac', pattern: 'stripe',
        x: 310, y: 210, width: 90, height: 50, rotation: 25, opacity: 0.85, zIndex: 4,
      });
      layers.push({
        id: `layer-${Date.now()}-5`, name: 'Small Bud', color: '#fbcfe8', pattern: 'solid',
        x: 260, y: 310, width: 50, height: 50, rotation: -10, opacity: 0.8, zIndex: 5,
      });
      // Extra accents for garden/botanical
      if (/garden|botanical/i.test(prompt)) {
        layers.push({
          id: `layer-${Date.now()}-6`, name: 'Stem Detail', color: '#22c55e', pattern: 'linen',
          x: 230, y: 320, width: 30, height: 80, rotation: 5, opacity: 0.7, zIndex: 6,
        });
        layers.push({
          id: `layer-${Date.now()}-7`, name: 'Extra Bloom', color: '#d8b4fe', pattern: 'polka',
          x: 130, y: 300, width: 60, height: 60, rotation: 15, opacity: 0.75, zIndex: 7,
        });
      }
    } else if (isHeart) {
      // Heart-shaped arrangement
      layers.push({
        id: `layer-${Date.now()}-1`, name: 'Heart Left', color: '#f472b6', pattern: 'solid',
        x: 160, y: 180, width: 120, height: 150, rotation: -20, opacity: 0.9, zIndex: 1,
      });
      layers.push({
        id: `layer-${Date.now()}-2`, name: 'Heart Right', color: '#f472b6', pattern: 'solid',
        x: 260, y: 180, width: 120, height: 150, rotation: 20, opacity: 0.9, zIndex: 2,
      });
      layers.push({
        id: `layer-${Date.now()}-3`, name: 'Heart Center', color: '#ec4899', pattern: 'polka',
        x: 210, y: 230, width: 100, height: 80, rotation: 0, opacity: 1, zIndex: 3,
      });
      layers.push({
        id: `layer-${Date.now()}-4`, name: 'Love Accent', color: '#fbcfe8', pattern: 'solid',
        x: 230, y: 310, width: 60, height: 40, rotation: 0, opacity: 0.8, zIndex: 4,
      });
    } else if (isGeometric) {
      // Geometric mandala-like pattern
      layers.push({
        id: `layer-${Date.now()}-1`, name: 'Outer Ring', color: '#c4b5fd', pattern: 'solid',
        x: 120, y: 120, width: 280, height: 280, rotation: 0, opacity: 0.6, zIndex: 1,
      });
      layers.push({
        id: `layer-${Date.now()}-2`, name: 'Ring Band', color: '#a78bfa', pattern: 'plaid',
        x: 150, y: 150, width: 220, height: 220, rotation: 15, opacity: 0.7, zIndex: 2,
      });
      layers.push({
        id: `layer-${Date.now()}-3`, name: 'Inner Square', color: '#8b5cf6', pattern: 'stripe',
        x: 190, y: 190, width: 140, height: 140, rotation: 45, opacity: 0.8, zIndex: 3,
      });
      layers.push({
        id: `layer-${Date.now()}-4`, name: 'Center Diamond', color: '#f472b6', pattern: 'solid',
        x: 250, y: 250, width: 70, height: 70, rotation: 0, opacity: 0.9, zIndex: 4,
      });
      layers.push({
        id: `layer-${Date.now()}-5`, name: 'Center Dot', color: '#fbcfe8', pattern: 'polka',
        x: 275, y: 275, width: 30, height: 30, rotation: 0, opacity: 1, zIndex: 5,
      });
    } else if (isNature) {
      // Leafy/nature arrangement
      layers.push({
        id: `layer-${Date.now()}-1`, name: 'Large Leaf', color: '#86efac', pattern: 'linen',
        x: 150, y: 200, width: 160, height: 90, rotation: -15, opacity: 0.85, zIndex: 1,
      });
      layers.push({
        id: `layer-${Date.now()}-2`, name: 'Medium Leaf', color: '#4ade80', pattern: 'stripe',
        x: 220, y: 150, width: 120, height: 70, rotation: 20, opacity: 0.8, zIndex: 2,
      });
      layers.push({
        id: `layer-${Date.now()}-3`, name: 'Vine Curve', color: '#22c55e', pattern: 'solid',
        x: 260, y: 250, width: 80, height: 140, rotation: 10, opacity: 0.75, zIndex: 3,
      });
      layers.push({
        id: `layer-${Date.now()}-4`, name: 'Berry Cluster', color: '#fca5a5', pattern: 'polka',
        x: 180, y: 290, width: 50, height: 40, rotation: 0, opacity: 0.9, zIndex: 4,
      });
      layers.push({
        id: `layer-${Date.now()}-5`, name: 'Small Fern', color: '#86efac', pattern: 'linen',
        x: 110, y: 170, width: 70, height: 80, rotation: -40, opacity: 0.7, zIndex: 5,
      });
    } else if (isVintage) {
      // Vintage shabby chic
      layers.push({
        id: `layer-${Date.now()}-1`, name: 'Lace Border L', color: '#fef3c7', pattern: 'linen',
        x: 80, y: 80, width: 180, height: 340, rotation: 0, opacity: 0.6, zIndex: 1,
      });
      layers.push({
        id: `layer-${Date.now()}-2`, name: 'Lace Border R', color: '#fef3c7', pattern: 'linen',
        x: 260, y: 80, width: 180, height: 340, rotation: 0, opacity: 0.6, zIndex: 2,
      });
      layers.push({
        id: `layer-${Date.now()}-3`, name: 'Rose Motif', color: '#f9a8d4', pattern: 'polka',
        x: 200, y: 180, width: 110, height: 110, rotation: 0, opacity: 0.85, zIndex: 3,
      });
      layers.push({
        id: `layer-${Date.now()}-4`, name: 'Center Rose', color: '#f472b6', pattern: 'solid',
        x: 230, y: 210, width: 60, height: 60, rotation: 10, opacity: 0.9, zIndex: 4,
      });
    } else if (isAbstract) {
      // Abstract/modern art
      layers.push({
        id: `layer-${Date.now()}-1`, name: 'Splash 1', color: '#c4b5fd', pattern: 'solid',
        x: 120, y: 100, width: 180, height: 140, rotation: 25, opacity: 0.7, zIndex: 1,
      });
      layers.push({
        id: `layer-${Date.now()}-2`, name: 'Splash 2', color: '#fca5a5', pattern: 'stripe',
        x: 240, y: 200, width: 150, height: 120, rotation: -15, opacity: 0.65, zIndex: 2,
      });
      layers.push({
        id: `layer-${Date.now()}-3`, name: 'Accent Block', color: '#d9f99d', pattern: 'solid',
        x: 160, y: 260, width: 100, height: 100, rotation: 45, opacity: 0.75, zIndex: 3,
      });
      layers.push({
        id: `layer-${Date.now()}-4`, name: 'Highlight', color: '#fde68a', pattern: 'polka',
        x: 300, y: 120, width: 60, height: 60, rotation: 0, opacity: 0.85, zIndex: 4,
      });
    } else {
      // Default: mixed floral arrangement
      layers.push({
        id: `layer-${Date.now()}-1`, name: 'Main Pattern', color: '#f9a8d4', pattern: 'solid',
        x: 170, y: 170, width: 160, height: 140, rotation: 0, opacity: 0.9, zIndex: 1,
      });
      layers.push({
        id: `layer-${Date.now()}-2`, name: 'Accent', color: '#fbcfe8', pattern: 'polka',
        x: 210, y: 210, width: 80, height: 80, rotation: 15, opacity: 0.85, zIndex: 2,
      });
      layers.push({
        id: `layer-${Date.now()}-3`, name: 'Detail', color: '#d8b4fe', pattern: 'stripe',
        x: 150, y: 290, width: 90, height: 50, rotation: -10, opacity: 0.75, zIndex: 3,
      });
      layers.push({
        id: `layer-${Date.now()}-4`, name: 'Bottom Accent', color: '#86efac', pattern: 'linen',
        x: 280, y: 290, width: 70, height: 50, rotation: 5, opacity: 0.7, zIndex: 4,
      });
    }

    return {
      success: true,
      layers,
      canvasWidth: 500,
      canvasHeight: 500,
      promptUsed: prompt,
      processingTimeMs: 3000,
      totalLayers: layers.length,
    };
  }

  /**
   * Generates a collage design from an uploaded image using AI.
   * POST /api/ai/collage/image-to-collage
   */
  async generateCollageFromImage(
    file: File,
    options?: { complexity?: 'simple' | 'moderate' | 'complex' }
  ): Promise<AICollageResponse> {
    if (this.isLiveBackend) {
      // Guard: the UI must never look hung — abort if nothing settles within 90s.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (options?.complexity) formData.append('complexity', options.complexity);

        const response = await fetch(`${this.apiBaseUrl}/ai/collage/image-to-collage`, {
          method: 'POST',
          headers: this.getHeaders({}, true),
          body: formData,
          signal: controller.signal,
        });
        if (!response.ok) this.throwApiError('AI image-to-collage generation failed', response);
        return await response.json();
      } catch (err) {
        clearTimeout(timeout);
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }

    const complexity = options?.complexity || 'moderate';
    const numLayers = complexity === 'simple' ? 4 : complexity === 'complex' ? 8 : 6;

    const layers: FabricLayer[] = [];

    // Base fabric
    layers.push({
      id: 'bg', name: 'Base Fabric', color: '#ffffff', pattern: 'solid',
      x: 100, y: 100, width: 400, height: 400, rotation: 0, opacity: 1, zIndex: 0,
    });

    // Generate radial/sunburst layout
    const centerX = 250, centerY = 250;
    for (let i = 0; i < numLayers; i++) {
      const angle = (i / numLayers) * Math.PI * 2;
      const radius = 40 + (i * 25);
      const xOff = Math.cos(angle) * radius;
      const yOff = Math.sin(angle) * radius;

      const colorIdx = (i * 3) % this.COLLAGE_FABRIC_COLORS.length;
      const textureIdx = (i * 2) % this.COLLAGE_FABRIC_TEXTURES.length;

      const layerSize = 40 + Math.floor(Math.random() * 50);

      layers.push({
        id: `layer-img-${i + 1}`,
        name: `Patch ${i + 1}`,
        color: this.COLLAGE_FABRIC_COLORS[colorIdx],
        pattern: this.COLLAGE_FABRIC_TEXTURES[textureIdx],
        x: centerX + xOff - layerSize / 2,
        y: centerY + yOff - layerSize / 2,
        width: layerSize,
        height: layerSize + (i % 2 === 0 ? 20 : 0),
        rotation: Math.round(angle * (180 / Math.PI) * 0.3),
        opacity: 0.75 + (Math.random() * 0.2),
        zIndex: i + 1,
      });
    }

    // Center focal point
    layers.push({
      id: `layer-img-center`,
      name: 'Center Focal',
      color: '#f472b6',
      pattern: 'solid',
      x: centerX - 25,
      y: centerY - 25,
      width: 50,
      height: 50,
      rotation: 0,
      opacity: 1,
      zIndex: numLayers + 1,
    });

    return {
      success: true,
      layers,
      canvasWidth: 500,
      canvasHeight: 500,
      promptUsed: `Image: ${file.name}`,
      processingTimeMs: 3500,
      totalLayers: layers.length,
    };
  }

  // ==================== MARKETPLACE API ====================

  /**
   * Fetches all published marketplace listings (GET /api/marketplace).
   */
  async getMarketplaceListings(): Promise<MarketplaceListing[]> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/marketplace`, {
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch marketplace listings');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const stored = localStorage.getItem('stitchwise_marketplace');
    if (stored) return JSON.parse(stored);
    const mockListings: MarketplaceListing[] = [
      { id: 'mkt-1', title: 'Spring Floral Wreath', description: 'Beautiful spring floral wreath pattern perfect for beginners.', price: 8.99, category: 'Floral', tags: ['Floral', 'Wreath', 'Beginner'], designerName: 'Elena Crafter', designerId: 'des-1', rating: 4.9, salesCount: 342, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-06-20T00:00:00Z', isPublished: true },
      { id: 'mkt-2', title: 'Vintage Rose Border', description: 'Elegant vintage rose border design for intermediate crafters.', price: 12.50, category: 'Vintage', tags: ['Vintage', 'Border', 'Intermediate'], designerName: 'StitchMaster Pro', designerId: 'des-2', rating: 4.8, salesCount: 187, createdAt: '2026-05-10T00:00:00Z', updatedAt: '2026-06-22T00:00:00Z', isPublished: true },
      { id: 'mkt-3', title: 'Botanical Sampler', description: 'Detailed botanical garden sampler with multiple stitch types.', price: 14.99, category: 'Botanical', tags: ['Botanical', 'Sampler', 'Advanced'], designerName: 'Dave Digitizer', designerId: 'des-3', rating: 4.7, salesCount: 93, createdAt: '2026-05-15T00:00:00Z', updatedAt: '2026-06-18T00:00:00Z', isPublished: true },
    ];
    localStorage.setItem('stitchwise_marketplace', JSON.stringify(mockListings));
    return mockListings;
  }

  /**
   * Fetches the current designer's own listings (GET /api/designer/listings).
   */
  async getMyListings(): Promise<MarketplaceListing[]> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/designer/listings`, {
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch designer listings');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const allListings = await this.getMarketplaceListings();
    return allListings.filter(l => l.designerId === 'des-1');
  }

  /**
   * Creates a new marketplace listing (POST /api/designer/listings).
   */
  async createListing(data: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/designer/listings`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create listing');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const stored = localStorage.getItem('stitchwise_marketplace');
    const listings: MarketplaceListing[] = stored ? JSON.parse(stored) : [];
    const newListing: MarketplaceListing = {
      id: `mkt-${Date.now()}`,
      title: data.title || 'Untitled Pattern',
      description: data.description || '',
      price: data.price || 0,
      category: data.category || 'Other',
      tags: data.tags || [],
      designerName: 'You',
      designerId: 'des-1',
      rating: 0,
      salesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublished: data.isPublished ?? false,
    };
    listings.unshift(newListing);
    localStorage.setItem('stitchwise_marketplace', JSON.stringify(listings));
    return newListing;
  }

  /**
   * Updates an existing marketplace listing (PUT /api/designer/listings/:id).
   */
  async updateListing(id: string, data: Partial<MarketplaceListing>): Promise<MarketplaceListing | null> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/designer/listings/${id}`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update listing');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const stored = localStorage.getItem('stitchwise_marketplace');
    if (!stored) return null;
    const listings: MarketplaceListing[] = JSON.parse(stored);
    const idx = listings.findIndex(l => l.id === id);
    if (idx === -1) return null;
    listings[idx] = { ...listings[idx], ...data, updatedAt: new Date().toISOString() };
    localStorage.setItem('stitchwise_marketplace', JSON.stringify(listings));
    return listings[idx];
  }

  /**
   * Deletes a marketplace listing (DELETE /api/designer/listings/:id).
   */
  async deleteListing(id: string): Promise<boolean> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/designer/listings/${id}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        return response.ok;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const stored = localStorage.getItem('stitchwise_marketplace');
    if (!stored) return false;
    const listings: MarketplaceListing[] = JSON.parse(stored);
    const filtered = listings.filter(l => l.id !== id);
    localStorage.setItem('stitchwise_marketplace', JSON.stringify(filtered));
    return true;
  }

  // ==================== COMMUNITY SHOWCASE API ====================

  /** Mock initial showcase entries */
  private INITIAL_SHOWCASE: ShowcaseEntry[] = [
    {
      id: 'show-1',
      userId: 'usr-928174',
      userName: 'Elena Crafter',
      userAvatar: '🌸',
      title: 'Spring Blossom Wreath',
      description: 'A delicate wreath of cherry blossoms and wildflowers I designed for my grandmother\'s birthday.',
      tips: 'Use a lighter stabilizer for delicate fabrics to avoid puckering.',
      imageUrl: 'https://images.unsplash.com/photo-1603969072881-b0fc7f3d77d7?w=600&q=80',
      projectType: 'embroidery',
      metadata: { stitchCount: 1800, threadColors: ['#f9a8d4', '#f472b6', '#86efac'], fabricType: 'Cotton', patternSource: 'AI Generated', timeSpent: '4 hours' },
      likes: 24,
      createdAt: '2026-06-28T10:00:00Z',
    },
    {
      id: 'show-2',
      userId: 'usr-2',
      userName: 'StitchMaster Pro',
      userAvatar: '👑',
      title: 'Vintage Rose Collage Quilt',
      description: 'A romantic collage quilt featuring layered vintage rose fabric scraps.',
      tips: 'Press each seam open before adding the next layer for a flat finish.',
      imageUrl: 'https://images.unsplash.com/photo-1612887168953-0e7e8d7f5f5b?w=600&q=80',
      projectType: 'collage',
      metadata: { stitchCount: 4500, threadColors: ['#db2777', '#be185d', '#fbcfe8'], fabricType: 'Cotton Blend', patternSource: 'Manual', timeSpent: '12 hours' },
      likes: 47,
      createdAt: '2026-06-27T14:30:00Z',
    },
    {
      id: 'show-3',
      userId: 'usr-3',
      userName: 'Dave Digitizer',
      userAvatar: '🐕',
      title: 'Garden Butterfly Block',
      description: 'A monarch butterfly quilt block using raw-edge appliqué technique.',
      tips: 'Fuse the butterfly wings with lightweight interfacing before stitching.',
      imageUrl: 'https://images.unsplash.com/photo-1596460107916-430662021049?w=600&q=80',
      projectType: 'quilt-block',
      metadata: { stitchCount: 2800, threadColors: ['#f97316', '#f59e0b', '#a3e635'], fabricType: 'Quilting Cotton', patternSource: 'Uploaded', timeSpent: '6 hours' },
      likes: 31,
      createdAt: '2026-06-26T09:15:00Z',
    },
    {
      id: 'show-4',
      userId: 'usr-4',
      userName: 'Sofia R.',
      userAvatar: '🦉',
      title: 'Peony Love Heart Pillow',
      description: 'A heart-shaped peony embroidery on a throw pillow cover. Perfect gift for Valentine\'s!',
      tips: 'Use a hoop large enough to hold the entire design without repositioning.',
      imageUrl: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80',
      projectType: 'embroidery',
      metadata: { stitchCount: 1200, threadColors: ['#ec4899', '#f472b6', '#fbcfe8'], fabricType: 'Linen', patternSource: 'AI Generated', timeSpent: '3 hours' },
      likes: 18,
      createdAt: '2026-06-25T16:45:00Z',
    },
    {
      id: 'show-5',
      userId: 'usr-5',
      userName: 'Crafty Mom',
      userAvatar: '🧵',
      title: 'Lavender Fields Table Runner',
      description: 'A lavender-themed collage quilting table runner for summer entertaining.',
      tips: 'Use a walking foot to prevent fabric shifting when sewing through multiple collage layers.',
      imageUrl: 'https://images.unsplash.com/photo-1584999734482-0361aecad844?w=600&q=80',
      projectType: 'collage',
      metadata: { stitchCount: 3200, threadColors: ['#a855f7', '#d8b4fe', '#e9d5ff'], fabricType: 'Cotton', patternSource: 'Manual', timeSpent: '8 hours' },
      likes: 12,
      createdAt: '2026-06-24T11:20:00Z',
    },
    {
      id: 'show-6',
      userId: 'usr-6',
      userName: 'QuiltMaster Jen',
      userAvatar: '🧶',
      title: 'Floral Monogram Wall Hanging',
      description: 'Customizable monogram quilt block surrounded by intricate floral appliqué.',
      tips: 'Starch your fabric before cutting for crisp, accurate shapes.',
      imageUrl: 'https://images.unsplash.com/photo-1567103472660-0f2c7b3eaf8a?w=600&q=80',
      projectType: 'quilt-block',
      metadata: { stitchCount: 5200, threadColors: ['#db2777', '#f472b6', '#fef3c7'], fabricType: 'Cotton', patternSource: 'AI Generated', timeSpent: '15 hours' },
      likes: 53,
      createdAt: '2026-06-23T08:00:00Z',
    },
  ];

  /**
   * Fetches all community showcase entries (GET /api/showcase/gallery).
   */
  async getShowcaseEntries(): Promise<ShowcaseEntry[]> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/showcase/gallery`, {
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch showcase entries');
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const stored = localStorage.getItem('stitchwise_showcase');
    if (stored) return JSON.parse(stored);
    localStorage.setItem('stitchwise_showcase', JSON.stringify(this.INITIAL_SHOWCASE));
    return this.INITIAL_SHOWCASE;
  }

  /**
   * Fetches a single showcase entry by ID (GET /api/showcase/:id).
   */
  async getShowcaseEntry(id: string): Promise<ShowcaseEntry | null> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/showcase/${id}`, {
          headers: this.getHeaders()
        });
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Failed to fetch showcase entry');
        }
        return await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Request failed');
      }
    }
    const entries = await this.getShowcaseEntries();
    return entries.find(e => e.id === id) || null;
  }

  /**
   * Uploads a new showcase entry (POST /api/showcase/upload).
   * Handles tier gating: Hobbyist limited to 3 uploads/month.
   */
  async uploadShowcaseEntry(data: {
    title: string;
    description?: string;
    tips?: string;
    projectType: 'embroidery' | 'collage' | 'quilt-block';
    metadata?: {
      stitchCount?: number;
      threadColors?: string[];
      fabricType?: string;
      patternSource?: string;
      timeSpent?: string;
    };
  }): Promise<{ success: boolean; entry?: ShowcaseEntry; error?: string }> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/showcase/upload`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(data)
        });
        if (response.status === 403) {
          const errData = await response.json().catch(() => ({}));
          return { success: false, error: errData.error || 'Upload limit reached for your plan' };
        }
        if (!response.ok) throw new Error('Failed to upload showcase entry');
        const entry = await response.json();
        return { success: true, entry };
      } catch (err: any) {
        console.error('Failed to upload showcase entry on backend', err);
        return { success: false, error: err.message || 'Upload failed' };
      }
    }

    // Mock/localStorage Implementation

    // Check tier gating for Hobbyist (max 3/month)
    const user = await this.getUserProfile();
    const isHobbyist = user.subscriptionTier === 'Hobbyist';
    if (isHobbyist) {
      const entries = await this.getShowcaseEntries();
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const userEntriesThisMonth = entries.filter(e => {
        const d = new Date(e.createdAt);
        return e.userId === user.id && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
      if (userEntriesThisMonth.length >= 3) {
        return { success: false, error: 'Hobbyist plan limited to 3 uploads per month. Upgrade to Pro for unlimited uploads!' };
      }
    }

    const entries = await this.getShowcaseEntries();
    const newEntry: ShowcaseEntry = {
      id: `show-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl || '🧵',
      title: data.title,
      description: data.description || '',
      tips: data.tips || '',
      imageUrl: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 900) + 100}?w=600&q=80`,
      projectType: data.projectType,
      metadata: {
        stitchCount: data.metadata?.stitchCount,
        threadColors: data.metadata?.threadColors,
        fabricType: data.metadata?.fabricType,
        patternSource: data.metadata?.patternSource,
        timeSpent: data.metadata?.timeSpent,
      },
      likes: 0,
      createdAt: new Date().toISOString(),
    };

    entries.unshift(newEntry);
    localStorage.setItem('stitchwise_showcase', JSON.stringify(entries));
    return { success: true, entry: newEntry };
  }

  /**
   * Deletes a showcase entry (DELETE /api/showcase/:id).
   * Only the owner can delete their own entry.
   */
  async deleteShowcaseEntry(id: string): Promise<{ success: boolean; error?: string }> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/showcase/${id}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        if (response.status === 403) return { success: false, error: 'You can only delete your own entries' };
        if (response.status === 404) return { success: false, error: 'Entry not found' };
        if (!response.ok) throw new Error('Failed to delete entry');
        return { success: true };
      } catch (err: any) {
        console.error(`Failed to delete showcase entry ${id} on backend`, err);
        return { success: false, error: err.message || 'Delete failed' };
      }
    }
    const entries = await this.getShowcaseEntries();
    const entry = entries.find(e => e.id === id);
    if (!entry) return { success: false, error: 'Entry not found' };

    const user = await this.getUserProfile();
    if (entry.userId !== user.id) return { success: false, error: 'You can only delete your own entries' };

    const filtered = entries.filter(e => e.id !== id);
    localStorage.setItem('stitchwise_showcase', JSON.stringify(filtered));
    return { success: true };
  }

  // ==================== UPLOAD IMAGE TO PATTERN (Generate Module) ====================

  /**
   * Uploads an image and converts it to a stitch pattern at the specified grid size.
   * POST /api/ai/embroidery/image-to-pattern
   * Grid sizes: 50, 75, 100, 150, 200
   * Returns the stitch grid + the original image data for side-by-side preview.
   */
  async uploadImageToPattern(
    file: File,
    gridSize: number
  ): Promise<AIPatternResponse & { originalImageData?: string }> {
    if (this.isLiveBackend) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gridSize', String(gridSize));

      const response = await fetch(`${this.apiBaseUrl}/ai/embroidery/image-to-pattern`, {
        method: 'POST',
        headers: this.getHeaders({}, true),
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `Backend returned ${response.status}`);
      }
      return await response.json();
    }
    const size = gridSize;
    const dmcPalette = [
      { code: '310', name: 'Black', hex: '#1e293b', count: 0 },
      { code: '321', name: 'Christmas Red', hex: '#e11d48', count: 0 },
      { code: '743', name: 'Yellow', hex: '#f59e0b', count: 0 },
      { code: '700', name: 'Green', hex: '#16a34a', count: 0 },
      { code: '798', name: 'Delft Blue', hex: '#0284c7', count: 0 },      { code: '3865', name: 'Winter White', hex: '#fef3c7', count: 0 },    ];
    const colorCounts: Record<string, number> = {};
    dmcPalette.forEach(c => colorCounts[c.hex] = 0);

    const grid: string[][] = [];
    const stitchTypes: string[][] = [];
    const cx = size / 2, cy = size / 2;

    for (let r = 0; r < size; r++) {
      const row: string[] = [];
      const stRow: string[] = [];
      for (let c = 0; c < size; c++) {
        const dist = Math.hypot(r - cy, c - cx) / (size / 2);
        const angle = Math.atan2(r - cy, c - cx);
        let color = '#fafaf9';
        let st = 'cross';

        if (dist < 0.15) {
          color = '#f59e0b'; st = 'french';
        } else if (dist < 0.3) {
          const petal = Math.cos(angle * 5);
          color = petal > 0.3 ? '#e11d48' : petal > -0.3 ? '#f472b6' : '#f59e0b';
          st = Math.random() > 0.6 ? 'satin' : 'cross';
        } else if (dist < 0.45) {
          color = Math.cos(angle * 6) > 0 ? '#f472b6' : '#0284c7';
        } else if (dist < 0.6) {
          if (Math.cos(angle * 4) > 0.5) { color = '#16a34a'; st = 'back'; }
        } else if (dist < 0.75) {
          if (Math.sin(angle * 3) > 0.6) { color = '#7c3aed'; st = 'back'; }
        } else if (dist < 0.9) {
          if (Math.random() > 0.7) color = '#7c3aed';
        }

        row.push(color);
        stRow.push(st);
        if (color !== '#fafaf9') colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
      grid.push(row);
      stitchTypes.push(stRow);
    }

    const total = Object.values(colorCounts).reduce((a, b) => a + b, 0);
    const activePalette = dmcPalette.map(c => ({
      ...c,
      count: colorCounts[c.hex] || 0,
    })).filter(c => c.count > 0);

    return {
      success: true,
      grid,
      stitchTypes,
      width: size,
      height: size,
      dmcPalette: activePalette,
      totalStitches: total,
      processingTimeMs: 2000,
      originalImageData: '',
      fabric: { count: 14, inches: Math.round(size / 14 * 100) / 100 },
      fabricPiece: {
        patternInches: Math.round(size / 14 * 100) / 100,
        fabricInches: Math.round((size / 14 + 6) * 100) / 100,
        fabricStitches: size + Math.round(6 * 14),
        marginInches: 3,
      },
    };
  }

  // ==================== COLLAGE PERSISTENCE ====================
  private collageStore: CollageProject[] = [];

  async saveCollage(name: string, layers: FabricLayer[], pieces?: PlacedCollagePiece[], referenceArt?: string): Promise<CollageProject> {
    const id = `collage-${Date.now()}`;
    const now = new Date().toISOString();
    const project: CollageProject = { id, name, layers, pieces, referenceArt, createdAt: now, updatedAt: now };
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/collage`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ name, layers, pieces, referenceArt }),
        });
        if (res.ok) return await res.json();
      } catch { /* fall through to mock */ }
    }
    this.collageStore.push(project);
    return project;
  }

  async listCollageProjects(): Promise<CollageProject[]> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/collage`, { headers: this.getHeaders() });
        if (res.ok) return (await res.json()).projects;
      } catch { /* fall through to mock */ }
    }
    return [...this.collageStore];
  }

  async loadCollageProject(id: string): Promise<CollageProject | null> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/collage/${id}`, { headers: this.getHeaders() });
        if (res.ok) return (await res.json()).project;
      } catch { /* fall through to mock */ }
    }
    return this.collageStore.find(p => p.id === id) || null;
  }

  async deleteCollageProject(id: string): Promise<void> {
    if (this.isLiveBackend) {
      try {
        await fetch(`${this.apiBaseUrl}/collage/${id}`, { method: 'DELETE', headers: this.getHeaders() });
      } catch { /* fall through to mock */ }
    }
    this.collageStore = this.collageStore.filter(p => p.id !== id);
  }

  // ==================== QUILT BLOCK PERSISTENCE ====================
  private quiltBlockStore: QuiltBlockDesign[] = [];

  async saveQuiltBlock(name: string, shapes: QuiltBlockShape[], blockSize: number): Promise<QuiltBlockDesign> {
    const id = `block-${Date.now()}`;
    const now = new Date().toISOString();
    const block: QuiltBlockDesign = { id, name, shapes, blockSize, createdAt: now, updatedAt: now };
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/quilt-blocks`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ name, shapes, blockSize }),
        });
        if (res.ok) return await res.json();
      } catch { /* fall through to mock */ }
    }
    this.quiltBlockStore.push(block);
    return block;
  }

  async listQuiltBlocks(): Promise<QuiltBlockDesign[]> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/quilt-blocks`, { headers: this.getHeaders() });
        if (res.ok) return (await res.json()).blocks;
      } catch { /* fall through to mock */ }
    }
    return [...this.quiltBlockStore];
  }

  async loadQuiltBlock(id: string): Promise<QuiltBlockDesign | null> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/quilt-blocks/${id}`, { headers: this.getHeaders() });
        if (res.ok) return (await res.json()).block;
      } catch { /* fall through to mock */ }
    }
    return this.quiltBlockStore.find(b => b.id === id) || null;
  }

  async deleteQuiltBlock(id: string): Promise<void> {
    if (this.isLiveBackend) {
      try {
        await fetch(`${this.apiBaseUrl}/quilt-blocks/${id}`, { method: 'DELETE', headers: this.getHeaders() });
      } catch { /* fall through to mock */ }
    }
    this.quiltBlockStore = this.quiltBlockStore.filter(b => b.id !== id);
  }
  // ==================== PATTERN PERSISTENCE ====================
  private patternStore: SavedPatternDetail[] = [];
  async savePattern(
    name: string,
    grid: SavedPatternCell[][],
    palette: { code: string; name: string; hex: string; count: number }[],
    gridSize: number,
    stitchCount: number,
  ): Promise<SavedPatternSummary> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/patterns`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ name, grid, palette, gridSize, stitchCount }),
        });
        if (res.ok) return await res.json();
      } catch { /* fall through to mock */ }
    }
    const now = new Date().toISOString();
    const rec: SavedPatternDetail = {
      id: `pattern-${Date.now()}`,
      name,
      gridSize,
      stitchCount,
      createdAt: now,
      updatedAt: now,
      grid,
      palette,
    };
    this.patternStore.unshift(rec);
    return rec;
  }
  async listPatterns(): Promise<SavedPatternSummary[]> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/patterns`, { headers: this.getHeaders() });
        if (res.ok) return (await res.json()).patterns;
      } catch { /* fall through to mock */ }
    }
    return this.patternStore.map(({ grid: _g, palette: _p, ...summary }) => summary);
  }
  async loadPattern(id: string): Promise<SavedPatternDetail | null> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/patterns/${id}`, { headers: this.getHeaders() });
        if (res.ok) return await res.json();
      } catch { /* fall through to mock */ }
    }
    return this.patternStore.find(p => p.id === id) || null;
  }
  async deletePattern(id: string): Promise<void> {
    if (this.isLiveBackend) {
      try {
        await fetch(`${this.apiBaseUrl}/patterns/${id}`, { method: 'DELETE', headers: this.getHeaders() });
      } catch { /* fall through to mock */ }
    }
    this.patternStore = this.patternStore.filter(p => p.id !== id);
  }
}

export const api = new ApiClient();

// ==================== AI COLLAGE GENERATION TYPES ====================

/** A single fabric layer in a collage design */
export interface FabricLayer {
  id: string;
  name: string;
  color: string;
  pattern: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
}

/** A scrapbook piece — a cutout of the actual art image (transparent outside the outline). */
export interface CollagePiece {
  id: string;
  label: string;
  /** Normalized outline points (0..1 relative to the piece bounds), e.g. [[0.1,0.1],[0.9,0.1],...] */
  outline: [number, number][];
  /** Bounding box of the piece within the reference art, normalized (0..1) */
  bounds: { x: number; y: number; width: number; height: number };
  /** Representative fabric/art color */
  color: string;
  /** data-URL PNG with transparency — the art clipped to the piece shape */
  image: string;
}

/** A piece instance placed on the scrapbook canvas. */
export interface PlacedCollagePiece {
  instanceId: string;
  pieceId: string;
  /** Copy of the source piece so saved projects round-trip standalone */
  piece: CollagePiece;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

/** Response from AI collage generation */
export interface AICollageResponse {
  success: boolean;
  layers: FabricLayer[];
  canvasWidth: number;
  canvasHeight: number;
  promptUsed?: string;
  processingTimeMs: number;
  totalLayers: number;
  /** Scrapbook pieces (cutouts of the actual art image) — present when the backend segmentation pipeline emits them */
  pieces?: CollagePiece[];
  /** Reference art image (data-URL or URL) the pieces were cut from */
  referenceArt?: string;
}

// ── Collage Persistence ──────────────────────────────
export interface CollageProject {
  id: string;
  name: string;
  layers: FabricLayer[];
  pieces?: PlacedCollagePiece[];
  referenceArt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Quilt Block Persistence ──────────────────────────
export interface QuiltBlockShape {
  id: string;
  type: string;
  color: string;
  pattern: string;
  /** Free-position canvas model (owner redesign): top-left in canvas px. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  zIndex: number;
  /** Legacy grid fields — kept so pre-redesign saves can be migrated on load. */
  gridX?: number;
  gridY?: number;
  size?: number;
}

export interface QuiltBlockDesign {
  id: string;
  name: string;
  shapes: QuiltBlockShape[];
  blockSize: number;
  createdAt: string;
  updatedAt: string;
}
export interface SavedPatternCell {
  color: string;
  dmcCode?: string;
  dmcName?: string;
}
export interface SavedPatternSummary {
  id: string;
  name: string;
  gridSize: number;
  stitchCount: number;
  previewUrl?: string | null;
  prompt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SavedPatternDetail extends SavedPatternSummary {
  grid: SavedPatternCell[][];
  palette: { code: string; name: string; hex: string; count: number }[];
}
