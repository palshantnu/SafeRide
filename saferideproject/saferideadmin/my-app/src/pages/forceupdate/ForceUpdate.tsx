import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, Apple, Save, Loader2, CheckCircle2, AlertCircle, X, ShieldAlert,
} from 'lucide-react';
import { getAppVersions, updateAppVersion } from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface AppVersion {
  id: number;
  app: 'user' | 'driver';
  platform: 'android' | 'ios';
  latest_version: string;
  min_version: string;
  force_update: boolean;
  update_message: string | null;
  store_url: string | null;
  updated_at?: string;
}

interface ToastState { message: string; type: 'success' | 'error'; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const APP_LABEL: Record<string, string> = { user: 'User App', driver: 'Captain App' };

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const ok = toast.type === 'success';
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      background: ok ? '#f0fdf4' : '#fff1f2',
      border: `1.5px solid ${ok ? '#bbf7d0' : '#fecdd3'}`,
      borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: 320,
    }}>
      {ok ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#ef4444" />}
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? '#15803d' : '#dc2626' }}>{toast.message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: 0 }}>
        <X size={14} color="#94a3b8" />
      </button>
    </div>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
function VersionCard({ version, onSave }: { version: AppVersion; onSave: (id: number, data: Partial<AppVersion>) => Promise<void> }) {
  const [form, setForm] = useState({
    latest_version: version.latest_version,
    min_version: version.min_version,
    force_update: version.force_update,
    update_message: version.update_message || '',
    store_url: version.store_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof typeof form>(key: K, val: typeof form[K]) => {
    setForm(f => ({ ...f, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(version.id, form);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box', color: '#0f172a',
  };
  const lbl = (text: string) => (
    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>{text}</label>
  );

  return (
    <div style={{
      background: 'white', borderRadius: 16, border: `1.5px solid ${form.force_update ? '#fecaca' : '#eef2f7'}`,
      padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: version.platform === 'android' ? '#f0fdf4' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {version.platform === 'android' ? <Smartphone size={17} color="#16a34a" /> : <Apple size={17} color="#334155" />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{APP_LABEL[version.app]}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{version.platform}</div>
          </div>
        </div>
        {form.force_update && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff1f2', color: '#dc2626', fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
            <ShieldAlert size={11} /> ENFORCING
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          {lbl('Latest Version')}
          <input style={inputStyle} value={form.latest_version} onChange={e => set('latest_version', e.target.value)} placeholder="e.g. 1.10.5" />
        </div>
        <div>
          {lbl('Minimum Required Version')}
          <input style={inputStyle} value={form.min_version} onChange={e => set('min_version', e.target.value)} placeholder="e.g. 1.10.0" />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        {lbl('Update Message (shown to user)')}
        <textarea
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 60 }}
          value={form.update_message}
          onChange={e => set('update_message', e.target.value)}
          placeholder="A new version is available with important fixes. Please update to continue."
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        {lbl('Store URL')}
        <input style={inputStyle} value={form.store_url} onChange={e => set('store_url', e.target.value)} placeholder="https://play.google.com/store/apps/details?id=..." />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.force_update} onChange={e => set('force_update', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: form.force_update ? '#dc2626' : '#475569' }}>
            Force update (blocks the app below min version)
          </span>
        </label>
        <button onClick={handleSave} disabled={saving || !dirty} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none',
          background: (!dirty || saving) ? '#e2e8f0' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color: (!dirty || saving) ? '#94a3b8' : 'white', fontSize: 12.5, fontWeight: 600,
          cursor: (!dirty || saving) ? 'not-allowed' : 'pointer',
        }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ForceUpdate() {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => setToast({ message, type }), []);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAppVersions();
      const body = (res as { data: unknown }).data as { data?: AppVersion[] };
      setVersions(Array.isArray(body?.data) ? body.data! : []);
    } catch {
      setVersions([]);
      showToast('Failed to load app versions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const handleSave = async (id: number, data: Partial<AppVersion>) => {
    try {
      const res = await updateAppVersion(id, data);
      const updated = (res as { data: { data?: AppVersion } }).data?.data;
      if (updated) setVersions(prev => prev.map(v => v.id === id ? updated : v));
      showToast('Saved successfully!');
    } catch {
      showToast('Failed to save', 'error');
      throw new Error('save failed');
    }
  };

  const grouped = { user: versions.filter(v => v.app === 'user'), driver: versions.filter(v => v.app === 'driver') };

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ padding: 24, animation: 'fadeSlideUp 0.4s ease' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>Force Update</h2>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
            Set the minimum app version allowed. Turning on "Force update" blocks the app with a full-screen prompt below that version.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 260, borderRadius: 16, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite' }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>User App</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 24 }}>
              {grouped.user.map(v => <VersionCard key={v.id} version={v} onSave={handleSave} />)}
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Captain App</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
              {grouped.driver.map(v => <VersionCard key={v.id} version={v} onSave={handleSave} />)}
            </div>
          </>
        )}
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
