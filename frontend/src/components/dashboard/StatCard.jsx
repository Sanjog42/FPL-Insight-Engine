import Card from "../ui/Card";

export default function StatCard({ subtitle, title, value, note }) {
  return (
    <Card className="stat-card">
      <div className="card-header">
        <div>
          <div className="card-subtitle">{subtitle}</div>
          <div className="card-title">{title}</div>
        </div>
      </div>
      <div className="stat-card-value">{value}</div>
      {note ? <p className="text-muted" style={{ marginTop: "0.5rem" }}>{note}</p> : null}
    </Card>
  );
}
