import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLandingPage, submitContact } from '../services/api';
import { parseBlocks, blocksForPage, PAGES, PAGE_LABELS, DEFAULT_BRAND, type Block, type PageKey } from '../data/siteBlocks';
import BlockRenderer from './BlockRenderer';

const PINK = '#f0047f', BLUE = '#1877f2';

// ── shared fetch (cached across page navigations) ───────────────────────────
let _cache: Block[] | null = null;
function useSiteBlocks() {
  const [blocks, setBlocks] = useState<Block[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);
  useEffect(() => {
    let alive = true;
    if (_cache) return;
    getLandingPage()
      .then(res => { if (alive) { _cache = parseBlocks(res?.data); setBlocks(_cache); } })
      .catch(() => { if (alive) setBlocks([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return { blocks, loading };
}

// ── Nav ─────────────────────────────────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false);
  const links = PAGES.map(p => ({ to: p === 'home' ? '/' : `/${p}`, label: PAGE_LABELS[p] }));
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(12px)', borderBottom: '2px solid #fce4f3', boxShadow: '0 2px 16px rgba(240,4,127,.08)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 5%', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt={DEFAULT_BRAND.name} style={{ height: 40 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontSize: 19, fontWeight: 900, background: `linear-gradient(135deg,${PINK},${BLUE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{DEFAULT_BRAND.name}</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="site-links" style={{ display: 'flex', gap: 4 }}>
            {links.map(l => (
              <Link key={l.to} to={l.to} style={{ padding: '8px 14px', borderRadius: 10, color: '#334155', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>{l.label}</Link>
            ))}
          </div>
          <button onClick={() => setOpen(o => !o)} className="site-burger" style={{ display: 'none', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>☰</button>
        </div>
      </div>
      {open && (
        <div className="site-mobile" style={{ padding: '8px 5% 14px', display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid #fce4f3' }}>
          {links.map(l => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} style={{ padding: '10px 8px', color: '#334155', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>{l.label}</Link>)}
        </div>
      )}
      <style>{`@media(max-width:720px){.site-links{display:none!important}.site-burger{display:block!important}}`}</style>
    </nav>
  );
}

// ── Footer (contact info from a 'contact' block if present) ──────────────────
function Footer({ blocks }: { blocks: Block[] }) {
  const contact = blocks.find(b => b.type === 'contact' && b.status === 1)?.data;
  const phone = contact?.phone || DEFAULT_BRAND.phone;
  const email = contact?.email || DEFAULT_BRAND.email;
  const address = contact?.address || DEFAULT_BRAND.address;
  return (
    <footer style={{ background: '#0f172a', color: '#cbd5e1', padding: '44px 5% 28px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 28 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{DEFAULT_BRAND.name}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#94a3b8' }}>{DEFAULT_BRAND.tagline}</div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>Pages</div>
          {PAGES.map(p => <div key={p}><Link to={p === 'home' ? '/' : `/${p}`} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, lineHeight: 2 }}>{PAGE_LABELS[p]}</Link></div>)}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>Contact</div>
          <div style={{ fontSize: 13, lineHeight: 2, color: '#94a3b8' }}>{phone}</div>
          <div style={{ fontSize: 13, lineHeight: 2, color: '#94a3b8' }}>{email}</div>
          <div style={{ fontSize: 13, lineHeight: 2, color: '#94a3b8' }}>{address}</div>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: '28px auto 0', paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>© {new Date().getFullYear()} {DEFAULT_BRAND.name}. All rights reserved.</span>
        <a href="/privacy-policy.html" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>Privacy Policy</a>
      </div>
    </footer>
  );
}

// ── Contact form ─────────────────────────────────────────────────────────────
function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) { setError('Name and message are required.'); return; }
    setSending(true); setError(null);
    try {
      const res: any = await submitContact(form);
      if (res?.data?.status === false) setError(res.data.message || 'Failed to send.');
      else { setDone(true); setForm({ name: '', email: '', phone: '', subject: '', message: '' }); }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send. Please try again.');
    } finally { setSending(false); }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' };

  return (
    <section style={{ padding: '20px 0 64px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 5%' }}>
        <div style={{ background: '#fff', border: '1.5px solid #eef2f7', borderRadius: 22, padding: 28, boxShadow: '0 8px 30px rgba(0,0,0,.05)' }}>
          <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>Send us a message</h3>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 20px' }}>We'll get back to you as soon as possible.</p>
          {done ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 12, padding: '16px', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
              ✓ Thanks! Your message has been sent.
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {error && <div style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input style={inp} placeholder="Your name *" value={form.name} onChange={e => set('name', e.target.value)} />
                <input style={inp} placeholder="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <input style={inp} type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} />
              <input style={inp} placeholder="Subject" value={form.subject} onChange={e => set('subject', e.target.value)} />
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 120, fontFamily: 'inherit', lineHeight: 1.6 }} placeholder="Your message *" value={form.message} onChange={e => set('message', e.target.value)} />
              <button type="submit" disabled={sending} style={{ background: `linear-gradient(135deg,${PINK},#e879f9)`, color: '#fff', border: 'none', padding: '13px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, boxShadow: '0 8px 24px rgba(240,4,127,.3)' }}>
                {sending ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SitePage({ page }: { page: PageKey }) {
  const { blocks, loading } = useSiteBlocks();
  const pageBlocks = useMemo(() => blocksForPage(blocks, page, true), [blocks, page]);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Inter',-apple-system,sans-serif", color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      <main style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: '120px 20px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : pageBlocks.length === 0 ? (
          <div style={{ padding: '110px 20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>{PAGE_LABELS[page]}</h1>
            <p style={{ color: '#94a3b8', marginTop: 8 }}>This page has no content yet. Add blocks from the admin Website Builder.</p>
          </div>
        ) : (
          pageBlocks.map(b => <BlockRenderer key={b.id} block={b} />)
        )}
        {page === 'contact' && <ContactForm />}
      </main>
      <Footer blocks={blocks} />
    </div>
  );
}
