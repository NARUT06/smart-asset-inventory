import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData } from '../lib/api.js';
import { empties } from '../lib/form.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const catCode = (id) => `CAT-${String(id).padStart(3, '0')}`;

export default function Categories() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [tplCounts, setTplCounts] = useState({});
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', description: '', expectedLifetimeMonths: 36 });
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/categories', { params: { limit: 100 } });
      setRows(listData(r));
      const tpl = await api.get('/maintenance-templates').then((res) => res.data.data || []).catch(() => []);
      const tc = {};
      tpl.forEach((x) => { const k = x.categoryId ?? x.category?.id; if (k != null) tc[k] = (tc[k] || 0) + 1; });
      setTplCounts(tc);
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const bad = empties([[form.name.trim(), t.name]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    try {
      if (editing) { await api.put(`/categories/${editing}`, { ...form, expectedLifetimeMonths: Number(form.expectedLifetimeMonths) }); setEditing(null); }
      else await api.post('/categories', { ...form, expectedLifetimeMonths: Number(form.expectedLifetimeMonths) });
      setForm({ name: '', description: '', expectedLifetimeMonths: 36 }); load();
    } catch (e2) { setErr(errMsg(e2)); }
  };
  const del = async (id) => {
    if (!window.confirm(t.confirmDel)) return;
    try { await api.delete(`/categories/${id}`); load(); } catch (e) { setErr(errMsg(e)); }
  };

  const shown = rows.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Layout title={t.categories}>
      {err && <div className="alert err">{err}</div>}
      <div className="ct-head">
        <div>
          <h2>{lang === 'ar' ? 'تصنيفات الأصول' : 'Asset Classification Categories'}</h2>
          <p className="muted">{lang === 'ar' ? 'الأعمار الافتراضية وروابط الصيانة الوقائية' : 'Lifetime expectations & preventive maintenance linkages'}</p>
        </div>
        <input className="input" style={{ maxWidth: 240 }} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {can(user, 'ADMIN', 'PROCUREMENT') && (
        <div className="card">
          <form onSubmit={submit} className="form-grid" noValidate>
            <label className="f">{t.name}<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="f">{t.desc}<input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label className="f">expectedLifetimeMonths<input className="input" type="number" min="1" required value={form.expectedLifetimeMonths} onChange={(e) => setForm({ ...form, expectedLifetimeMonths: e.target.value })} /></label>
            <div className="row"><button className="btn primary">{t.save}</button>{editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm({ name: '', description: '', expectedLifetimeMonths: 36 }); }}>{t.cancel}</button>}</div>
          </form>
        </div>
      )}
      <div className="ct-grid">
        {loading && <div className="loader-wrap" style={{ gridColumn: '1 / -1' }}><Loader /></div>}
        {!loading && shown.map((c) => (
          <div key={c._id} className="dq-card ct-card">
            <div className="ct-top">
              <span className="ct-ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12l-8 8-9-9V4h7l10 8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
              </span>
              <div className="ct-id">
                <b>{c.name}</b>
                <span className="dq-dim">ID: {catCode(c._id)}</span>
              </div>
              <span className="ct-life">{c.expectedLifetimeMonths} {lang === 'ar' ? 'شهر' : 'Months Lifetime'}</span>
            </div>
            <p className="ct-desc">{c.description || <span className="dq-dim">—</span>}</p>
            <div className="ct-foot">
              <span className="dq-dim">{lang === 'ar' ? 'أصول مرتبطة' : 'Linked Assets'}: <b className="ct-n">{c.assetCount ?? '…'}</b></span>
              <Link className="dq-dim" to="/maintenance-templates">{lang === 'ar' ? 'قوالب الصيانة' : 'Maintenance Templates'}: <b className="ct-n">{tplCounts[c._id] ?? 0}</b></Link>
              {(can(user, 'ADMIN', 'PROCUREMENT') || can(user, 'ADMIN')) && (
                <span className="row">
                  {can(user, 'ADMIN', 'PROCUREMENT') && <button className="btn" onClick={() => { setEditing(c._id); setForm({ name: c.name, description: c.description || '', expectedLifetimeMonths: c.expectedLifetimeMonths }); }}>{t.edit}</button>}
                  {can(user, 'ADMIN') && <button className="btn danger" onClick={() => del(c._id)}>{t.del}</button>}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {!shown.length && !loading && <p className="muted">{t.noData}</p>}
    </Layout>
  );
}
