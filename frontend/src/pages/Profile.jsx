import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api, errMsg } from '../lib/api.js';
import { empties } from '../lib/form.js';
import { useAuth } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

export default function Profile() {
  const { t } = useLang();
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    const bad = empties([[form.currentPassword, t.currentPass], [form.newPassword, t.newPass]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    if (form.newPassword.length < 8) { setErr(`${t.newPass}: 8+`); return; }
    try {
      await api.patch('/auth/change-password', form);
      setMsg('Password updated'); setForm({ currentPassword: '', newPassword: '' });
    } catch (e2) { setErr(errMsg(e2)); }
  };

  return (
    <Layout title={t.profile}>
      {err && <div className="alert err">{err}</div>}
      {msg && <div className="alert ok">{msg}</div>}
      <div className="grid g2">
        <div className="card"><h3>{user?.fullName}</h3><p className="muted">{user?.email} · {user?.role} · {user?.department}</p></div>
        <div className="card">
          <h3>{t.changePass} — PATCH /api/auth/change-password</h3>
          <form onSubmit={submit} className="grid" noValidate>
            <label className="f">{t.currentPass}<input className="input" type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></label>
            <label className="f">{t.newPass}<input className="input" type="password" required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label>
            <button className="btn primary">{t.save}</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
