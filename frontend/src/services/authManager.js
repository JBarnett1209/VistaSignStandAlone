/**
 * Professional-grade Authentication Manager
 * Handles all authentication operations with proper session management
 * Similar to Google/Facebook's approach
 */

class AuthManager {
  constructor() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.isInitialized = false;
    this.sessionCheckInterval = null;
    this.listeners = new Set();
    
    // Session check interval (30 seconds like Google)
    this.SESSION_CHECK_INTERVAL = 30000;
    
    // Token refresh buffer (refresh 5 minutes before expiry)
    this.TOKEN_REFRESH_BUFFER = 5 * 60 * 1000;
  }

  /**
   * Initialize the auth manager
   * This should be called once when the app starts
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('AuthManager: Initializing...');
    
    // Check for existing session
    await this.restoreSession();
    
    // Start session monitoring
    this.startSessionMonitoring();
    
    this.isInitialized = true;
    console.log('AuthManager: Initialized');
  }

  /**
   * Add a listener for auth state changes
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of auth state changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback({
          user: this.user,
          isAuthenticated: !!this.user,
          isLoading: false
        });
      } catch (error) {
        console.error('AuthManager: Listener error:', error);
      }
    });
  }

  /**
   * Set access token and update global state
   */
  setAccessToken(token) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      window.__vstAccessToken = token;
    }
  }

  /**
   * Clear all tokens and user data
   */
  clearAuth() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      window.__vstAccessToken = null;
    }
    this.notifyListeners();
  }

  /**
   * Check if we have a valid refresh token
   */
  hasRefreshToken() {
    if (typeof document === 'undefined') return false;
    return document.cookie.split('; ').some(c => c.startsWith('vst_refresh='));
  }

  /**
   * Restore session from refresh token
   */
  async restoreSession() {
    if (!this.hasRefreshToken()) {
      console.log('AuthManager: No refresh token found');
      return false;
    }

    try {
      console.log('AuthManager: Attempting to restore session...');
      
      // Get CSRF token first
      await this.getCsrfToken();
      
      // Try to refresh the access token
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.getCsrfTokenFromCookie()
        }
      });

      if (!response.ok) {
        console.log('AuthManager: Session restoration failed');
        return false;
      }

      const data = await response.json();
      this.setAccessToken(data.access_token);
      
      // Get user profile
      await this.fetchUserProfile();
      
      console.log('AuthManager: Session restored successfully');
      return true;
    } catch (error) {
      console.log('AuthManager: Session restoration error:', error);
      return false;
    }
  }

  /**
   * Get CSRF token
   */
  async getCsrfToken() {
    try {
      const response = await fetch('/api/v1/auth/csrf', {
        credentials: 'include'
      });
      const data = await response.json();
      return data.csrf;
    } catch (error) {
      console.error('AuthManager: Failed to get CSRF token:', error);
      return null;
    }
  }

  /**
   * Get CSRF token from cookie
   */
  getCsrfTokenFromCookie() {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split('; ');
    const csrfCookie = cookies.find(c => c.startsWith('vst_csrf='));
    return csrfCookie ? csrfCookie.split('=')[1] : null;
  }

  /**
   * Fetch user profile
   */
  async fetchUserProfile() {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch('/api/v1/auth/me', {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    this.user = await response.json();
    this.notifyListeners();
    return this.user;
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    try {
      console.log('AuthManager: Starting login...');
      
      // Get CSRF token first
      await this.getCsrfToken();
      
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.getCsrfTokenFromCookie()
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      this.setAccessToken(data.access_token);
      this.user = data.user;
      
      console.log('AuthManager: Login successful');
      this.notifyListeners();
      
      return this.user;
    } catch (error) {
      console.error('AuthManager: Login failed:', error);
      this.clearAuth();
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      console.log('AuthManager: Logging out...');
      
      // Call logout endpoint
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': this.getCsrfTokenFromCookie()
        }
      });
    } catch (error) {
      console.error('AuthManager: Logout error:', error);
    } finally {
      this.clearAuth();
      this.stopSessionMonitoring();
    }
  }

  /**
   * Start session monitoring
   */
  startSessionMonitoring() {
    if (this.sessionCheckInterval) return;
    
    console.log('AuthManager: Starting session monitoring...');
    
    this.sessionCheckInterval = setInterval(async () => {
      if (!this.user || !this.accessToken) return;
      
      try {
        // Check if session is still valid
        const response = await fetch('/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });

        if (!response.ok) {
          console.log('AuthManager: Session invalid, attempting refresh...');
          
          // Try to refresh the token
          const refreshResponse = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': this.getCsrfTokenFromCookie()
            }
          });

          if (!refreshResponse.ok) {
            console.log('AuthManager: Token refresh failed, logging out...');
            await this.logout();
            return;
          }

          const refreshData = await refreshResponse.json();
          this.setAccessToken(refreshData.access_token);
          console.log('AuthManager: Token refreshed successfully');
        }
      } catch (error) {
        console.error('AuthManager: Session check error:', error);
        // Don't logout on network errors, just log them
      }
    }, this.SESSION_CHECK_INTERVAL);
  }

  /**
   * Stop session monitoring
   */
  stopSessionMonitoring() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
      console.log('AuthManager: Session monitoring stopped');
    }
  }

  /**
   * Get current auth state
   */
  getAuthState() {
    return {
      user: this.user,
      isAuthenticated: !!this.user,
      isLoading: false
    };
  }
}

// Create singleton instance
const authManager = new AuthManager();

export default authManager;
