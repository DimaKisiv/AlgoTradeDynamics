/**
 * Shared HTTP client for the AlgoTradeDynamics backend.
 * Injects the short-lived JWT access token and transparently refreshes it once on 401.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const TOKEN_KEY = 'atd_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {localStorage.setItem(TOKEN_KEY, token);}
  else {localStorage.removeItem(TOKEN_KEY);}
}

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

let refreshPromise = null;

async function parseError(response) {
  let detail = response.statusText;
  try {
    const body = await response.json();
    detail = body.detail || body.message || JSON.stringify(body);
  } catch {
    /* ignore */
  }
  return new ApiError(
    `Request failed: ${response.status} ${detail}`,
    response.status,
    detail,
  );
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        setToken(null);
        throw await parseError(response);
      }

      const data = await response.json();
      setToken(data.access_token);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function mayRefresh(path) {
  return !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/privacy/delete-account'].includes(path);
}

export async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) {headers.Authorization = `Bearer ${token}`;}

  const fetchOptions = {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  };

  let response = await fetch(url, fetchOptions);

  if (response.status === 401 && mayRefresh(path)) {
    try {
      const newToken = await refreshAccessToken();
      response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    } catch {
      setToken(null);
      if (unauthorizedHandler) {unauthorizedHandler();}
      throw await parseError(response);
    }
  }

  if (response.status === 401 && mayRefresh(path)) {
    setToken(null);
    if (unauthorizedHandler) {unauthorizedHandler();}
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {return null;}
  return response.json();
}

export async function requestFile(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };
  let token = getToken();
  if (token) {headers.Authorization = `Bearer ${token}`;}

  const fetchOptions = { ...options, headers, credentials: options.credentials || 'include' };
  let response = await fetch(url, fetchOptions);

  if (response.status === 401 && mayRefresh(path)) {
    token = await refreshAccessToken();
    response = await fetch(url, {
      ...fetchOptions,
      headers: { ...headers, Authorization: `Bearer ${token}` },
    });
  }

  if (!response.ok) {throw await parseError(response);}
  return response;
}

export { ApiError, API_BASE_URL };
