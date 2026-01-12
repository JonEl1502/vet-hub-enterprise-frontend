/**
 * API Service for VetHub Enterprise
 * Connects frontend to the Express.js backend
 *
 * @deprecated This file is deprecated. Please use the new API structure:
 * - Import from '../services' instead of '../services/api'
 * - New structure provides better error handling, caching, and loading states
 * - See services/index.ts for available exports
 *
 * This file is kept for backward compatibility during migration.
 * It will be removed in a future version.
 */

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Helper function to make API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Get token from localStorage if available
  const token = localStorage.getItem('authToken');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Skip clinic headers for authentication endpoints
  // Auth endpoints don't require clinic context
  const isAuthEndpoint = endpoint.startsWith('/auth/');

  if (!isAuthEndpoint) {
    // Get selected clinic(s) from localStorage and add to headers
    const selectedClinicIds = localStorage.getItem('selectedClinicIds');
    if (selectedClinicIds) {
      try {
        const clinicIds: string[] = JSON.parse(selectedClinicIds);
        if (clinicIds.length === 1) {
          defaultHeaders['X-Clinic-Id'] = clinicIds[0];
        } else if (clinicIds.length > 1) {
          defaultHeaders['X-Clinic-Ids'] = clinicIds.join(',');
        }
      } catch (error) {
        console.error('Failed to parse selected clinic IDs:', error);
      }
    }
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Include cookies for session management
  };

  const response = await fetch(url, config);
  return handleResponse<T>(response);
}

// ============================================
// Authentication API
// ============================================

export const authAPI = {
  // Login with email/password
  login: async (email: string, password: string) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Signup with user and clinic data
  signup: async (userData: any, clinicData: any) => {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ user: userData, clinic: clinicData }),
    });
  },

  // Forgot password - Request reset link
  forgotPassword: async (email: string) => {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Reset password with token
  resetPassword: async (token: string, password: string) => {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  // Get current user
  getCurrentUser: async () => {
    return apiRequest('/auth/me', {
      method: 'GET',
    });
  },

  // Logout
  logout: async () => {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },

  // Refresh token
  refreshToken: async () => {
    return apiRequest('/auth/refresh', {
      method: 'POST',
    });
  },

  // Google OAuth - Redirect to Google login
  googleLogin: () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  },
};

// ============================================
// Users API
// ============================================

export const usersAPI = {
  getAll: () => apiRequest('/users'),
  getById: (id: number) => apiRequest(`/users/${id}`),
  create: (data: any) => apiRequest('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
};

// ============================================
// Clinics API
// ============================================

export const clinicsAPI = {
  // Get user's accessible clinics with full details
  getUserClinics: () => apiRequest('/clinics/user-clinics'),

  // Admin endpoints
  getAll: () => apiRequest('/clinics'),
  getById: (id: number) => apiRequest(`/clinics/${id}`),
  create: (data: any) => apiRequest('/clinics', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiRequest(`/clinics/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiRequest(`/clinics/${id}`, { method: 'DELETE' }),
};

// ============================================
// Clients API
// ============================================

export const clientsAPI = {
  getAll: () => apiRequest('/clients'),
  getById: (id: number) => apiRequest(`/clients/${id}`),
  create: (data: any) => apiRequest('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiRequest(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiRequest(`/clients/${id}`, { method: 'DELETE' }),
  getTransactions: (clientId: number) => apiRequest(`/clients/${clientId}/transactions`),
};

// ============================================
// Pets API
// ============================================

export const petsAPI = {
  getAll: () => apiRequest('/pets'),
  getById: (id: number) => apiRequest(`/pets/${id}`),
  create: (data: any) => apiRequest('/pets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiRequest(`/pets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiRequest(`/pets/${id}`, { method: 'DELETE' }),
  getTransactions: (petId: number) => apiRequest(`/pets/${petId}/transactions`),
};

// ============================================
// Appointments API
// ============================================

export const appointmentsAPI = {
  getAll: () => apiRequest('/appointments'),
  getById: (id: number) => apiRequest(`/appointments/${id}`),
  create: (data: any) => apiRequest('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiRequest(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiRequest(`/appointments/${id}`, { method: 'DELETE' }),
  updateTask: (appointmentId: number, taskId: number, data: any) => apiRequest(`/appointments/${appointmentId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  addTask: (appointmentId: number, data: any) => apiRequest(`/appointments/${appointmentId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  processPayment: (appointmentId: number, data: any) => apiRequest(`/appointments/${appointmentId}/payment`, { method: 'POST', body: JSON.stringify(data) }),
};

// ============================================
// Transactions API
// ============================================

export const transactionsAPI = {
  getAll: () => apiRequest('/transactions'),
};

// Export API base URL for reference
export { API_BASE_URL };

