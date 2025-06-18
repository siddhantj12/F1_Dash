// lib/ api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const getRaces = async (year) => {
  const response = await api.get(`/api/races/${year}`);
  return response.data;
};

export const getTelemetry = async (year, race, session, driver, lap) => {
  const response = await api.get('/api/telemetry', {
    params: { year, race, session, driver, lap }
  });
  return response.data;
};

export const login = async (username, password) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  
  const response = await api.post('/api/token', formData);
  localStorage.setItem('token', response.data.access_token);
  return response.data;
};

export default api;