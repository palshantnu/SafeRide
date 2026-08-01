import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Save, Loader2, Trash2, Edit2, Image as ImageIcon,
  Eye, EyeOff, AlertCircle, CheckCircle2, GalleryHorizontalEnd, Link as LinkIcon,
} from 'lucide-react';
import {
  getAllAppBanners, createAppBanner, updateAppBanner,
  toggleAppBannerStatus, deleteAppBanner,
} from '../../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Banner {
  id: number;
  title?: string | null;
  image?: string | null;
  link_url?: string | null;
  position?: number | string | null;
  status: number;
}

interface ToastState { message: string; type: 'success' | 'error'; }

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; banner: Banner }
  | { type: 'delete'; banner: Banner }
  | null;

// ─── Helpers ────────────────────────────────────────────────────────────────
const IMAGE_BASE_URL = 'http://91.108.104.79:3000/uploads/banners/';

const getImageUrl = (image?: string | null): string | null => {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  return `${IMAGE_BASE_URL}${image}`;
};

const getErrMsg = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

// getAllAppBanners returns a raw axios response → unwrap to the array
function extractList(res: unknown): Banner[] {
  const body = (res as { data?: unknown })?.data;
  if (Array.isArray(body)) return body as Banner[];
  const inner = (body as { data?: unknown })?.data;
  if (Array.isArray(inner)) return inner as Banner[];
  return [];
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  const ok = toast.type === 'success';
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '10px',
      background: ok ? '#f0fdf4' : '#fff1f2',
      border: `1.5px solid ${ok ? '#bbf7d0' : '#fecdd3'}`,
      borderRadius: '12px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: '320px',
    }}>
      {ok ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#ef4444" />}
      <span style={{ fontSize: '13px', fontWeight: 600, color: ok ? '#15803d' : '#dc2626' }}>{toast.message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: 0 }}>
        <X size={14} color="#94a3b8" />
      </button>
    </div>
  );
}

