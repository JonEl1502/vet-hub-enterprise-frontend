import React, { useState, useMemo } from 'react';
import { Client, Pet, Message, Clinic, Visit } from '../../../types';
import { ArrowLeft, ExternalLink, Check, MessageCircle, Mail, Phone, Wallet, CalendarClock, MapPin } from 'lucide-react';

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

  const handleSend = (channel: 'whatsapp' | 'email' | 'sms') => {
    onRecordMessage({ clientId: client.id, petId: pet?.id, subject, body: message, channel });
    setSentStatus(channel);
    setTimeout(() => {
      setSentStatus(null);
      const encodedMsg = encodeURIComponent(message);
      const encodedSub = encodeURIComponent(subject);
      if (channel === 'whatsapp') {
        window.open(`https://wa.me/${client.phone.replace(/\s+/g, '')}?text=${encodedMsg}`, '_blank');
      } else if (channel === 'email') {
        window.open(`mailto:${client.email}?subject=${encodedSub}&body=${encodedMsg}`, '_blank');
      } else if (channel === 'sms') {
        window.open(`sms:${client.phone}?body=${encodedMsg}`, '_blank');
      }
    }, 1500);
  };

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
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSend(ch.id as any)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                      sent
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 ring-2 ring-emerald-500/20'
                        : `${ch.color} hover:opacity-80`
                    }`}
                  >
                    {sent ? <Check size={18} /> : <Icon size={18} />}
                    <span>{sent ? 'Sent!' : ch.label}</span>
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
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
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
