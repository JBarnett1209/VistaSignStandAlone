import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          const { access_token, refresh_token: new_refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', new_refresh_token);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
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
  getProfile: () => api.get('/api/v1/users/profile'),
  
  updateProfile: (data) => api.put('/api/v1/users/profile', data),
  
  list: (params) => api.get('/api/v1/users/', { params })
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
