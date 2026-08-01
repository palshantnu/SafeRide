import { useState, useEffect, useMemo } from "react";
import AdminLayout from "../layouts/AdminLayout";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  ArrowUpRight, Users, Car, Briefcase, ShoppingCart,
  Activity, Search, X, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertCircle, RefreshCw, MapPin,
  type LucideIcon,
} from "lucide-react";
import {
  getAllBookinghistory, getAllUsers, getAllDrivers, getAllbussinessassociates,
} from "../services/api";

/* ─── TYPES ─── */
interface Booking {
  id: number;
  booking_id?: string;
  status?: string;
  user_name?: string | null;
  user_mobile?: string;
  driver_name?: string | null;
  service_name?: string;
  sub_service_name?: string | null;
  plan_price?: string | null;
  total_fare?: string | null;
  payment_mode?: string | null;
  paid?: number;
  pickup_city?: string;
  drop_city?: string;
  created_at?: string;
}

interface StatItem {
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  loading: boolean;
}

/* ─── STATUS CONFIG ─── */
const STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  COMPLETED:  { bg: "#d1fae5", color: "#065f46" },
  CANCELLED:  { bg: "#fee2e2", color: "#991b1b" },
  SEARCHING:  { bg: "#fef3c7", color: "#92400e" },
  ACCEPTED:   { bg: "#dbeafe", color: "#1e40af" },
  ARRIVED:    { bg: "#ede9fe", color: "#5b21b6" },
  STARTED:    { bg: "#dcfce7", color: "#166534" },
  PICKEDUP:   { bg: "#e0f2fe", color: "#075985" },
  DROPPED:      { bg: "#f0fdf4", color: "#14532d" },
  BALANCE_PAID: { bg: "#fdf4ff", color: "#6b21a8" },
  PAYMENT_DONE: { bg: "#ecfdf5", color: "#065f46" },
};
const getStatus = (s?: string) =>
  STATUS_CONFIG[s?.toUpperCase() || ""] || { bg: "#f1f5f9", color: "#475569" };

/* ─── CUSTOM TOOLTIP ─── */
interface TooltipPayloadItem { value: number; name: string; }
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0c1322", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
      <p style={{ color: "#94a3b8", fontSize: 11, margin: "0 0 4px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: "#6366f1", fontSize: 13, fontWeight: 700, margin: "2px 0 0" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

/* ─── STAT CARD ─── */
function StatCard({ stat, idx }: { stat: StatItem; idx: number }) {
  return (
    <div style={{
      background: "white", padding: "20px 22px", borderRadius: 18,
      border: "1.5px solid #eef2f7", position: "relative", overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      animation: "fadeSlideUp 0.4s ease both",
      animationDelay: `${idx * 80}ms`,
    }}>
      <div style={{ position: "absolute", top: -16, right: -16, width: 80, height: 80, background: stat.bg, borderRadius: "50%", opacity: 0.6 }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, background: stat.bg, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <stat.icon size={20} color={stat.color} />
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#059669", background: "#d1fae5", padding: "3px 8px", borderRadius: 20 }}>
          <ArrowUpRight size={12} /> Live
        </span>
      </div>
      {stat.loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 32 }}>
          <RefreshCw size={16} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, color: "#94a3b8" }}>Loading...</span>
        </div>
      ) : (
        <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>{stat.value}</div>
      )}
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, fontWeight: 500 }}>{stat.label}</div>
      <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>{stat.sub}</div>
    </div>
  );
}

