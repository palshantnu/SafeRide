import { useNavigate } from "react-router-dom";
import { Zap, ArrowLeft, Shield, Eye, Lock, Database, Bell, UserCheck, Globe, Mail } from "lucide-react";

const sections = [
  {
    icon: Eye,
    title: "Information We Collect",
    content: [
      {
        subtitle: "Personal Information",
        text: "When you register on Sigi Ride, we collect your name, phone number, email address, and profile photo. Drivers additionally provide vehicle details, driving license, and government-issued identity documents.",
      },
      {
        subtitle: "Location Data",
        text: "To provide ride services, we collect real-time GPS location data from both riders and drivers during a trip. We may also collect your location when the app is in the background if you have granted permission.",
      },
      {
        subtitle: "Transaction & Payment Data",
        text: "We collect payment information including transaction history, wallet balance, and withdrawal records. Payment card details are processed by our secure payment partners and are not stored on our servers.",
      },
      {
        subtitle: "Device & Usage Data",
        text: "We collect device identifiers, operating system version, app version, IP address, and usage patterns to improve app performance and user experience.",
      },
    ],
  },
  {
    icon: Database,
    title: "How We Use Your Information",
    content: [
      {
        subtitle: "Service Delivery",
        text: "Your information is used to match riders with drivers, process payments, send booking confirmations and receipts, and provide customer support.",
      },
      {
        subtitle: "Safety & Security",
        text: "We use your data to verify driver identity and documents, detect fraudulent activity, resolve disputes, and ensure the safety of all platform users.",
      },
      {
        subtitle: "Platform Improvement",
        text: "Aggregated, anonymized data helps us analyze ride patterns, optimize routing, improve features, and develop new services tailored to your needs.",
      },
      {
        subtitle: "Communications",
        text: "We may send you ride updates, promotional offers, safety alerts, and important policy changes via SMS, email, or push notifications.",
      },
    ],
  },
  {
    icon: Globe,
    title: "Information Sharing",
    content: [
      {
        subtitle: "Between Riders & Drivers",
        text: "When a booking is made, limited information (name, photo, vehicle details, and phone number) is shared between the rider and driver to facilitate the trip.",
      },
      {
        subtitle: "Business Associates",
        text: "Authorized business associates on our platform may access driver performance data within their operational scope as per their agreement with Sigi Ride.",
      },
      {
        subtitle: "Legal Requirements",
        text: "We may disclose your information to comply with applicable laws, respond to lawful requests from government authorities, or protect the rights and safety of our users.",
      },
      {
        subtitle: "We Do Not Sell Your Data",
        text: "Sigi Ride does not sell, rent, or trade your personal information to third parties for their marketing purposes.",
      },
    ],
  },
  {
    icon: Lock,
    title: "Data Security",
    content: [
      {
        subtitle: "Encryption",
        text: "All data transmitted between your device and our servers is encrypted using industry-standard TLS/SSL protocols. Sensitive data at rest is encrypted using AES-256 encryption.",
      },
      {
        subtitle: "Access Controls",
        text: "Access to personal data within our organization is restricted on a need-to-know basis. All employees with data access undergo background checks and security training.",
      },
      {
        subtitle: "Incident Response",
        text: "In the unlikely event of a data breach, we will notify affected users and relevant authorities within the timeframe required by applicable law.",
      },
    ],
  },
  {
    icon: UserCheck,
    title: "Your Rights & Choices",
    content: [
      {
        subtitle: "Access & Correction",
        text: "You can view and update your personal information at any time through the Sigi Ride app under Profile Settings.",
      },
      {
        subtitle: "Data Deletion",
        text: "You may request deletion of your account and associated data by contacting us at privacy@sigiride.com. Certain data may be retained for legal or regulatory compliance purposes.",
      },
      {
        subtitle: "Opt-Out",
        text: "You can opt out of marketing communications at any time by updating your notification preferences in the app or clicking 'unsubscribe' in any email we send.",
      },
      {
        subtitle: "Location Permissions",
        text: "You can revoke location permissions at any time through your device settings, though this may affect the functionality of the app.",
      },
    ],
  },
  {
    icon: Bell,
    title: "Cookies & Tracking",
    content: [
      {
        subtitle: "Cookies",
        text: "Our web platform uses cookies and similar tracking technologies to remember your preferences, analyze traffic, and improve your experience. You can control cookie settings through your browser.",
      },
      {
        subtitle: "Analytics",
        text: "We use analytics tools to understand how users interact with our platform. This data is anonymized and used solely to improve our services.",
      },
    ],
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#060d1f", color: "white", fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)", background: "rgba(6,13,31,0.9)", borderBottom: "1px solid rgba(99,102,241,0.15)", padding: "0 5%" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={17} color="white" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, background: "linear-gradient(90deg,#a5b4fc,#e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Sigi Ride
            </span>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "7px 16px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg,rgba(99,102,241,0.07) 0%,transparent 100%)", borderBottom: "1px solid rgba(99,102,241,0.1)", padding: "56px 5% 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "#a5b4fc", marginBottom: 20 }}>
            <Shield size={12} /> Privacy & Data Protection
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, margin: "0 0 14px", letterSpacing: "-0.5px" }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 15, color: "rgba(148,163,184,0.75)", maxWidth: 560, lineHeight: 1.7, margin: "0 0 18px" }}>
            We are committed to protecting your privacy and being transparent about how we collect, use, and safeguard your personal information.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "rgba(148,163,184,0.55)" }}>
            <span>Effective Date: <b style={{ color: "rgba(148,163,184,0.8)" }}>January 1, 2025</b></span>
            <span>·</span>
            <span>Last Updated: <b style={{ color: "rgba(148,163,184,0.8)" }}>June 1, 2026</b></span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 5% 80px", display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 32 }}>

        {/* Intro Box */}
        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 18, padding: "24px 28px" }}>
          <p style={{ fontSize: 14, color: "rgba(148,163,184,0.8)", lineHeight: 1.8, margin: 0 }}>
            This Privacy Policy applies to Sigi Ride's mobile application, website at{" "}
            <a href="https://sigiride.com" style={{ color: "#a5b4fc", textDecoration: "none" }}>sigiride.com</a>,
            and all related services (collectively, the "Platform"). By using our Platform, you agree to the collection and use of information in accordance with this policy. Please read it carefully before using our services.
          </p>
        </div>

        {/* Sections */}
        {sections.map((section, idx) => (
          <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(99,102,241,0.1)", borderRadius: 20, overflow: "hidden" }}>
            {/* Section Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 28px", borderBottom: "1px solid rgba(99,102,241,0.1)", background: "rgba(99,102,241,0.04)" }}>
              <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <section.icon size={18} color="#a5b4fc" />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                {idx + 1}. {section.title}
              </h2>
            </div>

            {/* Section Body */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
              {section.content.map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {item.subtitle}
                  </div>
                  <p style={{ fontSize: 14, color: "rgba(148,163,184,0.75)", lineHeight: 1.75, margin: 0 }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Children's Privacy */}
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 18, padding: "24px 28px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
            ⚠ Children's Privacy
          </h2>
          <p style={{ fontSize: 14, color: "rgba(148,163,184,0.75)", lineHeight: 1.75, margin: 0 }}>
            Sigi Ride services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us personal data, please contact us immediately at{" "}
            <a href="mailto:privacy@sigiride.com" style={{ color: "#fbbf24", textDecoration: "none" }}>privacy@sigiride.com</a>{" "}
            and we will take steps to delete that information.
          </p>
        </div>

        {/* Policy Updates */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(99,102,241,0.1)", borderRadius: 18, padding: "24px 28px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>Changes to This Policy</h2>
          <p style={{ fontSize: 14, color: "rgba(148,163,184,0.75)", lineHeight: 1.75, margin: 0 }}>
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of significant changes via the app or email. Continued use of the Platform after changes constitutes acceptance of the updated policy. We encourage you to review this page periodically.
          </p>
        </div>

        {/* Contact */}
        <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.05))", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, padding: "32px 28px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Mail size={20} color="white" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>Contact Us</h2>
          <p style={{ fontSize: 14, color: "rgba(148,163,184,0.7)", lineHeight: 1.7, margin: "0 0 20px", maxWidth: 480, marginInline: "auto" }}>
            If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please reach out to our Data Protection team.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:privacy@sigiride.com" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", padding: "10px 24px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              privacy@sigiride.com
            </a>
            <a href="https://sigiride.com" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", padding: "10px 24px", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              sigiride.com
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(99,102,241,0.1)", padding: "22px 5%", textAlign: "center", color: "rgba(148,163,184,0.4)", fontSize: 12 }}>
        © {new Date().getFullYear()} Sigi Ride. All rights reserved. &nbsp;·&nbsp;
        <a href="/privacy-policy" style={{ color: "rgba(148,163,184,0.5)", textDecoration: "none" }}>Privacy Policy</a>
      </footer>
    </div>
  );
}
