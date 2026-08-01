import { useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

interface AdminLayoutProps {
  children: ReactNode;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export default function AdminLayout({ children, searchQuery, setSearchQuery }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");

  return (
    <>
      <style>
        {`
        * { box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; }
          body { margin: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}
      </style>

      <div className="admin-shell" style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f4f6fb" }}>
        <div className="admin-sidebar-desktop" style={{ width: 256, height: "100vh", flexShrink: 0, overflowY: "auto" }}>
          <Sidebar active={active} setActive={setActive} />
        </div>
        {sidebarOpen && (
          <div className="admin-sidebar-overlay" style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex" }}>
            <div
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <Sidebar active={active} setActive={setActive} onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflowY: "auto" }}>
          <Navbar
            onMenuClick={() => setSidebarOpen(true)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          <main className="admin-main" style={{ padding: "24px", flex: 1 }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
