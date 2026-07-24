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
  const [loading, setLoading] = useState(true); // true доки перевіряємо збережений токен

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Гідратація сесії при завантаженні + автологаут на будь-який 401.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    let active = true;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
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
