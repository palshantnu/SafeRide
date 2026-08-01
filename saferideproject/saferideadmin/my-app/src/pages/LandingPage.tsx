import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Users, Shield, BarChart3, MapPin, ArrowRight, CheckCircle, Zap, Bell, LogIn, MousePointerClick, Gauge } from "lucide-react";
import { getLandingPage } from "../services/api";
import { DEFAULT_LANDING_CONTENT, sectionsToContent } from "../data/landingContent";

const PINK  = "#f0047f";
const BLUE  = "#1877f2";
const GREEN = "#5cb85c";

const features = [
  { icon: Car,       title: "Fleet Management",   desc: "Real-time tracking and full control of your entire captain fleet.",  color: PINK,  bg: "#fff0f8", border: "#fbb6e2" },
  { icon: Users,     title: "User & Driver Hub",  desc: "Manage riders, captains, and business associates in one place.",     color: BLUE,  bg: "#eff6ff", border: "#bfdbfe" },
  { icon: BarChart3, title: "Booking Analytics",  desc: "Deep insights into bookings, revenue, and service performance.",     color: GREEN, bg: "#f0fff0", border: "#bbf7bb" },
  { icon: MapPin,    title: "Location Services",  desc: "State and city management for precise service zone coverage.",       color: PINK,  bg: "#fff0f8", border: "#fbb6e2" },
  { icon: Shield,    title: "Role & Permissions", desc: "Granular access control for every staff member on your platform.",  color: BLUE,  bg: "#eff6ff", border: "#bfdbfe" },
  { icon: Bell,      title: "Real-time Alerts",   desc: "Instant notifications for withdrawals, rides, and key events.",     color: GREEN, bg: "#f0fff0", border: "#bbf7bb" },
];

