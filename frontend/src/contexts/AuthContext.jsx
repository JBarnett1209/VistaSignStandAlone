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
  
  // State machine to prevent race conditions
  const [authState, setAuthState] = useState('idle'); // 'idle', 'logging_in', 'restoring_session', 'authenticated'

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
      
      // If no refresh token, set loading to false and user to null
      if (!hasRefresh) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: No refresh token found, setting user to null');
        }
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
          if (process.env.NODE_ENV === 'development') {
            console.log(`AuthContext: Retrying refresh in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          }
          setTimeout(() => {
            attemptRefresh(retryCount + 1);
          }, delay);
          return;
        }
        
        // If it's a 401 (unauthorized), the refresh token is invalid - don't retry
        if (e.response?.status === 401) {
          if (process.env.NODE_ENV === 'development') {
            console.log('AuthContext: Refresh token invalid (401), not retrying');
          }
        }
        
        setLoading(false);
      }
    };
    
    // Attempt refresh with state machine protection
    const timeoutId = setTimeout(() => {
      // Only attempt refresh if we're in idle state (no auth operations in progress)
      if (authState === 'idle') {
        console.log('AuthContext: Attempting session restoration...');
        setAuthState('restoring_session');
        attemptRefresh().finally(() => {
          setAuthState('idle');
        });
      } else {
        console.log('AuthContext: Skipping session restoration - auth operation in progress:', authState);
      }
    }, 100);

    // Listen for auth failure events from API interceptor
    const handleAuthFailed = () => {
      // Don't logout if we're in the middle of auth operations
      if (authState === 'logging_in' || authState === 'restoring_session') {
        console.log('AuthContext: Ignoring auth-failed event during auth operation:', authState);
        return;
      }
      
      // Only process auth failures if we're in authenticated state
      if (authState === 'authenticated') {
        console.log('AuthContext: Processing auth-failed event');
        setAuthState('idle');
        setUser(null);
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = null;
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-failed', handleAuthFailed);
    }
    
    // Add window focus listener to restore session when user returns to tab
    const handleWindowFocus = () => {
      // Only attempt refresh if we don't have a user and we're not currently logging in
      if (!user && !isLoggingIn && !loading) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Window focused, checking for session restoration');
        }
        // Small delay to ensure the page is fully focused
        setTimeout(() => {
          if (!user && !isLoggingIn) {
            attemptRefresh();
          }
        }, 100);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus);
    }

    return () => {
      clearTimeout(timeoutId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-failed', handleAuthFailed);
        window.removeEventListener('focus', handleWindowFocus);
      }
    };
  }, [user, authState, loading]); // Add dependencies to prevent stale closures

  const login = async (email, password) => {
    // Prevent multiple simultaneous login attempts
    if (authState === 'logging_in' || authState === 'restoring_session') {
      console.log('AuthContext: Login blocked - auth operation in progress');
      throw new Error('Authentication operation already in progress');
    }
    
    console.log('AuthContext: Starting login process...');
    setAuthState('logging_in');
    setIsLoggingIn(true);
    
    try {
      const response = await api.post('/api/v1/auth/login', { email, password });
      const { access_token, user: userData } = response.data;
      
      if (typeof window !== 'undefined') {
        window.__vstAccessToken = access_token;
        console.log('AuthContext: Access token set:', access_token ? 'Present' : 'Missing');
      }
      
      console.log('AuthContext: Login successful, setting user:', userData);
      setUser(userData);
      setAuthState('authenticated');
      setIsLoggingIn(false);
      
      console.log('AuthContext: Login process completed, user should be set');
    } catch (error) {
      setAuthState('idle');
      setIsLoggingIn(false);
      console.log('AuthContext: Login failed:', error);
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
    console.log('AuthContext: Logout called');
    setAuthState('idle');
    try { await api.post('/api/v1/auth/logout'); } catch (_) {}
    if (typeof window !== 'undefined') {
      window.__vstAccessToken = null;
    }
    setUser(null);
  };

  // Heartbeat: periodically verify session and force logout if deactivated/invalid
  useEffect(() => {
    if (!user || authState !== 'authenticated') return;

    console.log('AuthContext: Setting up session check useEffect, user:', user?.email, 'authState:', authState);
    let cancelled = false;
    const checkSession = async () => {
      // Only check if we're still authenticated and not in the middle of auth operations
      if (authState !== 'authenticated') {
        console.log('AuthContext: Skipping session check - not in authenticated state:', authState);
        return;
      }
      
      try {
        console.log('AuthContext: Checking session validity...');
        console.log('AuthContext: Current access token:', window.__vstAccessToken ? 'Present' : 'Missing');
        const response = await api.get('/api/v1/auth/me');
        console.log('AuthContext: Session check successful:', response.data);
      } catch (e) {
        console.log('AuthContext: Session check failed:', e);
        console.log('AuthContext: Error details:', {
          status: e.response?.status,
          statusText: e.response?.statusText,
          data: e.response?.data,
          message: e.message
        });
        // On any auth failure (e.g., 401 due to deactivation), immediately logout
        if (!cancelled && authState === 'authenticated') {
          await logout();
        }
      }
    };

    // Add a longer delay before the first check to avoid race conditions with login
    // This gives the login process time to fully complete
    const initialCheckTimeout = setTimeout(() => {
      if (!cancelled && authState === 'authenticated') {
        console.log('AuthContext: Starting initial session check...');
        checkSession();
      } else {
        console.log('AuthContext: Skipping initial session check - cancelled or not authenticated');
      }
    }, 5000); // Increased to 5 seconds to avoid race conditions
    
    const intervalId = setInterval(() => {
      if (!cancelled && authState === 'authenticated') {
        checkSession();
      }
    }, 30000); // 30s

    return () => {
      cancelled = true;
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, [user, authState]);

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