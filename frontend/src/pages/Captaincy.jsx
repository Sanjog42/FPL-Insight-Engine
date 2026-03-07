import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";

export default function Captaincy() {
  useAuthGuard();

  return (
    <AppLayout
      title="Captaincy Analyzer"
      subtitle="Identify the best captain choice for the upcoming gameweek."
    >
      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Captain Suggestion (Mock)</h3>
            <span className="badge badge-accent">GW 15</span>
          </div>

          <div className="player-card" style={{ marginTop: "0.8rem" }}>
            <div className="player-row">
              <div>
                <strong>Erling Haaland</strong>
                <div className="text-muted">FWD • MCI</div>
              </div>
              <div className="player-stat-right">
                <div className="text-accent player-main-stat">12.8 pts</div>
                <div className="player-sub-label">Risk: Medium</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
