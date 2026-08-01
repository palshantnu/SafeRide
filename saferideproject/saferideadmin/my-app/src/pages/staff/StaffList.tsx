import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Save, ChevronLeft, ChevronRight,
  User, Mail, Phone, Shield, CheckCircle2, AlertCircle, EyeOff, Eye, Lock,
} from 'lucide-react';
import {
  getAllStaff, createStaff, updateStaff, deleteStaff, getAllRoles,
} from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role_id: number;
  role_name: string;
  status: number; // 1 = active, 0 = inactive
  created_at: string;
}

interface RoleOption {
  id: number;
  role_name: string;
}

interface FormState {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role_id: number;
  status: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Super Admin': { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
  'Manager':     { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'Support':     { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'Accountant':  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  'Viewer':      { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
};
const FALLBACK_COLORS = [
  { bg: '#eef2ff', color: '#6366f1', border: '#c7d2fe' },
  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
];
const getRoleStyle = (roleName: string, idx?: number) =>
  ROLE_COLORS[roleName] ?? FALLBACK_COLORS[(idx ?? 0) % FALLBACK_COLORS.length];

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const avatarColor = (name: string) => {
  const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  return colors[name.charCodeAt(0) % colors.length];
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'success' ? '#10b981' : '#ef4444',
      color: '#fff', padding: '12px 20px', borderRadius: 12,
      fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      animation: 'fadeSlideUp 0.3s ease',
    }}>
      {msg}
    </div>
  );
}

// ─── STAFF MODAL ──────────────────────────────────────────────────────────────

