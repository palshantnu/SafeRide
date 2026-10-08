import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Filter, X,
  IndianRupee, Wallet, XCircle, CheckCircle2, Banknote,
} from 'lucide-react';
import { getAllBookinghistory, getSelfSharingBookings, getParcelBookings, getOnSpotBookings, getAllServices } from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
// Normalized shape every source's raw API rows get mapped into, so one table/summary
// implementation can serve every service — real ride services plus Self Sharing/Parcel/On Spot.
type Module = 'RIDE' | 'SELF_SHARING' | 'PARCEL' | 'ONSPOT';

interface MoneyBooking {
  id: number;
  module: Module;
  tabKey: string; // 'SVC_<service_id>' for rides, else the module name
  booking_id: string;
  created_at: string;
  service_name: string;
  sub_service_name?: string | null;
  payment_mode: 'CASH' | 'ONLINE' | string | null;
  paid: number;
  status: string;
  cancelled_by?: string | null;
  cancellation_fee?: number | null;
  token_amount?: number | null;
  balance_amount?: number | null;
  topup_amount?: number | null;
  topup_company_amount?: number | null;
  topup_captain_amount?: number | null;
  total_amount: number;
  company_amount: number;
  captain_amount: number;
  // Money actually received so far, by how it was paid (token is always online; the
  // balance and any topups carry their own mode), and what is still to come.
  collected_online: number;
  collected_cash: number;
  collected_total: number;
  due_amount: number;
  is_incity: boolean;
  user_name: string | null;
  user_mobile: string | null;
  user_wallet: string | number | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  driver_wallet: string | number | null;
}

type RawRow = Record<string, unknown>;

// How many bookings to load per source. Totals are worked out over what is loaded, so the
// page warns if a source has more than this.
const LOAD_LIMIT = 5000;
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

// Collected / due figures come from the API. An older backend that doesn't send them yet
// falls back to the previous behaviour: a fully paid booking counts whole, in its payment mode.
const collectedOf = (raw: RawRow, total: number, paid: number, mode: string | null) => {
  if (raw.collected_total != null) {
    return {
      collected_online: Number(raw.collected_online ?? 0),
      collected_cash: Number(raw.collected_cash ?? 0),
      collected_total: Number(raw.collected_total ?? 0),
      due_amount: Number(raw.due_amount ?? 0),
    };
  }
  const got = paid ? total : 0;
  return {
    collected_online: mode === 'ONLINE' ? got : 0,
    collected_cash: mode === 'ONLINE' ? 0 : got,
    collected_total: got,
    due_amount: Math.max(0, total - got),
  };
};

// ── Per-source mappers: each backend already returns total_amount/company_amount/captain_amount
// (added alongside this module), so mapping is mostly a field-name pass-through. ──
const mapRide = (raw: RawRow): MoneyBooking => ({
  id: Number(raw.id),
  module: 'RIDE',
  tabKey: `SVC_${raw.service_id}`,
  booking_id: String(raw.booking_id ?? ''),
  created_at: String(raw.created_at ?? ''),
  service_name: String(raw.service_name || '—'),
  sub_service_name: (raw.sub_service_name as string | null) ?? null,
  payment_mode: (raw.payment_mode as string | null) ?? null,
  paid: Number(raw.paid ?? 0),
  status: String(raw.status ?? ''),
  cancelled_by: raw.cancelled_by as string | null,
  cancellation_fee: raw.cancellation_fee != null ? Number(raw.cancellation_fee) : null,
  token_amount: raw.token_amount != null ? Number(raw.token_amount) : null,
  balance_amount: raw.balance_amount != null ? Number(raw.balance_amount) : null,
  topup_amount: Number(raw.topup_paid_amount ?? 0),
  topup_company_amount: Number(raw.topup_company_commission ?? 0),
  topup_captain_amount: Number(raw.topup_captain_commission ?? 0),
  total_amount: Number(raw.total_amount ?? 0),
  company_amount: Number(raw.company_amount ?? 0),
  captain_amount: Number(raw.captain_amount ?? 0),
  ...collectedOf(raw, Number(raw.total_amount ?? 0), Number(raw.paid ?? 0), (raw.payment_mode as string | null) ?? null),
  is_incity: Number(raw.service_id) === 1,
  user_name: raw.user_name as string | null,
  user_mobile: raw.user_mobile as string | null,
  user_wallet: raw.user_wallet as string | number | null,
  driver_id: raw.driver_id != null ? Number(raw.driver_id) : null,
  driver_name: raw.driver_name as string | null,
  driver_mobile: raw.driver_mobile as string | null,
  driver_wallet: raw.driver_wallet as string | number | null,
});

