import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Filter, X,
  IndianRupee, Wallet, XCircle, CheckCircle2, Banknote, CreditCard,
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
  user_name: string | null;
  user_mobile: string | null;
  user_wallet: string | number | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  driver_wallet: string | number | null;
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
  status: String(raw.status ?? ''),
  // Parcel stores 'user'/'driver' lowercase (its own status-casing convention); normalize to
  // uppercase here so the table's cancelledTo label (b.cancelled_by === 'DRIVER'/'USER') works
  // the same across every module.
  cancelled_by: raw.cancelled_by != null ? String(raw.cancelled_by).toUpperCase() : null,
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
});

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
  const PER_PAGE = 10;

  // Modules that live in their own tables outside `bookings` — a matching row in the
  // `services` table (if any) doesn't get its own ride tab, the fixed tab below covers it.
  const NON_RIDE_SERVICE_NAMES = ['self shar', 'parcel', 'on spot', 'onspot', 'on-spot'];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rides, selfSharing, parcel, onspot, serviceRows] = await Promise.all([
        getAllBookinghistory({ limit: 1000 }).catch(() => null),
        getSelfSharingBookings({ limit: 1000 }).catch(() => null),
        getParcelBookings({ limit: 1000 }).catch(() => null),
        getOnSpotBookings({ limit: 1000 }).catch(() => null),
        getAllServices().catch(() => null),
      ]);
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
    let online = 0, cash = 0, company = 0, captain = 0, cancellationFee = 0, cancelledCount = 0;
    for (const b of filtered) {
      if (b.paid) {
        if (b.payment_mode === 'ONLINE') online += b.total_amount || 0;
        else if (b.payment_mode === 'CASH') cash += b.total_amount || 0;
      }
      if (b.status === 'CANCELLED') {
        cancelledCount += 1;
        cancellationFee += Number(b.cancellation_fee || 0);
      } else if (b.paid) {
        // Only count commission on money that's actually been collected — a booking still
        // sitting in SEARCHING/ACCEPTED/etc. with paid=0 hasn't earned anyone anything yet,
        // so it shouldn't inflate Company/Captain Share while Collected stays at ₹0.
        company += b.company_amount || 0;
        captain += b.captain_amount || 0;
      }
    }
    return { online, cash, company, captain, cancellationFee, cancelledCount, net: online + cash };
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
              Payment, commission &amp; cancellation breakdown · Showing <b>{filtered.length}</b> of <b>{tabScoped.length}</b>
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
          <StatCard label="Online Collected"     value={fmtAmt(summary.online)}          bg="#dbeafe" color="#2563eb" icon={<CreditCard size={18} color="#2563eb" />} />
          <StatCard label="Cash Collected"       value={fmtAmt(summary.cash)}            bg="#fef9c3" color="#a16207" icon={<Banknote size={18} color="#a16207" />} />
          <StatCard label="Net Collected"        value={fmtAmt(summary.net)}             bg="#eef2ff" color="#6366f1" icon={<IndianRupee size={18} color="#6366f1" />} />
          <StatCard label="Company Share"        value={fmtAmt(summary.company)}         bg="#d1fae5" color="#059669" icon={<CheckCircle2 size={18} color="#059669" />} />
          <StatCard label="Captain Share"        value={fmtAmt(summary.captain)}         bg="#e0f2fe" color="#0369a1" icon={<Wallet size={18} color="#0369a1" />} />
          <StatCard label={`Cancellation Charges (${summary.cancelledCount})`} value={fmtAmt(summary.cancellationFee)} bg="#fee2e2" color="#dc2626" icon={<XCircle size={18} color="#dc2626" />} />
        </div>

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
                    { label: 'Payment',    align: 'center' },
                    { label: 'Token / Balance', align: 'right' },
                    { label: 'Total',      align: 'right'  },
                    { label: 'Company ₹',  align: 'right'  },
                    { label: 'Captain ₹',  align: 'right'  },
                    { label: 'Topup',      align: 'right'  },
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
                    {Array.from({ length: 13 }).map((__, j) => (
                      <td key={j} style={{ padding: '14px' }}>
                        <div style={{ height: '12px', borderRadius: '4px', background: '#f1f5f9' }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && paginated.length === 0 && (
                  <tr><td colSpan={13} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No bookings found matching your filters.</td></tr>
                )}

                {!loading && paginated.map(b => {
                  const st = getStatusStyle(b.status);
                  const cancelledTo = b.cancelled_by === 'DRIVER' ? 'Captain paid' : b.cancelled_by === 'USER' ? 'User paid' : null;
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
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {b.token_amount != null || b.balance_amount != null ? (
                          <>
                            <div style={{ fontSize: '11px', color: '#1e293b' }}>Token {fmtAmt(b.token_amount)}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Bal {fmtAmt(b.balance_amount)}</div>
                          </>
                        ) : <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{fmtAmt(b.total_amount)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                        {b.status === 'CANCELLED' || !b.paid ? '—' : fmtAmt(b.company_amount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#0369a1' }}>
                        {b.status === 'CANCELLED' || !b.paid ? '—' : fmtAmt(b.captain_amount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {b.topup_amount && b.topup_amount > 0 ? (
                          <>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{fmtAmt(b.topup_amount)}</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                              Co {fmtAmt(b.topup_company_amount)} · Cap {fmtAmt(b.topup_captain_amount)}
                            </div>
                          </>
                        ) : <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {b.status === 'CANCELLED' && cancellationKnown && Number(b.cancellation_fee) > 0 ? (
                          <>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>{fmtAmt(b.cancellation_fee)}</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8' }}>{cancelledTo || b.cancelled_by}</div>
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
