import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getToken, setToken, setRefreshToken } from "../services/api";

export default function useAuthGuard() {
  const nav = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      nav("/login");
      return;
    }

    (async () => {
      try {
        await apiFetch("/api/auth/me/");
      } catch {
        setToken(null);
        setRefreshToken(null);
        nav("/login");
      }
    })();
  }, [nav]);
}
