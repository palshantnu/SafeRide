import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Edit2, Trash2, Plus, Search, ChevronLeft, ChevronRight,
  Image as ImageIcon, Eye, EyeOff, X, Save, Loader2,
  AlertCircle, CheckCircle2, FileText
} from 'lucide-react';
import {
  getAllServices, createService, updateService, deleteService, toggleServiceStatus,
  getAllServiceDocuments, createServiceDocument, updateServiceDocument, deleteServiceDocument,
  getAllBookinghistory,
} from "../../services/api";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Service {
  id: number;
  title: string;
  description?: string;
  image?: string;
  banner?: string;
  position?: number | string;
  status: number;
  driver_min_wallet_balance?: number | string | null;
  booking_cancellation_fees?: number | string | null;
  user_cancel_before48_type?: string | null;
  user_cancel_before48_amount?: string | number | null;
  user_cancel_24to48_type?: string | null;
  user_cancel_24to48_amount?: string | number | null;
  user_cancel_0to24_type?: string | null;
  user_cancel_0to24_amount?: string | number | null;
  driver_cancel_before48_type?: string | null;
  driver_cancel_before48_amount?: string | number | null;
  driver_cancel_24to48_type?: string | null;
  driver_cancel_24to48_amount?: string | number | null;
  driver_cancel_0to24_type?: string | null;
  driver_cancel_0to24_amount?: string | number | null;
}

interface ServiceDocument {
  id: number;
  service_id: number;
  document_type: string;
  created_at?: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// Services tab modal
type ServiceModalState =
  | { type: 'add' }
  | { type: 'edit'; service: Service }
  | { type: 'delete'; service: Service }
  | null;

// Documents tab modal
type DocModalState =
  | { type: 'add' }
  | { type: 'edit'; doc: ServiceDocument }
  | { type: 'delete'; doc: ServiceDocument }
  | null;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const IMAGE_BASE_URL = 'https://sigiride.com/uploads/services/';

const getImageUrl = (image?: string | null): string | null => {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  return `${IMAGE_BASE_URL}${image}`;
};

const getErrMsg = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

// ─── TOAST ────────────────────────────────────────────────────────────────────
interface ToastProps { toast: ToastState; onClose: () => void; }

function Toast({ toast, onClose }: ToastProps) {
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
      borderRadius: '12px', padding: '12px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      animation: 'slideInRight 0.3s ease', maxWidth: '320px',
    }}>
      {ok ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#ef4444" />}
      <span style={{ fontSize: '13px', fontWeight: 600, color: ok ? '#15803d' : '#dc2626' }}>
        {toast.message}
      </span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: 0 }}>
        <X size={14} color="#94a3b8" />
      </button>
    </div>
  );
}

// ─── SERVICE MODAL ────────────────────────────────────────────────────────────
interface ServiceModalProps {
  mode: string;
  service?: Service;
  onClose: () => void;
  onSave: (fd: FormData) => Promise<void>;
}

const CANCEL_SERVICES = ['self sharing', 'inter city'];

