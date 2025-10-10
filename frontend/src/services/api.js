import axios from 'axios';

// Global refresh coordination to prevent infinite loops and stampedes
let isRefreshing = false;
let refreshPromise = null;
let lastRefreshFailureAt = 0;
const REFRESH_COOLDOWN_MS = 5000; // back off for 5s after a failed refresh
let refreshDisabled = false; // hard-disable further refresh attempts until reload

// Force same-origin requests to avoid mixed content. Nginx proxies /api → backend.
const api = axios.create({
  baseURL: '',
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Access token stored only in memory (window.__vstAccessToken)
    const token = typeof window !== 'undefined' ? window.__vstAccessToken : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Attach CSRF token from cookie if present for unsafe methods
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      // Get the most recent CSRF token (last one in the cookie string)
      const csrfCookies = document.cookie.split('; ').filter((c) => c.startsWith('vst_csrf='));
      if (csrfCookies.length > 0) {
        // Use the last (most recent) CSRF token
        const latestCsrf = csrfCookies[csrfCookies.length - 1];
        config.headers['X-CSRF-Token'] = latestCsrf.split('=')[1];
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

    // If request failed with 401, and it's not the refresh endpoint itself, try coordinated refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If no refresh cookie present, do not attempt to refresh (anonymous visitor)
      const hasRefresh = typeof document !== 'undefined' && document.cookie.split('; ').some(c => c.startsWith('vst_refresh='));
      if (!hasRefresh) {
        return Promise.reject(error);
      }
      // If refresh has been disabled, immediately fail and notify once
      if (refreshDisabled) {
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = null;
          window.dispatchEvent(new CustomEvent('auth-failed'));
        }
        return Promise.reject(error);
      }
      // Never attempt to refresh for refresh endpoint to avoid recursion
      const isRefreshCall = (originalRequest?.url || '').includes('/api/v1/auth/refresh');
      if (isRefreshCall) {
        return Promise.reject(error);
      }

      // Respect cooldown after a failed refresh to avoid tight loops
      const now = Date.now();
      if (now - lastRefreshFailureAt < REFRESH_COOLDOWN_MS) {
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = null;
          window.dispatchEvent(new CustomEvent('auth-failed'));
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // If a refresh is already in-flight, wait for it
        if (isRefreshing && refreshPromise) {
          const { access_token } = await refreshPromise;
          if (access_token) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        } else {
          // Start a new coordinated refresh
          isRefreshing = true;
          refreshPromise = (async () => {
            const resp = await api.post('/api/v1/auth/refresh', {}, { withCredentials: true });
            return resp.data || {};
          })();

          const { access_token } = await refreshPromise;
          isRefreshing = false;
          refreshPromise = null;

          if (access_token) {
            if (typeof window !== 'undefined') {
              window.__vstAccessToken = access_token;
            }
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // Mark cooldown and broadcast auth-failed, and call backend logout to clear cookies
        lastRefreshFailureAt = Date.now();
        refreshDisabled = true;
        isRefreshing = false;
        refreshPromise = null;
        if (typeof window !== 'undefined') {
          window.__vstAccessToken = null;
          window.dispatchEvent(new CustomEvent('auth-failed'));
        }
        try {
          await api.post('/api/v1/auth/logout');
        } catch (_) {}
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => api.post('/api/v1/auth/login', data),
  register: (data) => api.post('/api/v1/auth/register', data),
  getProfile: () => api.get('/api/v1/auth/me'),
  refreshToken: (data) => api.post('/api/v1/auth/refresh', data),
  logout: () => api.post('/api/v1/auth/logout')
};

// Documents API
export const documentsAPI = {
  upload: (formData) => {
    return api.post('/api/v1/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  list: (params) => api.get('/api/v1/documents/', { params }),
  get: (id) => api.get(`/api/v1/documents/${id}`),
  update: (id, data) => {
    return api.put(`/api/v1/documents/${id}`, data);
  },
  delete: (id) => api.delete(`/api/v1/documents/${id}`)
};

// Signatures API
export const signaturesAPI = {
  create: (data) => api.post('/api/v1/signatures/', data),
  list: (params) => api.get('/api/v1/signatures/', { params }),
  get: (id) => api.get(`/api/v1/signatures/${id}`),
  delete: (id, reason) => api.delete(`/api/v1/signatures/${id}`, { data: { deletion_reason: reason } }),
  restore: (id) => api.post(`/api/v1/signatures/${id}/restore`),
  verify: (id) => api.get(`/api/v1/signatures/${id}/verify`),
  verifyLegal: (id) => api.get(`/api/v1/signatures/${id}/verify-legal`),
  verifyHybrid: (id) => api.get(`/api/v1/signatures/${id}/verify-hybrid`),
  getLevels: () => api.get('/api/v1/signatures/levels'),
  createHybrid: (data) => api.post('/api/v1/signatures/hybrid', data),
  signDocument: (data) => api.post('/api/v1/signatures/sign-document', data),
  templates: {
    create: (data) => api.post('/api/v1/signatures/templates', data),
    list: () => api.get('/api/v1/signatures/templates'),
    update: (id, data) => api.put(`/api/v1/signatures/templates/${id}`, data),
    delete: (id) => api.delete(`/api/v1/signatures/templates/${id}`)
  },
  // Admin endpoints
  admin: {
    listAll: (params) => api.get('/api/v1/signatures/admin/all', { params }),
    get: (id) => api.get(`/api/v1/signatures/admin/${id}`),
    restore: (id) => api.post(`/api/v1/signatures/admin/${id}/restore`)
  }
};

// Workflows API
export const workflowsAPI = {
  create: (data) => api.post('/api/v1/workflows/', data),
  list: (params) => api.get('/api/v1/workflows/', { params }),
  get: (id) => api.get(`/api/v1/workflows/${id}`),
  update: (id, data) => api.put(`/api/v1/workflows/${id}`, data),
  delete: (id) => api.delete(`/api/v1/workflows/${id}`),
  addStep: (workflowId, data) => api.post(`/api/v1/workflows/${workflowId}/steps`, data),
  addParticipant: (workflowId, data) => api.post(`/api/v1/workflows/${workflowId}/participants`, data),
  removeParticipant: (workflowId, participantId) => api.delete(`/api/v1/workflows/${workflowId}/participants/${participantId}`),
  send: (workflowId) => api.post(`/api/v1/workflows/${workflowId}/send`),
  cancel: (workflowId) => api.post(`/api/v1/workflows/${workflowId}/cancel`)
};

// Users API
export const usersAPI = {
  list: (params) => api.get('/api/v1/users/', { params }),
  get: (id) => api.get(`/api/v1/users/${id}`),
  updateRole: (id, role) => api.patch(`/api/v1/users/${id}/role`, { role }),
  deactivate: (id) => api.post(`/api/v1/users/${id}/deactivate`),
  reactivate: (id) => api.post(`/api/v1/users/${id}/reactivate`),
  delete: (id) => api.delete(`/api/v1/users/${id}`),
};

// Invites API
export const invitesAPI = {
  create: (email, role) => api.post('/api/v1/invites/', { email, role }),
  list: () => api.get('/api/v1/invites/'),
  revoke: (id) => api.delete(`/api/v1/invites/${id}`),
};

// Public Signing API
export const publicSigningAPI = {
  createDocument: (data) => api.post('/api/v1/public/documents', data),
  listDocuments: (params) => api.get('/api/v1/public/documents', { params }),
  getSigningPage: (publicId, params) => api.get(`/api/v1/public/sign/${publicId}`, { params }),
  signDocument: (publicId, data) => api.post(`/api/v1/public/sign/${publicId}/sign`, data),
  getPricing: () => api.get('/api/v1/public/pricing')
};

// Billing API
export const billingAPI = {
  getSubscription: () => api.get('/api/v1/billing/subscription'),
  updateSubscription: (data) => api.put('/api/v1/billing/subscription', data),
  getUsage: () => api.get('/api/v1/billing/usage'),
  getPayments: (params) => api.get('/api/v1/billing/payments', { params }),
  getBillingInfo: () => api.get('/api/v1/billing/billing-info'),
  getPricingPlans: () => api.get('/api/v1/public/pricing')
};

export default api;