/* ─── RECENT BOOKINGS TABLE ─── */
function RecentBookingsTable({ bookings, loading, globalSearch }: { bookings: Booking[]; loading: boolean; globalSearch: string }) {
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage]       = useState(1);
  const PER_PAGE = 8;

  const q = globalSearch || search;

  const allStatuses = useMemo(() => {
    const s = new Set(bookings.map(b => b.status?.toUpperCase() || "—"));
    return ["All", ...Array.from(s)];
  }, [bookings]);

  const filtered = useMemo(() => bookings.filter(b => {
    const matchQ = !q ||
      (b.booking_id || "").toLowerCase().includes(q.toLowerCase()) ||
      (b.user_name || "").toLowerCase().includes(q.toLowerCase()) ||
      (b.driver_name || "").toLowerCase().includes(q.toLowerCase()) ||
      (b.service_name || "").toLowerCase().includes(q.toLowerCase());
    const matchStatus = statusFilter === "All" || (b.status || "").toUpperCase() === statusFilter;
    return matchQ && matchStatus;
  }), [q, statusFilter, bookings]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div style={{ background: "white", borderRadius: 20, border: "1.5px solid #eef2f7", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>

      {/* Header */}
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Recent Bookings</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>{filtered.length} total records</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "7px 12px" }}>
              <Search size={13} color="#94a3b8" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search bookings…"
                style={{ border: "none", background: "none", outline: "none", fontSize: 12.5, width: 140, color: "#1e293b" }}
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
                  <X size={12} />
                </button>
              )}
            </div>
            {/* Status filter chips */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {allStatuses.slice(0, 6).map(s => {
                const sc = getStatus(s);
                const active = statusFilter === s;
                return (
                  <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
                    padding: "4px 9px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: active ? "none" : "1.5px solid #e2e8f0",
                    background: active ? (s === "All" ? "#6366f1" : sc.bg) : "transparent",
                    color: active ? (s === "All" ? "white" : sc.color) : "#64748b",
                  }}>{s}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>
            <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>Loading bookings...</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafbfc" }}>
                {["Booking ID", "Customer", "Captain", "Service", "Route", "Amount", "Status", "Date"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                    <Search size={28} color="#cbd5e1" style={{ display: "block", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 13 }}>No bookings found</div>
                  </td>
                </tr>
              ) : paginated.map(b => {
                const sc = getStatus(b.status);
                return (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f8fafc" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#fafbff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#6366f1", whiteSpace: "nowrap" }}>
                      {b.booking_id || `#${b.id}`}
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Users size={13} color="#3b82f6" />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{b.user_name || "—"}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>{b.user_mobile || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Car size={13} color="#10b981" />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}>{b.driver_name || "Not Assigned"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, whiteSpace: "nowrap" }}>
                      <div style={{ color: "#475569", fontWeight: 500 }}>{b.service_name || "—"}</div>
                      {b.sub_service_name && <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 1 }}>{b.sub_service_name}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                        <MapPin size={10} color="#94a3b8" />
                        {b.pickup_city || "—"}
                        <span style={{ color: "#cbd5e1" }}>→</span>
                        {b.drop_city || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                      {b.total_fare ? `₹${parseFloat(b.total_fare).toFixed(2)}` : b.plan_price ? `₹${b.plan_price}` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: sc.bg, color: sc.color, padding: "4px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                        {b.status || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(b.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div style={{ padding: "14px 22px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Showing <b style={{ color: "#475569" }}>{filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</b> of <b style={{ color: "#475569" }}>{filtered.length}</b>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "6px 10px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "white", cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#cbd5e1" : "#475569", display: "flex", alignItems: "center" }}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5)             p = i + 1;
              else if (page <= 3)              p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else                             p = page - 2 + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: page === p ? "none" : "1.5px solid #e2e8f0", background: page === p ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "white", color: page === p ? "white" : "#475569", cursor: "pointer", fontWeight: page === p ? 700 : 400, fontSize: 12.5, boxShadow: page === p ? "0 2px 8px rgba(99,102,241,0.35)" : "none" }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
              style={{ padding: "6px 10px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "white", cursor: (page === totalPages || totalPages === 0) ? "not-allowed" : "pointer", color: (page === totalPages || totalPages === 0) ? "#cbd5e1" : "#475569", display: "flex", alignItems: "center" }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── DASHBOARD PAGE ─── */
export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [baCount, setBaCount]     = useState(0);

  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingUsers,    setLoadingUsers]    = useState(true);
  const [loadingDrivers,  setLoadingDrivers]  = useState(true);
  const [loadingBA,       setLoadingBA]       = useState(true);

  const fetchAll = () => {
    setLoadingBookings(true);
    setLoadingUsers(true);
    setLoadingDrivers(true);
    setLoadingBA(true);

    getAllBookinghistory({ limit: 1000 })
      .then((res: any) => {
        const data = res?.data?.data || res?.data || [];
        setBookings(Array.isArray(data) ? data : []);
      })
      .catch(() => setBookings([]))
      .finally(() => setLoadingBookings(false));

    getAllUsers()
      .then((res: any) => {
        const data = res?.data?.data || res?.data || [];
        setUserCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => setUserCount(0))
      .finally(() => setLoadingUsers(false));

    getAllDrivers()
      .then((res: any) => {
        const data = res?.data?.data || res?.data || [];
        setDriverCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => setDriverCount(0))
      .finally(() => setLoadingDrivers(false));

    getAllbussinessassociates()
      .then((res: any) => {
        const data = res?.data?.data || res?.data || [];
        setBaCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => setBaCount(0))
      .finally(() => setLoadingBA(false));
  };

  useEffect(() => { fetchAll(); }, []);

  /* Booking status distribution for bar chart */
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => {
      const s = b.status?.toUpperCase() || "UNKNOWN";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, value]) => ({ name, value }));
  }, [bookings]);

  /* Bookings per day (last 7 days) for area chart */
  const bookingTrendData = useMemo(() => {
    const today = new Date();
    const days: { label: string; date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        date: d.toISOString().split("T")[0],
        count: 0,
      });
    }
    bookings.forEach(b => {
      if (!b.created_at) return;
      const date = b.created_at.split("T")[0];
      const day = days.find(d => d.date === date);
      if (day) day.count++;
    });
    return days.map(({ label, count }) => ({ day: label, bookings: count }));
  }, [bookings]);

  /* Completed bookings */
  const completedCount = useMemo(() =>
    bookings.filter(b => ["COMPLETED", "DROPPED", "BALANCE_PAID", "PAYMENT_DONE"].includes(b.status?.toUpperCase() || "")).length,
  [bookings]);

  const stats: StatItem[] = [
    {
      label: "Total Bookings",
      value: bookings.length,
      sub: `${completedCount} completed`,
      icon: ShoppingCart,
      color: "#6366f1", bg: "#eef2ff",
      loading: loadingBookings,
    },
    {
      label: "Total Users",
      value: userCount,
      sub: "Registered customers",
      icon: Users,
      color: "#0ea5e9", bg: "#e0f2fe",
      loading: loadingUsers,
    },
    {
      label: "Total Captains",
      value: driverCount,
      sub: "Registered captains",
      icon: Car,
      color: "#10b981", bg: "#d1fae5",
      loading: loadingDrivers,
    },
    {
      label: "Business Associates",
      value: baCount,
      sub: "Active partners",
      icon: Briefcase,
      color: "#f59e0b", bg: "#fef3c7",
      loading: loadingBA,
    },
  ];

  return (
    <AdminLayout searchQuery={searchQuery} setSearchQuery={setSearchQuery}>

      {/* Header */}
      <div style={{ marginBottom: 24, animation: "fadeSlideUp 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.4px" }}>Dashboard Overview</h1>
            <p style={{ margin: "3px 0 0", color: "#94a3b8", fontSize: 13 }}>Welcome back, Admin! Here's what's happening today.</p>
          </div>
          <button
            onClick={fetchAll}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "white", boxShadow: "0 2px 10px rgba(99,102,241,0.35)" }}>
            <Activity size={13} /> Refresh Data
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map((s, i) => <StatCard key={s.label} stat={s} idx={i} />)}
      </div>

      {/* Charts Row */}
      <div className="admin-dashboard-chart-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 24 }}>

        {/* Booking Trend – Area Chart */}
        <div style={{ background: "white", padding: "22px 24px", borderRadius: 20, border: "1.5px solid #eef2f7", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", animation: "fadeSlideUp 0.5s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Booking Trend</h3>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#94a3b8" }}>Last 7 days activity</p>
            </div>
            <span style={{ background: "#eef2ff", color: "#6366f1", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
              {bookings.length} Total
            </span>
          </div>
          {loadingBookings ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
              <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bookingTrendData}>
                <defs>
                  <linearGradient id="bookingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="bookings" stroke="#6366f1" strokeWidth={2.5} fill="url(#bookingGrad)" dot={false} activeDot={{ r: 5, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Booking Status – Bar Chart */}
        <div style={{ background: "white", padding: "22px 24px", borderRadius: 20, border: "1.5px solid #eef2f7", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", animation: "fadeSlideUp 0.55s ease both" }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Booking Status</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#94a3b8" }}>Distribution by status</p>
          </div>
          {loadingBookings ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
              <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : statusChartData.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusChartData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick Summary Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Completed",  count: bookings.filter(b => ["COMPLETED", "DROPPED", "BALANCE_PAID", "PAYMENT_DONE"].includes(b.status?.toUpperCase() || "")).length, color: "#10b981", bg: "#d1fae5" },
          { label: "Cancelled",  count: bookings.filter(b => b.status?.toUpperCase() === "CANCELLED").length,  color: "#ef4444", bg: "#fee2e2" },
          { label: "Ongoing",    count: bookings.filter(b => ["SEARCHING", "ACCEPTED", "ARRIVED", "STARTED", "PICKEDUP"].includes(b.status?.toUpperCase() || "")).length, color: "#3b82f6", bg: "#dbeafe" },
          { label: "Pending",    count: bookings.filter(b => !b.status || b.status === "").length, color: "#f59e0b", bg: "#fef3c7" },
        ].map(item => (
          <div key={item.label} style={{ background: "white", borderRadius: 14, padding: "16px 20px", border: "1.5px solid #eef2f7", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {item.label === "Completed" && <CheckCircle2 size={18} color={item.color} />}
              {item.label === "Cancelled" && <AlertCircle size={18} color={item.color} />}
              {item.label === "Ongoing"   && <Activity size={18} color={item.color} />}
              {item.label === "Pending"   && <Clock size={18} color={item.color} />}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                {loadingBookings ? "—" : item.count}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Bookings Table */}
      <div style={{ animation: "fadeSlideUp 0.6s ease both" }}>
        <RecentBookingsTable bookings={bookings} loading={loadingBookings} globalSearch={searchQuery} />
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

    </AdminLayout>
  );
}
