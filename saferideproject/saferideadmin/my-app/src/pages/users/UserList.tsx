import React, { useState, useMemo, useEffect } from 'react';
import {
  Edit2, Trash2, Plus, Search, ChevronLeft, ChevronRight,
  UserCircle, RefreshCw, Phone, MessageCircle, ClipboardList, Eye,
  X, AlertTriangle, Mail, Smartphone, Shield, Calendar, CheckCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAllUsers, getAllBookinghistory } from "../../services/api";
import { usePermissions } from "../../context/PermissionsContext";

interface User {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string | null;
  status: number;
  created_at: string | null;
}

const PER_PAGE = 5;

const getRoleBadge = (role: string | null) => {
  const styles: Record<string, { background: string; color: string }> = {
    admin:  { background: '#fef3c7', color: '#92400e' },
    driver: { background: '#dbeafe', color: '#1e40af' },
    user:   { background: '#eef2ff', color: '#6366f1' },
  };
  return styles[role?.toLowerCase() ?? ''] ?? styles.user;
};

const formatRole = (role: string | null) => {
  if (!role) return '—';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ─── View Modal ─── */
function ViewModal({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: '420px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          padding: '24px', display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserCircle size={28} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '16px' }}>{user.name ?? 'No Name'}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '2px' }}>User ID #{user.id}</div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <InfoRow icon={<Mail size={14} color="#6366f1" />} label="Email" value={user.email ?? '—'} />
          <InfoRow icon={<Smartphone size={14} color="#6366f1" />} label="Mobile" value={user.mobile ?? '—'} />
          <InfoRow icon={<Shield size={14} color="#6366f1" />} label="Role" value={formatRole(user.role)} />
          <InfoRow icon={<Calendar size={14} color="#6366f1" />} label="Joined" value={formatDate(user.created_at)} />
          <InfoRow
            icon={<CheckCircle size={14} color={user.status === 1 ? '#10b981' : '#94a3b8'} />}
            label="Status"
            value={
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                background: user.status === 1 ? '#d1fae5' : '#f1f5f9',
                color: user.status === 1 ? '#065f46' : '#64748b',
              }}>
                {user.status === 1 ? 'Active' : 'Inactive'}
              </span>
            }
          />
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <button onClick={onClose} style={{
            width: '100%', padding: '10px', borderRadius: '10px',
            background: '#f1f5f9', border: 'none', color: '#64748b',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Modal ─── */
function EditModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (updated: User) => void }) {
  const [form, setForm] = useState({ name: user.name ?? '', email: user.email ?? '', mobile: user.mobile ?? '', role: user.role ?? 'user', status: user.status });

  const handleSave = () => {
    onSave({ ...user, name: form.name, email: form.email, mobile: form.mobile, role: form.role, status: form.status });
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Edit User</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>ID #{user.id}</p>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Full Name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Enter name" />
          </Field>
          <Field label="Email">
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="Enter email" type="email" />
          </Field>
          <Field label="Mobile">
            <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} style={inputStyle} placeholder="Enter mobile" />
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
              <option value="user">User</option>
              <option value="driver">Captain</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: Number(e.target.value) }))} style={inputStyle}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Modal ─── */
