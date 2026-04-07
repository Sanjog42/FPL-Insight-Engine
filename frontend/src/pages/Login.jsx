import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiFetch, roleHomePath, setRefreshToken, setSessionUser, setToken } from "../services/api";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      setToken(data.token);
      if (data.refresh) setRefreshToken(data.refresh);
      setSessionUser({ username: data.username, role: data.role });
      nav(roleHomePath(data.role));
    } catch (ex) {
      setErr(ex?.message || "Login failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <h2 className="mb-2">FPL Insight Engine</h2>
      <p className="text-muted mb-4">Sign in with your account.</p>

      <div className="card shadow-sm">
        <div className="card-body p-4">
          {err ? <div className="alert alert-danger">{err}</div> : null}

          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="btn btn-primary w-100" type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-3 mb-0 text-muted">
            No account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
