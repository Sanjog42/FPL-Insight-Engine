import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, clearSession, getSessionUser, getToken, roleHomePath, setSessionUser } from "../services/api";

export default function useAuthGuard(allowedRoles = null) {
  const nav = useNavigate();
  const [user, setUser] = useState(getSessionUser());

  const normalizedRoles = useMemo(() => {
    return Array.isArray(allowedRoles) ? allowedRoles : [];
  }, [allowedRoles]);

  const rolesKey = normalizedRoles.join("|");

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
        setSessionUser(me);
        setUser(me);

        if (normalizedRoles.length > 0 && !normalizedRoles.includes(me?.role)) {
          nav(roleHomePath(me?.role));
        }
      } catch {
        clearSession();
        nav("/login");
      }
    })();
  }, [nav, rolesKey]);

  return user;
}
