import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Edit2, Trash2, Plus, Search, ChevronLeft, ChevronRight,
  X, Save, Loader2, AlertCircle, CheckCircle2, FileText
} from 'lucide-react';
import {
  getAllServiceDocuments,
  createServiceDocument,
  updateServiceDocument,
  deleteServiceDocument,
  getAllServices,
} from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface ServiceDoc {
  id: number;
  service_id: number;
  document_type: string;
  created_at?: string;
}

interface Service {
  id: number;
  title?: string;
  name?: string;
}

interface ToastType {
  message: string;
  type: string;
}

interface ModalState {
  type: 'add' | 'edit' | 'delete';
  document?: ServiceDoc;
}

interface FormErrors {
  service_id?: string;
  document_type?: string;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }: { toast: ToastType; onClose: () => void }) {
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
      {ok
        ? <CheckCircle2 size={16} color="#16a34a" />
        : <AlertCircle  size={16} color="#ef4444" />
      }
      <span style={{ fontSize: '13px', fontWeight: 600, color: ok ? '#15803d' : '#dc2626' }}>
        {toast.message}
      </span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: 0 }}>
        <X size={14} color="#94a3b8" />
      </button>
    </div>
  );
}

// ─── DOCUMENT TYPE CONFIG ─────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'adhar_front',              label: 'Aadhar Front'                },
  { value: 'adhar_back',               label: 'Aadhar Back'                 },
  { value: 'license',                  label: 'License'                     },
  { value: 'pan_card',                 label: 'PAN Card'                    },
  { value: 'passport',                 label: 'Passport'                    },
  { value: 'voter_id',                 label: 'Voter ID'                    },
  { value: 'rc',                       label: 'RC (Registration Certificate)'},
  { value: 'vehicle_fitness_certificate', label: 'Vehicle Fitness Certificate'},
  { value: 'other',                    label: 'Other'                       },
];

