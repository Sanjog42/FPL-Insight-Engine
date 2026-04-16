import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Captaincy from "./pages/Captaincy";
import Predictions from "./pages/Predictions";
import PriceChange from "./pages/PriceChange";
import MatchPrediction from "./pages/MatchPrediction";
import Fixtures from "./pages/Fixtures";
import Team from "./pages/Team";
import Compare from "./pages/Compare";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/superadmin" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
        <Route path="/captaincy" element={<Captaincy />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/price-change" element={<PriceChange />} />
        <Route path="/match-prediction" element={<MatchPrediction />} />
        <Route path="/fixtures" element={<Fixtures />} />
        <Route path="/team" element={<Team />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}
