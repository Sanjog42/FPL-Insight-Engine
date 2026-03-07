import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

export default function Predictions() {
  useAuthGuard();

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [gameweek, setGameweek] = useState("");
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
      const payload = {
        player_id: Number(playerId),
        gameweek: gameweek ? Number(gameweek) : null,
      };
      const res = await apiFetch("/api/predictions/player-points/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
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

            <div className="form-group">
              <label className="label">Gameweek (optional)</label>
              <input
                className="input"
                type="number"
                min="1"
                value={gameweek}
                onChange={(e) => setGameweek(e.target.value)}
                placeholder="Auto"
              />
            </div>

            <div className="form-group" style={{ alignSelf: "end" }}>
              <button className="btn btn-accent" type="submit" disabled={loading}>
                {loading ? "Predicting..." : "Predict Points"}
              </button>
            </div>
          </form>

          {err ? <p style={{ color: "#ef4444" }}>{err}</p> : null}

          {result ? (
            <div className="player-card" style={{ marginTop: "1rem" }}>
              <div className="player-row">
                <div>
                  <strong>Predicted Points</strong>
                  <div className="text-muted">
                    GW {result.gameweek || "N/A"} â€¢ Player ID {result.player_id}
                  </div>
                </div>
                <div className="player-stat-right">
                  <div className="text-accent player-main-stat">
                    {result.predicted_points} pts
                  </div>
                  <div className="player-sub-label">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-3" style={{ marginTop: "0.8rem" }}>
                <div className="card mini-card">
                  <div className="card-subtitle">Avg Minutes</div>
                  <div className="card-title">{result.features_used.avg_minutes}</div>
                </div>
                <div className="card mini-card">
                  <div className="card-subtitle">Opponent Def Strength</div>
                  <div className="card-title">{result.features_used.opponent_defence_strength}</div>
                </div>
                <div className="card mini-card">
                  <div className="card-subtitle">Venue</div>
                  <div className="card-title">{result.features_used.venue}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
