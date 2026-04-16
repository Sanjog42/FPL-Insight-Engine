import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import LoginForm from "../components/forms/LoginForm";
import { login, roleHomePath } from "../services/authService";
import { getCurrentUser } from "../services/userService";

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
      const tokenData = await login({ username: identifier, password });

      if (tokenData.role) {
        nav(roleHomePath(tokenData.role));
        return;
      }

      const me = await getCurrentUser();
      nav(roleHomePath(me?.role));
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
        <div className="navbar-title">FPL Insight Engine</div>
        <div className="navbar-actions">
          <Link to="/register" className="btn btn-accent">
            Register
          </Link>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-wrapper">
          <div className="auth-visual">
            <div className="auth-visual-content">
              <div className="football-icon">FPL</div>
              <h1 className="auth-title">Welcome Back!</h1>
              <p className="auth-subtitle">
                Sign in as a user or administrator. The system will automatically route you to the correct dashboard.
              </p>
              <div className="auth-features">
                <div className="auth-feature-item">
                  <span className="feature-icon">Insights</span>
                  <span>Explore player form, fixtures, and prediction outputs</span>
                </div>
                <div className="auth-feature-item">
                  <span className="feature-icon">Control</span>
                  <span>Manage player, team, fixture data and run model operations</span>
                </div>
                <div className="auth-feature-item">
                  <span className="feature-icon">Access</span>
                  <span>One secure login with role-based dashboards and permissions</span>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-form-container">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <h2 className="h2">Login</h2>
                <p className="text-muted">Sign in to your FPL Insight account</p>
              </div>

              <LoginForm
                identifier={identifier}
                password={password}
                onIdentifierChange={setIdentifier}
                onPasswordChange={setPassword}
                onSubmit={onSubmit}
                error={err}
                loading={loading}
              />

              <p className="auth-footer">
                <Link to="/forgot-password" className="text-accent">
                  Forgot password?
                </Link>
              </p>

              <p className="auth-footer" style={{ marginTop: "0.75rem", paddingTop: "0.75rem" }}>
                <span className="text-muted">New to FPL Insight?</span>{" "}
                <Link to="/register" className="text-accent">
                  Create your account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
