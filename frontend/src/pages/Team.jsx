import useAuthGuard from "../hooks/useAuthGuard";
import AppLayout from "../components/AppLayout";
import { useEffect, useState } from "react";

export default function Team() {
  useAuthGuard();

  const [remainingBudget, setRemainingBudget] = useState(0);
  const [freeTransfers, setFreeTransfers] = useState(0);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("fplTeamState") || "{}");
    setRemainingBudget(typeof stored.remainingBudget === "number" ? stored.remainingBudget : 0);
    setFreeTransfers(typeof stored.freeTransfers === "number" ? stored.freeTransfers : 0);
  }, []);

  function save() {
    const data = { remainingBudget, freeTransfers };
    localStorage.setItem("fplTeamState", JSON.stringify(data));
    alert("Team state saved.");
  }

  return (
    <AppLayout
      title="Store My Team"
      subtitle="Save your budget, free transfers, and squad data (currently local mock)."
    >
      <section className="section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Team State</h3>
            <span className="badge badge-accent">LocalStorage</span>
          </div>

          <div className="grid grid-2" style={{ marginTop: "1rem" }}>
            <div>
              <label className="text-muted">Remaining Budget (£M)</label>
              <input
                className="input"
                type="number"
                step="0.1"
                value={remainingBudget}
                onChange={(e) => setRemainingBudget(parseFloat(e.target.value || "0"))}
              />
            </div>

            <div>
              <label className="text-muted">Free Transfers</label>
              <input
                className="input"
                type="number"
                value={freeTransfers}
                onChange={(e) => setFreeTransfers(parseInt(e.target.value || "0", 10))}
              />
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button className="btn btn-outline" onClick={save}>
              Save Team State
            </button>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
