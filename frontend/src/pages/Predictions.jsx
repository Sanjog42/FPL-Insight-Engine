import { useEffect, useMemo, useState } from "react";
import PredictionForm from "../components/forms/PredictionForm";
import ErrorMessage from "../components/common/ErrorMessage";
import MainLayout from "../layouts/MainLayout";
import { getBootstrap, getPlayerPointsPrediction } from "../services/predictionService";

export default function Predictions() {
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
      const res = await getBootstrap(force);
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
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const selectablePlayers = useMemo(() => {
    return players
      .filter((player) => {
        if (onlyAvailable && player.status && player.status !== "a") return false;
        return true;
      })
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  }, [players, onlyAvailable]);

  const playerOptions = useMemo(() => {
    return selectablePlayers.map((player) => {
      const team = teamMap.get(player.team);
      const teamShort = team?.short_name || team?.name || "UNK";
      const name = `${player.first_name || ""} ${player.second_name || ""}`.trim() || player.web_name;
      return { id: String(player.id), label: `${name} (${teamShort})` };
    });
  }, [selectablePlayers, teamMap]);

  const optionByLabel = useMemo(() => {
    const map = new Map();
    playerOptions.forEach((option) => map.set(option.label.toLowerCase(), option.id));
    return map;
  }, [playerOptions]);

  const confidencePct = result?.confidence ? Math.round(result.confidence * 100) : 0;

  function onPlayerQueryChange(value) {
    setPlayerQuery(value);
    setPlayerId(optionByLabel.get(value.trim().toLowerCase()) || "");
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
      const res = await getPlayerPointsPrediction(exactId);
      setPlayerId(exactId);
      setResult(res);
    } catch (ex) {
      setErr(ex.message || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout
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

          <PredictionForm
            playerQuery={playerQuery}
            playerOptions={playerOptions}
            onPlayerQueryChange={onPlayerQueryChange}
            onlyAvailable={onlyAvailable}
            onSetOnlyAvailable={setOnlyAvailable}
            onRefresh={() => loadPlayers(true)}
            refreshing={loadingPlayers}
            onSubmit={submit}
            loading={loading}
          />

          <ErrorMessage message={err} />

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
                  <div className="text-accent player-main-stat">{result.predicted_points} pts</div>
                  <div className="player-sub-label">Confidence: {confidencePct}%</div>
                </div>
              </div>

              <div className="predict-confidence-bar" aria-hidden="true">
                <div className="predict-confidence-fill" style={{ width: `${Math.max(8, confidencePct)}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </MainLayout>
  );
}
