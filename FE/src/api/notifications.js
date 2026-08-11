/** External notification channel API calls. */
import { request } from './client';

export function fetchTelegramStatus() {
  return request('/notifications/telegram');
}

export function createTelegramConnectLink() {
  return request('/notifications/telegram/connect', { method: 'POST' });
}

export function updateTelegramPreferences(payload) {
  return request('/notifications/telegram', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function sendTelegramTest() {
  return request('/notifications/telegram/test', { method: 'POST' });
}

export function disconnectTelegram() {
  return request('/notifications/telegram', { method: 'DELETE' });
}
