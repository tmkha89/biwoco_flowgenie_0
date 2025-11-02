import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

export const login = async (email: string, password: string) => {
  console.log('📡 [API] POST /auth/login - Request sent', { email: email.replace(/\S(?=\S{3})/g, '*') });
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  console.log('✅ [API] POST /auth/login - Response received', { hasTokens: !!res.data.access_token });
  return res.data;
};

export const signup = async (name: string, email: string, password: string) => {
  console.log('📡 [API] POST /auth/signup - Request sent', { name, email: email.replace(/\S(?=\S{3})/g, '*') });
  const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password });
  console.log('✅ [API] POST /auth/signup - Response received', { hasTokens: !!res.data.access_token });
  return res.data;
};

export const refreshToken = async (refreshToken: string) => {
  console.log('📡 [API] POST /auth/refresh - Request sent');
  const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
  console.log('✅ [API] POST /auth/refresh - Response received', { hasAccessToken: !!res.data.access_token });
  return res.data;
};

export const logout = async (refreshToken: string, accessToken: string) => {
  const res = await axios.post(
    `${API_URL}/auth/logout`,
    { refresh_token: refreshToken },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
};

export const getCurrentUser = async (accessToken: string) => {
  console.log('📡 [API] GET /auth/me - Request sent');
  const res = await axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log('✅ [API] GET /auth/me - Response received', { userId: res.data.id, email: res.data.email });
  return res.data;
};

// Google OAuth2 - Exchange Google ID token for application tokens
export const googleLogin = async (token: string) => {
  console.log('📡 [API] POST /auth/google/exchange - Request sent');
  const res = await axios.post(`${API_URL}/auth/google/exchange`, { token });
  console.log('✅ [API] POST /auth/google/exchange - Response received', { hasTokens: !!res.data.access_token });
  return res.data;
};