import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch, clearSession, getToken } from "../services/api";

export default function Dashboard() {
  const nav = useNavigate();
  const [budget, setBudget] = useState(0.0);
  const [transfers, setTransfers] = useState(0);
  const [user, setUser] = useState(null);
  const [hasTeamStored, setHasTeamStored] = useState(false);
  const [teamStorageKey, setTeamStorageKey] = useState(null);
  const [currentGw, setCurrentGw] = useState(null);
  const [deadlineTime, setDeadlineTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [captainPreview, setCaptainPreview] = useState(null);
  const [playerPreview, setPlayerPreview] = useState(null);
  const [matchPreview, setMatchPreview] = useState(null);

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
    const token = getToken();
    if (!token) {
      nav("/login");
      return;
    }

    (async () => {
      try {
        const me = await apiFetch("/api/auth/me/");
        setUser(me);

        const userId = Number(me?.id || 0);
        const key = userId > 0 ? `fplTeamState:user:${userId}` : null;
        setTeamStorageKey(key);

        const stored = key ? JSON.parse(localStorage.getItem(key) || "{}") : {};
        const remainingBudget = typeof stored.remainingBudget === "number" ? stored.remainingBudget : 0;
        const freeTransfers = typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0;

        setBudget(remainingBudget);
        setTransfers(freeTransfers);
        setHasTeamStored(stored?.teamStored === true);
      } catch {
        clearSession();
        nav("/login");
      }
    })();
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


  useEffect(() => {
    let active = true;

    async function loadCaptainPreview() {
      try {
        const res = await apiFetch("/api/predictions/captaincy/?limit=20");
        if (!active) return;
        const picks = Array.isArray(res?.picks) ? res.picks : [];
        const top = picks[0] || null;
        const topByPoints = picks.reduce((best, p) => {
          if (!best) return p;
          return (p?.predicted_points || 0) > (best?.predicted_points || 0) ? p : best;
        }, null);

        if (top) {
          setCaptainPreview({
            gameweek: res?.gameweek,
            name: top.name,
            team: top.team,
            position: top.position,
            predictedPoints: top.predicted_points,
            confidence: top.model_confidence,
          });
        }

        if (topByPoints) {
          setPlayerPreview({
            gameweek: res?.gameweek,
            name: topByPoints.name,
            team: topByPoints.team,
            position: topByPoints.position,
            predictedPoints: topByPoints.predicted_points,
            confidence: topByPoints.model_confidence,
          });
        }
      } catch {
        // keep static fallback if captaincy endpoint is unavailable
      }
    }

    loadCaptainPreview();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMatchPreview() {
      try {
        const res = await apiFetch("/api/predictions/match-upcoming/");
        if (!active) return;

        const fixtures = Array.isArray(res?.fixtures) ? res.fixtures : [];
        if (!fixtures.length) return;

        const best = fixtures.reduce((top, fx) => {
          const p = fx?.prediction?.probs || {};
          const conf = Math.max(Number(p.home || 0), Number(p.draw || 0), Number(p.away || 0));
          if (!top || conf > top.confidence) {
            return {
              fixture: fx,
              confidence: conf,
            };
          }
          return top;
        }, null);

        if (!best?.fixture) return;
        setMatchPreview({
          gw: res?.gameweek,
          home: best.fixture?.home_team?.name || "Home",
          away: best.fixture?.away_team?.name || "Away",
          outcome: best.fixture?.prediction?.outcome || "-",
          homeXg: best.fixture?.prediction?.home_xg,
          awayXg: best.fixture?.prediction?.away_xg,
          confidence: best.confidence,
        });
      } catch {
        // keep static fallback if upcoming match endpoint is unavailable
      }
    }

    loadMatchPreview();

    return () => {
      active = false;
    };
  }, []);
  function simulateNewGameweek() {
    if (!teamStorageKey) {
      alert("No user-specific team data found.");
      return;
    }

    const stored = JSON.parse(localStorage.getItem(teamStorageKey) || "{}");
    let freeTransfers = typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0;

    freeTransfers = Math.min(freeTransfers + 1, 2);
    stored.freeTransfers = freeTransfers;
    localStorage.setItem(teamStorageKey, JSON.stringify(stored));

    setTransfers(freeTransfers);
    alert("New gameweek simulated (mock): free transfers now = " + freeTransfers);
  }

  function logout() {
    clearSession();
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
                  <span className="badge badge-accent">Match Model</span>
                </div>
                <p className="text-muted">Best captain for next gameweek</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>{captainPreview?.name || "Loading..."}</strong>
                      <div className="text-muted">
                        {(captainPreview?.position === 1 ? "GK" : captainPreview?.position === 2 ? "DEF" : captainPreview?.position === 3 ? "MID" : captainPreview?.position === 4 ? "FWD" : "-")} | {captainPreview?.team || "-"}
                      </div>
                    </div>
                    <div className="player-stat-right">
                      <div className="text-accent player-main-stat">{captainPreview?.predictedPoints ?? "-"} pts</div>
                      <div className="player-sub-label">Confidence: {captainPreview?.confidence ? `${Math.round(captainPreview.confidence * 100)}%` : "-"}</div>
                    </div>
                  </div>
                </div>
                <p className="dashboard-card-cta">Open Captaincy Analyzer ?</p>
              </article>
            </Link>

            <Link to="/predictions" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Player Predictions</h3>
                  <span className="badge badge-soft">Top performer</span>
                </div>
                <p className="text-muted">Highest predicted points next gameweek</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>{playerPreview?.name || "Loading..."}</strong>
                      <div className="text-muted">
                        {(playerPreview?.position === 1 ? "GK" : playerPreview?.position === 2 ? "DEF" : playerPreview?.position === 3 ? "MID" : playerPreview?.position === 4 ? "FWD" : "-")} | {playerPreview?.team || "-"}
                      </div>
                    </div>
                    <div className="player-stat-right">
                      <div className="text-accent player-main-stat">{playerPreview?.predictedPoints ?? "-"} pts</div>
                      <div className="player-sub-label">Confidence: {playerPreview?.confidence ? `${Math.round(playerPreview.confidence * 100)}%` : "-"}</div>
                    </div>
                  </div>
                </div>
                <p className="dashboard-card-cta">View all predictions &rarr;</p>
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
                  <span className="badge badge-accent">Match Model</span>
                </div>
                <p className="text-muted">Most confident next-gameweek prediction</p>
                <div className="player-card" style={{ marginTop: "0.8rem" }}>
                  <div className="player-row">
                    <div>
                      <strong>{matchPreview ? `${matchPreview.home} vs ${matchPreview.away}` : "Loading..."}</strong>
                      <div className="text-muted">
                        {matchPreview ? `GW ${matchPreview.gw} | xG ${matchPreview.homeXg}-${matchPreview.awayXg}` : "-"}
                      </div>
                    </div>
                    <div className="player-stat-right">
                      <div className="text-accent player-main-stat">{matchPreview?.outcome || "-"}</div>
                      <div className="player-sub-label">{matchPreview?.confidence ? `${Math.round(matchPreview.confidence * 100)}% confidence` : "-"}</div>
                    </div>
                  </div>
                </div>
                <p className="dashboard-card-cta">View all match predictions &rarr;</p>
              </article>
            </Link>

            <Link to="/fixtures" className="dashboard-card">
              <article className="card dashboard-card-inner">
                <div className="card-header">
                  <h3 className="card-title">Fixtures & FDR</h3>
                  <span className="badge badge-soft">Fixture Model</span>
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
                  Status: <span className="text-accent">{hasTeamStored ? "Team synced" : "Team not synced"}</span>
                </p>
                <ul className="team-status-list">
                  <li>• Store remaining budget & free transfers</li>
                  <li>• Enter your 15-man squad</li>
                  <li>• Enable Budget Optimizer</li>
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



















