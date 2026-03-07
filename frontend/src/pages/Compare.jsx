import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";

export default function Compare() {
  useAuthGuard();

  return (
    <AppLayout
      title="Player Comparison"
      subtitle="Compare two players head-to-head using stats and predictions."
    >
      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Snapshot (Mock)</h3>
            <span className="badge badge-soft">Head-to-head</span>
          </div>

          <div className="grid grid-2 compare-mini" style={{ marginTop: "0.8rem" }}>
            <div>
              <strong>Mohamed Salah</strong>
              <div className="text-muted">Pts: 145 • Price: £13.0M</div>
            </div>
            <div>
              <strong>Erling Haaland</strong>
              <div className="text-muted">Pts: 132 • Price: £14.5M</div>
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
