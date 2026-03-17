import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch, setToken, setRefreshToken } from "../services/api";

export default function AppLayout({ title, subtitle, children }) {
  const nav = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const me = await apiFetch("/api/auth/me/");
        if (isMounted) setUser(me);
      } catch {
        if (isMounted) setUser(null);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  function logout() {
    setToken(null);
    setRefreshToken(null);
    nav("/login");
  }

  const displayName = user?.full_name?.trim() || user?.username || "User";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "U";

  return (
    <div className="app">
      <main className="content dashboard-shell">
        {/* Header (same as Dashboard) */}
        <header className="page-header">
          <div className="page-title">
            <span className="page-title-accent">FPL</span> Insight Engine
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link to="/dashboard" className="btn btn-outline">
              Back to Dashboard
            </Link>
            <Link to="/profile" className="profile-pill">
              <span className="profile-avatar">{initials}</span>
              <span className="profile-name">{displayName}</span>
            </Link>

            <button className="btn btn-outline" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        {/* Page intro */}
        <section className="section">
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="text-muted">{subtitle}</p>}
        </section>

        {children}
      </main>
    </div>
  );
}
