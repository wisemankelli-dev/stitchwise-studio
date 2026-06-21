import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route protection wrapper. Redirects unauthenticated sessions
 * to the Login page while maintaining history state for seamless returns.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();

  if (!api.isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
