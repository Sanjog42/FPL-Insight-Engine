import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, clearSession, getToken } from "../services/api";

export default function useAuthGuard(allowedRoles = null) {
  const nav = useNavigate();
  const [user, setUser] = useState(null);

  const allowed = useMemo(() => {
    if (!Array.isArray(allowedRoles)) return [];
    return allowedRoles.map((r) => String(r).toLowerCase());
  }, [allowedRoles]);

  const allowedKey = allowed.join("|");

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

        if (allowed.length > 0) {
          const role = String(me?.role || "").toLowerCase();
          if (!allowed.includes(role)) {
            nav(role === "admin" || role === "superadmin" ? "/admin" : "/dashboard");
          }
        }
      } catch {
        clearSession();
        nav("/login");
      }
    })();
  }, [nav, allowedKey]);

  return user;
}
