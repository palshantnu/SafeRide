import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Check, Users, Lock, Search,
} from 'lucide-react';
import {
  getAllRoles, getRolePermissions, createRole, updateRole, deleteRole,
  assignRolePermissions, getAllPermissions, seedPermissions, getPermissionMatrix,
} from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Permission {
  id: number;
  permission_name: string;
  module: string;
  description?: string;
}

interface Role {
  id: number;
  role_name: string;
  description?: string;
  status: number; 
  staff_count?: number;
  total_permissions?: number;
  permission_ids?: number[]; 
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const ROLE_COLORS = [
  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
  { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
  { bg: '#ede9fe', color: '#5b21b6', border: '#ddd6fe' },
  { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' },
  { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
];
const roleColor = (idx: number) => ROLE_COLORS[idx % ROLE_COLORS.length];

const moduleLabel = (mod: string) =>
  mod.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const permLabel = (name: string) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const ACTIONS = [
  { key: 'view',   label: 'View',   match: ['view', 'list', 'read', 'get', 'show', 'index', 'browse'] },
  { key: 'add',    label: 'Add',    match: ['add', 'create', 'new', 'insert', 'store'] },
  { key: 'edit',   label: 'Edit',   match: ['edit', 'update', 'modify', 'change'] },
  { key: 'delete', label: 'Delete', match: ['delete', 'remove', 'destroy', 'trash'] },
] as const;
type ActionKey = (typeof ACTIONS)[number]['key'];

const actionOfName = (name: string): ActionKey | null => {
  const n = name.toLowerCase().trim();
  const direct = ACTIONS.find(a => a.key === n);
  if (direct) return direct.key;
  for (const a of ACTIONS) if (a.match.some(m => n.includes(m))) return a.key;
  return null;
};

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'success' ? '#10b981' : '#ef4444',
      color: '#fff', padding: '12px 20px', borderRadius: 12,
      fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    }}>
      {msg}
    </div>
  );
}

// ─── ROLE MODAL ───────────────────────────────────────────────────────────────

interface MatrixCell { id: number; checked: boolean; }
interface MatrixApiRow { module: string; permissions: Partial<Record<ActionKey, MatrixCell>>; }

function buildRowsFromFlat(perms: Permission[]): MatrixApiRow[] {
  const map: Record<string, MatrixApiRow> = {};
  for (const p of perms) {
    const row = (map[p.module] ??= { module: p.module, permissions: {} });
    const act = actionOfName(p.permission_name);
    if (act && !row.permissions[act]) row.permissions[act] = { id: p.id, checked: false };
  }
  return Object.values(map).sort((a, b) => a.module.localeCompare(b.module));
}

interface RoleModalProps {
  mode: 'add' | 'edit';
  role?: Role;
  onClose: () => void;
  onSave: (roleName: string, description: string, status: number, permIds: number[]) => Promise<void>;
}

