import React, { useState } from 'react';
import { Client, Pet, Message } from '../types';
import { ArrowLeft, MessageSquare, Mail, Phone, Send, ExternalLink, X, Smartphone, Check } from 'lucide-react';

interface Props {
  client: Client;
  pet?: Pet;
  onBack: () => void;
  onRecordMessage: (msg: Omit<Message, 'id' | 'date' | 'senderName'>) => void;
}

const CommunicationPortal: React.FC<Props> = ({ client, pet, onBack, onRecordMessage }) => {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState(pet ? `Follow-up: ${pet.name}'s Health` : 'General Inquiry');
  const [sentStatus, setSentStatus] = useState<string | null>(null);

  const handleSend = (channel: 'whatsapp' | 'email' | 'sms') => {
    onRecordMessage({
      clientId: client.id,
      petId: pet?.id,
      subject,
      body: message,
      channel
    });

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-2">
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam hover:text-pine dark:hover:text-zinc-100 transition-all shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Messaging Portal</h1>
            <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">Client: {client.name}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-xl space-y-8">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-6 py-4 text-pine dark:text-zinc-100 font-bold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Message Body</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={10} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-6 text-pine dark:text-zinc-100 font-medium outline-none resize-none" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-lg space-y-6 sticky top-6">
            <h3 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest px-1">Channels</h3>
            <div className="space-y-4">
              {['whatsapp', 'email', 'sms'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => handleSend(ch as any)}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${sentStatus === ch ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-100 dark:border-zinc-800 hover:border-seafoam'}`}
                >
                  <span className="text-[11px] font-black uppercase tracking-widest">{ch}</span>
                  {sentStatus === ch ? <Check size={18} className="text-emerald-500" /> : <ExternalLink size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationPortal;