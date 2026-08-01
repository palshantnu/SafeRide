import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Edit2, Trash2, Plus, Search, RefreshCw, X, Save, AlertTriangle,
  CheckCircle, XCircle, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight,
  ImagePlus, Users, Car, Globe, type LucideIcon,
} from 'lucide-react';
import { usePermissions } from '../../context/PermissionsContext';

// ─── Shared types ──────────────────────────────────────────────────────────────
export type Audience = 'user' | 'captain' | 'both';

export interface AudienceMessage {
  id: number;
  title?: string | null;
  message?: string | null;
  image?: string | null;
  image_url?: string | null;
  audience: Audience;
  status?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MessageApi {
  getAll: () => Promise<any>;
  create: (fd: FormData) => Promise<any>;
  update: (id: number, fd: FormData) => Promise<any>;
  toggleStatus: (id: number, status: 0 | 1) => Promise<any>;
  remove: (id: number) => Promise<any>;
}

export interface ManagerLabels {
  emoji: string;
  /** plural heading, e.g. "Pop-up Messages" */
  heading: string;
  /** subtitle line under the heading */
  subtitle: string;
  /** singular noun, e.g. "Pop-up" — used in buttons & modals */
  noun: string;
  /** icon shown as the avatar / empty thumbnail */
  icon: LucideIcon;
  /** permission module key, e.g. "popups" — gates add/edit/delete buttons */
  module: string;
}

const AUDIENCES: { value: Audience; label: string; icon: LucideIcon; color: string; bg: string }[] = [
  { value: 'user',    label: 'User',    icon: Users, color: '#2563eb', bg: '#eff6ff' },
  { value: 'captain', label: 'Captain', icon: Car,   color: '#b45309', bg: '#fffbeb' },
  { value: 'both',    label: 'Both',    icon: Globe, color: '#7e22ce', bg: '#faf5ff' },
];
const audienceMeta = (a?: Audience) => AUDIENCES.find(x => x.value === a) ?? AUDIENCES[2];

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '16px' },
  modal:     { background: 'white', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '93vh', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'auto' },
  mHead:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1.5px solid #f1f5f9' },
  mBody:     { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' },
  mFoot:     { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1.5px solid #f1f5f9', background: '#fafbfc' },
  mTitle:    { margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' },
  field:     { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:     { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input:     { border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#1e293b', width: '100%', boxSizing: 'border-box', background: 'white' },
  errBox:    { display: 'flex', alignItems: 'center', gap: '6px', background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' },
  iconBtn:   { background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  cancelBtn: { background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '9px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  saveBtn:   { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' },
};

// ─── Audience badge ─────────────────────────────────────────────────────────
function AudienceBadge({ audience }: { audience?: Audience }) {
  const m = audienceMeta(audience);
  const Icon = m.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: m.bg, color: m.color, fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
      <Icon size={11} /> {m.label}
    </span>
  );
}

// ─── Create / Edit Form Modal ──────────────────────────────────────────────────
function FormModal({ initial, api, labels, onClose, onSaved }: {
  initial?: AudienceMessage; api: MessageApi; labels: ManagerLabels; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!initial;
  const Icon = labels.icon;
  const [title, setTitle]       = useState(initial?.title ?? '');
  const [message, setMessage]   = useState(initial?.message ?? '');
  const [audience, setAudience] = useState<Audience>(initial?.audience ?? 'both');
  const [status, setStatus]     = useState<number>(initial?.status ?? 1);
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(initial?.image_url ?? null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : (initial?.image_url ?? null));
  };

  const handleSubmit = async () => {
    if (!file && !title.trim() && !message.trim() && !initial?.image) {
      setError('Add an image, a title or a message.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('message', message);
      fd.append('audience', audience);
      fd.append('status', String(status));
      if (file) fd.append('image', file);

      const res: any = isEdit ? await api.update(initial!.id, fd) : await api.create(fd);
      const payload = res?.data;
      if (payload?.status === false) setError(payload?.message || 'Save failed');
      else onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Network error');
    } finally { setSaving(false); }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.mHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color="#6366f1" />
            </div>
            <h3 style={s.mTitle}>{isEdit ? `Edit ${labels.noun}` : `Create ${labels.noun}`}</h3>
          </div>
          <button onClick={onClose} style={s.iconBtn}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={s.mBody}>
          {error && <div style={s.errBox}><AlertTriangle size={14} /> {error}</div>}

          {/* Image */}
          <div style={s.field}>
            <label style={s.label}>Image</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => pickFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                <img src={preview} alt="preview" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => fileRef.current?.click()} style={{ ...s.iconBtn, background: 'rgba(255,255,255,0.9)' }} title="Replace"><ImagePlus size={15} /></button>
                  <button onClick={() => { setFile(null); setPreview(null); }} style={{ ...s.iconBtn, background: 'rgba(255,255,255,0.9)', color: '#ef4444' }} title="Remove"><X size={15} /></button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                style={{ border: '1.5px dashed #cbd5e1', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#fafbff', color: '#64748b', fontSize: '12.5px', fontWeight: 600 }}>
                <ImagePlus size={22} color="#94a3b8" />
                Click to upload an image
              </button>
            )}
          </div>

          {/* Title */}
          <div style={s.field}>
            <label style={s.label}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Optional heading" style={s.input} />
          </div>

          {/* Message */}
          <div style={s.field}>
            <label style={s.label}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder={`${labels.noun} text shown to the audience...`}
              style={{ ...s.input, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
          </div>

          {/* Audience */}
          <div style={s.field}>
            <label style={s.label}>Audience</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {AUDIENCES.map(a => {
                const AIcon = a.icon;
                const active = audience === a.value;
                return (
                  <button key={a.value} onClick={() => setAudience(a.value)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '10px 6px', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                      border: `1.5px solid ${active ? a.color : '#e2e8f0'}`,
                      background: active ? a.bg : 'white',
                      color: active ? a.color : '#64748b' }}>
                    <AIcon size={16} /> {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: '12px', padding: '10px 14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Active (visible in app)</span>
            <button onClick={() => setStatus(status === 1 ? 0 : 1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: status === 1 ? '#16a34a' : '#94a3b8', display: 'flex', alignItems: 'center' }}>
              {status === 1 ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={s.mFoot}>
          <button onClick={onClose} style={s.cancelBtn}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ ...s.saveBtn, opacity: saving ? 0.75 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : <><Save size={13} /> {isEdit ? `Update ${labels.noun}` : `Create ${labels.noun}`}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ item, api, labels, onClose, onDeleted }: {
  item: AudienceMessage; api: MessageApi; labels: ManagerLabels; onClose: () => void; onDeleted: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      await api.remove(item.id);
      onDeleted(item.id);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: '380px' }}>
        <div style={{ padding: '32px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={24} color="#ef4444" />
          </div>
          <h3 style={{ ...s.mTitle, fontSize: '16px' }}>Delete {labels.noun}?</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
            <b style={{ color: '#1e293b' }}>{item.title || item.message || `This ${labels.noun.toLowerCase()}`}</b> will be permanently deleted.
          </p>
          {error && <div style={s.errBox}><AlertTriangle size={14} /> {error}</div>}
        </div>
        <div style={s.mFoot}>
          <button onClick={onClose} style={s.cancelBtn}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            style={{ ...s.saveBtn, background: 'linear-gradient(135deg,#ef4444,#dc2626)', opacity: deleting ? 0.75 : 1 }}>
            {deleting
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</>
              : <><Trash2 size={13} /> Yes, Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main reusable manager ────────────────────────────────────────────────────
export default function AudienceMessageManager({ api, labels }: { api: MessageApi; labels: ManagerLabels }) {
  const Icon = labels.icon;
  const { can } = usePermissions();
  const canAdd    = can(labels.module, 'add');
  const canEdit   = can(labels.module, 'edit');
  const canDelete = can(labels.module, 'delete');
  const [items, setItems]               = useState<AudienceMessage[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [addOpen, setAddOpen]           = useState(false);
  const [editTarget, setEditTarget]     = useState<AudienceMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AudienceMessage | null>(null);
  const [togglingId, setTogglingId]     = useState<number | null>(null);
  const PER_PAGE = 8;

  const fetchItems = async () => {
    setLoading(true); setFetchError(null);
    try {
      const res: any = await api.getAll();
      const payload = res?.data;
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setItems(list);
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || `Could not load ${labels.heading.toLowerCase()}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [labels.heading]);

  const handleSaved = () => { fetchItems(); setAddOpen(false); setEditTarget(null); };
  const handleDeleted = (id: number) => { setItems(prev => prev.filter(x => x.id !== id)); setDeleteTarget(null); };

  const handleToggle = async (p: AudienceMessage) => {
    setTogglingId(p.id);
    const newStatus = p.status === 1 ? 0 : 1;
    try {
      await api.toggleStatus(p.id, newStatus);
      setItems(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
    } catch { alert('Status update failed'); }
    finally { setTogglingId(null); }
  };

  const filtered = useMemo(() =>
    items.filter(p =>
      (p.title?.toLowerCase()    || '').includes(search.toLowerCase()) ||
      (p.message?.toLowerCase()  || '').includes(search.toLowerCase()) ||
      (p.audience?.toLowerCase() || '').includes(search.toLowerCase())
    ), [search, items]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {addOpen      && <FormModal api={api} labels={labels} onClose={() => setAddOpen(false)} onSaved={handleSaved} />}
      {editTarget   && <FormModal api={api} labels={labels} initial={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />}
      {deleteTarget && <DeleteModal api={api} labels={labels} item={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{labels.emoji} {labels.heading}</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0' }}>
            {labels.subtitle} — {filtered.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '8px 14px', minWidth: '220px' }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search by title, message or audience..." value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', background: 'transparent', color: '#1e293b' }} />
          </div>
          <button onClick={fetchItems} title="Refresh"
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '9px 13px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} />
          </button>
          {canAdd && <button onClick={() => setAddOpen(true)}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Plus size={16} /> Create {labels.noun}
          </button>}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '20px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                {['#', labels.noun, 'Audience', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '13px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '13px' }}>Loading...</span>
                  </div>
                </td></tr>
              )}
              {!loading && fetchError && (
                <tr><td colSpan={6} style={{ padding: '50px', textAlign: 'center' }}>
                  <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px' }}>{fetchError}</p>
                  <button onClick={fetchItems} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Try Again</button>
                </td></tr>
              )}
              {!loading && !fetchError && paginated.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#fafbff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'white'; }}>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                    {(currentPage - 1) * PER_PAGE + paginated.indexOf(p) + 1}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" style={{ width: '46px', height: '46px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid #f1f5f9' }} />
                      ) : (
                        <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={18} color="#6366f1" />
                        </div>
                      )}
                      <div style={{ minWidth: 0, maxWidth: '380px' }}>
                        {p.title && <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{p.title}</div>}
                        <div style={{ fontSize: '12.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {p.message || <span style={{ color: '#cbd5e1' }}>— no text —</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}><AudienceBadge audience={p.audience} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: p.status === 1 ? '#f0fdf4' : '#f1f5f9', color: p.status === 1 ? '#16a34a' : '#64748b' }}>
                      {p.status === 1 ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {p.status === 1 ? 'Active' : 'Inactive'}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {canEdit && <button onClick={() => handleToggle(p)} disabled={togglingId === p.id} title={p.status === 1 ? 'Deactivate' : 'Activate'}
                        style={{ background: p.status === 1 ? '#f0fdf4' : '#f8fafc', border: `1px solid ${p.status === 1 ? '#bbf7d0' : '#e2e8f0'}`, color: p.status === 1 ? '#16a34a' : '#64748b', padding: '7px', borderRadius: '9px', cursor: togglingId === p.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                        {togglingId === p.id ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : p.status === 1 ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      </button>}
                      {canEdit && <button onClick={() => setEditTarget(p)} title="Edit"
                        style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} />
                      </button>}
                      {canDelete && <button onClick={() => setDeleteTarget(p)} title="Delete"
                        style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} />
                      </button>}
                      {!canEdit && !canDelete && <span style={{ fontSize: '12px', color: '#cbd5e1' }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !fetchError && paginated.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  {search ? `No results for "${search}".` : `No ${labels.heading.toLowerCase()} yet. Create your first one!`}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !fetchError && filtered.length > 0 && (
          <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing <b style={{ color: '#1e293b' }}>{paginated.length}</b> of <b style={{ color: '#1e293b' }}>{filtered.length}</b>
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '7px 11px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: currentPage === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={15} />
              </button>
              <span style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 700, color: '#6366f1', background: '#ede9fe', borderRadius: '8px' }}>
                {currentPage} / {totalPages || 1}
              </span>
              <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '7px 11px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', color: '#64748b', opacity: (currentPage === totalPages || totalPages === 0) ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin   { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
