import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData, rlabel } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';

const money = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const dkey = (d) => d.toISOString().slice(0, 10);

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(target); return; }
    let raf; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* Heuristic risk model (client-side, transparent): weighted live signals 0-100 */
function scoreAsset(a, openWos) {
  let score = 0;
  const reasons = [];
  const push = (w, label) => { score += w; reasons.push({ w, label }); };
  if (a.status === 'UNDER_MAINTENANCE') push(30, 'Under Maintenance');
  const crit = openWos.filter((w) => ['HIGH', 'CRITICAL'].includes(w.priority));
  if (crit.length) push(Math.min(50, crit.length * 25), crit.length > 1 ? `Critical Orders (${crit.length})` : 'Critical Work Order');
  const rest = openWos.length - crit.length;
  if (rest) push(Math.min(24, rest * 8), `Open Orders (${openWos.length})`);
  if (a.procurement?.warrantyExpiry && new Date(a.procurement.warrantyExpiry) < new Date()) push(15, 'Warranty Expired');
  if (a.condition === 'DAMAGED') push(12, 'Damaged Condition');
  else if (a.condition === 'POOR') push(8, 'Poor Condition');
  const life = a.categoryId?.expectedLifetimeMonths;
  const pd = a.procurement?.purchaseDate ? new Date(a.procurement.purchaseDate) : null;
  if (life && pd) {
    const ageM = (Date.now() - pd.getTime()) / (30 * 24 * 3600 * 1000);
    if (ageM > life) push(10, 'Past Expected Life');
  }
  reasons.sort((x, y) => y.w - x.w);
  return { score: Math.min(100, Math.round(score)), reason: reasons[0]?.label || 'No Active Signals' };
}
const levelOf = (s) => (s >= 60 ? 'HIGH' : s >= 30 ? 'MEDIUM' : 'LOW');

const Spark = ({ data, color, id }) => {
  const W = 220, H = 52;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - 4 - (v / max) * (H - 12)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rk-spark" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const ACTION_FOR = (reason) => {
  if (/Warranty|Expected Life/i.test(reason)) return { label: 'Schedule Inspection', href: '/work-orders' };
  if (/Critical/i.test(reason)) return { label: 'Create Work Order', href: '/work-orders' };
  if (/Maintenance/i.test(reason)) return { label: 'View Orders', href: '/work-orders' };
  if (/Retire/i.test(reason)) return { label: 'Flag for Retirement', href: '/assets' };
  return { label: 'Inspect Asset', href: '/assets' };
};

