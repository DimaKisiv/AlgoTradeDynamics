import { request } from "./client";

export function listBots() {
  return request("/bots");
}

export function getBot(id) {
  return request(`/bots/${id}`);
}

export function createBot(payload) {
  return request("/bots", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBot(id, payload) {
  return request(`/bots/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteBot(id) {
  return request(`/bots/${id}`, {
    method: "DELETE",
  });
}

export function startBot(id) {
  return request(`/bots/${id}/start`, {
    method: "POST",
  });
}

export function stopBot(id) {
  return request(`/bots/${id}/stop`, {
    method: "POST",
  });
}

export function syncBot(id) {
  return request(`/bots/${id}/sync`, {
    method: "POST",
  });
}

export function listBotOrders(id) {
  return request(`/bots/${id}/orders`);
}

export function listBotEvents(id) {
  return request(`/bots/${id}/events`);
}

export function cancelBotOrders(id) {
  return request(`/bots/${id}/cancel-orders`, {
    method: "POST",
  });
}

export function clearBotHistory(id) {
  return request(`/bots/${id}/clear-history`, {
    method: "POST",
  });
}

export function getBotPosition(id) {
  return request(`/bots/${id}/position`);
}

export function getBotRisk(id) {
  return request(`/bots/${id}/risk`);
}

export function closeBotPosition(id, payload) {
  return request(`/bots/${id}/close-position`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
