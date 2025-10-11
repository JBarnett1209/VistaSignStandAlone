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
    const sessionRestored = await this.restoreSession();
    
    // Start session monitoring
    this.startSessionMonitoring();
    
    this.isInitialized = true;
    console.log('AuthManager: Initialized');
    
    // Notify listeners of initial state
    this.notifyListeners();
    
    return sessionRestored;
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
    const hasToken = document.cookie.split('; ').some(c => c.startsWith('vst_refresh='));
    console.log('AuthManager: Checking for refresh token:', hasToken);
    console.log('AuthManager: All cookies:', document.cookie);
    return hasToken;
  }

  /**
   * Restore session from refresh token
   */
  async restoreSession() {
    if (!this.hasRefreshToken()) {
      console.log('AuthManager: No refresh token found');
      this.clearAuth();
      return false;
    }

    try {
      console.log('AuthManager: Attempting to restore session...');
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add CSRF token if available from cookie
      const csrfToken = this.getCsrfTokenFromCookie();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      
      // Try to refresh the access token
      console.log('AuthManager: Sending refresh request...');
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({}) // Send empty body since we're using cookies
      });

      console.log('AuthManager: Refresh response status:', response.status);
      
      if (!response.ok) {
        console.log('AuthManager: Session restoration failed - refresh token invalid');
        this.clearAuth();
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
      this.clearAuth();
      return false;
    }
  }

  /**
   * Get CSRF token from server (only when needed)
   */
  async getCsrfToken() {
    try {
      const response = await fetch('/api/v1/auth/csrf', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.warn('AuthManager: CSRF endpoint returned non-OK status:', response.status);
        return null;
      }
      
      const data = await response.json();
      return data.csrf;
    } catch (error) {
      console.warn('AuthManager: Failed to get CSRF token:', error.message);
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
    const token = csrfCookie ? csrfCookie.split('=')[1] : null;
    console.log('AuthManager: CSRF token from cookie:', token ? 'present' : 'missing');
    return token;
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
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Check if we have a CSRF token in cookie
      const cookieCsrfToken = this.getCsrfTokenFromCookie();
      if (cookieCsrfToken) {
        headers['X-CSRF-Token'] = cookieCsrfToken;
        console.log('AuthManager: Using CSRF token from cookie');
      } else {
        // Try to get CSRF token from server only if we don't have one
        console.log('AuthManager: No CSRF token in cookie, fetching from server...');
        const serverCsrfToken = await this.getCsrfToken();
        if (serverCsrfToken) {
          headers['X-CSRF-Token'] = serverCsrfToken;
          console.log('AuthManager: Using CSRF token from server');
        } else {
          console.log('AuthManager: No CSRF token available, proceeding without it');
        }
      }
      
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers,
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
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Only add CSRF token if we have one in cookie
      const csrfToken = this.getCsrfTokenFromCookie();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
          
          const refreshResponse = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({}) // Send empty body since we're using cookies
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
