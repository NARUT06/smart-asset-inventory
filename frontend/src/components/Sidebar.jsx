import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Boxes, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { getAuthorizedNavItems } from '../config/navigation.js';

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const items = getAuthorizedNavItems(user?.role);

  const go = () => {
    logout();
    nav('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div className="brand">
          <span className="logo"><Boxes size={24} strokeWidth={2} /></span>
          <span className="brand-text">{t.app}<small>{t.sub}</small></span>
        </div>
        {onClose && (
          <button className="sb-close" onClick={onClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="nav sb-scroll">
        {items.map(({ href, labelKey, icon: Icon }) => (
          <NavLink key={href} to={href} end={href === '/dashboard'} className={({ isActive }) => (isActive ? 'active' : '')} onClick={onClose}>
            <Icon size={18} strokeWidth={2} /><span className="nl">{t[labelKey]}</span>
          </NavLink>
        ))}
      </nav>
      <div className="side-foot sb-foot">
        <div className="user-chip" title={`${user?.fullName || ''}\n${user?.email || ''}`}>
          <div className="urow">
            <span className="avatar">{String(user?.fullName || '?').trim().charAt(0).toUpperCase()}</span>
            <span className="uinfo">
              <span className="nm">{user?.fullName}</span>
              <span className="em">{user?.email}</span>
            </span>
          </div>
          <span className="role-badge">{user?.role}</span>
        </div>
        <button className="btn dark logout-btn" onClick={go} title={t.logout}>
          <LogOut size={15} /><span className="nl">{t.logout}</span>
        </button>
      </div>
    </aside>
  );
}
