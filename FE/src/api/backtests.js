/**
 * API client for AlgoTradeDynamics backtests + strategies.
 * Uses the shared `request` wrapper (auth token + error handling).
 */
import { request, ApiError, API_BASE_URL } from './client';

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
