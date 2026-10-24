import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData } from '../lib/api.js';
import { empties } from '../lib/form.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const ROLES = ['ADMIN', 'PROCUREMENT', 'CUSTODIAN', 'TECHNICIAN', 'AUDITOR'];

export default function Users() {
  const { t } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'CUSTODIAN', department: '' });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/auth/users', { params: role ? { role } : {} });
      setRows(listData(r));
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role]);

  const create = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const bad = empties([[form.fullName.trim(), t.name], [form.email.trim(), t.email], [form.password, t.password]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    try {
      await api.post('/auth/register', form);
      setOk('User created'); setForm({ fullName: '', email: '', password: '', role: 'CUSTODIAN', department: '' }); load();
    } catch (e2) { setErr(errMsg(e2, 'Only ADMIN can register new users')); }
  };

  const update = async (id, patch) => {
    setErr(''); setOk('');
    try { await api.patch(`/auth/users/${id}`, patch); setOk('Updated'); load(); }
    catch (e) { setErr(errMsg(e)); }
  };

  return (
    <Layout title={t.users}>
      {err && <div className="alert err">{err}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      <div className="card">
        <div className="row">
          <select className="select" style={{ maxWidth: 200 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t.role}: all</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="muted">GET /api/auth/users · PATCH /api/auth/users/:id (ADMIN)</span>
        </div>
      </div>
      {can(user, 'ADMIN') && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>POST /api/auth/register (ADMIN only after bootstrap)</h3>
          <form onSubmit={create} className="form-grid" noValidate>
            <label className="f">{t.name}<input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label className="f">{t.email}<input className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="f">{t.password}<input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label className="f">{t.role}<select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            <label className="f">{t.department}<input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
            <div><button className="btn primary">{t.add}</button></div>
          </form>
        </div>
      )}
      <div className="card" style={{ marginTop: 12, overflowX: 'auto' }}>
        {loading && <div className="loader-wrap"><Loader /></div>}
        {!loading && (
          <>
            <table className="tbl"><thead><tr><th>ID</th><th>{t.name}</th><th>{t.email}</th><th>{t.role}</th><th>{t.department}</th><th>{t.active}</th><th>{t.actions}</th></tr></thead>
              <tbody>{rows.map((u) => (
                <tr key={u._id}><td>{u._id}</td><td>{u.fullName}</td><td>{u.email}</td><td><span className="badge info">{u.role}</span></td><td>{u.department}</td><td>{String(u.isActive)}</td>
                  <td>{can(user, 'ADMIN') && (
                    <div className="row">
                      <select className="select" style={{ maxWidth: 150 }} defaultValue={u.role} onChange={(e) => update(u._id, { role: e.target.value })}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn" onClick={() => update(u._id, { isActive: !u.isActive })}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                    </div>)}
                  </td></tr>
              ))}</tbody></table>
            {!rows.length && !loading && <p className="muted">{t.noData}</p>}
          </>
        )}
      </div>
    </Layout>
  );
}
