import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positionCode(elementType) {
  if (elementType === 1) return "GK";
  if (elementType === 2) return "DEF";
  if (elementType === 3) return "MID";
  if (elementType === 4) return "FWD";
  return "-";
}

export default function Compare() {
  useAuthGuard();

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [predictionMap, setPredictionMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      setLoading(true);
      setErr("");
      try {
        const res = await apiFetch("/api/fpl/bootstrap/");
        if (!active) return;
        const loadedPlayers = res?.data?.elements || [];
        const loadedTeams = res?.data?.teams || [];

        setPlayers(loadedPlayers);
        setTeams(loadedTeams);

        const top = [...loadedPlayers]
          .sort((a, b) => safeNum(b.total_points) - safeNum(a.total_points))
          .slice(0, 2);

        if (top[0]) setLeftId(String(top[0].id));
        if (top[1]) setRightId(String(top[1].id));
      } catch (ex) {
        if (!active) return;
        setErr(ex?.message || "Failed to load player data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!leftId || !rightId || leftId === rightId) return;

    let active = true;

    async function loadPredictions() {
      setPredicting(true);
      try {
        const [leftPred, rightPred] = await Promise.all([
          apiFetch("/api/predictions/player-points/", {
            method: "POST",
            body: JSON.stringify({ player_id: Number(leftId) }),
          }),
          apiFetch("/api/predictions/player-points/", {
            method: "POST",
            body: JSON.stringify({ player_id: Number(rightId) }),
          }),
        ]);

        if (!active) return;
        setPredictionMap({
          [leftId]: leftPred,
          [rightId]: rightPred,
        });
      } catch {
        // keep working with base stats only
      } finally {
        if (active) setPredicting(false);
      }
    }

    loadPredictions();

    return () => {
      active = false;
    };
  }, [leftId, rightId]);

  const teamMap = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const leftPlayer = players.find((p) => String(p.id) === leftId) || null;
  const rightPlayer = players.find((p) => String(p.id) === rightId) || null;

  const leftPrediction = leftId ? predictionMap[leftId] : null;
  const rightPrediction = rightId ? predictionMap[rightId] : null;

  const options = useMemo(() => {
    return [...players]
      .sort((a, b) => safeNum(b.total_points) - safeNum(a.total_points))
      .map((p) => {
        const team = teamMap.get(p.team);
        return {
          id: p.id,
          label: `${p.first_name || ""} ${p.second_name || ""}`.trim() || p.web_name,
          team: team?.short_name || team?.name || "-",
          pos: positionCode(safeNum(p.element_type)),
        };
      });
  }, [players, teamMap]);

  const metrics = useMemo(() => {
    if (!leftPlayer || !rightPlayer) return [];

    const leftPrice = safeNum(leftPlayer.now_cost) / 10;
    const rightPrice = safeNum(rightPlayer.now_cost) / 10;
    const leftTotal = safeNum(leftPlayer.total_points);
    const rightTotal = safeNum(rightPlayer.total_points);

    return [
      {
        key: "predicted_points",
        label: "Predicted Points (Next GW)",
        left: safeNum(leftPrediction?.predicted_points),
        right: safeNum(rightPrediction?.predicted_points),
        better: "higher",
      },
      {
        key: "season_points",
        label: "Season Points",
        left: leftTotal,
        right: rightTotal,
        better: "higher",
      },
      {
        key: "form",
        label: "Form",
        left: safeNum(leftPlayer.form),
        right: safeNum(rightPlayer.form),
        better: "higher",
      },
      {
        key: "ppg",
        label: "Points Per Game",
        left: safeNum(leftPlayer.points_per_game),
        right: safeNum(rightPlayer.points_per_game),
        better: "higher",
      },
      {
        key: "value",
        label: "Value (Pts Per Million)",
        left: leftTotal / Math.max(leftPrice, 1),
        right: rightTotal / Math.max(rightPrice, 1),
        better: "higher",
      },
      {
        key: "ownership",
        label: "Ownership %",
        left: safeNum(leftPlayer.selected_by_percent),
        right: safeNum(rightPlayer.selected_by_percent),
        better: "higher",
      },
    ];
  }, [leftPlayer, rightPlayer, leftPrediction, rightPrediction]);

  function winnerClass(metric, side) {
    const { left, right } = metric;
    const isTie = Math.abs(left - right) < 1e-6;
    if (isTie) return "";

    const leftWins = metric.better === "higher" ? left > right : left < right;
    if (side === "left") return leftWins ? "compare-win" : "";
    return leftWins ? "" : "compare-win";
  }

  function formatMetric(metric, value) {
    if (metric.key === "predicted_points" || metric.key === "ppg" || metric.key === "form" || metric.key === "value") {
      return value.toFixed(2);
    }
    if (metric.key === "ownership") {
      return `${value.toFixed(1)}%`;
    }
    return String(Math.round(value));
  }

  function playerSubtitle(player) {
    if (!player) return "-";
    const team = teamMap.get(player.team);
    return `${positionCode(safeNum(player.element_type))} | ${team?.short_name || team?.name || "-"} | GBP ${(safeNum(player.now_cost) / 10).toFixed(1)}m`;
  }

  function swapPlayers() {
    setLeftId(rightId);
    setRightId(leftId);
  }

  return (
    <AppLayout
      title="Player Comparison"
      subtitle="Head-to-head comparison using live stats and ML next-gameweek prediction."
    >
      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Choose Players</h3>
            <span className="badge badge-soft">Live + ML</span>
          </div>

          <div className="grid grid-3" style={{ marginTop: "0.8rem" }}>
            <div className="form-group">
              <label className="label">Player A</label>
              <select className="input" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
                <option value="">Select player...</option>
                {options.map((o) => (
                  <option key={`left-${o.id}`} value={o.id}>
                    {o.label} ({o.pos} | {o.team})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ alignSelf: "end" }}>
              <button className="btn btn-outline" type="button" onClick={swapPlayers}>
                Swap Players
              </button>
            </div>

            <div className="form-group">
              <label className="label">Player B</label>
              <select className="input" value={rightId} onChange={(e) => setRightId(e.target.value)}>
                <option value="">Select player...</option>
                {options.map((o) => (
                  <option key={`right-${o.id}`} value={o.id}>
                    {o.label} ({o.pos} | {o.team})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? <p className="text-muted">Loading player pool...</p> : null}
          {predicting ? <p className="text-muted">Refreshing ML predictions...</p> : null}
          {err ? <p style={{ color: "#ef4444" }}>{err}</p> : null}
        </div>
      </section>

      {leftPlayer && rightPlayer && leftId !== rightId ? (
        <section className="section">
          <div className="card compare-shell">
            <div className="compare-head">
              <div className="compare-player-box">
                <div className="card-subtitle">Player A</div>
                <div className="compare-player-name">{`${leftPlayer.first_name || ""} ${leftPlayer.second_name || ""}`.trim() || leftPlayer.web_name}</div>
                <div className="text-muted">{playerSubtitle(leftPlayer)}</div>
              </div>

              <div className="compare-versus">VS</div>

              <div className="compare-player-box">
                <div className="card-subtitle">Player B</div>
                <div className="compare-player-name">{`${rightPlayer.first_name || ""} ${rightPlayer.second_name || ""}`.trim() || rightPlayer.web_name}</div>
                <div className="text-muted">{playerSubtitle(rightPlayer)}</div>
              </div>
            </div>

            <div className="compare-metrics">
              {metrics.map((metric) => {
                const maxVal = Math.max(metric.left, metric.right, 1);
                const leftWidth = (metric.left / maxVal) * 100;
                const rightWidth = (metric.right / maxVal) * 100;
                return (
                  <div key={metric.key} className="compare-metric-row">
                    <div className={`compare-metric-value compare-left ${winnerClass(metric, "left")}`}>
                      {formatMetric(metric, metric.left)}
                    </div>
                    <div className="compare-metric-center">
                      <div className="compare-metric-label">{metric.label}</div>
                      <div className="compare-bars">
                        <div className="compare-bar-track">
                          <div className="compare-bar-fill compare-bar-left" style={{ width: `${leftWidth}%` }} />
                        </div>
                        <div className="compare-bar-track">
                          <div className="compare-bar-fill compare-bar-right" style={{ width: `${rightWidth}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className={`compare-metric-value compare-right ${winnerClass(metric, "right")}`}>
                      {formatMetric(metric, metric.right)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </AppLayout>
  );
}
