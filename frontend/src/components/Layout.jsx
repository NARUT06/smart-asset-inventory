import { useEffect, useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { useTheme } from '../lib/theme.jsx';
import { getAuthorizedNavItems } from '../config/navigation.js';
import { api, listData, rlabel } from '../lib/api.js';

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const { t, toggle } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const nav = useNavigate();
  const links = getAuthorizedNavItems(user?.role);
  const [bellOpen, setBellOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [sbCollapsed, setSbCollapsed] = useState(() => localStorage.getItem('ast_sb') === '1');
  const toggleSb = () => setSbCollapsed((v) => {
    localStorage.setItem('ast_sb', v ? '0' : '1');
    return !v;
  });
  useEffect(() => {
    if (!user) return;
    api.get('/work-orders', { params: { limit: 50 } })
      .then((r) => setAlerts(
        listData(r)
          .filter((w) => ['OPEN', 'IN_PROGRESS', 'ON_HOLD'].includes(w.status) && ['HIGH', 'CRITICAL'].includes(w.priority))
          .slice(0, 6),
      ))
      .catch(() => {});
  }, [user]);
  const go = () => {
    logout();
    nav('/login');
  };
  return (
    <div className={`shell${sbCollapsed ? ' sb-collapsed' : ''}`}>
      <Sidebar onClose={sbCollapsed ? toggleSb : undefined} />
      {sbCollapsed && <div className="sb-backdrop" onClick={toggleSb} />}
      <div className="main">
        <nav className="mobile-nav">
          {links.map(({ href, labelKey }) => <NavLink key={href} to={href} end={href === '/dashboard'}>{t[labelKey]}</NavLink>)}
        </nav>
        <div className="topbar">
          <button className="btn" onClick={toggleSb} title={sbCollapsed ? 'Show sidebar' : 'Hide sidebar'} aria-label="Toggle sidebar">
            <Menu size={17} />
          </button>
          <h1>{title}</h1>
          <div className="spacer" />
          <div className="bell-wrap">
            <button className="btn bell-btn" onClick={() => setBellOpen((o) => !o)} title="Notifications" aria-label="Notifications">
              <Bell size={17} />
              {alerts.length > 0 && <span className="bell-badge">{alerts.length > 99 ? '99+' : alerts.length}</span>}
            </button>
            {bellOpen && (
              <div className="bell-drop">
                <header>{t.activeWO} — HIGH/CRITICAL</header>
                {alerts.map((w) => (
                  <Link key={w._id} className="bell-item" to="/work-orders" onClick={() => setBellOpen(false)}>
                    <b>{w.title || `#${w._id} ${w.type}`}</b>
                    <span>{rlabel(w.assetId)} · {w.priority} · {w.status}</span>
                  </Link>
                ))}
                {!alerts.length && <div className="bell-item"><span>{t.noData}</span></div>}
                <Link className="bell-foot" to="/work-orders" onClick={() => setBellOpen(false)}>{t.view} ←</Link>
              </div>
            )}
          </div>
          <button className="btn" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg>
            )}
          </button>
          <button className="btn" onClick={toggle}>{t.lang}</button>
          <button className="btn" onClick={go}>{t.logout}</button>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
