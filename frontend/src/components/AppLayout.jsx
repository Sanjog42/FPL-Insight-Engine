import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, clearSession } from "../services/api";

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
    clearSession();
    nav("/login");
  }

  const role = String(user?.role || "").toLowerCase();
  const backPath = useMemo(() => {
    if (role === "superadmin") return "/superadmin";
    if (role === "admin") return "/admin";
    return "/dashboard";
  }, [role]);

  const backLabel = useMemo(() => {
    if (role === "superadmin") return "Back to SuperAdmin Dashboard";
    if (role === "admin") return "Back to Admin Dashboard";
    return "Back to Dashboard";
  }, [role]);

  const displayName = user?.full_name?.trim() || user?.username || "User";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U";

  return (
    <div className="app">
      <main className="content dashboard-shell">
        <header className="page-header">
          <div className="page-title">
            <span className="page-title-accent">FPL</span> Insight Engine
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link to={backPath} className="btn btn-outline">
              {backLabel}
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

        <section className="section">
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="text-muted">{subtitle}</p>}
        </section>

        {children}
      </main>
    </div>
  );
}
