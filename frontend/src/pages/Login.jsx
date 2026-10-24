import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { useTheme } from '../lib/theme.jsx';
import { errMsg } from '../lib/api.js';
import { empties } from '../lib/form.js';
import LoginBackground from '../components/LoginBackground.jsx';
import sealImg from '../assets/devhub-seal.png';

const Eye = ({ off }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M6.61 6.61A13.526 13.526 0 001 12s4 8 11 8a9.74 9.74 0 005.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

/* Sun / Moon theme toggle */
const ThemeToggle = ({ theme, toggle }) => {
  const isDark = theme === 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
    >
      {isDark ? (
        <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79" />
        </svg>
      )}
    </button>
  );
};

export default function Login() {
  const { login } = useAuth();
  const { t, toggle, lang } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const nav = useNavigate();
  const [email, setEmail] = useState(() => (localStorage.getItem('ast_remember') ? localStorage.getItem('ast_email') || '' : ''));
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem('ast_remember'));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const bad = empties([[email.trim(), t.email], [password, t.password]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    setBusy(true);
    try {
      await login(email.trim(), password);
      if (remember) {
        localStorage.setItem('ast_remember', '1');
        localStorage.setItem('ast_email', email.trim());
      } else {
        localStorage.removeItem('ast_remember');
        localStorage.removeItem('ast_email');
      }
      nav('/dashboard', { replace: true });
    } catch (e2) {
      setErr(errMsg(e2, 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  const isAr = lang === 'ar';

  return (
    <div className="login-wrap" dir={isAr ? 'rtl' : 'ltr'}>
      <LoginBackground />

      <ThemeToggle theme={theme} toggle={toggleTheme} />

      <button className="lang-btn" onClick={toggle} aria-label={isAr ? 'تغيير اللغة' : 'Change language'}>
        {isAr ? 'EN' : 'AR'}
      </button>

      <div className="login-card">
        <div className="seal-wrap">
          <img
            className="seal"
            src={sealImg}
            alt="DEVHUB - Faculty of AI & Data Management, Badr University in Assiut"
          />
        </div>

        <div className="brand">
          <span className="brand-dev">DEV</span><span className="brand-hub">HUB</span>
        </div>
        <div className="brand-sub">{isAr ? 'كلية الذكاء الاصطناعي وإدارة البيانات' : 'Faculty of AI & Data Management'}</div>
        <div className="brand-sub2">{isAr ? 'جامعة بدر في أسيوط' : 'Badr University in Assiut'}</div>

        <div className="divider"><span className="code">{'</>'}</span></div>

        <h1 className="welcome">{isAr ? 'مرحبا بعودتك!' : 'Welcome back!'}</h1>
        <p className="welcome-sub">{isAr ? 'سجل الدخول إلى حسابك' : 'Sign in to your account'}</p>

        {err && <div className="msg err">{err}</div>}

        <form onSubmit={submit} noValidate>
          <div className="field">
            <svg className="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" ry="2" /><path d="m22 7-10 6L2 7" /></svg>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t.email} dir="ltr" style={{ textAlign: 'start' }} />
          </div>
          <div className="field">
            <svg className="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={t.password} dir="ltr" style={{ textAlign: 'start' }} />
            <button type="button" className="eye" onClick={() => setShowPw((s) => !s)} aria-label={isAr ? 'إظهار/إخفاء كلمة المرور' : 'Toggle password visibility'}>
              <Eye off={!showPw} />
            </button>
          </div>
          <button className="submit" disabled={busy}>
            {busy ? '…' : (isAr ? 'دخول' : 'Sign In')} <span className="arrow">→</span>
          </button>
          <label className="remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {isAr ? 'تذكرني' : 'Remember me'}
          </label>
        </form>
      </div>
    </div>
  );
}
