import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, RefreshCw, Search, ChevronLeft, ChevronRight,
  MapPin, Calendar, Clock, CreditCard, CheckCircle, XCircle,
  AlertCircle, Loader, Car, User, IndianRupee,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
// import { getUserBookings } from "../../services/api";  // ← apna API import karein

interface Booking {
  id: number;
  booking_ref: string;
  pickup_location: string;
  drop_location: string;
  booking_date: string;
  travel_date: string;
  amount: number;
  payment_status: 'paid' | 'pending' | 'failed';
  booking_status: 'completed' | 'cancelled' | 'ongoing' | 'upcoming';
  driver_name: string | null;
  vehicle: string | null;
}

const PER_PAGE = 6;

/* ── Sample Data (API se replace karein) ── */
const SAMPLE_BOOKINGS: Booking[] = [
  { id: 1, booking_ref: 'BK-001234', pickup_location: 'Jabalpur Railway Station', drop_location: 'Bhopal Bus Stand', booking_date: '2025-04-10', travel_date: '2025-04-12', amount: 1850, payment_status: 'paid', booking_status: 'completed', driver_name: 'Ramesh Kumar', vehicle: 'Swift Dzire - MP20 AB 1234' },
  { id: 2, booking_ref: 'BK-001189', pickup_location: 'Marble Rocks, Jabalpur', drop_location: 'Indore Airport', booking_date: '2025-03-22', travel_date: '2025-03-25', amount: 3200, payment_status: 'paid', booking_status: 'completed', driver_name: 'Suresh Yadav', vehicle: 'Innova - MP20 CD 5678' },
  { id: 3, booking_ref: 'BK-001301', pickup_location: 'Civil Lines, Jabalpur', drop_location: 'Pench National Park', booking_date: '2025-04-28', travel_date: '2025-05-02', amount: 2500, payment_status: 'pending', booking_status: 'upcoming', driver_name: null, vehicle: null },
  { id: 4, booking_ref: 'BK-001098', pickup_location: 'Jabalpur Airport', drop_location: 'Kanha Tiger Reserve', booking_date: '2025-02-14', travel_date: '2025-02-16', amount: 2800, payment_status: 'failed', booking_status: 'cancelled', driver_name: null, vehicle: null },
  { id: 5, booking_ref: 'BK-001402', pickup_location: 'Madan Mahal Fort', drop_location: 'Sagar, MP', booking_date: '2025-05-01', travel_date: '2025-05-03', amount: 1600, payment_status: 'paid', booking_status: 'ongoing', driver_name: 'Mohit Singh', vehicle: 'Ertiga - MP20 EF 9012' },
  { id: 6, booking_ref: 'BK-000987', pickup_location: 'Bargi Dam', drop_location: 'Mandla', booking_date: '2025-01-05', travel_date: '2025-01-07', amount: 1100, payment_status: 'paid', booking_status: 'completed', driver_name: 'Ajay Patel', vehicle: 'WagonR - MP20 GH 3456' },
  { id: 7, booking_ref: 'BK-001050', pickup_location: 'Rani Durgavati Museum', drop_location: 'Rewa', booking_date: '2025-01-20', travel_date: '2025-01-22', amount: 1750, payment_status: 'paid', booking_status: 'completed', driver_name: 'Vijay Sharma', vehicle: 'Dzire - MP20 IJ 7890' },
];

/* ── Status Config ── */
const bookingStatusConfig: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  completed: { label: 'Completed', bg: '#d1fae5', color: '#065f46', icon: <CheckCircle size={11} /> },
  cancelled: { label: 'Cancelled', bg: '#fee2e2', color: '#991b1b', icon: <XCircle size={11} /> },
  ongoing:   { label: 'Ongoing',   bg: '#dbeafe', color: '#1e40af', icon: <Loader size={11} /> },
  upcoming:  { label: 'Upcoming',  bg: '#fef9c3', color: '#854d0e', icon: <AlertCircle size={11} /> },
};

