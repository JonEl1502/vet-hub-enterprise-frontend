import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, Bot, Mic, Upload, Image as ImageIcon } from 'lucide-react';
import { aiAPI } from '../../../services/modules/ai.api';
import type { ChatMessage } from '../../../services/modules/ai.api';
import { dialog } from '../../../services';
import { toast } from '../../../services/utils/toast';

export interface AIContext {
  page?: string;
  patientName?: string;
  clientName?: string;
  userName?: string;
  userRole?: string;
  species?: string;
  age?: number;
  // Present when the current page is a specific visit — ties the
  // conversation to that visit so it persists across reopens, same as any
  // other per-visit record.
  appointmentId?: string | number;
}

// Marker so the seeded context line can be stripped from what we display.
const CTX_PREFIX = '⟦ctx⟧';
const stripCtx = (s: string) => s.split('\n').filter(l => !l.startsWith(CTX_PREFIX)).join('\n').trim();

// Downscale an image file to a compact JPEG data URL — same approach used
// for every other image attach point in this codebase (ImagingView,
// GroomingPanel, task attachments).
const fileToDownscaledDataUrl = (file: File, max = 1100, quality = 0.72): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const scale = Math.min(max / width, max / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

// Splits `data:image/jpeg;base64,XXXX` into the { data, mimeType } shape
// aiAPI.chat's `image` field expects.
const splitDataUrl = (dataUrl: string): { data: string; mimeType: string } | null => {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mimeType: m[1], data: m[2] } : null;
};

// Clearance above the various fixed bottom bars this app has (RecordActionBar,
// VisitWizard/EmergencyTriagePanel footers, the client portal's mobile tab
// bar) — all land in the ~56-64px range plus the phone's home-indicator inset.
// max() covers the no-safe-area desktop bars; calc() covers notched phones.
const BOTTOM_CLEARANCE = 'max(5.5rem, calc(4.5rem + env(safe-area-inset-bottom)))';

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
  const [isRecording, setIsRecording] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      setPendingImage({ dataUrl, name: file.name });
    } catch {
      toast.error('Could not read that image — try a different file.');
    }
  };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, open]);

  // Same Web Speech API pattern as the per-appointment AI Assistant — free,
  // client-side, Chrome/Edge only.
  const handleStartRecording = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      await dialog.alert({
        title: 'Browser not supported',
        message: 'Speech recognition is not supported in your browser. Please use Chrome or Edge.',
        variant: 'warning',
      });
      return;
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const contextLine = () => {
    const parts: string[] = [];
    if (context.userName) parts.push(`assisting ${context.userName}${context.userRole ? ` (${context.userRole})` : ''}`);
    if (context.page) parts.push(`page: ${context.page}`);
    if (context.patientName) parts.push(`patient: ${context.patientName}${context.species ? ` (${context.species}${context.age != null ? `, ${context.age}y` : ''})` : ''}`);
    if (context.clientName) parts.push(`client: ${context.clientName}`);
    return parts.join(' · ');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const image = pendingImage ? splitDataUrl(pendingImage.dataUrl) ?? undefined : undefined;
    setInput('');
    setPendingImage(null);
    setSending(true);
    const ctx = contextLine();
    const outgoing = !seededRef.current && ctx ? `${CTX_PREFIX} ${ctx}\n\n${text}` : text;
    setMessages(m => [...m, { role: 'user', content: text, createdAt: new Date().toISOString() }]);
    try {
      const res = await aiAPI.chat({
        message: outgoing,
        conversationId: conversationId ?? undefined,
        appointmentId: context.appointmentId,
        image,
      });
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
        style={{ bottom: BOTTOM_CLEARANCE }}
        className="fixed right-4 sm:right-6 z-[900] flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all"
      >
        <Sparkles size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Ask AI</span>
      </button>
    );
  }

  return (
    <div
      className="fixed right-3 sm:right-6 z-[900] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      style={{
        width: size.w,
        height: size.h,
        bottom: BOTTOM_CLEARANCE,
        maxWidth: 'calc(100vw - 1.5rem)',
        maxHeight: `calc(100dvh - ${BOTTOM_CLEARANCE} - 0.75rem)`,
      }}
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
        {pendingImage && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] text-slate-600 dark:text-zinc-300">
            <ImageIcon size={12} className="shrink-0" />
            <span className="truncate flex-1">{pendingImage.name}</span>
            <button onClick={() => setPendingImage(null)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded" title="Remove attachment">
              <X size={11} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Ask anything…"
            className="flex-1 resize-none max-h-28 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <button
            onClick={handleStartRecording}
            disabled={sending || isRecording}
            title="Voice input"
            className={`p-2.5 rounded-xl shrink-0 transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
          >
            <Mic size={16} />
          </button>
          <label
            title="Attach image"
            className="p-2.5 rounded-xl shrink-0 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
          >
            <Upload size={16} />
            <input type="file" className="hidden" accept="image/*" disabled={sending} onChange={handleImageAttach} />
          </label>
          <button onClick={send} disabled={sending || !input.trim()} className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalAIAssistant;
