import React, { useState, useMemo, useEffect, useRef, CSSProperties } from 'react';
import {
  Edit2, Trash2, Plus, Search, RefreshCw, X, Save,
  AlertTriangle, FileText, Globe, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, ToggleLeft, ToggleRight,
  Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link, Minus
} from 'lucide-react';
import { getAllPages, createPage, updatePage, deletePage, togglePageStatus } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Page {
  id: number;
  title: string;
  slug: string;
  description?: string;
  content?: string;
  page_type?: string;
  role?: string;
  status?: number;
  meta_title?: string;
  meta_description?: string;
  created_at?: string;
  updated_at?: string;
}

interface PageForm {
  title: string;
  slug: string;
  content: string;
  page_type: string;
  role: string;
}

const PAGE_TYPES = ['about', 'privacy', 'terms', 'contact', 'faq', 'refund', 'shipping', 'custom'];

const toSlug = (str: string) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const emptyForm = (): PageForm => ({
  title: '', slug: '', content: '', page_type: 'custom', role: 'user',
});

// ─── Styles ───────────────────────────────────────────────────────────────────
interface S {
  overlay: CSSProperties; modal: CSSProperties;
  mHead: CSSProperties; mBody: CSSProperties; mFoot: CSSProperties;
  mTitle: CSSProperties; mSub: CSSProperties;
  field: CSSProperties; label: CSSProperties; input: CSSProperties;
  errBox: CSSProperties; iconBtn: CSSProperties;
  cancelBtn: CSSProperties; saveBtn: CSSProperties;
}
const s: S = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '16px' },
  modal:     { background: 'white', borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '93vh', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'auto' },
  mHead:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1.5px solid #f1f5f9' },
  mBody:     { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '60vh', overflowY: 'auto' },
  mFoot:     { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1.5px solid #f1f5f9', background: '#fafbfc' },
  mTitle:    { margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' },
  mSub:      { margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' },
  field:     { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:     { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input:     { border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1e293b', width: '100%', boxSizing: 'border-box', background: 'white' },
  errBox:    { display: 'flex', alignItems: 'center', gap: '6px', background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' },
  iconBtn:   { background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  cancelBtn: { background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '9px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  saveBtn:   { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' },
};

// ─── HTML WYSIWYG Editor ──────────────────────────────────────────────────────
const isHtml = (str: string) => /<[a-z][\s\S]*>/i.test(str);

const plainToHtml = (str: string): string => {
  if (!str) return '';
  if (isHtml(str)) return str;
  return str
    .split(/\n\n+/)
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
};

function HtmlEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const initialised = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = initialised.current ? value : plainToHtml(value);
    initialised.current = true;
    if (el.innerHTML !== html) {
      isInternalUpdate.current = true;
      el.innerHTML = html;
      isInternalUpdate.current = false;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    // Editor must be focused with the selection inside it before execCommand runs.
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleInput = () => {
    if (!isInternalUpdate.current && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const toolbarBtn = (onClick: () => void, icon: React.ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 7px', borderRadius: '6px', color: '#475569', display: 'flex', alignItems: 'center' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ede9fe'; (e.currentTarget as HTMLButtonElement).style.color = '#6366f1'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
    >{icon}</button>
  );

  const sep = <span style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 2px' }} />;

  return (
    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px', padding: '6px 8px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        {toolbarBtn(() => exec('bold'),          <Bold size={13} />,         'Bold')}
        {toolbarBtn(() => exec('italic'),        <Italic size={13} />,       'Italic')}
        {toolbarBtn(() => exec('underline'),     <Underline size={13} />,    'Underline')}
        {sep}
        {toolbarBtn(() => exec('insertUnorderedList'), <List size={13} />,        'Bullet list')}
        {toolbarBtn(() => exec('insertOrderedList'),   <ListOrdered size={13} />, 'Numbered list')}
        {sep}
        {toolbarBtn(() => exec('justifyLeft'),   <AlignLeft size={13} />,    'Align left')}
        {toolbarBtn(() => exec('justifyCenter'), <AlignCenter size={13} />,  'Align center')}
        {toolbarBtn(() => exec('justifyRight'),  <AlignRight size={13} />,   'Align right')}
        {sep}
        {toolbarBtn(() => exec('insertHorizontalRule'), <Minus size={13} />, 'Horizontal rule')}
        {toolbarBtn(() => {
          const url = prompt('Enter URL:');
          if (url) exec('createLink', url);
        }, <Link size={13} />, 'Insert link')}
        {sep}
        <select
          onChange={e => { exec('formatBlock', e.target.value); e.target.value = ''; }}
          defaultValue=""
          style={{ fontSize: '11px', border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', padding: '3px 4px', borderRadius: '4px', outline: 'none' }}
        >
          <option value="" disabled>Heading</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
          <option value="p">Paragraph</option>
        </select>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        style={{ minHeight: '140px', padding: '12px 14px', fontSize: '13px', color: '#1e293b', outline: 'none', lineHeight: '1.7', overflowY: 'auto', maxHeight: '280px' }}
        data-placeholder="Start typing page content..."
      />

      <style>
        {`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
        [contenteditable] a { color: #6366f1; text-decoration: underline; }
        [contenteditable] b, [contenteditable] strong { font-weight: 700; }
        [contenteditable] i, [contenteditable] em { font-style: italic; }
        [contenteditable] u { text-decoration: underline; }
        [contenteditable] ul { list-style: disc; padding-left: 20px; }
        [contenteditable] ol { list-style: decimal; padding-left: 20px; }
        [contenteditable] h1 { font-size: 1.6em; font-weight: 700; margin: 6px 0; }
        [contenteditable] h2 { font-size: 1.3em; font-weight: 700; margin: 6px 0; }
        [contenteditable] h3 { font-size: 1.1em; font-weight: 700; margin: 4px 0; }
        [contenteditable] h4 { font-size: 1em;   font-weight: 700; margin: 4px 0; }
        [contenteditable] hr { border: none; border-top: 1.5px solid #e2e8f0; margin: 8px 0; }
      `}
      </style>
    </div>
  );
}

// ─── Page Form Modal ──────────────────────────────────────────────────────────
function PageFormModal({ initial, onClose, onSaved }: {
  initial?: Page; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<PageForm>(
    initial ? {
      title:     initial.title     || '',
      slug:      initial.slug      || '',
      content:   initial.content   || '',
      page_type: initial.page_type || 'custom',
      role:      initial.role      || 'user',
    } : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof PageForm, v: string | number) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleTitleChange = (val: string) => {
    set('title', val);
    if (!isEdit) set('slug', toSlug(val));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.slug.trim())  { setError('Slug is required'); return; }
    setSaving(true); setError(null);
    try {
      const res: any = isEdit
        ? await updatePage(initial!.id, form)
        : await createPage(form);
      const payload = res?.data;
      if (payload?.status === false || payload?.status === 0) {
        setError(payload?.message || (isEdit ? 'Update failed' : 'Create failed'));
      } else {
        onSaved();
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Network error');
    } finally { setSaving(false); }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.mHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={20} color="#6366f1" />
            </div>
            <div>
              <h3 style={s.mTitle}>{isEdit ? 'Edit Page' : 'Add New Page'}</h3>
        
            </div>
          </div>
          <button onClick={onClose} style={s.iconBtn}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={s.mBody}>
          {error && <div style={s.errBox}><AlertTriangle size={14} /> {error}</div>}

          {/* Title */}
          <div style={s.field}>
            <label style={s.label}>Title *</label>
            <input value={form.title} onChange={e => handleTitleChange(e.target.value)}
              placeholder="Page  title" style={s.input} />
          </div>

          {/* Slug */}
          <div style={s.field}>
            <label style={s.label}>Slug *</label>
            <div style={{ position: 'relative' }}>
              <Globe size={13} color="#94a3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={form.slug} onChange={e => set('slug', toSlug(e.target.value))}
                placeholder="page-url-slug"
                style={{ ...s.input, paddingLeft: '30px' }} />
            </div>
          </div>

          {/* Page Type + Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={s.field}>
              <label style={s.label}>Page Type</label>
              <select value={form.page_type} onChange={e => set('page_type', e.target.value)}
                style={{ ...s.input, cursor: 'pointer' }}>
                {PAGE_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                style={{ ...s.input, cursor: 'pointer' }}>
                <option value="user">User</option>
                <option value="driver">Captain</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div style={s.field}>
            <label style={s.label}>Content</label>
            <HtmlEditor value={form.content} onChange={v => set('content', v)} />
          </div>
        </div>

        {/* Footer */}
        <div style={s.mFoot}>
          <button onClick={onClose} style={s.cancelBtn}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ ...s.saveBtn, opacity: saving ? 0.75 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              : <><Save size={13} /> {isEdit ? 'Update Page' : 'Create Page'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ page, onClose, onDeleted }: {
  page: Page; onClose: () => void; onDeleted: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      await deletePage(page.id);
      onDeleted(page.id);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: '380px' }}>
        <div style={{ padding: '32px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={24} color="#ef4444" />
          </div>
          <h3 style={{ ...s.mTitle, fontSize: '16px' }}>Page Delete ?</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
            <b style={{ color: '#1e293b' }}>{page.title}</b> Permanently Delete?
    
          </p>
          {error && <div style={s.errBox}><AlertTriangle size={14} /> {error}</div>}
        </div>
        <div style={s.mFoot}>
          <button onClick={onClose} style={s.cancelBtn}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            style={{ ...s.saveBtn, background: 'linear-gradient(135deg,#ef4444,#dc2626)', opacity: deleting ? 0.75 : 1 }}>
            {deleting
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</>
              : <><Trash2 size={13} /> Yes, Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page Type Badge ──────────────────────────────────────────────────────────
function TypeBadge({ type }: { type?: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    about:    { bg: '#eff6ff', color: '#2563eb' },
    privacy:  { bg: '#fdf4ff', color: '#7e22ce' },
    terms:    { bg: '#fff7ed', color: '#c2410c' },
    contact:  { bg: '#f0fdf4', color: '#15803d' },
    faq:      { bg: '#fffbeb', color: '#b45309' },
    refund:   { bg: '#fef2f2', color: '#dc2626' },
    shipping: { bg: '#f0f9ff', color: '#0369a1' },
    custom:   { bg: '#f1f5f9', color: '#475569' },
  };
  const st = map[type || 'custom'] || map.custom;
  return (
    <span style={{ background: st.bg, color: st.color, fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {type || 'custom'}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PageList() {
  const [pages, setPages]               = useState<Page[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [addOpen, setAddOpen]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Page | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);
  const [togglingId, setTogglingId]     = useState<number | null>(null);
  const PER_PAGE = 8;

  const fetchPages = async () => {
    setLoading(true); setFetchError(null);
    try {
      const res: any = await getAllPages();
      const payload = res?.data;
      const list = Array.isArray(payload?.data) ? payload.data
                 : Array.isArray(payload)        ? payload
                 : [];
      setPages(list);
    } catch (e: any) {
      setFetchError(e?.response?.data?.message || 'Pages load error ');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPages(); }, []);

  const handleAdded   = () => { fetchPages(); setAddOpen(false); };
  const handleSaved   = () => { fetchPages(); setEditTarget(null); };
  const handleDeleted = (id: number)  => { setPages(prev => prev.filter(x => x.id !== id)); setDeleteTarget(null); };

  const handleToggle = async (p: Page) => {
    setTogglingId(p.id);
    const newStatus = p.status === 1 ? 0 : 1;
    try {
      await togglePageStatus(p.id, newStatus);
      setPages(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
    } catch { alert('Status update failed'); }
    finally { setTogglingId(null); }
  };

  const filtered = useMemo(() =>
    pages.filter(p =>
      (p.title?.toLowerCase()     || '').includes(search.toLowerCase()) ||
      (p.slug?.toLowerCase()      || '').includes(search.toLowerCase()) ||
      (p.page_type?.toLowerCase() || '').includes(search.toLowerCase())
    ), [search, pages]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {addOpen      && <PageFormModal onClose={() => setAddOpen(false)} onSaved={handleAdded} />}
      {editTarget   && <PageFormModal initial={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />}
      {deleteTarget && <DeleteModal page={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>📄 Pages Management</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px', margin: '4px 0 0' }}>
            Manage all static pages — {filtered.length} pages registered
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '8px 14px', minWidth: '220px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              placeholder="Search by title, slug or type..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', background: 'transparent', color: '#1e293b' }}
            />
          </div>
          <button onClick={fetchPages} title="Refresh"
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '9px 13px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setAddOpen(true)}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Plus size={16} /> Add Page
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'white', borderRadius: '20px', border: '1.5px solid #eef2f7', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                {['#', 'Title & Slug', 'Page Type', 'Role', 'Status', 'Created At', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '13px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '13px' }}>Loading pages...</span>
                  </div>
                </td></tr>
              )}
              {!loading && fetchError && (
                <tr><td colSpan={7} style={{ padding: '50px', textAlign: 'center' }}>
                  <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px' }}>{fetchError}</p>
                  <button onClick={fetchPages} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    Try Again
                  </button>
                </td></tr>
              )}
              {!loading && !fetchError && paginated.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#fafbff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'white'; }}>

                  {/* # */}
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                    {(currentPage - 1) * PER_PAGE + paginated.indexOf(p) + 1}
                  </td>

                  {/* Title & Slug */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} color="#6366f1" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{p.title}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ede9fe', color: '#6366f1', fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '5px', marginTop: '3px' }}>
                          <Globe size={9} /> {p.slug}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Page Type */}
                  <td style={{ padding: '14px 16px' }}>
                    <TypeBadge type={p.page_type} />
                  </td>

                  {/* Role */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: p.role === 'driver' ? '#fffbeb' : '#eff6ff',
                      color:      p.role === 'driver' ? '#b45309'  : '#1d4ed8',
                      fontSize: '10px', fontWeight: 700, padding: '3px 9px',
                      borderRadius: '20px', textTransform: 'capitalize', whiteSpace: 'nowrap',
                    }}>
                      {p.role || 'user'}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: p.status === 1 ? '#f0fdf4' : '#f1f5f9', color: p.status === 1 ? '#16a34a' : '#64748b' }}>
                      {p.status === 1 ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {p.status === 1 ? 'Active' : 'Inactive'}
                    </div>
                  </td>

                  {/* Created At */}
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button onClick={() => handleToggle(p)} disabled={togglingId === p.id}
                        title={p.status === 1 ? 'Deactivate' : 'Activate'}
                        style={{ background: p.status === 1 ? '#f0fdf4' : '#f8fafc', border: `1px solid ${p.status === 1 ? '#bbf7d0' : '#e2e8f0'}`, color: p.status === 1 ? '#16a34a' : '#64748b', padding: '7px', borderRadius: '9px', cursor: togglingId === p.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                        {togglingId === p.id
                          ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                          : p.status === 1 ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      </button>
                      <button onClick={() => setEditTarget(p)} title="Edit"
                        style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} title="Delete"
                        style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#ef4444', padding: '7px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !fetchError && paginated.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  {search ? `No pages found for "${search}".` : 'No pages found. Add your first page!'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && !fetchError && filtered.length > 0 && (
          <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing <b style={{ color: '#1e293b' }}>{paginated.length}</b> of <b style={{ color: '#1e293b' }}>{filtered.length}</b> pages
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '7px 11px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#64748b', opacity: currentPage === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={15} />
              </button>
              <span style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 700, color: '#6366f1', background: '#ede9fe', borderRadius: '8px' }}>
                {currentPage} / {totalPages || 1}
              </span>
              <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '7px 11px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', color: '#64748b', opacity: (currentPage === totalPages || totalPages === 0) ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg)  } to { transform: rotate(360deg) } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
