import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, MessageCircle, CheckCheck, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useClientPortal } from '../../contexts/ClientPortalContext';
import { PortalMessage } from '../../services';

// Portal notification center — a bell in the top bar that surfaces everything
// the clinic sends the owner (broadcasts + direct messages) as one live feed.
// It reads the same `messages` the context already keeps fresh over SSE, so a
// new broadcast lands here the instant it's sent.

const relTime = (iso: string) => {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
};

// A subject usually means an announcement/broadcast; a bare body is a chat reply.
const iconFor = (m: PortalMessage) => (m.subject ? Megaphone : MessageCircle);

const NotificationBell: React.FC = () => {
  const { messages, markThreadRead } = useClientPortal();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only clinic→owner items are notifications; newest first.
  const incoming = messages
    .filter((m) => !m.fromOwner)
    .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));
  const unread = incoming.filter((m) => !m.isRead).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openItem = (m: PortalMessage) => {
    setOpen(false);
    if (!m.isRead && m.clinicId) markThreadRead(m.clinicId);
    navigate('/client/messages');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="cp-icon-btn cp-icon-btn-ghost relative"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center"
            style={{ background: 'var(--cp-accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="cp-card absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] max-h-[70vh] flex flex-col overflow-hidden z-30 p-0 shadow-xl"
          style={{ boxShadow: '0 20px 48px -12px rgba(20,78,53,0.28)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 cp-accent-text" />
              <span className="font-black text-sm" style={{ color: 'var(--cp-ink)' }}>Notifications</span>
              {unread > 0 && <span className="cp-chip">{unread}</span>}
            </div>
            {unread > 0 && (
              <button
                className="text-[11px] font-bold cp-accent-text flex items-center gap-1 hover:opacity-70"
                onClick={() => markThreadRead()}
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {incoming.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm cp-muted">No notifications yet.</p>
                <p className="text-xs cp-muted mt-0.5">Messages and announcements from your clinic show up here.</p>
              </div>
            ) : (
              <ul>
                {incoming.slice(0, 20).map((m) => {
                  const Icon = iconFor(m);
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => openItem(m)}
                        className="w-full text-left px-4 py-3 flex gap-3 border-b hover:bg-black/[0.02] transition-colors"
                        style={{ borderColor: 'var(--cp-border)', background: m.isRead ? 'transparent' : 'var(--cp-accent-soft)' }}
                      >
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: m.isRead ? 'var(--cp-accent-soft)' : 'var(--cp-surface)' }}
                        >
                          <Icon className="w-[18px] h-[18px] cp-accent-text" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm truncate flex-1" style={{ color: 'var(--cp-ink)' }}>
                              {m.subject || m.clinicName || 'Message'}
                            </span>
                            {!m.isRead && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--cp-accent)' }} />}
                          </div>
                          <p className="text-xs cp-muted line-clamp-2 mt-0.5">{m.body}</p>
                          <div className="text-[10px] cp-muted mt-1">
                            {[m.clinicName, relTime(m.sentAt)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {incoming.length > 0 && (
            <button
              className="px-4 py-3 text-center text-xs font-bold cp-accent-text border-t flex items-center justify-center gap-1 hover:opacity-70"
              style={{ borderColor: 'var(--cp-border)' }}
              onClick={() => { setOpen(false); navigate('/client/messages'); }}
            >
              Open messages <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
