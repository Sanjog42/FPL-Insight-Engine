import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/navigation/Navbar";
import { useAuthContext } from "../context/AuthContext";

export default function MainLayout({ title, subtitle, children }) {
  const nav = useNavigate();
  const { user, logoutUser } = useAuthContext();

  const role = String(user?.role || "").toLowerCase();
  const backPath = useMemo(() => {
    if (role === "superadmin") return "/superadmin";
    if (role === "admin") return "/admin";
    return "/dashboard";
  }, [role]);

  const backLabel = useMemo(() => {
    if (role === "superadmin") return "Back to SuperAdmin Dashboard";
    if (role === "admin") return "Back to Admin Dashboard";
    return "Back to Dashboard";
  }, [role]);

  function onLogout() {
    logoutUser();
    nav("/login");
  }

  return (
    <div className="app">
      <main className="content dashboard-shell">
        <Navbar title="Insight Engine" user={user} onLogout={onLogout} backPath={backPath} backLabel={backLabel} />
        <section className="section">
          <h1 className="h1">{title}</h1>
          {subtitle ? <p className="text-muted">{subtitle}</p> : null}
        </section>
        {children}
      </main>
    </div>
  );
}
