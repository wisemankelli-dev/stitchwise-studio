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
  public isLiveBackend: boolean = false; // Toggle to true when backend is ready
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
    await delay(800);
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
    await delay(1000);
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
        const response = await fetch(`${this.apiBaseUrl}/projects`, {
          headers: this.getHeaders()
        });
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
        console.error(`Failed to fetch project ${id} from backend, using fallback`, err);
      }
    }

    await delay(400);
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
        console.error(`Failed to update project ${id} on backend, using fallback`, err);
      }
    }

    await delay(600);
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
        console.error(`Failed to create share link for ${projectId} on backend, using fallback`, err);
      }
    }

    await delay(500);
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
        console.error(`Failed to invite collaborator on backend for project ${projectId}`, err);
      }
    }

    await delay(600);
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
        console.error('Failed to fetch user from backend, using local fallback', err);
      }
    }

    // Mock/localStorage Implementation
    await delay(400);
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
        console.error('Failed to update subscription on backend', err);
      }
    }

    await delay(800);
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
        console.error('Failed to fetch tier from backend, using local fallback', err);
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
    await delay(1200);
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
    await delay(1000);
    const redirectUrl = `${window.location.origin}/pricing?portal-success=true`;
    return {
      success: true,
      url: redirectUrl
    };
  }

  // ==================== AI EMBROIDERY PATTERN GENERATION ====================

  /**
   * Generates an embroidery pattern from a text prompt using AI.
   * POST /api/ai/embroidery/text-to-pattern
   */
  async generatePatternFromText(
    prompt: string,
    gridSize?: number
  ): Promise<AIPatternResponse> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/ai/embroidery/text-to-pattern`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ prompt, gridSize: gridSize || 16 })
        });
        if (!response.ok) throw new Error('AI pattern generation failed');
        return await response.json();
      } catch (err) {
        console.error('AI text-to-pattern backend error, using mock', err);
      }
    }

    // Mock Implementation
    await delay(3000);
    const size = gridSize || 32;
    const dmcPalette = [
      { code: '310', name: 'Black', hex: '#1e293b', count: 0 },
      { code: '321', name: 'Christmas Red', hex: '#e11d48', count: 0 },
      { code: '743', name: 'Yellow', hex: '#f59e0b', count: 0 },
      { code: '700', name: 'Green', hex: '#16a34a', count: 0 },
      { code: '798', name: 'Delft Blue', hex: '#0284c7', count: 0 },
      { code: '554', name: 'Violet', hex: '#7c3aed', count: 0 },
      { code: '3865', name: 'Winter White', hex: '#fef3c7', count: 0 },
      { code: '961', name: 'Dusty Rose', hex: '#f472b6', count: 0 },
    ];

    const grid: string[][] = [];
    const stitchTypes: string[][] = [];
    const colorCounts: Record<string, number> = {};
    dmcPalette.forEach(c => colorCounts[c.hex] = 0);

    const isFloral = /flower|floral|rose|blossom|garden|botanical/i.test(prompt);
    const isAnimal = /bird|cardinal|cat|dog|butterfly|animal/i.test(prompt);
    const isHeart = /heart|love|romantic/i.test(prompt);
    const isGeometric = /geometric|mandala|symmetry|pattern/i.test(prompt);

    for (let r = 0; r < size; r++) {
      const row: string[] = [];
      const stitchRow: string[] = [];
      for (let c = 0; c < size; c++) {
        let color = '#fafaf9';
        let stitch = 'cross';

        if (isHeart) {
          const dx = c / size - 0.5;
          const dy = r / size - 0.5;
          const inHeart = Math.pow(dx * dx * 4 + dy * dy - 1, 3) - dx * dx * dy * dy * dy < 0;
          if (inHeart) {
            color = Math.random() > 0.3 ? '#e11d48' : '#f472b6';
            stitch = Math.random() > 0.7 ? 'satin' : 'cross';
          }
        } else if (isFloral) {
          const cx = size / 2, cy = size / 2;
          const dist = Math.hypot(r - cy, c - cx);
          const ring = Math.floor(dist / 2);
          if (dist < size * 0.4) {
            const colors = ['#e11d48', '#f472b6', '#f59e0b', '#16a34a', '#7c3aed'];
            color = colors[ring % colors.length];
            stitch = ring % 3 === 0 ? 'satin' : ring % 3 === 1 ? 'french' : 'cross';
          } else if (dist < size * 0.45) {
            color = '#16a34a';
            stitch = 'back';
          }
        } else if (isAnimal) {
          if (r > size * 0.3 && r < size * 0.7 && c > size * 0.2 && c < size * 0.5) {
            color = '#e11d48';
            stitch = 'cross';
          } else if (r > size * 0.4 && r < size * 0.6 && c > size * 0.5 && c < size * 0.8) {
            color = '#1e293b';
          }
        } else if (isGeometric) {
          const cx = size / 2, cy = size / 2;
          const angle = Math.atan2(r - cy, c - cx);
          const dist = Math.hypot(r - cy, c - cx);
          const band = Math.floor(dist / (size / 8)) % 2;
          if (band === 1 && dist < size * 0.45) {
            color = Math.abs(Math.sin(angle * 6)) > 0.5 ? '#0284c7' : '#7c3aed';
            stitch = 'satin';
          } else if (dist < size * 0.1) {
            color = '#f59e0b';
          }
        } else {
          // Generic/default pattern: subtle gradient or geometric
          const cx = size / 2, cy = size / 2;
          const dist = Math.hypot(r - cy, c - cx) / (size / 2);
          if (dist < 0.3) {
            color = '#e11d48';
            stitch = Math.random() > 0.7 ? 'satin' : 'cross';
          } else if (dist < 0.45) {
            color = '#f472b6';
            stitch = 'cross';
          } else if (dist < 0.55) {
            color = '#f59e0b';
            stitch = Math.random() > 0.6 ? 'back' : 'cross';
          } else if (dist < 0.7) {
            if (c % 4 < 2 && r % 4 < 2) { color = '#16a34a'; stitch = 'cross'; }
          }
        }

        row.push(color);
        stitchRow.push(stitch);
        if (color !== '#fafaf9') colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
      grid.push(row);
      stitchTypes.push(stitchRow);
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
      promptUsed: prompt,
      processingTimeMs: 3000,
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
        if (!response.ok) throw new Error('AI image-to-pattern generation failed');
        return await response.json();
      } catch (err) {
        console.error('AI image-to-pattern backend error, using mock', err);
      }
    }

    // Mock Implementation
    await delay(3500);
    const size = gridSize || 16;
    const primaryStitch = stitchType || 'cross';

    const dmcPalette = [
      { code: '310', name: 'Black', hex: '#1e293b', count: 0 },
      { code: '321', name: 'Christmas Red', hex: '#e11d48', count: 0 },
      { code: '742', name: 'Tangerine', hex: '#d97706', count: 0 },
      { code: '444', name: 'Lemon', hex: '#facc15', count: 0 },
      { code: '700', name: 'Green', hex: '#16a34a', count: 0 },
      { code: '798', name: 'Delft Blue', hex: '#0284c7', count: 0 },
      { code: '554', name: 'Violet', hex: '#7c3aed', count: 0 },
      { code: '3865', name: 'Winter White', hex: '#fef3c7', count: 0 },
      { code: '961', name: 'Dusty Rose', hex: '#f472b6', count: 0 },
      { code: '434', name: 'Brown', hex: '#78350f', count: 0 },
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
      try {
        const response = await fetch(`${this.apiBaseUrl}/ai/collage/text-to-collage`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ prompt, ...options })
        });
        if (!response.ok) throw new Error('AI collage generation failed');
        return await response.json();
      } catch (err) {
        console.error('AI text-to-collage backend error, using mock', err);
      }
    }

    // Smart Mock Implementation — generates layers based on prompt keywords
    await delay(3000);

    const isFloral = /flower|floral|rose|blossom|garden|botanical|petal|bloom/i.test(prompt);
    const isHeart = /heart|love|romantic|valentine/i.test(prompt);
    const isGeometric = /geometric|mandala|symmetry|pattern|tile/i.test(prompt);
    const isNature = /leaf|leaves|tree|branch|vine|nature|woodland|forest/i.test(prompt);
    const isVintage = /vintage|retro|antique|shabby|rustic|lace/i.test(prompt);
    const isAbstract = /abstract|modern|contemporary|artistic/i.test(prompt);

    const layers: FabricLayer[] = [];

    // Always start with a base fabric
    const bgColor = isVintage ? '#fef3c7' : isFloral ? '#fce7f3' : isNature ? '#f0fdf4' : isAbstract ? '#f5f3ff' : '#ffffff';
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
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (options?.complexity) formData.append('complexity', options.complexity);

        const response = await fetch(`${this.apiBaseUrl}/ai/collage/image-to-collage`, {
          method: 'POST',
          headers: this.getHeaders({}, true),
          body: formData,
        });
        if (!response.ok) throw new Error('AI image-to-collage generation failed');
        return await response.json();
      } catch (err) {
        console.error('AI image-to-collage backend error, using mock', err);
      }
    }

    // Smart Mock Implementation — generates a radial/sunburst layout
    await delay(3500);

    const complexity = options?.complexity || 'moderate';
    const numLayers = complexity === 'simple' ? 4 : complexity === 'complex' ? 8 : 6;

    const layers: FabricLayer[] = [];

    // Base fabric
    layers.push({
      id: 'bg', name: 'Base Fabric', color: '#fce7f3', pattern: 'solid',
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
        console.error('Failed to contact backend, falling back to mock marketplace data', err);
      }
    }
    await delay(500);
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
        console.error('Failed to contact backend, falling back to mock listings', err);
      }
    }
    await delay(400);
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
        console.error('Failed to create listing on backend', err);
      }
    }
    await delay(600);
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
        console.error(`Failed to update listing ${id} on backend`, err);
      }
    }
    await delay(500);
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
        console.error(`Failed to delete listing ${id} on backend`, err);
      }
    }
    await delay(400);
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
   * Fetches all community showcase entries (GET /api/showcase).
   */
  async getShowcaseEntries(): Promise<ShowcaseEntry[]> {
    if (this.isLiveBackend) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/showcase`, {
          headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch showcase entries');
        return await response.json();
      } catch (err) {
        console.error('Failed to contact backend, falling back to mocked showcase data', err);
      }
    }
    await delay(500);
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
        console.error(`Failed to fetch showcase entry ${id} from backend`, err);
      }
    }
    await delay(300);
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
    await delay(1000);

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

    await delay(400);
    const entries = await this.getShowcaseEntries();
    const entry = entries.find(e => e.id === id);
    if (!entry) return { success: false, error: 'Entry not found' };

    const user = await this.getUserProfile();
    if (entry.userId !== user.id) return { success: false, error: 'You can only delete your own entries' };

    const filtered = entries.filter(e => e.id !== id);
    localStorage.setItem('stitchwise_showcase', JSON.stringify(filtered));
    return { success: true };
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

/** Response from AI collage generation */
export interface AICollageResponse {
  success: boolean;
  layers: FabricLayer[];
  canvasWidth: number;
  canvasHeight: number;
  promptUsed?: string;
  processingTimeMs: number;
  totalLayers: number;
}