export default function Dashboard() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState(null);
  const [assets, setAssets] = useState([]);
  const [wos, setWos] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState([]);
  const [hoverT, setHoverT] = useState(null);
  const [hoverD, setHoverD] = useState(null);
  const PAGE = 5;

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/assets', { params: { limit: 100 } }),
      api.get('/work-orders', { params: { limit: 100 } }),
    ])
      .then(([s, a, w]) => {
        setStats(s.data.data);
        setAssets(listData(a));
        setWos(listData(w));
      })
      .catch((e) => setErr(errMsg(e)));
  }, []);

  const openWos = useMemo(() => wos.filter((w) => ['OPEN', 'IN_PROGRESS', 'ON_HOLD'].includes(w.status)), [wos]);
  const openByAsset = useMemo(() => {
    const m = {};
    openWos.forEach((w) => {
      const id = w.assetId?._id ?? w.assetId;
      (m[id] = m[id] || []).push(w);
    });
    return m;
  }, [openWos]);

  const queue = useMemo(() => {
    return assets
      .filter((a) => a.status !== 'RETIRED')
      .map((a) => {
        const { score, reason } = scoreAsset(a, openByAsset[a._id] || []);
        return { a, score, level: levelOf(score), reason };
      })
      .sort((x, y) => y.score - x.score);
  }, [assets, openByAsset]);

  const highCount = queue.filter((x) => x.level === 'HIGH').length;
  const avgScore = queue.length ? queue.reduce((s, x) => s + x.score, 0) / queue.length : 0;

  const pmRate = useMemo(() => {
    const sched = wos.filter((w) => w.type === 'SCHEDULED' && w.status === 'COMPLETED');
    if (!sched.length) return null;
    const onTime = sched.filter((w) => !w.scheduledDate || !w.completedAt || new Date(w.completedAt) <= new Date(w.scheduledDate)).length;
    return (onTime / sched.length) * 100;
  }, [wos]);

  const weeks = useMemo(() => {
    const out = Array.from({ length: 12 }, () => ({ all: 0, crit: 0, done: 0, sched: 0 }));
    wos.forEach((w) => {
      const ageW = Math.floor((Date.now() - new Date(w.createdAt).getTime()) / (7 * 864e5));
      if (ageW < 0 || ageW > 11) return;
      const b = out[11 - ageW];
      b.all += 1;
      if (['HIGH', 'CRITICAL'].includes(w.priority)) b.crit += 1;
      if (w.status === 'COMPLETED') b.done += 1;
      if (w.type === 'SCHEDULED') b.sched += 1;
    });
    return out;
  }, [wos]);

  const trend = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ key: dkey(d), label: d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'numeric' }), brk: 0, pm: 0 });
    }
    const map = Object.fromEntries(days.map((d) => [d.key, d]));
    wos.forEach((w) => {
      const k = String(w.createdAt).slice(0, 10);
      if (map[k]) map[k].brk += 1;
      if (w.type === 'SCHEDULED' && w.status === 'COMPLETED' && w.completedAt) {
        const k2 = String(w.completedAt).slice(0, 10);
        if (map[k2]) map[k2].pm += 1;
      }
    });
    return days;
  }, [wos, lang]);

  const cats = useMemo(() => {
    const m = {};
    queue.forEach((x) => {
      const name = x.a.categoryId?.name || `#${x.a.categoryId?._id ?? '?'}`;
      (m[name] = m[name] || { name, HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 })[x.level] += 1;
      m[name].total += 1;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 4);
  }, [queue]);

  const locs = useMemo(() => {
    const m = {};
    queue.filter((x) => x.level === 'HIGH').forEach((x) => {
      const l = x.a.locationId;
      const name = l?.name || (lang === 'ar' ? 'غير محدد' : 'Unassigned');
      const sub = l ? [l.code, l.type].filter(Boolean).join(' · ') : '';
      const k = l?._id ?? 'none';
      if (!m[k]) m[k] = { name, sub, count: 0 };
      m[k].count += 1;
    });
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [queue, lang]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return queue;
    return queue.filter((x) => `${x.a.assetTag} ${x.a.name} ${x.a.categoryId?.name || ''}`.toLowerCase().includes(s));
  }, [queue, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const allSel = rows.length > 0 && rows.every((r) => sel.includes(r.a._id));
  const toggleSel = (id) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const togglePage = () => setSel((p) => (allSel ? p.filter((id) => !rows.some((r) => r.a._id === id)) : [...new Set([...p, ...rows.map((r) => r.a._id)])]));

  const totalA = useCountUp(stats?.counts.total || 0);
  const highA = useCountUp(highCount);
  const avgA = useCountUp(avgScore);
  const pmA = useCountUp(pmRate ?? 0);

  const TW = 560, TH = 190, TP = 30;
  const tmax = Math.max(4, ...trend.map((d) => Math.max(d.brk, d.pm)));
  const TX = (i) => TP + (i / (trend.length - 1)) * (TW - TP * 2);
  const TY = (v) => TH - 24 - (v / tmax) * (TH - 56);
  const tline = (f) => trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${TX(i).toFixed(1)},${TY(f(d)).toFixed(1)}`).join(' ');
  const thp = hoverT != null ? trend[hoverT] : null;

  const DW = 200, DH = 120, DR = 46, DCIRC = 2 * Math.PI * DR;
  const dist = useMemo(() => {
    const h = queue.filter((x) => x.level === 'HIGH').length;
    const m = queue.filter((x) => x.level === 'MEDIUM').length;
    const l = queue.length - h - m;
    const tot = queue.length || 1;
    return [
      { k: 'HIGH', v: h, c: '#fb7185' }, { k: 'MEDIUM', v: m, c: '#fbbf24' }, { k: 'LOW', v: l, c: '#34d399' },
    ].map((p) => ({ ...p, pct: (p.v / tot) * 100 }));
  }, [queue]);
  let dacc = 0;

  if (!stats && !err) return <Layout title={t.dashboard}><div className="loader-wrap"><Loader /></div></Layout>;
  if (err) return <Layout title={t.dashboard}><div className="alert err">{err}</div></Layout>;

  return (
    <Layout title={t.dashboard}>
      <div className="rk-wrap">
        {/* row 1: KPIs */}
        <div className="rk-kpis">
          <div className="rk-card b-blue">
            <div className="rk-kh"><span className="rk-ico">▦</span><span>Total Assets</span></div>
            <div className="rk-big">{Math.round(totalA).toLocaleString()}</div>
            <Spark data={weeks.map((w) => w.all)} color="#60a5fa" id="sp1" />
          </div>
          <div className="rk-card b-red">
            <div className="rk-kh"><span className="rk-ico">⚠</span><span>High Risk Assets</span></div>
            <div className="rk-big red">{Math.round(highA)} <small>(HIGH)</small></div>
            <div className="rk-pill red">● Immediate Action</div>
            <Spark data={weeks.map((w) => w.crit)} color="#fb7185" id="sp2" />
          </div>
          <div className="rk-card b-amber">
            <div className="rk-kh"><span className="rk-ico">◔</span><span>Average Risk Score</span></div>
            <div className="rk-big amber">{avgA.toFixed(1)} <small>/ 100</small></div>
            <div className="rk-pill amber">Yellow: {levelOf(avgScore)}</div>
            <Spark data={weeks.map((w) => w.done)} color="#fbbf24" id="sp3" />
          </div>
          <div className="rk-card b-green">
            <div className="rk-kh"><span className="rk-ico">▣</span><span>On-Time PM Rate</span></div>
            <div className="rk-big green">{pmRate == null ? '—' : `${pmA.toFixed(1)}%`}</div>
            <div className="rk-pill green">{pmRate == null ? 'No PM data' : pmRate >= 80 ? 'Healthy' : 'Needs Attention'}</div>
            <Spark data={weeks.map((w) => w.sched)} color="#34d399" id="sp4" />
          </div>
        </div>

        {/* row 2 */}
        <div className="rk-row2">
          <div className="rk-card">
            <b>Asset Risk Distribution</b>
            <div className="rk-donut-row">
              <svg viewBox="0 0 200 120" className="rk-donut">
                <circle cx="100" cy="60" r={DR} fill="none" className="dq-track" strokeWidth="18" transform="rotate(-90 100 60)" />
                {dist.map((p) => {
                  const len = (p.pct / 100) * DCIRC;
                  const s = `rotate(-90 100 60)`;
                  const cur = dacc;
                  dacc += len;
                  const hot = hoverD === p.k;
                  return <circle key={p.k} cx="100" cy="60" r={DR} fill="none" stroke={p.c} strokeWidth={hot ? 23 : 18}
                    strokeDasharray={`${len} ${DCIRC - len}`} strokeDashoffset={-cur} transform={s}
                    opacity={!hoverD || hot ? 1 : 0.35} style={{ cursor: 'pointer', transition: 'all .18s' }}
                    onMouseEnter={() => setHoverD(p.k)} onMouseLeave={() => setHoverD(null)} />;
                })}
                <text x="100" y="56" textAnchor="middle" className="rk-dt-n">{lang === 'ar' ? 'الإجمالي' : 'Total'}</text>
                <text x="100" y="72" textAnchor="middle" className="rk-dt-l">{queue.length}</text>
              </svg>
              <div className="dq-legend">
                {dist.map((p) => (
                  <div key={p.k} className={hoverD === p.k ? 'hot' : ''}
                    onMouseEnter={() => setHoverD(p.k)} onMouseLeave={() => setHoverD(null)}>
                    <i style={{ background: p.c }} />{p.k}<b>{p.v} · {p.pct.toFixed(0)}%</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rk-card">
            <b>Risk Levels by Category</b>
            <div className="rk-cbars">
              {cats.map((c) => {
                const max = Math.max(1, c.HIGH, c.MEDIUM, c.LOW);
                return (
                  <div key={c.name} className="rk-cbar" title={`${c.name}: H${c.HIGH} M${c.MEDIUM} L${c.LOW}`}>
                    <div className="rk-stack">
                      {[['HIGH', '#fb7185'], ['MEDIUM', '#fbbf24'], ['LOW', '#34d399']].map(([k, col]) => (
                        <div key={k} style={{ height: `${Math.max(4, (c[k] / (c.total || 1)) * 100)}%`, background: col }} title={`${k}: ${c[k]}`} />
                      ))}
                    </div>
                    <span>{c.name.slice(0, 10)}</span>
                  </div>
                );
              })}
              {!cats.length && <p className="dq-dim">{t.noData}</p>}
            </div>
          </div>

          <div className="rk-card rk-trend">
            <b>Failure Trend (30 Days)</b>
            <div className="db-legend" style={{ margin: '6px 0' }}>
              <i className="sw b" />Breaks<i className="sw" style={{ background: '#34d399' }} />PMs
            </div>
            <div className="db-chart-box">
              <svg viewBox={`0 0 ${TW} ${TH}`} className="db-svg" onMouseLeave={() => setHoverT(null)}>
                {[0.25, 0.5, 0.75, 1].map((f) => (
                  <line key={f} x1={TP} x2={TW - TP} y1={TY(tmax * f)} y2={TY(tmax * f)} className="db-grid" />
                ))}
                <path d={tline((d) => d.brk)} fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />
                <path d={tline((d) => d.pm)} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
                {trend.map((d, i) => (
                  <g key={d.key}>
                    <rect x={TX(i) - (TW / trend.length / 2)} y="0" width={TW / trend.length} height={TH}
                      fill="transparent" onMouseEnter={() => setHoverT(i)} style={{ cursor: 'pointer' }} />
                    {hoverT === i && (
                      <>
                        <line x1={TX(i)} x2={TX(i)} y1="8" y2={TH - 24} className="db-hover-line" />
                        <circle cx={TX(i)} cy={TY(d.brk)} r="4.5" className="db-dot b" />
                        <circle cx={TX(i)} cy={TY(d.pm)} r="4" fill="#34d399" stroke="var(--dq-card)" strokeWidth="2" />
                      </>
                    )}
                  </g>
                ))}
                {[0, 7, 14, 21, 29].map((i) => (
                  <text key={i} x={TX(i)} y={TH - 6} textAnchor="middle" className="db-axis">{trend[i].label}</text>
                ))}
              </svg>
              {thp && (
                <div className="db-tip" style={{ insetInlineStart: `calc(${(TX(hoverT) / TW) * 100}% - 60px)` }}>
                  <b>{thp.label}</b>
                  <span>Break: {thp.brk} · PMs: {thp.pm}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rk-card">
            <b>Critical Location Risk Cards</b>
            <div className="rk-locs">
              {locs.map((l) => (
                <div key={l.name} className="rk-loc">
                  <span>{l.name}<small>{l.sub}</small></span>
                  <b className="rk-count">● {l.count}</b>
                </div>
              ))}
              {!locs.length && <p className="dq-dim">{t.noData}</p>}
            </div>
          </div>
        </div>

        {/* row 3: queue */}
        <div className="rk-card">
          <div className="dq-row between">
            <b>{lang === 'ar' ? 'طابور الأصول عالية الخطورة' : 'Predictive Operational High-Risk Queue'}</b>
            <div className="row">
              <input className="input" style={{ maxWidth: 200 }} placeholder={t.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rk-tbl">
              <thead><tr>
                <th><input type="checkbox" checked={allSel} onChange={togglePage} /></th>
                <th>Asset Tag</th><th>Category</th><th>Location</th><th>Risk Score</th><th>Top Risk Reason</th><th>Action</th>
              </tr></thead>
              <tbody>
                {rows.map(({ a, score, level, reason }) => {
                  const act = ACTION_FOR(reason);
                  return (
                    <tr key={a._id}>
                      <td><input type="checkbox" checked={sel.includes(a._id)} onChange={() => toggleSel(a._id)} /></td>
                      <td><b>{a.assetTag}</b></td>
                      <td>{rlabel(a.categoryId)}</td>
                      <td className="dq-dim">{rlabel(a.locationId)}</td>
                      <td><b className={`rk-score ${level}`}>{score}</b> <span className={`dq-badge ${level === 'HIGH' ? 'bad' : level === 'MEDIUM' ? 'warn' : 'ok'}`}>{level}</span></td>
                      <td className="dq-dim">{reason}</td>
                      <td><Link className="rk-act" to={act.href === '/assets' ? `/assets/${a._id}` : act.href}>[{act.label}]</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && <p className="dq-dim">{t.noData}</p>}
          <div className="pager">
            <span className="muted">Showing {(cur - 1) * PAGE + 1}-{Math.min(cur * PAGE, filtered.length)} of {filtered.length}</span>
            <button className="btn" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 5).map((p) => (
              <button key={p} className={p === cur ? 'btn primary' : 'btn'} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="btn" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>›</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