function DeleteModal({ user, onClose, onConfirm }: { user: User; onClose: () => void; onConfirm: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: '380px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ ...closeBtn, position: 'absolute', top: '16px', right: '16px' }}><X size={16} /></button>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={26} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>Delete User?</h3>
        <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#64748b' }}>
          Are you sure you want to delete <strong>{user.name ?? `User #${user.id}`}</strong>?
        </p>
        <p style={{ margin: '0 0 24px', fontSize: '12px', color: '#94a3b8' }}>This action cannot be undone.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#ef4444', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500, marginTop: '2px' }}>{value}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

/* ─── User Bookings Modal ─── */
interface BookingItem {
  id: number;
  booking_id?: string;
  status?: string;
  service_name?: string;
  sub_service_name?: string;
  plan_name?: string;
  total_fare?: string | null;
  plan_price?: string | null;
  pickup_city?: string;
  drop_city?: string;
  driver_name?: string | null;
  payment_mode?: string | null;
  created_at?: string;
  user_id?: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  COMPLETED:    { bg: '#d1fae5', color: '#065f46' },
  CANCELLED:    { bg: '#fee2e2', color: '#991b1b' },
  SEARCHING:    { bg: '#fef3c7', color: '#92400e' },
  ACCEPTED:     { bg: '#dbeafe', color: '#1e40af' },
  STARTED:      { bg: '#dcfce7', color: '#166534' },
  PAYMENT_DONE: { bg: '#ecfdf5', color: '#065f46' },
};
const getBSt = (s?: string) => STATUS_COLORS[(s || '').toUpperCase()] || { bg: '#f1f5f9', color: '#475569' };

function UserBookingsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await getAllBookinghistory({ limit: 1000 });
        const body = (res as { data: unknown }).data;
        const all: BookingItem[] =
          Array.isArray(body) ? body :
          Array.isArray((body as { data?: BookingItem[] })?.data) ? (body as { data: BookingItem[] }).data : [];
        setBookings(all.filter(b => b.user_id === user.id));
      } catch { setBookings([]); }
      finally { setLoading(false); }
    })();
  }, [user.id]);

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 680, padding: 0, overflow: 'hidden', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Booking History</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>{user.name || `User #${user.id}`} · {bookings.length} bookings</p>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 20px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
              <span style={{ fontSize: 13 }}>Loading bookings...</span>
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              <ClipboardList size={32} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 10px' }} />
              No bookings found for this user.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bookings.map(b => {
                const sc  = getBSt(b.status);
                const amt = b.total_fare || b.plan_price;
                return (
                  <div key={b.id} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', border: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{b.booking_id || `#${b.id}`}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{fmt(b.created_at)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{b.service_name || '—'}{b.sub_service_name ? ` · ${b.sub_service_name}` : ''}</div>
                      {b.plan_name && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 1 }}>{b.plan_name}</div>}
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{b.pickup_city || '—'} → {b.drop_city || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 80 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{amt ? `₹${parseFloat(amt).toFixed(2)}` : '—'}</div>
                      {b.payment_mode && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{b.payment_mode}</div>}
                    </div>
                    <div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>
                        {b.status || '—'}
                      </span>
                      {b.driver_name && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Captain: {b.driver_name}</div>}
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

/* ─── Shared styles ─── */
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(4px)', padding: '16px',
};

const modalStyle: React.CSSProperties = {
  background: 'white', borderRadius: '16px', padding: '24px',
  width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  position: 'relative', animation: 'modalIn 0.2s ease',
};

const closeBtn: React.CSSProperties = {
  background: '#f1f5f9', border: 'none', color: '#64748b',
  width: '30px', height: '30px', borderRadius: '8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '10px',
  border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#1e293b',
  outline: 'none', background: '#f8fafc', boxSizing: 'border-box',
};

/* ─── Main Component ─── */
export default function UserList() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canAdd    = can('users', 'add');
  const canEdit   = can('users', 'edit');
  const canDelete = can('users', 'delete');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [users, setUsers]           = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [viewUser, setViewUser]         = useState<User | null>(null);
  const [editUser, setEditUser]         = useState<User | null>(null);
  const [deleteUser, setDeleteUser]     = useState<User | null>(null);
  const [bookingsUser, setBookingsUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true); setError(null);
    try {
      const res = await getAllUsers();
      if (res.data.status) setUsers(res.data.data);
      else setError(res.data.message || 'Failed to fetch users');
    } catch { setError('Unable to connect to server'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = useMemo(() =>
    users.filter(u =>
      (u.name?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
      (u.email?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
      (u.mobile ?? '').includes(search)
    ), [search, users]);

  const totalPages     = Math.max(1, Math.ceil(filteredUsers.length / PER_PAGE));
  const paginatedUsers = filteredUsers.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSaveEdit = (updated: User) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    // TODO: call API updateUser(updated)
  };

  const handleConfirmDelete = () => {
    if (!deleteUser) return;
    setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
    // TODO: call API deleteUser(deleteUser.id)
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>All Users</h2>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0' }}>Total {filteredUsers.length} users registered</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '6px 12px' }}>
            <Search size={14} color="#94a3b8" />
            <input placeholder="Search name, email, mobile..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ border: 'none', outline: 'none', fontSize: '12px', width: '200px', background: 'transparent' }} />
          </div>
          <button onClick={fetchUsers} title="Refresh" style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '7px 10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={14} />
          </button>
          {canAdd && <button onClick={() => navigate('/userform')} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
            <Plus size={14} /> Add User
          </button>}
        </div>
      </div>

      {/* ── Table Card ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        {loading && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            Loading users...
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            <button onClick={fetchUsers} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Try Again</button>
          </div>
        )}
        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                  {['User', 'Contact', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length > 0 ? paginatedUsers.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserCircle size={20} color="#6366f1" />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{user.name ?? <span style={{ color: '#000', fontStyle: 'italic' }}>No Name</span>}</div>
                          <div style={{ fontSize: '11px', color: '#000', marginTop: '2px' }}>ID #{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '13px', color: '#000' }}>{user.email ?? <span style={{ color: '#000 ', fontStyle: 'italic' }}>No email</span>}</div>
                      <div style={{ fontSize: '11px', color: '#000', marginTop: '2px' }}>{user.mobile ?? '—'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, ...getRoleBadge(user.role) }}>{formatRole(user.role)}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: user.status === 1 ? '#d1fae5' : '#f1f5f9', color: user.status === 1 ? '#065f46' : '#64748b' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.status === 1 ? '#10b981' : '#94a3b8' }} />
                        {user.status === 1 ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDate(user.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <a href={`tel:${user.mobile}`} title="Call" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}><Phone size={13} /></a>
                        <a href={`https://wa.me/${user.mobile?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}><MessageCircle size={13} /></a>

                        {/* Booking History → page navigate */}
                        <button title="Booking History" onClick={() => setBookingsUser(user)} style={{ background: '#fef9c3', border: '1px solid #fde68a', color: '#b45309', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ClipboardList size={13} /></button>

                        {/* View → popup */}
                        <button title="View Details" onClick={() => setViewUser(user)} style={{ background: '#ede9fe', border: '1px solid #ddd6fe', color: '#7c3aed', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={13} /></button>

                        {/* Edit → popup */}
                        {canEdit && <button title="Edit" onClick={() => setEditUser(user)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={13} /></button>}

                        {/* Delete → popup */}
                        {canDelete && <button title="Delete" onClick={() => setDeleteUser(user)} style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No users found matching your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Page <b>{page}</b> of <b>{totalPages}</b></span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center' }}><ChevronLeft size={14} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center' }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {viewUser     && <ViewModal         user={viewUser}     onClose={() => setViewUser(null)} />}
      {editUser     && <EditModal         user={editUser}     onClose={() => setEditUser(null)}     onSave={handleSaveEdit} />}
      {deleteUser   && <DeleteModal       user={deleteUser}   onClose={() => setDeleteUser(null)}   onConfirm={handleConfirmDelete} />}
      {bookingsUser && <UserBookingsModal user={bookingsUser} onClose={() => setBookingsUser(null)} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}