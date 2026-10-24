import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import { api, errMsg, listData, metaOf } from '../lib/api.js';
import { useLang } from '../lib/i18n.jsx';

export default function Audit() {
  const { t } = useLang();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const r = await api.get('/admin/logs', { params: { page: p, limit: 20 } });
      setRows(listData(r)); setMeta(r.data.meta || metaOf(r));
    } catch (e) { setErr(errMsg(e, 'ADMIN only')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);

  return (
    <Layout title={t.audit}>
      {err && <div className="alert err">{err}</div>}
      <div className="card" style={{ overflowX: 'auto' }}>
        {loading && <div className="loader-wrap"><Loader /></div>}
        {!loading && (
          <>
            <table className="tbl"><thead><tr><th>ID</th><th>Action</th><th>Entity</th><th>User</th><th>Details</th><th>At</th></tr></thead>
              <tbody>{rows.map((l) => (
                <tr key={l.id}><td>{l.id}</td><td><span className="badge">{l.action}</span></td><td>{l.entity} #{l.entityId ?? ''}</td>
                  <td>{l.user ? `${l.user.fullName} (${l.user.email})` : l.userId}</td>
                  <td className="dq-dim">{l.details ? Object.keys(l.details).join(', ') : '—'}</td>
                  <td className="muted">{String(l.createdAt).slice(0, 19).replace('T', ' ')}</td></tr>
              ))}</tbody></table>
            {!rows.length && !err && <p className="muted">{t.noData}</p>}
            <div className="pager"><span className="muted">{t.page} {meta.page || 1} {t.of} {meta.totalPages || 1}</span>
              <button className="btn" disabled={(meta.page || 1) <= 1} onClick={() => { const p = (meta.page || 1) - 1; setPage(p); load(p); }}>‹</button>
              <button className="btn" disabled={(meta.page || 1) >= (meta.totalPages || 1)} onClick={() => { const p = (meta.page || 1) + 1; setPage(p); load(p); }}>›</button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
