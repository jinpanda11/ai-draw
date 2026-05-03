const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { ...options.headers };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body instanceof FormData
      ? options.body
      : options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    // If 401, clear token and redirect to login
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.hash = '#login';
    }
    throw new Error(data.error || `请求失败 (${res.status})`);
  }

  return data;
}

export const api = {
  // Auth
  sendCode: (email) =>
    request('/auth/send-code', { method: 'POST', body: { email } }),

  register: (email, code, password) =>
    request('/auth/register', { method: 'POST', body: { email, code, password } }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),

  getVerificationSetting: () =>
    request('/auth/verification-setting'),

  adminLogin: (email, password) =>
    request('/auth/admin-login', { method: 'POST', body: { email, password } }),

  // User
  getMe: () => request('/user/me'),

  getQuota: () => request('/user/quota'),

  // Generate
  generate: (params) =>
    request('/generate', { method: 'POST', body: params }),

  getResult: (taskId) =>
    request('/generate/result', { method: 'POST', body: { taskId } }),

  // Upload
  upload: (file) => {
    const form = new FormData();
    form.append('image', file);
    return request('/upload', { method: 'POST', body: form });
  },

  // History
  getHistory: () => request('/history'),

  deleteHistory: (id) =>
    request(`/history/${id}`, { method: 'DELETE' }),

  // Announcements
  getAnnouncements: () => request('/announcements'),

  getActiveAnnouncement: () => request('/announcements/active'),

  // Admin
  adminStats: () => request('/admin/stats'),
  createAnnouncement: (title, content) =>
    request('/admin/announcements', { method: 'POST', body: { title, content } }),
  updateAnnouncement: (id, data) =>
    request(`/admin/announcements/${id}`, { method: 'PUT', body: data }),
  deleteAnnouncement: (id) =>
    request(`/admin/announcements/${id}`, { method: 'DELETE' }),
  updateSetting: (key, value) =>
    request('/admin/settings', { method: 'PUT', body: { key, value } }),

  // Admin - API settings
  getApiSettings: () => request('/admin/api-settings'),
  updateApiSettings: (apiKey, urls) =>
    request('/admin/api-settings', { method: 'PUT', body: { apiKey, urls } }),

  // Admin - models
  getModels: () => request('/admin/models'),
  createModel: (data) =>
    request('/admin/models', { method: 'POST', body: data }),
  updateModel: (id, data) =>
    request(`/admin/models/${id}`, { method: 'PUT', body: data }),
  deleteModel: (id) =>
    request(`/admin/models/${id}`, { method: 'DELETE' }),
  toggleModel: (id) =>
    request(`/admin/models/${id}/toggle`, { method: 'PUT' }),

  // Public - active models & config
  getActiveModels: () => request('/models'),
  getPublicConfig: () => request('/public-config'),
};
