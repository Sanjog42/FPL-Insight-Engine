import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Captaincy from "./pages/Captaincy";
import Predictions from "./pages/Predictions";
import PriceChange from "./pages/PriceChange";
import MatchPrediction from "./pages/MatchPrediction";
import Fixtures from "./pages/Fixtures";
import Team from "./pages/Team";
import Compare from "./pages/Compare";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* placeholders after login */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
        <Route path="/captaincy" element={<Captaincy />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/price-change" element={<PriceChange />} />
        <Route path="/match-prediction" element={<MatchPrediction />} />
        <Route path="/fixtures" element={<Fixtures />} />
        <Route path="/team" element={<Team />} />
        <Route path="/compare" element={<Compare />} />

      </Routes>
    </BrowserRouter>
  );
}
