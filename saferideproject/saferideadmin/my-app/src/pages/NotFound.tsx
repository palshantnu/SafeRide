import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Ban, Compass } from 'lucide-react';

/**
 * Shown for unknown routes AND when a user lacks permission to view a page.
 * `reason="forbidden"` tweaks the copy for the no-access case.
 */
export default function NotFound({ reason = 'notfound' }: { reason?: 'notfound' | 'forbidden' }) {
  const navigate = useNavigate();
  const forbidden = reason === 'forbidden';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f8fafc,#eef2ff)', padding: 24, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ width: 96, height: 96, margin: '0 auto 24px', borderRadius: 28, background: forbidden ? '#fff1f2' : '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(99,102,241,0.15)' }}>
          {forbidden ? <Ban size={44} color="#ef4444" /> : <Compass size={44} color="#6366f1" />}
        </div>

        <h1 style={{ fontSize: 72, fontWeight: 900, margin: 0, lineHeight: 1, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {forbidden ? '403' : '404'}
        </h1>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '10px 0 8px' }}>
          {forbidden ? 'Access Denied' : 'Page Not Found'}
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: '0 0 28px' }}>
          {forbidden
            ? "You don't have permission to view this page. Contact your administrator if you think this is a mistake."
            : "The page you're looking for doesn't exist or may have been moved."}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <ArrowLeft size={16} /> Go Back
          </button>
          <button onClick={() => navigate('/dashboard')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
            <Home size={16} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
