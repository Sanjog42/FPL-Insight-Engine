import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthGuard from "../hooks/useAuthGuard";
import { apiFetch, clearSession } from "../services/api";

const MENU = [
  { key: "dashboard", label: "Dashboard" },
  { key: "players", label: "Players" },
  { key: "teams", label: "Teams" },
  { key: "fixtures", label: "Fixtures" },
  { key: "predictions", label: "Predictions" },
  { key: "users", label: "Users", superOnly: true },
];

const RETRAIN_MODULES = [
  { value: "player_points", label: "Player Points" },
  { value: "price_change", label: "Price Change" },
  { value: "match_prediction", label: "Match Prediction" },
  { value: "fdr", label: "Fixture Difficulty" },
  { value: "captaincy", label: "Captaincy" },
  { value: "transfer_suggestion", label: "Transfer Suggestion" },
  { value: "team_generation", label: "Team Generation" },
];

function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function toFloat(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}

export default function AdminDashboard() {
  const user = useAuthGuard(["Admin", "SuperAdmin"]);
  const nav = useNavigate();

  const [active, setActive] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [users, setUsers] = useState([]);

  const [workflow, setWorkflow] = useState({ active: null, drafts: [], published: [], jobs: [] });
  const [previewData, setPreviewData] = useState(null);
  const [workingAction, setWorkingAction] = useState("");
  const [selectedModule, setSelectedModule] = useState(RETRAIN_MODULES[0].value);

  const [dialog, setDialog] = useState({
    open: false,
    type: "confirm",
    title: "",
    message: "",
    fields: [],
    values: {},
    confirmText: "Confirm",
    cancelText: "Cancel",
    danger: false,
    errors: {},
  });
  const resolverRef = useRef(null);

  const role = String(user?.role || "");
  const isSuperAdmin = role.toLowerCase() === "superadmin";

  const visibleMenu = useMemo(() => MENU.filter((m) => !m.superOnly || isSuperAdmin), [isSuperAdmin]);
  const selectedModuleLabel = RETRAIN_MODULES.find((m) => m.value === selectedModule)?.label || selectedModule;

  useEffect(() => {
    if (!user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedModule]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [teamData, playerData, fixtureData, predictionData, workflowData] = await Promise.all([
        apiFetch("/api/admin/teams/"),
        apiFetch("/api/admin/players/"),
        apiFetch("/api/admin/fixtures/"),
        apiFetch("/api/admin/predictions/"),
        apiFetch(`/api/admin/ml/workflow/?model_type=${encodeURIComponent(selectedModule)}`),
      ]);

      setTeams(Array.isArray(teamData) ? teamData : []);
      setPlayers(Array.isArray(playerData) ? playerData : []);
      setFixtures(Array.isArray(fixtureData) ? fixtureData : []);
      setPredictions(Array.isArray(predictionData) ? predictionData : []);
      setWorkflow(workflowData || { active: null, drafts: [], published: [], jobs: [] });

      if (isSuperAdmin) {
        const userData = await apiFetch("/api/admin/users/");
        setUsers(Array.isArray(userData) ? userData : []);
      }
    } catch (ex) {
      setError(ex?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearSession();
    nav("/login");
  }

  function closeDialog(result) {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setDialog((prev) => ({ ...prev, open: false, errors: {} }));
    if (resolver) resolver(result);
  }

  function openConfirm({ title, message, confirmText = "Confirm", cancelText = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        open: true,
        type: "confirm",
        title,
        message,
        fields: [],
        values: {},
        confirmText,
        cancelText,
        danger,
        errors: {},
      });
    });
  }

  function openForm({ title, message = "", fields, initialValues = {}, confirmText = "Save", cancelText = "Cancel", danger = false }) {
    const values = {};
    fields.forEach((f) => {
      if (initialValues[f.name] !== undefined && initialValues[f.name] !== null) {
        values[f.name] = String(initialValues[f.name]);
      } else {
        values[f.name] = f.defaultValue !== undefined ? String(f.defaultValue) : "";
      }
    });

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        open: true,
        type: "form",
        title,
        message,
        fields,
        values,
        confirmText,
        cancelText,
        danger,
        errors: {},
      });
    });
  }

  function onDialogChange(name, value) {
    setDialog((prev) => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      errors: { ...prev.errors, [name]: "" },
    }));
  }

  function submitDialog() {
    if (dialog.type === "confirm") {
      closeDialog(true);
      return;
    }

    const errors = {};
    dialog.fields.forEach((f) => {
      const value = String(dialog.values?.[f.name] ?? "").trim();
      if (f.required && !value) {
        errors[f.name] = `${f.label} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setDialog((prev) => ({ ...prev, errors }));
      return;
    }

    closeDialog(dialog.values);
  }

  async function runRetrain() {
    setWorkingAction("retrain");
    setError("");
    try {
      await apiFetch("/api/admin/ml/retrain/", { method: "POST", body: JSON.stringify({ model_type: selectedModule }) });
      await loadAll();
    } catch (ex) {
      setError(ex?.message || "Retrain failed");
    } finally {
      setWorkingAction("");
    }
  }

  async function previewDraft(id) {
    setWorkingAction(`preview-${id}`);
    setError("");
    try {
      const data = await apiFetch(`/api/admin/ml/preview/${id}/`);
      setPreviewData(data);
    } catch (ex) {
      setError(ex?.message || "Preview failed");
    } finally {
      setWorkingAction("");
    }
  }

  async function publishDraft(id) {
    const ok = await openConfirm({
      title: "Publish Draft",
      message: "Publish this draft model as active? This will replace current active model.",
      confirmText: "Publish",
    });
    if (!ok) return;

    setWorkingAction(`publish-${id}`);
    setError("");
    try {
      await apiFetch(`/api/admin/ml/publish/${id}/`, { method: "POST", body: JSON.stringify({}) });
      await loadAll();
    } catch (ex) {
      setError(ex?.message || "Publish failed");
    } finally {
      setWorkingAction("");
    }
  }

  async function rollbackModel() {
    const ok = await openConfirm({
      title: "Rollback Model",
      message: "Rollback to previous published model?",
      confirmText: "Rollback",
      danger: true,
    });
    if (!ok) return;

    setWorkingAction("rollback");
    setError("");
    try {
      await apiFetch("/api/admin/ml/rollback/", { method: "POST", body: JSON.stringify({ model_type: selectedModule }) });
      await loadAll();
    } catch (ex) {
      setError(ex?.message || "Rollback failed");
    } finally {
      setWorkingAction("");
    }
  }

  async function createTeam() {
    const values = await openForm({
      title: "Add Team",
      fields: [
        { name: "name", label: "Team Name", required: true },
        { name: "short_name", label: "Short Name", required: true },
        { name: "attack_strength", label: "Attack Strength", required: true, defaultValue: "50" },
        { name: "defense_strength", label: "Defense Strength", required: true, defaultValue: "50" },
      ],
      confirmText: "Create",
    });
    if (!values) return;

    await apiFetch("/api/admin/teams/", {
      method: "POST",
      body: JSON.stringify({
        name: values.name.trim(),
        short_name: values.short_name.trim(),
        attack_strength: toInt(values.attack_strength, 50),
        defense_strength: toInt(values.defense_strength, 50),
      }),
    });
    loadAll();
  }

  async function editTeam(team) {
    const values = await openForm({
      title: `Edit Team #${team.id}`,
      fields: [
        { name: "name", label: "Team Name", required: true },
        { name: "short_name", label: "Short Name", required: true },
        { name: "attack_strength", label: "Attack Strength", required: true },
        { name: "defense_strength", label: "Defense Strength", required: true },
      ],
      initialValues: {
        name: team.name,
        short_name: team.short_name,
        attack_strength: team.attack_strength,
        defense_strength: team.defense_strength,
      },
      confirmText: "Save",
    });
    if (!values) return;

    await apiFetch(`/api/admin/teams/${team.id}/`, {
      method: "PUT",
      body: JSON.stringify({
        name: values.name.trim(),
        short_name: values.short_name.trim(),
        attack_strength: toInt(values.attack_strength, team.attack_strength),
        defense_strength: toInt(values.defense_strength, team.defense_strength),
      }),
    });
    loadAll();
  }

  async function deleteTeam(id) {
    const ok = await openConfirm({
      title: "Delete Team",
      message: "Are you sure you want to delete this team?",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    await apiFetch(`/api/admin/teams/${id}/`, { method: "DELETE" });
    loadAll();
  }

  async function createPlayer() {
    const values = await openForm({
      title: "Add Player",
      fields: [
        { name: "name", label: "Player Name", required: true },
        { name: "team", label: "Team ID", required: true, defaultValue: String(teams[0]?.id || "") },
        { name: "position", label: "Position (GK/DEF/MID/FWD)", required: true, defaultValue: "MID" },
        { name: "price", label: "Price", required: true, defaultValue: "5.0" },
      ],
      confirmText: "Create",
    });
    if (!values) return;

    await apiFetch("/api/admin/players/", {
      method: "POST",
      body: JSON.stringify({
        name: values.name.trim(),
        team: toInt(values.team, teams[0]?.id || 0),
        position: String(values.position || "MID").trim().toUpperCase(),
        price: toFloat(values.price, 5.0),
      }),
    });
    loadAll();
  }

  async function editPlayer(player) {
    const values = await openForm({
      title: `Edit Player #${player.id}`,
      fields: [
        { name: "name", label: "Player Name", required: true },
        { name: "team", label: "Team ID", required: true },
        { name: "position", label: "Position (GK/DEF/MID/FWD)", required: true },
        { name: "price", label: "Price", required: true },
      ],
      initialValues: {
        name: player.name,
        team: player.team,
        position: player.position,
        price: player.price,
      },
      confirmText: "Save",
    });
    if (!values) return;

    await apiFetch(`/api/admin/players/${player.id}/`, {
      method: "PUT",
      body: JSON.stringify({
        name: values.name.trim(),
        team: toInt(values.team, player.team),
        position: String(values.position || player.position).trim().toUpperCase(),
        price: toFloat(values.price, player.price),
      }),
    });
    loadAll();
  }

  async function deletePlayer(id) {
    const ok = await openConfirm({
      title: "Delete Player",
      message: "Are you sure you want to delete this player?",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    await apiFetch(`/api/admin/players/${id}/`, { method: "DELETE" });
    loadAll();
  }

  async function createFixture() {
    const values = await openForm({
      title: "Add Fixture",
      fields: [
        { name: "gameweek", label: "Gameweek", required: true, defaultValue: "1" },
        { name: "kickoff_at", label: "Kickoff (ISO datetime)", required: true, defaultValue: new Date().toISOString() },
        { name: "home_team", label: "Home Team ID", required: true, defaultValue: String(teams[0]?.id || "") },
        { name: "away_team", label: "Away Team ID", required: true, defaultValue: String(teams[1]?.id || "") },
      ],
      confirmText: "Create",
    });
    if (!values) return;

    await apiFetch("/api/admin/fixtures/", {
      method: "POST",
      body: JSON.stringify({
        gameweek: toInt(values.gameweek, 1),
        kickoff_at: values.kickoff_at,
        home_team: toInt(values.home_team, teams[0]?.id || 0),
        away_team: toInt(values.away_team, teams[1]?.id || 0),
        is_finished: false,
      }),
    });
    loadAll();
  }

  async function editFixture(fixture) {
    const values = await openForm({
      title: `Edit Fixture #${fixture.id}`,
      fields: [
        { name: "gameweek", label: "Gameweek", required: true },
        { name: "kickoff_at", label: "Kickoff (ISO datetime)", required: true },
        { name: "home_team", label: "Home Team ID", required: true },
        { name: "away_team", label: "Away Team ID", required: true },
        { name: "is_finished", label: "Finished? (true/false)", required: true },
      ],
      initialValues: {
        gameweek: fixture.gameweek,
        kickoff_at: fixture.kickoff_at,
        home_team: fixture.home_team,
        away_team: fixture.away_team,
        is_finished: String(Boolean(fixture.is_finished)),
      },
      confirmText: "Save",
    });
    if (!values) return;

    await apiFetch(`/api/admin/fixtures/${fixture.id}/`, {
      method: "PUT",
      body: JSON.stringify({
        gameweek: toInt(values.gameweek, fixture.gameweek),
        kickoff_at: values.kickoff_at,
        home_team: toInt(values.home_team, fixture.home_team),
        away_team: toInt(values.away_team, fixture.away_team),
        is_finished: String(values.is_finished).toLowerCase() === "true",
      }),
    });
    loadAll();
  }

  async function deleteFixture(id) {
    const ok = await openConfirm({
      title: "Delete Fixture",
      message: "Are you sure you want to delete this fixture?",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    await apiFetch(`/api/admin/fixtures/${id}/`, { method: "DELETE" });
    loadAll();
  }

  async function runPrediction(fixtureId) {
    await apiFetch("/api/admin/predictions/run/", {
      method: "POST",
      body: JSON.stringify({ fixture_id: fixtureId }),
    });
    loadAll();
    setActive("predictions");
  }

  async function promote(userId) {
    const ok = await openConfirm({
      title: "Promote User",
      message: "Promote this user to Admin?",
      confirmText: "Promote",
    });
    if (!ok) return;

    await apiFetch(`/api/superadmin/promote/${userId}/`, { method: "PUT", body: JSON.stringify({}) });
    loadAll();
  }

  async function demote(userId) {
    const ok = await openConfirm({
      title: "Demote Admin",
      message: "Demote this admin to User?",
      confirmText: "Demote",
      danger: true,
    });
    if (!ok) return;

    await apiFetch(`/api/superadmin/demote/${userId}/`, { method: "PUT", body: JSON.stringify({}) });
    loadAll();
  }

  async function removeUser(userId) {
    const ok = await openConfirm({
      title: "Delete User",
      message: "Delete this user permanently?",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    await apiFetch(`/api/superadmin/delete/${userId}/`, { method: "DELETE" });
    loadAll();
  }

  if (!user) return null;

  const displayName = user?.full_name?.trim() || user?.username || "Admin";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "A";

  return (
    <>
      <div className="app">
        <main className="content dashboard-shell">
          <header className="page-header">
            <div className="page-title">
              <span className="page-title-accent">FPL</span> {isSuperAdmin ? "SuperAdmin" : "Admin"} Control
            </div>

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              {!isSuperAdmin ? <Link to="/dashboard" className="btn btn-outline">User Dashboard</Link> : null}
              <Link to="/profile" className="profile-pill">
                <span className="profile-avatar">{initials}</span>
                <span className="profile-name">{displayName}</span>
              </Link>
              <button className="btn btn-outline" onClick={logout}>Logout</button>
            </div>
          </header>

          <section className="section">
            <div className="pill-row">
              {visibleMenu.map((item) => (
                <button key={item.key} className={`pill ${active === item.key ? "pill-active" : ""}`} onClick={() => setActive(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {error ? <section className="section"><article className="card"><p style={{ color: "#ff6b6b", margin: 0 }}>{error}</p></article></section> : null}
          {loading ? <section className="section"><article className="card"><p style={{ margin: 0 }}>Loading...</p></article></section> : null}

          {active === "dashboard" && (
            <>
              <section className="section">
                <div className="grid grid-3">
                  <article className="card stat-card">
                    <div className="card-subtitle">Players</div>
                    <div className="stat-card-value">{players.length}</div>
                    <p className="text-muted">Total manageable players</p>
                  </article>
                  <article className="card stat-card">
                    <div className="card-subtitle">Teams</div>
                    <div className="stat-card-value">{teams.length}</div>
                    <p className="text-muted">Total managed teams</p>
                  </article>
                  <article className="card stat-card">
                    <div className="card-subtitle">Fixtures</div>
                    <div className="stat-card-value">{fixtures.length}</div>
                    <p className="text-muted">Fixtures in admin records</p>
                  </article>
                </div>
              </section>

              <section className="section">
                <article className="card">
                  <div className="card-header">
                    <h3 className="card-title">Model Workflow</h3>
                    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                      <select className="input" style={{ minWidth: "220px", maxWidth: "260px" }} value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}>
                        {RETRAIN_MODULES.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <button className="btn btn-accent" onClick={runRetrain} disabled={workingAction === "retrain"}>
                        {workingAction === "retrain" ? "Retraining..." : "Retrain"}
                      </button>
                      <button className="btn btn-outline" onClick={rollbackModel} disabled={workingAction === "rollback"}>
                        {workingAction === "rollback" ? "Rolling back..." : "Rollback to Previous"}
                      </button>
                    </div>
                  </div>

                  <p className="text-muted">
                    Active model for <strong>{selectedModuleLabel}</strong>: <strong>{workflow.active ? `${workflow.active.name} (${workflow.active.status})` : "No published model"}</strong>
                  </p>

                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr><th>ID</th><th>Name</th><th>Trained</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {(workflow.drafts || []).map((d) => (
                          <tr key={d.id}>
                            <td>{d.id}</td>
                            <td>{d.name}</td>
                            <td>{new Date(d.trained_at).toLocaleString()}</td>
                            <td>
                              <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => previewDraft(d.id)} disabled={workingAction === `preview-${d.id}`}>
                                Preview Draft
                              </button>
                              <button className="btn btn-accent" style={{ padding: "0.45rem 0.85rem" }} onClick={() => publishDraft(d.id)} disabled={workingAction === `publish-${d.id}`}>
                                Publish Draft
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(workflow.drafts || []).length === 0 ? <tr><td colSpan={4}>No drafts yet.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>

                  {previewData ? (
                    <div style={{ marginTop: "1rem" }}>
                      <div className="card-header" style={{ marginBottom: "0.5rem" }}>
                        <h3 className="card-title">Preview: {previewData?.draft?.name}</h3>
                        <button className="btn btn-outline" style={{ padding: "0.45rem 0.85rem" }} onClick={() => setPreviewData(null)}>Close</button>
                      </div>
                      <div className="table-responsive">
                        <table className="table">
                          <thead><tr><th>Fixture</th><th>Current</th><th>Draft</th><th>Current xG</th><th>Draft xG</th></tr></thead>
                          <tbody>
                            {(previewData.comparison || []).map((row) => (
                              <tr key={row.fixture_id}>
                                <td>{row.home_team} vs {row.away_team}</td>
                                <td>{row.current?.outcome}</td>
                                <td>{row.draft?.outcome}</td>
                                <td>{row.current?.home_xg} - {row.current?.away_xg}</td>
                                <td>{row.draft?.home_xg} - {row.draft?.away_xg}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </article>
              </section>
            </>
          )}

          {active === "players" && (
            <section className="section">
              <article className="card">
                <div className="card-header">
                  <h3 className="card-title">Players</h3>
                  <button className="btn btn-accent" onClick={createPlayer}>Add Player</button>
                </div>
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>ID</th><th>Name</th><th>Team</th><th>Pos</th><th>Price</th><th>Actions</th></tr></thead>
                    <tbody>
                      {players.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td><td>{p.name}</td><td>{p.team_name}</td><td>{p.position}</td><td>{p.price}</td>
                          <td>
                            <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => editPlayer(p)}>Edit</button>
                            <button className="btn btn-outline" style={{ padding: "0.45rem 0.85rem", borderColor: "rgba(255,107,107,0.5)", color: "#ff8e8e" }} onClick={() => deletePlayer(p.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {active === "teams" && (
            <section className="section">
              <article className="card">
                <div className="card-header">
                  <h3 className="card-title">Teams</h3>
                  <button className="btn btn-accent" onClick={createTeam}>Add Team</button>
                </div>
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>ID</th><th>Name</th><th>Short</th><th>Attack</th><th>Defense</th><th>Actions</th></tr></thead>
                    <tbody>
                      {teams.map((t) => (
                        <tr key={t.id}>
                          <td>{t.id}</td><td>{t.name}</td><td>{t.short_name}</td><td>{t.attack_strength}</td><td>{t.defense_strength}</td>
                          <td>
                            <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => editTeam(t)}>Edit</button>
                            <button className="btn btn-outline" style={{ padding: "0.45rem 0.85rem", borderColor: "rgba(255,107,107,0.5)", color: "#ff8e8e" }} onClick={() => deleteTeam(t.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {active === "fixtures" && (
            <section className="section">
              <article className="card">
                <div className="card-header">
                  <h3 className="card-title">Fixtures</h3>
                  <button className="btn btn-accent" onClick={createFixture}>Add Fixture</button>
                </div>
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>ID</th><th>GW</th><th>Match</th><th>Kickoff</th><th>Actions</th></tr></thead>
                    <tbody>
                      {fixtures.map((f) => (
                        <tr key={f.id}>
                          <td>{f.id}</td>
                          <td>{f.gameweek}</td>
                          <td>{f.home_team_name} vs {f.away_team_name}</td>
                          <td>{new Date(f.kickoff_at).toLocaleString()}</td>
                          <td>
                            <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => runPrediction(f.id)}>Run</button>
                            <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => editFixture(f)}>Edit</button>
                            <button className="btn btn-outline" style={{ padding: "0.45rem 0.85rem", borderColor: "rgba(255,107,107,0.5)", color: "#ff8e8e" }} onClick={() => deleteFixture(f.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {active === "predictions" && (
            <section className="section">
              <article className="card">
                <h3 className="card-title" style={{ marginBottom: "0.8rem" }}>Predictions</h3>
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>ID</th><th>Fixture</th><th>xG</th><th>Outcome</th><th>Confidence</th><th>By</th></tr></thead>
                    <tbody>
                      {predictions.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.fixture_label}</td>
                          <td>{p.predicted_home_goals} - {p.predicted_away_goals}</td>
                          <td>{p.outcome}</td>
                          <td>{p.confidence}%</td>
                          <td>{p.created_by_username || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {active === "users" && isSuperAdmin && (
            <section className="section">
              <article className="card">
                <h3 className="card-title" style={{ marginBottom: "0.8rem" }}>User Management</h3>
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.id}</td>
                          <td>{u.username}</td>
                          <td>{u.email || "-"}</td>
                          <td>
                            <span className={u.role === "SuperAdmin" ? "badge badge-accent" : "badge badge-soft"}>{u.role}</span>
                          </td>
                          <td>
                            {u.role !== "SuperAdmin" ? (
                              <>
                                <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => promote(u.id)}>Promote</button>
                                <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => demote(u.id)}>Demote</button>
                                <button className="btn btn-outline" style={{ padding: "0.45rem 0.85rem", borderColor: "rgba(255,107,107,0.5)", color: "#ff8e8e" }} onClick={() => removeUser(u.id)}>Delete</button>
                              </>
                            ) : (
                              <span className="text-muted">Protected</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}
        </main>
      </div>

      {dialog.open && (
        <div className="picker-backdrop" onClick={() => closeDialog(dialog.type === "confirm" ? false : null)}>
          <div className="picker-modal" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="h3" style={{ marginBottom: "0.4rem" }}>{dialog.title}</h3>
            {dialog.message ? <p className="text-muted" style={{ marginTop: 0 }}>{dialog.message}</p> : null}

            {dialog.type === "form" ? (
              <div className="grid" style={{ gap: "0.8rem", marginTop: "1rem" }}>
                {dialog.fields.map((field) => (
                  <div key={field.name}>
                    <label className="label">{field.label}</label>
                    <input
                      className="input"
                      value={dialog.values?.[field.name] ?? ""}
                      onChange={(e) => onDialogChange(field.name, e.target.value)}
                    />
                    {dialog.errors?.[field.name] ? (
                      <div style={{ color: "#ff8e8e", fontSize: "0.8rem", marginTop: "0.35rem" }}>{dialog.errors[field.name]}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1rem" }}>
              <button className="btn btn-outline" onClick={() => closeDialog(dialog.type === "confirm" ? false : null)}>{dialog.cancelText}</button>
              <button
                className={dialog.danger ? "btn btn-outline" : "btn btn-accent"}
                style={dialog.danger ? { borderColor: "rgba(255,107,107,0.5)", color: "#ff8e8e" } : null}
                onClick={submitDialog}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}




