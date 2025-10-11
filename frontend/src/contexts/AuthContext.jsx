/**
 * Professional Authentication Context
 * Uses AuthManager for all authentication operations
 * Clean, simple, and robust like Google/Facebook
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import authManager from '../services/authManager';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    user: null,
    isAuthenticated: false,
    isLoading: true
  });

  // Initialize auth manager and set up listener
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Starting initialization...');
        
        // Initialize auth manager and wait for session restoration
        const sessionRestored = await authManager.initialize();
        
        console.log('AuthContext: Initialization complete, session restored:', sessionRestored);
        
        if (isMounted) {
          // Get the current auth state after initialization
          const currentState = authManager.getAuthState();
          console.log('AuthContext: Setting initial auth state:', currentState);
          setAuthState(currentState);
        }
      } catch (error) {
        console.error('AuthContext: Initialization error:', error);
        if (isMounted) {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      }
    };

    // Set up auth state listener
    const removeListener = authManager.addListener((newState) => {
      if (isMounted) {
        console.log('AuthContext: Auth state changed:', newState);
        setAuthState(newState);
      }
    });

    // Initialize auth manager
    initializeAuth();

    return () => {
      isMounted = false;
      removeListener();
    };
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const user = await authManager.login(email, password);
      return user;
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Register user
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authManager.getCsrfTokenFromCookie()
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      authManager.setAccessToken(data.access_token);
      
      // Get user profile
      const user = await authManager.fetchUserProfile();
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return user;
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      await authManager.logout();
    } catch (error) {
      console.error('AuthContext: Logout error:', error);
    } finally {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  };

  const value = {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};