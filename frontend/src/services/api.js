/**
 * Professional API Service
 * Clean, simple API client with proper token management
 */

import axios from 'axios';
import authManager from './authManager';

// Create axios instance with proper protocol handling
const getBaseURL = () => {
  // Always use relative URLs to avoid mixed content issues
  // The nginx proxy will handle routing /api requests to the backend
  console.log('API: Using relative URLs (empty baseURL) to avoid mixed content issues');
  return '';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
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

// API service objects for backward compatibility
export const documentsAPI = {
  list: () => api.get('/api/v1/documents'),
  get: (id) => api.get(`/api/v1/documents/${id}`),
  create: (data) => api.post('/api/v1/documents', data),
  update: (id, data) => api.put(`/api/v1/documents/${id}`, data),
  delete: (id) => api.delete(`/api/v1/documents/${id}`),
  upload: (file, title, description) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    return api.post('/api/v1/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  convertToPdf: (id) => api.post(`/api/v1/documents/${id}/convert-to-pdf`),
  fields: {
    list: (documentId) => api.get(`/api/v1/documents/${documentId}/fields`),
    create: (documentId, data) => api.post(`/api/v1/documents/${documentId}/fields`, data),
    update: (documentId, fieldId, data) => api.put(`/api/v1/documents/${documentId}/fields/${fieldId}`, data),
    delete: (documentId, fieldId) => api.delete(`/api/v1/documents/${documentId}/fields/${fieldId}`)
  }
};

export const signaturesAPI = {
  list: () => api.get('/api/v1/signatures'),
  get: (id) => api.get(`/api/v1/signatures/${id}`),
  create: (data) => api.post('/api/v1/signatures', data),
  update: (id, data) => api.put(`/api/v1/signatures/${id}`, data),
  delete: (id) => api.delete(`/api/v1/signatures/${id}`),
  templates: {
    list: () => api.get('/api/v1/signatures/templates'),
    create: (data) => api.post('/api/v1/signatures/templates', data),
    update: (id, data) => api.put(`/api/v1/signatures/templates/${id}`, data),
    delete: (id) => api.delete(`/api/v1/signatures/templates/${id}`)
  },
  admin: {
    listAll: (params = {}) => api.get('/api/v1/signatures/admin', { params }),
    get: (id) => api.get(`/api/v1/signatures/admin/${id}`),
    update: (id, data) => api.put(`/api/v1/signatures/admin/${id}`, data),
    delete: (id) => api.delete(`/api/v1/signatures/admin/${id}`),
    restore: (id) => api.post(`/api/v1/signatures/admin/${id}/restore`)
  },
  // Backward compatibility
  adminListAll: (params = {}) => api.get('/api/v1/signatures/admin', { params })
};

export const workflowsAPI = {
  list: () => api.get('/api/v1/workflows'),
  get: (id) => api.get(`/api/v1/workflows/${id}`),
  create: (data) => api.post('/api/v1/workflows', data),
  update: (id, data) => api.put(`/api/v1/workflows/${id}`, data),
  delete: (id) => api.delete(`/api/v1/workflows/${id}`),
  send: (id) => api.post(`/api/v1/workflows/${id}/send`),
  participants: {
    list: (workflowId) => api.get(`/api/v1/workflows/${workflowId}/participants`),
    add: (workflowId, data) => api.post(`/api/v1/workflows/${workflowId}/participants`, data),
    update: (workflowId, participantId, data) => api.put(`/api/v1/workflows/${workflowId}/participants/${participantId}`, data),
    delete: (workflowId, participantId) => api.delete(`/api/v1/workflows/${workflowId}/participants/${participantId}`)
  }
};

export const invitesAPI = {
  list: () => api.get('/api/v1/invites'),
  get: (id) => api.get(`/api/v1/invites/${id}`),
  create: (data) => api.post('/api/v1/invites', data),
  update: (id, data) => api.put(`/api/v1/invites/${id}`, data),
  delete: (id) => api.delete(`/api/v1/invites/${id}`),
  resend: (id) => api.post(`/api/v1/invites/${id}/resend`),
  validate: (code) => api.get(`/api/v1/invites/validate?code=${code}`)
};

export const usersAPI = {
  list: () => api.get('/api/v1/users'),
  get: (id) => api.get(`/api/v1/users/${id}`),
  create: (data) => api.post('/api/v1/users', data),
  update: (id, data) => api.put(`/api/v1/users/${id}`, data),
  delete: (id) => api.delete(`/api/v1/users/${id}`),
  deactivate: (id) => api.post(`/api/v1/users/${id}/deactivate`),
  activate: (id) => api.post(`/api/v1/users/${id}/activate`)
};

export default api;