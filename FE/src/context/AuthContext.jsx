import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import * as authApi from '../api/auth';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {throw new Error('useAuth must be used within <AuthProvider>');}
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    // Clear UI state immediately, then revoke the HttpOnly refresh session server-side.
    setToken(null);
    setUser(null);
    try {
      await authApi.logout();
    } catch {
      // Logout request failed, but UI state is already cleared
    }
  }, []);

  // Restore a session on startup. If the access JWT expired, the HTTP client
  // transparently rotates the refresh cookie and retries /auth/me once.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    let active = true;
    (async () => {
      try {
        if (!getToken()) {
          // Allows restoring a session from the HttpOnly refresh cookie even when
          // localStorage was cleared or the access token was never persisted.
          await authApi.refreshSession();
        }
        const me = await authApi.fetchMe();
        if (active) {setUser(me);}
      } catch {
        setToken(null);
        if (active) {setUser(null);}
      } finally {
        if (active) {setLoading(false);}
      }
    })();

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    await authApi.login({ email, password });
    const me = await authApi.fetchMe();
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (email, password) => {
    await authApi.register({ email, password });
    await authApi.login({ email, password });
    const me = await authApi.fetchMe();
    setUser(me);
    return me;
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refresh: async () => {
      const me = await authApi.fetchMe();
      setUser(me);
      return me;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
