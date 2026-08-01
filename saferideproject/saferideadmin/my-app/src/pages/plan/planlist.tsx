import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Edit2, Trash2, Plus, Search, ChevronLeft, ChevronRight,
  Image as ImageIcon, Eye, EyeOff, X, Save, Loader2,
  AlertCircle, CheckCircle2, Clock, MapPin, Coins, RefreshCw
} from 'lucide-react';
import {
  getAllPlans, createPlan, updatePlan,
  deletePlan, togglePlanStatus,
} from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Plan {
  id: number;
  service_id?: number;
  sub_service_id?: number;
  plan_name: string;
  plan_hour?: string;
  plan_km?: string;
  token_price?: number;
  topup_price_perkm?: number;
  plan_price: string;
  description?: string;
  booking_destroy_time?: number | null;
  platform_fee?: number | null;
  access_fee?: number | null;
  access_fee_type?: string | null;
  topup_captain_commission?: number | null;
  topup_company_commission?: number | null;
  plan_captain_commission?: number | null;
  plan_company_commission?: number | null;
  status: number;
  image?: string;
}

interface ServiceOption    { id: number; title: string; }
interface SubServiceOption { id: number; title: string; service_id: number; position?: number | null; }
interface ToastType        { message: string; type: string; }
interface ModalState       { type: 'add' | 'edit' | 'delete'; plan?: Plan; }
interface FormErrors       { plan_name?: string; plan_price?: string; token_price?: string; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const BASE_URL       = import.meta.env.VITE_API_URL;
const IMAGE_BASE_URL = 'http://91.108.104.79:3000/uploads/plan/';
const getToken       = () => localStorage.getItem('token');

const apiGet = (path: string) =>
  fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
  }).then(r => r.json());

