import { request, requestFile } from './client';

export async function downloadMyData() {
  const response = await requestFile('/privacy/export');
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || 'algotradedynamics-my-data.json';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function deleteMyAccount(password) {
  return request('/privacy/delete-account', {
    method: 'POST',
    body: JSON.stringify({ password, confirmation: 'DELETE' }),
  });
}
