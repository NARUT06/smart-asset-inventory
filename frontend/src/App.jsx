import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { ROUTE_ROLES, ROLES } from './config/navigation.js';
import Login from './pages/Login.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assets from './pages/Assets.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Categories from './pages/Categories.jsx';
import Locations from './pages/Locations.jsx';
import Transfers from './pages/Transfers.jsx';
import Stocktake from './pages/Stocktake.jsx';
import WorkOrders from './pages/WorkOrders.jsx';
import Templates from './pages/Templates.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';
import Profile from './pages/Profile.jsx';

const ALL = Object.values(ROLES);
const guard = (el, href) => <ProtectedRoute allowedRoles={ROUTE_ROLES[href]}>{el}</ProtectedRoute>;

function AnimatedRoutes() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div key={loc.pathname} className="page-enter">
      <Routes location={loc}>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route path="/dashboard" element={guard(<Dashboard />, '/dashboard')} />
        <Route path="/assets" element={guard(<Assets />, '/assets')} />
        <Route path="/assets/:id" element={guard(<AssetDetail />, '/assets/:id')} />
        <Route path="/categories" element={guard(<Categories />, '/categories')} />
        <Route path="/locations" element={guard(<Locations />, '/locations')} />
        <Route path="/transfers" element={guard(<Transfers />, '/transfers')} />
        <Route path="/stocktake" element={guard(<Stocktake />, '/stocktake')} />
        <Route path="/work-orders" element={guard(<WorkOrders />, '/work-orders')} />
        <Route path="/maintenance-templates" element={guard(<Templates />, '/maintenance-templates')} />
        <Route path="/users" element={guard(<Users />, '/users')} />
        <Route path="/audit-logs" element={guard(<Audit />, '/audit-logs')} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={ALL}><Profile /></ProtectedRoute>} />

        {/* legacy paths */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/templates" element={<Navigate to="/maintenance-templates" replace />} />
        <Route path="/audit" element={<Navigate to="/audit-logs" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
