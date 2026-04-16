import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/common/ProtectedRoute";
import AdminDashboard from "../pages/AdminDashboard";
import Captaincy from "../pages/Captaincy";
import Compare from "../pages/Compare";
import Dashboard from "../pages/Dashboard";
import Fixtures from "../pages/Fixtures";
import ForgotPassword from "../pages/ForgotPassword";
import Login from "../pages/Login";
import MatchPrediction from "../pages/MatchPrediction";
import Predictions from "../pages/Predictions";
import PriceChange from "../pages/PriceChange";
import Profile from "../pages/Profile";
import Register from "../pages/Register";
import Team from "../pages/Team";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/superadmin"
          element={(
            <ProtectedRoute allowedRoles={["superadmin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/captaincy"
          element={(
            <ProtectedRoute>
              <Captaincy />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/predictions"
          element={(
            <ProtectedRoute>
              <Predictions />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/price-change"
          element={(
            <ProtectedRoute>
              <PriceChange />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/match-prediction"
          element={(
            <ProtectedRoute>
              <MatchPrediction />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/fixtures"
          element={(
            <ProtectedRoute>
              <Fixtures />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/team"
          element={(
            <ProtectedRoute>
              <Team />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/compare"
          element={(
            <ProtectedRoute>
              <Compare />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/profile"
          element={(
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
