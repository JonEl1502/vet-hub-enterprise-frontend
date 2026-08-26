import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Client, Pet, Message, Clinic, Visit } from '../../../types';
import { ArrowLeft, ExternalLink, Check, MessageCircle, Mail, Phone, Wallet, CalendarClock, MapPin, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { messagingAPI, type WhatsappStatus } from '../../../services/modules/messaging.api';

interface Props {
  client: Client;
  pet?: Pet;
  onBack: () => void;
  onRecordMessage: (msg: Omit<Message, 'id' | 'date' | 'senderName'>) => void;
  clinic?: Clinic;
  appointments?: Visit[];
}

const channels = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
  { id: 'email',    label: 'Email',    icon: Mail,          color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { id: 'sms',      label: 'SMS',      icon: Phone,         color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
];

const CommunicationPortal: React.FC<Props> = ({ client, pet, onBack, onRecordMessage, clinic, appointments }) => {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState(pet ? `Follow-up: ${pet.name}'s Health` : 'General Inquiry');
  const [sentStatus, setSentStatus] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  // null while we don't know yet — the WhatsApp button must not promise real
  // delivery before the server has told us it can deliver.
  const [wa, setWa] = useState<WhatsappStatus | null>(null);
  const [waSending, setWaSending] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    messagingAPI
      .whatsappStatus(client.id)
      .then((r) => { if (!cancelled && r?.data) setWa(r.data as WhatsappStatus); })
      // Silent: a clinic with no WhatsApp set up is the normal case, not an
      // error worth interrupting anyone over. We simply fall back to the link.
      .catch(() => { if (!cancelled) setWa({ configured: false, windowOpen: false, windowExpiresAt: null, tier: null }); });
    return () => { cancelled = true; };
  }, [client.id]);

  // Three genuinely different states, and the button has to say which:
  //   'api'  — configured AND inside Meta's 24-hour window: we send it, and
  //            delivery is tracked on the thread.
  //   'link' — no channel configured: hand off to the staff member's own
  //            WhatsApp, exactly as before.
  //   'window-closed' — configured, but the client has not messaged in 24h, so
  //            Meta accepts only an approved template. Free text WILL be
  //            rejected (131047), so we do not pretend otherwise; the deep link
  //            stays available as the honest way through.
  const waMode: 'api' | 'link' | 'window-closed' =
    !wa?.configured ? 'link' : wa.windowOpen ? 'api' : 'window-closed';

  // Quick message templates — pre-fill subject + body from what we know about
  // this client (outstanding balance, next visit, clinic location).
  const templates = useMemo(() => {
    const firstName = (client as any).firstName || (client.name || '').split(' ')[0] || 'there';
    const cur = client.currency || 'KES';
    const clinicName = clinic?.name || 'our clinic';
    const clientAppts = (appointments || []).filter(a => String(a.clientId) === String(client.id));
    const outstanding = (client as any).outstandingBalance
      ?? clientAppts.filter(a => !a.isPaid && ((a as any).status === 'PENDING_PAYMENT'))
                    .reduce((s, a) => s + (Number((a as any).totalCost) || 0), 0);
    const nextAppt = clientAppts
      .filter(a => { const d = new Date((a as any).date || (a as any).scheduledAt); return d.getTime() > Date.now() && (a as any).status !== 'CANCELLED'; })
      .sort((a, b) => +new Date((a as any).date || (a as any).scheduledAt) - +new Date((b as any).date || (b as any).scheduledAt))[0];
    const nextWhen = nextAppt ? new Date((nextAppt as any).date || (nextAppt as any).scheduledAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const mapLink = (clinic as any)?.latitude && (clinic as any)?.longitude
      ? `https://maps.google.com/?q=${(clinic as any).latitude},${(clinic as any).longitude}`
      : clinic?.name ? `https://maps.google.com/?q=${encodeURIComponent([clinic.name, (clinic as any).city, (clinic as any).region].filter(Boolean).join(' '))}` : '';
    const where = [(clinic as any)?.city, (clinic as any)?.region].filter(Boolean).join(', ');

    return [
      {
        id: 'balance', label: 'Outstanding balance', icon: Wallet,
        subject: 'Outstanding balance',
        body: `Dear ${firstName},\n\nOur records show an outstanding balance of ${cur} ${Number(outstanding || 0).toLocaleString()} on your account at ${clinicName}. Kindly settle it at your earliest convenience so we can keep caring for your pets.\n\nThank you,\n${clinicName}`,
      },
      {
        id: 'reminder', label: 'Appointment reminder', icon: CalendarClock,
        subject: 'Appointment reminder',
        body: `Dear ${firstName},\n\nThis is a friendly reminder about your upcoming appointment${nextWhen ? ` on ${nextWhen}` : ''} at ${clinicName}. Please arrive a few minutes early, and reply if you need to reschedule.\n\nSee you soon,\n${clinicName}`,
      },
      {
        id: 'location', label: 'Share location', icon: MapPin,
        subject: `${clinicName} — location`,
        body: `Hi ${firstName},\n\nHere's how to find us at ${clinicName}${where ? ` (${where})` : ''}${mapLink ? `:\n${mapLink}` : '.'}\n\nWe look forward to seeing you.`,
      },
    ];
  }, [client, clinic, appointments, pet]);

  const applyTemplate = (t: { id: string; subject: string; body: string }) => {
    setSubject(t.subject);
    setMessage(t.body);
    setActiveTemplate(t.id);
  };

  /** Hand off to whatever app the staff member has. The original behaviour. */
  const openExternal = useCallback((channel: 'whatsapp' | 'email' | 'sms') => {
    const encodedMsg = encodeURIComponent(message);
    const encodedSub = encodeURIComponent(subject);
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/${(client.phone || '').replace(/\s+/g, '')}?text=${encodedMsg}`, '_blank');
    } else if (channel === 'email') {
      window.open(`mailto:${client.email}?subject=${encodedSub}&body=${encodedMsg}`, '_blank');
    } else if (channel === 'sms') {
      window.open(`sms:${client.phone}?body=${encodedMsg}`, '_blank');
    }
  }, [client.email, client.phone, message, subject]);

  const handleSend = useCallback(async (channel: 'whatsapp' | 'email' | 'sms') => {
    if (!message.trim()) return;
    setWaError(null);

    // Real send: the server queues it, dispatches to Meta and tracks delivery
    // on the thread. No handoff, and no locally-recorded row — the message row
    // IS the server's, so recording another here would duplicate the thread.
    if (channel === 'whatsapp' && waMode === 'api') {
      setWaSending(true);
      try {
        await messagingAPI.send({ clientId: client.id, petId: pet?.id, subject, body: message, channel: 'whatsapp' });
        setSentStatus('whatsapp');
        setMessage('');
        setTimeout(() => setSentStatus(null), 2500);
      } catch (err: any) {
        setWaError(err?.message || 'WhatsApp send failed. Try opening WhatsApp instead.');
      } finally {
        setWaSending(false);
      }
      return;
    }

    // Handoff path (email, sms, and WhatsApp when we cannot send it ourselves).
    // Still recorded locally, because nothing else will record it: the message
    // leaves from the staff member's own app and the server never sees it.
    onRecordMessage({ clientId: client.id, petId: pet?.id, subject, body: message, channel });
    setSentStatus(channel);
    setTimeout(() => {
      setSentStatus(null);
      openExternal(channel);
    }, 1500);
  }, [client.id, message, onRecordMessage, openExternal, pet?.id, subject, waMode]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="flex items-center gap-3 mb-5 pb-3 border-b border-seafoam/15 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="w-9 h-9 shrink-0 bg-white dark:bg-zinc-900 border border-seafoam/20 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam hover:text-pine dark:hover:text-zinc-100 transition-all shadow-sm"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-pine dark:text-zinc-100 tracking-tight leading-tight truncate">
            Messaging Portal
          </h1>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-widest truncate">
            {client.name}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Compose card */}
        <div className="lg:col-span-8">
          {/* What WhatsApp will actually DO when pressed. Staff have no other
              way to know whether this sends or just opens their phone, and the
              difference decides whether the client hears from the clinic. */}
          {waMode === 'api' && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5">
              <MessageCircle size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                WhatsApp sends directly from {wa?.tier === 'clinic' ? 'this clinic’s number' : 'the VetHub number'} and delivery is tracked.
                {wa?.windowExpiresAt && (
                  <span className="font-semibold opacity-80">
                    {' '}Open until {new Date(wa.windowExpiresAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.
                  </span>
                )}
              </p>
            </div>
          )}
          {waMode === 'window-closed' && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
              <Clock size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                {client.name?.split(' ')[0] || 'This client'} hasn’t messaged in 24 hours, so WhatsApp won’t accept a typed
                message — only a pre-approved template.{' '}
                <span className="font-semibold opacity-80">
                  Pressing WhatsApp opens it on your own phone instead, with this message ready to send.
                </span>
              </p>
            </div>
          )}
          {waError && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-[11px] font-bold text-red-800 dark:text-red-300">{waError}</p>
            </div>
          )}
          <div className="bg-white dark:bg-zinc-900 border border-seafoam/15 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            {/* Quick templates */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Quick templates</label>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => {
                  const Icon = t.icon;
                  const on = activeTemplate === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                        on ? 'bg-seafoam text-white border-seafoam shadow-sm shadow-seafoam/20'
                           : 'bg-seafoam/5 text-seafoam border-seafoam/20 hover:bg-seafoam/10'
                      }`}
                    >
                      <Icon size={13} /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setActiveTemplate(null); }}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-seafoam/15 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/25 focus:border-seafoam/40 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Message Body</label>
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); setActiveTemplate(null); }}
                rows={8}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-seafoam/15 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 font-medium outline-none resize-none focus:ring-2 focus:ring-seafoam/25 focus:border-seafoam/40 transition-all"
                placeholder="Type your message here…"
              />
            </div>

            {/* Mobile channel buttons — inline below compose */}
            <div className="grid grid-cols-3 gap-2 pt-1 lg:hidden">
              {channels.map((ch) => {
                const Icon = ch.icon;
                const sent = sentStatus === ch.id;
                const busy = ch.id === 'whatsapp' && waSending;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSend(ch.id as any)}
                    disabled={busy || !message.trim()}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      sent
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 ring-2 ring-emerald-500/20'
                        : `${ch.color} hover:opacity-80`
                    }`}
                  >
                    {busy ? <Loader2 size={18} className="animate-spin" /> : sent ? <Check size={18} /> : <Icon size={18} />}
                    <span>{busy ? 'Sending…' : sent ? 'Sent!' : ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop channel sidebar */}
        <div className="hidden lg:block lg:col-span-4">
          <div className="bg-white dark:bg-zinc-900 border border-seafoam/15 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 sticky top-6">
            <h3 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest px-1">Send Via</h3>
            <div className="space-y-2.5">
              {channels.map((ch) => {
                const Icon = ch.icon;
                const sent = sentStatus === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSend(ch.id as any)}
                    disabled={(ch.id === 'whatsapp' && waSending) || !message.trim()}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      sent
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500/20'
                        : 'border-seafoam/15 dark:border-zinc-800 hover:border-seafoam hover:bg-seafoam/5 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ch.color} border`}>
                        <Icon size={15} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
                        {ch.label}
                      </span>
                    </div>
                    {sent
                      ? <Check size={16} className="text-emerald-500" />
                      : ch.id === 'whatsapp' && waSending
                        ? <Loader2 size={14} className="animate-spin text-emerald-500" />
                        : ch.id === 'whatsapp' && waMode === 'api'
                          // Not an ExternalLink: this one does not leave VetHub.
                          ? <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Sends</span>
                          : <ExternalLink size={14} className="text-slate-400" />
                    }
                  </button>
                );
              })}
            </div>

            {/* Client info */}
            <div className="pt-3 border-t border-seafoam/15 dark:border-zinc-800 space-y-2">
              <p className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 mb-2">Contact Info</p>
              <div className="flex items-center gap-2 px-1">
                <Mail size={12} className="text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500 truncate">{client.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2 px-1">
                <Phone size={12} className="text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500">{client.phone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationPortal;
