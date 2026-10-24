import { useEffect, useMemo, useState } from 'react';
import { Building2, Building, Layers, DoorOpen, FlaskConical, Archive, ChevronDown, MapPin } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData } from '../lib/api.js';
import { empties } from '../lib/form.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const TYPES = ['CAMPUS', 'BUILDING', 'FLOOR', 'ROOM', 'OFFICE', 'LAB', 'STORAGE'];
const LEAF = new Set(['ROOM', 'OFFICE', 'LAB', 'STORAGE']);

const iconFor = (type) => {
  switch (type) {
    case 'CAMPUS': return Building2;
    case 'BUILDING': return Building;
    case 'FLOOR': return Layers;
    case 'LAB': return FlaskConical;
    case 'STORAGE': return Archive;
    case 'ROOM':
    case 'OFFICE': return DoorOpen;
    default: return MapPin;
  }
};

function Node({ n, depth, onDelete, canDel, t }) {
  const [open, setOpen] = useState(true);
  const kids = n.children || [];
  const Icon = iconFor(n.type);
  const id = n._id ?? n.id;
  return (
    <div className="lc-node">
      <div className="lc-row">
        <button className="lc-chev" onClick={() => setOpen((o) => !o)} style={{ visibility: kids.length ? 'visible' : 'hidden' }} aria-label="toggle">
          <ChevronDown size={15} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        </button>
        <span className="lc-ico"><Icon size={17} /></span>
        <b className="lc-name" title={n.name}>{n.name}</b>
        <span className="lc-code">{n.code}</span>
        <span className="spacer" />
        <span className="lc-type">{n.type}</span>
        {LEAF.has(n.type) && <span className="lc-assets">{n.assetCount ?? 0} {t === 'ar' ? 'أصل' : 'Assets'}</span>}
        {canDel && (
          <button className="lc-del" title={t === 'ar' ? 'حذف' : 'Delete'} onClick={() => onDelete(id)}>×</button>
        )}
      </div>
      {open && kids.length > 0 && (
        <div className="lc-kids">
          {kids.map((c) => (
            <Node key={c._id ?? c.id} n={c} depth={depth + 1} onDelete={onDelete} canDel={canDel} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Locations() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [tree, setTree] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', code: '', type: 'ROOM', parentId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const rt = await api.get('/locations/tree');
      setTree(rt.data.data || []);
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const bad = empties([[form.name.trim(), t.name], [form.code.trim(), t.code]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    try {
      await api.post('/locations', { ...form, parentId: form.parentId ? Number(form.parentId) : undefined });
      setForm({ name: '', code: '', type: 'ROOM', parentId: '' }); load();
    } catch (e2) { setErr(errMsg(e2)); }
  };
  const del = async (id) => {
    if (!window.confirm(t.confirmDel)) return;
    try { await api.delete(`/locations/${id}`); load(); } catch (e) { setErr(errMsg(e)); }
  };

  const flatCount = useMemo(() => {
    let n = 0;
    const walk = (arr) => arr.forEach((x) => { n += 1; if (x.children?.length) walk(x.children); });
    walk(tree);
    return n;
  }, [tree]);

  return (
    <Layout title={t.locations}>
      {err && <div className="alert err">{err}</div>}
      {can(user, 'ADMIN') && (
        <div className="card">
          <form onSubmit={submit} className="form-grid" noValidate>
            <label className="f">{t.name}<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="f">{t.code}<input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="f">{t.type}<select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label className="f">parentId<input className="input" type="number" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} /></label>
            <div className="row" style={{ alignItems: 'flex-end' }}><button className="btn primary">{t.save}</button></div>
          </form>
          <p className="muted">CAMPUS→BUILDING→FLOOR→ROOM/OFFICE/LAB/STORAGE · {flatCount} nodes</p>
        </div>
      )}
      <div className="dq-card lc-wrap">
        <h2>{lang === 'ar' ? 'شجرة المواقع الهرمية' : 'Campus Hierarchical Location Tree'}</h2>
        <p className="dq-dim">AST-FR-01: CAMPUS → BUILDING → FLOOR → ROOM / LAB / STORAGE</p>
        <div className="lc-tree">
          {loading && <div className="loader-wrap"><Loader /></div>}
          {!loading && tree.map((n) => (
            <Node key={n._id ?? n.id} n={n} depth={0} onDelete={del} canDel={can(user, 'ADMIN')} t={lang} />
          ))}
        </div>
        {!tree.length && !loading && !err && <p className="muted">{t.noData}</p>}
      </div>
    </Layout>
  );
}
