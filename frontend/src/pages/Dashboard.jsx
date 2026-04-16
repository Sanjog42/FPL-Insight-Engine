import { useEffect, useState } from "react";
import PredictionCard from "../components/dashboard/PredictionCard";
import PlayerCard from "../components/dashboard/PlayerCard";
import StatCard from "../components/dashboard/StatCard";
import MainLayout from "../layouts/MainLayout";
import { getBootstrap, getCaptaincy, getMatchUpcoming } from "../services/predictionService";
import { getCurrentUser } from "../services/userService";

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

function positionLabel(position) {
  if (position === 1) return "GK";
  if (position === 2) return "DEF";
  if (position === 3) return "MID";
  if (position === 4) return "FWD";
  return "-";
}

export default function Dashboard() {
  const [budget, setBudget] = useState(0.0);
  const [transfers, setTransfers] = useState(0);
  const [hasTeamStored, setHasTeamStored] = useState(false);
  const [currentGw, setCurrentGw] = useState(null);
  const [deadlineTime, setDeadlineTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [captainPreview, setCaptainPreview] = useState(null);
  const [playerPreview, setPlayerPreview] = useState(null);
  const [matchPreview, setMatchPreview] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadTeamState() {
      try {
        const me = await getCurrentUser();
        if (!active) return;

        const userId = Number(me?.id || 0);
        const key = userId > 0 ? `fplTeamState:user:${userId}` : null;
        const stored = key ? JSON.parse(localStorage.getItem(key) || "{}") : {};

        setBudget(typeof stored.remainingBudget === "number" ? stored.remainingBudget : 0);
        setTransfers(typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0);
        setHasTeamStored(stored?.teamStored === true);
      } catch {
        if (!active) return;
        setHasTeamStored(false);
      }
    }

    loadTeamState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      try {
        const res = await getBootstrap(false);
        const events = res?.data?.events || [];
        const next = events.find((event) => event.is_next);
        if (!next || !active) return;

        const deadline = next.deadline_time ? new Date(next.deadline_time).getTime() : null;
        setCurrentGw(next.id ?? null);
        setDeadlineTime(deadline);
      } catch {
        // Keep fallback UI.
      }
    }

    loadBootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!deadlineTime) return;
      setTimeLeft(formatTimeLeft(deadlineTime));
    }, 30000);

    setTimeLeft(formatTimeLeft(deadlineTime));

    return () => clearInterval(timer);
  }, [deadlineTime]);

  useEffect(() => {
    let active = true;

    async function loadCaptainPreview() {
      try {
        const res = await getCaptaincy(20);
        if (!active) return;

        const picks = Array.isArray(res?.picks) ? res.picks : [];
        const top = picks[0] || null;
        const topByPoints = picks.reduce((best, pick) => {
          if (!best) return pick;
          return (pick?.predicted_points || 0) > (best?.predicted_points || 0) ? pick : best;
        }, null);

        if (top) {
          setCaptainPreview({
            name: top.name,
            team: top.team,
            position: top.position,
            predictedPoints: top.predicted_points,
            confidence: top.model_confidence,
          });
        }

        if (topByPoints) {
          setPlayerPreview({
            name: topByPoints.name,
            team: topByPoints.team,
            position: topByPoints.position,
            predictedPoints: topByPoints.predicted_points,
            confidence: topByPoints.model_confidence,
          });
        }
      } catch {
        // Keep fallback UI.
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
        const res = await getMatchUpcoming();
        if (!active) return;

        const fixtures = Array.isArray(res?.fixtures) ? res.fixtures : [];
        if (!fixtures.length) return;

        const best = fixtures.reduce((top, fixture) => {
          const probs = fixture?.prediction?.probs || {};
          const confidence = Math.max(Number(probs.home || 0), Number(probs.draw || 0), Number(probs.away || 0));
          if (!top || confidence > top.confidence) {
            return { fixture, confidence };
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
        // Keep fallback UI.
      }
    }

    loadMatchPreview();
    return () => {
      active = false;
    };
  }, []);

  return (
    <MainLayout
      title="Manager Dashboard"
      subtitle="Central analytics hub for your Fantasy Premier League team. Access every feature from this dashboard."
    >
      <section className="section">
        <div className="grid grid-3">
          <StatCard
            subtitle="Current Gameweek"
            title={currentGw ? `Gameweek ${currentGw}` : "Gameweek --"}
            value={timeLeft || "Loading deadline..."}
            note={`Deadline: ${formatLocalDeadline(deadlineTime)}`}
          />
          <StatCard
            subtitle="Budget Remaining"
            title="Money in the bank"
            value={hasTeamStored ? `${budget.toFixed(1)}M` : "None"}
            note={hasTeamStored ? "Budget loaded from stored team." : "Store your team to load budget."}
          />
          <StatCard
            subtitle="Transfers Remaining"
            title="This Gameweek"
            value={hasTeamStored ? transfers : "None"}
            note={hasTeamStored ? "Free transfers loaded from stored team." : "Store your team to load transfers."}
          />
        </div>
      </section>

      <section className="section">
        <h2 className="h2">Analytics Modules</h2>
        <p className="text-muted" style={{ marginBottom: "1.25rem" }}>
          Click any card to open the full page. Each card shows a preview insight based on latest available data.
        </p>

        <div className="grid dash-grid">
          <PredictionCard to="/captaincy" title="Captaincy Analyzer" badge="Match Model" subtitle="Best captain for next gameweek" cta="Open Captaincy Analyzer ->">
            <PlayerCard
              name={captainPreview?.name || "Loading..."}
              meta={`${positionLabel(captainPreview?.position)} | ${captainPreview?.team || "-"}`}
              primaryValue={`${captainPreview?.predictedPoints ?? "-"} pts`}
              secondaryValue={`Confidence: ${captainPreview?.confidence ? `${Math.round(captainPreview.confidence * 100)}%` : "-"}`}
            />
          </PredictionCard>

          <PredictionCard to="/predictions" title="Player Predictions" badge="Top performer" subtitle="Highest predicted points next gameweek" cta="View all predictions ->">
            <PlayerCard
              name={playerPreview?.name || "Loading..."}
              meta={`${positionLabel(playerPreview?.position)} | ${playerPreview?.team || "-"}`}
              primaryValue={`${playerPreview?.predictedPoints ?? "-"} pts`}
              secondaryValue={`Confidence: ${playerPreview?.confidence ? `${Math.round(playerPreview.confidence * 100)}%` : "-"}`}
            />
          </PredictionCard>

          <PredictionCard to="/match-prediction" title="Match Prediction" badge="Match Model" subtitle="Most confident next-gameweek prediction" cta="View all match predictions ->">
            <PlayerCard
              name={matchPreview ? `${matchPreview.home} vs ${matchPreview.away}` : "Loading..."}
              meta={matchPreview ? `GW ${matchPreview.gw} | xG ${matchPreview.homeXg}-${matchPreview.awayXg}` : "-"}
              primaryValue={matchPreview?.outcome || "-"}
              secondaryValue={matchPreview?.confidence ? `${Math.round(matchPreview.confidence * 100)}% confidence` : "-"}
            />
          </PredictionCard>

          <PredictionCard to="/price-change" title="Price Change Prediction" badge="Next 7 days" subtitle="Forecast likely risers and fallers" cta="View price predictions ->" />
          <PredictionCard to="/fixtures" title="Fixtures & FDR" badge="Fixture Model" subtitle="Difficulty outlook and probabilities" cta="Open Fixtures & FDR ->" />
          <PredictionCard to="/team" title="Store My Team" badge="Required for budget" subtitle={hasTeamStored ? "Status: Team synced" : "Status: Team not synced"} cta="View / Update stored team ->" />
          <PredictionCard to="/compare" title="Player Comparison" badge="Head-to-head" subtitle="Compare two players using live stats + ML" cta="Open Player Comparison ->" />
        </div>
      </section>
    </MainLayout>
  );
}
