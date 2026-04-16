import { useNavigate } from "react-router-dom";
import Navbar from "../components/navigation/Navbar";
import { useAuthContext } from "../context/AuthContext";

export default function AdminLayout({ title, children }) {
  const nav = useNavigate();
  const { user, logoutUser } = useAuthContext();

  function onLogout() {
    logoutUser();
    nav("/login");
  }

  return (
    <div className="app">
      <main className="content dashboard-shell">
        <Navbar title={title} user={user} onLogout={onLogout} />
        {children}
      </main>
    </div>
  );
}
