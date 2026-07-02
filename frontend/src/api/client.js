/**
 * Shared HTTP client for the AlgoTradeDynamics backend.
 * Injects the JWT access token and centralises error / 401 handling.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const TOKEN_KEY = 'atd_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// Callback invoked on any 401 (set by AuthContext) so the app can log the user out.
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    setToken(null);
    if (unauthorizedHandler) unauthorizedHandler();
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || body.message || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new ApiError(
      `Request failed: ${response.status} ${detail}`,
      response.status,
      detail,
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

export { ApiError, API_BASE_URL };
