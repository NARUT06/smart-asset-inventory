import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData, metaOf, rlabel } from '../lib/api.js';
import { empties } from '../lib/form.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const STATUSES = ['', 'IN_USE', 'IN_STORAGE', 'UNDER_MAINTENANCE', 'RETIRED'];
const CONDITIONS = ['', 'NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

export default function Assets() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState('all');
  const [cats, setCats] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ assetTag: '', serialNumber: '', name: '', categoryId: '', locationId: '', custodianId: '', condition: 'NEW', status: 'IN_STORAGE', brand: '', model: '', procurement: { supplierName: '', purchaseCost: 0, purchaseDate: new Date().toISOString().slice(0, 10) } });

  const load = async (p = page) => {
    setErr('');
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (q) params.q = q;
      if (status) params.status = status;
      if (condition) params.condition = condition;
      if (categoryId) params.categoryId = categoryId;
      if (scope === 'mine') params.mine = 'true';
      const res = await api.get('/assets', { params });
      setRows(listData(res));
      setMeta(metaOf(res));
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, [status, condition, categoryId, scope]);
  useEffect(() => { api.get('/categories', { params: { limit: 100 } }).then((r) => setCats(listData(r))).catch(() => {}); }, []);

  const create = async (e) => {
    e.preventDefault();
    const bad = empties([
      [form.assetTag.trim(), t.assetTag], [form.serialNumber.trim(), t.serial],
      [form.name.trim(), t.name], [form.categoryId, t.category],
      [form.procurement.supplierName.trim(), t.supplier],
    ]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        locationId: form.locationId ? Number(form.locationId) : undefined,
        custodianId: form.custodianId ? Number(form.custodianId) : undefined,
        procurement: { ...form.procurement, purchaseCost: Number(form.procurement.purchaseCost) },
      };
      await api.post('/assets', payload);
      setShow(false);
      load(1); setPage(1);
    } catch (e2) { setErr(errMsg(e2)); }
  };

  const del = async (id) => {
    if (!window.confirm(t.confirmDel)) return;
    try { await api.delete(`/assets/${id}`); load(page); } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <Layout title={t.assets}>
      {err && <div className="alert err">{err}</div>}
      <div className="card">
        <div className="row">
          <input className="input" style={{ maxWidth: 220 }} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (load(1), setPage(1))} />
          <select className="select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || t.status}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 160 }} value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((s) => <option key={s} value={s}>{s || t.condition}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 200 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t.category}</option>
            {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <button className="btn primary" onClick={() => { load(1); setPage(1); }}>{t.search}</button>
          {user?.role === 'CUSTODIAN' && (
            <div className="row" role="group" aria-label="custody scope">
              <button className={scope === 'mine' ? 'btn primary' : 'btn'} onClick={() => setScope('mine')}>{lang === 'ar' ? 'عهدتي' : 'My Custody'}</button>
              <button className={scope === 'all' ? 'btn primary' : 'btn'} onClick={() => setScope('all')}>{lang === 'ar' ? 'الكل' : 'All'}</button>
            </div>
          )}
          <div className="spacer" />
          {can(user, 'ADMIN', 'PROCUREMENT') && <button className="btn primary" onClick={() => setShow(true)}>+ {t.add}</button>}
        </div>
      </div>
      {show && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>{t.add} — Asset</h3>
          <form onSubmit={create} className="form-grid" noValidate>
            <label className="f">{t.assetTag}<input className="input" value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} /></label>
            <label className="f">{t.serial}<input className="input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>
            <label className="f">{t.name}<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="f">{t.category}<select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
            <label className="f">{t.brand}<input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></label>
            <label className="f">{t.model}<input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
            <label className="f">locationId<input className="input" type="number" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} /></label>
            <label className="f">custodianId<input className="input" type="number" value={form.custodianId} onChange={(e) => setForm({ ...form, custodianId: e.target.value })} /></label>
            <label className="f">{t.supplier}<input className="input" value={form.procurement.supplierName} onChange={(e) => setForm({ ...form, procurement: { ...form.procurement, supplierName: e.target.value } })} /></label>
            <label className="f">{t.cost}<input className="input" type="number" min="0" step="0.01" value={form.procurement.purchaseCost} onChange={(e) => setForm({ ...form, procurement: { ...form.procurement, purchaseCost: e.target.value } })} /></label>
            <label className="f">{t.purchaseDate}<input className="input" type="date" value={String(form.procurement.purchaseDate).slice(0, 10)} onChange={(e) => setForm({ ...form, procurement: { ...form.procurement, purchaseDate: e.target.value } })} /></label>
            <div className="row"><button className="btn primary">{t.save}</button><button type="button" className="btn" onClick={() => setShow(false)}>{t.cancel}</button></div>
          </form>
          <p className="muted">POST /api/assets — locationId must be ROOM/OFFICE/LAB/STORAGE. Custody moves afterwards via POST /api/transfers.</p>
        </div>
      )}
      <div className="card" style={{ marginTop: 12, overflowX: 'auto' }}>
        {loading && <div className="loader-wrap"><Loader /></div>}
        {!loading && (
          <>
            <table className="tbl">
              <thead><tr><th>{t.assetTag}</th><th>{t.name}</th><th>{t.category}</th><th>{t.location}</th><th>{t.custodian}</th><th>{t.status}</th><th>{t.condition}</th><th>{t.actions}</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a._id}>
                    <td><Link to={`/assets/${a._id}`} style={{ color: '#1d4ed8' }}>{a.assetTag}</Link><br /><span className="muted">{a.serialNumber}</span></td>
                    <td>{a.name}<br /><span className="muted">{a.brand} {a.model}</span></td>
                    <td>{rlabel(a.categoryId)}</td>
                    <td>{rlabel(a.locationId)}</td>
                    <td>{rlabel(a.custodianId)}</td>
                    <td><span className="badge info">{a.status}</span></td>
                    <td><span className="badge">{a.condition}</span></td>
                    <td><div className="row"><Link className="btn" to={`/assets/${a._id}`}>{t.view}</Link>{can(user, 'ADMIN') && <button className="btn danger" onClick={() => del(a._id)}>{t.del}</button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !loading && <p className="muted">{t.noData}</p>}
            <div className="pager"><span className="muted">{t.page} {meta.page || 1} {t.of} {meta.pages || 1} ({meta.total || 0})</span>
              <button className="btn" disabled={(meta.page || 1) <= 1} onClick={() => { const p = (meta.page || 1) - 1; setPage(p); load(p); }}>‹</button>
              <button className="btn" disabled={(meta.page || 1) >= (meta.pages || 1)} onClick={() => { const p = (meta.page || 1) + 1; setPage(p); load(p); }}>›</button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
