import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const isSuperAdmin = String(user?.role || "").toLowerCase() === "superadmin";

  const visibleMenu = useMemo(() => MENU.filter((m) => !m.superOnly || isSuperAdmin), [isSuperAdmin]);

  useEffect(() => {
    if (!user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [teamData, playerData, fixtureData, predictionData, workflowData] = await Promise.all([
        apiFetch("/api/admin/teams/"),
        apiFetch("/api/admin/players/"),
        apiFetch("/api/admin/fixtures/"),
        apiFetch("/api/admin/predictions/"),
        apiFetch("/api/admin/ml/workflow/"),
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

  async function runRetrain() {
    setWorkingAction("retrain");
    setError("");
    try {
      await apiFetch("/api/admin/ml/retrain/", { method: "POST", body: JSON.stringify({}) });
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
    if (!window.confirm("Rollback to previous published model?")) return;
    setWorkingAction("rollback");
    setError("");
    try {
      await apiFetch("/api/admin/ml/rollback/", { method: "POST", body: JSON.stringify({}) });
      await loadAll();
    } catch (ex) {
      setError(ex?.message || "Rollback failed");
    } finally {
      setWorkingAction("");
    }
  }

  async function createTeam() {
    const name = window.prompt("Team name:");
    if (!name) return;
    const short_name = window.prompt("Short name:", "") || "";
    const attack_strength = Number(window.prompt("Attack strength (1-100):", "50") || 50);
    const defense_strength = Number(window.prompt("Defense strength (1-100):", "50") || 50);

    await apiFetch("/api/admin/teams/", {
      method: "POST",
      body: JSON.stringify({ name, short_name, attack_strength, defense_strength }),
    });
    loadAll();
  }

  async function editTeam(team) {
    const name = window.prompt("Team name:", team.name);
    if (!name) return;
    const short_name = window.prompt("Short name:", team.short_name || "") || "";
    const attack_strength = Number(window.prompt("Attack strength:", String(team.attack_strength)) || team.attack_strength);
    const defense_strength = Number(window.prompt("Defense strength:", String(team.defense_strength)) || team.defense_strength);

    await apiFetch(`/api/admin/teams/${team.id}/`, {
      method: "PUT",
      body: JSON.stringify({ name, short_name, attack_strength, defense_strength }),
    });
    loadAll();
  }

  async function deleteTeam(id) {
    if (!window.confirm("Delete this team?")) return;
    await apiFetch(`/api/admin/teams/${id}/`, { method: "DELETE" });
    loadAll();
  }

  async function createPlayer() {
    const name = window.prompt("Player name:");
    if (!name) return;
    const team = Number(window.prompt("Team ID:", teams[0]?.id ? String(teams[0].id) : "") || 0);
    const position = window.prompt("Position (GK/DEF/MID/FWD):", "MID");
    const price = Number(window.prompt("Price (e.g. 8.5):", "5.0") || 5.0);

    await apiFetch("/api/admin/players/", {
      method: "POST",
      body: JSON.stringify({ name, team, position, price }),
    });
    loadAll();
  }

  async function editPlayer(player) {
    const name = window.prompt("Player name:", player.name);
    if (!name) return;
    const team = Number(window.prompt("Team ID:", String(player.team)) || player.team);
    const position = window.prompt("Position (GK/DEF/MID/FWD):", player.position);
    const price = Number(window.prompt("Price:", String(player.price)) || player.price);

    await apiFetch(`/api/admin/players/${player.id}/`, {
      method: "PUT",
      body: JSON.stringify({ name, team, position, price }),
    });
    loadAll();
  }

  async function deletePlayer(id) {
    if (!window.confirm("Delete this player?")) return;
    await apiFetch(`/api/admin/players/${id}/`, { method: "DELETE" });
    loadAll();
  }

  async function createFixture() {
    const gameweek = Number(window.prompt("Gameweek:", "1") || 1);
    const kickoff_at = window.prompt("Kickoff datetime (YYYY-MM-DDTHH:MM:SSZ):", new Date().toISOString());
    if (!kickoff_at) return;
    const home_team = Number(window.prompt("Home team ID:", teams[0]?.id ? String(teams[0].id) : "") || 0);
    const away_team = Number(window.prompt("Away team ID:", teams[1]?.id ? String(teams[1].id) : "") || 0);

    await apiFetch("/api/admin/fixtures/", {
      method: "POST",
      body: JSON.stringify({ gameweek, kickoff_at, home_team, away_team, is_finished: false }),
    });
    loadAll();
  }

  async function editFixture(fixture) {
    const gameweek = Number(window.prompt("Gameweek:", String(fixture.gameweek)) || fixture.gameweek);
    const kickoff_at = window.prompt("Kickoff datetime (YYYY-MM-DDTHH:MM:SSZ):", fixture.kickoff_at);
    if (!kickoff_at) return;
    const home_team = Number(window.prompt("Home team ID:", String(fixture.home_team)) || fixture.home_team);
    const away_team = Number(window.prompt("Away team ID:", String(fixture.away_team)) || fixture.away_team);
    const is_finished = window.confirm("Mark as finished?");

    await apiFetch(`/api/admin/fixtures/${fixture.id}/`, {
      method: "PUT",
      body: JSON.stringify({ gameweek, kickoff_at, home_team, away_team, is_finished }),
    });
    loadAll();
  }

  async function deleteFixture(id) {
    if (!window.confirm("Delete this fixture?")) return;
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
    await apiFetch(`/api/superadmin/promote/${userId}/`, { method: "PUT", body: JSON.stringify({}) });
    loadAll();
  }

  async function demote(userId) {
    await apiFetch(`/api/superadmin/demote/${userId}/`, { method: "PUT", body: JSON.stringify({}) });
    loadAll();
  }

  async function removeUser(userId) {
    if (!window.confirm("Delete this user?")) return;
    await apiFetch(`/api/superadmin/delete/${userId}/`, { method: "DELETE" });
    loadAll();
  }

  if (!user) return null;

  return (
    <div className="container-fluid py-3" style={{ background: "linear-gradient(180deg,#f7f9fc,#ffffff)", minHeight: "100vh" }}>
      <div className="row g-3">
        <aside className="col-12 col-lg-2">
          <div className="card border-0 shadow-sm" style={{ borderRadius: "1rem" }}>
            <div className="card-body">
              <h5 className="mb-3">Control Center</h5>
              <div className="list-group">
                {visibleMenu.map((item) => (
                  <button
                    key={item.key}
                    className={`list-group-item list-group-item-action ${active === item.key ? "active" : ""}`}
                    onClick={() => setActive(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <hr />
              <div className="small text-muted mb-2">Signed in as {user.username} ({user.role})</div>
              <button className="btn btn-outline-danger btn-sm w-100" onClick={logout}>Logout</button>
            </div>
          </div>
        </aside>

        <section className="col-12 col-lg-10">
          {error ? <div className="alert alert-danger">{error}</div> : null}
          {loading ? <div className="alert alert-info">Loading...</div> : null}

          {active === "dashboard" && (
            <div className="row g-3">
              <div className="col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><h6 className="text-muted">Players</h6><h3>{players.length}</h3></div></div></div>
              <div className="col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><h6 className="text-muted">Teams</h6><h3>{teams.length}</h3></div></div></div>
              <div className="col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><h6 className="text-muted">Fixtures</h6><h3>{fixtures.length}</h3></div></div></div>
              <div className="col-md-3"><div className="card border-0 shadow-sm"><div className="card-body"><h6 className="text-muted">Predictions</h6><h3>{predictions.length}</h3></div></div></div>

              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <strong>Model Workflow</strong>
                    <div className="d-flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={runRetrain} disabled={workingAction === "retrain"}>
                        {workingAction === "retrain" ? "Retraining..." : "Retrain"}
                      </button>
                      <button className="btn btn-outline-warning btn-sm" onClick={rollbackModel} disabled={workingAction === "rollback"}>
                        {workingAction === "rollback" ? "Rolling back..." : "Rollback to Previous"}
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <strong>Active model:</strong>{" "}
                      {workflow.active ? `${workflow.active.name} (${workflow.active.status})` : "No published model"}
                    </div>

                    <h6>Drafts</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-striped align-middle">
                        <thead><tr><th>ID</th><th>Name</th><th>Trained</th><th></th></tr></thead>
                        <tbody>
                          {(workflow.drafts || []).map((d) => (
                            <tr key={d.id}>
                              <td>{d.id}</td>
                              <td>{d.name}</td>
                              <td>{new Date(d.trained_at).toLocaleString()}</td>
                              <td className="text-end">
                                <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => previewDraft(d.id)} disabled={workingAction === `preview-${d.id}`}>
                                  Preview Draft
                                </button>
                                <button className="btn btn-success btn-sm" onClick={() => publishDraft(d.id)} disabled={workingAction === `publish-${d.id}`}>
                                  Publish Draft
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(workflow.drafts || []).length === 0 && (
                            <tr><td colSpan={4} className="text-muted">No drafts yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {previewData && (
                      <div className="mt-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Preview: {previewData?.draft?.name}</h6>
                          <button className="btn btn-outline-dark btn-sm" onClick={() => setPreviewData(null)}>Close Preview</button>
                        </div>
                        <div className="table-responsive">
                          <table className="table table-sm table-bordered">
                            <thead>
                              <tr>
                                <th>Fixture</th>
                                <th>Current</th>
                                <th>Draft</th>
                                <th>Current xG</th>
                                <th>Draft xG</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(previewData.comparison || []).map((row) => (
                                <tr key={row.fixture_id}>
                                  <td>{row.home_team} vs {row.away_team}</td>
                                  <td>{row.current?.outcome} ({Math.round((row.current?.probs?.home || 0) * 100)} / {Math.round((row.current?.probs?.draw || 0) * 100)} / {Math.round((row.current?.probs?.away || 0) * 100)})</td>
                                  <td>{row.draft?.outcome} ({Math.round((row.draft?.probs?.home || 0) * 100)} / {Math.round((row.draft?.probs?.draw || 0) * 100)} / {Math.round((row.draft?.probs?.away || 0) * 100)})</td>
                                  <td>{row.current?.home_xg} - {row.current?.away_xg}</td>
                                  <td>{row.draft?.home_xg} - {row.draft?.away_xg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "players" && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <strong>Players</strong>
                <button className="btn btn-primary btn-sm" onClick={createPlayer}>Add Player</button>
              </div>
              <div className="table-responsive">
                <table className="table table-striped mb-0 align-middle">
                  <thead><tr><th>ID</th><th>Name</th><th>Team</th><th>Pos</th><th>Price</th><th></th></tr></thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td><td>{p.name}</td><td>{p.team_name}</td><td>{p.position}</td><td>{p.price}</td>
                        <td className="text-end">
                          <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => editPlayer(p)}>Edit</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => deletePlayer(p.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {active === "teams" && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <strong>Teams</strong>
                <button className="btn btn-primary btn-sm" onClick={createTeam}>Add Team</button>
              </div>
              <div className="table-responsive">
                <table className="table table-striped mb-0 align-middle">
                  <thead><tr><th>ID</th><th>Name</th><th>Short</th><th>Attack</th><th>Defense</th><th></th></tr></thead>
                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.id}>
                        <td>{t.id}</td><td>{t.name}</td><td>{t.short_name}</td><td>{t.attack_strength}</td><td>{t.defense_strength}</td>
                        <td className="text-end">
                          <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => editTeam(t)}>Edit</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => deleteTeam(t.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {active === "fixtures" && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <strong>Fixtures</strong>
                <button className="btn btn-primary btn-sm" onClick={createFixture}>Add Fixture</button>
              </div>
              <div className="table-responsive">
                <table className="table table-striped mb-0 align-middle">
                  <thead><tr><th>ID</th><th>GW</th><th>Match</th><th>Kickoff</th><th></th></tr></thead>
                  <tbody>
                    {fixtures.map((f) => (
                      <tr key={f.id}>
                        <td>{f.id}</td>
                        <td>{f.gameweek}</td>
                        <td>{f.home_team_name} vs {f.away_team_name}</td>
                        <td>{new Date(f.kickoff_at).toLocaleString()}</td>
                        <td className="text-end">
                          <button className="btn btn-outline-primary btn-sm me-2" onClick={() => runPrediction(f.id)}>Run Prediction</button>
                          <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => editFixture(f)}>Edit</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => deleteFixture(f.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {active === "predictions" && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white"><strong>Predictions</strong></div>
              <div className="table-responsive">
                <table className="table table-striped mb-0 align-middle">
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
            </div>
          )}

          {active === "users" && isSuperAdmin && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white"><strong>User Management</strong></div>
              <div className="table-responsive">
                <table className="table table-striped mb-0 align-middle">
                  <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th></th></tr></thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>{u.email || "-"}</td>
                        <td>
                          <span className={`badge ${u.role === "SuperAdmin" ? "text-bg-dark" : u.role === "Admin" ? "text-bg-primary" : "text-bg-secondary"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="text-end">
                          {u.role !== "SuperAdmin" && (
                            <>
                              <button className="btn btn-outline-success btn-sm me-2" onClick={() => promote(u.id)}>Promote</button>
                              <button className="btn btn-outline-warning btn-sm me-2" onClick={() => demote(u.id)}>Demote</button>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => removeUser(u.id)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
