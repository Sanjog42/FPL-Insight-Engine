import { useNavigate } from "react-router-dom";
import { setToken, setRefreshToken } from "../services/api";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    setRefreshToken(null);
    navigate("/login");
  };

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-4">
        <div>
          <h2 className="fw-bold mb-1">Admin Dashboard</h2>
          <p className="text-muted mb-0">
            Manage system data, predictions, and user activity.
          </p>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => navigate("/dashboard")}>
            Back to User Dashboard
          </button>
          <button className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="text-muted mb-0">Users</h6>
                <span className="badge text-bg-secondary">Admin</span>
              </div>
              <h3 className="fw-bold mb-1">—</h3>
              <p className="text-muted mb-0">Total registered users</p>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-2">Data Status</h6>
              <h3 className="fw-bold mb-1">—</h3>
              <p className="text-muted mb-0">Last FPL data sync</p>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-2">Predictions</h6>
              <h3 className="fw-bold mb-1">—</h3>
              <p className="text-muted mb-0">Models ready / runs today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h5 className="fw-semibold mb-2">Quick Actions</h5>
              <p className="text-muted mb-3">
                Use these actions to manage the system quickly.
              </p>

              <div className="d-grid gap-2">
                <button className="btn btn-primary" disabled>
                  Sync FPL Data (Coming next)
                </button>
                <button className="btn btn-outline-primary" disabled>
                  Run Points Prediction (Coming next)
                </button>
                <button className="btn btn-outline-primary" disabled>
                  Run Price Change Prediction (Coming next)
                </button>
              </div>

              <div className="alert alert-secondary mt-3 mb-0">
                Tip: Once you create backend endpoints, I’ll remove the <b>disabled</b> and connect these buttons.
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="col-12 col-lg-6">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <h5 className="fw-semibold mb-2">Recent Activity</h5>
              <p className="text-muted mb-3">Latest admin events and system updates.</p>

              <ul className="list-group">
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Admin access granted</span>
                  <span className="badge text-bg-success">OK</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Waiting for data sync module</span>
                  <span className="badge text-bg-warning">Pending</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Waiting for predictions module</span>
                  <span className="badge text-bg-warning">Pending</span>
                </li>
              </ul>

              <div className="mt-3 text-muted small">
                You can replace these with real logs later (API: <code>/api/admin/logs</code>).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
