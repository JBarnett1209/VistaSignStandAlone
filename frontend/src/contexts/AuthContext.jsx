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
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // Attempt to refresh on load (cookie-based refresh)
    const attemptRefresh = async (retryCount = 0) => {
      const maxRetries = 3;
      
      // Check for refresh cookie with more robust parsing
      const hasRefresh = (() => {
        if (typeof document === 'undefined') return false;
        try {
          // More robust cookie parsing that handles edge cases
          const cookies = document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .filter(cookie => cookie.length > 0)
            .reduce((acc, cookie) => {
              const equalIndex = cookie.indexOf('=');
              if (equalIndex > 0) {
                const key = cookie.substring(0, equalIndex).trim();
                const value = cookie.substring(equalIndex + 1).trim();
                if (key && value) {
                  acc[key] = decodeURIComponent(value);
                }
              }
              return acc;
            }, {});
          
          const refreshToken = cookies['vst_refresh'];
          const hasValidRefresh = Boolean(refreshToken && refreshToken.length > 0 && refreshToken !== 'undefined' && refreshToken !== 'null');
          
          // Debug logging for troubleshooting
          if (process.env.NODE_ENV === 'development') {
            console.log('AuthContext: Cookie check on refresh:', {
              allCookies: document.cookie,
              parsedCookies: cookies,
              refreshToken: refreshToken,
              hasValidRefresh: hasValidRefresh
            });
          }
          
          return hasValidRefresh;
        } catch (e) {
          console.error('AuthContext: Error parsing cookies:', e);
          return false;
        }
      })();
      if (!hasRefresh) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Attempting token refresh...');
        }
        const res = await api.post('/api/v1/auth/refresh', {});
        
        // Keep access token only in memory
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = res.data.access_token;
        }
        
        const me = await api.get('/api/v1/auth/me');
        setUser(me.data);
        setLoading(false);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Token refresh successful, user loaded:', me.data);
        }
        
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Token refresh failed:', e);
        }
        
        // Clear any stored tokens and user state on auth failure
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = null;
        }
        setUser(null);
        
        // If it's a network error or server error, retry with exponential backoff
        if ((e.code === 'NETWORK_ERROR' || e.response?.status >= 500) && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          setTimeout(() => {
            attemptRefresh(retryCount + 1);
          }, delay);
          return;
        }
        
        setLoading(false);
      }
    };
    
    // Add a small delay to ensure cookies are fully loaded, then attempt refresh
    const timeoutId = setTimeout(() => attemptRefresh(), 200);

    // Listen for auth failure events from API interceptor
    const handleAuthFailed = () => {
      // Don't logout if we're in the middle of logging in
      if (isLoggingIn) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Ignoring auth-failed event during login');
        }
        return;
      }
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
    if (process.env.NODE_ENV === 'development') {
      console.log('AuthContext: Starting login process...');
    }
    setIsLoggingIn(true);
    try {
      const response = await api.post('/api/v1/auth/login', { email, password });
      const { access_token, user: userData } = response.data;
      
      if (typeof window !== 'undefined') {
        window.__vstAccessToken = access_token;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('AuthContext: Login successful, setting user:', userData);
      }
      
      setUser(userData);
      
      // Immediately set isLoggingIn to false after successful login
      // The session check will handle any subsequent auth issues
      setIsLoggingIn(false);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('AuthContext: Login process completed');
      }
    } catch (error) {
      setIsLoggingIn(false);
      throw error;
    }
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
    if (process.env.NODE_ENV === 'development') {
      console.log('AuthContext: Logout called');
    }
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
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Checking session validity...');
        }
        await api.get('/api/v1/auth/me');
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Session check successful');
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Session check failed:', e);
        }
        // On any auth failure (e.g., 401 due to deactivation), immediately logout
        if (!cancelled) {
          await logout();
        }
      }
    };

    // Add a delay before the first check to avoid race conditions with login
    const initialCheckTimeout = setTimeout(() => {
      if (!cancelled) {
        checkSession();
      }
    }, 2000); // Reduced to 2 second delay - enough to avoid race conditions
    
    const intervalId = setInterval(checkSession, 30000); // 30s

    return () => {
      cancelled = true;
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, [user, isLoggingIn]);

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