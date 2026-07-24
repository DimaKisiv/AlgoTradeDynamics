import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

/** Wraps routes that require an authenticated user. */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {return null;} // доки перевіряється збережений токен
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
