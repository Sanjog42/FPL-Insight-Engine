import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiFetch, setToken, setRefreshToken } from "../services/api";

export default function Register() {
  const nav = useNavigate();
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");

    if (form.password !== form.confirm_password) {
      setErr("Passwords do not match");
      return;
    }

    // ✅ Send what Django register serializers usually expect
    const payload = {
      full_name: form.full_name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
    };

    try {
      const data = await apiFetch("/api/auth/register/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Some backends return tokens on register, some don't
      if (data?.access) {
        setToken(data.access);
      }
      if (data?.refresh) {
        setRefreshToken(data.refresh);
      }

      // ✅ Recommended flow: register -> login
      nav("/login");
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div className="app auth-page">
      <div className="auth-background"></div>

      <header className="navbar">
        <div className="navbar-title">⚽ FPL Insight Engine</div>
        <div className="navbar-actions">
          <Link to="/login" className="btn btn-outline">Login</Link>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-wrapper">
          <div className="auth-visual">
            <div className="auth-visual-content">
              <div className="football-icon">📝</div>
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-subtitle">
                Register to start using predictions, analytics, and personalised FPL insights.
              </p>
              <div className="auth-features">
                <div className="auth-feature-item"><span className="feature-icon">⚡</span><span>Fast signup</span></div>
                <div className="auth-feature-item"><span className="feature-icon">🔒</span><span>Secure login</span></div>
                <div className="auth-feature-item"><span className="feature-icon">📊</span><span>Dashboard access</span></div>
              </div>
            </div>
          </div>

          <div className="auth-form-container">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <h2 className="h2">Create Account</h2>
                <p className="text-muted">Register to use FPL Insight Engine</p>
              </div>

              {err ? <p style={{ color: "#ef4444", marginTop: 0 }}>{err}</p> : null}

              <form className="auth-form" onSubmit={submit}>
                <div className="form-group">
                  <label className="label">Full Name</label>
                  <input className="input" name="full_name" value={form.full_name} onChange={update} required />
                </div>

                <div className="form-group">
                  <label className="label">Username</label>
                  <input className="input" name="username" value={form.username} onChange={update} required />
                </div>

                <div className="form-group">
                  <label className="label">Email</label>
                  <input className="input" type="email" name="email" value={form.email} onChange={update} required />
                </div>

                <div className="form-group">
                  <label className="label">Password</label>
                  <input className="input" type="password" name="password" value={form.password} onChange={update} required />
                </div>

                <div className="form-group">
                  <label className="label">Confirm Password</label>
                  <input className="input" type="password" name="confirm_password" value={form.confirm_password} onChange={update} required />
                </div>

                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <button type="submit" className="btn btn-accent" style={{ width: "100%" }}>
                    Register
                  </button>
                </div>
              </form>

              <p className="auth-footer">
                <span className="text-muted">Already have an account?</span>{" "}
                <Link to="/login" className="text-accent">Login</Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
