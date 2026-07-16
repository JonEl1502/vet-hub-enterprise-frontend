import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Loader2, MessageCircle, Building2 } from 'lucide-react';
import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

// Chat-style messages: one conversation thread per connected clinic, bubbles
// anchored to the bottom with a sticky composer, unread badges per thread.
const ClientMessages: React.FC = () => {
  const { messages, clinics, loading, sendMessage, markThreadRead } = useClientPortal();
  const [activeClinicId, setActiveClinicId] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default to the thread with the most recent activity, else first clinic.
  useEffect(() => {
    if (activeClinicId || clinics.length === 0) return;
    const latest = [...messages].sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];
    setActiveClinicId(latest?.clinicId || clinics[0].clinic.id);
  }, [clinics, messages, activeClinicId]);

  const threads = useMemo(() => clinics.map(({ clinic }) => {
    const thread = messages.filter((m) => m.clinicId === clinic.id);
    const unread = thread.filter((m) => !m.fromOwner && !m.isRead).length;
    const last = thread[0]; // messages come newest-first
    return { clinic, unread, last };
  }), [clinics, messages]);

  const activeThread = useMemo(
    () => messages.filter((m) => m.clinicId === activeClinicId).slice().reverse(), // oldest → newest
    [messages, activeClinicId],
  );

  // Opening a thread clears its unread state (locally + server).
  useEffect(() => {
    if (!activeClinicId) return;
    const hasUnread = messages.some((m) => m.clinicId === activeClinicId && !m.fromOwner && !m.isRead);
    if (hasUnread) markThreadRead(activeClinicId);
  }, [activeClinicId, messages, markThreadRead]);

  // Keep the newest bubble in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [activeThread.length, activeClinicId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClinicId || !body.trim()) return;
    setBusy(true);
    const ok = await sendMessage({ clinicId: activeClinicId, body: body.trim() });
    setBusy(false);
    if (ok) setBody('');
  };

  if (clinics.length === 0) {
    return (
      <div className="space-y-5 fade-in">
        <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Messages</h1>
        <div className="cp-card p-8 text-center">
          <MessageCircle className="w-8 h-8 cp-accent-text mx-auto mb-2" />
          <p className="text-sm cp-muted">Connect to a clinic to start a conversation.</p>
        </div>
      </div>
    );
  }

  const activeClinic = clinics.find((c) => c.clinic.id === activeClinicId)?.clinic;

  return (
    <div className="space-y-4 fade-in">
      <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Messages</h1>

      {/* Thread picker (only when >1 clinic) */}
      {clinics.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {threads.map(({ clinic, unread }) => (
            <button key={clinic.id}
                    className={`cp-card px-3 py-2 flex items-center gap-2 shrink-0 ${activeClinicId === clinic.id ? 'ring-2' : ''}`}
                    style={activeClinicId === clinic.id ? { ['--tw-ring-color' as any]: 'var(--cp-accent)' } : undefined}
                    onClick={() => setActiveClinicId(clinic.id)}>
              <Building2 className="w-4 h-4 cp-accent-text" />
              <span className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>{clinic.name}</span>
              {unread > 0 && <span className="cp-chip">{unread}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Conversation */}
      <div className="cp-card flex flex-col" style={{ height: 'min(65vh, 620px)' }}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--cp-accent-soft)' }}>
            <Building2 className="w-4 h-4 cp-accent-text" />
          </div>
          <div className="font-black text-sm" style={{ color: 'var(--cp-ink)' }}>{activeClinic?.name}</div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-8"><LoadingSpinner message="Loading..." /></div>
          ) : activeThread.length === 0 ? (
            <p className="text-sm cp-muted text-center py-8">No messages yet. Say hello 👋</p>
          ) : (
            activeThread.map((m, i) => {
              const prev = activeThread[i - 1];
              const showDay = !prev || !isSameDay(new Date(prev.sentAt), new Date(m.sentAt));
              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="text-center my-3">
                      <span className="text-[10px] font-black uppercase tracking-wider cp-muted cp-card-soft px-2.5 py-1 rounded-full">
                        {format(new Date(m.sentAt), 'EEE d MMM')}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${m.fromOwner ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] p-3 rounded-2xl"
                         style={m.fromOwner
                           ? { background: 'var(--cp-accent)', color: '#fff', borderBottomRightRadius: 4 }
                           : { background: 'var(--cp-surface-2)', border: '1px solid var(--cp-border)', borderBottomLeftRadius: 4 }}>
                      {m.subject && <div className="font-bold text-sm mb-0.5" style={m.fromOwner ? {} : { color: 'var(--cp-ink)' }}>{m.subject}</div>}
                      <div className="text-sm whitespace-pre-wrap" style={m.fromOwner ? {} : { color: 'var(--cp-ink)' }}>{m.body}</div>
                      <div className="text-[10px] mt-1 opacity-70">{formatDistanceToNow(new Date(m.sentAt), { addSuffix: true })}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Sticky composer */}
        <form onSubmit={submit} className="p-3 border-t flex items-end gap-2" style={{ borderColor: 'var(--cp-border)' }}>
          <textarea
            className="cp-input flex-1"
            rows={1}
            style={{ height: 'auto', minHeight: '2.6rem', maxHeight: '6rem', paddingTop: '0.55rem' }}
            placeholder={`Message ${activeClinic?.name || 'your clinic'}…`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); }
            }}
          />
          <button type="submit" className="cp-btn shrink-0" disabled={busy || !body.trim()} style={{ height: '2.6rem' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClientMessages;
