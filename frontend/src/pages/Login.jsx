import { Link, useNavigate } from "react-router-dom";
import { apiFetch, setToken, setRefreshToken } from "../services/api";
import { useState } from "react";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function rolePath(role) {
  const r = normalizeRole(role);
  if (r === "superadmin") return "/superadmin";
  if (r === "admin") return "/admin";
  return "/dashboard";
}

export default function Login() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const tokenData = await apiFetch("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({
          username: identifier.trim(),
          password,
        }),
      });

      const accessToken = tokenData.access || tokenData.token;
      if (!accessToken) {
        throw new Error("Login response missing token");
      }

      setToken(accessToken);
      if (tokenData.refresh) {
        setRefreshToken(tokenData.refresh);
      }

      if (tokenData.role) {
        nav(rolePath(tokenData.role));
        return;
      }

      const me = await apiFetch("/api/auth/me/");
      nav(rolePath(me?.role));
    } catch (ex) {
      setErr(ex?.message || "Login failed. Please check username/password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app auth-page">
      <div className="auth-background"></div>

      <header className="navbar">
        <div className="navbar-title">? FPL Insight Engine</div>
        <div className="navbar-actions">
          <a
            href="#"
            className="btn btn-outline"
            onClick={(e) => e.preventDefault()}
          >
            Home
          </a>
          <Link to="/register" className="btn btn-accent">
            Register
          </Link>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-wrapper">
          <div className="auth-visual">
            <div className="auth-visual-content">
              <div className="football-icon">?</div>
              <h1 className="auth-title">Welcome Back!</h1>
              <p className="auth-subtitle">
                Sign in as a user or administrator. The system will automatically
                route you to the correct dashboard.
              </p>
              <div className="auth-features">
                <div className="auth-feature-item">
                  <span className="feature-icon">??</span>
                  <span>User: Access analytics dashboard</span>
                </div>
                <div className="auth-feature-item">
                  <span className="feature-icon">??</span>
                  <span>Admin: Manage system & users</span>
                </div>
                <div className="auth-feature-item">
                  <span className="feature-icon">??</span>
                  <span>Same login page for both roles</span>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-form-container">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <h2 className="h2">Login</h2>
                <p className="text-muted">
                  Sign in to your FPL Insight account (User or Admin)
                </p>
              </div>

              {err ? (
                <p style={{ color: "#ef4444", marginTop: 0 }}>{err}</p>
              ) : null}

              <form className="auth-form" onSubmit={onSubmit}>
                <div className="form-group">
                  <label className="label">
                    <span>??</span> Email / Username
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    <span>??</span> Password
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="form-helper">
                    <a
                      href="#"
                      className="text-accent"
                      style={{ fontSize: "0.85rem" }}
                      onClick={(e) => e.preventDefault()}
                    >
                      Forgot password?
                    </a>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: "1.5rem" }}>
                  <button
                    type="submit"
                    className="btn btn-accent"
                    style={{ width: "100%", fontSize: "1rem", padding: "0.85rem" }}
                    disabled={loading}
                  >
                    {loading ? "Logging in..." : "?? Login"}
                  </button>
                </div>
              </form>

              <p className="auth-footer">
                <span className="text-muted">New to FPL Insight?</span>{" "}
                <Link to="/register" className="text-accent">
                  Create your account ?
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
