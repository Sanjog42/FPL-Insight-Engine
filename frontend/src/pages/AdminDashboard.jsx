import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import AdminLayout from "../layouts/AdminLayout";
import useAuthGuard from "../hooks/useAuthGuard";
import {
  deleteUser,
  demoteUser,
  getAdminUsers,
  getAdminWorkflow,
  previewDraftModel,
  promoteUser,
  publishDraftModel,
  retrainModel,
  rollbackModel as rollbackModelRequest,
} from "../services/userService";

const MENU = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "Users", superOnly: true },
];

const RETRAIN_MODULES = [
  { value: "player_points", label: "Player Points", icon: "PTS", description: "Projected points by gameweek form." },
  { value: "price_change", label: "Price Change", icon: "GBP", description: "Likely rise, fall, or stable value." },
  { value: "match_prediction", label: "Match Prediction", icon: "WDL", description: "Outcome and xG probabilities." },
  { value: "fdr", label: "Fixture Difficulty", icon: "FDR", description: "Difficulty outlook for upcoming fixtures." },
  { value: "captaincy", label: "Captaincy", icon: "CAP", description: "Top captain picks for next gameweek." },
  { value: "transfer_suggestion", label: "Transfer Suggestion", icon: "TRF", description: "Optimized transfer recommendations." },
  { value: "team_generation", label: "Team Generation", icon: "XI", description: "Auto-build squad under budget." },
];

