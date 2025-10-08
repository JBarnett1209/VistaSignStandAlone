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