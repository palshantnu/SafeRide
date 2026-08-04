import React, { useState, useMemo, useEffect, CSSProperties } from 'react';
import {
  Edit2, Trash2, Plus, Search, UserCheck,
  ChevronLeft, ChevronRight, Phone, RefreshCw,
  X, Save, AlertTriangle, Car, BookOpen,
  Calendar, Clock, CheckCircle, XCircle, MapPin, Users,
  FileText, ShieldCheck, Download, Eye
} from 'lucide-react';
import { usePermissions } from '../../context/PermissionsContext';

const BASE_URL = import.meta.env.VITE_API_URL|| "https://sigiride.com/api";
const getToken = () => localStorage.getItem('token');

// ─── Types ────────────────────────────────────────────────────────────────────
interface Service {
  id: number;
  service_id: number;
  service_name: string;
  commission_rate: number;
  title?: string;
}

interface BA {
  id: number;
  ba_name: string;
  ba_mobile: string;
  pincode: string;
  status?: number;
  kyc_status?: string | null; // 'pending' | 'approved' | 'rejected' | null (not submitted)
  created_at?: string;
  services?: Service[];
}

interface SelectedService {
  service_id: number;
  commission_rate: number | string;
}

interface BADriver {
  id: number;
  full_name?: string;
  phone?: string;
  status?: string;
  is_online?: boolean;
  service_name?: string;
  total_bookings?: number;
  completed_bookings?: number;
  bookings?: BABooking[];
}

interface BABooking {
  id: number;
  booking_id?: string;
  customer_name?: string;
  user_name?: string;
  pickup?: string;
  pickup_city?: string;
  drop?: string;
  drop_city?: string;
  amount?: number;
  balance_amount?: number;
  status?: string;
  created_at?: string;
  service_name?: string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
const apiGet = (path: string) =>
  fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
  }).then((r) => r.json());

const apiPost = (path: string, body: object) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const apiPut = (path: string, body: object) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const apiDelete = (path: string) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
  }).then((r) => r.json());

const apiPatch = (path: string, body: object) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

// ─── KYC Documents ──────────────────────────────────────────────────────────────
// NOTE: backend stores only image filenames; adjust this base if the upload folder differs.
const DOC_IMAGE_BASE = 'http://91.108.104.79:3000/uploads/documents/';
// Admin id sent as `verified_by` (login only stores a token, so we fall back to 1 like the driver flow).
const ADMIN_ID = Number(localStorage.getItem('admin_id')) || 1;

// One KYC record per business associate (table: ba_documents)
interface BAKyc {
  id?: number;
  ba_id?: number;
  aadhar_front_image?: string | null;
  aadhar_back_image?: string | null;
  pan_card_image?: string | null;
  gst_number?: string | null;
  status?: string | null; // 'pending' | 'approved' | 'rejected'
  remark?: string | null;
  verified_by?: number | null;
  verified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const getImgUrl = (raw?: string | null): string => {
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `${DOC_IMAGE_BASE}${raw}`;
};

const KYC_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  approved: { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
  pending:  { bg: '#fffbeb', color: '#d97706', label: 'Pending'  },
};
const getKycStatus = (s?: string | null) =>
  KYC_STATUS[(s || 'pending').toLowerCase()] || KYC_STATUS.pending;

// Small inline badge for the list (handles "not submitted" = null/empty/'not_uploaded')
function KycBadge({ status }: { status?: string | null }) {
  if (!status || status.toLowerCase() === 'not_uploaded') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', color: '#94a3b8', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
        <Clock size={11} /> Not Submitted
      </span>
    );
  }
  const st = getKycStatus(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: st.bg, color: st.color, fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
      <ShieldCheck size={11} /> {st.label}
    </span>
  );
}

// ─── Service Selector ─────────────────────────────────────────────────────────
interface ServiceSelectorProps {
  allServices: Service[];
  selectedServices: SelectedService[];
  onToggle: (id: number) => void;
  onCommissionChange: (id: number, val: string) => void;
}

