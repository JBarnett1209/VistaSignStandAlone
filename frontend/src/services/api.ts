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
  login: (data: { email: string; password: string }) =>
    api.post('/api/v1/auth/login', data),
  
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    company?: string;
    job_title?: string;
  }) => api.post('/api/v1/auth/register', data),
  
  getProfile: () => api.get('/api/v1/auth/me'),
  
  refreshToken: (data: { refresh_token: string }) =>
    api.post('/api/v1/auth/refresh', data),
  
  logout: () => api.post('/api/v1/auth/logout')
};

// Documents API
export const documentsAPI = {
  upload: (formData: FormData) =>
    api.post('/api/v1/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  list: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    document_type?: string;
    search?: string;
  }) => api.get('/api/v1/documents/', { params }),
  
  get: (id: string) => api.get(`/api/v1/documents/${id}`),
  
  update: (id: string, data: { title?: string; description?: string }) =>
    api.put(`/api/v1/documents/${id}`, data),
  
  delete: (id: string) => api.delete(`/api/v1/documents/${id}`)
};

// Signatures API
export const signaturesAPI = {
  create: (data: {
    document_id: string;
    signature_data?: string;
    signature_image?: string;
    signature_position?: any;
    signing_reason?: string;
    signing_location?: string;
  }) => api.post('/api/v1/signatures/', data),
  
  list: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    document_id?: string;
  }) => api.get('/api/v1/signatures/', { params }),
  
  get: (id: string) => api.get(`/api/v1/signatures/${id}`),
  
  templates: {
    create: (data: {
      name: string;
      description?: string;
      template_data: any;
      signature_style: string;
    }) => api.post('/api/v1/signatures/templates', data),
    
    list: () => api.get('/api/v1/signatures/templates')
  }
};

// Workflows API
export const workflowsAPI = {
  create: (data: {
    name: string;
    description?: string;
    workflow_data: any;
    document_id: string;
  }) => api.post('/api/v1/workflows/', data),
  
  list: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    document_id?: string;
  }) => api.get('/api/v1/workflows/', { params }),
  
  get: (id: string) => api.get(`/api/v1/workflows/${id}`),
  
  addStep: (workflowId: string, data: {
    step_name: string;
    step_type: string;
    step_order: number;
    step_data: any;
    is_required?: boolean;
    is_parallel?: boolean;
    assigned_to?: string;
    due_date?: string;
  }) => api.post(`/api/v1/workflows/${workflowId}/steps`, data),
  
  addParticipant: (workflowId: string, data: {
    user_id: string;
    role: string;
    permissions?: any;
  }) => api.post(`/api/v1/workflows/${workflowId}/participants`, data)
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/api/v1/users/profile'),
  
  updateProfile: (data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    company?: string;
    job_title?: string;
    signature_style?: string;
    signature_image?: string;
  }) => api.put('/api/v1/users/profile', data),
  
  list: (params?: {
    skip?: number;
    limit?: number;
    role?: string;
    status?: string;
    search?: string;
  }) => api.get('/api/v1/users/', { params })
};

// Public Signing API
export const publicSigningAPI = {
  createDocument: (data: {
    title: string;
    description?: string;
    document_url: string;
    sender_name: string;
    sender_email: string;
    sender_company?: string;
    requires_signature?: boolean;
    allow_decline?: boolean;
    allow_forward?: boolean;
    reminder_frequency?: number;
    expires_at?: string;
    access_code?: string;
    recipients: Array<{
      name: string;
      email: string;
      role?: string;
      order?: number;
      custom_fields?: any;
    }>;
  }) => api.post('/api/v1/public/documents', data),
  
  listDocuments: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }) => api.get('/api/v1/public/documents', { params }),
  
  getSigningPage: (publicId: string, params?: {
    access_token?: string;
    access_code?: string;
  }) => api.get(`/api/v1/public/sign/${publicId}`, { params }),
  
  signDocument: (publicId: string, data: {
    access_token: string;
    signature_data?: string;
    signature_image?: string;
    signature_position?: any;
    signing_reason?: string;
    signing_location?: string;
  }) => api.post(`/api/v1/public/sign/${publicId}/sign`, data),
  
  getPricing: () => api.get('/api/v1/public/pricing')
};

// Billing API
export const billingAPI = {
  getSubscription: () => api.get('/api/v1/billing/subscription'),
  
  updateSubscription: (data: {
    tier?: string;
    billing_cycle?: string;
  }) => api.put('/api/v1/billing/subscription', data),
  
  getUsage: () => api.get('/api/v1/billing/usage'),
  
  getPayments: (params?: {
    skip?: number;
    limit?: number;
  }) => api.get('/api/v1/billing/payments', { params }),
  
  getBillingInfo: () => api.get('/api/v1/billing/billing-info'),
  
  getPricingPlans: () => api.get('/api/v1/public/pricing')
};

export default api;