function RoleModal({ mode, role, onClose, onSave }: RoleModalProps) {
  const [roleName,    setRoleName]    = useState(role?.role_name   ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [status,      setStatus]      = useState(role?.status      ?? 1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [permSearch,  setPermSearch]  = useState('');
  const [errors,      setErrors]      = useState<{ roleName?: string }>({});
  const [saving,      setSaving]      = useState(false);

  const [rows,          setRows]          = useState<MatrixApiRow[]>([]);
  const [cols,          setCols]          = useState<ActionKey[]>(ACTIONS.map(a => a.key));
  const [loadingMatrix, setLoadingMatrix] = useState(true);
  const [matrixError,   setMatrixError]   = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingMatrix(true); setMatrixError(null);

      // 1) Preferred path: GET /admin/permission-matrix (seeds if empty)
      try {
        let res: { data?: { data?: MatrixApiRow[]; actions?: string[] } } = await getPermissionMatrix(role?.id);
        let data: MatrixApiRow[] = res?.data?.data ?? [];
        if (data.length === 0) {
          await seedPermissions().catch(() => {});
          res = await getPermissionMatrix(role?.id);
          data = res?.data?.data ?? [];
        }
        if (data.length > 0) {
          if (!alive) return;
          const apiCols = (res?.data?.actions ?? []).filter((k): k is ActionKey => ACTIONS.some(a => a.key === k));
          setCols(apiCols.length ? apiCols : ACTIONS.map(a => a.key));
          setRows(data);
          const checked = new Set<number>();
          data.forEach(r => Object.values(r.permissions).forEach(c => { if (c?.checked) checked.add(c.id); }));
          setSelectedIds(checked);
          setLoadingMatrix(false);
          return;
        }
      } catch {  }

      try {
        const permsRes: any = await getAllPermissions();
        const perms: Permission[] = permsRes?.data?.data ?? permsRes?.data ?? [];
        let assigned: number[] = [];
        if (role?.id) {
          try {
            const rp: any = await getRolePermissions(role.id);
            const list = rp?.data?.data ?? [];
            assigned = (Array.isArray(list) ? list : []).map((p: Permission | number) => typeof p === 'number' ? p : p.id);
          } catch { }
        }
        if (!alive) return;
        setCols(ACTIONS.map(a => a.key));
        setRows(buildRowsFromFlat(perms));
        setSelectedIds(new Set(assigned));
      } catch {
        if (alive) setMatrixError('Failed to load permissions.');
      } finally {
        if (alive) setLoadingMatrix(false);
      }
    })();
    return () => { alive = false; };
  }, [role?.id]);

  const q = permSearch.trim().toLowerCase();
  const viewRows = q ? rows.filter(r => r.module.toLowerCase().includes(q)) : rows;

  const rowIds = (r: MatrixApiRow) =>
    Object.values(r.permissions).filter((c): c is MatrixCell => !!c).map(c => c.id);
  const allIds = rows.flatMap(rowIds);

  const setMany = (ids: number[], on: boolean) => setSelectedIds(prev => {
    const next = new Set(prev);
    ids.forEach(id => on ? next.add(id) : next.delete(id));
    return next;
  });
  const togglePerm = (id: number) => setMany([id], !selectedIds.has(id));

  const isRowAll = (r: MatrixApiRow) => { const ids = rowIds(r); return ids.length > 0 && ids.every(id => selectedIds.has(id)); };
  const toggleRow = (r: MatrixApiRow, on: boolean) => setMany(rowIds(r), on);

  // Column = a given action across all visible module rows (e.g. "all Delete").
  const colIds = (action: ActionKey) =>
    viewRows.map(r => r.permissions[action]?.id).filter((x): x is number => x != null);
  const isColAll = (action: ActionKey) => { const c = colIds(action); return c.length > 0 && c.every(id => selectedIds.has(id)); };
  const toggleCol = (action: ActionKey, on: boolean) => setMany(colIds(action), on);

  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const selectAll = (on: boolean) => setSelectedIds(on ? new Set(allIds) : new Set());

  const validate = () => {
    const e: { roleName?: string } = {};
    if (!roleName.trim()) e.roleName = 'Role name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(roleName.trim(), description.trim(), status, Array.from(selectedIds)); }
    finally { setSaving(false); }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 820, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} color="#fff" />
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
              {mode === 'add' ? 'Add New Role' : 'Edit Role'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}>
            <X size={18} color="#fff" />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Role fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Role Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g. Booking Manager"
                style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${errors.roleName ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              {errors.roleName && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.roleName}</p>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Status</label>
              <select value={status} onChange={e => setStatus(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', cursor: 'pointer' }}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>
                Permissions <span style={{ color: '#6b7280', fontWeight: 400 }}>({selectedIds.size} selected)</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' }}>
                  <Search size={13} color="#9ca3af" />
                  <input value={permSearch} onChange={e => setPermSearch(e.target.value)} placeholder="Filter permissions..."
                    style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: 140 }} />
                </div>
                <button onClick={() => selectAll(!allSelected)}
                  style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {loadingMatrix ? (
              <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Loading permissions…</p>
            ) : matrixError ? (
              <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>{matrixError}</p>
            ) : rows.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No permissions found. They are created automatically — try reloading.</p>
            ) : viewRows.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No modules match your search.</p>
            ) : (
              <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Module</th>
                      {cols.map(key => {
                        const label = ACTIONS.find(a => a.key === key)?.label ?? key;
                        const colAll = isColAll(key);
                        return (
                          <th key={key} style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb', borderLeft: '1px solid #f3f4f6', minWidth: 64 }}>
                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#374151' }} title={`Toggle all ${label}`}>
                              {label}
                              <input type="checkbox" checked={colAll} onChange={() => toggleCol(key, !colAll)}
                                style={{ cursor: 'pointer', accentColor: '#6366f1' }} />
                            </label>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {viewRows.map(row => {
                      const rowAll = isRowAll(row);
                      const ids = rowIds(row);
                      const selCount = ids.filter(id => selectedIds.has(id)).length;
                      return (
                        <tr key={row.module} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          {/* Module + row toggle */}
                          <td style={{ padding: '9px 14px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                              <input type="checkbox" checked={rowAll} onChange={() => toggleRow(row, !rowAll)}
                                style={{ cursor: 'pointer', accentColor: '#6366f1' }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{moduleLabel(row.module)}</span>
                              <span style={{ fontSize: 11, color: selCount ? '#6366f1' : '#9ca3af', fontWeight: 600 }}>{selCount}/{ids.length}</span>
                            </label>
                          </td>
                          {/* Action checkboxes */}
                          {cols.map(key => {
                            const cell = row.permissions[key];
                            return (
                              <td key={key} style={{ textAlign: 'center', padding: '9px 6px', borderLeft: '1px solid #f9fafb' }}>
                                {cell ? (
                                  <input type="checkbox" checked={selectedIds.has(cell.id)} onChange={() => togglePerm(cell.id)}
                                    style={{ cursor: 'pointer', accentColor: '#6366f1', width: 16, height: 16 }} />
                                ) : (
                                  <span style={{ color: '#d1d5db' }}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '10px 22px', border: '1.5px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '10px 22px', border: 'none', borderRadius: 8, background: saving ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={16} />
              {saving ? 'Saving...' : (mode === 'add' ? 'Create Role' : 'Save Changes')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE MODAL ─────────────────────────────────────────────────────────────

function DeleteModal({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: '32px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={24} color="#ef4444" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Delete Role</h3>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
          Are you sure you want to delete <strong>"{name}"</strong>? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', border: '1.5px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151' }}>Cancel</button>
          <button onClick={async () => { setLoading(true); await onConfirm(); }} disabled={loading}
            style={{ padding: '10px 24px', border: 'none', borderRadius: 8, background: '#ef4444', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, color: '#fff', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function RolePermissions() {
  const { can } = usePermissions();
  const canAdd    = can('roles', 'add');
  const canEdit   = can('roles', 'edit');
  const canDelete = can('roles', 'delete');
  const [roles,          setRoles]          = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [expanded,       setExpanded]       = useState<number | null>(null);
  const [expandLoading,  setExpandLoading]  = useState<number | null>(null);
  const [modal,          setModal]          = useState<{ type: 'add' | 'edit'; role?: Role; permIds?: number[] } | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<Role | null>(null);
  const [toast,          setToast]          = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure the module × action permission grid exists (idempotent, safe to repeat).
      await seedPermissions().catch(() => {});
      const [rolesRes, permsRes] = await Promise.all([getAllRoles(), getAllPermissions()]);
      setRoles(Array.isArray(rolesRes.data?.data ?? rolesRes.data) ? (rolesRes.data?.data ?? rolesRes.data) : []);
      setAllPermissions(Array.isArray(permsRes.data?.data ?? permsRes.data) ? (permsRes.data?.data ?? permsRes.data) : []);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleExpand = async (role: Role) => {
    if (expanded === role.id) { setExpanded(null); return; }
    setExpanded(role.id);
    if (role.permission_ids !== undefined) return;
    setExpandLoading(role.id);
    try {
      const res = await getRolePermissions(role.id);
      const list = res.data?.data ?? [];
      const permIds: number[] = (Array.isArray(list) ? list : []).map((p: Permission | number) =>
        typeof p === 'number' ? p : p.id
      );
      setRoles(prev => prev.map(r => r.id === role.id ? { ...r, permission_ids: permIds } : r));
    } catch {
      showToast('Failed to load role permissions', 'error');
    } finally {
      setExpandLoading(null);
    }
  };

  // The modal loads the permission matrix (with checked state) itself via
  // getPermissionMatrix(role.id), so no need to prefetch permission ids here.
  const handleOpenEdit = (role: Role) => setModal({ type: 'edit', role });

  const handleSave = async (roleName: string, description: string, status: number, permIds: number[]) => {
    try {
      if (modal?.type === 'add') {
        const res = await createRole({ role_name: roleName, description });
        const newId = res.data?.data?.id ?? res.data?.id;
        if (newId && permIds.length > 0) {
          await assignRolePermissions(newId, permIds);
        }
        showToast('Role created successfully');
      } else if (modal?.role) {
        await updateRole(modal.role.id, { role_name: roleName, description, status });
        await assignRolePermissions(modal.role.id, permIds);
        showToast('Role updated successfully');
      }
      setModal(null);
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Operation failed', 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRole(deleteTarget.id);
      showToast('Role deleted successfully');
      if (expanded === deleteTarget.id) setExpanded(null);
      setDeleteTarget(null);
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Delete failed', 'error');
      throw err;
    }
  };

  // Group permissions by module for the expanded view
  const permByModule = (ids: number[]) => {
    const idSet = new Set(ids);
    const assigned = allPermissions.filter(p => idSet.has(p.id));
    return assigned.reduce<Record<string, Permission[]>>((acc, p) => {
      (acc[p.module] ??= []).push(p);
      return acc;
    }, {});
  };

  const totalStaff = roles.reduce((s, r) => s + (r.staff_count ?? 0), 0);

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .sk { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:6px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} color="#fff" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Role & Permissions</h1>
          </div>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Manage roles and control module-level access for your team</p>
        </div>
        {canAdd && <button onClick={() => setModal({ type: 'add' })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
          <Plus size={17} /> Add Role
        </button>}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Roles',       value: loading ? '…' : roles.length,          icon: ShieldCheck, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Total Staff',       value: loading ? '…' : totalStaff,            icon: Users,       color: '#10b981', bg: '#d1fae5' },
          { label: 'Total Permissions', value: loading ? '…' : allPermissions.length, icon: Lock,        color: '#f59e0b', bg: '#fef3c7' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Role list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
              <div className="sk" style={{ height: 16, width: 200 }} />
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '48px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
          <ShieldCheck size={36} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', fontSize: 14 }}>No roles found. Create your first role.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roles.map((role, idx) => {
            const colors  = roleColor(idx);
            const isOpen  = expanded === role.id;
            const loadingExpand = expandLoading === role.id;
            const permIds = role.permission_ids ?? [];
            const grouped = permByModule(permIds);
            const mods    = Object.keys(grouped).sort();

            return (
              <div key={role.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {/* Role row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', cursor: 'pointer', gap: 16 }}
                  onClick={() => handleExpand(role)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: colors.bg, border: `1.5px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ShieldCheck size={20} color={colors.color} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{role.role_name}</span>
                        {role.staff_count !== undefined && (
                          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>
                            {role.staff_count} {role.staff_count === 1 ? 'member' : 'members'}
                          </span>
                        )}
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: role.status === 1 ? '#d1fae5' : '#f3f4f6', color: role.status === 1 ? '#065f46' : '#6b7280' }}>
                          {role.status === 1 ? 'Active' : 'Inactive'}
                        </span>
                        {role.total_permissions !== undefined && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                            <Lock size={10} /> {role.total_permissions} {role.total_permissions === 1 ? 'permission' : 'permissions'}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: '#6b7280', margin: 0, marginTop: 2 }}>{role.description || 'No description'}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {canEdit && <button
                      onClick={e => { e.stopPropagation(); handleOpenEdit(role); }}
                      style={{ padding: '7px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                      <Pencil size={14} /> Edit
                    </button>}
                    {canDelete && <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(role); }}
                      style={{ padding: '7px 14px', border: '1.5px solid #fca5a5', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                      <Trash2 size={14} /> Delete
                    </button>}
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                  </div>
                </div>

                {/* Expanded permissions */}
                {isOpen && (
                  <div style={{ padding: '0 24px 20px', borderTop: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '16px 0 12px' }}>
                      Assigned Permissions
                      {!loadingExpand && <span style={{ color: '#9ca3af', fontWeight: 400 }}> ({permIds.length})</span>}
                    </p>
                    {loadingExpand ? (
                      <div className="sk" style={{ height: 14, width: 200 }} />
                    ) : mods.length === 0 ? (
                      <p style={{ color: '#9ca3af', fontSize: 13 }}>No permissions assigned to this role.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {mods.map(mod => (
                          <div key={mod} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ padding: '8px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                              {moduleLabel(mod)}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 14px' }}>
                              {grouped[mod].map(perm => (
                                <span key={perm.id} style={{ padding: '3px 10px', borderRadius: 6, background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 600, border: '1px solid #c7d2fe' }}>
                                  <Check size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                  {permLabel(perm.permission_name)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <RoleModal
          mode={modal.type}
          role={modal.role}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.role_name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
