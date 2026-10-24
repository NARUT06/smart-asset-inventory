import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData, rlabel, rid } from '../lib/api.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { empties } from '../lib/form.js';

const PRI = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STS = ['', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRI_CLS = { LOW: 'p-low', MEDIUM: 'p-med', HIGH: 'p-high', CRITICAL: 'p-crit' };

export default function WorkOrders() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [form, setForm] = useState({ assetId: '', type: 'CORRECTIVE', title: '', description: '', priority: 'MEDIUM', technicianId: '', scheduledDate: '' });
  const [show, setShow] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const ST_C = { OPEN: '#38bdf8', IN_PROGRESS: '#fbbf24', ON_HOLD: '#a78bfa', COMPLETED: '#34d399', CANCELLED: '#fb7185' };

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (priority) params.priority = priority;
      const r = await api.get('/work-orders', { params });
      setRows(listData(r));
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, priority]);

  const mayEdit = (w) => can(user, 'ADMIN') || (user && rid(w.technicianId) === user._id);

  const create = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const bad = empties([[form.assetId, 'assetId']]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    try {
      await api.post('/work-orders', {
        assetId: Number(form.assetId),
        type: form.type,
        title: form.title || undefined,
        description: form.description || undefined,
        priority: form.priority,
        technicianId: form.technicianId ? Number(form.technicianId) : undefined,
        scheduledDate: form.scheduledDate || undefined,
      });
      setOk(lang === 'ar' ? 'تم الإنشاء' : 'Created'); setShow(false);
      setForm({ assetId: '', type: 'CORRECTIVE', title: '', description: '', priority: 'MEDIUM', technicianId: '', scheduledDate: '' });
      load();
    } catch (e2) { setErr(errMsg(e2)); }
  };

  const toggleCheck = async (w, idx) => {
    if (!mayEdit(w)) return;
    const checklist = (w.checklist || []).map((c, i) => (i === idx ? { ...c, isDone: !c.isDone } : c));
    const prev = rows;
    setRows((rs) => rs.map((x) => (x._id === w._id ? { ...x, checklist } : x)));
    try {
      await api.put(`/work-orders/${w._id}`, { checklist });
    } catch (e) {
      setRows(prev);
      setErr(errMsg(e));
    }
  };

  const changeStatus = async (w, s) => {
    if (!s || s === w.status) return;
    setErr(''); setOk('');
    try { await api.patch(`/work-orders/${w._id}/status`, { status: s }); setOk(lang === 'ar' ? 'تم تحديث الحالة' : 'Status updated'); load(); }
    catch (e) { setErr(errMsg(e)); }
  };

  const del = async (id) => {
    if (!window.confirm(t.confirmDel)) return;
    try { await api.delete(`/work-orders/${id}`); load(); } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <Layout title={t.workOrders}>
      {err && <div className="alert err">{err}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      <p className="dq-dim" style={{ margin: '0 0 12px' }}>
        {lang === 'ar' ? 'أوامر الشغل المجدولة والعلاجية مع تنفيذ قائمة التحقق لحظيا' : 'Scheduled & corrective work orders with real-time checklist execution'}
      </p>
      <div className="card">
        <div className="row">
          <select className="select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STS.map((s) => <option key={s} value={s}>{s || t.status}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 180 }} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRI.map((s) => <option key={s} value={s}>{s || t.priority}</option>)}
          </select>
          <div className="spacer" />
          {can(user, 'ADMIN', 'CUSTODIAN') && <button className="btn primary" onClick={() => setShow(!show)}>+ {t.createWO}</button>}
        </div>
      </div>
      {show && can(user, 'ADMIN', 'CUSTODIAN') && (
        <div className="card" style={{ marginTop: 12 }}>
          <form onSubmit={create} className="form-grid" noValidate>
            <label className="f">assetId*<input className="input" type="number" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} /></label>
            <label className="f">{t.type}<select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>CORRECTIVE</option><option>SCHEDULED</option></select></label>
            <label className="f">{t.priority}<select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
            <label className="f">{t.title}<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="f">technicianId<input className="input" type="number" value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })} /></label>
            <label className="f">scheduledDate<input className="input" type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></label>
            <label className="f" style={{ gridColumn: '1/-1' }}>{t.desc}<textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div><button className="btn primary">{t.save}</button></div>
          </form>
        </div>
      )}
      <div className="wo-grid">
        {loading && <div className="loader-wrap" style={{ gridColumn: '1 / -1' }}><Loader /></div>}
        {!loading && rows.map((w) => (
          <div key={w._id} className="dq-card wo-card">
            <div className="wo-top">
              <span className={`wo-pri ${PRI_CLS[w.priority] || ''}`}>{w.priority}{lang === 'ar' ? '' : ' PRIORITY'}</span>
              <span className="spacer" />
              {mayEdit(w) ? (
                <div className="wo-menu-wrap">
                  <button className="wo-status" onClick={() => setOpenMenu(openMenu === w._id ? null : w._id)}>
                    {w.status} <span className="wo-chev">▾</span>
                  </button>
                  {openMenu === w._id && (
                    <>
                      <div className="wo-backdrop" onClick={() => setOpenMenu(null)} />
                      <div className="wo-menu">
                        {['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => (
                          <button key={s} className={s === w.status ? 'cur' : ''} onClick={() => { setOpenMenu(null); changeStatus(w, s); }}>
                            <i style={{ background: ST_C[s] }} />{s}{s === w.status ? ' ✓' : ''}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span className="wo-status ro">{w.status}</span>
              )}
              {can(user, 'ADMIN') && <button className="lc-del" onClick={() => del(w._id)} title={t.del}>×</button>}
            </div>
            <b className="wo-title">{w.title || `${w.type} #${w._id}`}</b>
            <div className="wo-asset">{rlabel(w.assetId, ['assetTag'])} • {rlabel(w.assetId, ['name'])}</div>
            <div className="wo-check">
              <span className="wo-cap">{lang === 'ar' ? 'قائمة الفني' : 'TECHNICIAN CHECKLIST'}</span>
              {(w.checklist || []).map((c, i) => (
                <label key={i} className={`wo-item ${c.isDone ? 'done' : ''} ${mayEdit(w) ? '' : 'ro'}`}>
                  <input type="checkbox" checked={!!c.isDone} disabled={!mayEdit(w)} onChange={() => toggleCheck(w, i)} />
                  <span className="wo-box">{c.isDone ? '✓' : ''}</span>
                  <span className="wo-task" title={c.note || c.task}>{c.task}</span>
                </label>
              ))}
              {!(w.checklist || []).length && <span className="dq-dim">—</span>}
            </div>
            {w.description && <p className="wo-desc">{w.description}</p>}
            <div className="wo-foot">
              <span className="dq-dim">Tech: <b style={{ color: 'var(--dq-text)' }}>{rlabel(w.technicianId, ['fullName', 'email'])}</b></span>
              <span className="dq-dim">Downtime: <b className="wo-dt">{w.downtimeHours ?? 0} hrs</b></span>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && !loading && !err && <p className="muted">{t.noData}</p>}
    </Layout>
  );
}
