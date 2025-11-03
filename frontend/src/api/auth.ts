import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

export const login = async (username: string, password: string) => {
  console.log('📡 [API] POST /auth/login - Request sent', { username: username.replace(/\S(?=\S{3})/g, '*') });
  const res = await axios.post(`${API_URL}/auth/login`, { username, password });
  console.log('✅ [API] POST /auth/login - Response received', { hasTokens: !!res.data.access_token });
  return res.data;
};

export const signup = async (name: string, username: string, email: string | undefined, password: string) => {
  console.log('📡 [API] POST /auth/signup - Request sent', { name, username: username.replace(/\S(?=\S{3})/g, '*') });
  const res = await axios.post(`${API_URL}/auth/signup`, { name, username, email, password });
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

// Google OAuth2 - Connect Google account (requires authentication)
export const connectGoogle = async (accessToken: string) => {
  console.log('📡 [API] POST /auth/google/connect - Request sent');
  const res = await axios.post(
    `${API_URL}/auth/google/connect`,
    {},
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  console.log('✅ [API] POST /auth/google/connect - Response received', { hasUrl: !!res.data.url });
  
  // Redirect to the OAuth URL
  if (res.data.url) {
    window.location.href = res.data.url;
  } else {
    throw new Error('No OAuth URL received from server');
  }
};

// Google OAuth2 - Disconnect Google account
export const disconnectGoogle = async (accessToken: string) => {
  console.log('📡 [API] POST /auth/google/disconnect - Request sent');
  const res = await axios.post(
    `${API_URL}/auth/google/disconnect`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  console.log('✅ [API] POST /auth/google/disconnect - Response received');
  return res.data;
};