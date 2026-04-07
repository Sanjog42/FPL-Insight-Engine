import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import RoleRoute from "./components/RoleRoute";
import AdminDashboard from "./pages/AdminDashboard";
import Captaincy from "./pages/Captaincy";
import Compare from "./pages/Compare";
import Dashboard from "./pages/Dashboard";
import Fixtures from "./pages/Fixtures";
import Login from "./pages/Login";
import MatchPrediction from "./pages/MatchPrediction";
import Predictions from "./pages/Predictions";
import PriceChange from "./pages/PriceChange";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Team from "./pages/Team";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <Dashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <RoleRoute allowedRoles={["Admin", "SuperAdmin"]}>
              <AdminDashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/superadmin/dashboard"
          element={
            <RoleRoute allowedRoles={["SuperAdmin"]}>
              <SuperAdminDashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/captaincy"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <Captaincy />
            </RoleRoute>
          }
        />
        <Route
          path="/predictions"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <Predictions />
            </RoleRoute>
          }
        />
        <Route
          path="/price-change"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <PriceChange />
            </RoleRoute>
          }
        />
        <Route
          path="/match-prediction"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <MatchPrediction />
            </RoleRoute>
          }
        />
        <Route
          path="/fixtures"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <Fixtures />
            </RoleRoute>
          }
        />
        <Route
          path="/team"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <Team />
            </RoleRoute>
          }
        />
        <Route
          path="/compare"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <Compare />
            </RoleRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <RoleRoute allowedRoles={["User", "Admin", "SuperAdmin"]}>
              <Profile />
            </RoleRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