const steps = [
  { icon: LogIn,             title: "Sign In Securely",  desc: "Access your admin panel with role-based authentication.", color: PINK  },
  { icon: MousePointerClick, title: "Manage Operations", desc: "Control captains, bookings, services, and zones in real time.", color: BLUE  },
  { icon: Gauge,             title: "Track & Grow",      desc: "Monitor analytics and revenue to scale with confidence.", color: GREEN },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState(DEFAULT_LANDING_CONTENT);

  useEffect(() => {
    let alive = true;
    getLandingPage()
      .then((res) => {
        if (alive) setContent(sectionsToContent(res?.data));
      })
      .catch(() => { });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const s: Record<string, React.CSSProperties> = {
    page:    { minHeight: "100vh", background: "#fff", color: "#1e293b", fontFamily: "'Inter',-apple-system,sans-serif" },
    // nav
    nav:     { background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderBottom: "2px solid #fce4f3", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(240,4,127,.08)" },
    navWrap: { maxWidth: 1200, margin: "0 auto", padding: "0 5%", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" },
    navBtn:  { background: `linear-gradient(135deg,${PINK},#e879f9)`, color: "white", border: "none", padding: "10px 24px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(240,4,127,.3)" },
  };

  const lift = (e: React.MouseEvent, y: number, shadow: string) => {
    const t = e.currentTarget as HTMLElement;
    t.style.transform = `translateY(${y}px)`;
    t.style.boxShadow = shadow;
  };

  return (
    <div style={s.page}>

      {/* ══ NAV ══ */}
      <nav style={s.nav}>
        <div style={s.navWrap}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo.png"
              alt="Sigi Ride"
              style={{ height: 46, width: "auto" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span style={{ fontSize: 20, fontWeight: 900, background: `linear-gradient(135deg,${PINK},${BLUE})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Sigi Ride
            </span>
          </div>
          <button
            onClick={() => navigate("/login")}
            style={s.navBtn}
            onMouseEnter={(e) => lift(e, -2, "0 8px 22px rgba(240,4,127,.42)")}
            onMouseLeave={(e) => lift(e, 0, "0 4px 16px rgba(240,4,127,.3)")}
          >
            Admin Login <ArrowRight size={15} />
          </button>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{ background: "linear-gradient(135deg,#fff5fb 0%,#f0f7ff 50%,#f0fff4 100%)", padding: "80px 5% 90px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* blobs */}
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "rgba(240,4,127,.06)", top: -120, left: -80, pointerEvents: "none", animation: "drift 14s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "rgba(24,119,242,.06)", bottom: -80, right: -60, pointerEvents: "none", animation: "drift 18s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(92,184,92,.06)", top: "30%", right: "10%", pointerEvents: "none", animation: "drift 11s ease-in-out infinite" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
          {/* Logo big */}
          <img
            src="/logo.png"
            alt="Sigi Ride"
            style={{ height: 110, width: "auto", marginBottom: 28, filter: "drop-shadow(0 8px 24px rgba(240,4,127,.2))", animation: "float 4s ease-in-out infinite" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />

          {/* chip */}
          <div className="fu" style={{ animationDelay: ".05s", display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: `2px solid #fbb6e2`, borderRadius: 999, padding: "6px 18px", fontSize: 12, fontWeight: 700, color: PINK, marginBottom: 24, boxShadow: "0 2px 12px rgba(240,4,127,.12)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: PINK, display: "inline-block", animation: "blink 2s infinite" }} />
            {content.hero_badge}
          </div>

          <h1 className="fu" style={{ animationDelay: ".12s", fontSize: "clamp(36px,6vw,68px)", fontWeight: 900, lineHeight: 1.08, margin: "0 0 20px", letterSpacing: "-1.5px" }}>
            {content.hero_title}{" "}
            <br />
            <span style={{ background: `linear-gradient(135deg,${PINK} 0%,${BLUE} 50%,${GREEN} 100%)`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shine 6s linear infinite" }}>
              {content.hero_highlight}
            </span>
          </h1>

          <p className="fu" style={{ animationDelay: ".2s", fontSize: "clamp(15px,2.5vw,19px)", color: "#64748b", maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.75 }}>
            {content.hero_subtitle}
          </p>

          <div className="fu" style={{ animationDelay: ".28s", display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/login")}
              style={{ background: `linear-gradient(135deg,${PINK},#e879f9)`, color: "white", border: "none", padding: "14px 36px", borderRadius: 16, cursor: "pointer", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 28px rgba(240,4,127,.32)", transition: "transform .2s, box-shadow .2s" }}
              onMouseEnter={(e) => lift(e, -3, "0 14px 36px rgba(240,4,127,.45)")}
              onMouseLeave={(e) => lift(e, 0, "0 8px 28px rgba(240,4,127,.32)")}
            >
              Go to Dashboard <ArrowRight size={16} />
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              style={{ background: "#fff", color: BLUE, border: `2px solid #bfdbfe`, padding: "14px 30px", borderRadius: 16, cursor: "pointer", fontSize: 15, fontWeight: 700, boxShadow: "0 2px 12px rgba(24,119,242,.1)", transition: "transform .2s, box-shadow .2s" }}
              onMouseEnter={(e) => lift(e, -3, "0 10px 26px rgba(24,119,242,.2)")}
              onMouseLeave={(e) => lift(e, 0, "0 2px 12px rgba(24,119,242,.1)")}
            >
              Explore Features
            </button>
          </div>

          {/* Hero image (admin-managed) */}
          {content.hero_image && (
            <div className="fu" style={{ animationDelay: ".36s", marginTop: 52 }}>
              <img
                src={content.hero_image}
                alt="Sigi Ride"
                style={{ width: "100%", maxWidth: 920, borderRadius: 24, border: "1px solid rgba(240,4,127,.12)", boxShadow: "0 24px 70px rgba(24,119,242,.18)", objectFit: "cover", display: "block", margin: "0 auto" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section style={{ background: "#fff", borderBottom: "2px solid #f1f5f9", padding: "48px 5%" }}>
        <div data-reveal className="reveal" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16 }}>
          {content.stats.map((st, i) => (
            <div key={`${st.label}-${i}`} style={{ background: "#fafafa", border: "2px solid #f1f5f9", borderRadius: 18, padding: "28px 20px", textAlign: "center", transition: "transform .2s, box-shadow .2s" }}
              onMouseEnter={e => lift(e, -4, "0 10px 26px rgba(0,0,0,.08)")}
              onMouseLeave={e => lift(e, 0, "none")}
            >
              <div style={{ fontSize: "clamp(30px,5vw,44px)", fontWeight: 900, color: st.color, lineHeight: 1 }}>{st.value}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8, fontWeight: 600 }}>{st.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" style={{ background: "linear-gradient(180deg,#fff 0%,#f8fafc 100%)", padding: "72px 5% 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div data-reveal className="reveal" style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#f0fff0", border: `2px solid ${GREEN}40`, borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 16 }}>
              <Zap size={12} /> Built for Operators
            </div>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, margin: "0 0 12px", letterSpacing: "-.5px" }}>Everything You Need</h2>
            <p style={{ color: "#94a3b8", fontSize: 16, fontWeight: 500 }}>A complete admin toolkit built for scale and speed.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
            {features.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                className="reveal"
                style={{ transitionDelay: `${i * 60}ms`, background: "#fff", border: `2px solid ${f.border}`, borderRadius: 20, padding: "28px 24px", cursor: "default", boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}
                onMouseEnter={e => lift(e, -6, `0 16px 36px ${f.color}26`)}
                onMouseLeave={e => lift(e, 0, "0 2px 12px rgba(0,0,0,.04)")}
              >
                <div style={{ width: 50, height: 50, background: f.bg, border: `2px solid ${f.border}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  <f.icon size={22} color={f.color} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section style={{ background: "#fff", padding: "8px 5% 84px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div data-reveal className="reveal" style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#eff6ff", border: `2px solid ${BLUE}33`, borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: BLUE, marginBottom: 16 }}>
              <MousePointerClick size={12} /> Simple by Design
            </div>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, margin: "0 0 12px", letterSpacing: "-.5px" }}>How It Works</h2>
            <p style={{ color: "#94a3b8", fontSize: 16, fontWeight: 500 }}>From login to insights in three easy steps.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24 }}>
            {steps.map((step, i) => (
              <div key={step.title} data-reveal className="reveal" style={{ transitionDelay: `${i * 90}ms`, textAlign: "center", padding: "8px 16px", position: "relative" }}>
                <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 20px", borderRadius: 22, background: `linear-gradient(135deg,${step.color}1a,${step.color}0d)`, border: `2px solid ${step.color}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <step.icon size={28} color={step.color} />
                  <span style={{ position: "absolute", top: -10, right: -10, width: 28, height: 28, borderRadius: "50%", background: step.color, color: "#fff", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${step.color}55` }}>{i + 1}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{step.title}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, maxWidth: 260, margin: "0 auto" }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══ */}
      <section style={{ background: "#fff", padding: "0 5% 90px" }}>
        <div data-reveal className="reveal" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ background: `linear-gradient(135deg,${PINK} 0%,#e879f9 40%,${BLUE} 100%)`, borderRadius: 28, padding: "56px 40px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: "0 20px 60px rgba(240,4,127,.25)" }}>
            {/* blobs */}
            <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,.07)", top: -100, right: -60, pointerEvents: "none", animation: "drift 16s ease-in-out infinite" }} />
            <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.05)", bottom: -60, left: -40, pointerEvents: "none", animation: "drift 13s ease-in-out infinite reverse" }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <img
                src="/logo.png"
                alt="Sigi Ride"
                style={{ height: 70, width: "auto", marginBottom: 20, filter: "brightness(0) invert(1)" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <h3 style={{ fontSize: "clamp(22px,4vw,38px)", fontWeight: 900, color: "#fff", margin: "0 0 12px", letterSpacing: "-.5px" }}>
                {content.cta_title}
              </h3>
              <p style={{ color: "rgba(255,255,255,.8)", fontSize: 16, marginBottom: 28, maxWidth: 480, marginInline: "auto", lineHeight: 1.7 }}>
                {content.cta_subtitle}
              </p>

              {/* tags */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
                {content.cta_tags.map(tag => (
                  <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.18)", border: "1.5px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "6px 16px", fontSize: 12, color: "#fff", fontWeight: 700, backdropFilter: "blur(6px)" }}>
                    <CheckCircle size={12} /> {tag}
                  </span>
                ))}
              </div>

              <button
                onClick={() => navigate("/login")}
                style={{ background: "#fff", color: PINK, border: "none", padding: "14px 38px", borderRadius: 16, cursor: "pointer", fontSize: 15, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 6px 24px rgba(0,0,0,.15)", transition: "transform .2s, box-shadow .2s" }}
                onMouseEnter={(e) => lift(e, -3, "0 12px 32px rgba(0,0,0,.25)")}
                onMouseLeave={(e) => lift(e, 0, "0 6px 24px rgba(0,0,0,.15)")}
              >
                Login to Admin Panel <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: "#0f172a", padding: "36px 5%", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
          <img
            src="/logo.png"
            alt="Sigi Ride"
            style={{ height: 38, width: "auto", filter: "brightness(0) invert(1) opacity(.8)" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
          {[["Privacy Policy", "/privacy-policy.html"], ["Admin Login", "/login"]].map(([label, href]) => (
            <a key={label} href={href} style={{ color: "#64748b", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>{label}</a>
          ))}
        </div>
        <p style={{ color: "#374151", fontSize: 12 }}>© {new Date().getFullYear()} Sigi Ride. All rights reserved.</p>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes drift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(24px,-20px)} }
        @keyframes shine { to { background-position: 200% center; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .fu { opacity:0; animation: fadeUp .7s cubic-bezier(.21,.6,.35,1) forwards; }
        .reveal { opacity:0; transform:translateY(28px); transition: opacity .6s ease, transform .6s cubic-bezier(.21,.6,.35,1); }
        .reveal.in { opacity:1; transform:translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .fu, .reveal { opacity:1 !important; transform:none !important; animation:none !important; }
          [style*="animation"] { animation:none !important; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