const mapGeneric = (raw: RawRow, module: Module, fallbackLabel: string): MoneyBooking => ({
  id: Number(raw.id),
  module,
  tabKey: module,
  booking_id: String(raw.booking_id ?? ''),
  created_at: String(raw.created_at ?? ''),
  service_name: String(raw.service_name || fallbackLabel),
  sub_service_name: (raw.sub_service_name as string | null) ?? null,
  payment_mode: (raw.payment_mode as string | null) ?? null,
  paid: Number(raw.paid ?? raw.token_paid ?? 0),
  // Parcel stores status ('cancelled', 'delivered', ...) and cancelled_by ('user'/'driver')
  // lowercase — its own convention, unlike Ride/Self-Sharing/On-Spot which use uppercase.
  // Normalize both here so every `b.status === 'CANCELLED'` / cancelledTo check below works
  // the same across every module.
  status: String(raw.status ?? '').toUpperCase(),
  cancelled_by: raw.cancelled_by != null ? String(raw.cancelled_by).toUpperCase() : null,
  cancellation_fee: raw.cancellation_fee != null ? Number(raw.cancellation_fee) : null,
  token_amount: raw.token_amount != null ? Number(raw.token_amount) : null,
  balance_amount: raw.balance_amount != null ? Number(raw.balance_amount) : null,
  total_amount: Number(raw.total_amount ?? 0),
  company_amount: Number(raw.company_amount ?? 0),
  captain_amount: Number(raw.captain_amount ?? 0),
  ...collectedOf(raw, Number(raw.total_amount ?? 0), Number(raw.paid ?? 0), (raw.payment_mode as string | null) ?? null),
  is_incity: Number(raw.service_id) === 1,
  user_name: raw.user_name as string | null,
  user_mobile: raw.user_mobile as string | null,
  user_wallet: raw.user_wallet as string | number | null,
  driver_id: raw.driver_id != null ? Number(raw.driver_id) : null,
  driver_name: raw.driver_name as string | null,
  driver_mobile: raw.driver_mobile as string | null,
  driver_wallet: raw.driver_wallet as string | number | null,
});

const extractList = (res: unknown): RawRow[] => {
  const body = (res as { data: unknown }).data;
  if (Array.isArray(body)) return body as RawRow[];
  const inner = (body as { data?: RawRow[] })?.data;
  return Array.isArray(inner) ? inner : [];
};

