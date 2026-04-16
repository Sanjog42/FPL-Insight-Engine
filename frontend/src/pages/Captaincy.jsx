import { useEffect, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../layouts/AppLayout";
import { apiFetch } from "../services/api";

const POSITION_MAP = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export default function Captaincy() {
  useAuthGuard();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadCaptaincyPicks() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch("/api/predictions/captaincy/?limit=10");
        if (!active) return;
        setResult(res);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load captaincy picks.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCaptaincyPicks();
    return () => {
      active = false;
    };
  }, []);

  const picks = result?.picks || [];

  return (
    <AppLayout
      title="Captaincy Analyzer"
      subtitle="Top 10 ML captaincy picks are generated automatically for the next gameweek."
    >
      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top 10 Captaincy Picks</h3>
            <span className="badge badge-accent">GW {result?.gameweek || "-"}</span>
          </div>

          {loading ? <p className="text-muted">Loading ML picks...</p> : null}
          {error ? <p style={{ color: "#ef4444" }}>{error}</p> : null}

          {!loading && !error && picks.length === 0 ? (
            <p className="text-muted">No picks available for the next gameweek.</p>
          ) : null}

          <div className="grid grid-2" style={{ marginTop: "0.8rem" }}>
            {picks.map((pick) => (
              <div key={pick.player_id} className="player-card">
                <div className="player-row">
                  <div>
                    <strong>
                      #{pick.rank} {pick.name}
                    </strong>
                    <div className="text-muted">
                      {POSITION_MAP[pick.position] || "-"} | {pick.team || "-"} | vs {pick.opponent || "-"} ({pick.venue})
                    </div>
                  </div>
                  <div className="player-stat-right">
                    <div className="text-accent player-main-stat">{pick.predicted_points} pts</div>
                    <div className="player-sub-label">Captaincy Score: {pick.captaincy_score}</div>
                    <div className="player-sub-label">Confidence: {Math.round((pick.model_confidence || 0) * 100)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

