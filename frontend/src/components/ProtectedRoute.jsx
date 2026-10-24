import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Loader from './Loader.jsx';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="loader-wrap"><Loader /></div>;
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (allowedRoles) {
    if (!user) return <div className="loader-wrap"><Loader /></div>;
    if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  }
  return children;
}
