import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  X, Eye, MapPin, Calendar, CheckCircle2, XCircle, Clock, Zap,
} from 'lucide-react';
import { getOnSpotBookings } from '../../services/api';

interface Booking {
  id: number;
  booking_id?: string | null;
  status?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  user_mobile?: string | null;
  driver_id?: number | null;
  driver_name?: string | null;
  driver_mobile?: string | null;
  pickup_city?: string | null;
  drop_city?: string | null;
  to_city?: string | null;
  pickup_address?: string | null;
  drop_address?: string | null;
  distance?: number | string | null;
  total_fare?: string | number | null;
  actual_fare?: string | number | null;
  plan_price?: string | null;
  plan_name?: string | null;
  platform_fee?: string | null;
  payment_mode?: string | null;
  paid?: number | null;
  sub_service_name?: string | null;
  schedule_date?: string | null;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  created_at?: string;
  service_name?: string | null;
  [key: string]: unknown;
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  COMPLETED:    { bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  CANCELLED:    { bg: '#fff1f2', color: '#991b1b', dot: '#ef4444' },
  SEARCHING:    { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  ACCEPTED:     { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  STARTED:      { bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  DROPPED:      { bg: '#f0fdf4', color: '#14532d', dot: '#4ade80' },
  BALANCE_PAID: { bg: '#fdf4ff', color: '#6b21a8', dot: '#a855f7' },
  PAYMENT_DONE: { bg: '#ecfdf5', color: '#065f46', dot: '#34d399' },
  ARRIVED:      { bg: '#ede9fe', color: '#5b21b6', dot: '#8b5cf6' },
  PICKEDUP:     { bg: '#e0f2fe', color: '#075985', dot: '#0ea5e9' },
};
const getStatus = (s?: string | null) =>
  STATUS_CONFIG[(s || '').toUpperCase()] || { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' };

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtAmt = (v?: string | number | null) =>
  v != null && parseFloat(String(v)) > 0 ? `₹${parseFloat(String(v)).toFixed(2)}` : '—';

function StatusBadge({ status }: { status?: string | null }) {
  const st = getStatus(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
      {(status || '—').toUpperCase()}
    </span>
  );
}

function DetailModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', minWidth: 130, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500, textAlign: 'right', flex: 1 }}>{value || '—'}</span>
    </div>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>On Spot Booking #{booking.id}</h3>
            <StatusBadge status={booking.status} />
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>
        <div style={{ padding: '16px 22px 22px' }}>
          <div style={{ background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', border: '1.5px solid #c7d2fe', borderRadius: 12, padding: '14px 18px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#4338ca' }}>{fmtAmt(booking.total_fare || booking.plan_price)}</div>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>Total Fare</div>
          </div>
          <Row label="Booking ID"    value={booking.booking_id} />
          <Row label="User"          value={booking.user_name} />
          <Row label="Mobile"        value={booking.user_mobile} />
          <Row label="Captain"       value={booking.driver_name} />
          <Row label="Captain Mobile"value={booking.driver_mobile} />
          <Row label="Sub Service"   value={booking.sub_service_name} />
          <Row label="Plan"          value={booking.plan_name} />
          <Row label="Pickup"        value={booking.pickup_address || booking.pickup_city} />
          <Row label="Drop"          value={booking.drop_address || booking.drop_city} />
          <Row label="Distance"      value={booking.distance ? `${booking.distance} km` : undefined} />
          <Row label="Platform Fee"  value={fmtAmt(booking.platform_fee)} />
          <Row label="Payment Mode"  value={booking.payment_mode} />
          <Row label="Paid"          value={booking.paid === 1 ? 'Yes' : booking.paid === 0 ? 'No' : undefined} />
          {booking.cancel_reason && <Row label="Cancel Reason" value={booking.cancel_reason} />}
          <Row label="Scheduled"     value={fmtDate(booking.schedule_date)} />
          <Row label="Created"       value={fmtDate(booking.created_at)} />
        </div>
      </div>
    </div>
  );
}

export default function OnSpotHistory() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const [detail,   setDetail]   = useState<Booking | null>(null);
  const PER_PAGE = 10;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await getOnSpotBookings({ limit: 1000 });
      const body = (res as { data: unknown }).data;
      const all: Booking[] =
        Array.isArray(body) ? body :
        Array.isArray((body as { data?: Booking[] })?.data) ? (body as { data: Booking[] }).data :
        Array.isArray((body as { bookings?: Booking[] })?.bookings) ? (body as { bookings: Booking[] }).bookings : [];
      setBookings(all);
    } catch (err) { console.error('[OnSpot] fetch error:', err); setBookings([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => bookings.filter(b => {
    const q = search.toLowerCase();
    const ms = !q || String(b.id).includes(q) || (b.booking_id || '').toLowerCase().includes(q) ||
      (b.user_name || '').toLowerCase().includes(q) || (b.user_mobile || '').includes(q) ||
      (b.driver_name || '').toLowerCase().includes(q) || (b.pickup_city || '').toLowerCase().includes(q) ||
      (b.drop_city || '').toLowerCase().includes(q);
    const mst = !status || (b.status || '').toUpperCase() === status.toUpperCase();
    return ms && mst;
  }), [bookings, search, status]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = {
    total:     bookings.length,
    completed: bookings.filter(b => ['COMPLETED', 'PAYMENT_DONE', 'BALANCE_PAID'].includes((b.status || '').toUpperCase())).length,
    cancelled: bookings.filter(b => (b.status || '').toUpperCase() === 'CANCELLED').length,
    active:    bookings.filter(b => ['SEARCHING', 'ACCEPTED', 'STARTED', 'ARRIVED', 'PICKEDUP'].includes((b.status || '').toUpperCase())).length,
  };

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp      { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ padding: 24, animation: 'fadeSlideUp 0.4s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>On Spot History</h2>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>All bookings for On Spot service</p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total',     value: stats.total,     bg: '#eef2ff', color: '#4338ca', icon: <Zap size={18} color="#4338ca" /> },
            { label: 'Completed', value: stats.completed, bg: '#d1fae5', color: '#059669', icon: <CheckCircle2 size={18} color="#059669" /> },
            { label: 'Cancelled', value: stats.cancelled, bg: '#fee2e2', color: '#dc2626', icon: <XCircle size={18} color="#dc2626" /> },
            { label: 'Active',    value: stats.active,    bg: '#fef3c7', color: '#d97706', icon: <Clock size={18} color="#d97706" /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: '14px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 220 }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search booking, user, driver, city..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', color: '#1e293b' }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} color="#94a3b8" /></button>}
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', fontSize: 12, outline: 'none', background: 'white', color: '#1e293b' }}>
            <option value="">All Status</option>
            <option value="SEARCHING">Searching</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="STARTED">Started</option>
            <option value="PICKEDUP">Picked Up</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="PAYMENT_DONE">Payment Done</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {['#', 'Booking ID', 'User', 'Captain', 'Route', 'Sub Service', 'Fare', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} style={{ padding: 14 }}><div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: '65%' }} /></td>
                    ))}
                  </tr>
                ))}
                {!loading && paginated.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center' }}>
                    <Zap size={32} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 10px' }} />
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>No On Spot bookings found.</div>
                  </td></tr>
                )}
                {!loading && paginated.map((b, idx) => (
                  <tr key={b.id} onClick={() => setDetail(b)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{(page - 1) * PER_PAGE + idx + 1}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{b.booking_id || `#${b.id}`}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{b.user_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{b.user_mobile || ''}</div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#475569' }}>{b.driver_name || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569' }}>
                        <MapPin size={11} color="#6366f1" />
                        <span>{b.pickup_city || '—'}</span>
                        <span style={{ color: '#cbd5e1' }}>→</span>
                        <span>{b.drop_city || '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>{b.sub_service_name || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#4338ca' }}>{fmtAmt(b.total_fare || b.plan_price)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} />{fmtDate(b.created_at)}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}><StatusBadge status={b.status} /></td>
                    <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDetail(b)} style={{ background: '#eef2ff', border: 'none', color: '#6366f1', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex' }}>
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Showing <b style={{ color: '#475569' }}>{filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</b> of <b style={{ color: '#475569' }}>{filtered.length}</b></span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1, display: 'flex' }}>
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1, display: 'flex' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {detail && <DetailModal booking={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
