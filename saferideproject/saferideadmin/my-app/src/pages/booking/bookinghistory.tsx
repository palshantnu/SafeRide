import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronLeft, ChevronRight,
  CheckCircle2, X, MapPin, User,
  Car, Calendar, Hash, RefreshCw, Filter, Phone,
  ShoppingBag, XCircle, Activity, Eye, Navigation,
} from 'lucide-react';
import { getAllBookinghistory } from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Booking {
  id: number;
  booking_id: string;
  booking_type: string;
  service_id: number;
  sub_service_id: number | null;
  status: string;
  user_status: string;
  driver_status: string;
  cancelled_by: string;
  cancel_reason: string | null;
  pickup_city: string;
  drop_city: string;
  to_city: string | null;
  pickup_address: string | null;
  drop_address: string | null;
  distance: number | null;
  total_fare: string | null;
  actual_distance: string | null;
  actual_fare: string | null;
  platform_fee: string | null;
  paid: number;
  payment_mode: string | null;
  person: number;
  schedule_date: string | null;
  otp: number | null;
  created_at: string;
  user_id: number;
  user_name: string | null;
  user_mobile: string;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  service_name: string;
  sub_service_name: string | null;
  plan_name: string | null;
  plan_price: string | null;
}

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  COMPLETED:    { bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  CANCELLED:    { bg: '#fff1f2', color: '#991b1b', dot: '#ef4444' },
  SEARCHING:    { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  ACCEPTED:     { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  ARRIVED:      { bg: '#ede9fe', color: '#5b21b6', dot: '#8b5cf6' },
  STARTED:      { bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  PICKEDUP:     { bg: '#e0f2fe', color: '#075985', dot: '#0ea5e9' },
  DROPPED:      { bg: '#f0fdf4', color: '#14532d', dot: '#4ade80' },
  BALANCE_PAID: { bg: '#fdf4ff', color: '#6b21a8', dot: '#a855f7' },
  PAYMENT_DONE: { bg: '#ecfdf5', color: '#065f46', dot: '#34d399' },
};
const getStatus = (s?: string) =>
  STATUS_CONFIG[(s || '').toUpperCase()] || { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtDate  = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtFull  = (d?: string | null) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtAmt   = (v?: string | null) => v && parseFloat(v) > 0 ? `₹${parseFloat(v).toFixed(2)}` : v ? `₹${v}` : '—';

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
function DetailModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const st = getStatus(booking.status);

  const Row = ({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', minWidth: '130px', paddingTop: '2px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: highlight ? '#6366f1' : '#1e293b', fontWeight: highlight ? 700 : 500, textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  );

  const Section = ({ title, color = '#6366f1', bg = '#eef2ff' }: { title: string; color?: string; bg?: string }) => (
    <div style={{ background: bg, borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 6px' }}>
      {title}
    </div>
  );

  const StatusBadge = ({ s }: { s?: string }) => {
    const sc = getStatus(s);
    return (
      <span style={{ background: sc.bg, color: sc.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
        {s || '—'}
      </span>
    );
  };

  const totalFare = booking.total_fare || booking.plan_price;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '540px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', animation: 'slideUp 0.3s ease' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Booking Details</h3>
            <code style={{ fontSize: '12px', color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px', marginTop: '6px', display: 'inline-block' }}>
              {booking.booking_id}
            </code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: st.bg, color: st.color, fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
              {booking.status}
            </span>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex' }}>
              <X size={16} color="#64748b" />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>

          {/* Route Banner */}
          <div style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)', borderRadius: '14px', padding: '16px 20px', margin: '16px 0', border: '1.5px solid #e0e7ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: booking.pickup_address ? '10px' : 0 }}>
              <div style={{ textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{booking.pickup_city}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Pickup</div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ flex: 1, height: '2px', background: '#e0e7ff', borderRadius: '2px' }} />
                <MapPin size={14} color="#6366f1" />
                {booking.to_city && <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>{booking.to_city}</span>}
                <div style={{ flex: 1, height: '2px', background: '#e0e7ff', borderRadius: '2px' }} />
              </div>
              <div style={{ textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{booking.drop_city}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Drop</div>
              </div>
            </div>
            {booking.pickup_address && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #e0e7ff' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>FROM:</span> {booking.pickup_address}
              </div>
            )}
            {booking.drop_address && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>TO:</span> {booking.drop_address}
              </div>
            )}
          </div>

          {/* Fare Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '4px' }}>
            {[
              { label: 'Total Fare', value: fmtAmt(totalFare), color: '#059669', bg: '#f0fdf4' },
              { label: 'Actual Fare', value: fmtAmt(booking.actual_fare), color: '#0369a1', bg: '#f0f9ff' },
              { label: 'Platform Fee', value: fmtAmt(booking.platform_fee), color: '#7c3aed', bg: '#fdf4ff' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', fontWeight: 600 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Booking Info */}
          <Section title="Booking Info" />
          <Row label="Booking ID"    value={<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{booking.booking_id}</code>} />
          <Row label="Booking Type"  value={<span style={{ background: '#fdf4ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{booking.booking_type === '1' ? 'Outstation / Rental' : 'In City'}</span>} />
          <Row label="Service"       value={booking.service_name} />
          <Row label="Sub Service"   value={booking.sub_service_name || '—'} />
          {booking.plan_name && <Row label="Plan"   value={booking.plan_name} />}
          {booking.plan_price && <Row label="Plan Price" value={<span style={{ color: '#059669', fontWeight: 700 }}>₹{booking.plan_price}</span>} />}
          <Row label="Distance"      value={booking.actual_distance ? `${booking.actual_distance} km` : booking.distance ? `${booking.distance} km (est.)` : '—'} />
          <Row label="Payment Mode"  value={<span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{booking.payment_mode || '—'}</span>} />
          <Row label="Paid"          value={booking.paid === 1 ? <span style={{ color: '#059669', fontWeight: 700 }}>Yes</span> : <span style={{ color: '#ef4444', fontWeight: 700 }}>No</span>} />
          <Row label="Persons"       value={booking.person} />
          {booking.otp != null && <Row label="OTP" value={<code style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{booking.otp}</code>} />}
          {booking.schedule_date && <Row label="Schedule" value={fmtFull(booking.schedule_date)} />}
          <Row label="Created At"    value={fmtFull(booking.created_at)} />

          {/* Status Info */}
          <Section title="Status Info" color="#0369a1" bg="#f0f9ff" />
          <Row label="Booking Status" value={<StatusBadge s={booking.status} />} />
          <Row label="User Status"    value={<StatusBadge s={booking.user_status} />} />
          <Row label="Captain Status" value={<StatusBadge s={booking.driver_status} />} />
          {booking.cancelled_by && booking.cancelled_by !== 'NONE' && <>
            <Row label="Cancelled By"  value={<span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{booking.cancelled_by}</span>} />
            <Row label="Cancel Reason" value={booking.cancel_reason || '—'} />
          </>}

          {/* User Info */}
          <Section title="User Info" color="#0369a1" bg="#f0f9ff" />
          <Row label="User ID" value={`#${booking.user_id}`} />
          <Row label="Name"    value={booking.user_name || '—'} />
          <Row label="Mobile"  value={
            <a href={`tel:${booking.user_mobile}`} style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
              {booking.user_mobile}
            </a>
          } />

          {/* Captain Info */}
          <Section title="Captain Info" color="#065f46" bg="#f0fdf4" />
          {booking.driver_id ? <>
            <Row label="Captain ID" value={`#${booking.driver_id}`} />
            <Row label="Name"       value={booking.driver_name || '—'} />
            <Row label="Mobile"     value={
              booking.driver_mobile
                ? <a href={`tel:${booking.driver_mobile}`} style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>{booking.driver_mobile}</a>
                : '—'
            } />
          </> : (
            <div style={{ padding: '12px 0', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No captain assigned</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, count, icon, bg, color }: { label: string; count: number; icon: React.ReactNode; bg: string; color: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '14px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{count}</div>
        <div style={{ fontSize: '11px', color, fontWeight: 600, marginTop: '1px' }}>{label}</div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BookingHistory() {
  const [bookings,     setBookings]     = useState<Booking[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [page,         setPage]         = useState(1);
  const [selectedBk,   setSelectedBk]  = useState<Booking | null>(null);
  const PER_PAGE = 10;

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await getAllBookinghistory({ limit: 1000 });
      const body = (res as { data: unknown }).data;
      const list: Booking[] =
        Array.isArray(body) ? body :
        Array.isArray((body as { data?: Booking[] })?.data) ? (body as { data: Booking[] }).data : [];
      setBookings(list);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const statuses = useMemo(() => [...new Set(bookings.map(b => b.status))].sort(), [bookings]);
  const types    = useMemo(() => [...new Set(bookings.map(b => b.booking_type).filter(Boolean))].sort(), [bookings]);

  const filtered = useMemo(() => bookings.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.booking_id.toLowerCase().includes(q) ||
      (b.user_name  || '').toLowerCase().includes(q) ||
      (b.user_mobile || '').includes(q) ||
      (b.pickup_city || '').toLowerCase().includes(q) ||
      (b.drop_city   || '').toLowerCase().includes(q) ||
      (b.driver_name || '').toLowerCase().includes(q) ||
      (b.service_name || '').toLowerCase().includes(q) ||
      (b.sub_service_name || '').toLowerCase().includes(q) ||
      (b.plan_name   || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || b.status === statusFilter;
    const matchType   = !typeFilter   || b.booking_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  }), [bookings, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const completed = useMemo(() => bookings.filter(b => ['COMPLETED', 'DROPPED', 'BALANCE_PAID', 'PAYMENT_DONE'].includes(b.status)).length, [bookings]);
  const cancelled = useMemo(() => bookings.filter(b => b.status === 'CANCELLED').length, [bookings]);
  const active    = useMemo(() => bookings.filter(b => ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'STARTED', 'PICKEDUP'].includes(b.status)).length, [bookings]);

  const resetFilters = () => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1); };
  const hasFilter    = search || statusFilter || typeFilter;

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp      { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin         { to { transform:rotate(360deg) } }
        .bk-row:hover td { background:#fafbff !important; cursor:pointer; }
        .bk-row td { transition: background 0.12s; }
      `}</style>

      <div className="responsive-page" style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Booking History</h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px', margin: 0 }}>
              Total <b>{bookings.length}</b> bookings · Showing <b>{filtered.length}</b>
            </p>
          </div>
          <button onClick={fetchBookings} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <StatCard label="Total Bookings" count={bookings.length} bg="#eef2ff" color="#6366f1" icon={<ShoppingBag size={18} color="#6366f1" />} />
          <StatCard label="Completed"      count={completed}       bg="#d1fae5" color="#059669" icon={<CheckCircle2 size={18} color="#059669" />} />
          <StatCard label="Cancelled"      count={cancelled}       bg="#fee2e2" color="#dc2626" icon={<XCircle size={18} color="#dc2626" />} />
          <StatCard label="Active / Live"  count={active}          bg="#dbeafe" color="#2563eb" icon={<Activity size={18} color="#2563eb" />} />
        </div>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px', flex: 1, minWidth: '220px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              placeholder="Search by ID, user, captain, city, service..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', color: '#1e293b' }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={12} color="#94a3b8" />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px' }}>
            <Filter size={13} color="#94a3b8" />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#1e293b', background: 'transparent', cursor: 'pointer', minWidth: '100px' }}
            >
              <option value="">All Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {types.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px' }}>
              <Hash size={13} color="#94a3b8" />
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#1e293b', background: 'transparent', cursor: 'pointer', minWidth: '120px' }}
              >
                <option value="">All Types</option>
                <option value="0">In City</option>
                <option value="1">Outstation / Rental</option>
                {types.filter(t => t !== '0' && t !== '1').map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {hasFilter && (
            <button onClick={resetFilters}
              style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626', padding: '7px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {([
                    { label: '#',              align: 'left'   },
                    { label: 'Booking ID',     align: 'left'   },
                    { label: 'User',           align: 'left'   },
                    { label: 'Captain',        align: 'left'   },
                    { label: 'Route',          align: 'left'   },
                    { label: 'Service / Sub',  align: 'left'   },
                    { label: 'Amount',         align: 'right'  },
                    { label: 'Payment',        align: 'center' },
                    { label: 'Date',           align: 'center' },
                    { label: 'Status',         align: 'center' },
                    { label: '',               align: 'center' },
                  ] as { label: string; align: React.CSSProperties['textAlign'] }[]).map(({ label, align }, i) => (
                    <th key={i} style={{ padding: '12px 14px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: align, whiteSpace: 'nowrap' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && Array.from({ length: PER_PAGE }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} style={{ padding: '14px' }}>
                        <div style={{ height: '13px', borderRadius: '6px', background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 0 ? '30%' : '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && paginated.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: '56px', textAlign: 'center' }}>
                      <Search size={32} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 10px' }} />
                      <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                        {hasFilter ? 'No bookings match your filters.' : 'No bookings found.'}
                      </div>
                      {hasFilter && (
                        <button onClick={resetFilters} style={{ marginTop: '10px', background: '#f1f5f9', border: 'none', color: '#475569', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}

                {!loading && paginated.map((b, idx) => {
                  const st = getStatus(b.status);
                  const amount = b.total_fare || b.plan_price;
                  return (
                    <tr key={b.id} className="bk-row" onClick={() => setSelectedBk(b)} style={{ borderBottom: '1px solid #f1f5f9' }}>

                      {/* # */}
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                        {(page - 1) * PER_PAGE + idx + 1}
                      </td>

                      {/* Booking ID */}
                      <td style={{ padding: '12px 14px' }}>
                        <code style={{ fontSize: '11px', color: '#6366f1', background: '#eef2ff', padding: '2px 7px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {b.booking_id}
                        </code>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                          {b.booking_type === '1' ? 'Outstation' : 'In City'}
                        </div>
                      </td>

                      {/* User */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={13} color="#6366f1" />
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{b.user_name || `User #${b.user_id}`}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Phone size={9} />{b.user_mobile}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Captain */}
                      <td style={{ padding: '12px 14px' }}>
                        {b.driver_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Car size={13} color="#10b981" />
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{b.driver_name}</div>
                              <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Phone size={9} />{b.driver_mobile || '—'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>Not assigned</span>
                        )}
                      </td>

                      {/* Route */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                          <Navigation size={10} color="#94a3b8" />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{b.pickup_city}</span>
                          <span style={{ color: '#c7d2fe' }}>→</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{b.drop_city}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                          {b.person} person{b.person > 1 ? 's' : ''}
                          {b.distance ? ` · ${b.distance} km` : ''}
                        </div>
                      </td>

                      {/* Service / Sub */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{b.service_name}</div>
                        {b.sub_service_name && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{b.sub_service_name}</div>}
                        {b.plan_name && <div style={{ fontSize: '10px', color: '#6366f1', marginTop: '1px', fontWeight: 600 }}>{b.plan_name}</div>}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#059669' }}>
                          {amount ? `₹${parseFloat(amount).toFixed(2)}` : '—'}
                        </div>
                        {b.platform_fee && parseFloat(b.platform_fee) > 0 && (
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>+₹{b.platform_fee} fee</div>
                        )}
                      </td>

                      {/* Payment */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: b.paid === 1 ? '#059669' : '#94a3b8' }}>
                          {b.paid === 1 ? '✓ Paid' : 'Unpaid'}
                        </div>
                        {b.payment_mode && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{b.payment_mode}</div>}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                          <Calendar size={10} />{fmtDate(b.created_at)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: st.bg, color: st.color, fontSize: '10px', fontWeight: 700, padding: '4px 9px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
                          {b.status}
                        </span>
                      </td>

                      {/* View */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedBk(b); }}
                          style={{ background: '#eef2ff', border: 'none', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', margin: '0 auto' }}
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Showing <b style={{ color: '#475569' }}>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</b> of <b style={{ color: '#475569' }}>{filtered.length}</b>
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1, display: 'flex' }}>
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
                      style={{ width: 32, height: 32, borderRadius: '8px', border: page === p ? 'none' : '1.5px solid #e2e8f0', background: page === p ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'white', color: page === p ? 'white' : '#475569', cursor: 'pointer', fontWeight: page === p ? 700 : 400, fontSize: '12px', boxShadow: page === p ? '0 2px 8px rgba(99,102,241,0.35)' : 'none' }}>
                      {p}
                    </button>
                  );
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1, display: 'flex' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedBk && <DetailModal booking={selectedBk} onClose={() => setSelectedBk(null)} />}
    </>
  );
}
