import { useEffect, useRef, useState } from 'react';
import type { Block, CardItem, StatItem, StepItem } from '../data/siteBlocks';
import { DEFAULT_BRAND } from '../data/siteBlocks';

const PINK = '#f0047f', BLUE = '#1877f2', GREEN = '#5cb85c';
const STAT_COLORS = [PINK, BLUE, GREEN];

const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 5%' };
const heading: React.CSSProperties = { fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, letterSpacing: '-.5px', color: '#0f172a', margin: '0 0 12px' };
const sub: React.CSSProperties = { color: '#64748b', fontSize: 16, lineHeight: 1.7, margin: 0 };

// ── Truncates long text to N lines with a Read more / Read less toggle ───────
function ExpandableText({ children, lines = 4, style, toggleColor = PINK }: {
  children: React.ReactNode; lines?: number; style?: React.CSSProperties; toggleColor?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clampable, setClampable] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setClampable(el.scrollHeight - 1 > el.clientHeight);
  }, [children]);

  return (
    <div>
      <div
        ref={ref}
        style={{
          ...style,
          ...(expanded ? null : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}
      >
        {children}
      </div>
      {clampable && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', padding: '6px 0 0', margin: 0, cursor: 'pointer', color: toggleColor, fontSize: 13.5, fontWeight: 700 }}
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function Btn({ text, link }: { text?: string; link?: string }) {
  if (!text) return null;
  return (
    <a href={link || '#'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg,${PINK},#e879f9)`, color: '#fff', padding: '13px 30px', borderRadius: 14, fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: '0 8px 24px rgba(240,4,127,.3)' }}>
      {text} →
    </a>
  );
}

export default function BlockRenderer({ block }: { block: Block }) {
  const { type, title, subtitle, image_url, data } = block;

  if (type === 'hero') {
    const split = !!image_url;
    return (
      <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,#fff5fb 0%,#f0f7ff 55%,#f0fff4 100%)', padding: '76px 0 84px' }}>
        {/* decorative blobs */}
        <div aria-hidden style={{ position: 'absolute', width: 440, height: 440, borderRadius: '50%', background: 'rgba(240,4,127,.07)', top: -150, left: -100, pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'rgba(24,119,242,.07)', bottom: -160, right: -110, pointerEvents: 'none' }} />

        <div className="hero-grid" style={{ ...wrap, position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: split ? '1.05fr .95fr' : '1fr', gap: 48, alignItems: 'center' }}>
          <div className="hero-text" style={{ textAlign: split ? 'left' : 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1.5px solid #fbcfe8', borderRadius: 999, padding: '6px 15px', fontSize: 12.5, fontWeight: 700, color: PINK, boxShadow: '0 2px 10px rgba(240,4,127,.1)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, display: 'inline-block' }} /> {DEFAULT_BRAND.name}
            </span>
            <h1 style={{ fontSize: 'clamp(34px,5.2vw,58px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-1.6px', color: '#0f172a', margin: '18px 0 18px' }}>{title}</h1>
            {subtitle && <p style={{ ...sub, fontSize: 'clamp(15px,1.6vw,18px)', maxWidth: 560, margin: split ? '0 0 30px' : '0 auto 30px' }}>{subtitle}</p>}
            <div className="hero-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: split ? 'flex-start' : 'center' }}>
              <Btn text={data.buttonText} link={data.buttonLink} />
              <a href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: BLUE, border: '2px solid #bfdbfe', padding: '11px 26px', borderRadius: 14, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>Contact Us</a>
            </div>
          </div>

          {split && (
            <div className="hero-img" style={{ position: 'relative' }}>
              <div aria-hidden style={{ position: 'absolute', inset: -14, borderRadius: 32, background: `linear-gradient(135deg,${PINK}22,${BLUE}22)`, filter: 'blur(24px)' }} />
              <img src={image_url} alt={title} style={{ position: 'relative', width: '100%', borderRadius: 24, border: '1px solid rgba(240,4,127,.08)', boxShadow: '0 30px 80px rgba(24,119,242,.22)', display: 'block' }} />
            </div>
          )}
        </div>

        <style>{`@media(max-width:820px){
          .hero-grid{grid-template-columns:1fr!important;gap:32px!important}
          .hero-text{text-align:center!important}
          .hero-text p{margin-left:auto!important;margin-right:auto!important}
          .hero-actions{justify-content:center!important}
          .hero-img{max-width:520px;margin:0 auto}
        }`}</style>
      </section>
    );
  }

  if (type === 'richtext') {
    return (
      <section style={{ padding: '56px 0' }}>
        <div style={{ ...wrap, maxWidth: 820 }}>
          {title && <h2 style={heading}>{title}</h2>}
          {subtitle && <p style={{ ...sub, marginBottom: 16 }}>{subtitle}</p>}
          {data.body && (
            <ExpandableText lines={4} style={{ color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
              {data.body.split(/\n\n+/).map((para, i) => <p key={i} style={{ margin: '0 0 14px' }}>{para}</p>)}
            </ExpandableText>
          )}
        </div>
      </section>
    );
  }

  if (type === 'cards') {
    const items = (data.items as CardItem[]) || [];
    const cols = data.columns || 3;
    return (
      <section style={{ padding: '56px 0', background: '#f8fafc' }}>
        <div style={wrap}>
          {(title || subtitle) && (
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              {title && <h2 style={heading}>{title}</h2>}
              {subtitle && <p style={{ ...sub, maxWidth: 620, margin: '0 auto' }}>{subtitle}</p>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${Math.max(220, Math.floor(960 / cols))}px,1fr))`, gap: 24 }}>
            {items.map((it, i) => (
              <div key={i} style={{ background: '#fff', border: '1.5px solid #eef2f7', borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 18px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column' }}>
                {it.image_url && (
                  <div style={{ width: '100%', aspectRatio: '16 / 10', background: '#f1f5f9', overflow: 'hidden' }}>
                    <img src={it.image_url} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
                <div style={{ padding: 22 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{it.title}</div>
                  {it.desc && (
                    <ExpandableText lines={4} style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65 }}>
                      {it.desc}
                    </ExpandableText>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === 'stats') {
    const items = (data.items as StatItem[]) || [];
    return (
      <section style={{ padding: '48px 0', background: '#fff' }}>
        <div style={{ ...wrap, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: '#fafafa', border: '2px solid #f1f5f9', borderRadius: 18, padding: '26px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(28px,5vw,42px)', fontWeight: 900, color: STAT_COLORS[i % 3], lineHeight: 1 }}>{it.value}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, fontWeight: 600 }}>{it.label}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (type === 'steps') {
    const items = (data.items as StepItem[]) || [];
    return (
      <section style={{ padding: '56px 0' }}>
        <div style={wrap}>
          {(title || subtitle) && (
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              {title && <h2 style={heading}>{title}</h2>}
              {subtitle && <p style={{ ...sub, maxWidth: 620, margin: '0 auto' }}>{subtitle}</p>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
            {items.map((it, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 18, background: `${STAT_COLORS[i % 3]}1a`, border: `2px solid ${STAT_COLORS[i % 3]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STAT_COLORS[i % 3], fontWeight: 900, fontSize: 20 }}>{i + 1}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{it.title}</div>
                {it.desc && <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65, maxWidth: 260, margin: '0 auto' }}>{it.desc}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === 'cta') {
    return (
      <section style={{ padding: '56px 0' }}>
        <div style={wrap}>
          <div style={{ background: `linear-gradient(135deg,${PINK} 0%,#e879f9 40%,${BLUE} 100%)`, borderRadius: 28, padding: '52px 32px', textAlign: 'center', boxShadow: '0 20px 60px rgba(240,4,127,.25)' }}>
            <h3 style={{ fontSize: 'clamp(22px,4vw,36px)', fontWeight: 900, color: '#fff', margin: '0 0 12px' }}>{title}</h3>
            {subtitle && <p style={{ color: 'rgba(255,255,255,.85)', fontSize: 16, maxWidth: 480, margin: '0 auto 26px', lineHeight: 1.7 }}>{subtitle}</p>}
            {data.buttonText && (
              <a href={data.buttonLink || '#'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: PINK, padding: '13px 34px', borderRadius: 14, fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: '0 6px 24px rgba(0,0,0,.15)' }}>{data.buttonText} →</a>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (type === 'contact') {
    const rows = [
      { k: 'Phone', v: data.phone }, { k: 'Email', v: data.email },
      { k: 'Address', v: data.address }, { k: 'Hours', v: data.hours },
    ].filter(r => r.v);
    return (
      <section style={{ padding: '48px 0' }}>
        <div style={wrap}>
          {title && <h2 style={{ ...heading, textAlign: 'center' }}>{title}</h2>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginTop: 20 }}>
            {rows.map(r => (
              <div key={r.k} style={{ background: '#fff', border: '1.5px solid #eef2f7', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: PINK, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{r.k}</div>
                <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 600 }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return null;
}
