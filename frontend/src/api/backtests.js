/**
 * API client for AlgoTradeDynamics backend.
 * All requests go through a single fetch wrapper for consistent error handling.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

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

// ----- Strategies -----

export function fetchStrategies() {
  return request('/strategies');
}

// ----- Backtests -----

export function startBacktest(payload) {
  return request('/backtests/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listBacktests() {
  return request('/backtests');
}

export function getBacktest(id) {
  return request(`/backtests/${id}`);
}

export function deleteBacktest(id) {
  return request(`/backtests/${id}`, { method: 'DELETE' });
}

export { ApiError, API_BASE_URL };