// ─── Banner Modal ─────────────────────────────────────────────────────────────
function BannerModal({ mode, banner, onClose, onSave }: {
  mode: 'add' | 'edit';
  banner?: Banner;
  onClose: () => void;
  onSave: (fd: FormData) => Promise<void>;
}) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    title:    banner?.title || '',
    link_url: banner?.link_url || '',
    position: banner?.position != null ? String(banner.position) : '',
    status:   banner?.status ?? 1,
    image:    null as File | null,
  });
  const [preview, setPreview] = useState<string | null>(getImageUrl(banner?.image) ?? null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const handleFile = (file: File) => {
    setForm(f => ({ ...f, image: file }));
    setPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };

  const handleSubmit = async () => {
    if (!isEdit && !form.image) { setError('Please select a banner image'); return; }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('link_url', form.link_url.trim());
      fd.append('status', String(form.status));
      if (form.position !== '') fd.append('position', form.position);
      if (form.image) fd.append('image', form.image);
      await onSave(fd);
    } catch (err) {
      setError(getErrMsg(err, 'Failed to save banner'));
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
    border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box', color: '#0f172a', background: 'white',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '480px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.16)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit Banner' : 'Add Slider Banner'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>Shown in the app home slider</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
        </div>

        {error && <div style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '14px' }}>{error}</div>}

        {/* Image upload */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Banner Image {!isEdit && <span style={{ color: '#ef4444' }}>*</span>}</label>
          <div
            onClick={() => (document.getElementById('bannerImg') as HTMLInputElement | null)?.click()}
            style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#fafbfc' }}
          >
            {preview
              ? <img src={preview} alt="preview" style={{ maxHeight: '120px', width: '100%', objectFit: 'cover', borderRadius: '8px' }} />
              : <div style={{ color: '#94a3b8', fontSize: '12px' }}><ImageIcon size={26} style={{ margin: '0 auto 6px', display: 'block' }} />Click to upload banner (wide image recommended)</div>}
            <input id="bannerImg" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: 'none' }} />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Title <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
          <input type="text" placeholder="e.g. Summer Offer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Link URL <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional — opens on tap)</span></label>
          <input type="text" placeholder="https://..." value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} style={inp} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '22px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Position <span style={{ color: '#94a3b8', fontWeight: 400 }}>(order)</span></label>
            <input type="number" min="1" placeholder="e.g. 1" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Status</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([{ val: 1, label: 'Active' }, { val: 0, label: 'Inactive' }] as const).map(({ val, label }) => (
                <button key={val} onClick={() => setForm(f => ({ ...f, status: val }))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#e2e8f0'}`, background: form.status === val ? (val === 1 ? '#eef2ff' : '#fff1f2') : 'white', color: form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#94a3b8' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={14} /> {isEdit ? 'Update Banner' : 'Add Banner'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '360px', boxShadow: '0 24px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete Banner?</h3>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>This banner will be removed from the app slider. This action cannot be undone.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: loading ? '#fca5a5' : '#ef4444', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AppSettings() {
  const [banners,       setBanners]       = useState<Banner[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState<ModalState>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toggleId,      setToggleId]      = useState<number | null>(null);
  const [toast,         setToast]         = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => setToast({ message, type }), []);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllAppBanners();
      const list = extractList(res).sort((a, b) => (Number(a.position) || 9999) - (Number(b.position) || 9999));
      setBanners(list);
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to load banners'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  const handleCreate = async (fd: FormData) => {
    await createAppBanner(fd);
    setModal(null);
    showToast('Banner added successfully!');
    await fetchBanners();
  };

  const handleUpdate = async (fd: FormData) => {
    if (!modal || modal.type !== 'edit') return;
    await updateAppBanner(modal.banner.id, fd);
    setModal(null);
    showToast('Banner updated successfully!');
    await fetchBanners();
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== 'delete') return;
    setActionLoading(true);
    try {
      await deleteAppBanner(modal.banner.id);
      setBanners(prev => prev.filter(b => b.id !== modal.banner.id));
      setModal(null);
      showToast('Banner deleted successfully!');
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to delete banner'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (banner: Banner) => {
    setToggleId(banner.id);
    try {
      await toggleAppBannerStatus(banner.id, banner.status as 0 | 1);
      const newStatus = banner.status === 1 ? 0 : 1;
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, status: newStatus } : b));
      showToast(`Banner ${newStatus === 1 ? 'activated' : 'deactivated'}!`);
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to update status'), 'error');
    } finally {
      setToggleId(null);
    }
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GalleryHorizontalEnd size={20} color="#6366f1" /> App Slider Banners
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>Manage the image slider shown on the app home screen</p>
          </div>
          <button onClick={() => setModal({ type: 'add' })} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
            <Plus size={16} /> Add Banner
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: '200px', borderRadius: '16px', background: '#f1f5f9', animation: 'pulse 1.5s ease infinite' }} />
            ))}
          </div>
        ) : banners.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', padding: '56px 24px', textAlign: 'center' }}>
            <GalleryHorizontalEnd size={34} color="#cbd5e1" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>No banners yet</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Add your first slider banner for the app.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {banners.map(banner => {
              const img = getImageUrl(banner.image);
              return (
                <div key={banner.id} style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <div style={{ height: '140px', background: '#f1f5f9', position: 'relative' }}>
                    {img
                      ? <img src={img} alt={banner.title || 'banner'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={28} color="#cbd5e1" /></div>}
                    {banner.position != null && banner.position !== '' && (
                      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(15,23,42,0.7)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>#{banner.position}</span>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {banner.title || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Untitled</span>}
                    </div>
                    {banner.link_url && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <LinkIcon size={11} /> {banner.link_url}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <button onClick={() => handleToggle(banner)} disabled={toggleId === banner.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: banner.status === 1 ? '#d1fae5' : '#f1f5f9', color: banner.status === 1 ? '#065f46' : '#64748b', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: toggleId === banner.id ? 0.6 : 1 }}>
                        {toggleId === banner.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : banner.status === 1 ? <Eye size={12} /> : <EyeOff size={12} />}
                        {banner.status === 1 ? 'Active' : 'Inactive'}
                      </button>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => setModal({ type: 'edit', banner })} title="Edit" style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}><Edit2 size={14} /></button>
                        <button onClick={() => setModal({ type: 'delete', banner })} title="Delete" style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal?.type === 'add'    && <BannerModal mode="add"  onClose={() => setModal(null)} onSave={handleCreate} />}
      {modal?.type === 'edit'   && <BannerModal mode="edit" banner={modal.banner} onClose={() => setModal(null)} onSave={handleUpdate} />}
      {modal?.type === 'delete' && <DeleteModal onClose={() => setModal(null)} onConfirm={handleDelete} loading={actionLoading} />}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
