import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, mapBackendTier, type User } from '../services/api';

// ─── Context Shape ──────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Currently authenticated user, or null if not logged in. */
  currentUser: User | null;
  /** Whether we're still loading the initial auth state from localStorage. */
  isLoading: boolean;
  /** True when a token exists in localStorage. */
  isAuthenticated: boolean;
  /** Authenticate with email + password. Returns the user on success. */
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  /** Register a new account. Returns the user on success. */
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  /** Clear session and return to unauthenticated state. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Storage keys ───────────────────────────────────────────────────────────

const TOKEN_KEY = 'stitchwise_token';
const USER_ID_KEY = 'stitchwise_active_user_id';
const TIER_KEY = 'stitchwise_tier';
const USERS_KEY = 'stitchwise_users';
/** The signed-in member's own profile, written on login/signup. */
export const PROFILE_KEY = 'stitchwise_profile';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Decode the payload of a JWT *without* verifying its signature.
 * Used only for display data the browser already holds (id, email, tier) so a
 * reload can never leave the app showing a placeholder name with no email.
 * Returns null for a missing/malformed token.
 */
export function decodeJwtPayload(token: string | null | undefined): Record<string, any> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : binary;
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Turn "kelli.w@example.com" into "Kelli W" for a display name we never got. */
function nameFromEmail(email: string): string {
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  if (!local) return 'Crafting User';
  return local.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Accepts either shape the app can hold and returns a full `User`:
 *  - the backend's auth response: `{ userId, email, name, tier }`
 *    (POST /api/auth/login and /api/auth/signup both return this), and
 *  - the app's own `User`: `{ id, email, name, role, subscriptionTier }`.
 * Missing fields fall back to the JWT payload, then to `fallbackTier`.
 */
export function normalizeAuthUser(
  raw: any,
  jwtPayload: Record<string, any> | null = null,
  fallbackTier: string | null = null,
): User | null {
  if (!raw && !jwtPayload) return null;

  const email = String(raw?.email || jwtPayload?.email || '');
  const id = String(raw?.id || raw?.userId || jwtPayload?.userId || '');
  const subscriptionTier = mapBackendTier(
    raw?.subscriptionTier || raw?.tier || jwtPayload?.tier || fallbackTier || 'Hobbyist',
  );
  const name = String(raw?.name || '').trim() || nameFromEmail(email);

  return {
    id,
    name,
    email,
    role: raw?.role || (subscriptionTier === 'Design Studio' ? 'studio_admin' : 'hobbyist'),
    subscriptionTier,
    avatarUrl: raw?.avatarUrl || '🧵',
  };
}

/**
 * Store the signed-in member's profile so a reload shows their own name and
 * email (and so checkout links can carry that email) instead of a placeholder.
 */
export function persistProfile(user: User | null): void {
  if (typeof localStorage === 'undefined') return;
  if (!user) {
    localStorage.removeItem(PROFILE_KEY);
    return;
  }
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
  } catch { /* quota/private mode — the JWT fallback still has email */ }
  if (user.id) localStorage.setItem(USER_ID_KEY, user.id);
  localStorage.setItem(TIER_KEY, user.subscriptionTier);
}

/**
 * Reconstruct a User object from localStorage values.
 * Returns null if the token is missing (not authenticated).
 *
 * Sources, in order: the stored profile, the legacy mock users array, then the
 * JWT payload — so `email` is present on every signed-in load.
 */
export function loadUserFromStorage(): User | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const jwt = decodeJwtPayload(token);
  const storedTier = localStorage.getItem(TIER_KEY);

  // 1. The profile written at login/signup.
  const profileStr = localStorage.getItem(PROFILE_KEY);
  if (profileStr) {
    try {
      const stored = JSON.parse(profileStr);
      if (stored && typeof stored === 'object') {
        const user = normalizeAuthUser(stored, jwt, storedTier);
        if (user) return user;
      }
    } catch { /* fall through */ }
  }

  // 2. The legacy localStorage users array (mock/local mode signup).
  const userId = localStorage.getItem(USER_ID_KEY);
  const usersStr = localStorage.getItem(USERS_KEY);
  if (usersStr && userId) {
    try {
      const users: any[] = JSON.parse(usersStr);
      const found = users.find((u) => u.id === userId);
      if (found) {
        const user = normalizeAuthUser(found, jwt, storedTier);
        if (user) return user;
      }
    } catch { /* fall through */ }
  }

  // 3. The JWT payload — userId, email and tier.
  if (jwt) {
    const user = normalizeAuthUser(null, jwt, storedTier);
    if (user) return user;
  }

  // Minimal fallback: at least we have a token
  return {
    id: userId || 'unknown',
    name: 'Crafting User',
    email: '',
    role: 'hobbyist',
    subscriptionTier: mapBackendTier(storedTier),
    avatarUrl: '🧵',
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check localStorage for an existing session
  useEffect(() => {
    const user = loadUserFromStorage();
    setCurrentUser(user);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.success && res.user) {
      const user = normalizeAuthUser(res.user, decodeJwtPayload(res.token));
      if (!user) return { success: false, error: 'Login failed' };
      persistProfile(user);
      setCurrentUser(user);
      return { success: true, user };
    }
    return { success: false, error: res.error || 'Invalid credentials' };
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.signup(name, email, password);
    if (res.success && res.user) {
      const user = normalizeAuthUser(res.user, decodeJwtPayload(res.token));
      if (!user) return { success: false, error: 'Registration failed' };
      persistProfile(user);
      setCurrentUser(user);
      return { success: true, user };
    }
    return { success: false, error: res.error || 'Registration failed' };
  }, []);

  const logout = useCallback(() => {
    api.logout();
    persistProfile(null);
    setCurrentUser(null);
  }, []);

  const value: AuthContextValue = {
    currentUser,
    isLoading,
    isAuthenticated: currentUser !== null,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Access the authentication context. Must be used within an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
