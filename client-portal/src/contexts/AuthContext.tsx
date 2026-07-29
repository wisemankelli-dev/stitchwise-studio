import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type User } from '../services/api';

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

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Reconstruct a User object from localStorage values.
 * Returns null if the token is missing (not authenticated).
 */
function loadUserFromStorage(): User | null {
  const token = localStorage.getItem('stitchwise_token');
  if (!token) return null;

  const userId = localStorage.getItem('stitchwise_active_user_id');
  const tier = localStorage.getItem('stitchwise_tier') || 'Hobbyist';

  // Try to find the user in the stored users array to get name/email/avatar
  const usersStr = localStorage.getItem('stitchwise_users');
  if (usersStr && userId) {
    try {
      const users: any[] = JSON.parse(usersStr);
      const found = users.find((u) => u.id === userId);
      if (found) {
        return {
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role || 'hobbyist',
          subscriptionTier: (found.subscriptionTier || tier) as User['subscriptionTier'],
          avatarUrl: found.avatarUrl || '🧵',
        };
      }
    } catch { /* fall through */ }
  }

  // Minimal fallback: at least we have a token
  return {
    id: userId || 'unknown',
    name: 'Crafting User',
    email: '',
    role: 'hobbyist',
    subscriptionTier: tier as User['subscriptionTier'],
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
      setCurrentUser(res.user);
      return { success: true, user: res.user };
    }
    return { success: false, error: res.error || 'Invalid credentials' };
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.signup(name, email, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      return { success: true, user: res.user };
    }
    return { success: false, error: res.error || 'Registration failed' };
  }, []);

  const logout = useCallback(() => {
    api.logout();
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
