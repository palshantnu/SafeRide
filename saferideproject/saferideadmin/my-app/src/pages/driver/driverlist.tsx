import React, { useState, useMemo, useEffect } from 'react';
import {
  Edit2, Trash2, Plus, Search, ChevronLeft, ChevronRight,
  Car, Phone, ExternalLink, RefreshCw, X, Save, FileText,
  Clock, CheckCircle, XCircle, AlertCircle, MapPin, Calendar,
  Image, Download, Eye, ShieldCheck, BookOpen, Wallet, Menu, Briefcase
} from 'lucide-react';
import { getAllDrivers, deleteDriver, updateDriver, createDriver, getDriverBookings, getDriverDocuments, verifyDriverDocument, getAllServices, getSubByServiceId, getAllSubServices } from "../../services/api";
import { usePermissions } from "../../context/PermissionsContext";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Driver {
  id: number;
  full_name?: string;
  phone?: string;
  service_id?: string | number;
  sub_service_id?: string | number;
  service_name?: string;
  sub_service_name?: string;
  pincode?: string;
  status?: string;
  wallet?: number;
  is_online?: boolean;
  ba_id?: number | string | null;
  ba_name?: string | null;
  business_name?: string | null;
  business_associate_name?: string | null;
  created_at?: string | null;
}

interface Booking {
  id: number;
  booking_id?: string;
  customer_name?: string;
  pickup?: string;
  drop?: string;
  amount?: number;
  status?: string;
  created_at?: string;
  service_name?: string;
  booking_type?: string;
  pickup_city?: string;
  drop_city?: string;
  pickup_address?: string;
  drop_address?: string | null;
  person?: number;
  schedule_date?: string;
  balance_amount?: number;
  user_status?: string;
  driver_status?: string;
  cancelled_by?: string;
  cancel_reason?: string | null;
  user_id?: number;
  user_name?: string;
  user_mobile?: string;
  plan_name?: string;
  plan_price?: string;
  plan_hour?: string;
  plan_km?: string;
}

interface DriverDocument {
  id: number;
  doc_type?: string;
  doc_url?: string;
  status?: number;
  uploaded_at?: string;
  driver_id?: number;
  document_type?: string;
  document_number?: string;
  document_name?: string;
  document_file?: string;
  document_file_url?: string;
  expiry_date?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

interface FormData {
  full_name: string;
  phone: string;
  service_id: string;
  sub_service_id: string;
  pincode: string;
  status: string;
}

type StatusKey = 'approved' | 'pending' | 'rejected';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', fontSize: '13px',
  border: '1.5px solid #e2e8f0', borderRadius: '10px',
  outline: 'none', color: '#1e293b', background: 'white', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px', display: 'block',
};

interface FormFieldsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  services: { id: number; title: string }[];
  subServices: { id: number; title: string }[];
}

