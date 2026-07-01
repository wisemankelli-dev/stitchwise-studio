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
