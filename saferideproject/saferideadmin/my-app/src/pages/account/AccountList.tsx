import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Filter, X,
  IndianRupee, Wallet, XCircle, CheckCircle2, Banknote, CreditCard,
} from 'lucide-react';
import { getAllBookinghistory, getSelfSharingBookings, getParcelBookings, getOnSpotBookings } from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
// Normalized shape every tab's raw API rows get mapped into, so one table/summary
// implementation can serve Rides, Self Sharing, Parcel and On Spot alike.
interface MoneyBooking {
  id: number;
  booking_id: string;
  created_at: string;
  category: string;
  payment_mode: 'CASH' | 'ONLINE' | string | null;
  paid: number;
  status: string;
  cancelled_by?: string | null;
  cancellation_fee?: number | null;
  total_amount: number;
  company_amount: number;
  captain_amount: number;
  user_name: string | null;
  user_mobile: string | null;
  user_wallet: string | number | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  driver_wallet: string | number | null;
  trip_type?: 'IN_CITY' | 'INTERCITY' | 'OTHER';
}

type RawRow = Record<string, unknown>;

const LOW_BALANCE_THRESHOLD = -20;
const isLowBalance = (wallet: string | number | null) => Number(wallet ?? 0) <= LOW_BALANCE_THRESHOLD;

const STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  COMPLETED:           { bg: '#d1fae5', color: '#065f46' },
  DELIVERED:           { bg: '#d1fae5', color: '#065f46' },
  CANCELLED:           { bg: '#fff1f2', color: '#991b1b' },
  WAITING_FOR_PAYMENT: { bg: '#fef3c7', color: '#92400e' },
  PAYMENT_DONE:        { bg: '#ecfdf5', color: '#065f46' },
  BALANCE_PAID:        { bg: '#fdf4ff', color: '#6b21a8' },
};
const getStatusStyle = (s?: string) => STATUS_CONFIG[(s || '').toUpperCase()] || { bg: '#f1f5f9', color: '#475569' };

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtAmt  = (v?: number | string | null) => `₹${Number(v ?? 0).toFixed(2)}`;
const norm    = (s?: string | null) => (s || '').toLowerCase();

// Same signal InterCityHistory.tsx uses to split intercity bookings out of the shared bookings table.
const INTERCITY_KEYWORDS = ['intercity', 'rental', 'oneway', 'outstation'];
const classifyRide = (raw: RawRow): 'IN_CITY' | 'INTERCITY' | 'OTHER' => {
  if (Number(raw.service_id) === 1) return 'IN_CITY';
  const serviceName = norm(raw.service_name as string | null);
  if (raw.booking_type === '1' || INTERCITY_KEYWORDS.some(k => serviceName.includes(k))) return 'INTERCITY';
  return 'OTHER';
};

// ── Per-tab mappers: each backend already returns total_amount/company_amount/captain_amount
// (added alongside this module), so mapping is mostly a field-name pass-through. ──
const mapRide = (raw: RawRow): MoneyBooking => ({
  id: Number(raw.id),
  booking_id: String(raw.booking_id ?? ''),
  created_at: String(raw.created_at ?? ''),
  category: String(raw.sub_service_name || raw.service_name || '—'),
  payment_mode: (raw.payment_mode as string | null) ?? null,
  paid: Number(raw.paid ?? 0),
  status: String(raw.status ?? ''),
  cancelled_by: raw.cancelled_by as string | null,
  cancellation_fee: raw.cancellation_fee != null ? Number(raw.cancellation_fee) : null,
  total_amount: Number(raw.total_amount ?? 0),
  company_amount: Number(raw.company_amount ?? 0),
  captain_amount: Number(raw.captain_amount ?? 0),
  user_name: raw.user_name as string | null,
  user_mobile: raw.user_mobile as string | null,
  user_wallet: raw.user_wallet as string | number | null,
  driver_id: raw.driver_id != null ? Number(raw.driver_id) : null,
  driver_name: raw.driver_name as string | null,
  driver_mobile: raw.driver_mobile as string | null,
  driver_wallet: raw.driver_wallet as string | number | null,
  trip_type: classifyRide(raw),
});