function ServiceSelector({ allServices, selectedServices, onToggle, onCommissionChange }: ServiceSelectorProps) {
  if (allServices.length === 0) {
    return (
      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
        No services available
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
      {allServices.map((svc) => {
        const sel = selectedServices.find((s) => s.service_id === Number(svc.id));
        return (
          <div key={svc.id} style={styles.serviceRow(!!sel)}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
              <input
                type="checkbox"
                checked={!!sel}
                onChange={() => onToggle(svc.id)}
                style={{ accentColor: '#6366f1', width: '15px', height: '15px' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>{svc.title}</span>
            </label>
            {sel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={sel.commission_rate}
                  onChange={(e) => onCommissionChange(svc.id, e.target.value)}
                  style={{
                    ...styles.input,
                    width: '70px',
                    padding: '4px 8px',
                    fontSize: '12px',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MobileBACard({
  ba,
  index,
  onEdit,
  onDelete,
  onViewDrivers,
  onViewDocs,
  onStatusChange,
}: {
  ba: BA;
  index: number;
  onEdit: (ba: BA) => void;
  onDelete: (ba: BA) => void;
  onViewDrivers: (ba: BA) => void;
  onViewDocs: (ba: BA) => void;
  onStatusChange: (ba: BA, status: number) => void;
}) {
  const { can } = usePermissions();
  const canEdit = can('business_associates', 'edit');
  const canDelete = can('business_associates', 'delete');
  return (
    <div style={{ background: 'white', border: '1.5px solid #eef2f7', borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <UserCheck size={19} color="#6366f1" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>{ba.ba_name}</div>
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px' }}>
                <Phone size={12} color="#94a3b8" /> {ba.ba_mobile}
              </div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>#{index}</span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Services</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {!ba.services || ba.services.length === 0 ? (
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>No services</span>
              ) : (
                ba.services.map((svc, i) => (
                  <span key={svc.id ?? i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: '999px', padding: '3px 9px', fontSize: '11px', fontWeight: 700, color: '#6d28d9' }}>
                    {svc.service_name}
                    {svc.commission_rate !== undefined && <span style={{ color: '#a78bfa', fontWeight: 600 }}>{svc.commission_rate}%</span>}
                  </span>
                ))
              )}
            </div>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>KYC</span>
            <KycBadge status={ba.kyc_status} />
          </div>

          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={ba.status ?? 1}
              onChange={e => onStatusChange(ba, Number(e.target.value))}
              style={{
                padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                border: `1.5px solid ${ba.status === 0 ? '#fecaca' : '#bbf7d0'}`,
                background: ba.status === 0 ? '#fef2f2' : '#f0fdf4',
                color: ba.status === 0 ? '#dc2626' : '#16a34a',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href={`tel:${ba.ba_mobile}`} title="Call" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex', textDecoration: 'none' }}>
                <Phone size={14} />
              </a>
              <a href={`https://wa.me/91${ba.ba_mobile}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex', textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              </a>
              <button onClick={() => onViewDrivers(ba)} title="View Captains" style={{ background: '#ede9fe', border: '1px solid #ddd6fe', color: '#6d28d9', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                <Users size={13} /> Captains
              </button>
              <button onClick={() => onViewDocs(ba)} title="KYC Documents" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                <FileText size={14} />
              </button>
              {canEdit && <button onClick={() => onEdit(ba)} title="Edit" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                <Edit2 size={14} />
              </button>}
              {canDelete && <button onClick={() => onDelete(ba)} title="Delete" style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                <Trash2 size={14} />
              </button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────
interface AddModalProps {
  allServices: Service[];
  onClose: () => void;
  onAdded: (ba: BA) => void;
}

function AddModal({ allServices, onClose, onAdded }: AddModalProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleService = (svcId: number) => {
    const id = Number(svcId);
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.service_id === id);
      if (exists) return prev.filter((s) => s.service_id !== id);
      return [...prev, { service_id: id, commission_rate: 0 }];
    });
  };

  const updateCommission = (svcId: number, val: string) => {
    const id = Number(svcId);
    setSelectedServices((prev) =>
      prev.map((s) => (s.service_id === id ? { ...s, commission_rate: val } : s))
    );
  };

  const handleAdd = async () => {
    if (!name.trim() || !mobile.trim()) {
      setError('Name and mobile are required');
      return;
    }
    if (mobile.trim().length < 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiPost('/ba/create', {
        ba_name: name.trim(),
        ba_mobile: mobile.trim(),
        services: selectedServices.map((s) => ({
          service_id: Number(s.service_id),
          commission_rate: parseFloat(String(s.commission_rate)) || 0,
        })),
      });
      if (res.status) {
        onAdded(res.data);
      } else {
        setError(res.message || 'Create failed');
      }
    } catch (e: unknown) {
      setError('Network error: ' + (e instanceof Error ? e.message : 'Unknown'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Add Associate</h3>
            <p style={styles.modalSubtitle}>Register a new business partner</p>
          </div>
          <button onClick={onClose} style={styles.iconBtn}><X size={16} /></button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBox}><AlertTriangle size={14} /> {error}</div>}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name" style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Mobile Number</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)}
              placeholder="Enter 10-digit mobile" maxLength={10} style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Assign Services{' '}
              <span style={styles.countBadge}>({selectedServices.length} selected)</span>
            </label>
            <ServiceSelector
              allServices={allServices}
              selectedServices={selectedServices}
              onToggle={toggleService}
              onCommissionChange={updateCommission}
            />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleAdd} disabled={saving} style={styles.saveBtn}>
            <Plus size={14} />
            {saving ? 'Adding...' : 'Add Associate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
interface EditModalProps {
  ba: BA;
  allServices: Service[];
  onClose: () => void;
  onSaved: (ba: BA) => void;
}

function EditModal({ ba, allServices, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(ba.ba_name || '');
  const [mobile, setMobile] = useState(ba.ba_mobile || '');
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    (ba.services || []).map((s) => ({
      service_id: Number(s.service_id),
      commission_rate: s.commission_rate ?? 0,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleService = (svcId: number) => {
    const id = Number(svcId);
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.service_id === id);
      if (exists) return prev.filter((s) => s.service_id !== id);
      return [...prev, { service_id: id, commission_rate: 0 }];
    });
  };

  const updateCommission = (svcId: number, val: string) => {
    const id = Number(svcId);
    setSelectedServices((prev) =>
      prev.map((s) => (s.service_id === id ? { ...s, commission_rate: val } : s))
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !mobile.trim()) {
      setError('Name and mobile are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiPut(`/ba/update/${ba.id}`, {
        ba_name: name.trim(),
        ba_mobile: mobile.trim(),
        services: selectedServices.map((s) => ({
          service_id: Number(s.service_id),
          commission_rate: parseFloat(String(s.commission_rate)) || 0,
        })),
      });
      if (res.status) {
        onSaved(res.data);
      } else {
        setError(res.message || 'Update failed');
      }
    } catch (e: unknown) {
      setError('Network error: ' + (e instanceof Error ? e.message : 'Unknown'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Edit Associate</h3>
            <p style={styles.modalSubtitle}>Update partner details and services</p>
          </div>
          <button onClick={onClose} style={styles.iconBtn}><X size={16} /></button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBox}><AlertTriangle size={14} /> {error}</div>}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Enter name" style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Mobile Number</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)}
              placeholder="Enter mobile" style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Assigned Services{' '}
              <span style={styles.countBadge}>({selectedServices.length} selected)</span>
            </label>
            <ServiceSelector
              allServices={allServices}
              selectedServices={selectedServices}
              onToggle={toggleService}
              onCommissionChange={updateCommission}
            />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
interface DeleteModalProps {
  ba: BA;
  onClose: () => void;
  onDeleted: (id: number) => void;
}

function DeleteModal({ ba, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await apiDelete(`/ba/delete/${ba.id}`);
      if (res.status) {
        onDeleted(ba.id);
      } else {
        setError(res.message || 'Delete failed');
      }
    } catch (e: unknown) {
      setError('Network error: ' + (e instanceof Error ? e.message : 'Unknown'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, maxWidth: '380px' }}>
        <div style={{ padding: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={22} color="#ef4444" />
          </div>
          <h3 style={styles.modalTitle}>Delete Associate?</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
            Are you sure you want to delete <b>{ba.ba_name}</b>?
            This will also remove all assigned services and cannot be undone.
          </p>
          {error && <div style={styles.errorBox}><AlertTriangle size={14} /> {error}</div>}
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            style={{ ...styles.saveBtn, background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
            <Trash2 size={14} />
            {deleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BAList() {
  const { can } = usePermissions();
  const canAdd    = can('business_associates', 'add');
  const canEdit   = can('business_associates', 'edit');
  const canDelete = can('business_associates', 'delete');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [baList, setBaList] = useState<BA[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BA | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BA | null>(null);

  const [driversBA, setDriversBA] = useState<BA | null>(null);
  const [baDrivers, setBaDrivers] = useState<BADriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  const [bookingDriver, setBookingDriver] = useState<BADriver | null>(null);
  const [driverBookings, setDriverBookings] = useState<BABooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // KYC documents (one record per associate)
  const [docsBA, setDocsBA] = useState<BA | null>(null);
  const [baKyc, setBaKyc] = useState<BAKyc | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const PER_PAGE = 5;

  const fetchBA = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const json = await apiGet('/bussinessassociates/list');
      console.log('json', json);
      if (json.status) setBaList(json.data);
      else setFetchError(json.message || 'Failed to fetch');
    } catch (e: unknown) {
      setFetchError('Network error: ' + (e instanceof Error ? e.message : 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const json = await apiGet('/allservices');
      if (json.status && Array.isArray(json.data))            setAllServices(json.data);
      else if (Array.isArray(json.data))                      setAllServices(json.data);
      else if (Array.isArray(json))                           setAllServices(json);
      else if (json.services && Array.isArray(json.services)) setAllServices(json.services);
    } catch (_) { /* silent */ }
  };

  useEffect(() => { fetchBA(); fetchServices(); }, []);

  const openBADrivers = async (ba: BA) => {
    setDriversBA(ba);
    setBaDrivers([]);
    setDriversLoading(true);
    try {
      const json = await apiGet(`/ba/${ba.id}/drivers-with-bookings`);
      setBaDrivers(Array.isArray(json.data) ? json.data : []);
    } catch { setBaDrivers([]); }
    finally { setDriversLoading(false); }
  };

  const openDriverBookings = async (driver: BADriver) => {
    if (!driversBA) return;
    setBookingDriver(driver);
    setDriverBookings([]);
    setBookingsLoading(true);
    try {
      const json = await apiGet(`/ba/${driversBA.id}/drivers/${driver.id}/bookings`);
      setDriverBookings(Array.isArray(json.data) ? json.data : []);
    } catch { setDriverBookings([]); }
    finally { setBookingsLoading(false); }
  };

  const openBADocuments = async (ba: BA) => {
    setDocsBA(ba);
    setBaKyc(null);
    setDocsLoading(true);
    try {
      const json = await apiGet(`/admin/business-associates/${ba.id}/documents`);
      setBaKyc((json?.data ?? null) as BAKyc | null);
    } catch { setBaKyc(null); }
    finally { setDocsLoading(false); }
  };

  const handleVerifyKyc = async (newStatus: 'approved' | 'rejected' | 'pending') => {
    if (!docsBA) return;
    setVerifying(true);
    try {
      const res = await apiPatch(`/admin/business-associates/${docsBA.id}/kyc/verify`, {
        status: newStatus,
        verified_by: ADMIN_ID,
        remark: newStatus === 'rejected' ? 'KYC rejected' : newStatus === 'approved' ? 'KYC approved' : null,
      });
      if (res?.status === false) {
        alert(res.message || 'Failed to update KYC status');
      } else {
        setBaKyc(prev => prev ? { ...prev, status: newStatus } : prev);
      }
    } catch {
      alert('Failed to update KYC status');
    } finally {
      setVerifying(false);
    }
  };

  const handleAdded  = (newBA: BA)   => { setBaList((p) => [newBA, ...p]); setAddOpen(false); };
  const handleSaved  = (updated: BA) => { setBaList((p) => p.map((b) => b.id === updated.id ? updated : b)); setEditTarget(null); };
  const handleDeleted = (id: number) => { setBaList((p) => p.filter((b) => b.id !== id)); setDeleteTarget(null); };

  const handleStatusChange = async (ba: BA, newStatus: number) => {
    try {
      await apiPut(`/ba/update/${ba.id}`, { status: newStatus });
      setBaList(prev => prev.map(b => b.id === ba.id ? { ...b, status: newStatus } : b));
    } catch { alert('Status update failed'); }
  };

  const filteredBA = useMemo(() =>
    baList.filter((ba) =>
      ba.ba_name?.toLowerCase().includes(search.toLowerCase()) ||
      ba.ba_mobile?.includes(search)
    ), [search, baList]);

  const totalPages = Math.ceil(filteredBA.length / PER_PAGE);
  const paginatedBA = filteredBA.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="responsive-page" style={{ padding: '24px' }}>
      {addOpen      && <AddModal    allServices={allServices} onClose={() => setAddOpen(false)}    onAdded={handleAdded} />}
      {editTarget   && <EditModal   ba={editTarget} allServices={allServices} onClose={() => setEditTarget(null)}   onSaved={handleSaved} />}
      {deleteTarget && <DeleteModal ba={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />}

      {/* ── Driver Bookings Modal ── */}
      {bookingDriver && (
        <div style={{ ...styles.overlay, zIndex: 1100 }}>
          <div style={{ ...styles.modal, maxWidth: '600px' }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Booking History</h3>
                  <p style={styles.modalSubtitle}>{bookingDriver.full_name} — #{bookingDriver.id}</p>
                </div>
              </div>
              <button onClick={() => setBookingDriver(null)} style={styles.iconBtn}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
              {bookingsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Loading bookings...</p>
                </div>
              ) : driverBookings.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No bookings found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {driverBookings.map(b => {
                    const s = (b.status || '').toUpperCase();
                    const isCompleted = ['COMPLETED', 'DROPPED', 'BALANCE_PAID'].includes(s);
                    const isCancelled = ['CANCELLED', 'REJECTED'].includes(s);
                    const statusStyle = isCompleted
                      ? { bg: '#f0fdf4', color: '#16a34a', icon: <CheckCircle size={11} /> }
                      : isCancelled
                      ? { bg: '#fef2f2', color: '#dc2626', icon: <XCircle size={11} /> }
                      : { bg: '#eff6ff', color: '#2563eb', icon: <Clock size={11} /> };
                    return (
                      <div key={b.id} style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', border: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>{b.booking_id || `#${b.id}`}</div>
                          <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '3px', fontWeight: 600 }}>{b.user_name || b.customer_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <MapPin size={10} color="#94a3b8" />
                            {b.pickup_city || b.pickup || '—'}
                            <span style={{ color: '#cbd5e1' }}>→</span>
                            {b.drop_city || b.drop || '—'}
                          </div>
                          {b.created_at && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={10} /> {new Date(b.created_at).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>₹{b.balance_amount ?? b.amount ?? '—'}</div>
                          <div style={{ marginTop: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: statusStyle.bg, color: statusStyle.color, fontSize: '10px', fontWeight: 700 }}>
                            {statusStyle.icon} {s}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setBookingDriver(null)} style={styles.cancelBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BA Drivers Modal ── */}
      {driversBA && !bookingDriver && (
        <div style={{ ...styles.overlay, zIndex: 1050 }}>
          <div style={{ ...styles.modal, maxWidth: '580px' }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} color="#6366f1" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Captains</h3>
                  <p style={styles.modalSubtitle}>{driversBA.ba_name}</p>
                </div>
              </div>
              <button onClick={() => setDriversBA(null)} style={styles.iconBtn}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
              {driversLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Loading captains...</p>
                </div>
              ) : baDrivers.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No captains found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {baDrivers.map(driver => (
                    <div key={driver.id} style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', border: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Car size={18} color="#3b82f6" />
                      </div>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{driver.full_name || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={10} /> {driver.phone || '—'}
                        </div>
                        {driver.service_name && (
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '6px' }}>{driver.service_name}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: driver.is_online ? '#dcfce7' : '#f1f5f9', color: driver.is_online ? '#166534' : '#64748b' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: driver.is_online ? '#22c55e' : '#94a3b8' }} />
                          {driver.is_online ? 'ON DUTY' : 'OFFLINE'}
                        </div>
                        {driver.total_bookings !== undefined && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            <b style={{ color: '#6366f1' }}>{driver.total_bookings}</b> bookings
                          </div>
                        )}
                        <button
                          onClick={() => openDriverBookings(driver)}
                          style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <BookOpen size={11} /> Bookings
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setDriversBA(null)} style={styles.cancelBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── KYC Document Preview ── */}
      {preview && (
        <div style={{ ...styles.overlay, zIndex: 1200, background: 'rgba(15,23,42,0.8)' }} onClick={() => setPreview(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', borderRadius: '14px', overflow: 'hidden', maxWidth: '90vw', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 16px' }}>
              <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{preview.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <a href={preview.url} download target="_blank" rel="noreferrer" style={{ color: '#a5b4fc', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                  <Download size={13} /> Download
                </a>
                <button onClick={() => setPreview(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px', cursor: 'pointer', display: 'flex' }}><X size={15} /></button>
              </div>
            </div>
            <img src={preview.url} alt={preview.label} style={{ display: 'block', maxWidth: '88vw', maxHeight: '78vh', objectFit: 'contain' }} />
          </div>
        </div>
      )}

      {/* ── KYC Documents Modal ── */}
      {docsBA && (
        <div style={{ ...styles.overlay, zIndex: 1050 }}>
          <div style={{ ...styles.modal, maxWidth: '620px' }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} color="#d97706" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>KYC Documents</h3>
                  <p style={styles.modalSubtitle}>{docsBA.ba_name}</p>
                </div>
              </div>
              <button onClick={() => setDocsBA(null)} style={styles.iconBtn}><X size={16} /></button>
            </div>

            <div style={{ padding: '16px 20px', maxHeight: '64vh', overflowY: 'auto' }}>
              {docsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Loading documents...</p>
                </div>
              ) : !baKyc ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No KYC submitted by this associate yet.</div>
              ) : (
                <>
                  {/* Overall status */}
                  {(() => {
                    const st = getKycStatus(baKyc.status);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: st.bg, borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: st.color, fontSize: '13px', fontWeight: 700 }}>
                          <ShieldCheck size={15} /> KYC Status: {st.label}
                        </div>
                        {baKyc.verified_at && (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Verified: {new Date(baKyc.verified_at).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Document image tiles */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    {([
                      { label: 'Aadhar Front', raw: baKyc.aadhar_front_image },
                      { label: 'Aadhar Back',  raw: baKyc.aadhar_back_image },
                      { label: 'PAN Card',     raw: baKyc.pan_card_image },
                    ] as { label: string; raw?: string | null }[]).map(item => {
                      const url = getImgUrl(item.raw);
                      return (
                        <div key={item.label} style={{ background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #f1f5f9', overflow: 'hidden' }}>
                          <div
                            onClick={() => url && setPreview({ url, label: item.label })}
                            style={{ height: '110px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: url ? 'pointer' : 'default', position: 'relative' }}
                          >
                            {url
                              ? <img src={url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              : <FileText size={20} color="#cbd5e1" />}
                            {url && (
                              <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(15,23,42,0.65)', borderRadius: '6px', padding: '3px', display: 'flex' }}><Eye size={12} color="white" /></span>
                            )}
                          </div>
                          <div style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: url ? '#1e293b' : '#94a3b8' }}>
                            {item.label}{!url && <span style={{ fontWeight: 400 }}> — not uploaded</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* GST + remark */}
                  <div style={{ marginTop: '16px', background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #f1f5f9', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>GST Number</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: baKyc.gst_number ? '#1e293b' : '#cbd5e1', letterSpacing: '0.5px' }}>{baKyc.gst_number || 'Not provided'}</span>
                    </div>
                    {baKyc.remark && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#64748b' }}>
                        Remark: {baKyc.remark}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setDocsBA(null)} style={styles.cancelBtn}>Close</button>
              {baKyc && (
                <>
                  <button
                    onClick={() => handleVerifyKyc('rejected')}
                    disabled={verifying || baKyc.status === 'rejected'}
                    style={{ ...styles.saveBtn, background: 'linear-gradient(135deg,#ef4444,#dc2626)', opacity: (verifying || baKyc.status === 'rejected') ? 0.5 : 1, cursor: (verifying || baKyc.status === 'rejected') ? 'not-allowed' : 'pointer' }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    onClick={() => handleVerifyKyc('approved')}
                    disabled={verifying || baKyc.status === 'approved'}
                    style={{ ...styles.saveBtn, background: 'linear-gradient(135deg,#16a34a,#15803d)', opacity: (verifying || baKyc.status === 'approved') ? 0.5 : 1, cursor: (verifying || baKyc.status === 'approved') ? 'not-allowed' : 'pointer' }}
                  >
                    {verifying ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />} Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Business Associates</h2>
          <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>Total {filteredBA.length} partners registered</p>
        </div>
        <div className="responsive-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="responsive-search" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px' }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search by name or mobile..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', width: '180px', color: '#1e293b', background: 'transparent' }} />
          </div>
          <button onClick={fetchBA} title="Refresh"
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} />
          </button>
          {canAdd && <button onClick={() => setAddOpen(true)}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            <Plus size={16} /> Add Associate
          </button>}
        </div>
      </div>

      {/* Table */}
      <div className="responsive-table-card" style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div className="responsive-table-scroll ba-desktop-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
              {['#', 'Partner Name', 'Mobile','Pincode', 'Services', 'Status', 'KYC', 'Captains', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading...</td></tr>}
            {!loading && fetchError && <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>{fetchError}</td></tr>}
            {!loading && !fetchError && paginatedBA.map((ba, index) => (
              <tr key={ba.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#fafbff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'white'; }}>
                <td style={{ padding: '13px 16px', fontSize: '12px', color: '#94a3b8' }}>{(page - 1) * PER_PAGE + index + 1}</td>
                <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <UserCheck size={17} color="#6366f1" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{ba.ba_name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                    <Phone size={12} color="#94a3b8" /> {ba.ba_mobile}
                  </div>
                </td>
                <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                    {/* <Phone size={12} color="#94a3b8" /> */}
                     {ba.pincode}
                  </div>
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {!ba.services || ba.services.length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>No services</span>
                    ) : (
                      ba.services.map((svc, i) => (
                        <div key={svc.id ?? i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: '20px', padding: '3px 10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9' }}>{svc.service_name}</span>
                          {svc.commission_rate !== undefined && (
                            <span style={{ fontSize: '10px', color: '#a78bfa' }}>{svc.commission_rate}%</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </td>
                <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                  <select
                    value={ba.status ?? 1}
                    onChange={e => handleStatusChange(ba, Number(e.target.value))}
                    style={{
                      padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      border: `1.5px solid ${ba.status === 0 ? '#fecaca' : '#bbf7d0'}`,
                      background: ba.status === 0 ? '#fef2f2' : '#f0fdf4',
                      color: ba.status === 0 ? '#dc2626' : '#16a34a',
                      cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </td>
                <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                  <KycBadge status={ba.kyc_status} />
                </td>
                <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openBADrivers(ba)} title="View Captains"
                    style={{ background: '#ede9fe', border: '1px solid #ddd6fe', color: '#6d28d9', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600 }}>
                    <Users size={13} /> Captains
                  </button>
                </td>
                <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a href={`tel:${ba.ba_mobile}`} title="Call"
                      style={{ width: '40px', height: '40px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>
                      <Phone size={19} />
                    </a>
                    <a href={`https://wa.me/91${ba.ba_mobile}`} target="_blank" rel="noreferrer" title="WhatsApp"
                      style={{ width: '40px', height: '40px', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    </a>
                    <button onClick={() => openBADocuments(ba)} title="KYC Documents"
                      style={{ width: '40px', height: '40px', background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={19} />
                    </button>
                    {canEdit && <button onClick={() => setEditTarget(ba)} title="Edit"
                      style={{ width: '40px', height: '40px', background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Edit2 size={19} />
                    </button>}
                    {canDelete && <button onClick={() => setDeleteTarget(ba)} title="Delete"
                      style={{ width: '40px', height: '40px', background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Trash2 size={19} />
                    </button>}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !fetchError && paginatedBA.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No associates found.</td></tr>
            )}
          </tbody>
        </table>
        </div>

        <div className="ba-mobile-list" style={{ padding: '14px', display: 'none', flexDirection: 'column', gap: '12px', background: '#fafbfc' }}>
          {loading && <div style={{ padding: '28px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading...</div>}
          {!loading && fetchError && <div style={{ padding: '28px 12px', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>{fetchError}</div>}
          {!loading && !fetchError && paginatedBA.map((ba, index) => (
            <MobileBACard
              key={ba.id}
              ba={ba}
              index={(page - 1) * PER_PAGE + index + 1}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              onViewDrivers={openBADrivers}
              onViewDocs={openBADocuments}
              onStatusChange={handleStatusChange}
            />
          ))}
          {!loading && !fetchError && paginatedBA.length === 0 && (
            <div style={{ padding: '28px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No associates found.</div>
          )}
        </div>

        {/* Pagination */}
        <div className="responsive-pagination" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Page <b>{page}</b> of <b>{totalPages || 1}</b></span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b' }}>
              <ChevronLeft size={14} />
            </button>
            <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage((p) => p + 1)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', color: '#64748b' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ─── Styles — CSSProperties type lagaya TS errors fix ────────────────────────
// ─── Styles ───────────────────────────────────────────────────────────────────
interface Styles {
  overlay: CSSProperties;
  modal: CSSProperties;
  modalHeader: CSSProperties;
  modalBody: CSSProperties;
  modalFooter: CSSProperties;
  modalTitle: CSSProperties;
  modalSubtitle: CSSProperties;
  fieldGroup: CSSProperties;
  label: CSSProperties;
  countBadge: CSSProperties;
  input: CSSProperties;
  errorBox: CSSProperties;
  iconBtn: CSSProperties;
  cancelBtn: CSSProperties;
  saveBtn: CSSProperties;
  serviceRow: (selected: boolean) => CSSProperties;
}

const styles: Styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(3px)', padding: '14px',
  },
  modal: {
    background: 'white', borderRadius: '18px',
    width: '100%', maxWidth: '500px', maxHeight: '92vh',
    boxShadow: '0 25px 60px rgba(0,0,0,0.18)', overflow: 'auto',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 20px', borderBottom: '1.5px solid #f1f5f9',
  },
  modalBody: {
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
  },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
    padding: '14px 20px', borderTop: '1.5px solid #f1f5f9', background: '#fafbfc',
    flexWrap: 'wrap',
  },
  modalTitle:    { margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' },
  modalSubtitle: { margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' },
  fieldGroup:    { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:         { fontSize: '12px', fontWeight: 600, color: '#475569' },
  countBadge:    { fontSize: '11px', color: '#94a3b8', fontWeight: 400 },
  input: {
    border: '1.5px solid #e2e8f0', borderRadius: '9px',
    padding: '9px 12px', fontSize: '13px', outline: 'none',
    color: '#1e293b', width: '100%', boxSizing: 'border-box',
  },
  serviceRow: (selected: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', borderRadius: '9px',
    border: `1.5px solid ${selected ? '#ddd6fe' : '#f1f5f9'}`,
    background: selected ? '#faf5ff' : '#fafbfc', transition: 'all 0.15s',
  }),
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#fff1f2', border: '1px solid #fee2e2',
    color: '#ef4444', borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
  },
  iconBtn: {
    background: '#f1f5f9', border: 'none', color: '#64748b',
    borderRadius: '8px', padding: '6px', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  },
  cancelBtn: {
    background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b',
    padding: '8px 16px', borderRadius: '9px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
  },
  saveBtn: {
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white',
    border: 'none', padding: '8px 18px', borderRadius: '9px',
    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '6px',
  },
};
