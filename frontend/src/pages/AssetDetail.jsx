import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, rlabel } from '../lib/api.js';
import { empties } from '../lib/form.js';
import { useAuth, can } from '../lib/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

export default function AssetDetail() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [a, setA] = useState(null);
  const [life, setLife] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [risk, setRisk] = useState([]);
  const [transfer, setTransfer] = useState({ toLocationId: '', toCustodianId: '', reason: '' });
  const [st, setSt] = useState('');
  const [retire, setRetire] = useState({ retirementReason: '', disposalEvidence: '' });
  const [qrBusy, setQrBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);

  const load = async () => {
    setErr('');
    try {
      const res = await api.get(`/assets/${id}`);
      setA(res.data.data);
      setLife(res.data.data.lifecycle || null);
      const rh = await api.get(`/assets/${id}/risk-history`);
      setRisk(rh.data.data || []);
    } catch (e) { setErr(errMsg(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const assess = async () => {
    setErr(''); setOk('');
    try {
      const res = await api.post(`/assets/${id}/assess-risk`);
      setOk(`risk=${res.data.data.prediction.risk_score} level=${res.data.data.prediction.risk_level}`);
      load();
    } catch (e) { setErr(errMsg(e)); }
  };
  const doTransfer = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const bad = empties([[transfer.reason.trim(), t.reason]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    if (!transfer.toLocationId && !transfer.toCustodianId) { setErr(`${t.fillReq}: toLocationId / toCustodianId`); return; }
    try {
      await api.post('/transfers', {
        assetId: Number(id),
        toLocationId: transfer.toLocationId ? Number(transfer.toLocationId) : undefined,
        toCustodianId: transfer.toCustodianId ? Number(transfer.toCustodianId) : undefined,
        reason: transfer.reason,
      });
      setOk('Transferred'); setTransfer({ toLocationId: '', toCustodianId: '', reason: '' }); load();
    } catch (e2) { setErr(errMsg(e2)); }
  };
  const doStatus = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const bad = empties([[st, t.status]]);
    if (bad.length) { setErr(`${t.fillReq}: ${bad.join(', ')}`); return; }
    try { await api.patch(`/assets/${id}/status`, { status: st }); setOk('Status updated'); load(); }
    catch (e2) { setErr(errMsg(e2)); }
  };
  const doRetire = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    try { await api.patch(`/assets/${id}/retire`, retire); setOk('Retired'); load(); }
    catch (e2) { setErr(errMsg(e2)); }
  };

  const printQr = async () => {
    setQrBusy(true); setErr('');
    try {
      const res = await api.get(`/assets/${id}/qr`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setQrUrl(url);
    } catch (e) { setErr(errMsg(e)); }
    finally { setQrBusy(false); }
  };
  const downloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `asset-${id}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const closeQr = () => {
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    setQrUrl(null);
  };

  return (
    <Layout title={`${t.assets} #${id}`}>
      {err && <div className="alert err">{err}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      {!a && !err && <div className="loader-wrap"><Loader /></div>}
      {a && (
        <div className="grid g2">
          <div className="card">
            <h3>{a.name} <span className="badge info">{a.assetTag}</span></h3>
            <p className="muted">{a.brand} {a.model} · SN {a.serialNumber}</p>
            <p>{t.category}: {rlabel(a.categoryId)} · {t.location}: {rlabel(a.locationId)} · {t.custodian}: {rlabel(a.custodianId)}</p>
            <p><span className="badge info">{a.status}</span> <span className="badge">{a.condition}</span></p>
            <p className="muted">{t.supplier}: {a.procurement?.supplierName} · {t.cost}: {a.procurement?.purchaseCost} · {t.purchaseDate}: {String(a.procurement?.purchaseDate || '').slice(0, 10)} · {t.warranty}: {String(a.procurement?.warrantyExpiry || '—').slice(0, 10)}</p>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={assess}>{t.assessRisk}</button>
              <button className="btn" onClick={printQr} disabled={qrBusy}>
                {qrBusy ? '…' : (lang === 'ar' ? 'عرض QR' : 'Show QR')}
              </button>
            </div>
          </div>
          <div className="grid">
            {can(user, 'ADMIN', 'CUSTODIAN') && (
              <div className="card">
                <h4>{t.transferAsset}</h4>
                <form onSubmit={doTransfer} className="form-grid" noValidate>
                  <label className="f">toLocationId<input className="input" type="number" value={transfer.toLocationId} onChange={(e) => setTransfer({ ...transfer, toLocationId: e.target.value })} /></label>
                  <label className="f">toCustodianId<input className="input" type="number" value={transfer.toCustodianId} onChange={(e) => setTransfer({ ...transfer, toCustodianId: e.target.value })} /></label>
                  <label className="f">{t.reason}<input className="input" required value={transfer.reason} onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })} /></label>
                  <div><button className="btn primary">{t.save}</button></div>
                </form>
              </div>
            )}
            {can(user, 'ADMIN', 'CUSTODIAN') && (
              <div className="card">
                <h4>{t.changeStatus}</h4>
                <form onSubmit={doStatus} className="row">
                  <select className="select" style={{ maxWidth: 220 }} value={st} onChange={(e) => setSt(e.target.value)}>
                    <option value="">—</option>
                    {['IN_USE', 'IN_STORAGE', 'UNDER_MAINTENANCE', 'RETIRED'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="btn primary">PATCH /status</button>
                </form>
              </div>
            )}
            {can(user, 'ADMIN') && (
              <div className="card">
                <h4>{t.retire}</h4>
                <form onSubmit={doRetire} className="form-grid">
                  <label className="f">{t.reason}<input className="input" value={retire.retirementReason} onChange={(e) => setRetire({ ...retire, retirementReason: e.target.value })} /></label>
                  <label className="f">disposalEvidence<input className="input" value={retire.disposalEvidence} onChange={(e) => setRetire({ ...retire, disposalEvidence: e.target.value })} /></label>
                  <div><button className="btn danger">{t.retire}</button></div>
                </form>
              </div>
            )}
            <div className="card">
              <h4>{t.riskHistory}</h4>
              {!risk.length && <p className="muted">{t.noData}</p>}
              {risk.map((r) => <div key={r.id} className="row"><span className="badge warn">{r.riskLevel} {r.riskScore}</span><span className="muted">{String(r.assessedAt).slice(0, 19).replace('T', ' ')}</span><span className="muted">{r.recommendations}</span></div>)}
            </div>
          </div>
        </div>
      )}
      {qrUrl && (
        <div className="qr-modal" onClick={closeQr}>
          <div className="qr-card" onClick={(e) => e.stopPropagation()}>
            <h3>{lang === 'ar' ? 'QR Code' : 'QR Code'}</h3>
            <img src={qrUrl} alt="QR" className="qr-img" />
            <p className="dq-dim">{lang === 'ar' ? 'كود الأصل' : 'Asset Tag'}: {a?.assetTag}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={downloadQr}>{lang === 'ar' ? 'تنزيل' : 'Download'}</button>
              <button className="btn" onClick={closeQr}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
