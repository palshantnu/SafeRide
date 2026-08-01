import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu, Search, Bell, X, User, Car, ShoppingBag,
  XCircle, Briefcase, CheckCheck, Trash2,
} from "lucide-react";
import {
  getAllUsers, getAllDrivers, getAllBookinghistory, getAllbussinessassociates,
} from "../services/api";
import { usePermissions } from "../context/PermissionsContext";

interface NavbarProps {
  onMenuClick: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

type NType = 'user' | 'captain' | 'booking_new' | 'booking_cancel' | 'ba';

interface NotificationItem {
  id: string;
  type: NType;
  message: string;
  sub: string;
  time: number;
  read: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractList(res: unknown): Record<string, unknown>[] {
  const body = (res as { data: unknown })?.data;
  if (Array.isArray(body)) return body;
  const inner = (body as { data?: unknown })?.data;
  if (Array.isArray(inner)) return inner;
  return [];
}

const NOTIF_KEY = 'sr_admin_notifs_v1';
const SEEN_KEY  = 'sr_admin_seen_v1';

function loadNotifs(): NotificationItem[] {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}
function saveNotifs(n: NotificationItem[]) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(n.slice(0, 60)));
}
function loadSeen(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}
function saveSeen(seen: Record<string, number[]>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

// Which list page each notification type links to.
const TYPE_ROUTE: Record<NType, string> = {
  user:           '/UserList',
  captain:        '/Driverlist',
  booking_new:    '/bookinghistory',
  booking_cancel: '/bookinghistory',
  ba:             '/Bussinessassociatelist',
};

const TYPE_META: Record<NType, { icon: ReactNode; bg: string; color: string; label: string }> = {
  user:           { icon: <User size={14} />,        bg: '#eff6ff', color: '#2563eb', label: 'New User'      },
  captain:        { icon: <Car size={14} />,         bg: '#f0fdf4', color: '#16a34a', label: 'New Captain'   },
  booking_new:    { icon: <ShoppingBag size={14} />, bg: '#eef2ff', color: '#6366f1', label: 'New Booking'   },
  booking_cancel: { icon: <XCircle size={14} />,     bg: '#fff1f2', color: '#ef4444', label: 'Cancelled'     },
  ba:             { icon: <Briefcase size={14} />,   bg: '#fffbeb', color: '#d97706', label: 'New Associate' },
};

function fmtTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export default function Navbar({ onMenuClick, searchQuery, setSearchQuery }: NavbarProps) {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = usePermissions();
  const [notifs, setNotifs]   = useState<NotificationItem[]>(loadNotifs);
  const [open,   setOpen]     = useState(false);

  // Who is logged in — name + role shown next to the avatar.
  const displayName = user?.name || (isSuperAdmin ? 'Sigiride Admin' : 'Staff');
  const roleLabel   = isSuperAdmin ? 'Sigiride Admin' : (user?.role_name || user?.role || 'Staff');
  const avatarChar  = (displayName.trim()[0] || 'A').toUpperCase();
  const seenRef    = useRef<Record<string, Set<number>>>({});
  const initDone   = useRef(false);
  const dropRef    = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.read).length;

  // ── Initialise seen sets from localStorage ────────────────────────────────
  useEffect(() => {
    const raw = loadSeen();
    const out: Record<string, Set<number>> = {};
    for (const k of Object.keys(raw)) out[k] = new Set(raw[k]);
    seenRef.current = out;
  }, []);

  // ── Poll ──────────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const [uRes, dRes, bRes, baRes] = await Promise.allSettled([
        getAllUsers(),
        getAllDrivers(),
        getAllBookinghistory({ limit: 1000 }),
        getAllbussinessassociates(),
      ]);

      const users    = uRes.status    === 'fulfilled' ? extractList(uRes.value)    : [];
      const drivers  = dRes.status    === 'fulfilled' ? extractList(dRes.value)    : [];
      const bookings = bRes.status    === 'fulfilled' ? extractList(bRes.value)    : [];
      const bas      = baRes.status   === 'fulfilled' ? extractList(baRes.value)   : [];

      const seen  = seenRef.current;
      const fresh: NotificationItem[] = [];
      const now   = Date.now();
      const isInit = !initDone.current;

      const process = (
        key: string,
        items: Record<string, unknown>[],
        type: NType,
        msg: (item: Record<string, unknown>) => string,
        sub: (item: Record<string, unknown>) => string,
        filter?: (item: Record<string, unknown>) => boolean,
      ) => {
        if (!seen[key]) seen[key] = new Set();
        const list = filter ? items.filter(filter) : items;
        list.forEach(item => {
          const id = item.id as number;
          if (isInit) {
            seen[key].add(id);
          } else if (!seen[key].has(id)) {
            seen[key].add(id);
            fresh.push({
              id: `${key}_${id}_${now}`,
              type, message: msg(item), sub: sub(item),
              time: now, read: false,
            });
          }
        });
      };

      process('users',    users,    'user',           u => `${(u.name as string) || (u.mobile as string) || `User #${u.id}`} registered`,    () => 'New user registration');
      process('captains', drivers,  'captain',        d => `${(d.name as string) || (d.mobile as string) || `Captain #${d.id}`} registered`,  () => 'New captain registration');
      process('bookings', bookings, 'booking_new',    b => `Booking ${(b.booking_id as string) || `#${b.id}`}`, b => `${(b.service_name as string) || ''} · ${(b.pickup_city as string) || ''} → ${(b.drop_city as string) || ''}`);
      process('cancelled',bookings, 'booking_cancel', b => `Booking ${(b.booking_id as string) || `#${b.id}`} cancelled`, b => `Cancelled by ${(b.cancelled_by as string) || 'user'}`, b => (b.status as string) === 'CANCELLED');
      process('ba',       bas,      'ba',             a => `${(a.name as string) || (a.business_name as string) || `Associate #${a.id}`}`,     () => 'New business associate');

      // Flush seen to localStorage
      const flat: Record<string, number[]> = {};
      for (const k of Object.keys(seen)) flat[k] = Array.from(seen[k]);
      saveSeen(flat);

      if (isInit) {
        initDone.current = true;
      } else if (fresh.length > 0) {
        setNotifs(prev => {
          const updated = [...fresh, ...prev].slice(0, 60);
          saveNotifs(updated);
          return updated;
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [poll]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const markAllRead = () => {
    setNotifs(prev => { const u = prev.map(n => ({ ...n, read: true })); saveNotifs(u); return u; });
  };
  const clearAll = () => { setNotifs([]); saveNotifs([]); };
  const markRead = (id: string) => {
    setNotifs(prev => { const u = prev.map(n => n.id === id ? { ...n, read: true } : n); saveNotifs(u); return u; });
  };
  const handleNotifClick = (n: NotificationItem) => {
    markRead(n.id);
    setOpen(false);
    const route = TYPE_ROUTE[n.type];
    if (route) navigate(route);
  };

  return (
    <header className="admin-navbar" style={{
      height: 64, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid #e8eef4", display: "flex", alignItems: "center",
      padding: "0 24px", gap: 14, position: "sticky", top: 0, zIndex: 40,
      boxShadow: "0 1px 12px rgba(0,0,0,0.06)"
    }}>

      {/* ── Hamburger ── */}
      <button className="admin-menu-button" onClick={onMenuClick}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex" }}>
        <Menu size={22} />
      </button>

      {/* ── Search ── */}
      <div className="admin-navbar-search" style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#f8fafc", borderRadius: 12, padding: "9px 16px",
        flex: 1, maxWidth: 420, border: "1.5px solid #e2e8f0",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
      }}>
        <Search size={15} color="#94a3b8" />
        <input
          placeholder="Search orders, products, customers…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ border: "none", background: "none", outline: "none", fontSize: 13.5, width: "100%", color: "#1e293b" }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Right Actions ── */}
      <div className="admin-navbar-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>

        {/* ── Bell + Dropdown ── */}
        <div ref={dropRef} style={{ position: "relative" }}>
          <button onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
            style={{
              background: open ? "#eef2ff" : "#f8fafc",
              border: `1.5px solid ${open ? '#c7d2fe' : '#e2e8f0'}`,
              borderRadius: 10, padding: 8, cursor: "pointer", display: "flex",
              color: open ? "#6366f1" : "#64748b", transition: "all 0.15s",
            }}>
            <Bell size={18} />
          </button>

          {/* Badge */}
          {unread > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              minWidth: 18, height: 18, borderRadius: 10,
              background: "#ef4444", border: "2px solid white",
              color: "white", fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 3px", lineHeight: 1,
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}

          {/* Dropdown */}
          {open && (
            <div style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0,
              width: 360, maxHeight: 480,
              background: "white", borderRadius: 16,
              border: "1.5px solid #e2e8f0",
              boxShadow: "0 16px 48px rgba(0,0,0,0.14)",
              display: "flex", flexDirection: "column",
              zIndex: 999, overflow: "hidden",
              animation: "dropIn 0.18s ease",
            }}>

              {/* Header */}
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Notifications</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                    {notifs.length === 0 ? 'No notifications' : `${notifs.length} total`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {notifs.length > 0 && (
                    <button onClick={markAllRead} title="Mark all read"
                      style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      <CheckCheck size={12} /> All read
                    </button>
                  )}
                  {notifs.length > 0 && (
                    <button onClick={clearAll} title="Clear all"
                      style={{ background: "#fff1f2", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center" }}>
                    <Bell size={28} color="#e2e8f0" style={{ display: "block", margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>No notifications yet</div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>New activity will appear here</div>
                  </div>
                ) : (
                  notifs.map(n => {
                    const meta = TYPE_META[n.type];
                    return (
                      <div key={n.id}
                        onClick={() => handleNotifClick(n)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "12px 16px",
                          background: n.read ? "white" : "#fafbff",
                          borderBottom: "1px solid #f8fafc",
                          cursor: "pointer", transition: "background 0.12s",
                          borderLeft: n.read ? "3px solid transparent" : "3px solid #6366f1",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.read ? "white" : "#fafbff"; }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          background: meta.bg, color: meta.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {meta.icon}
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, padding: "1px 7px", borderRadius: 20 }}>
                              {meta.label}
                            </span>
                            {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {n.message}
                          </div>
                          {n.sub && (
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {n.sub}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 3 }}>{fmtTime(n.time)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 16px", borderTop: "1px solid #f1f5f9", background: "#fafbfc", flexShrink: 0, textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Auto-refreshes every 60 seconds</span>
              </div>
            </div>
          )}
        </div>

        {/* ── User (name + role) + Avatar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="admin-navbar-user" style={{ textAlign: "right", lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>{displayName}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", whiteSpace: "nowrap", textTransform: "capitalize" }}>{roleLabel}</div>
          </div>
          <div title={`${displayName} · ${roleLabel}`} style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(99,102,241,0.4)"
          }}>{avatarChar}</div>
        </div>
      </div>

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}
