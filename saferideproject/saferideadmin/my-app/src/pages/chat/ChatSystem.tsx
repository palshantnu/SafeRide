import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Search, RefreshCw, Send, User, Car,
  MessageSquare, Lock, Unlock,
} from 'lucide-react';
import { getChatConversations, getChatMessages, sendChatReply, closeChatConversation, reopenChatConversation } from '../../services/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Conversation {
  id: number;
  participant_type: 'USER' | 'DRIVER';
  participant_id: number;
  participant_name: string | null;
  participant_mobile: string | null;
  status: 'OPEN' | 'CLOSED';
  last_message: string | null;
  last_message_at: string | null;
  unread_by_admin: number;
  created_at: string;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_type: 'USER' | 'DRIVER' | 'ADMIN';
  sender_id: number | null;
  message: string;
  created_at: string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://sigiride.com/api').replace(/\/api\/?$/, '');
const getToken = () => localStorage.getItem('token');

const fmtTime = (d?: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDay = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';

export default function ChatSystem() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => conversations.find(c => c.id === activeId) || null, [conversations, activeId]);

  const fetchConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await getChatConversations({ status: statusFilter, limit: 100 });
      const body = (res as { data: unknown }).data as { data?: Conversation[] };
      setConversations(Array.isArray(body?.data) ? body.data! : []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── socket.io: live updates ──────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: `Bearer ${getToken()}`, client_type: 'ADMIN' },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    // Rooms don't survive a reconnect (tab backgrounded, brief network drop,
    // etc.) — 'connect' fires on the first connection AND every reconnection,
    // so re-joining here (not only when the admin first opens a thread) is
    // what keeps live messages flowing without a manual page reload.
    socket.on('connect', () => {
      if (activeIdRef.current) {
        socket.emit('join_conversation', activeIdRef.current);
      }
    });

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      // bump that conversation to the top with the new preview, whether or not it's open
      setConversations(prev => prev.map(c => c.id === msg.conversation_id
        ? { ...c, last_message: msg.message, last_message_at: msg.created_at,
            unread_by_admin: msg.sender_type === 'ADMIN' ? c.unread_by_admin : c.unread_by_admin + 1 }
        : c));
    });

    socket.on('conversation_updated', (payload: { conversation_id: number; status?: string }) => {
      if (payload.status) {
        setConversations(prev => prev.map(c => c.id === payload.conversation_id ? { ...c, status: payload.status as 'OPEN' | 'CLOSED' } : c));
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (conv: Conversation) => {
    setActiveId(conv.id);
    activeIdRef.current = conv.id;
    setLoadingThread(true);
    socketRef.current?.emit('join_conversation', conv.id);
    try {
      const res = await getChatMessages(conv.id);
      const body = (res as { data: unknown }).data as { data?: { messages: Message[] } };
      setMessages(body?.data?.messages || []);
      if (conv.unread_by_admin > 0) {
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_by_admin: 0 } : c));
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() || !activeId) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      await sendChatReply(activeId, text);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!active) return;
    try {
      if (active.status === 'OPEN') {
        await closeChatConversation(active.id);
        setConversations(prev => prev.map(c => c.id === active.id ? { ...c, status: 'CLOSED' } : c));
      } else {
        await reopenChatConversation(active.id);
        setConversations(prev => prev.map(c => c.id === active.id ? { ...c, status: 'OPEN' } : c));
      }
    } catch { /* ignore */ }
  };

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    return !q || (c.participant_name || '').toLowerCase().includes(q) || (c.participant_mobile || '').includes(q);
  });

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .conv-row:hover { background:#fafbff !important; }
      `}</style>

      <div style={{ padding: 24, animation: 'fadeSlideUp 0.4s ease', height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>Chat System</h2>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Support conversations with users and captains</p>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>

          {/* ── Conversation list ── */}
          <div style={{ width: 340, flexShrink: 0, background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', marginBottom: 10 }}>
                <Search size={14} color="#94a3b8" />
                <input placeholder="Search name or mobile..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', background: 'transparent' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
                {(['OPEN', 'CLOSED'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{
                    flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: statusFilter === s ? 'white' : 'transparent',
                    color: statusFilter === s ? '#6366f1' : '#94a3b8',
                    boxShadow: statusFilter === s ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}>{s === 'OPEN' ? 'Open' : 'Closed'}</button>
                ))}
                <button onClick={fetchConversations} title="Refresh" style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={13} style={{ animation: loadingList ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingList && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: 14, borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ height: 12, width: '60%', borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite', marginBottom: 6 }} />
                  <div style={{ height: 10, width: '85%', borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease infinite' }} />
                </div>
              ))}

              {!loadingList && filtered.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <MessageSquare size={28} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 8px' }} />
                  <div style={{ color: '#94a3b8', fontSize: 12.5 }}>No {statusFilter.toLowerCase()} conversations.</div>
                </div>
              )}

              {!loadingList && filtered.map(c => (
                <div key={c.id} className="conv-row" onClick={() => openConversation(c)}
                  style={{ padding: '12px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', background: activeId === c.id ? '#eef2ff' : 'white', display: 'flex', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: c.participant_type === 'DRIVER' ? '#f0fdf4' : '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {c.participant_type === 'DRIVER' ? <Car size={15} color="#16a34a" /> : <User size={15} color="#6366f1" />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.participant_name || `${c.participant_type === 'DRIVER' ? 'Captain' : 'User'} #${c.participant_id}`}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{fmtDay(c.last_message_at || c.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.last_message || 'No messages yet'}
                      </span>
                      {c.unread_by_admin > 0 && (
                        <span style={{ background: '#6366f1', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 20, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>
                          {c.unread_by_admin}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Thread ── */}
          <div style={{ flex: 1, background: 'white', borderRadius: 16, border: '1.5px solid #eef2f7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!active ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                <MessageSquare size={40} />
                <div style={{ fontSize: 13, marginTop: 10 }}>Select a conversation to view messages</div>
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: active.participant_type === 'DRIVER' ? '#f0fdf4' : '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {active.participant_type === 'DRIVER' ? <Car size={15} color="#16a34a" /> : <User size={15} color="#6366f1" />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                        {active.participant_name || `${active.participant_type === 'DRIVER' ? 'Captain' : 'User'} #${active.participant_id}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {active.participant_type === 'DRIVER' ? 'Captain' : 'User'} · {active.participant_mobile || '—'}
                      </div>
                    </div>
                  </div>
                  <button onClick={handleToggleStatus} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${active.status === 'OPEN' ? '#fecaca' : '#bbf7d0'}`,
                    background: active.status === 'OPEN' ? '#fff1f2' : '#f0fdf4',
                    color: active.status === 'OPEN' ? '#dc2626' : '#16a34a',
                  }}>
                    {active.status === 'OPEN' ? <><Lock size={13} /> Close</> : <><Unlock size={13} /> Reopen</>}
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loadingThread ? (
                    <div style={{ margin: 'auto', color: '#94a3b8', fontSize: 12.5 }}>Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div style={{ margin: 'auto', color: '#cbd5e1', fontSize: 12.5 }}>No messages yet.</div>
                  ) : messages.map(m => {
                    const fromAdmin = m.sender_type === 'ADMIN';
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: fromAdmin ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '68%', padding: '9px 13px', borderRadius: 16,
                          borderTopRightRadius: fromAdmin ? 4 : 16, borderTopLeftRadius: fromAdmin ? 16 : 4,
                          background: fromAdmin ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f1f5f9',
                          color: fromAdmin ? 'white' : '#1e293b',
                        }}>
                          <div style={{ fontSize: 13.5, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{m.message}</div>
                          <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: 'right' }}>{fmtTime(m.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div style={{ padding: 14, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={active.status === 'CLOSED' ? 'Conversation is closed — reopen to reply' : 'Type a reply...'}
                    disabled={active.status === 'CLOSED'}
                    rows={1}
                    style={{ flex: 1, resize: 'none', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit', maxHeight: 100, background: active.status === 'CLOSED' ? '#f8fafc' : 'white' }}
                  />
                  <button onClick={handleSend} disabled={!draft.trim() || sending || active.status === 'CLOSED'}
                    style={{
                      background: (!draft.trim() || sending || active.status === 'CLOSED') ? '#e2e8f0' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      border: 'none', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: (!draft.trim() || sending || active.status === 'CLOSED') ? 'not-allowed' : 'pointer', flexShrink: 0,
                    }}>
                    {sending ? <RefreshCw size={16} color="white" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} color={(!draft.trim() || active.status === 'CLOSED') ? '#94a3b8' : 'white'} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
