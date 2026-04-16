import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { hasSession, logout } from "../services/authService";
import { getCurrentUser } from "../services/userService";

const AuthContext = createContext({
  user: null,
  loading: false,
  refreshUser: async () => null,
  logoutUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!hasSession()) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const me = await getCurrentUser();
      setUser(me || null);
      return me || null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logoutUser = useCallback(() => {
    logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshUser, logoutUser }),
    [user, loading, refreshUser, logoutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
