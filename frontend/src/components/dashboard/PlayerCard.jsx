export default function PlayerCard({ name, meta, primaryValue, secondaryValue, primaryClass = "text-accent" }) {
  return (
    <div className="player-card" style={{ marginTop: "0.8rem" }}>
      <div className="player-row">
        <div>
          <strong>{name}</strong>
          <div className="text-muted">{meta}</div>
        </div>
        <div className="player-stat-right">
          <div className={`${primaryClass} player-main-stat`.trim()}>{primaryValue}</div>
          <div className="player-sub-label">{secondaryValue}</div>
        </div>
      </div>
    </div>
  );
}
