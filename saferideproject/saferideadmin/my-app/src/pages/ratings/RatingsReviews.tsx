import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, Star } from 'lucide-react';
import { getAllBookinghistory, getSelfSharingBookings, getParcelBookings, getOnSpotBookings, getAllServices } from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
// Normalized shape every source's raw API rows get mapped into, mirroring
// AccountList.tsx's MoneyBooking pattern so one table implementation can serve
// every service — real ride services plus Self Sharing/Parcel/On Spot.
type Module = 'RIDE' | 'SELF_SHARING' | 'PARCEL' | 'ONSPOT';

interface ReviewRow {
  id: number;
  module: Module;
  tabKey: string; // 'SVC_<service_id>' for rides, else the module name
  booking_id: string;
  created_at: string;
  service_name: string;
  user_name: string | null;
  user_mobile: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  rating: number;
  review: string | null;
}

type RawRow = Record<string, unknown>;

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Only rows that actually carry a numeric rating are reviews — everything else
// (unrated bookings) is dropped right at the mapping boundary.
const mapRow = (raw: RawRow, module: Module, tabKey: string, fallbackLabel: string): ReviewRow | null => {
  if (raw.rating == null) return null;
  return {
    id: Number(raw.id),
    module,
    tabKey,
    booking_id: String(raw.booking_id ?? ''),
    created_at: String(raw.created_at ?? ''),
    service_name: String(raw.service_name || fallbackLabel),
    user_name: (raw.user_name as string | null) ?? null,
    user_mobile: (raw.user_mobile as string | null) ?? null,
    driver_name: (raw.driver_name as string | null) ?? null,
    driver_mobile: (raw.driver_mobile as string | null) ?? null,
    rating: Number(raw.rating),
    review: (raw.review as string | null) ?? null,
  };
};

const extractList = (res: unknown): RawRow[] => {
  const body = (res as { data: unknown }).data;
  if (Array.isArray(body)) return body as RawRow[];
  const inner = (body as { data?: RawRow[] })?.data;
  return Array.isArray(inner) ? inner : [];
};

function StarRating({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={13} color={i <= value ? '#f59e0b' : '#e2e8f0'} fill={i <= value ? '#f59e0b' : '#e2e8f0'} />
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RatingsReviews() {
  const [allReviews, setAllReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch]       = useState('');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [page, setPage]           = useState(1);
  const [services, setServices]   = useState<{ key: string; label: string; order: number }[]>([]);
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

      const reviews: ReviewRow[] = [];
      for (const raw of extractList(rides)) {
        const row = mapRow(raw, 'RIDE', `SVC_${raw.service_id}`, 'Ride');
        if (row) reviews.push(row);
      }
      for (const raw of extractList(selfSharing)) {
        const row = mapRow(raw, 'SELF_SHARING', 'SELF_SHARING', 'Self Sharing');
        if (row) reviews.push(row);
      }
      for (const raw of extractList(parcel)) {
        const row = mapRow(raw, 'PARCEL', 'PARCEL', 'Parcel');
        if (row) reviews.push(row);
      }
      for (const raw of extractList(onspot)) {
        const row = mapRow(raw, 'ONSPOT', 'ONSPOT', 'On Spot');
        if (row) reviews.push(row);
      }
      setAllReviews(reviews);

      const rawServices = extractList(serviceRows) as { id: number; title: string; status?: number; position?: number }[];
      setServices(
        rawServices
          .filter(s => s.status !== 0 && !NON_RIDE_SERVICE_NAMES.some(k => (s.title || '').toLowerCase().includes(k)))
          .map(s => ({ key: `SVC_${s.id}`, label: s.title, order: s.position ?? s.id }))
          .sort((a, b) => a.order - b.order)
      );
    } catch {
      setAllReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Tabs: All, then every active service from the `services` table, then the three
  // fixed modules that live outside `bookings` — same construction as AccountList.tsx.
  const tabs = useMemo(() => [
    { key: 'ALL', label: 'All' },
    ...services,
    { key: 'SELF_SHARING', label: 'Self Sharing' },
    { key: 'PARCEL', label: 'Parcel' },
    { key: 'ONSPOT', label: 'On Spot' },
  ], [services]);

  const tabScoped = useMemo(
    () => activeTab === 'ALL' ? allReviews : allReviews.filter(r => r.tabKey === activeTab),
    [allReviews, activeTab]
  );

  const filtered = useMemo(() => tabScoped.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.booking_id.toLowerCase().includes(q) ||
      (r.user_name    || '').toLowerCase().includes(q) ||
      (r.user_mobile  || '').includes(q) ||
      (r.driver_name  || '').toLowerCase().includes(q) ||
      (r.driver_mobile|| '').includes(q);
    const created = r.created_at ? new Date(r.created_at) : null;
    const matchFrom = !fromDate || (created && created >= new Date(fromDate));
    const matchTo   = !toDate   || (created && created <= new Date(`${toDate}T23:59:59`));
    return matchSearch && matchFrom && matchTo;
  }), [tabScoped, search, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [activeTab]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const avgRating = useMemo(
    () => filtered.length ? (filtered.reduce((sum, r) => sum + r.rating, 0) / filtered.length) : 0,
    [filtered]
  );

  const resetFilters = () => { setSearch(''); setFromDate(''); setToDate(''); setPage(1); };
  const hasFilter = search || fromDate || toDate;

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        .rr-row:hover td { background:#fafbff !important; }
        .rr-row td { transition: background 0.12s; }
        .rr-tab { border: none; background: transparent; cursor: pointer; padding: 8px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 700; color: #64748b; white-space: nowrap; }
        .rr-tab.active { background: #eef2ff; color: #4338ca; }
        .rr-tabs { overflow-x: auto; }
        .rr-tabs::-webkit-scrollbar { height: 0; }
      `}</style>

      <div className="responsive-page" style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Ratings &amp; Reviews</h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px', margin: 0 }}>
              Rider feedback across every service · Showing <b>{filtered.length}</b> of <b>{tabScoped.length}</b>
              {filtered.length > 0 && <> · Avg rating <b>{avgRating.toFixed(1)}</b> ★</>}
            </p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── Service Tabs ── */}
        <div className="rr-tabs" style={{ display: 'flex', gap: '6px', background: 'white', border: '1.5px solid #eef2f7', borderRadius: '12px', padding: '5px', marginBottom: '18px', width: 'fit-content', maxWidth: '100%' }}>
          {tabs.map(t => (
            <button key={t.key} className={`rr-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
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
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {([
                    { label: 'Date',    align: 'center' },
                    { label: 'Service', align: 'left'   },
                    { label: 'Booking', align: 'left'   },
                    { label: 'User',    align: 'left'   },
                    { label: 'Captain', align: 'left'   },
                    { label: 'Rating',  align: 'center' },
                    { label: 'Review',  align: 'left'   },
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
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} style={{ padding: '14px' }}>
                        <div style={{ height: '12px', borderRadius: '4px', background: '#f1f5f9' }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && paginated.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No reviews found matching your filters.</td></tr>
                )}

                {!loading && paginated.map(r => (
                  <tr key={`${r.module}-${r.id}`} className="rr-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{r.service_name}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{r.booking_id}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{r.user_name || '—'}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{r.user_mobile || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{r.driver_name || '—'}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{r.driver_mobile || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <StarRating value={r.rating} />
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569', maxWidth: '280px' }}>
                      {r.review || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No comment</span>}
                    </td>
                  </tr>
                ))}
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
