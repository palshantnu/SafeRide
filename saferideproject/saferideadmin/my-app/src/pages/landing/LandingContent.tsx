import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Save, RefreshCw, AlertTriangle, CheckCircle2, RotateCcw,
  Sparkles, BarChart3, Megaphone, Plus, X, ExternalLink, ImagePlus,
} from 'lucide-react';
import {
  getLandingSections, createLandingSection, updateLandingSection,
} from '../../services/api';
import {
  DEFAULT_LANDING_CONTENT, sectionsToContent, indexSections,
  contentToSectionFields, SECTION_KEYS, STAT_COLORS,
  type LandingContent, type SectionKey,
} from '../../data/landingContent';
import { compressImage } from '../../utils/image';

// sort_order applied to each managed section
const SECTION_ORDER: Record<SectionKey, number> = { hero: 0, stats: 1, cta: 2 };

// ─── Styles ─────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  card:    { background: 'white', borderRadius: '20px', border: '1.5px solid #eef2f7', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '20px' },
  cardHd:  { display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 22px', borderBottom: '1.5px solid #f1f5f9', background: '#fafbff' },
  cardTtl: { margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' },
  cardSub: { margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' },
  cardBody:{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' },
  field:   { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:   { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input:   { border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#1e293b', width: '100%', boxSizing: 'border-box', background: 'white' },
  iconWrap:{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pill:    { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ede9fe', color: '#6366f1', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 600 },
  saveBtn: { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '7px', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' },
  ghost:   { background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '7px' },
};

const Textarea = (p: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) => (
  <textarea
    value={p.value}
    rows={p.rows ?? 3}
    placeholder={p.placeholder}
    onChange={(e) => p.onChange(e.target.value)}
    style={{ ...s.input, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
  />
);

export default function LandingContentAdmin() {
  const [form, setForm]       = useState<LandingContent>(DEFAULT_LANDING_CONTENT);
  const [baseline, setBaseline] = useState<LandingContent>(DEFAULT_LANDING_CONTENT);
  // existing section row ids per key (undefined → create on save)
  const [ids, setIds]         = useState<Partial<Record<SectionKey, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [ok, setOk]           = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  // hero image upload
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview]     = useState<string | null>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true); setError(null); setOk(null);
    try {
      const res: any = await getLandingSections();
      const payload = res?.data;
      const idx = indexSections(payload);
      setIds({
        hero:  idx[SECTION_KEYS.hero]?.id,
        stats: idx[SECTION_KEYS.stats]?.id,
        cta:   idx[SECTION_KEYS.cta]?.id,
      });
      const content = sectionsToContent(payload);
      setForm(content);
      setBaseline(content);
      setHeroImageFile(null);
      setHeroPreview(null);
    } catch (e: any) {
      setForm(DEFAULT_LANDING_CONTENT);
      setBaseline(DEFAULT_LANDING_CONTENT);
      setError(e?.response?.data?.message || 'Could not load saved sections — showing defaults. You can edit and save.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = <K extends keyof LandingContent>(k: K, v: LandingContent[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setOk(null);
  };

  const setStat = (i: number, key: 'value' | 'label', v: string) =>
    setForm((p) => ({ ...p, stats: p.stats.map((st, idx) => idx === i ? { ...st, [key]: v } : st) }));

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t || form.cta_tags.includes(t)) { setTagDraft(''); return; }
    set('cta_tags', [...form.cta_tags, t]);
    setTagDraft('');
  };
  const removeTag = (t: string) => set('cta_tags', form.cta_tags.filter((x) => x !== t));

  const pickHeroImage = async (f: File | null) => {
    setOk(null);
    if (!f) { setHeroImageFile(null); setHeroPreview(null); return; }
    const compressed = await compressImage(f);   // shrink to avoid 413
    setHeroImageFile(compressed);
    setHeroPreview(URL.createObjectURL(compressed));
  };

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline) || !!heroImageFile,
    [form, baseline, heroImageFile]
  );

  // Build the multipart payload for one section and create or update it.
  const persistSection = async (
    key: SectionKey,
    fields: { title: string | null; subtitle: string | null; content: unknown },
    image?: File | null,
  ) => {
    const fd = new FormData();
    fd.append('section_key', key);
    fd.append('title', fields.title ?? '');
    fd.append('subtitle', fields.subtitle ?? '');
    fd.append('content', JSON.stringify(fields.content));
    fd.append('sort_order', String(SECTION_ORDER[key]));
    fd.append('status', '1');
    if (image) fd.append('image', image);   // backend: uploadLanding.single('image')
    const existingId = ids[key];
    if (existingId) return updateLandingSection(existingId, fd);
    return createLandingSection(fd);
  };

  const handleSave = async () => {
    if (!form.hero_title.trim()) { setError('Hero title is required'); return; }
    setSaving(true); setError(null); setOk(null);
    try {
      const fields = contentToSectionFields(form);
      // run sequentially so newly-created ids are stable; failures surface clearly
      await persistSection(SECTION_KEYS.hero,  fields.hero, heroImageFile);
      await persistSection(SECTION_KEYS.stats, fields.stats);
      await persistSection(SECTION_KEYS.cta,   fields.cta);
      await load();                // refresh ids + baseline + hero image from server
      setOk('Landing page content saved successfully.');
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message || e?.response?.data?.error;
      setError(
        status === 413
          ? 'Image is too large for the server. Please use a smaller image (or raise nginx client_max_body_size).'
          : serverMsg || `Save failed${status ? ` (HTTP ${status})` : ''}. Please try again.`
      );
    } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>🎨 Landing Page Content</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0' }}>
            Edit the public landing page — hero, stats and call-to-action sections.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a href="/" target="_blank" rel="noreferrer" style={{ ...s.ghost, textDecoration: 'none' }}>
            <ExternalLink size={15} /> Preview
          </a>
          <button onClick={load} style={s.ghost} disabled={loading}>
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Reload
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '12px', padding: '11px 14px', fontSize: '13px', marginBottom: '16px' }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {ok && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: '12px', padding: '11px 14px', fontSize: '13px', marginBottom: '16px' }}>
          <CheckCircle2 size={15} /> {ok}
        </div>
      )}

      {loading ? (
        <div style={{ ...s.card, padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '13px', marginTop: '10px' }}>Loading content...</div>
        </div>
      ) : (
        <>
          {/* ── HERO ── */}
          <div style={s.card}>
            <div style={s.cardHd}>
              <div style={{ ...s.iconWrap, background: '#fff0f8' }}><Sparkles size={20} color="#f0047f" /></div>
              <div>
                <h3 style={s.cardTtl}>Hero Section</h3>
                <p style={s.cardSub}>The big headline at the top of the page.</p>
              </div>
            </div>
            <div style={s.cardBody}>
              {/* Hero Image */}
              <div style={s.field}>
                <label style={s.label}>Hero Image</label>
                <input ref={heroFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => pickHeroImage(e.target.files?.[0] ?? null)} />
                {(heroPreview || form.hero_image) ? (
                  <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                    <img src={heroPreview || form.hero_image || ''} alt="hero preview"
                      style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                      <button onClick={() => heroFileRef.current?.click()} title="Replace"
                        style={{ background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', color: '#6366f1' }}><ImagePlus size={15} /></button>
                      <button onClick={() => { pickHeroImage(null); set('hero_image', null); }} title="Remove"
                        style={{ background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', color: '#ef4444' }}><X size={15} /></button>
                    </div>
                    {heroImageFile && (
                      <span style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(99,102,241,0.92)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>New — save to apply</span>
                    )}
                  </div>
                ) : (
                  <button onClick={() => heroFileRef.current?.click()}
                    style={{ border: '1.5px dashed #cbd5e1', borderRadius: '14px', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#fafbff', color: '#64748b', fontSize: '12.5px', fontWeight: 600 }}>
                    <ImagePlus size={24} color="#94a3b8" />
                    Click to upload a hero image
                  </button>
                )}
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>Shown as a banner in the landing hero. Wide images (e.g. 1200×600) work best.</p>
              </div>

              <div style={s.field}>
                <label style={s.label}>Badge Text</label>
                <input style={s.input} value={form.hero_badge} onChange={(e) => set('hero_badge', e.target.value)} placeholder="Platform Live & Operational" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={s.field}>
                  <label style={s.label}>Title — Line 1</label>
                  <input style={s.input} value={form.hero_title} onChange={(e) => set('hero_title', e.target.value)} placeholder="The Command Center" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Title — Highlighted Line</label>
                  <input style={s.input} value={form.hero_highlight} onChange={(e) => set('hero_highlight', e.target.value)} placeholder="for Sigi Ride" />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Subtitle</label>
                <Textarea value={form.hero_subtitle} onChange={(v) => set('hero_subtitle', v)} placeholder="Short paragraph under the title..." />
              </div>
            </div>
          </div>

          {/* ── STATS ── */}
          <div style={s.card}>
            <div style={s.cardHd}>
              <div style={{ ...s.iconWrap, background: '#eff6ff' }}><BarChart3 size={20} color="#1877f2" /></div>
              <div>
                <h3 style={s.cardTtl}>Stats Strip</h3>
                <p style={s.cardSub}>Four highlight numbers shown below the hero.</p>
              </div>
            </div>
            <div style={s.cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '14px' }}>
                {form.stats.map((st, i) => (
                  <div key={i} style={{ border: '1.5px solid #f1f5f9', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: st.color || STAT_COLORS[i % STAT_COLORS.length] }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>Stat {i + 1}</span>
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Value</label>
                      <input style={s.input} value={st.value} onChange={(e) => setStat(i, 'value', e.target.value)} placeholder="10K+" />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Label</label>
                      <input style={s.input} value={st.label} onChange={(e) => setStat(i, 'label', e.target.value)} placeholder="Rides Completed" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div style={s.card}>
            <div style={s.cardHd}>
              <div style={{ ...s.iconWrap, background: '#f0fff0' }}><Megaphone size={20} color="#5cb85c" /></div>
              <div>
                <h3 style={s.cardTtl}>Call To Action</h3>
                <p style={s.cardSub}>The colored banner near the bottom of the page.</p>
              </div>
            </div>
            <div style={s.cardBody}>
              <div style={s.field}>
                <label style={s.label}>Title</label>
                <input style={s.input} value={form.cta_title} onChange={(e) => set('cta_title', e.target.value)} placeholder="Ready to Take Control?" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Subtitle</label>
                <Textarea value={form.cta_subtitle} onChange={(v) => set('cta_subtitle', v)} rows={2} placeholder="Short supporting line..." />
              </div>
              <div style={s.field}>
                <label style={s.label}>Feature Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                  {form.cta_tags.map((t) => (
                    <span key={t} style={s.pill}>
                      {t}
                      <X size={13} style={{ cursor: 'pointer' }} onClick={() => removeTag(t)} />
                    </span>
                  ))}
                  {form.cta_tags.length === 0 && <span style={{ fontSize: '12px', color: '#94a3b8' }}>No tags yet.</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    style={s.input}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Add a tag and press Enter"
                  />
                  <button onClick={addTag} style={{ ...s.ghost, padding: '10px 14px' }}><Plus size={15} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sticky Save Bar ── */}
          <div style={{ position: 'sticky', bottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'white', border: '1.5px solid #eef2f7', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 8px 28px rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setForm(DEFAULT_LANDING_CONTENT); setOk(null); setError(null); }}
              style={{ ...s.ghost }}
            >
              <RotateCcw size={15} /> Reset to defaults
            </button>
            <button onClick={handleSave} disabled={saving || !dirty} style={{ ...s.saveBtn, opacity: (saving || !dirty) ? 0.6 : 1, cursor: (saving || !dirty) ? 'not-allowed' : 'pointer' }}>
              {saving
                ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                : <><Save size={14} /> Save Changes</>}
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin   { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        textarea:focus, input:focus { border-color: #c7d2fe !important; }
      `}</style>
    </div>
  );
}
