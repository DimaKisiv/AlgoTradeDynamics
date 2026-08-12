import { useEffect, useRef, useState } from "react";

import { API_BASE_URL, getToken, refreshAccessToken } from "../api/client";

function wsBaseUrl() {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}

export function buildApiWebSocketUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${wsBaseUrl()}${normalized}`;
}

export function useAuthenticatedWebSocket(path, { enabled = true, onMessage } = {}) {
  const [status, setStatus] = useState("offline");
  const callbackRef = useRef(onMessage);

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !path) {
      setStatus("offline");
      return undefined;
    }

    let active = true;
    let socket = null;
    let retryTimer = null;
    let retryCount = 0;

    const scheduleReconnect = () => {
      if (!active) return;
      setStatus("reconnecting");
      const delay = Math.min(1000 * (2 ** Math.min(retryCount, 3)), 8000);
      retryCount += 1;
      retryTimer = window.setTimeout(connect, delay);
    };

    const connect = async () => {
      if (!active) return;
      setStatus("reconnecting");

      let token = getToken();
      if (!token) {
        try {
          token = await refreshAccessToken();
        } catch {
          if (active) setStatus("offline");
          return;
        }
      }

      if (!active) return;
      socket = new WebSocket(buildApiWebSocketUrl(path));

      socket.onopen = () => {
        if (active) socket.send(JSON.stringify({ op: "auth", token }));
      };

      socket.onmessage = (event) => {
        if (!active) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }

        if (message.type === "auth.ok") {
          retryCount = 0;
          setStatus("live");
          return;
        }
        if (message.type === "auth.error") {
          socket.close(4401, "Authentication failed");
          return;
        }
        if (message.type === "ping") return;
        callbackRef.current?.(message);
      };

      socket.onerror = () => socket?.close();
      socket.onclose = async (event) => {
        if (!active) return;
        if (event.code === 4403 || event.code === 4404) {
          setStatus("offline");
          return;
        }
        if (event.code === 4401) {
          try {
            await refreshAccessToken();
          } catch {
            if (active) setStatus("offline");
            return;
          }
        }
        scheduleReconnect();
      };
    };

    connect();
    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, "Page changed");
    };
  }, [enabled, path]);

  return status;
}
