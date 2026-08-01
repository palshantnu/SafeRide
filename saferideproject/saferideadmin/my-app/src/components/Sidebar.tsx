import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../utils/auth";
import {
  LayoutDashboard, Users, Car, Briefcase, Wrench, ListTree,
  BadgeDollarSign, UserCog, CalendarCheck, ShieldCheck,
  Settings, MessageSquare, Zap, LogOut, ChevronDown, FileText, Wallet,
  History, Map, LayoutTemplate, MessageSquareText, BellRing,
  type LucideIcon
} from "lucide-react";
import { usePermissions } from "../context/PermissionsContext";

interface SubNavItem { name: string; path: string; module?: string }
interface NavItem {
  name: string;
  icon: LucideIcon;
  path?: string;
  module?: string;            // gate visibility by this module's "view" permission
  subItems?: SubNavItem[];
}

const navItems: NavItem[] = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Users", icon: Users, path: "/UserList", module: "users" },
  { name: "Captain", icon: Car, path: "/Driverlist", module: "drivers" },
  { name: "Business Associates", icon: Briefcase, path: "/Bussinessassociatelist", module: "business_associates" },
  { name: "Services", icon: Wrench, path: "/Servicelist", module: "services" },
  { name: "Sub Services", icon: ListTree, path: "/sub-services", module: "sub_services" },
  { name: "Plans", icon: BadgeDollarSign, path: "/Planlist", module: "plans" },
  { name: "Staff", icon: UserCog, path: "/dashboard/staff", module: "staff" },
  { name: "Bookings", icon: CalendarCheck, path: "/bookinghistory", module: "bookings" },
  {
    name: "Service History", icon: History,
    subItems: [
      { name: "Self Sharing", path: "/self-sharing-history", module: "self_sharing" },
      { name: "Inter City",   path: "/intercity-history",    module: "bookings" },
      { name: "Parcel",       path: "/parcel-history",       module: "parcel" },
      { name: "On Spot",      path: "/onspot-history",        module: "onspot" },
    ],
  },
  { name: "Pages", icon: FileText, path: "/pages", module: "pages" },
  { name: "Website", icon: LayoutTemplate, path: "/website", module: "landing" },
  { name: "Pop-up Messages", icon: MessageSquareText, path: "/popup-messages", module: "popups" },
  { name: "Notifications", icon: BellRing, path: "/notifications", module: "notifications" },
  { name: "Withdrawal Requests", icon: Wallet, path: "/withdrawal-requests", module: "withdrawals" },
  { name: "State & City",        icon: Map,   path: "/state-city", module: "locations" },
  { name: "Role & Permissions", icon: ShieldCheck, path: "/dashboard/roles", module: "roles" },
  { name: "App Settings", icon: Settings, path: "/dashboard/settings" },
  { name: "Chat System", icon: MessageSquare, path: "/dashboard/chat" },
];

interface SidebarProps {
  active: string;
  setActive: (name: string) => void;
  onClose?: () => void;
}

export default function Sidebar({ active, setActive, onClose }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();
  const { can } = usePermissions();

  const handleLogout = () => {
    logout();
    // Full reload clears all in-memory auth/permission state.
    window.location.href = '/login';
  };

  // Only show items the user can view (items without a module are always shown).
  const visibleNav = navItems
    .map(item => {
      if (item.subItems) {
        const subs = item.subItems.filter(s => !s.module || can(s.module, "view"));
        return subs.length ? { ...item, subItems: subs } : null;
      }
      return !item.module || can(item.module, "view") ? item : null;
    })
    .filter((x): x is NavItem => x !== null);
  const toggleMenu = (name: string) => {
    setOpenMenus(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  useEffect(() => {
    navItems.forEach(item => {
      if (item.path === location.pathname) setActive(item.name);
      item.subItems?.forEach(sub => {
        if (sub.path === location.pathname) {
          setActive(sub.name);
          if (!openMenus.includes(item.name)) toggleMenu(item.name);
        }
      });
    });
  }, [location.pathname]);

  return (
    <div style={{
      width: 256, height: "100%",
      background: "linear-gradient(180deg, #060d1f 0%, #0c1322 100%)",
      display: "flex", flexDirection: "column",
      borderRight: "1px solid rgba(99,102,241,0.12)",
      boxShadow: "4px 0 24px rgba(0,0,0,0.25)"
    }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(99,102,241,0.4)"
          }}>
          <Zap size={20} color="white" />
          </div>
          <div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>Sigi Ride Admin</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
        <p style={{ color: "rgba(148,163,184,0.35)", fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 8px 10px" }}>
          Main Menu
        </p>
        {visibleNav.map((item) => {
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isOpen = openMenus.includes(item.name);
          const isMainActive = active === item.name || item.subItems?.some(s => s.name === active);
          return (
            <div key={item.name} style={{ marginBottom: 4 }}>
              {!hasSubItems ? (
                <Link 
                  to={item.path || "#"} 
                  onClick={() => { setActive(item.name); onClose?.(); }}
                  style={{ textDecoration: 'none' }}
                 >
                  <button
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 12,
                      width: "100%", border: "none", cursor: "pointer",
                      background: isMainActive ? "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))" : "transparent",
                      color: isMainActive ? "#a5b4fc" : "rgba(148,163,184,0.65)",
                      transition: "all 0.2s",
                      textAlign: 'left'
                    }}
                  >
                <item.icon size={16} />
                    <span style={{ fontWeight: isMainActive ? 600 : 400, fontSize: 13.5 }}>{item.name}</span>
                  </button>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 12,
                      width: "100%", border: "none", cursor: "pointer",
                      background: isMainActive ? "rgba(99,102,241,0.08)" : "transparent",
                      color: isMainActive ? "#a5b4fc" : "rgba(148,163,184,0.65)",
                      transition: "all 0.2s",
                      textAlign: 'left'
                    }}
                  >
                  <item.icon size={16} />
                    <span style={{ fontWeight: isMainActive ? 600 : 400, fontSize: 13.5 }}>{item.name}</span>
                    <ChevronDown 
                      size={14} 
                      style={{ 
                        marginLeft: "auto", 
                        transform: isOpen ? "rotate(180deg)" : "rotate(0)", 
                        transition: "transform 0.2s" 
                      }} 
                    />
                  </button>
                  {isOpen && (
                    <div style={{ marginLeft: 32, marginTop: 4, borderLeft: "1px solid rgba(99,102,241,0.2)" }}>
                      {item.subItems?.map((sub) => (
                        <Link 
                          key={sub.name} 
                          to={sub.path} 
                          style={{ textDecoration: 'none' }}
                          onClick={() => { setActive(sub.name); onClose?.(); }}
                        >
                          <div
                            style={{
                              padding: "8px 16px", fontSize: 12.5,
                              color: active === sub.name ? "#a5b4fc" : "rgba(148,163,184,0.5)",
                              fontWeight: active === sub.name ? 600 : 400,
                              cursor: "pointer", transition: '0.2s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#a5b4fc")}
                            onMouseLeave={(e) => { if(active !== sub.name) e.currentTarget.style.color = "rgba(148,163,184,0.5)" }}
                          >
                            {sub.name}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* --- Footer Logout --- */}
      <div style={{ padding: "14px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
         <button onClick={handleLogout} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 10, cursor: "pointer", color: "rgba(248,113,113,0.8)",
          fontSize: 12.5, width: "100%"
        }}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );
}
