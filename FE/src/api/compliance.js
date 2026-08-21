import { request } from './client';

function qs(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {params.set(key, value);}
  });
  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

export const complianceApi = {
  overview: () => request('/compliance/overview'),
  operationLogs: (filters) => request(`/operations/logs${qs(filters)}`),
  incidents: (filters) => request(`/operations/incidents${qs(filters)}`),
};
