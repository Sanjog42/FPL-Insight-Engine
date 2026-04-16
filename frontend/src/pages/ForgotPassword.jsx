import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiFetch } from "../services/api";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    new_password: "",
    confirm_password: "",
  });

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setSuccess("");

    if (form.new_password !== form.confirm_password) {
      setErr("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/forgot-password/", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          new_password: form.new_password,
          confirm_password: form.confirm_password,
        }),
      });

      setSuccess(data?.message || "Password reset successfully");
      setTimeout(() => nav("/login"), 1200);
    } catch (ex) {
      setErr(ex?.message || "Unable to reset password");
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
          <Link to="/login" className="btn btn-outline">
            Back to Login
          </Link>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-wrapper">
          <div className="auth-visual">
            <div className="auth-visual-content">
              <div className="football-icon">Reset</div>
              <h1 className="auth-title">Forgot Password</h1>
              <p className="auth-subtitle">
                Verify your username and email, then set a new password.
              </p>
              <div className="auth-features">
                <div className="auth-feature-item">
                  <span className="feature-icon">Verify</span>
                  <span>Username and email must match an existing account</span>
                </div>
                <div className="auth-feature-item">
                  <span className="feature-icon">Secure</span>
                  <span>Your new password is validated against security rules</span>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-form-container">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <h2 className="h2">Reset Password</h2>
                <p className="text-muted">Enter account details to reset access</p>
              </div>

              {err ? <p style={{ color: "#ef4444", marginTop: 0 }}>{err}</p> : null}
              {success ? <p style={{ color: "#34d399", marginTop: 0 }}>{success}</p> : null}

              <form className="auth-form auth-form-single" onSubmit={submit}>
                <div className="form-group">
                  <label className="label">Username</label>
                  <input
                    className="input"
                    name="username"
                    value={form.username}
                    onChange={update}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={update}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">New Password</label>
                  <input
                    className="input"
                    type="password"
                    name="new_password"
                    value={form.new_password}
                    onChange={update}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Confirm New Password</label>
                  <input
                    className="input"
                    type="password"
                    name="confirm_password"
                    value={form.confirm_password}
                    onChange={update}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <button
                    type="submit"
                    className="btn btn-accent"
                    style={{ width: "100%" }}
                    disabled={loading}
                  >
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>

              <p className="auth-footer">
                <span className="text-muted">Remembered your password?</span>{" "}
                <Link to="/login" className="text-accent">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

