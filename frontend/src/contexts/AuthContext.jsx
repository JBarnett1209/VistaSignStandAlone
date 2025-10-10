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
    const attemptRefresh = async (retryCount = 0) => {
      const maxRetries = 3;
      
      // Check for refresh cookie with more robust parsing
      const hasRefresh = (() => {
        if (typeof document === 'undefined') return false;
        try {
          const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
            const [key, value] = cookie.split('=');
            if (key && value) {
              acc[key] = value;
            }
            return acc;
          }, {});
          const refreshToken = cookies['vst_refresh'];
          return Boolean(refreshToken && refreshToken.length > 0);
        } catch (e) {
          console.log('AuthContext: Error parsing cookies:', e);
          return false;
        }
      })();
      console.log('AuthContext: Checking for refresh token, hasRefresh:', hasRefresh, 'retry:', retryCount);
      console.log('AuthContext: All cookies:', document.cookie);
      
      if (!hasRefresh) {
        console.log('AuthContext: No refresh token found, user not authenticated');
        setUser(null);
        setLoading(false);
        return;
      }
      
      try {
        console.log('AuthContext: Attempting to refresh token...');
        const res = await api.post('/api/v1/auth/refresh', {});
        
        // Keep access token only in memory
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = res.data.access_token;
        }
        
        console.log('AuthContext: Token refreshed, getting user profile...');
        const me = await api.get('/api/v1/auth/me');
        console.log('AuthContext: User profile loaded:', me.data);
        setUser(me.data);
        setLoading(false);
        
      } catch (e) {
        console.log('AuthContext: Refresh failed:', e);
        
        // Clear any stored tokens and user state on auth failure
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = null;
        }
        setUser(null);
        
        // If it's a network error or server error, retry with exponential backoff
        if ((e.code === 'NETWORK_ERROR' || e.response?.status >= 500) && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`AuthContext: Network/server error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            attemptRefresh(retryCount + 1);
          }, delay);
          return;
        }
        
        setLoading(false);
      }
    };
    
    // Add a small delay to ensure cookies are fully loaded, then attempt refresh
    const timeoutId = setTimeout(() => attemptRefresh(), 100);

    // Listen for auth failure events from API interceptor
    const handleAuthFailed = () => {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.__vstAccessToken = null;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-failed', handleAuthFailed);
    }
    
    return () => {
      clearTimeout(timeoutId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-failed', handleAuthFailed);
      }
    };
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