export default function AdminDashboard() {
  const user = useAuthGuard(["Admin", "SuperAdmin"]);

  const [active, setActive] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);

  const [workflow, setWorkflow] = useState({ active: null, drafts: [], jobs: [] });
  const [previewData, setPreviewData] = useState(null);
  const [workingAction, setWorkingAction] = useState("");
  const [selectedModule, setSelectedModule] = useState(RETRAIN_MODULES[0].value);

  const [dialog, setDialog] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    danger: false,
  });
  const resolverRef = useRef(null);

  const role = String(user?.role || "");
  const isSuperAdmin = role.toLowerCase() === "superadmin";

  const visibleMenu = useMemo(() => MENU.filter((m) => !m.superOnly || isSuperAdmin), [isSuperAdmin]);

  useEffect(() => {
    if (!user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedModule]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const workflowData = await getAdminWorkflow(selectedModule);
      setWorkflow(workflowData || { active: null, drafts: [], jobs: [] });

      if (isSuperAdmin) {
        const userData = await getAdminUsers();
        setUsers(Array.isArray(userData) ? userData : []);
      }
    } catch (ex) {
      setError(ex?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  function closeDialog(result) {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setDialog((prev) => ({ ...prev, open: false }));
    if (resolver) resolver(result);
  }

  function openConfirm({ title, message, confirmText = "Confirm", cancelText = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({ open: true, title, message, confirmText, cancelText, danger });
    });
  }

  async function runRetrain() {
    setWorkingAction("retrain");
    setError("");
    try {
      await retrainModel(selectedModule);
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
      const data = await previewDraftModel(id);
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
      await publishDraftModel(id);
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
      await rollbackModelRequest(selectedModule);
      await loadAll();
    } catch (ex) {
      setError(ex?.message || "Rollback failed");
    } finally {
      setWorkingAction("");
    }
  }

  async function manageUser(action, userId) {
    if (action === "promote") await promoteUser(userId);
    if (action === "demote") await demoteUser(userId);
    if (action === "delete") await deleteUser(userId);
    await loadAll();
  }

  async function onPromote(userId) {
    const ok = await openConfirm({ title: "Promote User", message: "Promote this user to Admin?", confirmText: "Promote" });
    if (!ok) return;
    manageUser("promote", userId);
  }

  async function onDemote(userId) {
    const ok = await openConfirm({ title: "Demote Admin", message: "Demote this admin to User?", confirmText: "Demote", danger: true });
    if (!ok) return;
    manageUser("demote", userId);
  }

  async function onDelete(userId) {
    const ok = await openConfirm({ title: "Delete User", message: "Delete this user permanently?", confirmText: "Delete", danger: true });
    if (!ok) return;
    manageUser("delete", userId);
  }

  if (!user) return null;

  return (
    <>
      <AdminLayout title={isSuperAdmin ? "SuperAdmin Control" : "Admin Control"}>
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

        {active === "dashboard" ? (
          <>
            <section className="section">
              <div className="grid grid-3">
                <article className="card stat-card">
                  <div className="card-subtitle">Active Model</div>
                  <div className="stat-card-value">{workflow.active ? "1" : "0"}</div>
                  <p className="text-muted">Published active model for selected module</p>
                </article>
                <article className="card stat-card">
                  <div className="card-subtitle">Draft Models</div>
                  <div className="stat-card-value">{(workflow.drafts || []).length}</div>
                  <p className="text-muted">Drafts available for preview/publish</p>
                </article>
                <article className="card stat-card">
                  <div className="card-subtitle">Recent Jobs</div>
                  <div className="stat-card-value">{(workflow.jobs || []).length}</div>
                  <p className="text-muted">Latest model training jobs</p>
                </article>
              </div>
            </section>

            <section className="section">
              <article className="card">
                <div className="card-header workflow-header">
                  <div>
                    <h3 className="card-title">Model Workflow</h3>
                    <p className="text-muted workflow-subtitle">Select a module to retrain, publish drafts, or rollback safely.</p>
                  </div>
                  <div className="workflow-toolbar">
                    <button className="btn btn-accent" onClick={runRetrain} disabled={workingAction === "retrain"}>
                      {workingAction === "retrain" ? "Retraining..." : "Retrain Selected"}
                    </button>
                    <button className="btn btn-outline" onClick={rollbackModel} disabled={workingAction === "rollback"}>
                      {workingAction === "rollback" ? "Rolling back..." : "Rollback"}
                    </button>
                  </div>
                </div>

                <div className="module-grid">
                  {RETRAIN_MODULES.map((module) => {
                    const isActive = module.value === selectedModule;
                    return (
                      <button
                        key={module.value}
                        type="button"
                        className={`module-tile ${isActive ? "module-tile-active" : ""}`}
                        onClick={() => setSelectedModule(module.value)}
                      >
                        <div className="module-tile-top">
                          <span className="module-tile-icon">{module.icon}</span>
                          {isActive ? <span className="badge badge-accent">Selected</span> : null}
                        </div>
                        <div className="module-tile-title">{module.label}</div>
                        <div className="module-tile-desc">{module.description}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr><th>ID</th><th>Name</th><th>Trained</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {(workflow.drafts || []).map((draft) => (
                        <tr key={draft.id}>
                          <td>{draft.id}</td>
                          <td>{draft.name}</td>
                          <td>{new Date(draft.trained_at).toLocaleString()}</td>
                          <td>
                            <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => previewDraft(draft.id)} disabled={workingAction === `preview-${draft.id}`}>
                              Preview Draft
                            </button>
                            <button className="btn btn-accent" style={{ padding: "0.45rem 0.85rem" }} onClick={() => publishDraft(draft.id)} disabled={workingAction === `publish-${draft.id}`}>
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
        ) : null}

        {active === "users" && isSuperAdmin ? (
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
                        <td><span className={u.role === "SuperAdmin" ? "badge badge-accent" : "badge badge-soft"}>{u.role}</span></td>
                        <td>
                          {u.role !== "SuperAdmin" ? (
                            <>
                              <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => onPromote(u.id)}>Promote</button>
                              <button className="btn btn-outline" style={{ marginRight: "0.5rem", padding: "0.45rem 0.85rem" }} onClick={() => onDemote(u.id)}>Demote</button>
                              <button className="btn btn-outline" style={{ padding: "0.45rem 0.85rem", borderColor: "rgba(255,107,107,0.5)", color: "#ff8e8e" }} onClick={() => onDelete(u.id)}>Delete</button>
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
        ) : null}
      </AdminLayout>

      <Modal
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmText}
        cancelLabel={dialog.cancelText}
        danger={dialog.danger}
        onClose={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
      />
    </>
  );
}
