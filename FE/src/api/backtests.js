import { request } from "./client";

export const backtestsApi = {
  list: () => request("/backtests"),
  datasets: () => request("/backtests/datasets"),
  get: (id) => request(`/backtests/${id}`),
  create: (payload) => request("/backtests", { method: "POST", body: JSON.stringify(payload) }),
  remove: (id) => request(`/backtests/${id}`, { method: "DELETE" }),
  pause: (id) => request(`/backtests/${id}/pause`, { method: "POST" }),
  resume: (id) => request(`/backtests/${id}/resume`, { method: "POST" }),
  cancel: (id) => request(`/backtests/${id}/cancel`, { method: "POST" }),
  points: (id) => request(`/backtests/${id}/points`),
  cycles: (id) => request(`/backtests/${id}/cycles`),
  orders: (id) => request(`/backtests/${id}/orders`),
  executions: (id) => request(`/backtests/${id}/executions`),
  events: (id) => request(`/backtests/${id}/events`),
};
