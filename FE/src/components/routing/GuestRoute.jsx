import { Navigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

/** Wraps guest-only routes (login/register): redirects authed users to the app. */
export default function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {return null;}
  if (isAuthenticated) {return <Navigate to="/app" replace />;}
  return children;
}
