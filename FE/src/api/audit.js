import { request, requestFile } from "./client";

function queryString(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) params.set(key, value);
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const auditApi = {
  list: (filters) => request(`/audit/events${queryString(filters)}`),
  get: (id) => request(`/audit/events/${id}`),
  integrity: () => request("/audit/integrity"),
  export: async (format, filters = {}) => {
    const response = await requestFile(`/audit/export${queryString({ ...filters, format })}`);
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename=([^;]+)/i);
    const filename = match?.[1]?.replaceAll('"', '') || `audit-trail.${format}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
