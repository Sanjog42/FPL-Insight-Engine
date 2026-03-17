import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch, setToken, setRefreshToken, getToken } from "../services/api";

export default function Dashboard() {
  const nav = useNavigate();
  const [budget, setBudget] = useState(0.0);
  const [transfers, setTransfers] = useState(0);
  const [user, setUser] = useState(null);
  const [hasTeamStored, setHasTeamStored] = useState(false);
  const [currentGw, setCurrentGw] = useState(null);
  const [deadlineTime, setDeadlineTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");

  function formatTimeLeft(target) {
    if (!target) return "";
    const diffMs = target - Date.now();
    if (diffMs <= 0) return "Deadline passed";
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const dayPart = days > 0 ? `${days}d ` : "";
    const hourPart = `${hours}h`.padStart(3, "0");
    const minPart = `${minutes}m`.padStart(3, "0");
    return `DL in ${dayPart}${hourPart} ${minPart}`;
  }

  function formatLocalDeadline(target) {
    if (!target) return "Deadline unavailable";
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(target));
  }

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
        const me = await apiFetch("/api/auth/me/");
        setUser(me);
      } catch {
        setToken(null);
        nav("/login");
      }
    })();

    // Load stored team state from localStorage (same logic as your HTML)
    const raw = localStorage.getItem("fplTeamState");
    const stored = JSON.parse(raw || "{}");
    const remainingBudget = typeof stored.remainingBudget === "number" ? stored.remainingBudget : 0;
    const freeTransfers = typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0;

    setBudget(remainingBudget);
    setTransfers(freeTransfers);
    setHasTeamStored(stored?.teamStored === true);
  }, [nav]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadBootstrap() {
      try {
        const res = await apiFetch("/api/fpl/bootstrap/", { signal: controller.signal });
        const events = res?.data?.events || [];
        const next = events.find((e) => e.is_next);
        if (!next) return;
        const deadline = next.deadline_time ? new Date(next.deadline_time).getTime() : null;
        if (active) {
          setCurrentGw(next.id ?? null);
          setDeadlineTime(deadline);
        }
      } catch {
        // ignore bootstrap errors; keep fallback UI
      }
    }

    loadBootstrap();

    const timer = setInterval(() => {
      if (!deadlineTime) return;
      setTimeLeft(formatTimeLeft(deadlineTime));
    }, 30 * 1000);

    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [deadlineTime]);

  useEffect(() => {
    setTimeLeft(formatTimeLeft(deadlineTime));
  }, [deadlineTime]);

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

  const displayName = user?.full_name?.trim() || user?.username || "User";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "U";

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
              <span className="profile-avatar">{initials}</span>
              <span className="profile-name">{displayName}</span>
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
                  <div className="card-title">
                    {currentGw ? `Gameweek ${currentGw}` : "Gameweek --"}
                  </div>
                </div>
              </div>
              <div className="stat-card-value">
                {timeLeft || "Loading deadline..."}
              </div>
              <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                Deadline: {formatLocalDeadline(deadlineTime)}
              </p>
            </article>

            <article className="card stat-card">
              <div className="card-header">
                <div>
                  <div className="card-subtitle">Budget Remaining</div>
                  <div className="card-title">Money in the bank</div>
                </div>
              </div>
              <div className="stat-card-value">{hasTeamStored ? `�${budget.toFixed(1)}M` : "None"}</div>
              <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                {hasTeamStored ? "Budget loaded from stored team." : "Store your team to load budget."}
              </p>
            </article>

            <article className="card stat-card">
              <div className="card-header">
                <div>
                  <div className="card-subtitle">Transfers Remaining</div>
                  <div className="card-title">This Gameweek</div>
                </div>
              </div>
              <div className="stat-card-value">{hasTeamStored ? transfers : "None"}</div>
              <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                {hasTeamStored ? "Free transfers loaded from stored team." : "Store your team to load transfers."}
              </p>
            </article>
          </div>
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





