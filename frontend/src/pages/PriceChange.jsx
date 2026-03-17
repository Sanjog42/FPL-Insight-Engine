import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

export default function PriceChange() {
  useAuthGuard();

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [search, setSearch] = useState("");
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

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (onlyAvailable && p.status && p.status !== "a") {
        return false;
      }
      if (!q) return true;
      const team = teamMap.get(p.team);
      const teamName = `${team?.short_name || ""} ${team?.name || ""}`.toLowerCase();
      const name = `${p.first_name} ${p.second_name} ${p.web_name || ""}`.toLowerCase();
      return name.includes(q) || teamName.includes(q);
    });
  }, [players, teamMap, search, onlyAvailable]);

  const playerOptions = useMemo(() => {
    return filteredPlayers.map((p) => {
      const team = teamMap.get(p.team);
      const teamShort = team?.short_name || team?.name || "UNK";
      return {
        id: p.id,
        name: `${p.first_name} ${p.second_name} (${teamShort})`,
      };
    });
  }, [filteredPlayers, teamMap]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setResult(null);
    if (!playerId) {
      setErr("Please select a player.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/predictions/price/", {
        method: "POST",
        body: JSON.stringify({ player_id: Number(playerId) }),
      });
      setResult(res);
    } catch (ex) {
      setErr(ex.message || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  const directionColor =
    result?.direction === "RISE"
      ? "#22c55e"
      : result?.direction === "FALL"
        ? "#ef4444"
        : "#eab308";

  return (
    <AppLayout
      title="Price Change Predictor"
      subtitle="Predict whether a player's price will rise, fall, or stay stable."
    >
      <section className="section">
        <div className="card">
          <div className="grid grid-3" style={{ marginBottom: "1rem" }}>
            <div className="form-group">
              <label className="label">Search player</label>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or team..."
              />
            </div>
            <div className="form-group">
              <label className="label">Availability</label>
              <div className="pill-row">
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
            <div className="form-group" style={{ alignSelf: "end" }}>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => loadPlayers(true)}
                disabled={loadingPlayers}
              >
                {loadingPlayers ? "Refreshing..." : "Refresh data"}
              </button>
            </div>
          </div>

          <div className="inline-note">
            Showing {playerOptions.length} of {players.length} players
          </div>

          <form className="grid grid-3" onSubmit={submit}>
            <div className="form-group">
              <label className="label">Player</label>
              <select
                className="input"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                required
              >
                <option value="">Select player...</option>
                {playerOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ alignSelf: "end" }}>
              <button className="btn btn-accent" type="submit" disabled={loading}>
                {loading ? "Predicting..." : "Predict Price"}
              </button>
            </div>
          </form>

          {err ? <p style={{ color: "#ef4444" }}>{err}</p> : null}

          {result ? (
            <div className="player-card" style={{ marginTop: "1rem" }}>
              <div className="player-row">
                <div>
                  <strong>Price Direction</strong>
                  <div className="text-muted">Player ID {result.player_id}</div>
                </div>
                <div className="player-stat-right">
                  <div className="player-main-stat" style={{ color: directionColor }}>
                    {result.direction}
                  </div>
                  <div className="player-sub-label">
                    Probability: {Math.round(result.probability * 100)}%
                  </div>
                  {result.features_used?.data_source === "bootstrap-only" ? (
                    <div className="player-sub-label">Limited recent history</div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-2" style={{ marginTop: "0.8rem" }}>
                <div className="card mini-card">
                  <div className="card-subtitle">Trend Slope</div>
                  <div className="card-title">{result.features_used.trend_slope}</div>
                </div>
                <div className="card mini-card">
                  <div className="card-subtitle">History Points</div>
                  <div className="card-title">{result.features_used.history_points}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