const mapGeneric = (raw: RawRow, category: string): MoneyBooking => ({
  id: Number(raw.id),
  booking_id: String(raw.booking_id ?? ''),
  created_at: String(raw.created_at ?? ''),
  category,
  payment_mode: (raw.payment_mode as string | null) ?? null,
  paid: Number(raw.paid ?? raw.token_paid ?? 0),
  status: String(raw.status ?? ''),
  cancelled_by: (raw.cancelled_by as string | null) ?? null,
  cancellation_fee: null, // not tracked in this module's schema — see backend comments
  total_amount: Number(raw.total_amount ?? 0),
  company_amount: Number(raw.company_amount ?? 0),
  captain_amount: Number(raw.captain_amount ?? 0),
  user_name: raw.user_name as string | null,
  user_mobile: raw.user_mobile as string | null,
  user_wallet: raw.user_wallet as string | number | null,
  driver_id: raw.driver_id != null ? Number(raw.driver_id) : null,
  driver_name: raw.driver_name as string | null,
  driver_mobile: raw.driver_mobile as string | null,
  driver_wallet: raw.driver_wallet as string | number | null,
});

type TabKey = 'rides' | 'self_sharing' | 'parcel' | 'onspot';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'rides',        label: 'Rides' },
  { key: 'self_sharing', label: 'Self Sharing' },
  { key: 'parcel',       label: 'Parcel' },
  { key: 'onspot',       label: 'On Spot' },
];

