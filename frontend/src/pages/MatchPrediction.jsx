import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

export default function MatchPrediction() {
  useAuthGuard();

  const [teams, setTeams] = useState([]);
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/fpl/bootstrap/");
        setTeams(res?.data?.teams || []);
      } catch (ex) {
        setErr(ex.message || "Failed to load teams.");
      }
    })();
  }, []);

  const teamOptions = useMemo(() => {
    return teams.map((t) => ({ id: t.id, name: t.name }));
  }, [teams]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setResult(null);
    if (!homeId || !awayId) {
      setErr("Please select both home and away teams.");
      return;
    }
    if (homeId === awayId) {
      setErr("Home and away teams must be different.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/predictions/match/", {
        method: "POST",
        body: JSON.stringify({
          home_team_id: Number(homeId),
          away_team_id: Number(awayId),
        }),
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
      title="Match Outcome Predictor"
      subtitle="Expected W/D/L plus projected xG using team strength proxies."
    >
      <section className="section">
        <div className="card">
          <form className="grid grid-3" onSubmit={submit}>
            <div className="form-group">
              <label className="label">Home Team</label>
              <select
                className="input"
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                required
              >
                <option value="">Select home team...</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Away Team</label>
              <select
                className="input"
                value={awayId}
                onChange={(e) => setAwayId(e.target.value)}
                required
              >
                <option value="">Select away team...</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ alignSelf: "end" }}>
              <button className="btn btn-accent" type="submit" disabled={loading}>
                {loading ? "Predicting..." : "Predict Match"}
              </button>
            </div>
          </form>

          {err ? <p style={{ color: "#ef4444" }}>{err}</p> : null}

          {result ? (
            <div className="player-card" style={{ marginTop: "1rem" }}>
              <div className="player-row">
                <div>
                  <strong>Outcome</strong>
                  <div className="text-muted">HOME / DRAW / AWAY</div>
                </div>
                <div className="player-stat-right">
                  <div className="text-accent player-main-stat">{result.outcome}</div>
                  <div className="player-sub-label">
                    xG: {result.home_xg} - {result.away_xg}
                  </div>
                </div>
              </div>

              <div className="grid grid-3" style={{ marginTop: "0.8rem" }}>
                <div className="card mini-card">
                  <div className="card-subtitle">Home Win</div>
                  <div className="card-title">
                    {Math.round(result.probs.home * 100)}%
                  </div>
                </div>
                <div className="card mini-card">
                  <div className="card-subtitle">Draw</div>
                  <div className="card-title">
                    {Math.round(result.probs.draw * 100)}%
                  </div>
                </div>
                <div className="card mini-card">
                  <div className="card-subtitle">Away Win</div>
                  <div className="card-title">
                    {Math.round(result.probs.away * 100)}%
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
