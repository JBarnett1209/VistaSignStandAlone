/**
 * Professional API Service
 * Clean, simple API client with proper token management
 */

import axios from 'axios';
import authManager from './authManager';

// Create axios instance
const api = axios.create({
  baseURL: '',
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from auth manager
    const token = authManager.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Attach CSRF token from cookie if present for unsafe methods
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const csrfToken = authManager.getCsrfTokenFromCookie();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If request failed with 401, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry refresh endpoint to avoid recursion
      const isRefreshCall = (originalRequest?.url || '').includes('/api/v1/auth/refresh');
      if (isRefreshCall) {
        return Promise.reject(error);
      }

      // Check if we have a refresh token
      if (!authManager.hasRefreshToken()) {
        authManager.clearAuth();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const refreshResponse = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': authManager.getCsrfTokenFromCookie()
          }
        });

        if (!refreshResponse.ok) {
          authManager.clearAuth();
          return Promise.reject(error);
        }

        const refreshData = await refreshResponse.json();
        authManager.setAccessToken(refreshData.access_token);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${refreshData.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        authManager.clearAuth();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;