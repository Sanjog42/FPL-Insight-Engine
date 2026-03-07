import { Link, useNavigate } from "react-router-dom";
import { setToken, setRefreshToken } from "../services/api";

export default function AppLayout({ title, subtitle, children }) {
  const nav = useNavigate();

  function logout() {
    setToken(null);
    setRefreshToken(null);
    nav("/login");
  }

  return (
    <div className="app">
      <main className="content dashboard-shell">
        {/* Header (same as Dashboard) */}
        <header className="page-header">
          <div className="page-title">
            <span className="page-title-accent">FPL</span> Insight Engine
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link to="/dashboard" className="profile-pill">
              <span className="profile-avatar">FM</span>
              <span className="profile-name">fpl_manager_2024</span>
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
