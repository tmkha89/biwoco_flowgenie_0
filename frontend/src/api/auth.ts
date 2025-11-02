import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || '';

export const login = async (email: string, password: string) => {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data;
};

export const signup = async (name: string, email: string, password: string) => {
  const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password });
  return res.data;
};

export const refreshToken = async (refreshToken: string) => {
  const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
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
  const res = await axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
};

// // Google OAuth2
// export const googleLogin = async (token: string) => {
//   const res = await axios.post(`${API_URL}/auth/google`, { token })
//   return res.data
// }

export const googleLogin = () => {
  window.location.href = `${API_URL}/auth/google`;
};