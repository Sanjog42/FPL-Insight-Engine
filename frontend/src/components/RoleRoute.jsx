import { Navigate } from "react-router-dom";
import useAuthGuard from "../hooks/useAuthGuard";
import { roleHomePath } from "../services/api";

export default function RoleRoute({ allowedRoles, children }) {
  const user = useAuthGuard(allowedRoles);

  if (!user) {
    return null;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return children;
}
