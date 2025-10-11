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
    
    // Attempt refresh with a small delay to avoid race conditions with login
    // This ensures we try to restore the session but not interfere with active login
    const timeoutId = setTimeout(() => {
      // Only attempt refresh if we're not currently logging in
      if (!isLoggingIn) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Attempting session restoration...');
        }
        attemptRefresh();
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Skipping session restoration - login in progress');
        }
      }
    }, 100);

    // Listen for auth failure events from API interceptor
    const handleAuthFailed = () => {
      // Don't logout if we're in the middle of logging in
      if (isLoggingIn) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Ignoring auth-failed event during login');
        }
        return;
      }
      
      // Add a small delay to prevent immediate logout after successful login
      // This prevents race conditions where the session check fails immediately after login
      setTimeout(() => {
        if (!isLoggingIn) {
          if (process.env.NODE_ENV === 'development') {
            console.log('AuthContext: Processing auth-failed event');
          }
          setUser(null);
          if (typeof window !== 'undefined') {
            window.__vstAccessToken = null;
          }
        }
      }, 1000); // 1 second delay to allow login to complete
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
  }, [user, isLoggingIn, loading]); // Add dependencies to prevent stale closures

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
        console.log('AuthContext: Access token set:', access_token ? 'Present' : 'Missing');
      }
      
      console.log('AuthContext: Login successful, setting user:', userData);
      console.log('AuthContext: Current user state before setUser:', user);
      
      setUser(userData);
      
      // Immediately set isLoggingIn to false after successful login
      // The session check will handle any subsequent auth issues
      setIsLoggingIn(false);
      
      console.log('AuthContext: Login process completed, user should be set');
    } catch (error) {
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
        if (!cancelled) {
          await logout();
        }
      }
    };

    // Add a longer delay before the first check to avoid race conditions with login
    // This gives the login process time to fully complete
    const initialCheckTimeout = setTimeout(() => {
      if (!cancelled && !isLoggingIn) {
        if (process.env.NODE_ENV === 'development') {
          console.log('AuthContext: Starting initial session check...');
        }
        checkSession();
      } else if (process.env.NODE_ENV === 'development') {
        console.log('AuthContext: Skipping initial session check - login in progress or cancelled');
      }
    }, 5000); // Increased to 5 seconds to avoid race conditions
    
    const intervalId = setInterval(() => {
      if (!cancelled && !isLoggingIn) {
        checkSession();
      }
    }, 30000); // 30s

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