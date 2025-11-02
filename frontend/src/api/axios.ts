/**
 * Shared axios instance with authentication interceptors
 * This ensures all API calls automatically include the auth token
 */
import axios, { AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

/**
 * Create a configured axios instance with auth interceptors
 */
export const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to attach auth token
  instance.interceptors.request.use(
    (config) => {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
        console.log(`📤 [Axios] ${config.method?.toUpperCase()} ${config.url} - Request with auth token`);
      } else {
        console.log(`📤 [Axios] ${config.method?.toUpperCase()} ${config.url} - Request without auth token`);
      }
      return config;
    },
    (error) => {
      console.error('❌ [Axios] Request error:', error);
      return Promise.reject(error);
    },
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => {
      console.log(`📥 [Axios] ${response.config.method?.toUpperCase()} ${response.config.url} - Response ${response.status}`);
      return response;
    },
    (error) => {
      const message = error.response?.data?.message || error.response?.data?.error || 'Unexpected error';
      console.error(`❌ [Axios] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Error ${error.response?.status}:`, message);
      throw new Error(message);
    },
  );

  return instance;
};

export const apiClient = createApiInstance();

