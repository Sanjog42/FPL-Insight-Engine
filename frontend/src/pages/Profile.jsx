import { useEffect, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

export default function Profile() {
  useAuthGuard();

  const [profile, setProfile] = useState({
    full_name: "",
    username: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const me = await apiFetch("/api/auth/me/");
        setProfile({
          full_name: me?.full_name || "",
          username: me?.username || "",
          email: me?.email || "",
        });
      } catch (ex) {
        setErr(ex.message || "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateProfileField(e) {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  }

  function updatePwField(e) {
    setPwForm({ ...pwForm, [e.target.name]: e.target.value });
  }

  async function saveProfile(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      const payload = {
        full_name: profile.full_name,
        username: profile.username,
        email: profile.email,
      };
      const res = await apiFetch("/api/auth/me/", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProfile({
        full_name: res?.full_name || "",
        username: res?.username || "",
        email: res?.email || "",
      });
      setMsg("Profile updated.");
    } catch (ex) {
      setErr(ex.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwErr("");
    setPwMsg("");
    setChanging(true);
    try {
      await apiFetch("/api/auth/change-password/", {
        method: "POST",
        body: JSON.stringify(pwForm),
      });
      setPwMsg("Password updated successfully.");
      setPwForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (ex) {
      setPwErr(ex.message || "Failed to update password.");
    } finally {
      setChanging(false);
    }
  }

  return (
    <AppLayout
      title="Profile"
      subtitle="Manage your account details and update your password."
    >
      <section className="section">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Account Details</h3>
                <p className="text-muted">Update your name, username, and email.</p>
              </div>
            </div>

            {loading ? <p className="text-muted">Loading profile...</p> : null}
            {err ? <p style={{ color: "#f87171" }}>{err}</p> : null}
            {msg ? <p className="text-accent">{msg}</p> : null}

            <form onSubmit={saveProfile} className="profile-grid">
              <div className="form-group">
                <label className="label">Full Name</label>
                <input
                  className="input"
                  name="full_name"
                  value={profile.full_name}
                  onChange={updateProfileField}
                  placeholder="Your name"
                />
              </div>
              <div className="form-group">
                <label className="label">Username</label>
                <input
                  className="input"
                  name="username"
                  value={profile.username}
                  onChange={updateProfileField}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={updateProfileField}
                  required
                />
              </div>
              <div className="form-group" style={{ alignSelf: "end" }}>
                <button className="btn btn-accent" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Change Password</h3>
                <p className="text-muted">Use a strong password to keep your account safe.</p>
              </div>
            </div>

            {pwErr ? <p style={{ color: "#f87171" }}>{pwErr}</p> : null}
            {pwMsg ? <p className="text-accent">{pwMsg}</p> : null}

            <form onSubmit={changePassword} className="form-actions">
              <div className="form-group" style={{ flex: "1 1 240px" }}>
                <label className="label">Current Password</label>
                <input
                  className="input"
                  type="password"
                  name="current_password"
                  value={pwForm.current_password}
                  onChange={updatePwField}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: "1 1 240px" }}>
                <label className="label">New Password</label>
                <input
                  className="input"
                  type="password"
                  name="new_password"
                  value={pwForm.new_password}
                  onChange={updatePwField}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: "1 1 240px" }}>
                <label className="label">Confirm New Password</label>
                <input
                  className="input"
                  type="password"
                  name="confirm_password"
                  value={pwForm.confirm_password}
                  onChange={updatePwField}
                  required
                />
              </div>
              <div className="form-group" style={{ alignSelf: "end" }}>
                <button className="btn btn-outline" type="submit" disabled={changing}>
                  {changing ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
