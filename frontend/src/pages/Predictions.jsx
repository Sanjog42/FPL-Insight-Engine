import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

export default function Predictions() {
  useAuthGuard();

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadPlayers(force = false) {
    setLoadingPlayers(true);
    try {
      const res = await apiFetch(`/api/fpl/bootstrap/${force ? "?force_refresh=1" : ""}`);
      setPlayers(res?.data?.elements || []);
      setTeams(res?.data?.teams || []);
    } catch (ex) {
      setErr(ex.message || "Failed to load player list.");
    } finally {
      setLoadingPlayers(false);
    }
  }

  useEffect(() => {
    loadPlayers(false);
  }, []);

  const teamMap = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const selectablePlayers = useMemo(() => {
    return players
      .filter((p) => {
        if (onlyAvailable && p.status && p.status !== "a") {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  }, [players, onlyAvailable]);

  const playerOptions = useMemo(() => {
    return selectablePlayers.map((p) => {
      const team = teamMap.get(p.team);
      const teamShort = team?.short_name || team?.name || "UNK";
      const name = `${p.first_name || ""} ${p.second_name || ""}`.trim() || p.web_name;
      return {
        id: String(p.id),
        label: `${name} (${teamShort})`,
      };
    });
  }, [selectablePlayers, teamMap]);

  const optionByLabel = useMemo(() => {
    const map = new Map();
    playerOptions.forEach((o) => map.set(o.label.toLowerCase(), o.id));
    return map;
  }, [playerOptions]);
  const confidencePct = result?.confidence ? Math.round(result.confidence * 100) : 0;

  function onPlayerQueryChange(value) {
    setPlayerQuery(value);
    const matchedId = optionByLabel.get(value.trim().toLowerCase());
    setPlayerId(matchedId || "");
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setResult(null);

    const exactId = optionByLabel.get(playerQuery.trim().toLowerCase()) || playerId;
    if (!exactId) {
      setErr("Please pick a player from dropdown suggestions.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        player_id: Number(exactId),
      };
      const res = await apiFetch("/api/predictions/player-points/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPlayerId(exactId);
      setResult(res);
    } catch (ex) {
      setErr(ex.message || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout
      title="Player Points Predictor"
      subtitle="Predict points based on recent form, minutes, and opponent difficulty."
    >
      <section className="section">
        <div className="card predict-shell">
          <div className="predict-shell-top">
            <div>
              <div className="predict-kicker">Advanced Model</div>
              <h3 className="predict-title">Prediction Workspace</h3>
              <p className="predict-subtitle">
                Select a player, tune availability filters, and generate a data-backed points projection.
              </p>
            </div>
            <div className="predict-chip">
              <span className="predict-chip-label">Picker Pool</span>
              <span className="predict-chip-value">{playerOptions.length} players</span>
            </div>
          </div>

          <form className="predict-grid" onSubmit={submit}>
            <div className="predict-panel">
              <div className="form-group">
                <label className="label">Player</label>
                <input
                  className="input predict-input"
                  list="points-player-options"
                  value={playerQuery}
                  onChange={(e) => onPlayerQueryChange(e.target.value)}
                  placeholder="Search and select player..."
                />
                <datalist id="points-player-options">
                  {playerOptions.map((o) => (
                    <option key={o.id} value={o.label} />
                  ))}
                </datalist>
                <div className="form-helper">Type a player name and pick a suggestion</div>
              </div>

              <div className="form-group">
                <label className="label">Availability</label>
                <div className="predict-toggle-wrap">
                  <button
                    type="button"
                    className={`pill ${onlyAvailable ? "pill-active" : ""}`}
                    onClick={() => setOnlyAvailable(true)}
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    className={`pill ${!onlyAvailable ? "pill-active" : ""}`}
                    onClick={() => setOnlyAvailable(false)}
                  >
                    All Players
                  </button>
                </div>
              </div>
            </div>

            <div className="predict-actions">
              <button
                className="btn btn-outline predict-refresh-btn"
                type="button"
                onClick={() => loadPlayers(true)}
                disabled={loadingPlayers}
              >
                {loadingPlayers ? "Refreshing..." : "Refresh data"}
              </button>

              <button className="btn btn-accent predict-submit-btn" type="submit" disabled={loading}>
                {loading ? "Predicting..." : "Predict Points"}
              </button>
            </div>
          </form>

          {err ? <p className="predict-error">{err}</p> : null}

          {result ? (
            <div className="player-card predict-result">
              <div className="player-row">
                <div>
                  <strong className="predict-result-title">Predicted Points</strong>
                  <div className="text-muted">
                    GW {result.gameweek || "N/A"} - Player ID {result.player_id}
                  </div>
                </div>
                <div className="player-stat-right">
                  <div className="text-accent player-main-stat">
                    {result.predicted_points} pts
                  </div>
                  <div className="player-sub-label">Confidence: {confidencePct}%</div>
                  {result.features_used?.data_source === "bootstrap-only" ? (
                    <div className="player-sub-label">Limited recent history</div>
                  ) : null}
                </div>
              </div>

              <div className="predict-confidence-bar" aria-hidden="true">
                <div
                  className="predict-confidence-fill"
                  style={{ width: `${Math.max(8, confidencePct)}%` }}
                />
              </div>

              <div className="grid grid-3 predict-metrics">
                <div className="card mini-card predict-metric-card">
                  <div className="card-subtitle">How we estimated this</div>
                  <div className="card-title">Recent performance</div>
                </div>
                <div className="card mini-card predict-metric-card">
                  <div className="card-subtitle">Playing time check</div>
                  <div className="card-title">Expected minutes considered</div>
                </div>
                <div className="card mini-card predict-metric-card">
                  <div className="card-subtitle">Fixture difficulty</div>
                  <div className="card-title">Opponent strength considered</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
