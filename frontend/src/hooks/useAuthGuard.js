import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, clearSession, getToken } from "../services/api";

export default function useAuthGuard(allowedRoles = null) {
  const nav = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearSession();
      nav("/login");
      return;
    }

    (async () => {
      try {
        const me = await apiFetch("/api/auth/me/");
        setUser(me);

        if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
          const role = String(me?.role || "").toLowerCase();
          const allowed = allowedRoles.map((r) => String(r).toLowerCase());
          if (!allowed.includes(role)) {
            nav(role === "admin" || role === "superadmin" ? "/admin" : "/dashboard");
          }
        }
      } catch {
        clearSession();
        nav("/login");
      }
    })();
  }, [allowedRoles, nav]);

  return user;
}
