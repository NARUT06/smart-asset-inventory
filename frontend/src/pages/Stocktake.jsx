import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData, rlabel } from '../lib/api.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const RESULT_CLS = {
  VERIFIED: 'ok',
  MOVED: 'warn',
  MISSING: 'bad',
  UNEXPECTED: 'bad',
};

export default function Stocktake() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', scope: '' });
  const [active, setActive] = useState(null); // full session with observations
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [observedLocationId, setObservedLocationId] = useState('');
  const [observedCondition, setObservedCondition] = useState('');
  const [locs, setLocs] = useState([]);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const r = await api.get('/stocktake');
      setSessions(listData(r));
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  };

  const loadSession = async (id) => {
    try {
      const r = await api.get(`/stocktake/${id}`);
      setActive(r.data.data);
      setErr('');
    } catch (e) { setErr(errMsg(e)); }
  };

  const loadLocs = async () => {
    try {
      const r = await api.get('/locations');
      const all = listData(r);
      setLocs(Array.isArray(all) ? all : []);
    } catch { /* best-effort */ }
  };

  useEffect(() => { loadSessions(); loadLocs(); }, []);

  const createSession = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const bad = [];
    if (!form.name.trim()) bad.push(lang === 'ar' ? 'اسم الجلسة' : 'Session name');
    if (!form.scope.trim()) bad.push(lang === 'ar' ? 'النطاق' : 'Scope');
    if (bad.length) { setErr(`${t.fillReq || (lang === 'ar' ? 'برجاء ملء' : 'Please fill')}: ${bad.join(', ')}`); return; }
    try {
      const r = await api.post('/stocktake', { name: form.name.trim(), scope: form.scope.trim() });
      setOk(lang === 'ar' ? 'تم إنشاء جلسة' : 'Session created');
      setForm({ name: '', scope: '' }); setShowCreate(false);
      await loadSessions();
      await loadSession(r.data.data.id);
    } catch (e2) { setErr(errMsg(e2)); }
  };

  const startScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      html5QrRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded) => {
          await scanner.stop().catch(() => {});
          html5QrRef.current = null;
          setScanning(false);
          // decoded should be assetTag or URL containing tag
          let tag = decoded;
          try { const u = new URL(decoded); tag = u.searchParams.get('tag') || decoded.split('/').pop(); } catch { /* not a URL */ }
          // lookup asset by search
          try {
            const r = await api.get('/assets', { params: { q: tag, limit: 5 } });
            const found = listData(r).find((a) => a.assetTag === tag || String(a._id) === String(tag));
            if (found) {
              setScanResult(found);
              setObservedLocationId(found.locationId?._id ?? found.locationId ?? '');
              setObservedCondition(found.condition || '');
            } else {
              setErr(lang === 'ar' ? `لم يتم العثور على أصل: ${tag}` : `Asset not found: ${tag}`);
            }
          } catch (e) { setErr(errMsg(e)); }
        },
        () => { /* ignore scan errors */ },
      );
    } catch (e) {
      setScanning(false);
      setErr(errMsg(e, lang === 'ar' ? 'تعذر الوصول إلى الكاميرا' : 'Camera access failed'));
    }
  };

  const stopScan = async () => {
    if (html5QrRef.current) {
      await html5QrRef.current.stop().catch(() => {});
      html5QrRef.current = null;
    }
    setScanning(false);
  };

  const recordObservation = async () => {
    if (!active || !scanResult) return;
    setErr(''); setOk('');
    try {
      const r = await api.post(`/stocktake/${active.id}/scan`, {
        assetId: scanResult._id,
        observedLocationId: observedLocationId ? Number(observedLocationId) : undefined,
        observedCondition: observedCondition || undefined,
      });
      setOk(`${r.data.data.result}: ${scanResult.assetTag}`);
      setScanResult(null);
      await loadSession(active.id);
    } catch (e) { setErr(errMsg(e)); }
  };

  const complete = async () => {
    if (!active) return;
    try {
      await api.patch(`/stocktake/${active.id}/complete`);
      setOk(lang === 'ar' ? 'تم إكمال الجلسة' : 'Session completed');
      await loadSessions();
      await loadSession(active.id);
    } catch (e) { setErr(errMsg(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm(t.confirmDel)) return;
    try { await api.delete(`/stocktake/${id}`); setActive(null); loadSessions(); } catch (e) { setErr(errMsg(e)); }
  };

  const obs = active?.observations || [];
  const summary = {
    verified: obs.filter((o) => o.result === 'VERIFIED').length,
    moved: obs.filter((o) => o.result === 'MOVED').length,
    missing: obs.filter((o) => o.result === 'MISSING').length,
    unexpected: obs.filter((o) => o.result === 'UNEXPECTED').length,
  };

  return (
    <Layout title={t.stocktake}>
      {err && <div className="alert err">{err}</div>}
      {ok && <div className="alert ok">{ok}</div>}

      <div className="tx-head">
        <div>
          <h2>{lang === 'ar' ? 'جلسات التدقيق/الجرد' : 'Stocktake / Audit Sessions'}</h2>
          <p className="dq-dim">AST-FR-07: {lang === 'ar' ? 'استخدام مسح QR ومراجعة الفروقات (missing/moved/unexpected/verified)' : 'QR scan + discrepancy review'}</p>
        </div>
        {can(user, 'ADMIN', 'PROCUREMENT', 'AUDITOR', 'CUSTODIAN') && (
          <button className="dq-btn" onClick={() => setShowCreate((s) => !s)}>+ {lang === 'ar' ? 'جلسة جديدة' : 'New Session'}</button>
        )}
      </div>

      {showCreate && (
        <div className="dq-card" style={{ marginBottom: 14 }}>
          <form onSubmit={createSession} className="form-grid" noValidate>
            <label className="f">{lang === 'ar' ? 'اسم الجلسة' : 'Session name'}<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="f">{lang === 'ar' ? 'النطاق (اجباري)' : 'Scope (required)'}
              <select className="select" required value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="">— {lang === 'ar' ? 'اختر من القائمة' : 'pick from list'} —</option>
                {locs.map((l) => <option key={l._id} value={l.name}>{l.name} ({l.code})</option>)}
              </select>
            </label>
            <div><button className="btn primary">{t.save}</button></div>
          </form>
        </div>
      )}

      <div className="st-grid">
        <div className="dq-card st-list">
          <b>{lang === 'ar' ? 'الجلسات' : 'Sessions'}</b>
          <div className="st-sessions">
            {loading && <div className="loader-wrap"><Loader /></div>}
            {!loading && sessions.map((s) => (
              <button key={s.id} className={`st-sess ${active?.id === s.id ? 'on' : ''}`} onClick={() => loadSession(s.id)}>
                <b>{s.name}</b>
                <span className="dq-dim">{s.scope || '—'} · {s.status}</span>
                <span className="dq-dim">{s._count?.observations ?? 0} obs · {String(s.createdAt).slice(0, 10)}</span>
              </button>
            ))}
            {!sessions.length && !loading && !err && <p className="dq-dim">{t.noData}</p>}
          </div>
        </div>

        <div className="dq-card st-main">
          {!active && <p className="dq-dim">{lang === 'ar' ? 'اختر جلسة أو أنشئ جديدة' : 'Select a session or create a new one'}</p>}
          {active && (
            <>
              <div className="st-head">
                <div>
                  <b>{active.name}</b>
                  <span className="dq-dim"> · {active.status} · {active.scope || '—'}</span>
                </div>
                <div className="row">
                  {active.status === 'OPEN' && can(user, 'ADMIN', 'PROCUREMENT', 'AUDITOR', 'CUSTODIAN') && (
                    <>
                      <button className="btn primary" onClick={startScan} disabled={scanning}>{scanning ? (lang === 'ar' ? 'جاري المسح…' : 'Scanning…') : (lang === 'ar' ? 'مسح QR' : 'Scan QR')}</button>
                      {scanning && <button className="btn" onClick={stopScan}>{lang === 'ar' ? 'إيقاف' : 'Stop'}</button>}
                      <button className="btn" onClick={complete}>{lang === 'ar' ? 'إكمال' : 'Complete'}</button>
                    </>
                  )}
                  {can(user, 'ADMIN') && <button className="btn danger" onClick={() => remove(active.id)}>{t.del}</button>}
                </div>
              </div>

              {scanning && <div id="qr-reader" className="st-reader" />}

              {scanResult && (
                <div className="st-scan">
                  <b>{scanResult.assetTag}</b> — {scanResult.name}
                  <div className="form-grid" style={{ marginTop: 8 }}>
                    <label className="f">{lang === 'ar' ? 'الموقع الفعلي (observed)' : 'Observed location'}
                      <select className="select" value={observedLocationId} onChange={(e) => setObservedLocationId(e.target.value)}>
                        <option value="">—</option>
                        {locs.map((l) => <option key={l._id} value={l._id}>{l.name} ({l.code})</option>)}
                      </select>
                    </label>
                    <label className="f">{lang === 'ar' ? 'الحالة الفعلية' : 'Observed condition'}
                      <select className="select" value={observedCondition} onChange={(e) => setObservedCondition(e.target.value)}>
                        <option value="">—</option>
                        {['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn primary" onClick={recordObservation}>{lang === 'ar' ? 'تسجيل الملاحظة' : 'Record Observation'}</button>
                    <button className="btn" onClick={() => setScanResult(null)}>{t.cancel}</button>
                  </div>
                </div>
              )}

              <div className="st-summary">
                <span className="dq-badge ok">{lang === 'ar' ? 'مطابق' : 'Verified'}: {summary.verified}</span>
                <span className="dq-badge warn">{lang === 'ar' ? 'منقول' : 'Moved'}: {summary.moved}</span>
                <span className="dq-badge bad">{lang === 'ar' ? 'مفقود' : 'Missing'}: {summary.missing}</span>
                <span className="dq-badge bad">{lang === 'ar' ? 'غير متوقع' : 'Unexpected'}: {summary.unexpected}</span>
              </div>

              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table className="tbl">
                  <thead><tr><th>Asset</th><th>{lang === 'ar' ? 'الموقع المتوقع' : 'Expected Loc'}</th><th>{lang === 'ar' ? 'الموقع الفعلي' : 'Observed Loc'}</th><th>{lang === 'ar' ? 'النتيجة' : 'Result'}</th><th>{lang === 'ar' ? 'الوقت' : 'Time'}</th></tr></thead>
                  <tbody>
                    {obs.map((o) => (
                      <tr key={o.id}>
                        <td><b>{o.asset?.assetTag}</b><br /><span className="dq-dim">{o.asset?.name}</span></td>
                        <td className="dq-dim">{o.expectedLocation?.name || '—'}</td>
                        <td className="dq-dim">{o.observedLocation?.name || '—'}</td>
                        <td><span className={`dq-badge ${RESULT_CLS[o.result] || 'info'}`}>{o.result}</span></td>
                        <td className="dq-dim">{String(o.scannedAt).slice(0, 19).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!obs.length && <p className="dq-dim">{t.noData}</p>}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