function FormFields({ formData, setFormData, services, subServices }: FormFieldsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Full Name *</label>
        <input value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} placeholder="Captain's full name" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Phone *</label>
        <input value={formData.phone} maxLength={10} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="10 digit mobile" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Pincode *</label>
        <input value={formData.pincode} maxLength={6} onChange={e => setFormData(p => ({ ...p, pincode: e.target.value }))} placeholder="6 digit pincode" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Service</label>
        <select
          value={formData.service_id}
          onChange={e => setFormData(p => ({ ...p, service_id: e.target.value, sub_service_id: '' }))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">-- Select Service --</option>
          {services.map(s => (
            <option key={s.id} value={String(s.id)}>{s.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Sub Service</label>
        <select
          value={formData.sub_service_id}
          onChange={e => setFormData(p => ({ ...p, sub_service_id: e.target.value }))}
          style={{ ...inputStyle, cursor: 'pointer', opacity: !formData.service_id ? 0.6 : 1 }}
          disabled={!formData.service_id}
        >
          <option value="">-- Select Sub Service --</option>
          {subServices.map(s => (
            <option key={s.id} value={String(s.id)}>{s.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Status</label>
        <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </div>
  );
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── MOCK FETCH HELPERS (replace with real API calls) ────────────────────────
// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DriverList() {
  const { can } = usePermissions();
  const canAdd    = can('drivers', 'add');
  const canEdit   = can('drivers', 'edit');
  const canDelete = can('drivers', 'delete');
  const [search,         setSearch]         = useState<string>('');
  const [page,           setPage]           = useState<number>(1);
  const [drivers,        setDrivers]        = useState<Driver[]>([]);
  const [loading,        setLoading]        = useState<boolean>(true);
  const [error,          setError]          = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<number | null>(null);

  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<Driver | null>(null);
  const [editDriver,     setEditDriver]     = useState<Driver | null>(null);
  const [addModal,       setAddModal]       = useState<boolean>(false);

  const [bookingDriver,   setBookingDriver]   = useState<Driver | null>(null);
  const [bookings,        setBookings]        = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(false);

  const [docDriver,       setDocDriver]       = useState<Driver | null>(null);
  const [documents,       setDocuments]       = useState<DriverDocument[]>([]);
  const [docsLoading,     setDocsLoading]     = useState<boolean>(false);
  const [previewDoc,      setPreviewDoc]      = useState<DriverDocument | null>(null);
  const [verifyingDocId,  setVerifyingDocId]  = useState<number | null>(null);

  const [formData,    setFormData]    = useState<FormData>({
    full_name: '', phone: '', service_id: '', sub_service_id: '', pincode: '', status: 'pending',
  });
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formError,   setFormError]   = useState<string | null>(null);

  const [services,    setServices]    = useState<{ id: number; title: string }[]>([]);
  const [subServices, setSubServices] = useState<{ id: number; title: string }[]>([]);
  // sub_service_id → minimum wallet balance required (from sub service details)
  const [minWalletMap, setMinWalletMap] = useState<Record<string, number>>({});

  const PER_PAGE = 8;

  const fetchDrivers = async () => {
    setLoading(true); setError(null);
    try {
      const res = await getAllDrivers() as { data: { status: boolean; data: Driver[]; message?: string } };
      console.log('Fetched drivers:', res.data);
      if (res.data.status) setDrivers(res.data.data);
      else setError(res.data.message || 'Failed to fetch');
    } catch { setError('Unable to connect to server'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchDrivers(); }, []);

  useEffect(() => {
    getAllServices().then((res: any) => {
      const data = res?.data?.data || res?.data || [];
      setServices(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  // Load all sub services to know each one's minimum required wallet balance.
  useEffect(() => {
    getAllSubServices().then((body: any) => {
      const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
      const map: Record<string, number> = {};
      list.forEach((s: any) => {
        const min = Number(s?.driver_min_wallet_balance);
        if (s?.id != null && !Number.isNaN(min)) map[String(s.id)] = min;
      });
      setMinWalletMap(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (formData.service_id) {
      getSubByServiceId(formData.service_id).then((data: any) => {
        const list = data?.data || data || [];
        setSubServices(Array.isArray(list) ? list : []);
      }).catch(() => setSubServices([]));
    } else {
      setSubServices([]);
    }
  }, [formData.service_id]);

  const openBookings = async (driver: Driver) => {
    setBookingDriver(driver);
    setBookingsLoading(true);
    try {
      const res = await getDriverBookings(driver.id);
      const payload = res.data;
      setBookings(Array.isArray(payload?.data) ? payload.data : []);
      if (payload?.driver) {
        setBookingDriver(prev => prev ? { ...prev, ...payload.driver } : payload.driver);
      }
    } catch {
      setBookings([]);
    }
    finally { setBookingsLoading(false); }
  };

  const openDocuments = async (driver: Driver) => {
    setDocDriver(driver);
    setDocsLoading(true);
    try {
      const res = await getDriverDocuments(driver.id);
      const payload = res.data;
      setDocuments(Array.isArray(payload?.data) ? payload.data : []);
      if (payload?.driver) {
        setDocDriver(prev => prev ? { ...prev, ...payload.driver } : payload.driver);
      }
    } catch {
      setDocuments([]);
    }
    finally { setDocsLoading(false); }
  };

  const handleVerifyDoc = async (doc: DriverDocument, newStatus: number) => {
    if (!docDriver) return;
    setVerifyingDocId(doc.id);
    try {
      await verifyDriverDocument(docDriver.id, doc.id, {
        status: newStatus,
        verified_by: 1,
        remark: 'Document OK',
      });
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: newStatus } : d));
    } catch {
      alert(newStatus === 1 ? 'Document verify karne mein error aaya' : 'Verification cancel karne mein error aaya');
    } finally {
      setVerifyingDocId(null);
    }
  };

  const openEdit = (driver: Driver) => {
    setFormError(null);
    setFormData({
      full_name:      driver.full_name      || '',
      phone:          driver.phone          || '',
      service_id:     driver.service_id     ? String(driver.service_id) : '',
      sub_service_id: driver.sub_service_id ? String(driver.sub_service_id) : '',
      pincode:        driver.pincode        || '',
      status:         driver.status         || 'pending',
    });
    setEditDriver(driver);
  };

  const openAdd = () => {
    setFormError(null);
    setFormData({ full_name: '', phone: '', service_id: '', sub_service_id: '', pincode: '', status: 'pending' });
    setAddModal(true);
  };

  const handleUpdate = async () => {
    if (!formData.full_name.trim() || !formData.phone.trim() || !formData.pincode.trim()) {
      setFormError('Name, Phone aur Pincode required hain'); return;
    }
    if (!editDriver) return;
    setFormLoading(true); setFormError(null);
    try {
      await updateDriver(editDriver.id, formData);
      setDrivers(prev => prev.map(d => d.id === editDriver.id ? { ...d, ...formData } : d));
      setEditDriver(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setFormError(e?.response?.data?.message || 'Update failed');
    } finally { setFormLoading(false); }
  };

  const handleAdd = async () => {
    if (!formData.full_name.trim() || !formData.phone.trim() || !formData.pincode.trim()) {
      setFormError('Name, Phone aur Pincode required hain'); return;
    }
    setFormLoading(true); setFormError(null);
    try {
      await createDriver(formData);
      setAddModal(false); fetchDrivers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setFormError(e?.response?.data?.message || 'Add failed');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDriver(id);
      setDrivers(prev => prev.filter(d => d.id !== id));
      setDeleteConfirm(null);
    } catch { alert('Delete failed'); }
  };

  const handleStatusChange = async (driver: Driver, newStatus: string) => {
    try {
      await updateDriver(driver.id, { ...driver, status: newStatus });
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, status: newStatus } : d));
    } catch { alert('Status update failed'); }
  };

  const filteredDrivers = useMemo(() => drivers.filter(d =>
    (d.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (d.phone || '').includes(search) ||
    (d.service_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (d.sub_service_name?.toLowerCase() || '').includes(search.toLowerCase())
  ), [search, drivers]);

  const totalPages       = Math.ceil(filteredDrivers.length / PER_PAGE);
  const paginatedDrivers = filteredDrivers.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const statusColor = (s?: string) => {
    const map: Record<StatusKey, { bg: string; color: string; border: string }> = {
      approved: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
      pending:  { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
      rejected: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    };
    return map[s as StatusKey] || { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
  };

  const bookingStatusStyle = (s?: string) => {
    const status = (s || '').toUpperCase();
    if (['COMPLETED', 'DROPPED', 'BALANCE_PAID'].includes(status)) return { bg: '#f0fdf4', color: '#16a34a', icon: <CheckCircle size={12} /> };
    if (['CANCELLED', 'REJECTED'].includes(status)) return { bg: '#fef2f2', color: '#dc2626', icon: <XCircle size={12} /> };
    if (['ONGOING', 'SEARCHING', 'ACCEPTED', 'ARRIVED', 'STARTED', 'PICKEDUP'].includes(status)) return { bg: '#eff6ff', color: '#2563eb', icon: <AlertCircle size={12} /> };
    return { bg: '#f1f5f9', color: '#64748b', icon: <Clock size={12} /> };
  };

  // Business associate a captain belongs to (backend field name may vary → try common ones).
  const getBAName = (driver: Driver): string =>
  driver.business_associate_name ||
  driver.business_name ||
  (driver.ba_id != null ? String(driver.ba_id) : '');

  // True when the captain's wallet is below the minimum required by their sub service.
  const isLowWallet = (driver: Driver): boolean => {
    if (driver.sub_service_id == null) return false;
    const min = minWalletMap[String(driver.sub_service_id)];
    if (min == null) return false;
    return Number(driver.wallet ?? 0) < min;
  };

  const getDocumentLabel = (doc: DriverDocument) =>
    doc.document_name || doc.doc_type || doc.document_type || 'Document';

  const getDocumentUrl = (doc: DriverDocument) =>
    doc.doc_url || doc.document_file_url || '';

  const getDocumentDate = (doc: DriverDocument) =>
    doc.uploaded_at ||
    (doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

  // ─── Responsive Table Row Component for Mobile ───
  const MobileDriverCard = ({ driver }: { driver: Driver }) => {
    const isOpen = mobileMenuOpen === driver.id;
    return (
      <div style={{
        background: 'white',
        borderRadius: '16px',
        marginBottom: '12px',
        border: '1.5px solid #eef2f7',
        overflow: 'hidden',
        transition: 'all 0.2s ease'
      }}>
        {/* Main Card Header */}
        <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Car size={22} color="#3b82f6" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{driver.full_name || '—'}</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: 700, background: driver.is_online ? '#dcfce7' : '#f1f5f9', color: driver.is_online ? '#166534' : '#64748b' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: driver.is_online ? '#22c55e' : '#94a3b8' }} />
                {driver.is_online ? 'ON DUTY' : 'OFFLINE'}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>ID: #CAP-00{driver.id}</div>
          </div>
          <button onClick={() => setMobileMenuOpen(isOpen ? null : driver.id)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}>
            <Menu size={16} color="#64748b" />
          </button>
        </div>

        {/* Expanded Details */}
        {isOpen && (
          <div style={{ padding: '14px', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
            {/* Phone */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>📞 Phone</span>
              <span style={{ color: '#1e293b', fontWeight: 500 }}>{driver.phone || '—'}</span>
            </div>
            {/* Service */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>🚗 Service</span>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>{driver.service_name || '—'}</span>
            </div>
            {/* Sub Service */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>🔄 Sub Service</span>
              <span style={{ background: '#f0fdf4', color: '#15803d', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>{driver.sub_service_name || '—'}</span>
            </div>
            {/* Business Associate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>💼 Business Associate</span>
              <span style={{ background: getBAName(driver) ? '#ede9fe' : '#f1f5f9', color: getBAName(driver) ? '#6d28d9' : '#94a3b8', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>
                {getBAName(driver)? ' BA Captain' : 'Direct'}</span>
            </div>
            {/* Joined */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>🗓️ Joined</span>
              <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatDate(driver.created_at)}</span>
            </div>
            {/* Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>📊 Status</span>
              <select value={driver.status || 'pending'} onChange={e => handleStatusChange(driver, e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: `1.5px solid ${statusColor(driver.status).border}`, background: statusColor(driver.status).bg, color: statusColor(driver.status).color, cursor: 'pointer', outline: 'none' }}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <a href={`tel:${driver.phone}`} style={{ flex: 1, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '8px', borderRadius: '10px', textAlign: 'center', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>📞 Call</a>
              <a href={`https://wa.me/91${driver.phone}`} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', padding: '8px', borderRadius: '10px', textAlign: 'center', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>💬 WhatsApp</a>
              <button onClick={() => { setSelectedDriver(driver); setMobileMenuOpen(null); }} style={{ flex: 1, background: isLowWallet(driver) ? '#fff1f2' : '#f8fafc', border: `1px solid ${isLowWallet(driver) ? '#fecaca' : '#e2e8f0'}`, color: isLowWallet(driver) ? '#ef4444' : '#64748b', padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>👁️ View</button>
              <button onClick={() => { openBookings(driver); setMobileMenuOpen(null); }} style={{ flex: 1, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>📅 Bookings</button>
              <button onClick={() => { openDocuments(driver); setMobileMenuOpen(null); }} style={{ flex: 1, background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>📄 Docs</button>
              {canEdit && <button onClick={() => { openEdit(driver); setMobileMenuOpen(null); }} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#6366f1', padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>}
              {canDelete && <button onClick={() => { setDeleteConfirm(driver); setMobileMenuOpen(null); }} style={{ flex: 1, background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>🗑️ Delete</button>}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Modal Components (unchanged but responsive)
  const Modal = ({ children, width = '460px' }: { children: React.ReactNode; width?: string }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width, maxWidth: '95vw', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );

  const ModalClose = ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}>
      <X size={16} color="#64748b" />
    </button>
  );

  const ModalHeader = ({ icon, iconBg, iconColor, title, subtitle }: { icon: React.ReactNode; iconBg: string; iconColor: string; title: string; subtitle?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{subtitle}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '16px', animation: 'fadeSlideUp 0.4s ease', maxWidth: '1600px', margin: '0 auto' }}>

      {/* All Modal Components */}
      {bookingDriver && (
        <Modal width="680px">
          <ModalClose onClose={() => setBookingDriver(null)} />
          <ModalHeader
            icon={<BookOpen size={22} color="#6366f1" />}
            iconBg="#eef2ff"
            iconColor="#6366f1"
            title="Booking History"
            subtitle={`${bookingDriver.full_name} — #CAP-00${bookingDriver.id}`}
          />
          {!bookingsLoading && bookings.length > 0 && (() => {
            const completed = bookings.filter(b => ['COMPLETED', 'DROPPED', 'BALANCE_PAID'].includes((b.status || '').toUpperCase())).length;
            const totalEarned = bookings.reduce((sum, b) => sum + Number(b.balance_amount ?? b.amount ?? b.plan_price ?? 0), 0);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Rides', value: bookings.length, bg: '#eff6ff', color: '#2563eb' },
                  { label: 'Completed', value: completed, bg: '#f0fdf4', color: '#16a34a' },
                  { label: 'Amount', value: `₹${totalEarned}`, bg: '#fdf4ff', color: '#7e22ce' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: '12px', padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}
          {bookingsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No bookings found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
              {bookings.map(b => {
                const st = bookingStatusStyle(b.status);
                const createdAt = b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                const userName = b.user_name || b.customer_name || '—';
                const pickup = b.pickup_city || b.pickup || '—';
                const drop = b.drop_city || b.drop || '—';
                const amount = b.balance_amount ?? b.amount ?? b.plan_price ?? '—';
                return (
                  <div key={b.id} style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px 16px', border: '1.5px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '90px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>{b.booking_id}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={10} />{createdAt}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{userName}</div>
                      {b.user_mobile && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{b.user_mobile}</div>}
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <MapPin size={10} color="#94a3b8" />
                        <span>{pickup}</span>
                        <span style={{ color: '#cbd5e1' }}>→</span>
                        <span>{drop}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {b.service_name || '—'} {b.plan_name ? `· ${b.plan_name}` : ''}
                        {b.plan_hour || b.plan_km ? ` · ${b.plan_hour || '—'} hr / ${b.plan_km || '—'} km` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>₹{amount}</div>
                      <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: st.bg, color: st.color, fontSize: '10px', fontWeight: 700 }}>
                        {st.icon}
                        {(b.status || '').toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button onClick={() => setPreviewDoc(null)} style={{ position: 'absolute', top: '-40px', right: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={14} /> Close
            </button>
            <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{getDocumentLabel(previewDoc)}</span>
                <a href={getDocumentUrl(previewDoc)} download target="_blank" rel="noreferrer" style={{ color: '#a5b4fc', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                  <Download size={13} /> Download
                </a>
              </div>
              <img src={getDocumentUrl(previewDoc)} alt={getDocumentLabel(previewDoc)} style={{ display: 'block', maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      )}

      {docDriver && !previewDoc && (
        <Modal width="560px">
          <ModalClose onClose={() => setDocDriver(null)} />
          <ModalHeader
            icon={<FileText size={22} color="#f59e0b" />}
            iconBg="#fffbeb"
            iconColor="#f59e0b"
            title="Captain Documents"
            subtitle={`${docDriver.full_name} — #DRV-00${docDriver.id}`}
          />
          {!docsLoading && documents.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
                ✓ {documents.filter(d => d.status === 1).length} Verified
              </div>
              <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', color: '#d97706', fontWeight: 700 }}>
                ⏳ {documents.filter(d => d.status !== 1).length} Pending
              </div>
            </div>
          )}
          {docsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No documents uploaded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', borderRadius: '14px', padding: '12px 16px', border: `1.5px solid ${doc.status === 1 ? '#bbf7d0' : '#fde68a'}`, flexWrap: 'wrap' }}>
                  <div onClick={() => setPreviewDoc(doc)} style={{ width: '52px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', position: 'relative', background: '#e2e8f0' }}>
                    {getDocumentUrl(doc) ? <img src={getDocumentUrl(doc)} alt={getDocumentLabel(doc)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FileText size={18} color="#94a3b8" />}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Eye size={14} color="white" />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{getDocumentLabel(doc)}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Uploaded: {getDocumentDate(doc)}</div>
                    {doc.document_number && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>No: {doc.document_number}</div>}
                    {doc.expiry_date && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Expiry: {doc.expiry_date}</div>}
                    {doc.remark && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Remark: {doc.remark}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', background: doc.status === 1 ? '#f0fdf4' : '#fffbeb', color: doc.status === 1 ? '#16a34a' : '#d97706', fontSize: '11px', fontWeight: 700 }}>
                    {doc.status === 1 ? <ShieldCheck size={12} /> : <Clock size={12} />}
                    {doc.status === 1 ? 'Verified' : 'Pending'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setPreviewDoc(doc)} style={{ background: '#eff6ff', border: 'none', color: '#2563eb', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                      <Eye size={14} />
                    </button>
                    <a href={getDocumentUrl(doc)} download target="_blank" rel="noreferrer" style={{ background: '#f0fdf4', border: 'none', color: '#16a34a', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex', textDecoration: 'none' }}>
                      <Download size={14} />
                    </a>
                    {doc.status !== 1 ? (
                      <button
                        onClick={() => handleVerifyDoc(doc, 1)}
                        disabled={verifyingDocId === doc.id}
                        title="Verify Document"
                        style={{ background: verifyingDocId === doc.id ? '#e0f2fe' : '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '7px 10px', borderRadius: '8px', cursor: verifyingDocId === doc.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}
                      >
                        {verifyingDocId === doc.id
                          ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : <ShieldCheck size={12} />}
                        {verifyingDocId === doc.id ? 'Verifying...' : 'Verify'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerifyDoc(doc, 0)}
                        disabled={verifyingDocId === doc.id}
                        title="Cancel Verification"
                        style={{ background: verifyingDocId === doc.id ? '#fee2e2' : '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', padding: '7px 10px', borderRadius: '8px', cursor: verifyingDocId === doc.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}
                      >
                        {verifyingDocId === doc.id
                          ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : <XCircle size={12} />}
                        {verifyingDocId === doc.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {selectedDriver && (
        <Modal width="420px">
          <ModalClose onClose={() => setSelectedDriver(null)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={24} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{selectedDriver.full_name}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>ID: #CAP-00{selectedDriver.id}</div>
            </div>
          </div>
          {([
            ['Phone', selectedDriver.phone],
            ['Service', selectedDriver.service_name || '—'],
            ['Sub Service', selectedDriver.sub_service_name || '—'],
            ['Pincode', selectedDriver.pincode],
            ['Wallet', `₹${selectedDriver.wallet ?? 0}`],
            ['Status', selectedDriver.status],
            ['Online', selectedDriver.is_online ? 'Yes' : 'No'],
            ['Joined', formatDate(selectedDriver.created_at)],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>{label}</span>
              <span style={{ color: '#1e293b', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button onClick={() => { openBookings(selectedDriver); setSelectedDriver(null); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#6366f1', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <BookOpen size={13} /> Bookings
            </button>
            <button onClick={() => { openDocuments(selectedDriver); setSelectedDriver(null); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#f59e0b', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <FileText size={13} /> Documents
            </button>
          </div>
          <button onClick={() => { openEdit(selectedDriver); setSelectedDriver(null); }} style={{ marginTop: '8px', width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Edit This Captain
          </button>
        </Modal>
      )}

      {editDriver && (
        <Modal>
          <ModalClose onClose={() => setEditDriver(null)} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
            Edit Captain — <span style={{ color: '#6366f1' }}>#CAP-00{editDriver.id}</span>
          </div>
          {formError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>⚠ {formError}</div>}
          <FormFields formData={formData} setFormData={setFormData} services={services} subServices={subServices} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
            <button onClick={() => setEditDriver(null)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Cancel</button>
            <button onClick={handleUpdate} disabled={formLoading} style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: formLoading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', cursor: formLoading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {formLoading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={14} /> Update Captain</>}
            </button>
          </div>
        </Modal>
      )}

      {addModal && (
        <Modal>
          <ModalClose onClose={() => setAddModal(false)} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>Add New Captain</div>
          {formError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>⚠ {formError}</div>}
          <FormFields formData={formData} setFormData={setFormData} services={services} subServices={subServices} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
            <button onClick={() => setAddModal(false)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Cancel</button>
            <button onClick={handleAdd} disabled={formLoading} style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: formLoading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', cursor: formLoading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {formLoading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Adding...</> : <><Plus size={14} /> Add Captain</>}
            </button>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal width="360px">
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Delete Captain?</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
              Are you sure you want to permanently delete <b>{deleteConfirm.full_name}</b>? This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ HEADER - Fully Responsive ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 800, margin: 0, color: '#0f172a' }}>🚗 Captains Management</h2>
          <p style={{ color: '#94a3b8', fontSize: 'clamp(11px, 3vw, 13px)', marginTop: '4px', margin: 0 }}>Monitor and manage your fleet operations</p>
        </div>
        
        {/* Search and Actions - Responsive */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', maxWidth: '500px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '8px 16px', flex: '1', minWidth: '180px' }}>
            <Search size={16} color="#94a3b8" />
            <input 
              placeholder="Search name, phone, service..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
              style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%' }} 
            />
          </div>
          <button onClick={fetchDrivers} title="Refresh" style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} />
          </button>
          {canAdd && <button onClick={openAdd} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            <Plus size={18} /> Add New Captain
          </button>}
        </div>
      </div>

      {/* ══ TABLE / CARDS - Responsive ══ */}
      <div style={{ background: 'white', borderRadius: '20px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.03)' }}>

        {loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            <RefreshCw size={20} style={{ marginBottom: '8px', animation: 'spin 1s linear infinite' }} />
            <p style={{ margin: 0 }}>Loading captains...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            <button onClick={fetchDrivers} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Try Again</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Desktop Table View - Hidden on mobile */}
            <div className="admin-table-scroll admin-desktop-table" style={{ overflowX: 'auto', display: 'block' }}>
              <div style={{ minWidth: '1000px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                      {['Captain', 'Phone','Pincode', 'Service', 'Sub Service', 'Business Associate', 'Duty', 'Status', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDrivers.length > 0 ? paginatedDrivers.map(driver => (
                      <tr key={driver.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Car size={18} color="#3b82f6" />
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#000' }}>{driver.full_name || '—'}</div>
                              <div style={{ fontSize: '11px', color: '#000' }}>ID: #CAP-00{driver.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#000' }}>
                            <Phone size={13} /> {driver.phone || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#000' }}>
                            {/* <Phone size={13} />  */}
                            {driver.pincode || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px', display: 'inline-block' }}>
                            {driver.service_name || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ background: '#f0fdf4', color: '#15803d', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px', display: 'inline-block' }}>
                            {driver.sub_service_name || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {getBAName(driver)
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0px', background: '#ede9fe', color: '#6d28d9', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px' }}>
                              
                              {/* <Briefcase size={12} />  */}
                            {/* {getBAName(driver)} */}
                            BA Captain
                            </span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', color: '#94a3b8', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px' }}>Direct</span>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: driver.is_online ? '#dcfce7' : '#f1f5f9', color: driver.is_online ? '#166534' : '#64748b' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: driver.is_online ? '#22c55e' : '#94a3b8' }} />
                            {driver.is_online ? 'ON DUTY' : 'OFFLINE'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <select value={driver.status || 'pending'} onChange={e => handleStatusChange(driver, e.target.value)}
                            style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: `1.5px solid ${statusColor(driver.status).border}`, background: statusColor(driver.status).bg, color: statusColor(driver.status).color, cursor: 'pointer', outline: 'none', width: '100px' }}>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDate(driver.created_at)}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <a href={`tel:${driver.phone}`} title="Call" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '7px', borderRadius: '9px', display: 'flex', textDecoration: 'none' }}>
                              <Phone size={13} />
                            </a>
                            <a href={`https://wa.me/91${driver.phone}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', padding: '7px', borderRadius: '9px', display: 'flex', textDecoration: 'none' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            </a>
                            {(() => {
                              const low = isLowWallet(driver);
                              return (
                                <button
                                  title={low ? `Low wallet — below minimum (₹${minWalletMap[String(driver.sub_service_id)]})` : 'View Details'}
                                  onClick={() => setSelectedDriver(driver)}
                                  style={{ background: low ? '#fff1f2' : '#f8fafc', border: `1px solid ${low ? '#fecaca' : '#e2e8f0'}`, color: low ? '#ef4444' : '#64748b', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex' }}
                                >
                                  <ExternalLink size={13} />
                                </button>
                              );
                            })()}
                            <button title="Booking History" onClick={() => openBookings(driver)} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex' }}><BookOpen size={13} /></button>
                            <button title="Documents" onClick={() => openDocuments(driver)} style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex' }}><FileText size={13} /></button>
                            {canEdit && <button title="Edit" onClick={() => openEdit(driver)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#6366f1', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex' }}><Edit2 size={13} /></button>}
                            {canDelete && <button title="Delete" onClick={() => setDeleteConfirm(driver)} style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex' }}><Trash2 size={13} /></button>}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={10} style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>No captains found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="admin-mobile-cards" style={{ padding: '16px', display: 'block' }}>
              {paginatedDrivers.length > 0 ? (
                paginatedDrivers.map(driver => (
                  <MobileDriverCard key={driver.id} driver={driver} />
                ))
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>No captains found.</div>
              )}
            </div>
          </>
        )}

        {/* Pagination - Responsive */}
        {!loading && !error && filteredDrivers.length > 0 && (
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Showing <b>{paginatedDrivers.length}</b> of <b>{filteredDrivers.length}</b> Captains</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', opacity: page === 1 ? 0.5 : 1 }}>
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>
                Page {page} of {totalPages || 1}
              </span>
              <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', opacity: (page === totalPages || totalPages === 0) ? 0.5 : 1 }}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { 
          from { transform: rotate(0deg) } 
          to { transform: rotate(360deg) } 
        }
        @keyframes fadeSlideUp { 
          from { opacity: 0; transform: translateY(10px) } 
          to { opacity: 1; transform: translateY(0) } 
        }
        @media (max-width: 768px) {
          input, select, button {
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