function ServiceModal({ mode, service, onClose, onSave }: ServiceModalProps) {
  const isEdit = mode === 'edit';

  interface FormState {
    title: string;
    description: string;
    position: string;
    status: number;
    image: File | null;
    banner: File | null;
    driver_min_wallet_balance: string;
    booking_cancellation_fees: string;
    user_cancel_before48_type: string;
    user_cancel_before48_amount: string;
    user_cancel_24to48_type: string;
    user_cancel_24to48_amount: string;
    user_cancel_0to24_type: string;
    user_cancel_0to24_amount: string;
    driver_cancel_before48_type: string;
    driver_cancel_before48_amount: string;
    driver_cancel_24to48_type: string;
    driver_cancel_24to48_amount: string;
    driver_cancel_0to24_type: string;
    driver_cancel_0to24_amount: string;
  }

  const [form, setForm] = useState<FormState>({
    title:       service?.title || '',
    description: service?.description || '',
    position:    service?.position != null ? String(service.position) : '',
    status:      service?.status ?? 1,
    image:       null,
    banner:      null,
    driver_min_wallet_balance: service?.driver_min_wallet_balance != null ? String(service.driver_min_wallet_balance) : '',
    booking_cancellation_fees: service?.booking_cancellation_fees != null ? String(service.booking_cancellation_fees) : '',
    user_cancel_before48_type:    service?.user_cancel_before48_type   || '',
    user_cancel_before48_amount:  service?.user_cancel_before48_amount != null ? String(service.user_cancel_before48_amount) : '',
    user_cancel_24to48_type:      service?.user_cancel_24to48_type     || '',
    user_cancel_24to48_amount:    service?.user_cancel_24to48_amount   != null ? String(service.user_cancel_24to48_amount)   : '',
    user_cancel_0to24_type:       service?.user_cancel_0to24_type      || '',
    user_cancel_0to24_amount:     service?.user_cancel_0to24_amount    != null ? String(service.user_cancel_0to24_amount)    : '',
    driver_cancel_before48_type:  service?.driver_cancel_before48_type  || '',
    driver_cancel_before48_amount:service?.driver_cancel_before48_amount != null ? String(service.driver_cancel_before48_amount) : '',
    driver_cancel_24to48_type:    service?.driver_cancel_24to48_type    || '',
    driver_cancel_24to48_amount:  service?.driver_cancel_24to48_amount  != null ? String(service.driver_cancel_24to48_amount)  : '',
    driver_cancel_0to24_type:     service?.driver_cancel_0to24_type     || '',
    driver_cancel_0to24_amount:   service?.driver_cancel_0to24_amount   != null ? String(service.driver_cancel_0to24_amount)   : '',
  });

  const [imagePreview,  setImagePreview]  = useState<string | null>(getImageUrl(service?.image)  ?? null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(getImageUrl(service?.banner) ?? null);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const showCancellation = CANCEL_SERVICES.includes(form.title.trim().toLowerCase());

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:'))  URL.revokeObjectURL(imagePreview);
      if (bannerPreview?.startsWith('blob:')) URL.revokeObjectURL(bannerPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (form.position !== '' && isNaN(Number(form.position))) e.position = 'Position must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFileChange = (
    field: 'image' | 'banner',
    file: File,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    setForm(f => ({ ...f, [field]: file }));
    setPreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title',       form.title.trim());
      fd.append('description', form.description.trim());
      fd.append('status',      String(form.status));
      if (form.position !== '') fd.append('position', form.position);
      fd.append('driver_min_wallet_balance', form.driver_min_wallet_balance || '0');
      fd.append('booking_cancellation_fees', form.booking_cancellation_fees || '0');
      if (form.image)           fd.append('image',    form.image);
      if (form.banner)          fd.append('banner',   form.banner);
      if (showCancellation) {
        fd.append('user_cancel_before48_type',    form.user_cancel_before48_type);
        fd.append('user_cancel_before48_amount',  form.user_cancel_before48_amount);
        fd.append('user_cancel_24to48_type',      form.user_cancel_24to48_type);
        fd.append('user_cancel_24to48_amount',    form.user_cancel_24to48_amount);
        fd.append('user_cancel_0to24_type',       form.user_cancel_0to24_type);
        fd.append('user_cancel_0to24_amount',     form.user_cancel_0to24_amount);
        fd.append('driver_cancel_before48_type',  form.driver_cancel_before48_type);
        fd.append('driver_cancel_before48_amount',form.driver_cancel_before48_amount);
        fd.append('driver_cancel_24to48_type',    form.driver_cancel_24to48_type);
        fd.append('driver_cancel_24to48_amount',  form.driver_cancel_24to48_amount);
        fd.append('driver_cancel_0to24_type',     form.driver_cancel_0to24_type);
        fd.append('driver_cancel_0to24_amount',   form.driver_cancel_0to24_amount);
      }
      await onSave(fd);
    } catch {
      // errors handled in parent
    } finally {
      setLoading(false);
    }
  };

  const inp = (field: string): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
    border: `1.5px solid ${errors[field] ? '#fca5a5' : '#e2e8f0'}`,
    outline: 'none', boxSizing: 'border-box', color: '#0f172a',
    background: errors[field] ? '#fff7f7' : 'white',
  });

  const selStyle: React.CSSProperties = {
    padding: '7px 8px', borderRadius: '8px', fontSize: '12px',
    border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a',
    background: 'white', cursor: 'pointer', width: '100%',
  };
  const numStyle: React.CSSProperties = {
    padding: '7px 8px', borderRadius: '8px', fontSize: '12px',
    border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a',
    background: 'white', width: '100%', boxSizing: 'border-box',
  };

  interface UploadBoxProps {
    label: string;
    preview: string | null;
    fieldId: string;
    onFileChange: (file: File) => void;
    hint?: string;
  }

  const UploadBox = ({ label, preview, fieldId, onFileChange, hint }: UploadBoxProps) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>{label}</label>
      <div
        onClick={() => (document.getElementById(fieldId) as HTMLInputElement | null)?.click()}
        style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#fafbfc' }}
      >
        {preview
          ? <img src={preview} alt="preview" style={{ maxHeight: '80px', borderRadius: '8px', objectFit: 'cover' }} />
          : (
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>
              <ImageIcon size={26} style={{ margin: '0 auto 6px', display: 'block' }} />
              {hint || 'Click to upload'}
            </div>
          )
        }
        <input
          id={fieldId} type="file" accept="image/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); }}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );

  const cancelRows = [
    { label: 'Before 48 hours', typeKey: 'before48' },
    { label: '24 – 48 hours',   typeKey: '24to48'   },
    { label: '0 – 24 hours',    typeKey: '0to24'    },
  ] as const;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '560px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.16)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit Service' : 'Add New Service'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>{isEdit ? 'Update service details' : 'Fill in the details below'}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <UploadBox label="Service Icon"  preview={imagePreview}  fieldId="imgInput"    onFileChange={f => handleFileChange('image',  f, setImagePreview)}  hint="Upload icon" />
          <UploadBox label="Banner Image"  preview={bannerPreview} fieldId="bannerInput" onFileChange={f => handleFileChange('banner', f, setBannerPreview)} hint="Upload banner" />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Service Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text" placeholder="e.g. In City" value={form.title}
            onChange={e => { if (!isEdit) { setForm(f => ({ ...f, title: e.target.value })); setErrors(ev => ({ ...ev, title: '' })); } }}
            disabled={isEdit}
            style={{ ...inp('title'), background: isEdit ? '#f8fafc' : 'white', cursor: isEdit ? 'not-allowed' : 'text', color: isEdit ? '#94a3b8' : '#0f172a' }}
          />
          {errors.title && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.title}</p>}
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Description</label>
          <textarea
            rows={3} placeholder="Short description..." value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ ...inp('description'), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
              Position <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="number" min="1" placeholder="e.g. 1" value={form.position}
              onChange={e => { setForm(f => ({ ...f, position: e.target.value })); setErrors(ev => ({ ...ev, position: '' })); }}
              style={inp('position')}
            />
            {errors.position && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.position}</p>}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
              Minimum Wallet <span style={{ color: '#94a3b8', fontWeight: 400 }}>(₹)</span>
            </label>
            <input
              type="number" min="0" step="0.01" placeholder="e.g. 100" value={form.driver_min_wallet_balance}
              onChange={e => setForm(f => ({ ...f, driver_min_wallet_balance: e.target.value }))}
              style={inp('driver_min_wallet_balance')}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
              Booking Cancellation Fees <span style={{ color: '#94a3b8', fontWeight: 400 }}>(₹)</span>
            </label>
            <input
              type="number" min="0" step="0.01" placeholder="e.g. 50" value={form.booking_cancellation_fees}
              onChange={e => setForm(f => ({ ...f, booking_cancellation_fees: e.target.value }))}
              style={inp('booking_cancellation_fees')}
            />
          </div>
        </div>

        {/* ── Cancellation Policy (Self Sharing / Inter City only) ── */}
        {showCancellation && (
          <div style={{ marginBottom: '24px', background: '#f8fafc', borderRadius: '14px', padding: '16px 18px', border: '1.5px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Cancellation Policy</div>

            {(['user', 'driver'] as const).map(who => (
              <div key={who} style={{ marginBottom: who === 'user' ? 16 : 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: who === 'user' ? '#6366f1' : '#059669', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                  {who === 'user' ? 'User' : 'Driver'} Cancellation
                </div>
                {/* header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Time Slot</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Type</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Amount</span>
                </div>
                {cancelRows.map(({ label, typeKey }) => {
                  const tKey = `${who}_cancel_${typeKey}_type`   as keyof FormState;
                  const aKey = `${who}_cancel_${typeKey}_amount` as keyof FormState;
                  return (
                    <div key={typeKey} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{label}</span>
                      <select
                        value={form[tKey] as string}
                        onChange={e => setForm(f => ({ ...f, [tKey]: e.target.value }))}
                        style={selStyle}
                      >
                        <option value="">-- Type --</option>
                        <option value="flat">Flat (₹)</option>
                        <option value="percent">Percent (%)</option>
                      </select>
                      <input
                        type="number" min="0" placeholder="0"
                        value={form[aKey] as string}
                        onChange={e => setForm(f => ({ ...f, [aKey]: e.target.value }))}
                        style={numStyle}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={14} /> {isEdit ? 'Update Service' : 'Create Service'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────
interface DeleteModalProps {
  title?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function DeleteModal({ title, onClose, onConfirm, loading }: DeleteModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '360px', boxShadow: '0 24px 60px rgba(0,0,0,0.15)', textAlign: 'center', animation: 'slideUp 0.3s ease' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete?</h3>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
          Are you sure you want to delete <b>"{title}"</b>? This action cannot be undone.
        </p>
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

// ─── DOC TYPE CONFIG ──────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'adhar_front', label: 'Aadhar Front' },
  { value: 'adhar_back',  label: 'Aadhar Back'  },
  { value: 'license',     label: 'License'       },
  { value: 'pan_card',    label: 'PAN Card'      },
  { value: 'passport',    label: 'Passport'      },
  { value: 'voter_id',    label: 'Voter ID'      },
  { value: 'rc',                       label: 'RC (Registration Certificate)'},
  { value: 'vehicle_fitness_certificate', label: 'Vehicle Fitness Certificate'},
  { value: 'vehicle_number Pic', label: 'Vehicle Number Plate Pic' },
  { value: 'insurance',   label: 'Insurance'     },
  { value: 'other',       label: 'Other'         },
] as const;


const DOC_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  adhar_front: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  adhar_back:  { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  license:     { bg: '#eef2ff', color: '#6366f1', border: '#c7d2fe' },
  pan_card:    { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  passport:    { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
  voter_id:    { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
  other:       { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
};

function DocBadge({ type }: { type: string }) {
  const label = DOC_TYPES.find(d => d.value === type)?.label || type;
  const c = DOC_COLORS[type] || DOC_COLORS.other;
  return (
    <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  );
}

// ─── SERVICE DOCUMENT MODAL ───────────────────────────────────────────────────
interface ServiceDocumentModalProps {
  mode: string;
  doc?: ServiceDocument;
  services: Service[];
  onClose: () => void;
  onSave: (payload: { service_id: number; document_type: string }) => Promise<void>;
}

function ServiceDocumentModal({ mode, doc, services, onClose, onSave }: ServiceDocumentModalProps) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    service_id: doc?.service_id != null ? String(doc.service_id) : '',
    document_type: doc?.document_type ?? '' as string,
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.service_id)    e.service_id    = 'Please select a service';
    if (!form.document_type) e.document_type = 'Please select a document type';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSave({ service_id: Number(form.service_id), document_type: form.document_type });
    } catch {
      // handled in parent
    } finally {
      setLoading(false);
    }
  };

  const inp = (field: string): React.CSSProperties => ({
    width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
    border: `1.5px solid ${errors[field] ? '#fca5a5' : '#e2e8f0'}`,
    outline: 'none', boxSizing: 'border-box', color: '#0f172a',
    background: errors[field] ? '#fff7f7' : 'white',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '500px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.16)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit Document' : 'Add New Document'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>Select a service and choose a document type</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
        </div>

        {/* Service cards */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
            Service <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
            {services.map(s => {
              const selected = form.service_id === String(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => { setForm(f => ({ ...f, service_id: String(s.id) })); setErrors(e => ({ ...e, service_id: '' })); }}
                  style={{ border: `1.5px solid ${selected ? '#6366f1' : '#e2e8f0'}`, borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', background: selected ? '#eef2ff' : '#fafbfc', transition: 'all 0.15s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {getImageUrl(s.image)
                        ? <img src={getImageUrl(s.image)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <ImageIcon size={13} color="#6366f1" />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: selected ? '#6366f1' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>{s.title}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>ID: {s.id}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {errors.service_id && <p style={{ color: '#ef4444', fontSize: '11px', margin: '6px 0 0' }}>{errors.service_id}</p>}
        </div>

        {/* Document Type */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Document Type <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={form.document_type}
            onChange={e => { setForm(f => ({ ...f, document_type: e.target.value })); setErrors(ev => ({ ...ev, document_type: '' })); }}
            style={inp('document_type')}
          >
            <option value="">-- Select document type --</option>
            {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {errors.document_type && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.document_type}</p>}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={14} /> {isEdit ? 'Update Document' : 'Add Document'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BOOKING ITEM TYPE ────────────────────────────────────────────────────────
interface BookingItem {
  id: number;
  booking_id?: string;
  status?: string;
  user_name?: string | null;
  user_mobile?: string;
  driver_name?: string | null;
  pickup_city?: string;
  drop_city?: string;
  plan_name?: string;
  plan_price?: string;
  service_name?: string;
  created_at?: string;
}

// ─── BOOKINGS MODAL ───────────────────────────────────────────────────────────
const BOOKING_STATUS: Record<string, { bg: string; color: string }> = {
  COMPLETED: { bg: '#d1fae5', color: '#065f46' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b' },
  SEARCHING: { bg: '#fef3c7', color: '#92400e' },
  ACCEPTED:  { bg: '#dbeafe', color: '#1e40af' },
  STARTED:   { bg: '#dcfce7', color: '#166534' },
  DROPPED:   { bg: '#f0fdf4', color: '#14532d' },
};
const getBStatus = (s?: string) =>
  BOOKING_STATUS[(s || '').toUpperCase()] || { bg: '#f1f5f9', color: '#475569' };

function BookingsModal({ title, bookings, onClose }: {
  title: string;
  bookings: BookingItem[];
  onClose: () => void;
}) {
  const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '700px', maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Bookings — {title}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>{bookings.length} total bookings</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex' }}>
            <X size={16} color="#64748b" />
          </button>
        </div>
        {/* List */}
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          {bookings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No bookings found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bookings.map(b => {
                const sc = getBStatus(b.status);
                return (
                  <div key={b.id} style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px 16px', border: '1.5px solid #f1f5f9', display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '90px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>{b.booking_id || `#${b.id}`}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>{fmt(b.created_at)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{b.user_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{b.user_mobile || ''}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{b.pickup_city || '—'}</span>
                        <span style={{ color: '#cbd5e1' }}>→</span>
                        <span>{b.drop_city || '—'}</span>
                      </div>
                    </div>
                    <div style={{ minWidth: '100px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Captain</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{b.driver_name || 'Not Assigned'}</div>
                      {b.plan_name && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{b.plan_name}</div>}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{b.plan_price ? `₹${b.plan_price}` : '—'}</div>
                      <span style={{ display: 'inline-block', marginTop: '5px', padding: '3px 8px', borderRadius: '20px', background: sc.bg, color: sc.color, fontSize: '10px', fontWeight: 700 }}>
                        {(b.status || '—').toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SERVICES TAB ─────────────────────────────────────────────────────────────
interface TabProps { showToast: (message: string, type?: 'success' | 'error') => void; }

function ServicesTab({ showToast }: TabProps) {
  const [services,        setServices]        = useState<Service[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [page,            setPage]            = useState(1);
  const [modal,           setModal]           = useState<ServiceModalState>(null);
  const [actionLoading,   setActionLoading]   = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<number | null>(null);
  const [bookingCounts,   setBookingCounts]   = useState<Record<string, number>>({});
  const [allBookings,     setAllBookings]     = useState<BookingItem[]>([]);
  const [viewBookingsFor, setViewBookingsFor] = useState<Service | null>(null);
  const PER_PAGE = 5;

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const [svcData, bookingsRes] = await Promise.all([
        getAllServices({}),
        getAllBookinghistory(),
      ]);

      // getAllServices returns raw axios response → .data is the body
      console.log('🔵 ServiceList RAW svcData:', svcData);
      const svcBody = (svcData as { data: unknown }).data;
      console.log('🟡 ServiceList svcBody:', svcBody);
      const svcList: Service[] =
        Array.isArray(svcBody) ? svcBody :
        Array.isArray((svcBody as { data?: Service[] })?.data) ? (svcBody as { data: Service[] }).data : [];
      console.log('🟢 ServiceList svcList:', svcList);
      setServices(svcList);

      // getAllBookinghistory returns raw axios response
      const bookBody = (bookingsRes as { data: unknown }).data;
      const rawBookings: BookingItem[] =
        Array.isArray(bookBody) ? bookBody :
        Array.isArray((bookBody as { data?: unknown[] })?.data) ? (bookBody as { data: BookingItem[] }).data : [];
      const list = Array.isArray(rawBookings) ? rawBookings : [];
      setAllBookings(list);
      const counts: Record<string, number> = {};
      list.forEach(b => {
        if (b.service_name) counts[b.service_name] = (counts[b.service_name] || 0) + 1;
      });
      setBookingCounts(counts);
    } catch (err) {
      console.error('❌ fetchServices error:', err);
      showToast('Failed to load services', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const handleCreate = async (fd: FormData) => {
    try {
      await createService(fd);
      setModal(null);
      showToast('Service created successfully!');
      await fetchServices();
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to create service'), 'error');
      throw err;
    }
  };

  const handleUpdate = async (fd: FormData) => {
    if (!modal || modal.type !== 'edit') return;
    try {
      await updateService(modal.service.id, fd);
      setModal(null);
      showToast('Service updated successfully!');
      await fetchServices();
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to update service'), 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== 'delete') return;
    setActionLoading(true);
    try {
      await deleteService(modal.service.id);
      setServices(prev => prev.filter(s => s.id !== modal.service.id));
      setModal(null);
      showToast('Service deleted successfully!');
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to delete service'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (service: Service) => {
    setToggleLoadingId(service.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await toggleServiceStatus(service.id, service.status as any);
      const newStatus: number =
        (res as { data?: { data?: { status: number } } })?.data?.data?.status ??
        (res as { data?: { status: number } })?.data?.status ??
        (service.status === 1 ? 0 : 1);
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
      showToast(`Service ${newStatus === 1 ? 'activated' : 'deactivated'}!`);
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to update status'), 'error');
    } finally {
      setToggleLoadingId(null);
    }
  };

  const filtered   = useMemo(() => services.filter(s => s.title?.toLowerCase().includes(search.toLowerCase())), [services, search]);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Auto-correct out-of-range page
  useEffect(() => {
    if (page > 1 && paginated.length === 0 && filtered.length > 0) {
      setPage(Math.ceil(filtered.length / PER_PAGE));
    }
  }, [filtered.length, page, paginated.length]);

  type ColAlign = React.CSSProperties['textAlign'];
  const cols: { label: string; align: ColAlign }[] = [
    { label: 'Service',     align: 'left'   },
    { label: 'Description', align: 'left'   },
    { label: 'Banner',      align: 'left'   },
    { label: 'Position',    align: 'center' },
    { label: 'Bookings',    align: 'center' },
    { label: 'Status',      align: 'left'   },
    { label: 'Actions',     align: 'right'  },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total <b>{filtered.length}</b> service types</p>
        <div className="responsive-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="responsive-search" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px' }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search services..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ border: 'none', outline: 'none', fontSize: '12px', width: '180px' }} />
          </div>
          <button onClick={() => setModal({ type: 'add' })} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
            <Plus size={16} /> Add Service
          </button>
        </div>
      </div>

      <div className="responsive-table-card" style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <table className="mobile-card-table service-mobile-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
              {cols.map(({ label, align }) => (
                <th key={label} style={{ padding: '12px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', textAlign: align }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} style={{ padding: '14px 16px' }}><div style={{ height: '14px', borderRadius: '6px', background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 0 ? '55%' : '40%' }} /></td>
                ))}
              </tr>
            ))}
            {!loading && paginated.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>{search ? 'No services match your search.' : 'No services found. Add your first one!'}</td></tr>
            )}
            {!loading && paginated.map((service) => {
              const imgUrl = getImageUrl(service.image);
              return (
                <tr key={service.id} className="svc-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {imgUrl
                          ? <img src={imgUrl} alt={service.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <ImageIcon size={18} color="#6366f1" />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{service.title}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>ID: {service.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '180px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {service.description && service.description !== 'NA'
                        ? service.description
                        : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No description</span>}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {service.banner
                      ? <img src={getImageUrl(service.banner)!} alt="banner" style={{ height: '32px', width: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                      : <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {service.position != null && service.position !== ''
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: '#eef2ff', color: '#6366f1', fontSize: '12px', fontWeight: 700, border: '1.5px solid #c7d2fe' }}>{service.position}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => setViewBookingsFor(service)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                        background: bookingCounts[service.title] ? '#eef2ff' : '#f1f5f9',
                        color:      bookingCounts[service.title] ? '#6366f1' : '#94a3b8',
                        minWidth: '32px', border: 'none',
                        cursor: bookingCounts[service.title] ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                      }}
                      title={bookingCounts[service.title] ? 'View bookings' : 'No bookings'}
                    >
                      {bookingCounts[service.title] || 0}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleToggle(service)}
                      disabled={toggleLoadingId === service.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: service.status === 1 ? '#d1fae5' : '#f1f5f9', color: service.status === 1 ? '#065f46' : '#64748b', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: toggleLoadingId === service.id ? 0.6 : 1, transition: 'all 0.2s' }}
                    >
                      {toggleLoadingId === service.id
                        ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        : service.status === 1 ? <Eye size={12} /> : <EyeOff size={12} />}
                      {service.status === 1 ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="action-btn" onClick={() => setModal({ type: 'edit', service })} style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="responsive-pagination" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Page <b>{page}</b> of <b>{totalPages || 1}</b> · <b>{filtered.length}</b> results</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
            <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {modal?.type === 'add'    && <ServiceModal mode="add"  onClose={() => setModal(null)} onSave={handleCreate} />}
      {modal?.type === 'edit'   && <ServiceModal mode="edit" service={modal.service} onClose={() => setModal(null)} onSave={handleUpdate} />}
      {modal?.type === 'delete' && <DeleteModal  title={modal.service?.title} onClose={() => setModal(null)} onConfirm={handleDelete} loading={actionLoading} />}

      {viewBookingsFor && (
        <BookingsModal
          title={viewBookingsFor.title}
          bookings={allBookings.filter(b => b.service_name === viewBookingsFor.title)}
          onClose={() => setViewBookingsFor(null)}
        />
      )}
    </>
  );
}

// ─── DOCUMENTS TAB ────────────────────────────────────────────────────────────
function DocumentsTab({ showToast }: TabProps) {
  const [documents,     setDocuments]     = useState<ServiceDocument[]>([]);
  const [services,      setServices]      = useState<Service[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [modal,         setModal]         = useState<DocModalState>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const PER_PAGE = 8;

  // O(1) lookup map
  const serviceMap = useMemo(() => {
    const m: Record<number, Service> = {};
    services.forEach(s => { m[s.id] = s; });
    return m;
  }, [services]);

  const getServiceName = useCallback(
    (id: number) => serviceMap[id]?.title || `Service #${id}`,
    [serviceMap]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [svcData, docData] = await Promise.all([getAllServices({}), getAllServiceDocuments()]);

      // getAllServices → raw axios response
      const svcBody2 = (svcData as { data: unknown }).data;
      const svcList2: Service[] =
        Array.isArray(svcBody2) ? svcBody2 :
        Array.isArray((svcBody2 as { data?: Service[] })?.data) ? (svcBody2 as { data: Service[] }).data : [];
      setServices(svcList2);

      // getAllServiceDocuments → already does .then(r => r.data)
      const docList: ServiceDocument[] =
        Array.isArray(docData) ? docData :
        Array.isArray((docData as { data?: ServiceDocument[] })?.data) ? (docData as { data: ServiceDocument[] }).data : [];
      setDocuments(docList);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (payload: { service_id: number; document_type: string }) => {
    try {
      await createServiceDocument(payload);
      setModal(null);
      showToast('Document added successfully!');
      await fetchAll();
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to add document'), 'error');
      throw err;
    }
  };

  const handleUpdate = async (payload: { service_id: number; document_type: string }) => {
    if (!modal || modal.type !== 'edit') return;
    const docId = modal.doc.id;
    try {
      const res = await updateServiceDocument(docId, payload);
      const updated: ServiceDocument =
        (res as { data?: { data?: ServiceDocument } })?.data?.data ||
        (res as { data?: ServiceDocument })?.data ||
        (res as ServiceDocument);
      if (updated?.id) {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updated } : d));
      } else {
        await fetchAll();
      }
      setModal(null);
      showToast('Document updated successfully!');
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to update document'), 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== 'delete') return;
    const docId = modal.doc.id;
    setActionLoading(true);
    try {
      await deleteServiceDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setModal(null);
      showToast('Document deleted successfully!');
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to delete document'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered   = useMemo(() => documents.filter(d =>
    d.document_type?.toLowerCase().includes(search.toLowerCase()) ||
    getServiceName(d.service_id)?.toLowerCase().includes(search.toLowerCase())
  ), [documents, search, getServiceName]);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    if (page > 1 && paginated.length === 0 && filtered.length > 0) {
      setPage(Math.ceil(filtered.length / PER_PAGE));
    }
  }, [filtered.length, page, paginated.length]);

  type ColAlign = React.CSSProperties['textAlign'];
  const cols: { label: string; align: ColAlign }[] = [
    { label: 'ID',            align: 'left'  },
    { label: 'Service',       align: 'left'  },
    { label: 'Document Type', align: 'left'  },
    { label: 'Created At',    align: 'left'  },
    { label: 'Actions',       align: 'right' },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total <b>{filtered.length}</b> document records</p>
        <div className="responsive-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="responsive-search" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px' }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search by service or type..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ border: 'none', outline: 'none', fontSize: '12px', width: '200px' }} />
          </div>
          <button onClick={() => setModal({ type: 'add' })} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
            <Plus size={16} /> Add Document
          </button>
        </div>
      </div>

      <div className="responsive-table-card" style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <table className="mobile-card-table service-doc-mobile-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
              {cols.map(({ label, align }) => (
                <th key={label} style={{ padding: '12px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', textAlign: align }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                {Array.from({ length: 5 }).map((__, j) => (
                  <td key={j} style={{ padding: '14px 16px' }}><div style={{ height: '14px', borderRadius: '6px', background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 0 ? '30%' : '50%' }} /></td>
                ))}
              </tr>
            ))}
            {!loading && paginated.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <FileText size={32} color="#e2e8f0" />
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>{search ? 'No documents match your search.' : 'No documents found. Add your first one!'}</span>
                </div>
              </td></tr>
            )}
            {!loading && paginated.map((doc) => {
              const svcImage = getImageUrl(serviceMap[doc.service_id]?.image);
              return (
                <tr key={doc.id} className="svc-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', height: '22px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: 700, padding: '0 6px' }}>#{doc.id}</span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {svcImage
                          ? <img src={svcImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <FileText size={14} color="#6366f1" />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{getServiceName(doc.service_id)}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Service ID: {doc.service_id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px' }}><DocBadge type={doc.document_type} /></td>
                  <td style={{ padding: '13px 16px' }}>
                    {doc.created_at
                      ? <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="action-btn" onClick={() => setModal({ type: 'edit', doc })} style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                      <button className="action-btn" onClick={() => setModal({ type: 'delete', doc })} style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="responsive-pagination" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Page <b>{page}</b> of <b>{totalPages || 1}</b> · <b>{filtered.length}</b> results</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
            <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {modal?.type === 'add'    && <ServiceDocumentModal mode="add"  services={services} onClose={() => setModal(null)} onSave={handleCreate} />}
      {modal?.type === 'edit'   && <ServiceDocumentModal mode="edit" doc={modal.doc} services={services} onClose={() => setModal(null)} onSave={handleUpdate} />}
      {modal?.type === 'delete' && <DeleteModal title={modal.doc?.document_type} onClose={() => setModal(null)} onConfirm={handleDelete} loading={actionLoading} />}
    </>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function ServiceList() {
  const [activeTab, setActiveTab] = useState<'services' | 'documents'>('services');
  const [toast,     setToast]     = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type }),
    []
  );

  const tabs: { key: 'services' | 'documents'; label: string; icon: React.ReactNode }[] = [
    { key: 'services',  label: 'Services',         icon: <ImageIcon size={14} /> },
    { key: 'documents', label: 'Service Documents', icon: <FileText  size={14} /> },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp      { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn       { from { opacity:0 } to { opacity:1 } }
        @keyframes spin         { to   { transform:rotate(360deg) } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .svc-row:hover td { background:#fafbff !important; }
        .action-btn:hover { transform:scale(1.06); transition:transform 0.15s; }
      `}</style>

      <div className="responsive-page" style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
            {activeTab === 'services' ? 'Services' : 'Service Documents'}
          </h2>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
            {tabs.map(tab => {
              const active = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                  background: active ? 'white' : 'transparent',
                  color:      active ? '#6366f1' : '#94a3b8',
                  boxShadow:  active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                  {tab.icon} {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'services'  && <ServicesTab  showToast={showToast} />}
        {activeTab === 'documents' && <DocumentsTab showToast={showToast} />}
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
