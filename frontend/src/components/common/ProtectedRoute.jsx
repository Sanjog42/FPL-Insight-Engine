import useAuthGuard from "../../hooks/useAuthGuard";

export default function ProtectedRoute({ allowedRoles, children }) {
  const user = useAuthGuard(allowedRoles);
  if (!user) return null;
  return children;
}
