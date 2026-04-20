const API_BASE = "http://127.0.0.1:8000";

/* ================= TOKEN HELPERS ================= */

export function setToken(token) {
  if (token) localStorage.setItem("accessToken", token);
  else localStorage.removeItem("accessToken");
}

export function setRefreshToken(token) {
  if (token) localStorage.setItem("refreshToken", token);
  else localStorage.removeItem("refreshToken");
}

export function clearSession() {
  setToken(null);
  setRefreshToken(null);
}

export function getToken() {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    const legacy = localStorage.getItem("access");
    if (legacy) {
      localStorage.setItem("accessToken", legacy);
      localStorage.removeItem("access");
      return legacy;
    }
  }
  return token;
}

export function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

export function roleHomePath(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "superadmin") return "/superadmin";
  if (normalized === "admin") return "/admin";
  return "/dashboard";
}

/* ================= CORE FETCH ================= */

export async function apiFetch(path, options = {}, retry = true, config = {}) {
  const { skipAuth = false, skipRefresh = false } = config;
  const headers = options.headers ? { ...options.headers } : {};
  headers["Content-Type"] = "application/json";

  const token = getToken();
  if (!skipAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (res.status === 401 && retry && !skipRefresh) {
    const refresh = getRefreshToken();

    if (!refresh) {
      clearSession();
      throw new Error("Session expired. Please login again.");
    }

    const refreshRes = await fetch(`${API_BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!refreshRes.ok) {
      clearSession();
      throw new Error("Session expired. Please login again.");
    }

    const refreshData = await refreshRes.json();
    setToken(refreshData.access);

    return apiFetch(path, options, false, config);
  }

  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.error ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

