import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, AlertCircle, X,
  Wallet, User, Car, Eye, Filter,
} from 'lucide-react';
import { getWithdrawalRequests, updateWithdrawalStatus, getAllUsers, getAllDrivers } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WithdrawalRequest {
  id: number;
  user_id?: number | null;
  user_type?: string | null;          // 'USER' | 'DRIVER'
  name?: string | null;               // profile name from users/drivers join
  first_name?: string | null;
  last_name?: string | null;
  account_holder_name?: string | null;
  mobile?: string | null;
  amount: string | number;
  account_number?: string | null;
  ifsc_code?: string | null;
  bank_name?: string | null;
  upi_id?: string | null;
  status: string;                     // 'PENDING' | 'REJECTED' | 'APPROVED'
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ToastState { message: string; type: 'success' | 'error'; }

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  pending:  { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Pending'  },
  approved: { bg: '#d1fae5', color: '#065f46', dot: '#10b981', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'Rejected' },
};
const getStatus = (s?: string) => STATUS[(s || '').toLowerCase()] || STATUS.pending;

const fmtAmt  = (v: string | number) => `₹${parseFloat(String(v)).toFixed(2)}`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const getDisplayName = (r: WithdrawalRequest) => {
  if (r.name) return r.name;
  if (r.first_name || r.last_name) return `${r.first_name || ''} ${r.last_name || ''}`.trim();
  return r.account_holder_name || '—';
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const ok = toast.type === 'success';
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: ok ? '#f0fdf4' : '#fff1f2', border: `1.5px solid ${ok ? '#bbf7d0' : '#fecdd3'}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: 320, animation: 'slideInRight 0.3s ease' }}>
      {ok ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#ef4444" />}
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? '#15803d' : '#dc2626' }}>{toast.message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: 0 }}><X size={14} color="#94a3b8" /></button>
    </div>
  );
}

// ─── Status Update Modal ──────────────────────────────────────────────────────
function StatusModal({ req, onClose, onDone }: {
  req: WithdrawalRequest;
  onClose: () => void;
  onDone: (id: number, status: string, remark: string) => Promise<void>;
}) {
  const [status,  setStatus]  = useState<'approved' | 'rejected'>('approved');
  const [remark,  setRemark]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await onDone(req.id, status, remark);
      onClose();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Update failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: 440, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', animation: 'slideUp 0.3s ease' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Update Withdrawal Status</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Request #{req.id} · {fmtAmt(req.amount)}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 16 }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Status selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 8 }}>Action</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['approved', 'rejected'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{ padding: '10px 16px', borderRadius: 10, border: `2px solid ${status === s ? (s === 'approved' ? '#10b981' : '#ef4444') : '#e2e8f0'}`, background: status === s ? (s === 'approved' ? '#d1fae5' : '#fee2e2') : 'white', color: status === s ? (s === 'approved' ? '#065f46' : '#991b1b') : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  {s === 'approved' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  {s === 'approved' ? 'Approve' : 'Reject'}
                </button>
              ))}
            </div>
          </div>

          {/* Remark */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Remark {status === 'rejected' && <span style={{ color: '#ef4444' }}>*</span>}</label>
            <textarea
              value={remark} onChange={e => setRemark(e.target.value)}
              placeholder={status === 'approved' ? 'Optional note...' : 'Reason for rejection...'}
              rows={3}
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', color: '#1e293b', boxSizing: 'border-box' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={loading || (status === 'rejected' && !remark.trim())}
              style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: loading ? '#e2e8f0' : status === 'approved' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (status === 'rejected' && !remark.trim()) ? 0.5 : 1 }}>
              {loading ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Updating...</> : <>{status === 'approved' ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Confirm {status === 'approved' ? 'Approval' : 'Rejection'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ req, onClose, displayName }: { req: WithdrawalRequest; onClose: () => void; displayName?: string }) {
  const st = getStatus(req.status);
  const isUser = (req.user_type || '').toUpperCase() !== 'DRIVER';

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', minWidth: 120 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500, textAlign: 'right', flex: 1 }}>{value || '—'}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', animation: 'slideUp 0.3s ease' }}>

        <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Withdrawal Request #{req.id}</h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, marginTop: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, display: 'inline-block' }} /> {st.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>

        <div style={{ padding: '16px 22px 22px' }}>
          {/* Amount banner */}
          <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '16px 20px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#065f46' }}>{fmtAmt(req.amount)}</div>
            <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2, fontWeight: 600 }}>Withdrawal Amount</div>
          </div>

          {/* Requester */}
          <div style={{ background: isUser ? '#eff6ff' : '#f0fdf4', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: isUser ? '#dbeafe' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isUser ? <User size={16} color="#2563eb" /> : <Car size={16} color="#16a34a" />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{displayName || getDisplayName(req)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{isUser ? 'User' : 'Captain'} · {req.mobile || `ID #${req.user_id}`}</div>
            </div>
          </div>

          <Row label="Request Date"   value={fmtDate(req.created_at)} />
          <Row label="Type"           value={<span style={{ background: isUser ? '#eff6ff' : '#f0fdf4', color: isUser ? '#2563eb' : '#16a34a', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{req.user_type || '—'}</span>} />
          <Row label="User ID"        value={`#${req.user_id}`} />
          {req.bank_name      && <Row label="Bank"           value={req.bank_name} />}
          {req.account_holder_name && <Row label="Account Holder" value={req.account_holder_name} />}
          {req.account_number && <Row label="Account No."    value={<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{req.account_number}</code>} />}
          {req.ifsc_code      && <Row label="IFSC"           value={<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{req.ifsc_code}</code>} />}
          {req.upi_id         && <Row label="UPI ID"         value={req.upi_id} />}
          {req.remarks        && <Row label="Remarks"        value={req.remarks} />}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WithdrawalRequests() {
  const [requests,      setRequests]      = useState<WithdrawalRequest[]>([]);
  const [userMap,       setUserMap]       = useState<Record<number, string>>({});
  const [driverMap,     setDriverMap]     = useState<Record<number, string>>({});
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [typeFilter,    setTypeFilter]    = useState('');
  const [page,          setPage]          = useState(1);
  const [actionTarget,  setActionTarget]  = useState<WithdrawalRequest | null>(null);
  const [detailTarget,  setDetailTarget]  = useState<WithdrawalRequest | null>(null);
  const [toast,         setToast]         = useState<ToastState | null>(null);
  const PER_PAGE = 10;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [resW, resU, resD] = await Promise.all([
        getWithdrawalRequests(),
        getAllUsers(),
        getAllDrivers(),
      ]);

      // withdrawal list
      const body = (resW as { data: unknown }).data;
      const list: WithdrawalRequest[] =
        Array.isArray(body) ? body :
        Array.isArray((body as { data?: WithdrawalRequest[] })?.data) ? (body as { data: WithdrawalRequest[] }).data : [];
      setRequests(list);

      // user name map  (users have `name`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uBody = (resU as any).data;
      const uList: { id: number; name?: string | null }[] =
        Array.isArray(uBody) ? uBody : Array.isArray(uBody?.data) ? uBody.data : [];
      const uMap: Record<number, string> = {};
      uList.forEach(u => { if (u.id) uMap[u.id] = u.name || ''; });
      setUserMap(uMap);

      // driver name map (drivers have `full_name`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dBody = (resD as any).data;
      const dList: { id: number; full_name?: string | null }[] =
        Array.isArray(dBody) ? dBody : Array.isArray(dBody?.data) ? dBody.data : [];
      const dMap: Record<number, string> = {};
      dList.forEach(d => { if (d.id) dMap[d.id] = d.full_name || ''; });
      setDriverMap(dMap);
    } catch {
      setRequests([]);
    } finally { setLoading(false); }
  }, []);

  const resolvedName = useCallback((r: WithdrawalRequest): string => {
    if (r.user_id) {
      const isDriver = (r.user_type || '').toUpperCase() === 'DRIVER';
      const fromMap  = isDriver ? driverMap[r.user_id] : userMap[r.user_id];
      if (fromMap) return fromMap;
    }
    return getDisplayName(r);
  }, [userMap, driverMap]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleStatusUpdate = async (id: number, status: string, remark: string) => {
    await updateWithdrawalStatus(id, { status, remark });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status, remarks: remark } : r));
    setToast({ message: `Request ${status === 'approved' ? 'approved' : 'rejected'} successfully!`, type: 'success' });
  };

  const filtered = useMemo(() => requests.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      String(r.id).includes(q) ||
      (r.account_holder_name || '').toLowerCase().includes(q) ||
      (r.mobile || '').includes(q) ||
      String(r.amount).includes(q);
    const matchStatus = !statusFilter || r.status?.toUpperCase() === statusFilter.toUpperCase();
    const matchType   = !typeFilter   || (r.user_type || '').toUpperCase() === typeFilter.toUpperCase();
    return matchSearch && matchStatus && matchType;
  }), [requests, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = {
    total:    requests.length,
    pending:  requests.filter(r => r.status?.toUpperCase() === 'PENDING').length,
    approved: requests.filter(r => r.status?.toUpperCase() === 'APPROVED').length,
    rejected: requests.filter(r => r.status?.toUpperCase() === 'REJECTED').length,
  };

  const totalPending = requests.filter(r => r.status?.toUpperCase() === 'PENDING').reduce((s, r) => s + parseFloat(String(r.amount) || '0'), 0);

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp      { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes spin         { to { transform:rotate(360deg) } }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .wd-row:hover td { background:#fafbff !important; cursor:pointer; }
      `}</style>

      <div className="responsive-page" style={{ padding: 24, animation: 'fadeSlideUp 0.4s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Withdrawal Requests</h2>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }}>
              Manage user & captain withdrawal requests
            </p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total',    value: stats.total,    bg: '#eef2ff', color: '#6366f1', icon: <Wallet size={18} color="#6366f1" /> },
            { label: 'Pending',  value: stats.pending,  bg: '#fef3c7', color: '#d97706', icon: <Clock size={18} color="#d97706" /> },
            { label: 'Approved', value: stats.approved, bg: '#d1fae5', color: '#059669', icon: <CheckCircle2 size={18} color="#059669" /> },
            { label: 'Rejected', value: stats.rejected, bg: '#fee2e2', color: '#dc2626', icon: <XCircle size={18} color="#dc2626" /> },
            { label: 'Pending Amount', value: `₹${totalPending.toFixed(2)}`, bg: '#fff7ed', color: '#c2410c', icon: <Wallet size={18} color="#c2410c" /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: '14px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 1 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 220 }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search by ID, name, mobile, amount..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', color: '#1e293b' }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} color="#94a3b8" /></button>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px' }}>
            <Filter size={13} color="#94a3b8" />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1e293b', background: 'transparent', cursor: 'pointer', minWidth: 100 }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px' }}>
            <User size={13} color="#94a3b8" />
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1e293b', background: 'transparent', cursor: 'pointer', minWidth: 100 }}>
              <option value="">All Types</option>
              <option value="user">User</option>
              <option value="driver">Captain</option>
            </select>
          </div>

          {(search || statusFilter || typeFilter) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1); }}
              style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626', padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 860 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {['#', 'Requester', 'Type', 'Amount', 'Payment Info', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Skeleton */}
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} style={{ padding: 14 }}>
                        <div style={{ height: 13, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 0 ? '30%' : '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Empty */}
                {!loading && paginated.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 56, textAlign: 'center' }}>
                      <Wallet size={32} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 10px' }} />
                      <div style={{ color: '#94a3b8', fontSize: 13 }}>No withdrawal requests found.</div>
                    </td>
                  </tr>
                )}

                {/* Rows */}
                {!loading && paginated.map((r, idx) => {
                  const st     = getStatus(r.status);
                  const isUser    = (r.user_type || '').toUpperCase() !== 'DRIVER';
                  const isPending = r.status?.toUpperCase() === 'PENDING';
                  return (
                    <tr key={r.id} className="wd-row" onClick={() => setDetailTarget(r)} style={{ borderBottom: '1px solid #f1f5f9' }}>

                      {/* # */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                        {(page - 1) * PER_PAGE + idx + 1}
                      </td>

                      {/* Requester */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: isUser ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isUser ? <User size={14} color="#2563eb" /> : <Car size={14} color="#16a34a" />}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{resolvedName(r)}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.mobile || ''}</div>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: isUser ? '#eff6ff' : '#f0fdf4', color: isUser ? '#2563eb' : '#16a34a', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>
                          {isUser ? 'User' : 'Captain'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{fmtAmt(r.amount)}</div>
                      </td>

                      {/* Payment Info */}
                      <td style={{ padding: '12px 16px' }}>
                        {r.upi_id ? (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>UPI</div>
                            <div style={{ fontSize: 12, color: '#475569' }}>{r.upi_id}</div>
                          </div>
                        ) : r.bank_name ? (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#0369a1' }}>{r.bank_name}</div>
                            <div style={{ fontSize: 12, color: '#475569' }}>{r.account_number}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
                          {st.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {fmtDate(r.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setDetailTarget(r)} title="View"
                            style={{ background: '#eef2ff', border: 'none', color: '#6366f1', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex' }}>
                            <Eye size={13} />
                          </button>
                          {isPending && (
                            <button onClick={() => setActionTarget(r)} title="Update Status"
                              style={{ background: '#fef3c7', border: 'none', color: '#d97706', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                              <CheckCircle2 size={12} /> Action
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Showing <b style={{ color: '#475569' }}>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</b> of <b style={{ color: '#475569' }}>{filtered.length}</b>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1, display: 'flex' }}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5) {
                    if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;
                  }
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: page === p ? 'none' : '1.5px solid #e2e8f0', background: page === p ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'white', color: page === p ? 'white' : '#475569', cursor: 'pointer', fontWeight: page === p ? 700 : 400, fontSize: 12 }}>
                      {p}
                    </button>
                  );
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1, display: 'flex' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {actionTarget && (
        <StatusModal
          req={actionTarget}
          onClose={() => setActionTarget(null)}
          onDone={handleStatusUpdate}
        />
      )}
      {detailTarget && (
        <DetailModal req={detailTarget} onClose={() => setDetailTarget(null)} displayName={resolvedName(detailTarget)} />
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