// A user's cancellation charge is only recorded for admin to collect — it is not cut from
// their wallet — except on In-City rides, where it is. Captain / BA charges are always cut.
const feeToRecover = (b: MoneyBooking) => b.cancelled_by === 'USER' && !b.is_incity;
const cancellationNote = (b: MoneyBooking) => {
  switch (b.cancelled_by) {
    case 'USER':               return b.is_incity ? 'Cut from user wallet' : 'To collect from user';
    case 'DRIVER':             return 'Cut from captain / BA wallet';
    case 'BUSINESS_ASSOCIATE': return 'Cut from BA wallet';
    case 'DRIVER_NO_SHOW':     return 'Passenger no-show';
    default:                   return b.cancelled_by || '';
  }
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, bg, color, sub }: { label: string; value: string; icon: React.ReactNode; bg: string; color: string; sub?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '14px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{value}</div>
        <div style={{ fontSize: '11px', color, fontWeight: 600, marginTop: '1px' }}>{label}</div>
        {sub && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AccountList() {
  const [allBookings, setAllBookings] = useState<MoneyBooking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('ALL');
  const [search, setSearch]         = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [page, setPage]             = useState(1);
  const [services, setServices]     = useState<{ key: string; label: string; order: number }[]>([]);
  // sources whose bookings didn't all fit in one load — totals would be short for those
  const [truncated, setTruncated]   = useState<string[]>([]);
  const PER_PAGE = 10;

  // Modules that live in their own tables outside `bookings` — a matching row in the
  // `services` table (if any) doesn't get its own ride tab, the fixed tab below covers it.
  const NON_RIDE_SERVICE_NAMES = ['self shar', 'parcel', 'on spot', 'onspot', 'on-spot'];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rides, selfSharing, parcel, onspot, serviceRows] = await Promise.all([
        getAllBookinghistory({ limit: LOAD_LIMIT }).catch(() => null),
        getSelfSharingBookings({ limit: LOAD_LIMIT }).catch(() => null),
        getParcelBookings({ limit: LOAD_LIMIT }).catch(() => null),
        getOnSpotBookings({ limit: LOAD_LIMIT }).catch(() => null),
        getAllServices().catch(() => null),
      ]);
      // each API reports how many rows exist in total; flag any source we couldn't load fully
      const short = ([['Rides', rides], ['Self Sharing', selfSharing], ['Parcel', parcel], ['On Spot', onspot]] as [string, unknown][])
        .filter(([, res]) => {
          const total = Number((res as { data?: { pagination?: { total?: number } } } | null)?.data?.pagination?.total ?? 0);
          return total > extractList(res).length;
        })
        .map(([name]) => name);
      setTruncated(short);

      setAllBookings([
        ...extractList(rides).map(mapRide),
        ...extractList(selfSharing).map(r => mapGeneric(r, 'SELF_SHARING', 'Self Sharing')),
        ...extractList(parcel).map(r => mapGeneric(r, 'PARCEL', 'Parcel')),
        ...extractList(onspot).map(r => mapGeneric(r, 'ONSPOT', 'On Spot')),
      ]);

      const rawServices = extractList(serviceRows) as { id: number; title: string; status?: number; position?: number }[];
      setServices(
        rawServices
          .filter(s => s.status !== 0 && !NON_RIDE_SERVICE_NAMES.some(k => (s.title || '').toLowerCase().includes(k)))
          .map(s => ({ key: `SVC_${s.id}`, label: s.title, order: s.position ?? s.id }))
          .sort((a, b) => a.order - b.order)
      );
    } catch {
      setAllBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Tabs: All, then every active service from the `services` table (so a service with zero
  // bookings so far still shows up), then the three fixed modules that live outside `bookings`.
  const tabs = useMemo(() => [
    { key: 'ALL', label: 'All' },
    ...services,
    { key: 'SELF_SHARING', label: 'Self Sharing' },
    { key: 'PARCEL', label: 'Parcel' },
    { key: 'ONSPOT', label: 'On Spot' },
  ], [services]);

  const tabScoped = useMemo(
    () => activeTab === 'ALL' ? allBookings : allBookings.filter(b => b.tabKey === activeTab),
    [allBookings, activeTab]
  );

  const statuses = useMemo(() => [...new Set(tabScoped.map(b => b.status))].sort(), [tabScoped]);

  const filtered = useMemo(() => tabScoped.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.booking_id.toLowerCase().includes(q) ||
      (b.user_name    || '').toLowerCase().includes(q) ||
      (b.user_mobile  || '').includes(q) ||
      (b.driver_name  || '').toLowerCase().includes(q) ||
      (b.driver_mobile|| '').includes(q);
    const matchPayment = !paymentFilter || b.payment_mode === paymentFilter;
    const matchStatus  = !statusFilter || b.status === statusFilter;
    const created = b.created_at ? new Date(b.created_at) : null;
    const matchFrom = !fromDate || (created && created >= new Date(fromDate));
    const matchTo   = !toDate   || (created && created <= new Date(`${toDate}T23:59:59`));
    return matchSearch && matchPayment && matchStatus && matchFrom && matchTo;
  }), [tabScoped, search, paymentFilter, statusFilter, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [activeTab]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Summary (computed over the filtered set, not just the current page) ──
  const summary = useMemo(() => {
    let online = 0, cash = 0, due = 0, company = 0, captain = 0;
    let cancellationFee = 0, cancelledCount = 0, toRecover = 0;
    for (const b of filtered) {
      // every rupee received so far — tokens of running and cancelled bookings included
      online += b.collected_online || 0;
      cash   += b.collected_cash || 0;
      if (b.status === 'CANCELLED') {
        cancelledCount += 1;
        const fee = Number(b.cancellation_fee || 0);
        cancellationFee += fee;
        if (feeToRecover(b)) toRecover += fee;
      } else {
        due += b.due_amount || 0;
        // Commission only on fully paid bookings — one still running hasn't earned anyone
        // its share yet.
        if (b.paid) {
          company += b.company_amount || 0;
          captain += b.captain_amount || 0;
        }
      }
    }
    return { online, cash, net: online + cash, due, company, captain, cancellationFee, cancelledCount, toRecover };
  }, [filtered]);

  const resetFilters = () => { setSearch(''); setPaymentFilter(''); setStatusFilter(''); setFromDate(''); setToDate(''); setPage(1); };
  const hasFilter = search || paymentFilter || statusFilter || fromDate || toDate;

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        .ac-row:hover td { background:#fafbff !important; }
        .ac-row td { transition: background 0.12s; }
        .ac-tab { border: none; background: transparent; cursor: pointer; padding: 8px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 700; color: #64748b; white-space: nowrap; }
        .ac-tab.active { background: #eef2ff; color: #4338ca; }
        .ac-tabs { overflow-x: auto; }
        .ac-tabs::-webkit-scrollbar { height: 0; }
      `}</style>

      <div className="responsive-page" style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Accounts</h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px', margin: 0 }}>
              Money received, earnings &amp; cancellation charges · Showing <b>{filtered.length}</b> of <b>{tabScoped.length}</b>
            </p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── Service Tabs ── */}
        <div className="ac-tabs" style={{ display: 'flex', gap: '6px', background: 'white', border: '1.5px solid #eef2f7', borderRadius: '12px', padding: '5px', marginBottom: '18px', width: 'fit-content', maxWidth: '100%' }}>
          {tabs.map(t => (
            <button key={t.key} className={`ac-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <StatCard label="Total Collected"  value={fmtAmt(summary.net)}     sub={`Online ${fmtAmt(summary.online)} · Cash ${fmtAmt(summary.cash)}`} bg="#eef2ff" color="#6366f1" icon={<IndianRupee size={18} color="#6366f1" />} />
          <StatCard label="Still To Come"    value={fmtAmt(summary.due)}     sub="Unpaid balance on running bookings" bg="#fef9c3" color="#a16207" icon={<Banknote size={18} color="#a16207" />} />
          <StatCard label="Company Earning"  value={fmtAmt(summary.company)} sub="On fully paid bookings" bg="#d1fae5" color="#059669" icon={<CheckCircle2 size={18} color="#059669" />} />
          <StatCard label="Captain Earning"  value={fmtAmt(summary.captain)} sub="On fully paid bookings" bg="#e0f2fe" color="#0369a1" icon={<Wallet size={18} color="#0369a1" />} />
          <StatCard label={`Cancellation Charges (${summary.cancelledCount})`} value={fmtAmt(summary.cancellationFee)} sub={`To collect from users ${fmtAmt(summary.toRecover)}`} bg="#fee2e2" color="#dc2626" icon={<XCircle size={18} color="#dc2626" />} />
        </div>

        {truncated.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', color: '#92400e', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
            Only the latest {LOAD_LIMIT} bookings are loaded for: {truncated.join(', ')}. Totals above do not include older ones — use the date filter for an exact period.
          </div>
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
                    { label: 'Service',    align: 'left'   },
                    { label: 'Date',       align: 'center' },
                    { label: 'User',       align: 'left'   },
                    { label: 'Captain',    align: 'left'   },
                    { label: 'Total',      align: 'right'  },
                    { label: 'Received',   align: 'right'  },
                    { label: 'Due',        align: 'right'  },
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
                    {Array.from({ length: 12 }).map((__, j) => (
                      <td key={j} style={{ padding: '14px' }}>
                        <div style={{ height: '12px', borderRadius: '4px', background: '#f1f5f9' }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && paginated.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No bookings found matching your filters.</td></tr>
                )}

                {!loading && paginated.map(b => {
                  const st = getStatusStyle(b.status);
                  const cancellationKnown = b.cancellation_fee != null;
                  return (
                    <tr key={`${b.module}-${b.id}`} className="ac-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{b.booking_id}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{b.service_name}</div>
                        {b.sub_service_name && b.sub_service_name !== b.service_name && (
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{b.sub_service_name}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDate(b.created_at)}</td>
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
                      {/* Total = fare (fees included) + paid topups */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{fmtAmt(b.total_amount)}</div>
                        {b.topup_amount && b.topup_amount > 0 ? (
                          <div style={{ fontSize: '9px', color: '#b45309', fontWeight: 600 }}>incl. topup {fmtAmt(b.topup_amount)}</div>
                        ) : null}
                      </td>
                      {/* Received so far, split by how it was paid */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: b.collected_total > 0 ? '#059669' : '#cbd5e1' }}>{fmtAmt(b.collected_total)}</div>
                        {b.collected_total > 0 && (
                          <div style={{ fontSize: '9px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {b.collected_online > 0 ? `Online ${fmtAmt(b.collected_online)}` : ''}
                            {b.collected_online > 0 && b.collected_cash > 0 ? ' · ' : ''}
                            {b.collected_cash > 0 ? `Cash ${fmtAmt(b.collected_cash)}` : ''}
                          </div>
                        )}
                      </td>
                      {/* Still to come from the customer */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: b.due_amount > 0 ? '#a16207' : '#cbd5e1' }}>
                        {b.due_amount > 0 ? fmtAmt(b.due_amount) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                        {b.status === 'CANCELLED' || !b.paid ? '—' : fmtAmt(b.company_amount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#0369a1' }}>
                        {b.status === 'CANCELLED' || !b.paid ? '—' : fmtAmt(b.captain_amount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {b.status === 'CANCELLED' && cancellationKnown && Number(b.cancellation_fee) > 0 ? (
                          <>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>{fmtAmt(b.cancellation_fee)}</div>
                            <div style={{ fontSize: '9px', color: feeToRecover(b) ? '#dc2626' : '#94a3b8', fontWeight: feeToRecover(b) ? 700 : 400 }}>{cancellationNote(b)}</div>
                          </>
                        ) : b.status === 'CANCELLED' && !cancellationKnown ? (
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
