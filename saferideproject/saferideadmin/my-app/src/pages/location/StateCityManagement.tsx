import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, RefreshCw,
  ChevronLeft, ChevronRight, X, Save, Loader2,
  CheckCircle2, AlertCircle, MapPin, Map,
} from 'lucide-react';
import {
  getStates, createState, updateState, deleteState,
  getCities, createCity, updateCity, deleteCity,
} from '../../services/api';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface State {
  id: number;
  name: string;
  status?: number | string | null;
  created_at?: string | null;
}

interface City {
  id: number;
  name: string;
  state_id: number | string;
  state_name?: string | null;
  status?: number | string | null;
  created_at?: string | null;
}

interface ToastState { message: string; type: 'success' | 'error'; }

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function extractList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  const b = body as Record<string, unknown> | null | undefined;
  if (Array.isArray(b?.data))   return b!.data   as T[];
  if (Array.isArray(b?.items))  return b!.items  as T[];
  if (Array.isArray(b?.states)) return b!.states as T[];
  if (Array.isArray(b?.cities)) return b!.cities as T[];
  const inner = b?.data as Record<string, unknown> | undefined;
  if (Array.isArray(inner?.states)) return inner!.states as T[];
  if (Array.isArray(inner?.cities)) return inner!.cities as T[];
  return [];
}

// The states/cities endpoints paginate, so a single request only returns the first
// page — which is why newly added (last) states never reached the dropdown and the
// city count came up short. Walk every page and merge, deduped by id.
async function fetchAllPages<T extends { id: number }>(
  fetchPage: (params: Record<string, unknown>) => Promise<unknown>,
): Promise<T[]> {
  // NOTE: `Map` here would resolve to the lucide-react icon, so key by id in a plain object.
  const byId: Record<number, T> = {};
  for (let page = 1; page <= 50; page++) {
    const res  = await fetchPage({ page, limit: 100 });
    const list = extractList<T>((res as { data: unknown })?.data);
    if (list.length === 0) break;                 // no more pages
    const before = Object.keys(byId).length;
    list.forEach(item => { byId[item.id] = item; });
    // Backend ignored `page` (returned the same rows) → nothing new, stop.
    if (Object.keys(byId).length === before) break;
  }
  return Object.values(byId);
}

const getErrMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const ok = toast.type === 'success';
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: ok ? '#f0fdf4' : '#fff1f2', border: `1.5px solid ${ok ? '#bbf7d0' : '#fecdd3'}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: 320, animation: 'slideInRight 0.3s ease' }}>
      {ok ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#ef4444" />}
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? '#15803d' : '#dc2626' }}>{toast.message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: 0 }}><X size={14} color="#94a3b8" /></button>
    </div>
  );
}

// ─── Confirm Delete Modal ───────────────────────────────────────────────────────
function ConfirmDelete({ name, onClose, onConfirm, loading }: { name: string; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 360, boxShadow: '0 24px 60px rgba(0,0,0,0.15)', textAlign: 'center', animation: 'slideUp 0.3s ease' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Delete?</h3>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          Are you sure you want to delete <b>"{name}"</b>? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: loading ? '#fca5a5' : '#ef4444', color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── State Form Modal ──────────────────────────────────────────────────────────
function StateFormModal({ state, onClose, onSave }: {
  state?: State;
  onClose: () => void;
  onSave: (data: { name: string; status: number }) => Promise<void>;
}) {
  const isEdit = !!state;
  const [name,    setName]    = useState(state?.name || '');
  const [status,  setStatus]  = useState<number>(state?.status != null ? Number(state.status) : 1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('State name is required'); return; }
    setLoading(true);
    try {
      await onSave({ name: name.trim(), status });
      onClose();
    } catch (e) { setError(getErrMsg(e, 'Failed to save')); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 420, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,0.16)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit State' : 'Add State'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>{isEdit ? 'Update state details' : 'Add a new state'}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 16 }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
            State Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            value={name} onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="e.g. Rajasthan"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${error ? '#fca5a5' : '#e2e8f0'}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#0f172a' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ val: 1, label: 'Active' }, { val: 0, label: 'Inactive' }].map(s => (
              <button key={s.val} onClick={() => setStatus(s.val)}
                style={{ flex: 1, padding: '8px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${status === s.val ? (s.val === 1 ? '#6366f1' : '#ef4444') : '#e2e8f0'}`, background: status === s.val ? (s.val === 1 ? '#eef2ff' : '#fff1f2') : 'white', color: status === s.val ? (s.val === 1 ? '#6366f1' : '#ef4444') : '#94a3b8' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={13} /> {isEdit ? 'Update State' : 'Add State'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── City Form Modal ───────────────────────────────────────────────────────────
function CityFormModal({ city, states, defaultStateId, onClose, onSave }: {
  city?: City;
  states: State[];
  defaultStateId?: string;
  onClose: () => void;
  onSave: (data: { name: string; state_id: number; status: number }) => Promise<void>;
}) {
  const isEdit = !!city;
  const [name,    setName]    = useState(city?.name || '');
  // When adding, pre-select the state of the most recent city so adding several
  // cities in the same state doesn't mean re-picking it every time.
  const [stateId, setStateId] = useState<string>(
    city?.state_id != null ? String(city.state_id) : (defaultStateId || '')
  );
  const [status,  setStatus]  = useState<number>(city?.status != null ? Number(city.status) : 1);
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name     = 'City name is required';
    if (!stateId)      e.state_id = 'Please select a state';
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await onSave({ name: name.trim(), state_id: Number(stateId), status });
      onClose();
    } catch (err) { setErrors({ general: getErrMsg(err, 'Failed to save') }); }
    finally { setLoading(false); }
  };

  const inp = (field: string): React.CSSProperties => ({
    width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', color: '#0f172a',
    border: `1.5px solid ${errors[field] ? '#fca5a5' : '#e2e8f0'}`,
    background: errors[field] ? '#fff7f7' : 'white',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 440, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,0.16)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit City' : 'Add City'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>{isEdit ? 'Update city details' : 'Add a new city'}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#64748b" /></button>
        </div>

        {errors.general && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 16 }}>
            <AlertCircle size={13} /> {errors.general}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
            City Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            value={name} onChange={e => { setName(e.target.value); setErrors(ev => ({ ...ev, name: '' })); }}
            placeholder="e.g. Jaipur"
            style={inp('name')}
          />
          {errors.name && <p style={{ color: '#ef4444', fontSize: 11, margin: '4px 0 0' }}>{errors.name}</p>}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
            State <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select value={stateId} onChange={e => { setStateId(e.target.value); setErrors(ev => ({ ...ev, state_id: '' })); }}
            style={inp('state_id')}>
            <option value="">-- Select State --</option>
            {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {errors.state_id && <p style={{ color: '#ef4444', fontSize: 11, margin: '4px 0 0' }}>{errors.state_id}</p>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ val: 1, label: 'Active' }, { val: 0, label: 'Inactive' }].map(s => (
              <button key={s.val} onClick={() => setStatus(s.val)}
                style={{ flex: 1, padding: '8px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${status === s.val ? (s.val === 1 ? '#6366f1' : '#ef4444') : '#e2e8f0'}`, background: status === s.val ? (s.val === 1 ? '#eef2ff' : '#fff1f2') : 'white', color: status === s.val ? (s.val === 1 ? '#6366f1' : '#ef4444') : '#94a3b8' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={13} /> {isEdit ? 'Update City' : 'Add City'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── States Tab ────────────────────────────────────────────────────────────────
function StatesTab({ states, loading, refresh, showToast }: {
  states: State[];
  loading: boolean;
  refresh: () => Promise<void>;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [formTarget,   setFormTarget]   = useState<State | null | 'add'>('add' as never);
  const [showForm,     setShowForm]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<State | null>(null);
  const [delLoading,   setDelLoading]   = useState(false);
  const PER_PAGE = 10;

  const fetchAll = refresh;

  const handleSave = async (data: { name: string; status: number }) => {
    if (formTarget && formTarget !== 'add' && typeof formTarget === 'object') {
      await updateState((formTarget as State).id, data);
      showToast('State updated!');
    } else {
      await createState(data);
      showToast('State added!');
    }
    await fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteState(deleteTarget.id);
      showToast('State deleted!');
      setDeleteTarget(null);
      await fetchAll();
    } catch (e) { showToast(getErrMsg(e, 'Failed to delete'), 'error'); }
    finally { setDelLoading(false); }
  };

  const filtered   = useMemo(() => states.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())), [states, search]);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Never leave the user stranded on a page past the end of the list.
  useEffect(() => { if (page > 1 && page > totalPages) setPage(totalPages || 1); }, [page, totalPages]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', minWidth: 220 }}>
          <Search size={14} color="#94a3b8" />
          <input placeholder="Search states..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ border: 'none', outline: 'none', fontSize: 12, width: 180, color: '#1e293b' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} color="#94a3b8" /></button>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '7px 12px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={() => { setFormTarget(null); setShowForm(true); }}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '7px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            <Plus size={15} /> Add State
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
              {['#', 'State Name', 'Status', 'Created At', 'Actions'].map((h, i) => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                {Array.from({ length: 5 }).map((__, j) => (
                  <td key={j} style={{ padding: 14 }}><div style={{ height: 13, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 0 ? '30%' : '60%' }} /></td>
                ))}
              </tr>
            ))}
            {!loading && paginated.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center' }}>
                <Map size={32} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 10px' }} />
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{search ? 'No states match your search.' : 'No states found. Add your first state!'}</div>
              </td></tr>
            )}
            {!loading && paginated.map((s, idx) => (
              <tr key={s.id}
                style={{ borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{(page - 1) * PER_PAGE + idx + 1}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Map size={16} color="#6366f1" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>ID: {s.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: Number(s.status) === 1 ? '#d1fae5' : '#f1f5f9', color: Number(s.status) === 1 ? '#065f46' : '#64748b', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: Number(s.status) === 1 ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
                    {Number(s.status) === 1 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{fmtDate(s.created_at)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setFormTarget(s); setShowForm(true); }}
                      style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex' }}
                      title="Edit"><Edit2 size={13} /></button>
                    <button onClick={() => setDeleteTarget(s)}
                      style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex' }}
                      title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            <b style={{ color: '#475569' }}>{filtered.length}</b> states
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1, display: 'flex' }}>
              <ChevronLeft size={14} />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1, display: 'flex' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <StateFormModal
          state={formTarget && typeof formTarget === 'object' ? formTarget as State : undefined}
          onClose={() => { setShowForm(false); setFormTarget(null); }}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={delLoading}
        />
      )}
    </>
  );
}

// ─── Cities Tab ────────────────────────────────────────────────────────────────
function CitiesTab({ cities, states, loading, refresh, showToast }: {
  cities: City[];
  states: State[];
  loading: boolean;
  refresh: () => Promise<void>;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [search,       setSearch]       = useState('');
  const [stateFilter,  setStateFilter]  = useState('');
  const [page,         setPage]         = useState(1);
  const [showForm,     setShowForm]     = useState(false);
  const [formTarget,   setFormTarget]   = useState<City | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<City | null>(null);
  const [delLoading,   setDelLoading]   = useState(false);
  const PER_PAGE = 10;

  const stateMap = useMemo(() => {
    const m: Record<number, string> = {};
    states.forEach(s => { m[s.id] = s.name; });
    return m;
  }, [states]);

  // State of the most recently added city (highest id) — used to pre-select the
  // State dropdown when adding a new city.
  const lastStateId = useMemo(() => {
    if (cities.length === 0) return '';
    const last = cities.reduce((a, b) => (b.id > a.id ? b : a));
    return last.state_id != null ? String(last.state_id) : '';
  }, [cities]);

  const fetchAll = refresh;

  const handleSave = async (data: { name: string; state_id: number; status: number }) => {
    if (formTarget) {
      await updateCity(formTarget.id, data);
      showToast('City updated!');
    } else {
      await createCity(data);
      showToast('City added!');
    }
    await fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteCity(deleteTarget.id);
      showToast('City deleted!');
      setDeleteTarget(null);
      await fetchAll();
    } catch (e) { showToast(getErrMsg(e, 'Failed to delete'), 'error'); }
    finally { setDelLoading(false); }
  };

  const filtered = useMemo(() => cities.filter(c => {
    const q = search.toLowerCase();
    const ms = !q || c.name?.toLowerCase().includes(q) ||
      (c.state_name || stateMap[Number(c.state_id)] || '').toLowerCase().includes(q);
    const mst = !stateFilter || String(c.state_id) === stateFilter;
    return ms && mst;
  }), [cities, search, stateFilter, stateMap]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Never leave the user stranded on a page past the end of the list.
  useEffect(() => { if (page > 1 && page > totalPages) setPage(totalPages || 1); }, [page, totalPages]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', minWidth: 220 }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search cities or states..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: 12, width: 180, color: '#1e293b' }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} color="#94a3b8" /></button>}
          </div>
          <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }}
            style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', fontSize: 12, outline: 'none', background: 'white', color: '#1e293b', minWidth: 150 }}>
            <option value="">All States</option>
            {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '7px 12px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={() => { setFormTarget(null); setShowForm(true); }}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '7px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            <Plus size={15} /> Add City
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
              {['#', 'City Name', 'State', 'Status', 'Created At', 'Actions'].map((h, i) => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: i === 5 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} style={{ padding: 14 }}><div style={{ height: 13, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', width: j === 0 ? '30%' : '60%' }} /></td>
                ))}
              </tr>
            ))}
            {!loading && paginated.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                <MapPin size={32} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 10px' }} />
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{search || stateFilter ? 'No cities match your search.' : 'No cities found. Add your first city!'}</div>
              </td></tr>
            )}
            {!loading && paginated.map((c, idx) => {
              const stateName = c.state_name || stateMap[Number(c.state_id)] || `State #${c.state_id}`;
              return (
                <tr key={c.id}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{(page - 1) * PER_PAGE + idx + 1}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MapPin size={16} color="#16a34a" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>ID: {c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#eef2ff', color: '#6366f1', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                      <Map size={10} /> {stateName}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: Number(c.status) === 1 ? '#d1fae5' : '#f1f5f9', color: Number(c.status) === 1 ? '#065f46' : '#64748b', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: Number(c.status) === 1 ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
                      {Number(c.status) === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{fmtDate(c.created_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setFormTarget(c); setShowForm(true); }}
                        style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex' }}
                        title="Edit"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteTarget(c)}
                        style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex' }}
                        title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Showing <b style={{ color: '#475569' }}>{filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</b> of <b style={{ color: '#475569' }}>{filtered.length}</b> cities
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1, display: 'flex' }}>
              <ChevronLeft size={14} />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1, display: 'flex' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <CityFormModal
          city={formTarget || undefined}
          states={states}
          defaultStateId={lastStateId}
          onClose={() => { setShowForm(false); setFormTarget(null); }}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={delLoading}
        />
      )}
    </>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function StateCityManagement() {
  const [tab,    setTab]    = useState<'states' | 'cities'>('states');
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [toast,  setToast]  = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // High limit so the API's default pagination doesn't truncate the list
  // (that's what made the newest states missing from the dropdown and the counts short).
  const fetchStates = useCallback(async () => {
    setStatesLoading(true);
    try {
      setStates(await fetchAllPages<State>(getStates));
    } catch { showToast('Failed to load states', 'error'); }
    finally { setStatesLoading(false); }
  }, [showToast]);

  const fetchCities = useCallback(async () => {
    setCitiesLoading(true);
    try {
      setCities(await fetchAllPages<City>(getCities));
    } catch { showToast('Failed to load cities', 'error'); }
    finally { setCitiesLoading(false); }
  }, [showToast]);

  // Both load up-front so the Add-City state dropdown is always complete,
  // regardless of which tab is open.
  useEffect(() => { fetchStates(); fetchCities(); }, [fetchStates, fetchCities]);

  const tabs = [
    { key: 'states' as const, label: 'States', icon: <Map size={14} />,    count: states.length },
    { key: 'cities' as const, label: 'Cities', icon: <MapPin size={14} />, count: cities.length },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp      { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ padding: 24, animation: 'fadeSlideUp 0.4s ease' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>State & City Management</h2>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Manage states and cities for the platform</p>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total States',  value: states.length, bg: '#eef2ff', color: '#6366f1', icon: <Map size={20} color="#6366f1" /> },
            { label: 'Active States', value: states.filter(s => Number(s.status) === 1).length, bg: '#d1fae5', color: '#059669', icon: <CheckCircle2 size={20} color="#059669" /> },
            { label: 'Total Cities',  value: cities.length, bg: '#f0fdf4', color: '#16a34a', icon: <MapPin size={20} color="#16a34a" /> },
            { label: 'Active Cities', value: cities.filter(c => Number(c.status) === 1).length, bg: '#fef3c7', color: '#d97706', icon: <CheckCircle2 size={20} color="#d97706" /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: '14px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                background: active ? 'white' : 'transparent',
                color: active ? '#6366f1' : '#94a3b8',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>
                {t.icon} {t.label}
                {t.count != null && (
                  <span style={{ background: active ? '#eef2ff' : '#e2e8f0', color: active ? '#6366f1' : '#94a3b8', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'states' && <StatesTab states={states} loading={statesLoading} refresh={fetchStates} showToast={showToast} />}
        {tab === 'cities' && <CitiesTab cities={cities} states={states} loading={citiesLoading} refresh={fetchCities} showToast={showToast} />}
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
