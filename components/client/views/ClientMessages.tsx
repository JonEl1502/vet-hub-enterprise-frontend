import React, { useState } from 'react';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useClientPortal } from '../../../contexts/ClientPortalContext';

const ClientMessages: React.FC = () => {
  const { messages, clinics, loading, sendMessage } = useClientPortal();
  const [clinicId, setClinicId] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  // Default the composer to the first connected clinic.
  React.useEffect(() => {
    if (!clinicId && clinics.length) setClinicId(clinics[0].clinic.id);
  }, [clinics, clinicId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !body.trim()) return;
    setBusy(true);
    const ok = await sendMessage({ clinicId, body: body.trim() });
    setBusy(false);
    if (ok) setBody('');
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Messages</h1>

      {clinics.length === 0 ? (
        <div className="cp-card p-8 text-center">
          <MessageCircle className="w-8 h-8 cp-accent-text mx-auto mb-2" />
          <p className="text-sm cp-muted">Connect to a clinic to start a conversation.</p>
        </div>
      ) : (
        <>
          {/* Composer */}
          <form onSubmit={submit} className="cp-card p-4 space-y-3">
            {clinics.length > 1 && (
              <div>
                <label className="cp-label">To</label>
                <select className="cp-input" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
                  {clinics.map((c) => <option key={c.clinic.id} value={c.clinic.id}>{c.clinic.name}</option>)}
                </select>
              </div>
            )}
            <textarea className="cp-input" rows={3} placeholder="Write a message to your clinic…"
                      value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex justify-end">
              <button type="submit" className="cp-btn" disabled={busy || !body.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
              </button>
            </div>
          </form>

          {/* Thread */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin cp-accent-text" /></div>
          ) : messages.length === 0 ? (
            <p className="text-sm cp-muted text-center py-6">No messages yet. Say hello 👋</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromOwner ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%] p-3 rounded-2xl"
                       style={m.fromOwner
                         ? { background: 'var(--cp-accent)', color: '#fff', borderBottomRightRadius: 4 }
                         : { background: 'var(--cp-surface)', border: '1px solid var(--cp-border)', borderBottomLeftRadius: 4 }}>
                    {!m.fromOwner && m.clinicName && (
                      <div className="text-[10px] font-black uppercase tracking-wide mb-0.5 cp-accent-text">{m.clinicName}</div>
                    )}
                    {m.subject && <div className="font-bold text-sm mb-0.5">{m.subject}</div>}
                    <div className="text-sm whitespace-pre-wrap" style={m.fromOwner ? {} : { color: 'var(--cp-ink)' }}>{m.body}</div>
                    <div className="text-[10px] mt-1 opacity-70">{formatDistanceToNow(new Date(m.sentAt), { addSuffix: true })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientMessages;