function StaffModal({ mode, staff, roles, onClose, onSave }: {
  mode: 'add' | 'edit';
  staff?: StaffMember;
  roles: RoleOption[];
  onClose: () => void;
  onSave: (data: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({
    name:     staff?.name     ?? '',
    email:    staff?.email    ?? '',
    mobile:   staff?.mobile   ?? '',
    password: '',
    role_id:  staff?.role_id  ?? (roles[0]?.id ?? 0),
    status:   staff?.status   ?? 1,
  });
  const [errors,  setErrors]  = useState<Partial<Record<keyof FormState, string>>>({});
  const [showPwd, setShowPwd] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())  e.name   = 'Name required';
    if (!form.email.trim()) e.email  = 'Email required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.mobile.trim() || form.mobile.length < 10) e.mobile = '10 digit number required';
    if (mode === 'add' && !form.password.trim()) e.password = 'Password required';
    if (!form.role_id) e.role_id = 'Role required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inp = (field: keyof FormState): React.CSSProperties => ({
    width: '100%', padding: '9px 12px', fontSize: '13px', borderRadius: '8px',
    border: `1.5px solid ${errors[field] ? '#fca5a5' : '#e2e8f0'}`,
    outline: 'none', boxSizing: 'border-box', color: '#0f172a',
    background: errors[field] ? '#fff7f7' : 'white',
  });

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '480px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              {mode === 'add' ? 'Add New Staff' : 'Edit Staff'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              {mode === 'add' ? 'Fill in staff member details' : 'Update staff information'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex' }}>
            <X size={16} color="#64748b" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Name */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Enter full name" style={{ ...inp('name'), paddingLeft: '32px' }} />
            </div>
            {errors.name && <p style={{ color: '#ef4444', fontSize: '11px', margin: '3px 0 0' }}>{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>
              Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="staff@email.com" type="email" style={{ ...inp('email'), paddingLeft: '32px' }} />
            </div>
            {errors.email && <p style={{ color: '#ef4444', fontSize: '11px', margin: '3px 0 0' }}>{errors.email}</p>}
          </div>

          {/* Mobile */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>
              Mobile <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                placeholder="10 digit number" maxLength={10} style={{ ...inp('mobile'), paddingLeft: '32px' }} />
            </div>
            {errors.mobile && <p style={{ color: '#ef4444', fontSize: '11px', margin: '3px 0 0' }}>{errors.mobile}</p>}
          </div>

          {/* Password */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>
              Password
              {mode === 'edit' && <span style={{ color: '#94a3b8', fontWeight: 400 }}> (leave blank to keep current)</span>}
              {mode === 'add'  && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                type={showPwd ? 'text' : 'password'} placeholder="Set password"
                style={{ ...inp('password'), paddingLeft: '32px', paddingRight: '36px' }} />
              <button onClick={() => setShowPwd(p => !p)} type="button"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                {showPwd ? <EyeOff size={14} color="#94a3b8" /> : <Eye size={14} color="#94a3b8" />}
              </button>
            </div>
            {errors.password && <p style={{ color: '#ef4444', fontSize: '11px', margin: '3px 0 0' }}>{errors.password}</p>}
          </div>

          {/* Role */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>
              Role <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: Number(e.target.value) }))}
              style={{ ...inp('role_id'), cursor: 'pointer' }}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
            {errors.role_id && <p style={{ color: '#ef4444', fontSize: '11px', margin: '3px 0 0' }}>{errors.role_id}</p>}
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Status</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ label: 'Active', val: 1 }, { label: 'Inactive', val: 0 }].map(({ label, val }) => (
                <button key={val} onClick={() => setForm(f => ({ ...f, status: val }))}
                  style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#e2e8f0'}`,
                    background: form.status === val ? (val === 1 ? '#eef2ff' : '#fff1f2') : 'white',
                    color: form.status === val ? (val === 1 ? '#6366f1' : '#ef4444') : '#94a3b8' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: saving ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: saving ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Save size={14} /> {saving ? 'Saving...' : (mode === 'add' ? 'Add Staff' : 'Update Staff')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────

function DeleteModal({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '360px', maxWidth: '95vw', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Remove Staff?</h3>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
          Are you sure you want to remove <b>{name}</b>? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={async () => { setLoading(true); await onConfirm(); }} disabled={loading}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#ef4444', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function StaffList() {
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [roles,        setRoles]        = useState<RoleOption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(1);
  const [modal,        setModal]        = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected,     setSelected]     = useState<StaffMember | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const PER_PAGE = 8;

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, rolesRes] = await Promise.all([getAllStaff(), getAllRoles()]);
      const staffData = staffRes.data?.data ?? staffRes.data ?? [];
      const rolesData = rolesRes.data?.data ?? rolesRes.data ?? [];
      setStaff(Array.isArray(staffData) ? staffData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch {
      showToast('Failed to load staff data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => staff.filter(s => {
    const q = search.toLowerCase();
    const matchQ      = !q          || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.mobile.includes(q);
    const matchRole   = !roleFilter   || String(s.role_id) === roleFilter;
    const matchStatus = !statusFilter || String(s.status)  === statusFilter;
    return matchQ && matchRole && matchStatus;
  }), [staff, search, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSave = async (data: FormState) => {
    try {
      const payload: Record<string, unknown> = {
        name: data.name, email: data.email, mobile: data.mobile,
        role_id: data.role_id, status: data.status,
      };
      if (data.password) payload.password = data.password;

      if (modal === 'add') {
        await createStaff(payload);
        showToast('Staff added successfully');
      } else if (modal === 'edit' && selected) {
        await updateStaff(selected.id, payload);
        showToast('Staff updated successfully');
      }
      setModal(null); setSelected(null);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Operation failed', 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteStaff(selected.id);
      showToast('Staff removed successfully');
      setModal(null); setSelected(null);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Delete failed', 'error');
      throw err;
    }
  };

  const toggleStatus = async (member: StaffMember) => {
    const newStatus = member.status === 1 ? 0 : 1;
    setStaff(p => p.map(s => s.id === member.id ? { ...s, status: newStatus } : s));
    try {
      await updateStaff(member.id, { status: newStatus });
    } catch {
      setStaff(p => p.map(s => s.id === member.id ? { ...s, status: member.status } : s));
      showToast('Failed to update status', 'error');
    }
  };

  const activeCount   = staff.filter(s => s.status === 1).length;
  const inactiveCount = staff.filter(s => s.status === 0).length;
  const uniqueRoles   = new Set(staff.map(s => s.role_id)).size;

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .staff-row:hover td { background: #fafbff !important; }
        .staff-row td { transition: background 0.12s; }
        .action-btn:hover { transform: scale(1.08); transition: transform 0.15s; }
        .sk { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:6px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <div style={{ padding: '24px', animation: 'fadeSlideUp 0.4s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Staff Management</h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0' }}>Manage admin panel access and roles</p>
          </div>
          <button onClick={() => setModal('add')}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Plus size={16} /> Add Staff
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Staff',  value: loading ? '…' : staff.length,   bg: '#eef2ff', color: '#6366f1', icon: <User size={18} color="#6366f1" /> },
            { label: 'Active',       value: loading ? '…' : activeCount,    bg: '#d1fae5', color: '#059669', icon: <CheckCircle2 size={18} color="#059669" /> },
            { label: 'Inactive',     value: loading ? '…' : inactiveCount,  bg: '#fee2e2', color: '#dc2626', icon: <AlertCircle size={18} color="#dc2626" /> },
            { label: 'Roles Used',   value: loading ? '…' : uniqueRoles,    bg: '#fdf4ff', color: '#7e22ce', icon: <Shield size={18} color="#7e22ce" /> },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', borderRadius: '14px', padding: '14px 18px', border: '1.5px solid #eef2f7', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{c.value}</div>
                <div style={{ fontSize: '11px', color: c.color, fontWeight: 600 }}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px', flex: 1, minWidth: '200px' }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search name, email, mobile..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%' }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} color="#94a3b8" /></button>}
          </div>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px', fontSize: '12px', color: '#475569', outline: 'none', background: 'white', cursor: 'pointer' }}>
            <option value="">All Roles</option>
            {roles.map(r => <option key={r.id} value={String(r.id)}>{r.role_name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px', fontSize: '12px', color: '#475569', outline: 'none', background: 'white', cursor: 'pointer' }}>
            <option value="">All Status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {['#', 'Staff Member', 'Contact', 'Role', 'Joined', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: i === 6 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} style={{ padding: '14px 16px' }}>
                          <div className="sk" style={{ height: 14, width: j === 1 ? 130 : 70 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '56px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No staff members found.</td></tr>
                ) : paginated.map((member, idx) => {
                  const rc = getRoleStyle(member.role_name, idx);
                  return (
                    <tr key={member.id} className="staff-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                        {(page - 1) * PER_PAGE + idx + 1}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: avatarColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {initials(member.name)}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{member.name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: #{member.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Mail size={11} color="#94a3b8" /> {member.email}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Phone size={11} /> {member.mobile}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                          {member.role_name}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748b' }}>
                        {fmtDate(member.created_at)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <button onClick={() => toggleStatus(member)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', background: member.status === 1 ? '#d1fae5' : '#f1f5f9', color: member.status === 1 ? '#065f46' : '#64748b', transition: 'all 0.2s' }}>
                          {member.status === 1 ? <Eye size={11} /> : <EyeOff size={11} />}
                          {member.status === 1 ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="action-btn" onClick={() => { setSelected(member); setModal('edit'); }}
                            style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#6366f1', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                            <Edit2 size={13} />
                          </button>
                          <button className="action-btn" onClick={() => { setSelected(member); setModal('delete'); }}
                            style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Page <b>{page}</b> of <b>{totalPages || 1}</b> · <b>{filtered.length}</b> members
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page === 1 ? 0.4 : 1, display: 'flex' }}>
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: '#64748b', opacity: page >= totalPages ? 0.4 : 1, display: 'flex' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal === 'add' && (
        <StaffModal mode="add" roles={roles} onClose={() => setModal(null)} onSave={handleSave} />
      )}
      {modal === 'edit' && selected && (
        <StaffModal mode="edit" staff={selected} roles={roles} onClose={() => { setModal(null); setSelected(null); }} onSave={handleSave} />
      )}
      {modal === 'delete' && selected && (
        <DeleteModal name={selected.name} onClose={() => { setModal(null); setSelected(null); }} onConfirm={handleDelete} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  );
}
