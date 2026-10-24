import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData, metaOf, rlabel, rid } from '../lib/api.js';
import { empties } from '../lib/form.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const ASSIGNABLE = new Set(['ROOM', 'OFFICE', 'LAB', 'STORAGE']);

export default function Transfers() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAsset, setFilterAsset] = useState('');
  const [show, setShow] = useState(false);
  const [assets, setAssets] = useState([]);
  const [locs, setLocs] = useState([]);
  const [users, setUsers] = useState([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [form, setForm] = useState({ assetId: '', toLocationId: '', toCustodianId: '', reason: '' });

  const load = async (p = page) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 10 };
      if (filterAsset) params.assetId = filterAsset;
      const r = await api.get('/transfers', { params });
      setRows(listData(r)); setMeta(metaOf(r));
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };

  const loadOptions = async () => {
    try {
      const [a, l, u] = await Promise.all([
        api.get('/assets', { params: { limit: 100 } }),
        api.get('/locations', { params: { limit: 100 } }),
        api.get('/auth/users', { params: { limit: 100 } }),
      ]);
      setAssets(listData(a));
      const all = listData(l);
      setLocs((Array.isArray(all) ? all : []).filter((x) => ASSIGNABLE.has(x.type)));
      setUsers(listData(u));
    } catch { /* options are best-effort; selects stay empty */ }
  };

  useEffect(() => { loadOptions(); }, []);
  useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, [filterAsset]);
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, []);

  const assetOpts = useMemo(() => {
    const s = assetSearch.trim().toLowerCase();
    const list = s
      ? assets.filter((a) => `${a.assetTag} ${a.name} ${a.serialNumber || ''}`.toLowerCase().includes(s))
      : assets;
    return list.slice(0, 50);
  }, [assets, assetSearch]);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const bad = empties([[form.assetId, 'assetId'], [form.reason, t.reason]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    if (!form.toLocationId && !form.toCustodianId) { setErr(`${t.fillReq}: toLocationId / toCustodianId`); return; }
    try {
      await api.post('/transfers', {
        assetId: Number(form.assetId),
        toLocationId: form.toLocationId ? Number(form.toLocationId) : undefined,
        toCustodianId: form.toCustodianId ? Number(form.toCustodianId) : undefined,
        reason: form.reason,
      });
      setOk(lang === 'ar' ? 'تم النقل بنجاح' : 'Transferred successfully');
      setForm({ assetId: '', toLocationId: '', toCustodianId: '', reason: '' });
      setAssetSearch(''); setShow(false); load(1); setPage(1);
    } catch (e2) { setErr(errMsg(e2)); }
  };

  const canCreate = can(user, 'ADMIN', 'CUSTODIAN');

  return (
    <Layout title={t.transfers}>
      {err && <div className="alert err">{err}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      <div className="tx-head">
        <div>
          <h2>{lang === 'ar' ? 'سجل نقل العهدة' : 'Append-Only Custody Transfer Ledger'}</h2>
          <p className="dq-dim">AST-FR-04: {lang === 'ar' ? 'سلسلة رسمية لسجلات العهدة بمسؤولية موثقة' : 'Formal chain of custody logs with verifiable responsibility'}</p>
        </div>
        {canCreate && <button className="dq-btn" onClick={() => setShow((s) => !s)}>⇄ {lang === 'ar' ? 'بدء نقل' : 'Initiate Transfer'}</button>}
      </div>

      {show && canCreate && (
        <div className="dq-card tx-form">
          <h3>POST /api/transfers</h3>
          <form onSubmit={submit} className="form-grid" noValidate>
            <label className="f">{lang === 'ar' ? 'الأصل (ابحث واختر)' : 'Asset (search & pick)'}
              <input className="input" placeholder={t.search} value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} />
              <select className="select" style={{ marginTop: 6 }} required value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
                <option value="">— {assets.length} {lang === 'ar' ? 'أصل' : 'assets'} —</option>
                {assetOpts.map((a) => <option key={a._id} value={a._id}>{a.assetTag} — {a.name}</option>)}
              </select>
            </label>
            <label className="f">{lang === 'ar' ? 'إلى موقع' : 'To location'}
              <select className="select" value={form.toLocationId} onChange={(e) => setForm({ ...form, toLocationId: e.target.value })}>
                <option value="">— {lang === 'ar' ? 'اختر من القائمة' : 'pick from list'} —</option>
                {locs.map((l) => <option key={l._id} value={l._id}>{l.name} ({l.code})</option>)}
              </select>
            </label>
            <label className="f">{lang === 'ar' ? 'إلى عهدة' : 'To custodian'}
              <select className="select" value={form.toCustodianId} onChange={(e) => setForm({ ...form, toCustodianId: e.target.value })}>
                <option value="">— {lang === 'ar' ? 'اختر من القائمة' : 'pick from list'} —</option>
                {users.map((u) => <option key={u._id} value={u._id}>{u.fullName} · {u.role}</option>)}
              </select>
            </label>
            <label className="f" style={{ gridColumn: '1/-1' }}>{t.reason}
              <textarea className="textarea" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            <div><button className="btn primary">{t.save}</button></div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <select className="select" style={{ maxWidth: 300 }} value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)}>
            <option value="">{lang === 'ar' ? 'كل الأصول' : 'All assets'}</option>
            {assets.slice(0, 100).map((a) => <option key={a._id} value={a._id}>{a.assetTag} — {a.name}</option>)}
          </select>
          {filterAsset && <button className="btn" onClick={() => setFilterAsset('')}>{t.clear}</button>}
          <span className="muted">{lang === 'ar' ? 'سجل دائم — لا تعديل ولا حذف' : 'Immutable log — no edit/delete'}</span>
        </div>
      </div>

      <div className="tx-list">
        {loading && <div className="loader-wrap"><Loader /></div>}
        {!loading && rows.map((x) => (
          <div key={x._id} className="dq-card tx-card">
            <div className="tx-title">
              <Link to={`/assets/${rid(x.assetId)}`} className="tx-asset">
                {x.assetId && typeof x.assetId === 'object' ? (
                  <><span className="tx-tag">{x.assetId.assetTag || `#${x.assetId._id}`}</span>{x.assetId.name ? ` (${x.assetId.name})` : ''}</>
                ) : `#${rid(x.assetId)}`}
              </Link>
              <span className="dq-dim">🕐 {String(x.createdAt).slice(0, 16).replace('T', ' ')}</span>
            </div>
            <div className="tx-boxes">
              <div className="tx-box">
                <span className="tx-cap">{lang === 'ar' ? 'المصدر (من)' : 'SOURCE (FROM)'}</span>
                <div><b>{lang === 'ar' ? 'العهدة' : 'Custodian'}:</b> {rlabel(x.fromCustodianId, ['fullName', 'email'])}</div>
                <div><b>{lang === 'ar' ? 'الموقع' : 'Location'}:</b> {rlabel(x.fromLocationId)}</div>
              </div>
              <div className="tx-box to">
                <span className="tx-cap">{lang === 'ar' ? 'الوجهة (إلى)' : 'DESTINATION (TO)'}</span>
                <div><b>{lang === 'ar' ? 'العهدة' : 'Custodian'}:</b> {rlabel(x.toCustodianId, ['fullName', 'email'])}</div>
                <div><b>{lang === 'ar' ? 'الموقع' : 'Location'}:</b> {rlabel(x.toLocationId)}</div>
              </div>
            </div>
            <div className="tx-foot">
              <span className="dq-dim">{lang === 'ar' ? 'المبرر' : 'Justification'}: {x.reason}</span>
              <span className="tx-auth">{lang === 'ar' ? 'اعتمد بواسطة' : 'Authorized By'}: {rlabel(x.transferredBy, ['fullName', 'email'])}</span>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && !loading && !err && <p className="muted">{t.noData}</p>}
      <div className="pager">
        <span className="muted">{t.page} {meta.page || 1} {t.of} {meta.pages || 1} ({meta.total ?? rows.length})</span>
        <button className="btn" disabled={(meta.page || 1) <= 1} onClick={() => { const p = (meta.page || 1) - 1; setPage(p); load(p); }}>‹</button>
        <button className="btn" disabled={(meta.page || 1) >= (meta.pages || 1)} onClick={() => { const p = (meta.page || 1) + 1; setPage(p); load(p); }}>›</button>
      </div>
    </Layout>
  );
}
