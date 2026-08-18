import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  X, Eye, Users, Car, MapPin, Calendar, Navigation, Activity,
} from 'lucide-react';
import { getSelfSharingTrips, getSelfSharingBookings } from '../../services/api';

// "Inter City" (service_id 73 in production) is built on the same carpool mechanism as
// "Self Sharing" (service_id 72) — both live in sigi_trips/sigi_bookings, told apart only
// by which service the trip was created under. This page mirrors SelfSharingHistory.tsx,
// just scoped to the Inter City service instead of Self Sharing.
const INTERCITY_SERVICE_ID = 73;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SharingTrip {
  id: number;
  trip_id?: string | null;
  status?: string | null;
  from_city?: string | null;
  to_city?: string | null;
  pickup_address?: string | null;
  drop_address?: string | null;
  pickup_city?: string | null;
  drop_city?: string | null;
  distance?: number | string | null;
  total_fare?: string | number | null;
  platform_fee?: string | number | null;
  driver_id?: number | null;
  driver_name?: string | null;
  driver_mobile?: string | null;
  passenger_count?: number | null;
  booked_seats?: number | null;
  seat_count?: number | null;
  total_seats?: number | null;
  available_seats?: number | null;
  schedule_date?: string | null;
  departure_time?: string | null;
  payment_mode?: string | null;
  full_fare?: string | number | null;
  creator_name?: string | null;
  creator_mobile?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

interface SharingBooking {
  id: number;
  booking_id?: string | null;
  trip_id?: number | string | null;
  status?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  user_mobile?: string | null;
  driver_id?: number | null;
  driver_name?: string | null;
  driver_mobile?: string | null;
  driver_phone?: string | null;
  from_city?: string | null;
  to_city?: string | null;
  pickup_address?: string | null;
  drop_address?: string | null;
  pickup_city?: string | null;
  drop_city?: string | null;
  total_fare?: string | number | null;
  plan_price?: string | null;
  payment_mode?: string | null;
  paid?: number | null;
  sub_service_name?: string | null;
  schedule_date?: string | null;
  departure_time?: string | null;
  created_at?: string;
  ride_started_at?: string | null;
  ride_completed_at?: string | null;
  [key: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  COMPLETED:    { bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  CANCELLED:    { bg: '#fff1f2', color: '#991b1b', dot: '#ef4444' },
  UPCOMING:     { bg: '#e0f2fe', color: '#075985', dot: '#0ea5e9' },
  BOARDING:     { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  SEARCHING:    { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  ACCEPTED:     { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  STARTED:      { bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  DROPPED:      { bg: '#f0fdf4', color: '#14532d', dot: '#4ade80' },
  PENDING:      { bg: '#fef9c3', color: '#854d0e', dot: '#eab308' },
  ACTIVE:       { bg: '#ede9fe', color: '#5b21b6', dot: '#8b5cf6' },
  TOKEN_PAID:   { bg: '#ecfdf5', color: '#065f46', dot: '#34d399' },
  CONFIRMED:    { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  BOARDED:      { bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  PAYMENT_DONE: { bg: '#ecfdf5', color: '#065f46', dot: '#34d399' },
};
const getStatus = (s?: string | null) =>
  STATUS_CONFIG[(s || '').toUpperCase()] || { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' };

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtFull = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtAmt = (v?: string | number | null) =>
  v != null && parseFloat(String(v)) > 0 ? `₹${parseFloat(String(v)).toFixed(2)}` : '—';

function extractList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  const b = body as Record<string, unknown> | null | undefined;
  if (Array.isArray(b?.data))     return b!.data as T[];
  if (Array.isArray(b?.bookings)) return b!.bookings as T[];
  if (Array.isArray(b?.trips))    return b!.trips as T[];
  const inner = b?.data as Record<string, unknown> | undefined;
  if (Array.isArray(inner?.bookings)) return inner!.bookings as T[];
  if (Array.isArray(inner?.trips))    return inner!.trips as T[];
  return [];
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string | null }) {
  const st = getStatus(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
      {(status || '—').toUpperCase()}
    </span>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ data, type, onClose }: { data: SharingTrip | SharingBooking; type: 'trip' | 'booking'; onClose: () => void }) {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', minWidth: 130, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500, textAlign: 'right', flex: 1 }}>{value || '—'}</span>
    </div>
  );

  const d = data as Record<string, unknown>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              {type === 'trip' ? 'Trip Details' : 'Booking Details'} #{d.id as number}
            </h3>
            <StatusBadge status={d.status as string} />
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>

        <div style={{ padding: '16px 22px 22px' }}>
          {type === 'trip' ? (
            <>
              <Row label="Trip ID"     value={d.trip_id as string || `#${d.id}`} />
              <Row label="Driver"      value={d.driver_name as string || d.creator_name as string} />
              <Row label="Mobile"      value={d.driver_mobile as string || d.creator_mobile as string} />
              <Row label="Pickup"      value={d.pickup_address as string || d.pickup_city as string || d.from_city as string} />
              <Row label="Drop"        value={d.drop_address as string || d.drop_city as string || d.to_city as string} />
              <Row label="Distance"    value={d.distance ? `${d.distance} km` : undefined} />
              <Row label="Seats"       value={d.seat_count as string || d.total_seats as string} />
              <Row label="Passengers"  value={d.passenger_count as string || d.booked_seats as string} />
              <Row label="Total Fare"  value={fmtAmt((d.total_fare || d.full_fare) as string)} />
              <Row label="Platform Fee"value={fmtAmt(d.platform_fee as string)} />
              <Row label="Payment"     value={d.payment_mode as string} />
              <Row label="Scheduled"   value={fmtDate((d.schedule_date || d.departure_time) as string)} />
              <Row label="Created"     value={fmtDate(d.created_at as string)} />
              <Row label="Trip Started" value={d.started_at ? fmtFull(d.started_at as string) : '—'} />
              <Row label="Trip Finished" value={d.completed_at ? fmtFull(d.completed_at as string) : '—'} />
            </>
          ) : (
            <>
              <Row label="Booking ID"  value={d.booking_id as string || `#${d.id}`} />
              <Row label="User"        value={d.user_name as string} />
              <Row label="Mobile"      value={d.user_mobile as string} />
              <Row label="Driver"      value={d.driver_name as string} />
              <Row label="Driver Mobile" value={d.driver_mobile as string || d.driver_phone as string} />
              <Row label="Sub Service" value={d.sub_service_name as string} />
              <Row label="Pickup"      value={d.pickup_address as string || d.pickup_city as string || d.from_city as string} />
              <Row label="Drop"        value={d.drop_address as string || d.drop_city as string || d.to_city as string} />
              <Row label="Total Fare"  value={fmtAmt((d.total_fare || d.plan_price) as string)} />
              <Row label="Payment"     value={d.payment_mode as string} />
              <Row label="Paid"        value={d.paid === 1 ? 'Yes' : d.paid === 0 ? 'No' : undefined} />
              <Row label="Scheduled"   value={fmtDate((d.schedule_date || d.departure_time) as string)} />
              <Row label="Created"     value={fmtDate(d.created_at as string)} />
              <Row label="Trip Started" value={d.ride_started_at ? fmtFull(d.ride_started_at as string) : '—'} />
              <Row label="Trip Finished" value={d.ride_completed_at ? fmtFull(d.ride_completed_at as string) : '—'} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Trips Tab ─────────────────────────────────────────────────────────────────
function TripsTab() {
  const [trips,   setTrips]   = useState<SharingTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);
  const [detail,  setDetail]  = useState<SharingTrip | null>(null);
  const PER_PAGE = 10;

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await getSelfSharingTrips({ service_id: INTERCITY_SERVICE_ID, limit: 1000 });
      const body = (res as { data: unknown }).data;
      const list = extractList<SharingTrip>(body);
      setTrips(list);
    } catch (err) { console.error('[InterCity] trips fetch error:', err); setTrips([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const filtered = useMemo(() => trips.filter(t => {
    const q = search.toLowerCase();
    const ms = !q || String(t.id).includes(q) || (t.trip_id || '').toLowerCase().includes(q) ||
      (t.driver_name || t.creator_name || '').toLowerCase().includes(q) || (t.pickup_city || t.from_city || '').toLowerCase().includes(q) ||
      (t.drop_city || t.to_city || '').toLowerCase().includes(q);
    const mst = !status || (t.status || '').toUpperCase() === status.toUpperCase();
    return ms && mst;
  }), [trips, search, status]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 220 }}>
          <Search size={14} color="#94a3b8" />
          <input placeholder="Search trip, driver, city..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', color: '#1e293b' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} color="#94a3b8" /></button>}
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', fontSize: 12, outline: 'none', background: 'white', color: '#1e293b' }}>
          <option value="">All Status</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="BOARDING">Boarding</option>
          <option value="STARTED">Started</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button onClick={fetchTrips} disabled={loading}
          style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '7px 12px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                {['#', 'Trip ID', 'Driver', 'Route', 'Seats', 'Fare', 'Schedule', 'Trip Start', 'Trip End', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {Array.from({ length: 11 }).map((__, j) => (
                    <td key={j} style={{ padding: 14 }}><div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: '65%' }} /></td>
                  ))}
                </tr>
              ))}
              {!loading && paginated.length === 0 && (
                <tr><td colSpan={11} style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No trips found.</td></tr>
              )}
              {!loading && paginated.map((t, idx) => (
                <tr key={t.id} onClick={() => setDetail(t)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{(page - 1) * PER_PAGE + idx + 1}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{t.trip_id || `#${t.id}`}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Car size={14} color="#16a34a" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.driver_name || t.creator_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.driver_mobile || t.creator_mobile || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569' }}>
                      <MapPin size={11} color="#6366f1" />
                      <span>{t.pickup_city || t.from_city || '—'}</span>
                      <Navigation size={10} color="#cbd5e1" />
                      <span>{t.drop_city || t.to_city || '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} color="#6366f1" />
                      <span style={{ fontSize: 12, color: '#475569' }}>{t.passenger_count ?? t.booked_seats ?? '—'} / {t.seat_count ?? t.total_seats ?? '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtAmt(t.total_fare || t.full_fare)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} />
                      {t.schedule_date || t.departure_time ? fmtDate(t.schedule_date || t.departure_time) : fmtDate(t.created_at)}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {t.started_at
                      ? <span style={{ fontSize: 11, color: '#166534', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDateTime(t.started_at)}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {t.completed_at
                      ? <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDateTime(t.completed_at)}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}><StatusBadge status={t.status} /></td>
                  <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDetail(t)} style={{ background: '#eef2ff', border: 'none', color: '#6366f1', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex' }}>
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            <b style={{ color: '#475569' }}>{filtered.length}</b> trips
          </span>
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

      {detail && <DetailModal data={detail} type="trip" onClose={() => setDetail(null)} />}
    </>
  );
}

// ─── Bookings Tab ──────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<SharingBooking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const [detail,   setDetail]   = useState<SharingBooking | null>(null);
  const PER_PAGE = 10;

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSelfSharingBookings({ service_id: INTERCITY_SERVICE_ID, limit: 1000 });
      const body = (res as { data: unknown }).data;
      const list = extractList<SharingBooking>(body);
      setBookings(list);
    } catch (err) { console.error('[InterCity] bookings fetch error:', err); setBookings([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filtered = useMemo(() => bookings.filter(b => {
    const q = search.toLowerCase();
    const ms = !q || String(b.id).includes(q) || (b.booking_id || '').toLowerCase().includes(q) ||
      (b.user_name || '').toLowerCase().includes(q) || (b.user_mobile || '').includes(q) ||
      (b.driver_name || '').toLowerCase().includes(q) || (b.pickup_city || b.from_city || '').toLowerCase().includes(q);
    const mst = !status || (b.status || '').toUpperCase() === status.toUpperCase();
    return ms && mst;
  }), [bookings, search, status]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 220 }}>
          <Search size={14} color="#94a3b8" />
          <input placeholder="Search booking, user, driver..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', color: '#1e293b' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} color="#94a3b8" /></button>}
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', fontSize: 12, outline: 'none', background: 'white', color: '#1e293b' }}>
          <option value="">All Status</option>
          <option value="TOKEN_PAID">Token Paid</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="BOARDED">Boarded</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button onClick={fetchBookings} disabled={loading}
          style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '7px 12px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                {['#', 'Booking ID', 'User', 'Driver', 'Route', 'Fare', 'Date', 'Ride Start', 'Ride End', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {Array.from({ length: 11 }).map((__, j) => (
                    <td key={j} style={{ padding: 14 }}><div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: '65%' }} /></td>
                  ))}
                </tr>
              ))}
              {!loading && paginated.length === 0 && (
                <tr><td colSpan={11} style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No bookings found.</td></tr>
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
                      <span>{b.pickup_city || b.from_city || '—'}</span>
                      <span style={{ color: '#cbd5e1' }}>→</span>
                      <span>{b.drop_city || b.to_city || '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtAmt(b.total_fare || b.plan_price)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>{fmtDate(b.created_at)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {b.ride_started_at
                      ? <span style={{ fontSize: 11, color: '#166534', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDateTime(b.ride_started_at)}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {b.ride_completed_at
                      ? <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDateTime(b.ride_completed_at)}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
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
          <span style={{ fontSize: 12, color: '#94a3b8' }}><b style={{ color: '#475569' }}>{filtered.length}</b> bookings</span>
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

      {detail && <DetailModal data={detail} type="booking" onClose={() => setDetail(null)} />}
    </>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function InterCityHistory() {
  const [tab, setTab] = useState<'trips' | 'bookings'>('trips');

  const tabs = [
    { key: 'trips'    as const, label: 'Trips',    icon: <Car size={14} /> },
    { key: 'bookings' as const, label: 'Bookings', icon: <Activity size={14} /> },
  ];

  const stats = [
    { label: 'Module',  value: 'Inter City', bg: '#eef2ff', color: '#6366f1', icon: <Navigation size={18} color="#6366f1" /> },
    { label: 'Type',    value: 'Shared Rides', bg: '#f0fdf4', color: '#059669', icon: <Car size={18} color="#059669" /> },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from { opacity:0;transform:translateY(12px) } to { opacity:1;transform:translateY(0) } }
        @keyframes slideUp      { from { opacity:0;transform:translateY(20px) } to { opacity:1;transform:translateY(0) } }
        @keyframes spin         { to { transform:rotate(360deg) } }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ padding: 24, animation: 'fadeSlideUp 0.4s ease' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Inter City History</h2>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Manage Inter City trips and passenger bookings</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: '12px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                background: active ? 'white' : 'transparent',
                color: active ? '#6366f1' : '#94a3b8',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'trips'    && <TripsTab />}
        {tab === 'bookings' && <BookingsTab />}
      </div>
    </>
  );
}