const getImageUrl = (image?: string): string | null => {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  return `${IMAGE_BASE_URL}${image}`;
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }: { toast: ToastType; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const ok = toast.type === 'success';
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '10px',
      background: ok ? '#f0fdf4' : '#fff1f2',
      border: `1.5px solid ${ok ? '#bbf7d0' : '#fecdd3'}`,
      borderRadius: '12px', padding: '12px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: '320px',
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

// ─── PLAN MODAL ───────────────────────────────────────────────────────────────
function PlanModal({ mode, plan, allServices, onClose, onSave }: {
  mode: 'add' | 'edit';
  plan?: Plan;
  allServices: ServiceOption[];
  onClose: () => void;
  onSave: (fd: FormData) => Promise<void>;
}) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    service_id:        String(plan?.service_id        ?? ''),
    sub_service_id:    String(plan?.sub_service_id    ?? ''),
    plan_name:         isEdit ? (plan?.plan_name || '') : '',
    plan_hour:         plan?.plan_hour                || '',
    plan_km:           plan?.plan_km                  || '',
    token_price:              String(plan?.token_price              ?? ''),
    topup_price_perkm:        String(plan?.topup_price_perkm        ?? ''),
    topup_captain_commission: String(plan?.topup_captain_commission ?? ''),
    topup_company_commission: String(plan?.topup_company_commission ?? ''),
    plan_price:               plan?.plan_price                      || '',
    plan_captain_commission:  String(plan?.plan_captain_commission  ?? ''),
    plan_company_commission:  String(plan?.plan_company_commission  ?? ''),
    platform_fee:             String(plan?.platform_fee             ?? ''),
    access_fee:               String(plan?.access_fee               ?? ''),
    access_fee_type:          plan?.access_fee_type                 || 'percent',
    description:              plan?.description                     || '',
    booking_destroy_time:     String(plan?.booking_destroy_time     ?? ''),
    status:                   plan?.status                          ?? 1,
    image:                    null as File | null,
  });

  const [subServices,  setSubServices]  = useState<SubServiceOption[]>([]);
  const [subLoading,   setSubLoading]   = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(getImageUrl(plan?.image) || null);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState<FormErrors>({});

  // Load sub-services when service_id changes
  useEffect(() => {
    if (!form.service_id) { setSubServices([]); return; }
    setSubLoading(true);
    apiGet(`/allsubservices/${form.service_id}`)
      .then(res => {
        let list: SubServiceOption[] = [];
        if (Array.isArray(res))            list = res;
        else if (Array.isArray(res?.data)) list = res.data;
        setSubServices(list);
      })
      .catch(() => setSubServices([]))
      .finally(() => setSubLoading(false));
  }, [form.service_id]);

  // On edit: load sub-services for existing service
  useEffect(() => {
    if (isEdit && plan?.service_id) {
      setSubLoading(true);
      apiGet(`/allsubservices/${plan.service_id}`)
        .then(res => {
          let list: SubServiceOption[] = [];
          if (Array.isArray(res))            list = res;
          else if (Array.isArray(res?.data)) list = res.data;
          setSubServices(list);
        })
        .catch(() => setSubServices([]))
        .finally(() => setSubLoading(false));
    }
  }, []);

  const set = (key: string, val: string | number | File | null) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleServiceChange = (val: string) => {
    set('service_id', val);
    set('sub_service_id', '');
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.plan_name.trim()) e.plan_name   = 'Plan name is required';
    if (!form.plan_price)       e.plan_price  = 'Plan price is required';
    if (!form.token_price)      e.token_price = 'Token price is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    set('image', file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'image') { if (v) fd.append('image', v as File); return; }
        if (v !== '') fd.append(k, String(v));
      });
      await onSave(fd);
    } catch { /* parent handles */ } finally { setLoading(false); }
  };

  const inputStyle = (key: keyof FormErrors): React.CSSProperties => ({
    border: `1.5px solid ${errors[key] ? '#fca5a5' : '#e2e8f0'}`,
    background: errors[key] ? '#fff7f7' : 'white',
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#0f172a',
  });

  const baseInput: React.CSSProperties = {
    border: '1.5px solid #e2e8f0', background: 'white',
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#0f172a',
  };

  const selectStyle: React.CSSProperties = {
    ...baseInput, cursor: 'pointer', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    paddingRight: '32px',
  };

  const lbl = (text: string, req?: boolean) => (
    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
      {text}{req && <span style={{ color: '#ef4444' }}> *</span>}
    </label>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '28px',
        width: '540px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,0.16)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              {isEdit ? 'Edit Plan' : 'Add New Plan'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              {isEdit ? 'Update plan details' : 'Fill in the details below'}
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
            <X size={16} color="#64748b" />
          </button>
        </div>

        {/* Image Upload */}
        <div style={{ marginBottom: '16px' }}>
          {lbl('Plan Image')}
          <div
            onClick={() => (document.getElementById('planImgInput') as HTMLInputElement)?.click()}
            style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#fafbfc' }}
          >
            {imagePreview
              ? <img src={imagePreview} alt="preview" style={{ maxHeight: '80px', borderRadius: '8px', objectFit: 'cover' }} />
              : <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                  <ImageIcon size={26} style={{ margin: '0 auto 6px', display: 'block' }} />
                  Click to upload plan image
                </div>
            }
            <input id="planImgInput" type="file" accept="image/*"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }} />
          </div>
        </div>

        {/* Plan Name */}
        <div style={{ marginBottom: '14px' }}>
          {lbl('Plan Name', true)}
          <input type="text" placeholder="e.g. Basic Ride" value={form.plan_name}
            onChange={e => { set('plan_name', e.target.value); setErrors(v => ({ ...v, plan_name: '' })); }}
            style={inputStyle('plan_name')} />
          {errors.plan_name && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.plan_name}</p>}
        </div>
        {/* Service + Sub Service */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            {lbl('Service')}
            <select value={form.service_id} onChange={e => handleServiceChange(e.target.value)} style={selectStyle}>
              <option value="">-- Select Service --</option>
              {allServices.map(s => {
                const isInCity = s.title?.toLowerCase().includes('in city');
                return (
                  <option key={s.id} value={s.id} disabled={isInCity}>
                    {s.title}{isInCity ? ' (Not Available)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            {lbl('Sub Service')}
            <div style={{ position: 'relative' }}>
              <select
                value={form.sub_service_id}
                onChange={e => set('sub_service_id', e.target.value)}
                disabled={!form.service_id || subLoading}
                style={{
                  ...selectStyle,
                  opacity: (!form.service_id || subLoading) ? 0.6 : 1,
                  cursor:  (!form.service_id || subLoading) ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="">
                  {subLoading ? 'Loading...' : !form.service_id ? 'Select service first' : '-- Select Sub Service --'}
                </option>
                {subServices.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              {subLoading && (
                <div style={{ position: 'absolute', right: '30px', top: '50%', transform: 'translateY(-50%)' }}>
                  <Loader2 size={12} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plan Hour + KM */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            {lbl('Plan Hours')}
            <input type="text" placeholder="e.g. 4" value={form.plan_hour}
              onChange={e => set('plan_hour', e.target.value)} style={baseInput} />
          </div>
          <div>
            {lbl('Plan KM')}
            <input type="text" placeholder="e.g. 50" value={form.plan_km}
              onChange={e => set('plan_km', e.target.value)} style={baseInput} />
          </div>
        </div>
        {/* Plan Price Section */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Plan Price</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              {lbl('Plan Price', true)}
              <input type="text" placeholder="e.g. 499" value={form.plan_price}
                onChange={e => { set('plan_price', e.target.value); setErrors(v => ({ ...v, plan_price: '' })); }}
                style={inputStyle('plan_price')} />
              {errors.plan_price && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.plan_price}</p>}
            </div>
            <div>
              {lbl('Captain Commission')}
              <input type="number" placeholder="e.g. 80" value={form.plan_captain_commission}
                onChange={e => set('plan_captain_commission', e.target.value)} style={baseInput} />
            </div>
            <div>
              {lbl('Company Commission')}
              <input type="number" placeholder="e.g. 20" value={form.plan_company_commission}
                onChange={e => set('plan_company_commission', e.target.value)} style={baseInput} />
            </div>
          </div>
        </div>
        {/* Token Price */}
        <div style={{ marginBottom: '14px' }}>
          {lbl('Token Price', true)}
          <input type="number" placeholder="e.g. 100" value={form.token_price}
            onChange={e => { set('token_price', e.target.value); setErrors(v => ({ ...v, token_price: '' })); }}
            style={inputStyle('token_price')} />
          {errors.token_price && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.token_price}</p>}
        </div>

        {/* Topup Section */}
        <div style={{ background: '#f8faff', border: '1.5px solid #e0e7ff', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Topup Price</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              {lbl('Topup Price/KM')}
              <input type="number" placeholder="e.g. 5" value={form.topup_price_perkm}
                onChange={e => set('topup_price_perkm', e.target.value)} style={baseInput} />
            </div>
            <div>
              {lbl('Captain Commission')}
              <input type="number" placeholder="e.g. 80" value={form.topup_captain_commission}
                onChange={e => set('topup_captain_commission', e.target.value)} style={baseInput} />
            </div>
            <div>
              {lbl('Company Commission')}
              <input type="number" placeholder="e.g. 20" value={form.topup_company_commission}
                onChange={e => set('topup_company_commission', e.target.value)} style={baseInput} />
            </div>
          </div>
        </div>

        {/* Platform Fee + Access Fee */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            {lbl('Platform Fee (₹)')}
            <input type="number" placeholder="e.g. 10" value={form.platform_fee}
              onChange={e => set('platform_fee', e.target.value)} style={baseInput} />
          </div>
          <div>
            {lbl('Access Fee')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <select
                value={form.access_fee_type}
                onChange={e => set('access_fee_type', e.target.value)}
                style={{ ...baseInput, cursor: 'pointer' }}
              >
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percent (%)</option>
              </select>
              <input type="number" placeholder="e.g. 5" value={form.access_fee}
                onChange={e => set('access_fee', e.target.value)} style={baseInput} />
            </div>
          </div>
        </div>

        {/* Booking Destroy Time */}
        <div style={{ marginBottom: '14px' }}>
          {lbl('Booking Destroy Time (min)')}
          <input type="number" min="0" placeholder="e.g. 10" value={form.booking_destroy_time}
            onChange={e => set('booking_destroy_time', e.target.value)} style={baseInput} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '14px' }}>
          {lbl('Description')}
          <textarea rows={3} placeholder="Short description..." value={form.description}
            onChange={e => set('description', e.target.value)}
            style={{ ...baseInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
        </div>

        {/* Status */}
        <div style={{ marginBottom: '24px' }}>
          {lbl('Status')}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ val: 1, l: 'Active' }, { val: 0, l: 'Inactive' }].map(({ val, l }) => (
              <button key={val} onClick={() => set('status', val)} style={{
                flex: 1, padding: '8px 4px', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#e2e8f0'}`,
                background: form.status === val ? (val === 1 ? '#eef2ff' : '#fff1f2') : 'white',
                color: form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#94a3b8',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            border: '1.5px solid #e2e8f0', background: 'white',
            color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
            background: loading ? '#c7d2fe' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: 'white', fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : <><Save size={14} /> {isEdit ? 'Update Plan' : 'Create Plan'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────
function DeleteModal({ plan, onClose, onConfirm, loading }: {
  plan?: Plan; onClose: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '360px', boxShadow: '0 24px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete Plan?</h3>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
          Are you sure you want to delete <b>"{plan?.plan_name}"</b>?<br />This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: loading ? '#fca5a5' : '#ef4444', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</> : <><Trash2 size={13} /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PlanList() {
  const [plans,           setPlans]           = useState<Plan[]>([]);
  const [allServices,     setAllServices]     = useState<ServiceOption[]>([]);
  const [allSubServices,  setAllSubServices]  = useState<SubServiceOption[]>([]); // ← NEW
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [filterServiceId,    setFilterServiceId]    = useState<number | null>(null);
  const [filterSubServiceId, setFilterSubServiceId] = useState<number | null>(null);
  const [page,            setPage]            = useState(1);
  const [modal,           setModal]           = useState<ModalState | null>(null);
  const [actionLoading,   setActionLoading]   = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<number | null>(null);
  const [toast,           setToast]           = useState<ToastType | null>(null);
  const PER_PAGE = 7;

  const showToast = useCallback((message: string, type = 'success') =>
    setToast({ message, type }), []);

  // ── Fetch services + all their sub-services in parallel ──────────────────
  const fetchServices = useCallback(async () => {
    try {
      const json = await apiGet('/allservices');
      let list: ServiceOption[] = [];
      if (json.status && Array.isArray(json.data)) list = json.data;
      else if (Array.isArray(json.data))           list = json.data;
      else if (Array.isArray(json))                list = json;
      setAllServices(list);

      // Fetch sub-services for every service in parallel
      const subResults = await Promise.all(
        list.map(s => apiGet(`/allsubservices/${s.id}`).catch(() => []))
      );
      const allSubs: SubServiceOption[] = subResults.flatMap(res =>
        Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      );
      setAllSubServices(allSubs);
    } catch { /* silent */ }
  }, []);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllPlans();
      let list: Plan[] = [];
      if (Array.isArray(data))                  list = data;
      else if (Array.isArray(data?.data))       list = data.data;
      else if (Array.isArray(data?.data?.data)) list = data.data.data;
      setPlans(list);
    } catch {
      showToast('Failed to load plans', 'error');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchPlans(); fetchServices(); }, [fetchPlans, fetchServices]);

  const handleCreate = async (formData: FormData) => {
    try {
      const res = await createPlan(formData);
      const newPlan = res?.data?.data || res?.data || res;
      if (newPlan?.id) setPlans(prev => [newPlan, ...prev]);
      else await fetchPlans();
      setModal(null);
      showToast('Plan created successfully!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create plan', 'error');
      throw err;
    }
  };

  const handleUpdate = async (formData: FormData) => {
    try {
      const res = await updatePlan(modal!.plan!.id, formData);
      const updated = res?.data?.data || res?.data || res;
      if (updated?.id) setPlans(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      else await fetchPlans();
      setModal(null);
      showToast('Plan updated successfully!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update plan', 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!modal?.plan) return;
    setActionLoading(true);
    try {
      await deletePlan(modal.plan.id);
      setPlans(prev => prev.filter(p => p.id !== modal.plan!.id));
      setModal(null);
      showToast('Plan deleted successfully!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete plan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (plan: Plan) => {
    setToggleLoadingId(plan.id);
    try {
      const res = await togglePlanStatus(plan.id, plan.status);
      const newStatus = res?.data?.data?.status ?? (plan.status === 1 ? 0 : 1);
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: newStatus } : p));
      showToast(`Plan ${newStatus === 1 ? 'activated' : 'deactivated'}!`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    } finally {
      setToggleLoadingId(null);
    }
  };

  // Sub-services belonging to the service selected in the filter, ordered by position
  const filterSubOptions = useMemo(() => {
    if (filterServiceId == null) return [];
    return allSubServices
      .filter(s => s.service_id === filterServiceId)
      .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
  }, [allSubServices, filterServiceId]);

  const filteredData  = useMemo(() => plans.filter(p => {
    const matchSearch  = p.plan_name?.toLowerCase().includes(search.toLowerCase());
    const matchService = filterServiceId == null || p.service_id === filterServiceId;
    const matchSub     = filterSubServiceId == null || p.sub_service_id === filterSubServiceId;
    return matchSearch && matchService && matchSub;
  }), [plans, search, filterServiceId, filterSubServiceId]);
  const totalPages    = Math.ceil(filteredData.length / PER_PAGE);
  const paginatedData = filteredData.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Name helpers ──────────────────────────────────────────────────────────
  const getServiceName = (id?: number) =>
    allServices.find(s => s.id === id)?.title || (id ? `#${id}` : '—');

  // ← NEW: look up sub-service title from the pre-fetched list
  const getSubServiceName = (id?: number) =>
    allSubServices.find(s => s.id === id)?.title || (id ? `#${id}` : '—');

  return (
    <>
      <style>{`
        @keyframes spin        { to { transform: rotate(360deg) } }
        @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .plan-row:hover td     { background: #fafbff !important; }
        .action-btn:hover      { transform: scale(1.08); transition: transform 0.15s; }
      `}</style>

      <div className="responsive-page" style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Plans</h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>Total <b>{filteredData.length}</b> plans</p>
          </div>
          <div className="responsive-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Service filter */}
            <select
              value={filterServiceId ?? ''}
              onChange={e => {
                setFilterServiceId(e.target.value ? Number(e.target.value) : null);
                setFilterSubServiceId(null);
                setPage(1);
              }}
              style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', color: '#475569', outline: 'none', background: 'white', cursor: 'pointer' }}
            >
              <option value="">All Services</option>
              {allServices.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>

            {/* Sub Service filter (depends on selected service, ordered by position) */}
            <select
              value={filterSubServiceId ?? ''}
              onChange={e => { setFilterSubServiceId(e.target.value ? Number(e.target.value) : null); setPage(1); }}
              disabled={filterServiceId == null}
              style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', color: '#475569', outline: 'none', background: 'white', cursor: filterServiceId == null ? 'not-allowed' : 'pointer', opacity: filterServiceId == null ? 0.6 : 1 }}
            >
              <option value="">{filterServiceId == null ? 'Select service first' : 'All Sub Services'}</option>
              {filterSubOptions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>

            <div className="responsive-search" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px' }}>
              <Search size={14} color="#94a3b8" />
              <input placeholder="Search plans..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ border: 'none', outline: 'none', fontSize: '12px', width: '180px', background: 'transparent' }} />
            </div>
            <button onClick={fetchPlans} title="Refresh"
              style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={() => setModal({ type: 'add', plan: plans[0] })} style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600,
            }}>
              <Plus size={16} /> Add Plan
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="responsive-table-card" style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <table className="mobile-card-table plan-mobile-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                {([
                  { label: '#',           align: 'left'   },
                  { label: 'Plan',        align: 'left'   },
                  { label: 'Service',     align: 'left'   },
                  { label: 'Sub Service', align: 'left'   }, // ← replaced Driver Amt
                  { label: 'Hours/KM',    align: 'left'   },
                  { label: 'Token',       align: 'center' },
                  { label: 'Topup/KM',    align: 'center' },
                  { label: 'Price',       align: 'center' },
                  { label: 'Status',      align: 'center' },
                  { label: 'Actions',     align: 'right'  },
                ] as { label: string; align: React.CSSProperties['textAlign'] }[]).map(({ label, align }) => (
                  <th key={label} style={{ padding: '12px 14px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', textAlign: align }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: PER_PAGE }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} style={{ padding: '14px' }}>
                      <div style={{ height: '14px', borderRadius: '6px', background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 1 ? '60%' : '45%' }} />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    {search ? 'No plans match your search.' : 'No plans found. Add your first one!'}
                  </td>
                </tr>
              )}

              {!loading && paginatedData.map((plan, idx) => {
                const imgUrl = getImageUrl(plan.image);
                return (
                  <tr key={plan.id} className="plan-row" style={{ borderBottom: '1px solid #f1f5f9' }}>

                    {/* # */}
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#94a3b8' }}>
                      {(page - 1) * PER_PAGE + idx + 1}
                    </td>

                    {/* Plan name + image */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {imgUrl
                            ? <img src={imgUrl} alt={plan.plan_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : <ImageIcon size={16} color="#6366f1" />}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{plan.plan_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {plan.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Service */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                        {getServiceName(plan.service_id)}
                      </div>
                    </td>

                    {/* Sub Service ← replaced Driver Amt */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                        {getSubServiceName(plan.sub_service_id)}
                      </div>
                    </td>

                    {/* Hours / KM */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} color="#6366f1" /> {plan.plan_hour || '—'} hr
                        </span>
                        <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={11} color="#8b5cf6" /> {plan.plan_km || '—'} km
                        </span>
                      </div>
                    </td>

                    {/* Token */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eef2ff', color: '#6366f1', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', border: '1.5px solid #c7d2fe' }}>
                        <Coins size={11} /> {plan.token_price ?? '—'}
                      </span>
                    </td>

                    {/* Topup/KM */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                      {plan.topup_price_perkm != null ? `₹${plan.topup_price_perkm}` : '—'}
                    </td>

                    {/* Price */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>₹{plan.plan_price || '—'}</span>
                    </td>

                    {/* Status toggle */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button onClick={() => handleToggleStatus(plan)} disabled={toggleLoadingId === plan.id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                          background: plan.status === 1 ? '#d1fae5' : '#f1f5f9',
                          color:      plan.status === 1 ? '#065f46' : '#64748b',
                          fontSize: '11px', fontWeight: 600,
                          opacity: toggleLoadingId === plan.id ? 0.6 : 1,
                        }}>
                        {toggleLoadingId === plan.id
                          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : plan.status === 1 ? <Eye size={12} /> : <EyeOff size={12} />}
                        {plan.status === 1 ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="action-btn" onClick={() => setModal({ type: 'edit', plan })}
                          style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="action-btn" onClick={() => setModal({ type: 'delete', plan })}
                          style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="responsive-pagination" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Page <b>{page}</b> of <b>{totalPages || 1}</b> · <b>{filteredData.length}</b> results
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {modal?.type === 'add'    && <PlanModal mode="add"  allServices={allServices} plan={modal.plan} onClose={() => setModal(null)} onSave={handleCreate} />}
      {modal?.type === 'edit'   && <PlanModal mode="edit" allServices={allServices} plan={modal.plan} onClose={() => setModal(null)} onSave={handleUpdate} />}
      {modal?.type === 'delete' && <DeleteModal plan={modal.plan} onClose={() => setModal(null)} onConfirm={handleDelete} loading={actionLoading} />}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