const DOC_BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  adhar_front: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  adhar_back:  { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  license:     { bg: '#eef2ff', color: '#6366f1', border: '#c7d2fe' },
  pan_card:    { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  passport:    { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
  voter_id:    { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
  other:       { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
};

function DocTypeBadge({ type }: { type: string }) {
  const label = DOC_TYPES.find(d => d.value === type)?.label || type;
  const c = DOC_BADGE_COLORS[type] || DOC_BADGE_COLORS.other;
  return (
    <span style={{
      display: 'inline-block', fontSize: '11px', fontWeight: 600,
      padding: '3px 10px', borderRadius: '20px',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {label}
    </span>
  );
}

// ─── SERVICE DOCUMENT MODAL ───────────────────────────────────────────────────
function ServiceDocumentModal({ mode, document: doc, services, onClose, onSave }: {
  mode: 'add' | 'edit';
  document?: ServiceDoc;
  services: Service[];
  onClose: () => void;
  onSave: (payload: { service_id: number | string; document_type: string }) => Promise<void>;
}) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    service_id:    doc?.service_id    ?? '',
    document_type: doc?.document_type ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<FormErrors>({});

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.service_id)    e.service_id    = 'Service is required';
    if (!form.document_type) e.document_type = 'Document type is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSave({ service_id: form.service_id, document_type: form.document_type });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (_field: string): React.CSSProperties => ({
    width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
    border: `1.5px solid ${errors[_field as keyof FormErrors] ? '#fca5a5' : '#e2e8f0'}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
    color: '#0f172a',
    background: errors[_field as keyof FormErrors] ? '#fff7f7' : 'white',
  });

  const selectedService = services.find(s => s.id == form.service_id);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '28px',
        width: '480px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,0.16)', animation: 'slideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              {isEdit ? 'Edit Document' : 'Add New Document'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              {isEdit ? 'Update document details' : 'Select a service and document type'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
            <X size={16} color="#64748b" />
          </button>
        </div>

        {/* Select Service */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Service <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '8px', marginBottom: '6px',
          }}>
            {services.map((s: Service) => {
              const isSelected = form.service_id == s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => { setForm(f => ({ ...f, service_id: s.id })); setErrors(e => ({ ...e, service_id: '' })); }}
                  style={{
                    border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                    borderRadius: '10px', padding: '10px 12px', cursor: 'pointer',
                    background: isSelected ? '#eef2ff' : '#fafbfc',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#6366f1' : '#1e293b', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.title || s.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {s.id}</div>
                </div>
              );
            })}
            {services.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: '4px' }} />
                <div>Loading services...</div>
              </div>
            )}
          </div>
          {selectedService && (
            <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, marginTop: '4px' }}>
              Selected: {selectedService.title || selectedService.name}
            </div>
          )}
          {errors.service_id && (
            <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.service_id}</p>
          )}
        </div>

        {/* Document Type */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Document Type <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={form.document_type}
            onChange={e => { setForm(f => ({ ...f, document_type: e.target.value })); setErrors(ev => ({ ...ev, document_type: '' })); }}
            style={inputStyle('document_type')}
          >
            <option value="">-- Select Document Type --</option>
            {DOC_TYPES.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {errors.document_type && (
            <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{errors.document_type}</p>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
            background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{
            flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
            background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white', fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)',
          }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : <><Save size={14} /> {isEdit ? 'Update Document' : 'Add Document'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────
function DeleteModal({ document: doc, serviceName, onClose, onConfirm, loading }: {
  document?: ServiceDoc;
  serviceName: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '28px', width: '360px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.15)', textAlign: 'center',
        animation: 'slideUp 0.3s ease',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%', background: '#fff1f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
          Delete Document?
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
          Are you sure you want to delete <b>"{doc?.document_type}"</b> from <b>{serviceName}</b>? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
            background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
            background: loading ? '#fca5a5' : '#ef4444', color: 'white',
            fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</>
              : 'Delete'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ServiceDocumentList() {
  const [documents,     setDocuments]     = useState<ServiceDoc[]>([]);
  const [services,      setServices]      = useState<Service[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast,         setToast]         = useState<ToastType | null>(null);
  const PER_PAGE = 8;

  const showToast = (message: string, type = 'success') => setToast({ message, type });

  const getServiceName = useCallback(
    (id: number): string => {
      const s = services.find(x => x.id == id);
      return s ? (s.title || s.name || `Service #${id}`) : `Service #${id}`;
    },
    [services]
  );

  // ── FETCH SERVICES ────────────────────────────────────────────────────────
  const fetchServices = useCallback(async () => {
    try {
      const data = await getAllServices();
      setServices(Array.isArray(data) ? data : data.data || []);
    } catch {
      showToast('Failed to load services', 'error');
    }
  }, []);

  // ── FETCH DOCUMENTS ───────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllServiceDocuments();
      setDocuments(Array.isArray(data) ? data : data.data || []);
    } catch {
      showToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchDocuments();
  }, [fetchServices, fetchDocuments]);

  // ── CREATE ────────────────────────────────────────────────────────────────
  const handleCreate = async (payload: any) => {
    try {
      await createServiceDocument(payload);
      setModal(null);
      showToast('Document added successfully!');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Failed to add document', 'error');
      throw err;
    }
  };

  // ── UPDATE ────────────────────────────────────────────────────────────────
  const handleUpdate = async (payload: any) => {
    try {
      const res = await updateServiceDocument(modal!.document!.id, payload);
      const updated = res?.data?.data || res?.data || res;
      if (updated && updated.id) {
        setDocuments(prev => prev.map(d => d.id === modal!.document!.id ? { ...d, ...updated } : d));
      } else {
        await fetchDocuments();
      }
      setModal(null);
      showToast('Document updated successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to update document', 'error');
      throw err;
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deleteServiceDocument(modal!.document!.id);
      setDocuments(prev => prev.filter(d => d.id !== modal!.document!.id));
      setModal(null);
      showToast('Document deleted successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── FILTER + PAGINATE ─────────────────────────────────────────────────────
  const filteredData = useMemo(() =>
    documents.filter(d =>
      d.document_type?.toLowerCase().includes(search.toLowerCase()) ||
      getServiceName(d.service_id)?.toLowerCase().includes(search.toLowerCase())
    ),
    [documents, search, getServiceName]
  );
  const totalPages    = Math.ceil(filteredData.length / PER_PAGE);
  const paginatedData = filteredData.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp      { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn       { from { opacity:0 } to { opacity:1 } }
        @keyframes spin         { to   { transform:rotate(360deg) } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .doc-row:hover td { background:#fafbff !important; }
        .action-btn:hover { transform:scale(1.06); transition:transform 0.15s; }
      `}</style>

      <div style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Service Documents</h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
              Total <b>{filteredData.length}</b> document records
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'white', border: '1.5px solid #e2e8f0',
              borderRadius: '10px', padding: '6px 12px',
            }}>
              <Search size={14} color="#94a3b8" />
              <input
                placeholder="Search by service or type..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ border: 'none', outline: 'none', fontSize: '12px', width: '200px' }}
              />
            </div>
            <button
              onClick={() => setModal({ type: 'add' })}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.2)',
              }}
            >
              <Plus size={16} /> Add Document
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: 'white', borderRadius: '16px',
          border: '1.5px solid #eef2f7', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                {([
                  { label: 'ID',           align: 'left'  },
                  { label: 'Service',       align: 'left'  },
                  { label: 'Document Type', align: 'left'  },
                  { label: 'Created At',    align: 'left'  },
                  { label: 'Actions',       align: 'right' },
                ] as { label: string; align: React.CSSProperties['textAlign'] }[]).map(({ label, align }) => (
                  <th key={label} style={{
                    padding: '12px 16px', fontSize: '11px', color: '#94a3b8',
                    fontWeight: 700, textTransform: 'uppercase', textAlign: align,
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Skeleton */}
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{
                        height: '14px', borderRadius: '6px', background: '#f1f5f9',
                        animation: 'pulse 1.5s ease infinite', width: j === 0 ? '30%' : '55%',
                      }} />
                    </td>
                  ))}
                </tr>
              ))}

              {/* Empty */}
              {!loading && paginatedData.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <FileText size={32} color="#e2e8f0" />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                        {search ? 'No documents match your search.' : 'No documents found. Add your first one!'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Rows */}
              {!loading && paginatedData.map((doc: ServiceDoc) => (
                <tr key={doc.id} className="doc-row" style={{ borderBottom: '1px solid #f1f5f9' }}>

                  {/* ID */}
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '28px', height: '22px', borderRadius: '6px',
                      background: '#f1f5f9', color: '#64748b',
                      fontSize: '11px', fontWeight: 700, padding: '0 6px',
                    }}>
                      #{doc.id}
                    </span>
                  </td>

                  {/* Service */}
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '8px',
                        background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FileText size={14} color="#6366f1" />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                          {getServiceName(doc.service_id)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                          Service ID: {doc.service_id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Document Type */}
                  <td style={{ padding: '13px 16px' }}>
                    <DocTypeBadge type={doc.document_type} />
                  </td>

                  {/* Created At */}
                  <td style={{ padding: '13px 16px' }}>
                    {doc.created_at
                      ? <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      : <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>
                    }
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        className="action-btn"
                        onClick={() => setModal({ type: 'edit', document: doc })}
                        style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => setModal({ type: 'delete', document: doc })}
                        style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{
            padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9',
          }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Page <b>{page}</b> of <b>{totalPages || 1}</b> · <b>{filteredData.length}</b> results
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages || totalPages === 0}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <ServiceDocumentModal
          mode="add"
          services={services}
          onClose={() => setModal(null)}
          onSave={handleCreate}
        />
      )}
      {modal?.type === 'edit' && (
        <ServiceDocumentModal
          mode="edit"
          document={modal.document}
          services={services}
          onClose={() => setModal(null)}
          onSave={handleUpdate}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal
          document={modal.document}
          serviceName={getServiceName(modal.document!.service_id)}
          onClose={() => setModal(null)}
          onConfirm={handleDelete}
          loading={actionLoading}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}