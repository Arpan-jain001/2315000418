import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_API_URL || "http://localhost:5000",
});

export async function fetchNotifications({ limit = 10, page = 1, type = "" } = {}) {
  const params = { limit, page };
  if (type) params.notification_type = type;

  const token = localStorage.getItem("notificationApiToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const { data } = await api.get("/api/notifications", { params, headers });
  return data.notifications || [];
}
