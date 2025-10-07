import axios from 'axios';

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
      const csrf = document.cookie.split('; ').find((c) => c.startsWith('vst_csrf='));
      if (csrf) {
        config.headers['X-CSRF-Token'] = csrf.split('=')[1];
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Cookie-based refresh (no body required)
        const response = await api.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const { access_token } = response.data;
        if (access_token) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          if (typeof window !== 'undefined') {
            window.__vstAccessToken = access_token;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        // fall through to reject
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
  upload: (formData) => api.post('/api/v1/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  list: (params) => api.get('/api/v1/documents/', { params }),
  get: (id) => api.get(`/api/v1/documents/${id}`),
  update: (id, data) => api.put(`/api/v1/documents/${id}`, data),
  delete: (id) => api.delete(`/api/v1/documents/${id}`)
};

// Signatures API
export const signaturesAPI = {
  create: (data) => api.post('/api/v1/signatures/', data),
  list: (params) => api.get('/api/v1/signatures/', { params }),
  get: (id) => api.get(`/api/v1/signatures/${id}`),
  templates: {
    create: (data) => api.post('/api/v1/signatures/templates', data),
    list: () => api.get('/api/v1/signatures/templates')
  }
};

// Workflows API
export const workflowsAPI = {
  create: (data) => api.post('/api/v1/workflows/', data),
  list: (params) => api.get('/api/v1/workflows/', { params }),
  get: (id) => api.get(`/api/v1/workflows/${id}`),
  addStep: (workflowId, data) => api.post(`/api/v1/workflows/${workflowId}/steps`, data),
  addParticipant: (workflowId, data) => api.post(`/api/v1/workflows/${workflowId}/participants`, data)
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
  create: (email, role) => api.post('/api/v1/invites', { email, role }),
  list: () => api.get('/api/v1/invites'),
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
