const EMULATOR_BASE_URL =
  import.meta.env.VITE_EMULATOR_BASE_URL || "http://localhost:8001";

async function emulatorRequest(path, options = {}) {
  const response = await fetch(`${EMULATOR_BASE_URL}${path}`, options);
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || body.message || JSON.stringify(body);
    } catch {
      // Keep HTTP status text.
    }
    throw new Error(detail);
  }
  if (response.status === 204) {return null;}
  return response.json();
}

function jsonOptions(method, payload) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export const emulatorApi = {
  health: () => emulatorRequest("/health"),
  accounts: () => emulatorRequest("/api/admin/accounts"),
  createAccount: (payload) => emulatorRequest("/api/admin/accounts", jsonOptions("POST", payload)),
  fundAccount: (id, amount) => emulatorRequest(`/api/admin/accounts/${id}/fund`, jsonOptions("POST", { amount })),
  resetAccount: (id, balance = null) => emulatorRequest(`/api/admin/accounts/${id}/reset`, jsonOptions("POST", { balance })),
  deleteAccount: (id) => emulatorRequest(`/api/admin/accounts/${id}`, { method: "DELETE" }),

  markets: () => emulatorRequest("/api/admin/markets"),
  dashboard: (accountId, symbol) => emulatorRequest(`/api/admin/dashboard?account_id=${accountId}&symbol=${encodeURIComponent(symbol)}`),
  setPrice: (symbol, price, markPrice = null) => emulatorRequest(`/api/admin/markets/${symbol}/price`, jsonOptions("POST", { price, mark_price: markPrice })),
  movePrice: (symbol, targetPrice, durationSeconds) => emulatorRequest(`/api/admin/markets/${symbol}/move`, jsonOptions("POST", { target_price: targetPrice, duration_seconds: durationSeconds })),
  pauseMarket: (symbol) => emulatorRequest(`/api/admin/markets/${symbol}/pause`, { method: "POST" }),
  resumeMarket: (symbol) => emulatorRequest(`/api/admin/markets/${symbol}/resume`, { method: "POST" }),
  stopMarket: (symbol) => emulatorRequest(`/api/admin/markets/${symbol}/stop`, { method: "POST" }),

  scenarios: (symbol = "") => emulatorRequest(`/api/admin/scenarios${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`),
  createScenario: (payload) => emulatorRequest("/api/admin/scenarios", jsonOptions("POST", payload)),
  deleteScenario: (id) => emulatorRequest(`/api/admin/scenarios/${id}`, { method: "DELETE" }),
  startScenario: (id) => emulatorRequest(`/api/admin/scenarios/${id}/start`, { method: "POST" }),
  restartScenario: (id) => emulatorRequest(`/api/admin/scenarios/${id}/restart`, { method: "POST" }),
  stepScenario: (symbol) => emulatorRequest(`/api/admin/markets/${symbol}/scenario-step`, { method: "POST" }),

  datasets: () => emulatorRequest("/api/admin/historical/datasets"),
  downloadHistorical: (payload) => emulatorRequest("/api/admin/historical/download", jsonOptions("POST", payload)),
  importHistorical: (symbol, interval, file, name = "") => {
    const body = new FormData();
    body.append("file", file);
    const query = new URLSearchParams({ symbol, interval });
    if (name.trim()) query.set("name", name.trim());
    return emulatorRequest(`/api/admin/historical/import-csv?${query.toString()}`, {
      method: "POST",
      body,
    });
  },
  datasetRangeStats: (datasetId, startTime, endTime) => emulatorRequest(`/api/admin/historical/datasets/${datasetId}/range-stats?start_time=${startTime}&end_time=${endTime}`),
  deleteHistorical: (datasetId) => emulatorRequest(`/api/admin/historical/datasets/${datasetId}`, { method: "DELETE" }),
  startReplay: (symbol, payload) => emulatorRequest(`/api/admin/markets/${symbol}/replay/start`, jsonOptions("POST", payload)),
  stepReplay: (symbol) => emulatorRequest(`/api/admin/markets/${symbol}/replay/step`, { method: "POST" }),

  orders: (accountId, symbol) => emulatorRequest(`/api/admin/orders?account_id=${accountId}&symbol=${encodeURIComponent(symbol)}&limit=200`),
  positions: (accountId) => emulatorRequest(`/api/admin/positions?account_id=${accountId}`),
  executions: (accountId, symbol) => emulatorRequest(`/api/admin/executions?account_id=${accountId}&symbol=${encodeURIComponent(symbol)}&limit=200`),
  events: (accountId, symbol) => emulatorRequest(`/api/admin/events?account_id=${accountId}&symbol=${encodeURIComponent(symbol)}&limit=200`),
};

export { EMULATOR_BASE_URL };
