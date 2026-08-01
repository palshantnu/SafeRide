import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Plus, Edit2, Trash2, X, Save, RefreshCw, ChevronUp, ChevronDown,
  Eye, EyeOff, ImagePlus, GripVertical, ExternalLink,
} from 'lucide-react';
import {
  getLandingSections, createLandingSection, updateLandingSection,
  deleteLandingSection, reorderLandingSections, toggleLandingSectionStatus,
  uploadImage,
} from '../../services/api';
import {
  parseBlocks, blocksForPage, blockContent, newSectionKey, emptyBlock,
  PAGES, PAGE_LABELS, BLOCK_TYPES,
  type Block, type BlockType, type PageKey,
} from '../../data/siteBlocks';
import { compressImage, fileToDataUrl } from '../../utils/image';
import { usePermissions } from '../../context/PermissionsContext';

const ITEM_FIELDS: Record<string, { key: string; label: string; textarea?: boolean; image?: boolean }[]> = {
  cards: [{ key: 'title', label: 'Title' }, { key: 'desc', label: 'Description', textarea: true }, { key: 'image_url', label: 'Image', image: true }],
  stats: [{ key: 'value', label: 'Value' }, { key: 'label', label: 'Label' }],
  steps: [{ key: 'title', label: 'Title' }, { key: 'desc', label: 'Description', textarea: true }],
};
const hasItems = (t: BlockType) => t === 'cards' || t === 'stats' || t === 'steps';

// Per-item image upload (returns a hosted URL — no manual links).
function ItemImageUpload({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      // Preferred: upload to the server and store a hosted URL.
      try {
        const c = await compressImage(f);
        const fd = new FormData();
        fd.append('image', c);
        const res: any = await uploadImage(fd);
        const url = res?.data?.url;
        if (url) { onChange(url); return; }
      } catch { /* /admin/upload not deployed → inline fallback */ }
      // Fallback: embed the image inline (hard-compressed to stay small).
      const small = await compressImage(f, 720, 0.68);
      onChange(await fileToDataUrl(small));
    } catch { alert('Image upload failed'); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pick(e.target.files?.[0] ?? null)} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={value} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
          <button onClick={() => ref.current?.click()} style={{ ...s.ghost, padding: '6px 10px' }}>{busy ? 'Uploading…' : 'Replace'}</button>
          <button onClick={() => onChange('')} style={{ ...s.ghost, padding: '6px 10px', color: '#ef4444', borderColor: '#fecaca' }}>Remove</button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} disabled={busy} style={{ ...s.ghost, width: '100%', justifyContent: 'center', padding: 12, borderStyle: 'dashed' }}>
          <ImagePlus size={15} /> {busy ? 'Uploading…' : 'Upload image'}
        </button>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  input: { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#0f172a' },
  label: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 5 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '28px 16px' },
  modal: { background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,.2)', overflow: 'hidden' },
  ghost: { background: '#fff', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 },
  primary: { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7 },
};

