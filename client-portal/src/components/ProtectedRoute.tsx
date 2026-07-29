import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route protection wrapper. Redirects unauthenticated sessions
 * to the Login page while maintaining history state for seamless returns.
 *
 * Uses AuthContext (not api directly) so the UI stays in sync
 * with auth state changes (login/logout/signup).
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Show nothing while loading initial auth state from localStorage
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
