import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getMe } from '../services/api';
import { getToken } from '../utils/auth';

export type Action = 'view' | 'add' | 'edit' | 'delete';

interface MePermission { id: number; permission_name: string; module: string }
interface MeUser {
  id: number; name?: string; email?: string; mobile?: string;
  role?: string; role_id?: number | null; role_name?: string | null; status?: number;
}

interface PermissionsState {
  loading: boolean;
  user: MeUser | null;
  isSuperAdmin: boolean;
  keys: Set<string>;
  degraded: boolean;
  can: (module: string, action?: Action) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsState | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading]           = useState(true);
  const [user, setUser]                 = useState<MeUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [keys, setKeys]                 = useState<Set<string>>(new Set());
  const [degraded, setDegraded]         = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    setLoading(true);
    try {
      const res: any = await getMe();
      const data = res?.data?.data ?? res?.data;
      const perms: MePermission[] = Array.isArray(data?.permissions) ? data.permissions : [];
      const set = new Set<string>();
      for (const p of perms) {
        if (p?.module && p?.permission_name) {
          set.add(`${p.module.toLowerCase()}:${p.permission_name.toLowerCase()}`);
        }
      }
      setUser(data?.user ?? null);
      setIsSuperAdmin(!!data?.is_super_admin);
      setKeys(set);
      setDegraded(false);
    } catch {
      // Endpoint missing / network error → fail open so the panel isn't bricked.
      setUser(null);
      setIsSuperAdmin(true);
      setKeys(new Set());
      setDegraded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const can = useCallback((module: string, action: Action = 'view') => {
    if (isSuperAdmin) return true;
    return keys.has(`${module.toLowerCase()}:${action}`);
  }, [isSuperAdmin, keys]);

  return (
    <PermissionsContext.Provider value={{ loading, user, isSuperAdmin, keys, degraded, can, refresh: load }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsState {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    return {
      loading: false, user: null, isSuperAdmin: true, keys: new Set(), degraded: true,
      can: () => true, refresh: async () => {},
    };
  }
  return ctx;
}
