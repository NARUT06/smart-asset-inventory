import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData } from '../lib/api.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { empties } from '../lib/form.js';

const TRIG_CLS = { CALENDAR: 't-cal', RUNTIME: 't-run', CONDITION: 't-con' };

const taskText = (c) => {
  if (c == null) return '';
  if (typeof c === 'string') return c;
  return c.task || c.label || c.title || c.name || '';
};

export default function Templates() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', intervalDays: 90, categoryId: '', triggerType: 'CALENDAR' });

  const load = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        api.get('/maintenance-templates'),
        api.get('/categories', { params: { limit: 100 } }),
      ]);
      setRows(Array.isArray(r.data.data) ? r.data.data : []);
      setCats(listData(c));
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const bad = empties([[form.title.trim(), t.title], [form.categoryId, t.category]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    try {
      await api.post('/maintenance-templates', { ...form, intervalDays: Number(form.intervalDays), categoryId: Number(form.categoryId) });
      setOk(lang === 'ar' ? 'تم الإنشاء' : 'Created');
      setForm({ title: '', description: '', intervalDays: 90, categoryId: '', triggerType: 'CALENDAR' });
      setShow(false); load();
    } catch (e2) { setErr(errMsg(e2)); }
  };

  return (
    <Layout title={t.templates}>
      {err && <div className="alert err">{err}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      <div className="tx-head">
        <div>
          <h2>{lang === 'ar' ? 'قوالب الصيانة الوقائية' : 'Preventive Maintenance Templates'}</h2>
          <p className="dq-dim">{lang === 'ar' ? 'إيقاع تلقائي بالتقويم أو التشغيل أو حالة الحساسات' : 'Automated cadence triggered by Calendar interval, Runtime, or Sensor Condition'}</p>
        </div>
        {can(user, 'ADMIN', 'PROCUREMENT') && <button className="dq-btn" onClick={() => setShow((s) => !s)}>+ {t.add}</button>}
      </div>
      {show && can(user, 'ADMIN', 'PROCUREMENT') && (
        <div className="dq-card" style={{ marginBottom: 14 }}>
          <form onSubmit={submit} className="form-grid" noValidate>
            <label className="f">{t.title}<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="f">intervalDays<input className="input" type="number" min="1" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} /></label>
            <label className="f">{t.category}<select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
            <label className="f">triggerType<select className="select" value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })}><option>CALENDAR</option><option>RUNTIME</option><option>CONDITION</option></select></label>
            <label className="f" style={{ gridColumn: '1/-1' }}>{t.desc}<input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div><button className="btn primary">{t.save}</button></div>
          </form>
        </div>
      )}
      <div className="tp-grid">
        {loading && <div className="loader-wrap" style={{ gridColumn: '1 / -1' }}><Loader /></div>}
        {!loading && rows.map((x) => {
          const tasks = (Array.isArray(x.checklist) ? x.checklist : []).map(taskText).filter(Boolean);
          return (
            <div key={x.id} className="dq-card tp-card">
              <div className="tp-top">
                <span className={`tp-trig ${TRIG_CLS[x.triggerType] || 't-cal'}`}>{x.triggerType} {lang === 'ar' ? 'محفز' : 'TRIGGER'}</span>
                <span className="tp-every">{lang === 'ar' ? `كل ${x.intervalDays} يوم` : `Every ${x.intervalDays} Days`}</span>
              </div>
              <b className="tp-title">{x.title}</b>
              <div className="dq-dim tp-app">{lang === 'ar' ? 'ينطبق على' : 'Applicable'}: {x.category?.name ?? `#${x.categoryId}`}</div>
              {x.description && <div className="dq-dim tp-app">{x.description}</div>}
              <div className="tp-tasks">
                <span className="tp-cap">{lang === 'ar' ? 'المهام القياسية' : 'STANDARD TASKS'}</span>
                {tasks.map((task, i) => (
                  <div key={i} className="tp-task"><span className="tp-check">✓</span><span>{task}</span></div>
                ))}
                {!tasks.length && <span className="dq-dim">—</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!rows.length && !loading && !err && <p className="muted">{t.noData}</p>}
    </Layout>
  );
}
