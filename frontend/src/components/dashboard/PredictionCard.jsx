import { Link } from "react-router-dom";
import Card from "../ui/Card";

export default function PredictionCard({ to, title, badge, subtitle, children, cta }) {
  return (
    <Link to={to} className="dashboard-card">
      <Card className="dashboard-card-inner">
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {badge ? <span className="badge badge-soft">{badge}</span> : null}
        </div>
        {subtitle ? <p className="text-muted">{subtitle}</p> : null}
        {children}
        {cta ? <p className="dashboard-card-cta">{cta}</p> : null}
      </Card>
    </Link>
  );
}
