import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch, setToken, setRefreshToken, getToken } from "../services/api";

export default function Dashboard() {
  const nav = useNavigate();
  const [budget, setBudget] = useState(0.0);
  const [transfers, setTransfers] = useState(0);

  useEffect(() => {
    // 🔒 Basic protection: if no token, go to login
    const token = getToken();
    if (!token) {
      nav("/login");
      return;
    }

    // Optional: verify token/user
    (async () => {
      try {
        await apiFetch("/api/auth/me/");
      } catch {
        setToken(null);
        nav("/login");
      }
    })();

    // Load stored team state from localStorage (same logic as your HTML)
    const stored = JSON.parse(localStorage.getItem("fplTeamState") || "{}");
    const remainingBudget = typeof stored.remainingBudget === "number" ? stored.remainingBudget : 0;
    const freeTransfers = typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0;

    setBudget(remainingBudget);
    setTransfers(freeTransfers);
  }, [nav]);

  function simulateNewGameweek() {
    const stored = JSON.parse(localStorage.getItem("fplTeamState") || "{}");
    let freeTransfers = typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0;

    freeTransfers = Math.min(freeTransfers + 1, 2);
    stored.freeTransfers = freeTransfers;
    localStorage.setItem("fplTeamState", JSON.stringify(stored));

    setTransfers(freeTransfers);
    alert("New gameweek simulated (mock): free transfers now = " + freeTransfers);
  }

  function logout() {
    setToken(null);
    setRefreshToken(null);
    nav("/login");
  }

  return (
    <div className="app">
      <main className="content dashboard-shell">
        {/* Header */}
        <header className="page-header">
          <div className="page-title">
            <span className="page-title-accent">FPL</span> Insight Engine
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link to="/profile" className="profile-pill">
              <span className="profile-avatar">FM</span>
              <span className="profile-name">fpl_manager_2024</span>
            </Link>

            <button className="btn btn-outline" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        {/* Overview */}
        <section className="section">
          <h1 className="h1">Manager Dashboard</h1>
          <p className="text-muted">
            Central analytics hub for your Fantasy Premier League team. Access every feature from this dashboard.
          </p>
        </section>

        {/* Core Stats */}
        <section className="section">
          <div className="grid grid-3">
            <article className="card stat-card">
              <div className="card-header">
                <div>
                  <div className="card-subtitle">Current Gameweek</div>
                  <div className="card-title">Gameweek 15</div>
                </div>
              </div>
              <div className="stat-card-value">DL in 2d 04h</div>
              <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                Deadline approaching – finalize your team.
              </p>
            </article>

            <article className="card stat-card">
              <div className="card-header">
                <div>
                  <div className="card-subtitle">Budget Remaining</div>
                  <div className="card-title">Money in the bank</div>
                </div>
              </div>
              <div className="stat-card-value">£{budget.toFixed(1)}M</div>
              <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                Store your team to load budget.
              </p>
            </article>

            <article className="card stat-card">
              <div className="card-header">
                <div>
                  <div className="card-subtitle">Transfers Remaining</div>
                  <div className="card-title">This Gameweek</div>
                </div>
              </div>
              <div className="stat-card-value">{transfers}</div>
              <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                Free transfers update after storing team.
              </p>
            </article>
          </div>
        </section>

        {/* Simulate New Gameweek */}
        <section className="section">
          <button className="btn btn-outline" onClick={simulateNewGameweek}>
            🔄 Simulate New Gameweek (+1 Free Transfer, max 2)
          </button>
        </section>

        {/* Feature Cards */}
        <section className="section">
          <h2 className="h2">Analytics Modules</h2>
          <p className="text-muted" style={{ marginBottom: "1.25rem" }}>
            Click any card to open the full page. Each card shows a preview insight based on mock data.
          </p>

          <div className="grid dash-grid">
            <Link to="/captaincy" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Captaincy Analyzer</h3>
                  <span className="badge badge-accent">GW 15</span>
                </div>
                <p className="text-muted">Best captain right now</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>Erling Haaland</strong>
                      <div className="text-muted">FWD • MCI</div>
                    </div>
                    <div className="player-stat-right">
                      <div className="text-accent player-main-stat">12.8 pts</div>
                      <div className="player-sub-label">Risk: Medium</div>
                    </div>
                  </div>
                </div>
                <p className="dashboard-card-cta">Open Captaincy Analyzer →</p>
              </article>
            </Link>

            <Link to="/predictions" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Player Predictions</h3>
                  <span className="badge badge-soft">Top performer</span>
                </div>
                <p className="text-muted">Highest predicted points</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>Mohamed Salah</strong>
                      <div className="text-muted">MID • LIV</div>
                    </div>
                    <div className="player-stat-right">
                      <div className="text-accent player-main-stat">13.2 pts</div>
                      <div className="player-sub-label">Confidence: 86%</div>
                    </div>
                  </div>
                </div>
                <p className="dashboard-card-cta">View all predictions →</p>
              </article>
            </Link>

            <Link to="/price-change" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Price Change Prediction</h3>
                  <span className="badge badge-soft">Next 7 days</span>
                </div>
                <p className="text-muted">Most likely to rise</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>Bukayo Saka</strong>
                      <div className="text-muted">MID • ARS • £8.9M</div>
                    </div>
                    <div className="player-stat-right">
                      <div className="player-main-stat" style={{ color: "#22c55e" }}>+£0.2M</div>
                      <div className="player-sub-label">78% chance</div>
                    </div>
                  </div>
                </div>
                <p className="dashboard-card-cta">View price predictions →</p>
              </article>
            </Link>

            <Link to="/match-prediction" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Match Prediction</h3>
                  <span className="badge badge-accent">GW 15</span>
                </div>
                <p className="text-muted">Top fixture this week</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>Liverpool vs Luton</strong>
                      <div className="text-muted">Anfield • Sat 15:00</div>
                    </div>
                    <div className="player-stat-right">
                      <div className="text-accent player-main-stat">3-0</div>
                      <div className="player-sub-label">85% confidence</div>
                    </div>
                  </div>
                </div>
                <p className="dashboard-card-cta">View all match predictions →</p>
              </article>
            </Link>

            <Link to="/fixtures" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Fixtures & FDR</h3>
                  <span className="badge badge-soft">GW 15</span>
                </div>
                <p className="text-muted">Easiest fixture this week (home team)</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>Liverpool vs Luton</strong>
                      <div className="text-muted">Anfield • Home attack vs 20th</div>
                    </div>
                    <span className="fdr-pill fdr-2">FDR: 2 (Easy)</span>
                  </div>
                </div>
                <p className="dashboard-card-cta">Open Fixtures & FDR →</p>
              </article>
            </Link>

            <Link to="/team" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Store My Team</h3>
                  <span className="badge badge-accent">Required for budget</span>
                </div>
                <p className="text-muted">
                  Status: <span className="text-accent">Team not synced (mock)</span>
                </p>
                <ul className="team-status-list">
                  <li>• Store remaining budget & free transfers</li>
                  <li>• Enter your 15-man squad</li>
                  <li>• Enable Budget Optimizer for GW 15</li>
                </ul>
                <p className="dashboard-card-cta">View / Update stored team →</p>
              </article>
            </Link>

            <Link to="/compare" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Player Comparison</h3>
                  <span className="badge badge-soft">Head-to-head</span>
                </div>
                <p className="text-muted">Quick snapshot: Salah vs Haaland</p>
                <div className="grid grid-2 compare-mini" style={{ marginTop: "0.8rem" }}>
                  <div>
                    <strong>Mohamed Salah</strong>
                    <div className="text-muted">Pts: 145 • Price: £13.0M</div>
                  </div>
                  <div>
                    <strong>Erling Haaland</strong>
                    <div className="text-muted">Pts: 132 • Price: £14.5M</div>
                  </div>
                </div>
                <p className="dashboard-card-cta">Open Player Comparison →</p>
              </article>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
