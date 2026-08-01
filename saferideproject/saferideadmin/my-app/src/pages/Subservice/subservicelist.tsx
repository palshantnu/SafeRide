import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Edit2, Trash2, Plus, Search, ChevronLeft, ChevronRight,
  Image as ImageIcon, Eye, EyeOff, X, Save, Loader2,
  AlertCircle, CheckCircle2, Layers
} from 'lucide-react';
import {
  getAllServices,
  getAllSubServices, createSubService, updateSubService, deleteSubService, toggleSubServiceStatus,
  getAllBookinghistory,
} from "../../services/api";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Service {
  id: number;
  title: string;
  image?: string;
  status: number;
}

interface SubService {
  id: number;
  service_id: number;
  title: string;
  description?: string;
  image?: string;
  status: number;
  position?: number | null;
  created_at?: string;
  updated_at?: string;
  driver_min_wallet_balance?: number | null;
  search_area?: number | null;
  fixed_charge?: number | null;
  fixed_charge_km?: number | null;
  charge_after_fixed_per_km?: number | null;
  access_fee?: number | null;
  access_fee_type?: string | null;
  platform_fee?: number | null;
  booking_destroy_min?: number | null;
  user_cancel_before48_type?: string | null;
  user_cancel_before48_amount?: number | null;
  user_cancel_24to48_type?: string | null;
  user_cancel_24to48_amount?: number | null;
  user_cancel_0to24_type?: string | null;
  user_cancel_0to24_amount?: number | null;
  driver_cancel_before48_type?: string | null;
  driver_cancel_before48_amount?: number | null;
  driver_cancel_24to48_type?: string | null;
  driver_cancel_24to48_amount?: number | null;
  driver_cancel_0to24_type?: string | null;
  driver_cancel_0to24_amount?: number | null;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

type SubServiceModalState =
  | { type: 'add' }
  | { type: 'edit'; subService: SubService }
  | { type: 'delete'; subService: SubService }
  | null;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const IMAGE_BASE_URL = 'http://91.108.104.79:3000/uploads/subservice/';

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

// ─── SUB SERVICE MODAL ────────────────────────────────────────────────────────
interface SubServiceModalProps {
  mode: string;
  subService?: SubService;
  services: Service[];
  onClose: () => void;
  onSave: (fd: FormData) => Promise<void>;
}

function SubServiceModal({ mode, subService, services, onClose, onSave }: SubServiceModalProps) {
  const isEdit = mode === 'edit';

  const str = (v?: number | null) => (v != null ? String(v) : '');

  const [form, setForm] = useState({
    service_id:               subService?.service_id != null ? String(subService.service_id) : '',
    title:                    subService?.title || '',
    description:              subService?.description || '',
    status:                   subService?.status ?? 1,
    position:                 str(subService?.position),
    image:                    null as File | null,
    driver_min_wallet_balance:str(subService?.driver_min_wallet_balance),
    search_area:              str(subService?.search_area),
    fixed_charge:             str(subService?.fixed_charge),
    fixed_charge_km:          str(subService?.fixed_charge_km),
    charge_after_fixed_per_km:str(subService?.charge_after_fixed_per_km),
    access_fee:               str(subService?.access_fee),
    access_fee_type:          subService?.access_fee_type || 'percent',
    platform_fee:             str(subService?.platform_fee),
    booking_destroy_min:          str(subService?.booking_destroy_min),
    user_cancel_before48_type:  subService?.user_cancel_before48_type  || 'flat',
    user_cancel_before48_amount:   str(subService?.user_cancel_before48_amount),
    user_cancel_24to48_type:   subService?.user_cancel_24to48_type   || 'flat',
    user_cancel_24to48_amount:    str(subService?.user_cancel_24to48_amount),
    user_cancel_0to24_type:            subService?.user_cancel_0to24_type            || 'flat',
    user_cancel_0to24_amount:             str(subService?.user_cancel_0to24_amount),
    driver_cancel_before48_type:   subService?.driver_cancel_before48_type   || 'flat',
    driver_cancel_before48_amount:    str(subService?.driver_cancel_before48_amount),
    driver_cancel_24to48_type:    subService?.driver_cancel_24to48_type    || 'flat',
    driver_cancel_24to48_amount:     str(subService?.driver_cancel_24to48_amount),
    driver_cancel_0to24_type:     subService?.driver_cancel_0to24_type     || 'flat',
    driver_cancel_0to24_amount:      str(subService?.driver_cancel_0to24_amount),
  });

  const [imagePreview, setImagePreview] = useState<string | null>(getImageUrl(subService?.image) ?? null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedService = services.find(s => String(s.id) === form.service_id);
  const isInCity = selectedService?.title?.toLowerCase().includes('in city') ?? false;

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.service_id) e.service_id = 'Please select a parent service';
    if (!form.title.trim()) e.title = 'Title is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    console.log('📋 Form state at submit:', {
      user_cancel_before48_type:  form.user_cancel_before48_type,
      user_cancel_before48_amount:   form.user_cancel_before48_amount,
      user_cancel_24to48_type:   form.user_cancel_24to48_type,
      user_cancel_24to48_amount:    form.user_cancel_24to48_amount,
      user_cancel_0to24_type:    form.user_cancel_0to24_type,
      user_cancel_0to24_amount:     form.user_cancel_0to24_amount,
      driver_cancel_before48_type: form.driver_cancel_before48_type,
      driver_cancel_before48_amount:  form.driver_cancel_before48_amount,
      driver_cancel_24to48_type:  form.driver_cancel_24to48_type,
      driver_cancel_24to48_amount:   form.driver_cancel_24to48_amount,
      driver_cancel_0to24_type:   form.driver_cancel_0to24_type,
      driver_cancel_0to24_amount:    form.driver_cancel_0to24_amount,
    });
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('service_id',              form.service_id);
      fd.append('title',                   form.title.trim());
      fd.append('description',             form.description.trim());
      fd.append('status',                  String(form.status));
      fd.append('position',                form.position || '0');
      fd.append('driver_min_wallet_balance', form.driver_min_wallet_balance || '0');
      fd.append('search_area',               form.search_area               || '0');
      fd.append('booking_destroy_min',            form.booking_destroy_min              || '0');
      fd.append('user_cancel_before48_type',    form.user_cancel_before48_type      || 'flat');
      fd.append('user_cancel_before48_amount',     form.user_cancel_before48_amount       || '0');
      fd.append('user_cancel_24to48_type',     form.user_cancel_24to48_type       || 'flat');
      fd.append('user_cancel_24to48_amount',      form.user_cancel_24to48_amount        || '0');
      fd.append('user_cancel_0to24_type',             form.user_cancel_0to24_type             || 'flat');
      fd.append('user_cancel_0to24_amount',              form.user_cancel_0to24_amount              || '0');
      fd.append('driver_cancel_before48_type',    form.driver_cancel_before48_type    || 'flat');
      fd.append('driver_cancel_before48_amount',     form.driver_cancel_before48_amount     || '0');
      fd.append('driver_cancel_24to48_type',     form.driver_cancel_24to48_type     || 'flat');
      fd.append('driver_cancel_24to48_amount',      form.driver_cancel_24to48_amount      || '0');
      fd.append('driver_cancel_0to24_type',      form.driver_cancel_0to24_type      || 'flat');
      fd.append('driver_cancel_0to24_amount',       form.driver_cancel_0to24_amount       || '0');
      if (isInCity) {
        fd.append('fixed_charge',               form.fixed_charge               || '0');
        fd.append('fixed_charge_km',            form.fixed_charge_km            || '0');
        fd.append('charge_after_fixed_per_km',  form.charge_after_fixed_per_km  || '0');
        fd.append('access_fee_type',             form.access_fee_type            || 'percent');
        fd.append('access_fee',                 form.access_fee                 || '0');
        fd.append('platform_fee',               form.platform_fee               || '0');
      }
      if (form.image) fd.append('image', form.image);
      await onSave(fd);
    } catch {
      // handled in parent
    } finally {
      setLoading(false);
    }
  };

  const setF = (k: keyof typeof form, v: string | number | File | null) =>
    setForm(f => ({ ...f, [k]: v }));

  const inp = (field: string): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
    border: `1.5px solid ${errors[field] ? '#fca5a5' : '#e2e8f0'}`,
    outline: 'none', boxSizing: 'border-box', color: '#0f172a',
    background: errors[field] ? '#fff7f7' : 'white',
  });

  const numInp = (
    label: string,
    key: keyof typeof form,
    placeholder = '0.00',
  ) => (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</label>
      <input
        type="number" min="0" step="0.01"
        placeholder={placeholder}
        value={form[key] as string}
        onChange={e => setF(key, e.target.value)}
        style={{ ...inp(key as string), padding: '7px 10px' }}
      />
    </div>
  );

  const sectionHeader = (title: string, color = '#6366f1', bg = '#eef2ff') => (
    <div style={{ background: bg, borderRadius: '8px', padding: '7px 12px', fontSize: '11px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
      {title}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '540px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.16)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit Sub Service' : 'Add New Sub Service'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>{isEdit ? 'Update sub service details' : 'Fill in the details below'}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
        </div>

        {/* Parent Service Selection */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
            Parent Service <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            {services.map(s => {
              const selected = form.service_id === String(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => { setF('service_id', String(s.id)); setErrors(e => ({ ...e, service_id: '' })); }}
                  style={{ border: `1.5px solid ${selected ? '#6366f1' : '#e2e8f0'}`, borderRadius: '10px', padding: '8px 10px', cursor: 'pointer', background: selected ? '#eef2ff' : '#fafbfc', transition: 'all 0.15s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {getImageUrl(s.image)
                        ? <img src={getImageUrl(s.image)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <ImageIcon size={12} color="#6366f1" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: selected ? '#6366f1' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px' }}>{s.title}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>ID: {s.id}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {errors.service_id && <p style={{ color: '#ef4444', fontSize: '11px', margin: '6px 0 0' }}>{errors.service_id}</p>}
        </div>

        {/* Image Upload */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Sub Service Image</label>
          <div
            onClick={() => (document.getElementById('subSvcImg') as HTMLInputElement | null)?.click()}
            style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#fafbfc' }}
          >
            {imagePreview
              ? <img src={imagePreview} alt="preview" style={{ maxHeight: '80px', borderRadius: '8px', objectFit: 'cover' }} />
              : <div style={{ color: '#94a3b8', fontSize: '12px' }}><ImageIcon size={26} style={{ margin: '0 auto 6px', display: 'block' }} />Click to upload image</div>}
            <input id="subSvcImg" type="file" accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) {
                  setF('image', f);
                  setImagePreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
                }
              }}
              style={{ display: 'none' }} />
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Sub Service Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text" placeholder="e.g. scooter, bike, car" value={form.title}
            onChange={e => { setF('title', e.target.value); setErrors(ev => ({ ...ev, title: '' })); }}
            style={inp('title')}
          />
          {errors.title && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.title}</p>}
        </div>

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Description</label>
          <textarea
            rows={2} placeholder="Short description..." value={form.description}
            onChange={e => setF('description', e.target.value)}
            style={{ ...inp('description'), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>

        {/* Position */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Position</label>
          <input
            type="number" min="0" step="1" placeholder="e.g. 1 (lower shows first)" value={form.position}
            onChange={e => setF('position', e.target.value)}
            style={inp('position')}
          />
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0' }}>Controls display order — sub services are sorted by position (ascending).</p>
        </div>

        {/* ── Common Fees (all services) ── */}
        <div style={{ marginBottom: '16px' }}>
          {sectionHeader('Fees', '#6366f1', '#eef2ff')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            {numInp('Captain Min Wallet Balance', 'driver_min_wallet_balance')}
            {numInp('Search Area (km)', 'search_area')}
          </div>
        </div>

        {/* ── In City Pricing Fields ── */}
        {isInCity && (
          <div style={{ marginBottom: '16px' }}>
            {sectionHeader('In City Pricing', '#0369a1', '#f0f9ff')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {numInp('Fixed Charge (₹) Captain', 'fixed_charge')}
              {numInp('Fixed Charge Included KM Captain', 'fixed_charge_km')}
              {numInp('Charge After Fixed Per KM (₹) Captain', 'charge_after_fixed_per_km')}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Access Fee</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select
                    value={form.access_fee_type}
                    onChange={e => setF('access_fee_type', e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#0f172a', background: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="flat">Flat (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.access_fee}
                    onChange={e => setF('access_fee', e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#0f172a', background: 'white', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              {numInp('Platform Fee (₹)', 'platform_fee')}
              {numInp('Booking Destroy (min)', 'booking_destroy_min')}
            </div>
          </div>
        )}

        {/* ── User Cancellation Policy ── */}
        <div style={{ marginBottom: '16px' }}>
          {sectionHeader('User Cancellation Policy ( DITECT BY TOKEN AMT. )', '#b45309', '#fffbeb')}
          <div style={{ border: '1.5px solid #fde68a', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#fef9c3', padding: '7px 12px', borderBottom: '1px solid #fde68a' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Time Window</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Type</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Amount</span>
            </div>
            {([
              { label: 'Before 48 hrs',  typeKey: 'user_cancel_before48_type', feeKey: 'user_cancel_before48_amount' },
              { label: '24 – 48 hrs',    typeKey: 'user_cancel_24to48_type',  feeKey: 'user_cancel_24to48_amount'  },
              { label: '0 – 24 hrs',     typeKey: 'user_cancel_0to24_type',   feeKey: 'user_cancel_0to24_amount'   },
            ] as { label: string; typeKey: keyof typeof form; feeKey: keyof typeof form }[]).map((row, i) => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '8px 12px', borderBottom: i < 2 ? '1px solid #fef3c7' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#78350f' }}>{row.label}</span>
                <select
                  value={form[row.typeKey] as string}
                  onChange={e => setF(row.typeKey, e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '7px', border: '1.5px solid #fde68a', fontSize: '12px', color: '#0f172a', background: 'white', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="flat">Flat (₹)</option>
                  <option value="percent">Percentage (%)</option>
                </select>
                <input
                  type="number" min="0" step="0.01" placeholder="0"
                  value={form[row.feeKey] as string}
                  onChange={e => setF(row.feeKey, e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '7px', border: '1.5px solid #fde68a', fontSize: '12px', color: '#0f172a', background: 'white', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Captain Cancellation Policy ── */}
        <div style={{ marginBottom: '16px' }}>
          {sectionHeader('Captain Cancellation Policy ( DITECT BY WALLET AMT. )', '#0369a1', '#f0f9ff')}
          <div style={{ border: '1.5px solid #bae6fd', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#e0f2fe', padding: '7px 12px', borderBottom: '1px solid #bae6fd' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Time Window</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Type</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Amount</span>
            </div>
            {([
              { label: 'Before 48 hrs', typeKey: 'driver_cancel_before48_type', feeKey: 'driver_cancel_before48_amount' },
              { label: '24 – 48 hrs',   typeKey: 'driver_cancel_24to48_type',  feeKey: 'driver_cancel_24to48_amount'  },
              { label: '0 – 24 hrs',    typeKey: 'driver_cancel_0to24_type',   feeKey: 'driver_cancel_0to24_amount'   },
            ] as { label: string; typeKey: keyof typeof form; feeKey: keyof typeof form }[]).map((row, i) => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '8px 12px', borderBottom: i < 2 ? '1px solid #e0f2fe' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e' }}>{row.label}</span>
                <select
                  value={form[row.typeKey] as string}
                  onChange={e => setF(row.typeKey, e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '7px', border: '1.5px solid #bae6fd', fontSize: '12px', color: '#0f172a', background: 'white', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="flat">Flat (₹)</option>
                  <option value="percent">Percentage (%)</option>
                </select>
                <input
                  type="number" min="0" step="0.01" placeholder="0"
                  value={form[row.feeKey] as string}
                  onChange={e => setF(row.feeKey, e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '7px', border: '1.5px solid #bae6fd', fontSize: '12px', color: '#0f172a', background: 'white', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Status</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([{ val: 1, label: 'Active' }, { val: 0, label: 'Inactive' }] as const).map(({ val, label }) => (
              <button key={val} onClick={() => setF('status', val)}
                style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#e2e8f0'}`, background: form.status === val ? (val === 1 ? '#eef2ff' : '#fff1f2') : 'white', color: form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#94a3b8' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={14} /> {isEdit ? 'Update Sub Service' : 'Create Sub Service'}</>}
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
                      {b.service_name && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{b.service_name}</div>}
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

// ─── INLINE POSITION CELL ─────────────────────────────────────────────────────
function PositionCell({ subService, saving, onSave }: {
  subService: SubService;
  saving: boolean;
  onSave: (newPos: number) => void;
}) {
  const initial = subService.position != null ? String(subService.position) : '';
  const [val, setVal] = useState(initial);

  useEffect(() => {
    setVal(subService.position != null ? String(subService.position) : '');
  }, [subService.position]);

  const commit = () => {
    const n = val.trim() === '' ? 0 : Number(val);
    if (!Number.isNaN(n) && n !== (subService.position ?? 0)) onSave(n);
    else setVal(subService.position != null ? String(subService.position) : '');
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
      <input
        type="number"
        min="0"
        step="1"
        value={val}
        disabled={saving}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        onBlur={commit}
        title="Edit position, press Enter to save"
        style={{
          width: '58px', textAlign: 'center', padding: '4px 6px', borderRadius: '8px',
          border: '1.5px solid #c7d2fe', background: '#eef2ff', color: '#6366f1',
          fontSize: '12px', fontWeight: 700, outline: 'none',
          opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'text',
        }}
      />
      {saving && <Loader2 size={13} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function SubServiceList() {
  const [subServices,     setSubServices]     = useState<SubService[]>([]);
  const [services,        setServices]        = useState<Service[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [filterServiceId, setFilterServiceId] = useState<number | null>(null);
  const [page,            setPage]            = useState(1);
  const [modal,           setModal]           = useState<SubServiceModalState>(null);
  const [actionLoading,   setActionLoading]   = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<number | null>(null);
  const [savingPosId,     setSavingPosId]     = useState<number | null>(null);
  const [toast,           setToast]           = useState<ToastState | null>(null);
  const [bookingCounts,     setBookingCounts]     = useState<Record<string, number>>({});
  const [allBookings,       setAllBookings]       = useState<BookingItem[]>([]);
  const [viewBookingsFor,   setViewBookingsFor]   = useState<SubService | null>(null);
  const PER_PAGE = 8;

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type }),
    []
  );

  const serviceMap = useMemo(() => {
    const m: Record<number, Service> = {};
    services.forEach(s => { m[s.id] = s; });
    return m;
  }, [services]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [svcData, subSvcData, bookingsRes] = await Promise.all([
        getAllServices({}),
        getAllSubServices(),
        getAllBookinghistory(),
      ]);

      console.log('🔵 RAW svcData:', svcData);
      console.log('🔵 RAW subSvcData:', subSvcData);

      // getAllServices returns raw axios response → .data is the body
      const svcBody = (svcData as { data: unknown }).data;
      console.log('🟡 svcBody:', svcBody);
      const svcList: Service[] =
        Array.isArray(svcBody) ? svcBody :
        Array.isArray((svcBody as { data?: Service[] })?.data) ? (svcBody as { data: Service[] }).data : [];
      console.log('🟢 svcList:', svcList);
      setServices(svcList);

      // getAllSubServices already does .then(r => r.data) → body is subSvcData
      console.log('🟡 subSvcData direct:', subSvcData);
      const subList: SubService[] =
        Array.isArray(subSvcData) ? subSvcData :
        Array.isArray((subSvcData as { data?: SubService[] })?.data) ? (subSvcData as { data: SubService[] }).data : [];
      console.log('🟢 subList:', subList);
      setSubServices(subList);

      // getAllBookinghistory returns raw axios response
      const bookBody = (bookingsRes as { data: unknown }).data;
      const rawBookings: BookingItem[] =
        Array.isArray(bookBody) ? bookBody :
        Array.isArray((bookBody as { data?: unknown[] })?.data) ? (bookBody as { data: BookingItem[] }).data : [];
      const list = Array.isArray(rawBookings) ? rawBookings : [];
      setAllBookings(list);
      const counts: Record<string, number> = {};
      list.forEach(b => {
        if (b.plan_name) counts[b.plan_name] = (counts[b.plan_name] || 0) + 1;
      });
      setBookingCounts(counts);
    } catch (err) {
      console.error('❌ fetchAll error:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (fd: FormData) => {
    console.log('📤 SubService Create — FormData:');
    fd.forEach((val, key) => console.log(`  ${key}:`, val));
    try {
      const res = await createSubService(fd);
      console.log('📥 SubService Create — Response:', res);
      setModal(null);
      showToast('Sub service created successfully!');
      await fetchAll();
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to create sub service'), 'error');
      throw err;
    }
  };

  const handleUpdate = async (fd: FormData) => {
    if (!modal || modal.type !== 'edit') return;
    console.log('📤 SubService Update — FormData:');
    fd.forEach((val, key) => console.log(`  ${key}:`, val));
    try {
      const res = await updateSubService(modal.subService.id, fd);
      console.log('📥 SubService Update — Response:', res);
      setModal(null);
      showToast('Sub service updated successfully!');
      await fetchAll();
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to update sub service'), 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== 'delete') return;
    setActionLoading(true);
    try {
      await deleteSubService(modal.subService.id);
      setSubServices(prev => prev.filter(s => s.id !== modal.subService.id));
      setModal(null);
      showToast('Sub service deleted successfully!');
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to delete sub service'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Inline position update — backend keeps all other fields (partial-friendly)
  const handlePositionSave = async (subService: SubService, newPos: number) => {
    if (Number.isNaN(newPos) || newPos === (subService.position ?? 0)) return;
    setSavingPosId(subService.id);
    try {
      const fd = new FormData();
      fd.append('position', String(newPos));
      await updateSubService(subService.id, fd);
      setSubServices(prev => prev.map(s => s.id === subService.id ? { ...s, position: newPos } : s));
      showToast('Position updated!');
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to update position'), 'error');
    } finally {
      setSavingPosId(null);
    }
  };

  const handleToggle = async (subService: SubService) => {
    setToggleLoadingId(subService.id);
    try {
      const res = await toggleSubServiceStatus(subService.id); // ✅ Remove status argument

      const newStatus: number =
        (res as { data?: { data?: { status: number } } })?.data?.data?.status ??
        (res as { data?: { status: number } })?.data?.status ??
        (subService.status === 1 ? 0 : 1);

      setSubServices(prev => prev.map(s => s.id === subService.id ? { ...s, status: newStatus } : s));
      showToast(`Sub service ${newStatus === 1 ? 'activated' : 'deactivated'}!`);
    } catch (err) {
      showToast(getErrMsg(err, 'Failed to update status'), 'error');
    } finally {
      setToggleLoadingId(null);
    }
  };

  const filtered = useMemo(() => subServices.filter(s => {
    const matchSearch =
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      serviceMap[s.service_id]?.title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterServiceId == null || s.service_id === filterServiceId;
    return matchSearch && matchFilter;
  }).sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999)), [subServices, search, filterServiceId, serviceMap]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    if (page > 1 && paginated.length === 0 && filtered.length > 0) {
      setPage(Math.ceil(filtered.length / PER_PAGE));
    }
  }, [filtered.length, page, paginated.length]);

  type ColAlign = React.CSSProperties['textAlign'];
  const cols: { label: string; align: ColAlign }[] = [
    { label: 'Sub Service',    align: 'left'   },
    { label: 'Position',          align: 'center' },
    { label: 'Parent Service', align: 'left'   },
    { label: 'Description',    align: 'left'   },
    { label: 'Bookings',          align: 'center' },
    { label: 'Booking Destroy',   align: 'center' },
    { label: 'Status',            align: 'left'   },
    { label: 'Created',        align: 'left'   },
    { label: 'Actions',        align: 'right'  },
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
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Sub Services</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Manage sub services under each parent service</p>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total <b>{filtered.length}</b> sub services</p>
          <div className="responsive-toolbar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={filterServiceId ?? ''}
              onChange={e => { setFilterServiceId(e.target.value ? Number(e.target.value) : null); setPage(1); }}
              style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', color: '#475569', outline: 'none', background: 'white', cursor: 'pointer' }}
            >
              <option value="">All Services</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>

            <div className="responsive-search" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px' }}>
              <Search size={14} color="#94a3b8" />
              <input
                placeholder="Search sub services..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ border: 'none', outline: 'none', fontSize: '12px', width: '180px' }}
              />
            </div>

            <button
              onClick={() => setModal({ type: 'add' })}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}
            >
              <Plus size={16} /> Add Sub Service
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="responsive-table-card" style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <table className="mobile-card-table subservice-mobile-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{ height: '14px', borderRadius: '6px', background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 0 ? '55%' : '40%' }} />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && paginated.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Layers size={32} color="#e2e8f0" />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                        {search || filterServiceId ? 'No sub services match your filters.' : 'No sub services found. Add your first one!'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && paginated.map((subSvc) => {
                const imgUrl = getImageUrl(subSvc.image);
                const parentService = serviceMap[subSvc.service_id];
                return (
                  <tr key={subSvc.id} className="svc-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {/* Sub Service */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {imgUrl
                            ? <img src={imgUrl} alt={subSvc.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : <Layers size={16} color="#6366f1" />}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{subSvc.title}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>ID: {subSvc.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <PositionCell
                        subService={subSvc}
                        saving={savingPosId === subSvc.id}
                        onSave={(newPos) => handlePositionSave(subSvc, newPos)}
                      />
                    </td>

                    {/* Parent Service */}
                    <td style={{ padding: '12px 16px' }}>
                      {parentService ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '6px', overflow: 'hidden', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {getImageUrl(parentService.image)
                              ? <img src={getImageUrl(parentService.image)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              : <ImageIcon size={12} color="#6366f1" />}
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1' }}>{parentService.title}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>ID: {subSvc.service_id}</div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Service #{subSvc.service_id}</span>
                      )}
                    </td>

                    {/* Description */}
                    <td style={{ padding: '12px 16px', maxWidth: '180px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {subSvc.description && subSvc.description !== 'NA'
                          ? subSvc.description
                          : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No description</span>}
                      </span>
                    </td>

                    {/* Bookings */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {(() => {
                        const count = bookingCounts[subSvc.title] || 0;
                        return (
                          <button
                            onClick={() => setViewBookingsFor(subSvc)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                              background: count ? '#eef2ff' : '#f1f5f9',
                              color:      count ? '#6366f1' : '#94a3b8',
                              minWidth: '32px', border: 'none',
                              cursor: count ? 'pointer' : 'default',
                              transition: 'all 0.15s',
                            }}
                            title={count ? 'View bookings' : 'No bookings'}
                          >
                            {count}
                          </button>
                        );
                      })()}
                    </td>

                    {/* Booking Destroy */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {subSvc.booking_destroy_min != null && subSvc.booking_destroy_min !== 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', border: '1.5px solid #fde68a' }}>{subSvc.booking_destroy_min} min</span>
                        : <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleToggle(subSvc)}
                        disabled={toggleLoadingId === subSvc.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: subSvc.status === 1 ? '#d1fae5' : '#f1f5f9', color: subSvc.status === 1 ? '#065f46' : '#64748b', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: toggleLoadingId === subSvc.id ? 0.6 : 1, transition: 'all 0.2s' }}
                      >
                        {toggleLoadingId === subSvc.id
                          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : subSvc.status === 1 ? <Eye size={12} /> : <EyeOff size={12} />}
                        {subSvc.status === 1 ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Created At */}
                    <td style={{ padding: '12px 16px' }}>
                      {subSvc.created_at
                        ? <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(subSvc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        : <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="action-btn" onClick={() => setModal({ type: 'edit', subService: subSvc })} style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                        <button className="action-btn" onClick={() => setModal({ type: 'delete', subService: subSvc })} style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="responsive-pagination" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Page <b>{page}</b> of <b>{totalPages || 1}</b> · <b>{filtered.length}</b> results</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
              <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'add'    && <SubServiceModal mode="add"  services={services} onClose={() => setModal(null)} onSave={handleCreate} />}
      {modal?.type === 'edit'   && <SubServiceModal mode="edit" subService={modal.subService} services={services} onClose={() => setModal(null)} onSave={handleUpdate} />}
      {modal?.type === 'delete' && <DeleteModal title={modal.subService?.title} onClose={() => setModal(null)} onConfirm={handleDelete} loading={actionLoading} />}

      {viewBookingsFor && (
        <BookingsModal
          title={viewBookingsFor.title}
          bookings={allBookings.filter(b => b.plan_name === viewBookingsFor.title)}
          onClose={() => setViewBookingsFor(null)}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