const paymentStatusConfig: Record<string, { label: string; bg: string; color: string }> = {
  paid:    { label: 'Paid',    bg: '#d1fae5', color: '#065f46' },
  pending: { label: 'Pending', bg: '#fef9c3', color: '#854d0e' },
  failed:  { label: 'Failed',  bg: '#fee2e2', color: '#991b1b' },
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const formatAmount = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/* ── Booking Detail Modal ── */
function BookingDetailModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const bs = bookingStatusConfig[booking.booking_status];
  const ps = paymentStatusConfig[booking.payment_status];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)', padding: '16px',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '460px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden',
        animation: 'modalIn 0.2s ease',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Booking Reference</div>
            <div style={{ color: 'white', fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{booking.booking_ref}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>×</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status Row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: bs.bg, color: bs.color }}>{bs.icon}{bs.label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: ps.bg, color: ps.color }}><CreditCard size={11} />{ps.label}</span>
          </div>

          {/* Route */}
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '2px' }}><MapPin size={14} color="#10b981" /></div>
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Pickup</div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{booking.pickup_location}</div>
                </div>
              </div>
              <div style={{ marginLeft: '7px', height: '16px', borderLeft: '2px dashed #cbd5e1' }} />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '2px' }}><MapPin size={14} color="#ef4444" /></div>
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Drop</div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{booking.drop_location}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { icon: <Calendar size={13} color="#6366f1" />, label: 'Booked On', val: formatDate(booking.booking_date) },
              { icon: <Clock size={13} color="#6366f1" />, label: 'Travel Date', val: formatDate(booking.travel_date) },
              { icon: <IndianRupee size={13} color="#6366f1" />, label: 'Amount', val: formatAmount(booking.amount) },
              { icon: <Car size={13} color="#6366f1" />, label: 'Vehicle', val: booking.vehicle ?? '—' },
            ].map(item => (
              <div key={item.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>{item.icon}<span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</span></div>
                <div style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* Driver */}
          {booking.driver_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#eef2ff', borderRadius: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} color="white" /></div>
              <div>
                <div style={{ fontSize: '10px', color: '#6366f1', fontWeight: 600, textTransform: 'uppercase' }}>Captain</div>
                <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{booking.driver_name}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function UserBookingHistory() {
  const { userId } = useParams<{ userId: string }>();
  const navigate   = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage]         = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    setLoading(true); setError(null);
    try {
      // const res = await getUserBookings(userId);
      // setBookings(res.data.data);
      await new Promise(r => setTimeout(r, 600)); // simulate delay
      setBookings(SAMPLE_BOOKINGS);
    } catch { setError('Unable to load bookings'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBookings(); }, [userId]);

  const filtered = useMemo(() =>
    bookings.filter(b => {
      const matchSearch =
        b.booking_ref.toLowerCase().includes(search.toLowerCase()) ||
        b.pickup_location.toLowerCase().includes(search.toLowerCase()) ||
        b.drop_location.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || b.booking_status === statusFilter;
      return matchSearch && matchStatus;
    }), [bookings, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = useMemo(() => ({
    total:     bookings.length,
    completed: bookings.filter(b => b.booking_status === 'completed').length,
    cancelled: bookings.filter(b => b.booking_status === 'cancelled').length,
    totalSpent: bookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + b.amount, 0),
  }), [bookings]);

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── Back + Title ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Booking History</h2>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0' }}>User ID #{userId}</p>
        </div>
        <button onClick={fetchBookings} style={{ marginLeft: 'auto', background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '7px 10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Stats Cards ── */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Bookings', value: stats.total,     color: '#6366f1', bg: '#eef2ff' },
            { label: 'Completed',      value: stats.completed,  color: '#10b981', bg: '#d1fae5' },
            { label: 'Cancelled',      value: stats.cancelled,  color: '#ef4444', bg: '#fee2e2' },
            { label: 'Total Spent',    value: formatAmount(stats.totalSpent), color: '#f59e0b', bg: '#fef9c3' },
          ].map(card => (
            <div key={card.label} style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1.5px solid #eef2f7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: card.color, marginTop: '6px' }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px', flex: 1, minWidth: '200px' }}>
          <Search size={14} color="#94a3b8" />
          <input placeholder="Search booking ref, location..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', background: 'transparent' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['all', 'completed', 'ongoing', 'upcoming', 'cancelled'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
              padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              ...(statusFilter === s
                ? { background: '#6366f1', borderColor: '#6366f1', color: 'white' }
                : { background: 'white', borderColor: '#e2e8f0', color: '#64748b' }),
            }}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>
      </div>

      {/* ── Table Card ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>

        {loading && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 10px' }} />
            Loading bookings...
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            <button onClick={fetchBookings} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Try Again</button>
          </div>
        )}

        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {['Booking Ref', 'Route', 'Travel Date', 'Amount', 'Status', 'Payment', 'Action'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length > 0 ? paginated.map(b => {
                  const bs = bookingStatusConfig[b.booking_status];
                  const ps = paymentStatusConfig[b.payment_status];
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{b.booking_ref}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>ID #{b.id}</div>
                      </td>

                      <td style={{ padding: '12px 16px', maxWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <MapPin size={11} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.pickup_location}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginTop: '3px' }}>
                          <MapPin size={11} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.drop_location}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={12} />{formatDate(b.travel_date)}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Booked: {formatDate(b.booking_date)}</div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatAmount(b.amount)}</div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: bs.bg, color: bs.color, whiteSpace: 'nowrap' }}>{bs.icon}{bs.label}</span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: ps.bg, color: ps.color }}>{ps.label}</span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => setSelectedBooking(b)} style={{ background: '#ede9fe', border: '1px solid #ddd6fe', color: '#7c3aed', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No bookings found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Showing <b>{Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)}</b> of <b>{filtered.length}</b>
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center' }}><ChevronLeft size={14} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center' }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Booking Detail Modal ── */}
      {selectedBooking && <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}