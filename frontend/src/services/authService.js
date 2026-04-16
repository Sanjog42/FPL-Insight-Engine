import { apiFetch, clearSession, getRefreshToken, getToken, setRefreshToken, setToken } from "./api";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function roleHomePath(role) {
  const normalized = normalizeRole(role);
  if (normalized === "superadmin") return "/superadmin";
  if (normalized === "admin") return "/admin";
  return "/dashboard";
}

export async function login({ username, password }) {
  const tokenData = await apiFetch("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username: username.trim(), password }),
  });

  const accessToken = tokenData.access || tokenData.token;
  if (!accessToken) {
    throw new Error("Login response missing token");
  }

  setToken(accessToken);
  if (tokenData.refresh) {
    setRefreshToken(tokenData.refresh);
  }

  return tokenData;
}

export async function register(payload) {
  return apiFetch("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function forgotPassword(payload) {
  return apiFetch("/api/auth/forgot-password/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  clearSession();
}

export function hasSession() {
  return Boolean(getToken() || getRefreshToken());
}
