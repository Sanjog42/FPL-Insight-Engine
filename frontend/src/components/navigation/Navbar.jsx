import { Link } from "react-router-dom";
import Button from "../ui/Button";

export default function Navbar({ title = "FPL Insight Engine", user, onLogout, backPath, backLabel }) {
  const displayName = user?.full_name?.trim() || user?.username || "User";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U";

  return (
    <header className="page-header">
      <div className="page-title">
        <span className="page-title-accent">FPL</span> {title}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        {backPath ? (
          <Link to={backPath} className="btn btn-outline">
            {backLabel || "Back"}
          </Link>
        ) : null}
        <Link to="/profile" className="profile-pill">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-name">{displayName}</span>
        </Link>
        <Button onClick={onLogout}>Logout</Button>
      </div>
    </header>
  );
}