const extractList = (res: unknown): RawRow[] => {
  const body = (res as { data: unknown }).data;
  if (Array.isArray(body)) return body as RawRow[];
  const inner = (body as { data?: RawRow[] })?.data;
  return Array.isArray(inner) ? inner : [];
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, bg, color }: { label: string; value: string; icon: React.ReactNode; bg: string; color: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '14px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{value}</div>
        <div style={{ fontSize: '11px', color, fontWeight: 600, marginTop: '1px' }}>{label}</div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AccountList() {
  const [activeTab, setActiveTab]   = useState<TabKey>('rides');
  const [bookings, setBookings]     = useState<MoneyBooking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [tripTypeFilter, setTripTypeFilter] = useState(''); // rides tab only
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [page, setPage]             = useState(1);
  const PER_PAGE = 10;

  const fetchBookings = useCallback(async (tab: TabKey) => {
    setLoading(true);
    try {
      let list: MoneyBooking[] = [];
      if (tab === 'rides') {
        list = extractList(await getAllBookinghistory({ limit: 1000 })).map(mapRide);
      } else if (tab === 'self_sharing') {
        list = extractList(await getSelfSharingBookings({ limit: 1000 })).map(r => mapGeneric(r, 'Self Sharing'));
      } else if (tab === 'parcel') {
        list = extractList(await getParcelBookings({ limit: 1000 })).map(r => mapGeneric(r, 'Parcel'));
      } else {
        list = extractList(await getOnSpotBookings({ limit: 1000 })).map(r => mapGeneric(r, 'On Spot'));
      }
      setBookings(list);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSearch(''); setPaymentFilter(''); setStatusFilter(''); setTripTypeFilter(''); setFromDate(''); setToDate(''); setPage(1);
    fetchBookings(activeTab);
  }, [activeTab, fetchBookings]);

  const statuses = useMemo(() => [...new Set(bookings.map(b => b.status))].sort(), [bookings]);

  const filtered = useMemo(() => bookings.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.booking_id.toLowerCase().includes(q) ||
      (b.user_name    || '').toLowerCase().includes(q) ||
      (b.user_mobile  || '').includes(q) ||
      (b.driver_name  || '').toLowerCase().includes(q) ||
      (b.driver_mobile|| '').includes(q);
    const matchPayment = !paymentFilter || b.payment_mode === paymentFilter;
    const matchStatus  = !statusFilter || b.status === statusFilter;
    const matchTripType = !tripTypeFilter || b.trip_type === tripTypeFilter;
    const created = b.created_at ? new Date(b.created_at) : null;
    const matchFrom = !fromDate || (created && created >= new Date(fromDate));
    const matchTo   = !toDate   || (created && created <= new Date(`${toDate}T23:59:59`));
    return matchSearch && matchPayment && matchStatus && matchTripType && matchFrom && matchTo;
  }), [bookings, search, paymentFilter, statusFilter, tripTypeFilter, fromDate, toDate]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Summary (computed over the filtered set, not just the current page) ──
  const summary = useMemo(() => {
    let online = 0, cash = 0, company = 0, captain = 0, cancellationFee = 0, cancelledCount = 0;
    for (const b of filtered) {
      if (b.paid) {
        if (b.payment_mode === 'ONLINE') online += b.total_amount || 0;
        else if (b.payment_mode === 'CASH') cash += b.total_amount || 0;
      }
      if (b.status === 'CANCELLED') {
        cancelledCount += 1;
        cancellationFee += Number(b.cancellation_fee || 0);
      } else {
        company += b.company_amount || 0;
        captain += b.captain_amount || 0;
      }
    }
    return { online, cash, company, captain, cancellationFee, cancelledCount, net: online + cash };
  }, [filtered]);

  const resetFilters = () => { setSearch(''); setPaymentFilter(''); setStatusFilter(''); setTripTypeFilter(''); setFromDate(''); setToDate(''); setPage(1); };
  const hasFilter = search || paymentFilter || statusFilter || tripTypeFilter || fromDate || toDate;
  const cancellationTracked = activeTab === 'rides'; // only bookings.cancellation_fee is persisted today

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        .ac-row:hover td { background:#fafbff !important; }
        .ac-row td { transition: background 0.12s; }
        .ac-tab { border: none; background: transparent; cursor: pointer; padding: 8px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 700; color: #64748b; }
        .ac-tab.active { background: #eef2ff; color: #4338ca; }
      `}</style>

      <div className="responsive-page" style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Accounts</h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px', margin: 0 }}>
              Payment, commission &amp; cancellation breakdown · Showing <b>{filtered.length}</b> of <b>{bookings.length}</b>
            </p>
          </div>
          <button onClick={() => fetchBookings(activeTab)} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── Module Tabs ── */}
        <div style={{ display: 'flex', gap: '6px', background: 'white', border: '1.5px solid #eef2f7', borderRadius: '12px', padding: '5px', marginBottom: '18px', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.key} className={`ac-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <StatCard label="Online Collected"     value={fmtAmt(summary.online)}          bg="#dbeafe" color="#2563eb" icon={<CreditCard size={18} color="#2563eb" />} />
          <StatCard label="Cash Collected"       value={fmtAmt(summary.cash)}            bg="#fef9c3" color="#a16207" icon={<Banknote size={18} color="#a16207" />} />
          <StatCard label="Net Collected"        value={fmtAmt(summary.net)}             bg="#eef2ff" color="#6366f1" icon={<IndianRupee size={18} color="#6366f1" />} />
          <StatCard label="Company Share"        value={fmtAmt(summary.company)}         bg="#d1fae5" color="#059669" icon={<CheckCircle2 size={18} color="#059669" />} />
          <StatCard label="Captain Share"        value={fmtAmt(summary.captain)}         bg="#e0f2fe" color="#0369a1" icon={<Wallet size={18} color="#0369a1" />} />
          {cancellationTracked && (
            <StatCard label={`Cancellation Charges (${summary.cancelledCount})`} value={fmtAmt(summary.cancellationFee)} bg="#fee2e2" color="#dc2626" icon={<XCircle size={18} color="#dc2626" />} />
          )}
        </div>
        {!cancellationTracked && (
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-12px', marginBottom: '16px' }}>
            Note: this module doesn't persist a cancellation fee in the backend yet, so cancellation charges aren't shown here.
          </p>
        )}

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px', flex: 1, minWidth: '220px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              placeholder="Search by booking ID, user, captain..."
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
            <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#1e293b', background: 'transparent', cursor: 'pointer' }}>
              <option value="">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px' }}>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#1e293b', background: 'transparent', cursor: 'pointer', minWidth: '120px' }}>
              <option value="">All Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {activeTab === 'rides' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px' }}>
              <select value={tripTypeFilter} onChange={e => { setTripTypeFilter(e.target.value); setPage(1); }}
                style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#1e293b', background: 'transparent', cursor: 'pointer', minWidth: '120px' }}>
                <option value="">All Trip Types</option>
                <option value="IN_CITY">In-City</option>
                <option value="INTERCITY">Inter City</option>
                <option value="OTHER">Other Plans</option>
              </select>
            </div>
          )}

          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
            style={{ border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '12px', color: '#1e293b', background: 'white', borderRadius: '10px', padding: '7px 10px' }} />
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
            style={{ border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '12px', color: '#1e293b', background: 'white', borderRadius: '10px', padding: '7px 10px' }} />

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
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {([
                    { label: 'Booking',    align: 'left'   },
                    { label: 'Date',       align: 'center' },
                    { label: 'User',       align: 'left'   },
                    { label: 'Captain',    align: 'left'   },
                    { label: 'Payment',    align: 'center' },
                    { label: 'Total',      align: 'right'  },
                    { label: 'Company ₹',  align: 'right'  },
                    { label: 'Captain ₹',  align: 'right'  },
                    { label: 'Cancellation', align: 'right' },
                    { label: 'Status',     align: 'center' },
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
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} style={{ padding: '14px' }}>
                        <div style={{ height: '12px', borderRadius: '4px', background: '#f1f5f9' }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && paginated.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No bookings found matching your filters.</td></tr>
                )}

                {!loading && paginated.map(b => {
                  const st = getStatusStyle(b.status);
                  const cancelledTo = b.cancelled_by === 'DRIVER' ? 'Captain paid' : b.cancelled_by === 'USER' ? 'User paid' : null;
                  return (
                    <tr key={b.id} className="ac-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{b.booking_id}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{b.category}</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(b.created_at)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{b.user_name || '—'}</div>
                        <div style={{ fontSize: '10px', color: isLowBalance(b.user_wallet) ? '#ef4444' : '#94a3b8', fontWeight: isLowBalance(b.user_wallet) ? 700 : 400 }}>
                          {b.user_mobile || '—'} · Bal {fmtAmt(b.user_wallet)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {b.driver_id ? <>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{b.driver_name || '—'}</div>
                          <div style={{ fontSize: '10px', color: isLowBalance(b.driver_wallet) ? '#ef4444' : '#94a3b8', fontWeight: isLowBalance(b.driver_wallet) ? 700 : 400 }}>
                            {b.driver_mobile || '—'} · Bal {fmtAmt(b.driver_wallet)}
                          </div>
                        </> : <span style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                          background: b.payment_mode === 'ONLINE' ? '#dbeafe' : '#fef9c3',
                          color: b.payment_mode === 'ONLINE' ? '#1e40af' : '#92400e',
                        }}>{b.payment_mode || '—'}</span>
                        {!b.paid && <div style={{ fontSize: '9px', color: '#cbd5e1', marginTop: '2px' }}>Unpaid</div>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{fmtAmt(b.total_amount)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                        {b.status === 'CANCELLED' ? '—' : fmtAmt(b.company_amount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#0369a1' }}>
                        {b.status === 'CANCELLED' ? '—' : fmtAmt(b.captain_amount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {cancellationTracked && b.status === 'CANCELLED' && Number(b.cancellation_fee || 0) > 0 ? (
                          <>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>{fmtAmt(b.cancellation_fee)}</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8' }}>{cancelledTo || b.cancelled_by}</div>
                          </>
                        ) : b.status === 'CANCELLED' && !cancellationTracked ? (
                          <span style={{ fontSize: '10px', color: '#cbd5e1', fontStyle: 'italic' }}>Not tracked</span>
                        ) : <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: st.bg, color: st.color }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Page <b>{page}</b> of <b>{totalPages || 1}</b></span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center' }}><ChevronLeft size={14} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center' }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