// ── Block editor modal (create or edit) ─────────────────────────────────────
function BlockEditor({ page, type, block, nextOrder, onClose, onSaved }: {
  page: PageKey; type: BlockType; block?: Block; nextOrder: number;
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!block;
  const base = block ?? emptyBlock(page, type);
  const [title, setTitle] = useState(base.title);
  const [subtitle, setSubtitle] = useState(base.subtitle);
  const [status, setStatus] = useState<number>(base.status);
  const [data, setData] = useState<any>({ ...base.data });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(block?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setD = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  const setItems = (next: any[]) => setD('items', next);
  const addItem = () => setItems([...items, {}]);
  const rmItem = (i: number) => setItems(items.filter((_, x) => x !== i));
  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const next = [...items]; [next[i], next[j]] = [next[j], next[i]]; setItems(next);
  };
  const setItemField = (i: number, k: string, v: string) =>
    setItems(items.map((it, x) => x === i ? { ...it, [k]: v } : it));

  const pickImage = async (f: File | null) => {
    if (!f) { setFile(null); setPreview(block?.image_url ?? null); return; }
    const c = await compressImage(f);
    setFile(c); setPreview(URL.createObjectURL(c));
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const fd = new FormData();
      if (!isEdit) fd.append('section_key', newSectionKey(page, type));
      fd.append('title', title);
      fd.append('subtitle', subtitle);
      fd.append('content', blockContent(page, type, data));
      fd.append('sort_order', String(isEdit ? block!.sort_order : nextOrder));
      fd.append('status', String(status));
      if (file) fd.append('image', file);
      const res: any = isEdit ? await updateLandingSection(block!.id, fd) : await createLandingSection(fd);
      if (res?.data?.status === false) setError(res.data.message || 'Save failed');
      else onSaved();
    } catch (e: any) {
      const st = e?.response?.status;
      setError(st === 413 ? 'Image too large — use a smaller one.' : (e?.response?.data?.message || `Save failed${st ? ` (HTTP ${st})` : ''}.`));
    } finally { setSaving(false); }
  };

  const typeLabel = BLOCK_TYPES.find(b => b.type === type)?.label ?? type;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{isEdit ? 'Edit' : 'Add'} {typeLabel} — {PAGE_LABELS[page]}</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#fff" /></button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          {error && <div style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>{error}</div>}

          {/* Common: title/subtitle (contact uses title only) */}
          {type !== 'contact' && (
            <div><label style={s.label}>{type === 'stats' ? 'Section Title (optional)' : 'Title'}</label>
              <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} /></div>
          )}
          {['hero', 'cards', 'steps', 'cta', 'richtext'].includes(type) && (
            <div><label style={s.label}>Subtitle</label>
              <textarea style={{ ...s.input, resize: 'vertical', minHeight: 54, fontFamily: 'inherit' }} value={subtitle} onChange={e => setSubtitle(e.target.value)} /></div>
          )}

          {/* Image (hero) */}
          {type === 'hero' && (
            <div>
              <label style={s.label}>Image</label>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickImage(e.target.files?.[0] ?? null)} />
              {preview
                ? <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                    <img src={preview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => { setFile(null); setPreview(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#ef4444', display: 'flex' }}><X size={14} /></button>
                  </div>
                : <button onClick={() => fileRef.current?.click()} style={{ ...s.ghost, width: '100%', justifyContent: 'center', padding: 20, borderStyle: 'dashed' }}><ImagePlus size={18} /> Upload image</button>}
            </div>
          )}

          {/* richtext body */}
          {type === 'richtext' && (
            <div><label style={s.label}>Body</label>
              <textarea style={{ ...s.input, resize: 'vertical', minHeight: 140, fontFamily: 'inherit', lineHeight: 1.6 }} value={data.body ?? ''} onChange={e => setD('body', e.target.value)} placeholder="Paragraphs separated by blank lines…" /></div>
          )}

          {/* button (hero/cta) */}
          {(type === 'hero' || type === 'cta') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={s.label}>Button Text</label><input style={s.input} value={data.buttonText ?? ''} onChange={e => setD('buttonText', e.target.value)} /></div>
              <div><label style={s.label}>Button Link</label><input style={s.input} value={data.buttonLink ?? ''} onChange={e => setD('buttonLink', e.target.value)} placeholder="/contact or https://…" /></div>
            </div>
          )}

          {/* contact fields */}
          {type === 'contact' && (
            <>
              <div><label style={s.label}>Section Title</label><input style={s.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Get in touch" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={s.label}>Phone</label><input style={s.input} value={data.phone ?? ''} onChange={e => setD('phone', e.target.value)} /></div>
                <div><label style={s.label}>Email</label><input style={s.input} value={data.email ?? ''} onChange={e => setD('email', e.target.value)} /></div>
              </div>
              <div><label style={s.label}>Address</label><input style={s.input} value={data.address ?? ''} onChange={e => setD('address', e.target.value)} /></div>
              <div><label style={s.label}>Hours</label><input style={s.input} value={data.hours ?? ''} onChange={e => setD('hours', e.target.value)} /></div>
            </>
          )}

          {/* columns for cards */}
          {type === 'cards' && (
            <div style={{ maxWidth: 160 }}><label style={s.label}>Columns</label>
              <select style={{ ...s.input, cursor: 'pointer' }} value={data.columns ?? 3} onChange={e => setD('columns', Number(e.target.value))}>
                {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select></div>
          )}

          {/* items editor */}
          {hasItems(type) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...s.label, margin: 0 }}>Items ({items.length})</label>
                <button onClick={addItem} style={{ ...s.ghost, padding: '5px 10px' }}><Plus size={13} /> Add</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((it, i) => (
                  <div key={i} style={{ border: '1.5px solid #eef2f7', borderRadius: 12, padding: 12, background: '#fafbff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>#{i + 1}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ ...s.ghost, padding: 5, opacity: i === 0 ? .4 : 1 }}><ChevronUp size={13} /></button>
                        <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} style={{ ...s.ghost, padding: 5, opacity: i === items.length - 1 ? .4 : 1 }}><ChevronDown size={13} /></button>
                        <button onClick={() => rmItem(i)} style={{ ...s.ghost, padding: 5, color: '#ef4444', borderColor: '#fecaca' }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ITEM_FIELDS[type].map(f => f.image
                        ? <div key={f.key}><label style={{ ...s.label, marginBottom: 6 }}>{f.label}</label><ItemImageUpload value={it[f.key]} onChange={url => setItemField(i, f.key, url)} /></div>
                        : f.textarea
                          ? <textarea key={f.key} placeholder={f.label} style={{ ...s.input, resize: 'vertical', minHeight: 44, fontFamily: 'inherit' }} value={it[f.key] ?? ''} onChange={e => setItemField(i, f.key, e.target.value)} />
                          : <input key={f.key} placeholder={f.label} style={s.input} value={it[f.key] ?? ''} onChange={e => setItemField(i, f.key, e.target.value)} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 14px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Visible on site</span>
            <button onClick={() => setStatus(status === 1 ? 0 : 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: status === 1 ? '#16a34a' : '#94a3b8', display: 'flex' }}>
              {status === 1 ? <Eye size={22} /> : <EyeOff size={22} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid #eef2f7', background: '#fafbfc' }}>
          <button onClick={onClose} style={s.ghost}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...s.primary, opacity: saving ? .7 : 1 }}>
            {saving ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Save size={14} /> {isEdit ? 'Update' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function WebsiteBuilder() {
  const { can } = usePermissions();
  const canAdd = can('landing', 'add'), canEdit = can('landing', 'edit'), canDelete = can('landing', 'delete');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<PageKey>('home');
  const [editing, setEditing] = useState<{ type: BlockType; block?: Block } | null>(null);
  const [picker, setPicker] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { const res: any = await getLandingSections(); setBlocks(parseBlocks(res?.data)); }
    catch { setBlocks([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pageBlocks = useMemo(() => blocksForPage(blocks, page), [blocks, page]);
  const nextOrder = pageBlocks.length ? Math.max(...pageBlocks.map(b => b.sort_order)) + 1 : 0;

  const onSaved = () => { setEditing(null); load(); };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= pageBlocks.length) return;
    const reordered = [...pageBlocks];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const order = reordered.map((b, idx) => ({ id: b.id, sort_order: idx }));
    setBlocks(prev => prev.map(b => { const o = order.find(x => x.id === b.id); return o ? { ...b, sort_order: o.sort_order } : b; }));
    try { await reorderLandingSections(order); } catch { load(); }
  };

  const toggle = async (b: Block) => {
    setBusyId(b.id);
    const ns = b.status === 1 ? 0 : 1;
    try { await toggleLandingSectionStatus(b.id, ns); setBlocks(prev => prev.map(x => x.id === b.id ? { ...x, status: ns } : x)); }
    catch { alert('Failed'); } finally { setBusyId(null); }
  };

  const remove = async (b: Block) => {
    if (!confirm('Delete this block?')) return;
    setBusyId(b.id);
    try { await deleteLandingSection(b.id); setBlocks(prev => prev.filter(x => x.id !== b.id)); }
    catch { alert('Delete failed'); } finally { setBusyId(null); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>🌐 Website Builder</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>Build each page from blocks — drag order, show/hide, edit content & images.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={page === 'home' ? '/' : `/${page}`} target="_blank" rel="noreferrer" style={{ ...s.ghost, textDecoration: 'none' }}><ExternalLink size={15} /> Preview</a>
          <button onClick={load} style={s.ghost}><RefreshCw size={15} /> Reload</button>
        </div>
      </div>

      {/* Page tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {PAGES.map(p => (
          <button key={p} onClick={() => setPage(p)}
            style={{ padding: '8px 18px', borderRadius: 999, border: `1.5px solid ${page === p ? '#6366f1' : '#e2e8f0'}`, background: page === p ? '#eef2ff' : '#fff', color: page === p ? '#4338ca' : '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {PAGE_LABELS[p]} <span style={{ opacity: .6 }}>({blocksForPage(blocks, p).length})</span>
          </button>
        ))}
      </div>

      {/* Add block */}
      {canAdd && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <button onClick={() => setPicker(v => !v)} style={s.primary}><Plus size={16} /> Add Block to {PAGE_LABELS[page]}</button>
          {picker && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: '#fff', border: '1.5px solid #eef2f7', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.12)', padding: 8, width: 320 }}>
              {BLOCK_TYPES.map(bt => (
                <button key={bt.type} onClick={() => { setPicker(false); setEditing({ type: bt.type }); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '9px 12px', borderRadius: 10, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f7ff')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{bt.label}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{bt.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Block list */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : pageBlocks.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#fff', border: '1.5px dashed #e2e8f0', borderRadius: 16 }}>
          No blocks on this page yet. Click “Add Block”.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pageBlocks.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1.5px solid #eef2f7', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', opacity: b.status === 1 ? 1 : 0.6 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...s.ghost, padding: 3, border: 'none', opacity: i === 0 ? .3 : 1 }}><ChevronUp size={15} /></button>
                <GripVertical size={14} color="#cbd5e1" style={{ margin: '0 auto' }} />
                <button onClick={() => move(i, 1)} disabled={i === pageBlocks.length - 1} style={{ ...s.ghost, padding: 3, border: 'none', opacity: i === pageBlocks.length - 1 ? .3 : 1 }}><ChevronDown size={15} /></button>
              </div>
              <div style={{ width: 74, flexShrink: 0 }}>
                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 8, background: '#ede9fe', color: '#6366f1', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{BLOCK_TYPES.find(t => t.type === b.type)?.label ?? b.type}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title || <span style={{ color: '#cbd5e1' }}>Untitled</span>}</div>
                {b.subtitle && <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.subtitle}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {canEdit && <button onClick={() => toggle(b)} disabled={busyId === b.id} title={b.status === 1 ? 'Hide' : 'Show'} style={{ ...s.ghost, padding: 7, color: b.status === 1 ? '#16a34a' : '#94a3b8' }}>{b.status === 1 ? <Eye size={14} /> : <EyeOff size={14} />}</button>}
                {canEdit && <button onClick={() => setEditing({ type: b.type, block: b })} title="Edit" style={{ ...s.ghost, padding: 7, color: '#0284c7', borderColor: '#bae6fd' }}><Edit2 size={14} /></button>}
                {canDelete && <button onClick={() => remove(b)} disabled={busyId === b.id} title="Delete" style={{ ...s.ghost, padding: 7, color: '#ef4444', borderColor: '#fecaca' }}><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BlockEditor page={page} type={editing.type} block={editing.block} nextOrder={nextOrder}
          onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
    </div>
  );
}
