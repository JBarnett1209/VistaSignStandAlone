import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt to refresh on load (cookie-based refresh)
    const attemptRefresh = async () => {
      // Only try if refresh cookie exists to avoid 401 spam for anonymous users
      const hasRefresh = typeof document !== 'undefined' && document.cookie.split('; ').some(c => c.startsWith('vst_refresh='));
      if (!hasRefresh) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await api.post('/api/v1/auth/refresh', {});
        // Keep access token only in memory
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = res.data.access_token;
        }
        const me = await api.get('/api/v1/auth/me');
        setUser(me.data);
      } catch (e) {
        // Clear any stored tokens and user state on auth failure
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = null;
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    attemptRefresh();

    // Listen for auth failure events from API interceptor
    const handleAuthFailed = () => {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.__vstAccessToken = null;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-failed', handleAuthFailed);
      return () => window.removeEventListener('auth-failed', handleAuthFailed);
    }
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/api/v1/auth/login', { email, password });
    const { access_token, user: userData } = response.data;
    if (typeof window !== 'undefined') {
      window.__vstAccessToken = access_token;
    }
    setUser(userData);
  };

  const register = async (userData) => {
    const response = await api.post('/api/v1/auth/register', userData);
    const { access_token } = response.data;
    if (typeof window !== 'undefined') {
      window.__vstAccessToken = access_token;
    }
    // Get user profile after registration
    const me = await api.get('/api/v1/auth/me');
    setUser(me.data);
  };

  const logout = async () => {
    try { await api.post('/api/v1/auth/logout'); } catch (_) {}
    if (typeof window !== 'undefined') {
      window.__vstAccessToken = null;
    }
    setUser(null);
  };

  // Heartbeat: periodically verify session and force logout if deactivated/invalid
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const checkSession = async () => {
      try {
        await api.get('/api/v1/auth/me');
      } catch (e) {
        // On any auth failure (e.g., 401 due to deactivation), immediately logout
        if (!cancelled) {
          await logout();
        }
      }
    };

    // Immediate check, then interval
    checkSession();
    const intervalId = setInterval(checkSession, 30000); // 30s

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [user]);

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};