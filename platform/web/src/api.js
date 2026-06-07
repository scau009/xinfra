import { getToken } from './auth';

const BASE = '';

async function request(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('plat_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error);
  }
  return res.json();
}

export const api = {
  // Auth
  getLoginUrl: (provider = 'github') => request(`/api/auth/${provider}`),
  getMe: () => request('/api/auth/me'),

  // Projects
  listProjects: () => request('/api/projects'),
  createProject: (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id) => request(`/api/projects/${id}`),
  deployProject: (id) => request(`/api/projects/${id}/deploy`, { method: 'POST' }),
  stopProject: (id) => request(`/api/projects/${id}/stop`, { method: 'POST' }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Deploys
  getDeploy: (id) => request(`/api/deploys/${id}`),
};
