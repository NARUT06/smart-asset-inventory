import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useLang } from '../lib/i18n.jsx';
import LoginBackground from '../components/LoginBackground.jsx';

export default function Unauthorized() {
  const { lang } = useLang();
  return (
    <div className="login-wrap" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <LoginBackground />
      <div className="login-card" style={{ paddingTop: 56 }}>
        <ShieldAlert size={48} style={{ margin: '0 auto 14px', color: 'var(--rose)' }} />
        <div className="welcome" style={{ fontSize: '44px', fontWeight: 900, marginBottom: 8, color: 'var(--rose)' }}>403</div>
        <p className="welcome-sub" style={{ marginBottom: 24 }}>
          {lang === 'ar' ? 'غير مصرح لك بالوصول إلى هذه الصفحة' : 'You are not authorized to view this page'}
        </p>
        <Link className="submit" style={{ textDecoration: 'none', color: '#fff' }} to="/dashboard">
          {lang === 'ar' ? 'رجوع للداشبورد' : 'Back to dashboard'}
        </Link>
      </div>
    </div>
  );
}
