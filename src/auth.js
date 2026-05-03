import { api } from './api.js';

export const auth = {
  isLoggedIn() {
    return !!localStorage.getItem('token');
  },

  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '#home';
  },

  async refreshUser() {
    try {
      const data = await api.getMe();
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  },
};
