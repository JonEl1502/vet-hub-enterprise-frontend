import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, Bot } from 'lucide-react';
import { aiAPI } from '../../../services/modules/ai.api';
import type { ChatMessage } from '../../../services/modules/ai.api';

export interface AIContext {
  page?: string;
  patientName?: string;
  clientName?: string;
  userName?: string;
  userRole?: string;
}

// Marker so the seeded context line can be stripped from what we display.
const CTX_PREFIX = '⟦ctx⟧';
const stripCtx = (s: string) => s.split('\n').filter(l => !l.startsWith(CTX_PREFIX)).join('\n').trim();

/**
 * App-wide Ask-AI assistant: a bottom-right floating button that opens a
 * resizable panel hovering above all UI. It seeds the conversation with the
 * current page + patient/client + logged-in user so one assistant can help
 * across the whole app and answer for whoever is signed in.
 */
const GlobalAIAssistant: React.FC<{ context: AIContext }> = ({ context }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 380, h: 520 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, open]);

  const contextLine = () => {
    const parts: string[] = [];
    if (context.userName) parts.push(`assisting ${context.userName}${context.userRole ? ` (${context.userRole})` : ''}`);
    if (context.page) parts.push(`page: ${context.page}`);
    if (context.patientName) parts.push(`patient: ${context.patientName}`);
    if (context.clientName) parts.push(`client: ${context.clientName}`);
    return parts.join(' · ');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    const ctx = contextLine();
    const outgoing = !seededRef.current && ctx ? `${CTX_PREFIX} ${ctx}\n\n${text}` : text;
    setMessages(m => [...m, { role: 'user', content: text, createdAt: new Date().toISOString() }]);
    try {
      const res = await aiAPI.chat({ message: outgoing, conversationId: conversationId ?? undefined });
      if (res.success && res.data) {
        seededRef.current = true;
        setConversationId(res.data.conversationId);
        setMessages(res.data.messages.map(msg => ({ ...msg, content: stripCtx(msg.content) })));
      } else {
        setMessages(m => [...m, { role: 'assistant', content: 'Sorry — the assistant is unavailable right now.', createdAt: new Date().toISOString() }]);
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry — I could not reach the assistant.', createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  // Resize from the top-left grip (the panel is anchored bottom-right).
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
    const move = (ev: MouseEvent) => setSize({
      w: Math.min(760, Math.max(320, startW - (ev.clientX - startX))),
      h: Math.min(820, Math.max(360, startH - (ev.clientY - startY))),
    });
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ask AI"
        className="fixed bottom-6 right-6 z-[900] flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all"
      >
        <Sparkles size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Ask AI</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-[900] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      style={{ width: size.w, height: size.h, maxWidth: 'calc(100vw - 1.5rem)', maxHeight: 'calc(100dvh - 1.5rem)' }}
    >
      {/* Resize grip (top-left) */}
      <div onMouseDown={onResizeStart} title="Drag to resize" className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-10" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={18} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest leading-none">Ask AI</p>
            {(context.page || context.patientName) && (
              <p className="text-[9px] text-white/70 truncate mt-0.5">
                {context.page}{context.patientName ? ` · ${context.patientName}` : ''}{context.clientName ? ` · ${context.clientName}` : ''}
              </p>
            )}
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/15 rounded-lg shrink-0"><X size={18} /></button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50 dark:bg-zinc-950/30">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-slate-400">
            <Sparkles size={26} className="mb-2 text-indigo-400" />
            <p className="text-xs font-bold">How can I help{context.userName ? `, ${context.userName.split(' ')[0]}` : ''}?</p>
            <p className="text-[10px] mt-1">I can see the page you're on{context.patientName ? ` and ${context.patientName}` : ''}. Ask about this patient, the clinic, or anything in the app.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-bl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start"><div className="px-3 py-2 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"><Loader2 size={14} className="animate-spin text-indigo-500" /></div></div>
        )}
      </div>

      {/* Composer */}
      <div className="p-2.5 border-t border-slate-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Ask anything…"
            className="flex-1 resize-none max-h-28 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <button onClick={send} disabled={sending || !input.trim()} className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalAIAssistant;
