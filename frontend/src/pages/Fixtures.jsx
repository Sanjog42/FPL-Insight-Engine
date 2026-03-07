import { useEffect, useMemo, useState } from "react";
import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { apiFetch } from "../services/api";

export default function Fixtures() {
  useAuthGuard();

  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [horizon, setHorizon] = useState("5");
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
    if (!teamId) {
      setErr("Please select a team.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/predictions/fdr/?team_id=${Number(teamId)}&horizon=${Number(horizon)}`
      );
      setResult(res);
    } catch (ex) {
      setErr(ex.message || "Failed to load FDR.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout
      title="Fixture Difficulty Rating (FDR)"
      subtitle="Upcoming fixtures with difficulty scores and win/clean-sheet probabilities."
    >
      <section className="section">
        <div className="card">
          <form className="grid grid-3" onSubmit={submit}>
            <div className="form-group">
              <label className="label">Team</label>
              <select
                className="input"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
              >
                <option value="">Select team...</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Horizon (GWs)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="10"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ alignSelf: "end" }}>
              <button className="btn btn-accent" type="submit" disabled={loading}>
                {loading ? "Loading..." : "View FDR"}
              </button>
            </div>
          </form>

          {err ? <p style={{ color: "#ef4444" }}>{err}</p> : null}

          {result?.fixtures?.length ? (
            <table className="table" style={{ marginTop: "1rem" }}>
              <thead>
                <tr>
                  <th>GW</th>
                  <th>Opponent</th>
                  <th>Venue</th>
                  <th>FDR</th>
                  <th>Win %</th>
                  <th>Clean Sheet %</th>
                </tr>
              </thead>
              <tbody>
                {result.fixtures.map((fx) => (
                  <tr key={`${fx.gw}-${fx.opponent}-${fx.venue}`}>
                    <td>{fx.gw}</td>
                    <td>{fx.opponent}</td>
                    <td>{fx.venue}</td>
                    <td>
                      <span className={`fdr-pill fdr-${fx.fdr_score}`}>
                        {fx.fdr_score}
                      </span>
                    </td>
                    <td>{Math.round(fx.win_prob * 100)}%</td>
                    <td>{Math.round(fx.clean_sheet_prob * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
