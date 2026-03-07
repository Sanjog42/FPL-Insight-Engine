import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

export default function PriceChange() {
  useAuthGuard();

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/fpl/bootstrap/");
        setPlayers(res?.data?.elements || []);
        setTeams(res?.data?.teams || []);
      } catch (ex) {
        setErr(ex.message || "Failed to load player list.");
      }
    })();
  }, []);

  const teamMap = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const playerOptions = useMemo(() => {
    return players.map((p) => {
      const team = teamMap.get(p.team);
      const teamShort = team?.short_name || team?.name || "UNK";
      return {
        id: p.id,
        name: `${p.first_name} ${p.second_name} (${teamShort})`,
      };
    });
  }, [players, teamMap]);

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
