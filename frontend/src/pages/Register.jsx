import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import RegisterForm from "../components/forms/RegisterForm";
import { register } from "../services/authService";

export default function Register() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
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

    setLoading(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      nav("/login");
    } catch (ex) {
      setErr(ex?.message || "Registration failed.");
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
          <Link to="/login" className="btn btn-outline">Login</Link>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-wrapper">
          <div className="auth-visual">
            <div className="auth-visual-content">
              <div className="football-icon">Join</div>
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-subtitle">
                Register to start using predictions, analytics, and personalised FPL insights.
              </p>
            </div>
          </div>

          <div className="auth-form-container">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <h2 className="h2">Create Account</h2>
                <p className="text-muted">Register to use FPL Insight Engine</p>
              </div>

              <RegisterForm form={form} onChange={update} onSubmit={submit} error={err} loading={loading} />

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
