import Button from "../ui/Button";

export default function PredictionForm({
  playerQuery,
  playerOptions,
  onPlayerQueryChange,
  onlyAvailable,
  onSetOnlyAvailable,
  onRefresh,
  refreshing,
  onSubmit,
  loading,
}) {
  return (
    <form className="predict-grid" onSubmit={onSubmit}>
      <div className="predict-panel">
        <div className="form-group">
          <label className="label">Player</label>
          <input
            className="input predict-input"
            list="points-player-options"
            value={playerQuery}
            onChange={(e) => onPlayerQueryChange(e.target.value)}
            placeholder="Search and select player..."
          />
          <datalist id="points-player-options">
            {playerOptions.map((option) => (
              <option key={option.id} value={option.label} />
            ))}
          </datalist>
          <div className="form-helper">Type a player name and pick a suggestion</div>
        </div>

        <div className="form-group">
          <label className="label">Availability</label>
          <div className="predict-toggle-wrap">
            <button type="button" className={`pill ${onlyAvailable ? "pill-active" : ""}`} onClick={() => onSetOnlyAvailable(true)}>
              Available
            </button>
            <button type="button" className={`pill ${!onlyAvailable ? "pill-active" : ""}`} onClick={() => onSetOnlyAvailable(false)}>
              All Players
            </button>
          </div>
        </div>
      </div>

      <div className="predict-actions">
        <Button className="predict-refresh-btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh data"}
        </Button>
        <Button type="submit" variant="accent" className="predict-submit-btn" disabled={loading}>
          {loading ? "Predicting..." : "Predict Points"}
        </Button>
      </div>
    </form>
  );
}
