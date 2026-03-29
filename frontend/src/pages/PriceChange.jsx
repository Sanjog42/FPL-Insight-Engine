import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function playerName(player) {
  if (!player) return "Unknown";
  return `${player.first_name || ""} ${player.second_name || ""}`.trim() || player.web_name || "Unknown";
}

function confidenceLabel(probability) {
  if (probability >= 0.8) return "High";
  if (probability >= 0.6) return "Medium";
  return "Low";
}

function directionLabel(direction) {
  if (direction === "RISE") return "Likely to Rise";
  if (direction === "FALL") return "Likely to Fall";
  return "Likely to Stay the Same";
}

function directionText(direction) {
  if (direction === "RISE") return "This player's price is expected to go up soon.";
  if (direction === "FALL") return "This player's price is expected to drop soon.";
  return "This player's price is likely to stay stable for now.";
}

function trendText(slope) {
  if (slope > 0.02) return "Recent trend: Upward";
  if (slope < -0.02) return "Recent trend: Downward";
  return "Recent trend: Flat";
}

export default function PriceChange() {
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
      .sort((a, b) => safeNum(b.total_points) - safeNum(a.total_points));
  }, [players, onlyAvailable]);

  const playerOptions = useMemo(() => {
    return selectablePlayers.map((p) => {
      const team = teamMap.get(p.team);
      const teamShort = team?.short_name || team?.name || "UNK";
      const label = `${playerName(p)} (${teamShort})`;
      return {
        id: String(p.id),
        label,
      };
    });
  }, [selectablePlayers, teamMap]);

  const optionByLabel = useMemo(() => {
    const map = new Map();
    playerOptions.forEach((o) => map.set(o.label.toLowerCase(), o.id));
    return map;
  }, [playerOptions]);

  const topPriceMovers = useMemo(() => {
    const pool = players.filter((p) => !p.status || p.status === "a");

    const scored = pool.map((p) => {
      const form = safeNum(p.form);
      const inEvent = safeNum(p.transfers_in_event);
      const outEvent = safeNum(p.transfers_out_event);
      const netTransfers = inEvent - outEvent;
      const eventChange = safeNum(p.cost_change_event) / 10;
      const startChange = safeNum(p.cost_change_start) / 10;
      const ownership = safeNum(p.selected_by_percent);

      const riseScore =
        (eventChange * 8.0)
        + (startChange * 2.0)
        + (netTransfers / 200000.0)
        + (form * 0.55)
        + (ownership * 0.02);

      const fallScore =
        ((-eventChange) * 8.0)
        + ((-startChange) * 2.0)
        + ((-netTransfers) / 200000.0)
        + ((6.0 - form) * 0.3)
        + ((20.0 - Math.min(20.0, ownership)) * 0.02);

      return {
        id: p.id,
        name: playerName(p),
        team: teamMap.get(p.team)?.short_name || teamMap.get(p.team)?.name || "-",
        price: (safeNum(p.now_cost) / 10).toFixed(1),
        riseScore,
        fallScore,
      };
    });

    const risers = [...scored]
      .sort((a, b) => b.riseScore - a.riseScore)
      .slice(0, 5)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    const fallers = [...scored]
      .sort((a, b) => b.fallScore - a.fallScore)
      .slice(0, 5)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    return { risers, fallers };
  }, [players, teamMap]);

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
      setErr("Please pick a player from the dropdown suggestions.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/predictions/price/", {
        method: "POST",
        body: JSON.stringify({ player_id: Number(exactId) }),
      });
      setPlayerId(exactId);
      setResult(res);
    } catch (ex) {
      setErr(ex.message || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  const selectedPlayer = players.find((p) => String(p.id) === String(playerId)) || null;

  const directionColor =
    result?.direction === "RISE"
      ? "#22c55e"
      : result?.direction === "FALL"
        ? "#ef4444"
        : "#eab308";

  return (
    <AppLayout
      title="Price Change Predictor"
      subtitle="Top likely risers/fallers plus an easy single-player outlook."
    >
      <section className="section">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Top 5 Likely Price Increases</h3>
              <span className="badge badge-accent">Risers</span>
            </div>
            <table className="table" style={{ marginTop: "0.5rem" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Price</th>
                  <th>Likelihood</th>
                </tr>
              </thead>
              <tbody>
                {topPriceMovers.risers.map((p) => (
                  <tr key={`rise-${p.id}`}>
                    <td>{p.rank}</td>
                    <td>{p.name}</td>
                    <td>{p.team}</td>
                    <td>GBP {p.price}m</td>
                    <td style={{ color: "#22c55e", fontWeight: 700 }}>{p.riseScore.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Top 5 Likely Price Decreases</h3>
              <span className="badge badge-soft">Fallers</span>
            </div>
            <table className="table" style={{ marginTop: "0.5rem" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Price</th>
                  <th>Likelihood</th>
                </tr>
              </thead>
              <tbody>
                {topPriceMovers.fallers.map((p) => (
                  <tr key={`fall-${p.id}`}>
                    <td>{p.rank}</td>
                    <td>{p.name}</td>
                    <td>{p.team}</td>
                    <td>GBP {p.price}m</td>
                    <td style={{ color: "#ef4444", fontWeight: 700 }}>{p.fallScore.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Check One Player</h3>
            <span className="badge badge-soft">Simple View</span>
          </div>

          <div className="grid grid-3" style={{ marginBottom: "1rem" }}>
            <div className="form-group">
              <label className="label">Player</label>
              <input
                className="input"
                list="price-player-options"
                value={playerQuery}
                onChange={(e) => onPlayerQueryChange(e.target.value)}
                placeholder="Search and select player..."
              />
              <datalist id="price-player-options">
                {playerOptions.map((o) => (
                  <option key={o.id} value={o.label} />
                ))}
              </datalist>
              <div className="form-helper">Type a name and pick from suggestions</div>
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

          <div className="inline-note">Available in picker: {playerOptions.length} players</div>

          <div className="form-actions" style={{ marginTop: "0.5rem" }}>
            <button className="btn btn-accent" type="button" onClick={submit} disabled={loading}>
              {loading ? "Checking..." : "Check Price Outlook"}
            </button>
          </div>

          {err ? <p style={{ color: "#ef4444" }}>{err}</p> : null}

          {result ? (
            <div className="player-card" style={{ marginTop: "1rem" }}>
              <div className="player-row">
                <div>
                  <strong>{playerName(selectedPlayer)}</strong>
                  <div className="text-muted">{directionText(result.direction)}</div>
                </div>
                <div className="player-stat-right">
                  <div className="player-main-stat" style={{ color: directionColor }}>
                    {directionLabel(result.direction)}
                  </div>
                  <div className="player-sub-label">
                    Confidence: {Math.round(safeNum(result.probability) * 100)}% ({confidenceLabel(safeNum(result.probability))})
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

