import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Mail, Send, Users, History, AlertCircle, CheckCircle2, Loader2, Filter, ChevronDown,
  RotateCcw, MessageCircle, Monitor, Syringe, Bug, Wallet, PawPrint, Activity,
} from 'lucide-react';
import ManagingSwitcher from '../../shared/common/ManagingSwitcher';
import {
  broadcastsAPI, Broadcast, SegmentFilter, SegmentBreakdown, BroadcastChannel, toast,
} from '../../../services';
import { CLIENT_TYPES } from '../../../constants';

// Common pet species for the "owner of…" filter. Matched case-insensitively
// server-side, so "Dog" also catches "dog".
const SPECIES: { v: string; e: string }[] = [
  { v: 'Dog', e: '🐶' }, { v: 'Cat', e: '🐱' }, { v: 'Horse', e: '🐴' },
  { v: 'Rabbit', e: '🐰' }, { v: 'Bird', e: '🐦' }, { v: 'Reptile', e: '🦎' },
  { v: 'Rodent', e: '🐹' }, { v: 'Cattle', e: '🐄' }, { v: 'Goat', e: '🐐' },
  { v: 'Sheep', e: '🐑' }, { v: 'Poultry', e: '🐔' }, { v: 'Fish', e: '🐠' },
];

const CHANNELS: { v: BroadcastChannel; label: string; icon: React.ReactNode; note?: string }[] = [
  { v: 'email', label: 'Email', icon: <Mail size={13} /> },
  { v: 'portal', label: 'Client Portal', icon: <Monitor size={13} /> },
  { v: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={13} />, note: 'queued' },
];

const EMPTY: SegmentFilter = { activity: 'all', portal: 'any' };

// Whether a filter carries any real constraint (drives the "N active" badge).
const isFilterActive = (f: SegmentFilter): boolean =>
  !!(f.species?.length || (f.activity && f.activity !== 'all') || (f.portal && f.portal !== 'any') ||
    f.clientTypes?.length || f.vaccine || f.deworming ||
    typeof f.debtMin === 'number' || typeof f.debtMax === 'number');

// A collapsible filter group. `active` lights the header when the group is set.
const Section: React.FC<{
  title: string; icon: React.ReactNode; active?: boolean; defaultOpen?: boolean; children: React.ReactNode;
}> = ({ title, icon, active, defaultOpen, children }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className={active ? 'text-seafoam' : 'text-slate-400 dark:text-zinc-500'}>{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 flex-1">{title}</span>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-seafoam" />}
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1">{children}</div>}
    </div>
  );
};

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
      on
        ? 'bg-seafoam text-white border-seafoam shadow-sm shadow-seafoam/20'
        : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-seafoam/50'
    }`}
  >
    {children}
  </button>
);

// A had/due + date-range sub-filter shared by vaccination and deworming.
const DueHadFilter: React.FC<{
  value?: { mode: 'had' | 'due'; from?: string; to?: string };
  onChange: (v: { mode: 'had' | 'due'; from?: string; to?: string } | undefined) => void;
}> = ({ value, onChange }) => (
  <div className="space-y-2.5">
    <div className="flex gap-2">
      <Chip on={!value} onClick={() => onChange(undefined)}>Any</Chip>
      <Chip on={value?.mode === 'had'} onClick={() => onChange({ mode: 'had', from: value?.from, to: value?.to })}>Already had</Chip>
      <Chip on={value?.mode === 'due'} onClick={() => onChange({ mode: 'due', from: value?.from, to: value?.to })}>Due / upcoming</Chip>
    </div>
    {value && (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">From</label>
          <input type="date" className="field-input !py-2 !text-xs" value={value.from || ''}
            onChange={(e) => onChange({ ...value, from: e.target.value || undefined })} />
        </div>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">To</label>
          <input type="date" className="field-input !py-2 !text-xs" value={value.to || ''}
            onChange={(e) => onChange({ ...value, to: e.target.value || undefined })} />
        </div>
      </div>
    )}
    {value?.mode === 'due' && (
      <p className="text-[10px] text-slate-400 dark:text-zinc-500">Pets with a pending reminder due in this window. Leave dates blank for all upcoming.</p>
    )}
  </div>
);

// Admin broadcast composer — filter clients into a precise segment, preview how
// many match (per channel), then send by email / client portal / WhatsApp.
const BroadcastView: React.FC = () => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState<SegmentFilter>(EMPTY);
  const [channels, setChannels] = useState<BroadcastChannel[]>(['email']);

  const [breakdown, setBreakdown] = useState<SegmentBreakdown | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const patch = useCallback((p: Partial<SegmentFilter>) => setFilter((f) => ({ ...f, ...p })), []);
  const toggleIn = (arr: string[] | undefined, v: string): string[] => {
    const set = new Set(arr || []);
    set.has(v) ? set.delete(v) : set.add(v);
    return Array.from(set);
  };

  const filterKey = useMemo(() => JSON.stringify(filter), [filter]);

  // Live, debounced count as the filter changes — count-first before composing.
  useEffect(() => {
    let cancelled = false;
    setCountLoading(true);
    const t = setTimeout(() => {
      broadcastsAPI
        .segmentCount(filter)
        .then((res) => { if (!cancelled) setBreakdown(res.data ?? { total: 0, email: 0, portal: 0, whatsapp: 0 }); })
        .catch(() => { if (!cancelled) setBreakdown({ total: 0, email: 0, portal: 0, whatsapp: 0 }); })
        .finally(() => { if (!cancelled) setCountLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(() => {
    broadcastsAPI.list({ showError: false })
      .then((res) => setHistory(res.data?.broadcasts ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const total = breakdown?.total ?? 0;
  // Recipients reachable across the selected channels (max per-channel reach).
  const reach = useMemo(() => {
    if (!breakdown) return 0;
    return channels.reduce((m, c) => Math.max(m, breakdown[c] ?? 0), 0);
  }, [breakdown, channels]);

  const toggleChannel = (c: BroadcastChannel) =>
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && channels.length > 0 && reach > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    const chLabel = channels.map((c) => CHANNELS.find((x) => x.v === c)?.label).join(', ');
    if (!window.confirm(`Send this message to up to ${reach} client(s) via ${chLabel}? This cannot be undone.`)) return;

    setSending(true);
    try {
      const res = await broadcastsAPI.segmentSend({ subject: subject.trim(), body: body.trim(), filter, channels });
      const r = res.data?.results;
      const parts: string[] = [];
      if (r?.email) parts.push(`${r.email.sent} emailed${r.email.failed ? `, ${r.email.failed} failed` : ''}`);
      if (r?.portal?.sent) parts.push(`${r.portal.sent} to portal`);
      if (r?.whatsapp?.queued) parts.push(`${r.whatsapp.queued} WhatsApp queued`);
      toast.success(parts.length ? parts.join(' · ') : 'Broadcast sent');
      setSubject(''); setBody('');
      loadHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
  const active = isFilterActive(filter);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="mb-4"><ManagingSwitcher kind="clinic" /></div>
      <header className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center">
          <Mail size={20} className="text-seafoam" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Broadcasts</h1>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">Target the right clients &amp; message them anywhere</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* ---- Filters ---- */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-seafoam" />
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audience filters</h2>
            </div>
            {active && (
              <button onClick={() => setFilter(EMPTY)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>

          <Section title="Pet type" icon={<PawPrint size={15} />} active={!!filter.species?.length} defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {SPECIES.map((s) => (
                <Chip key={s.v} on={!!filter.species?.includes(s.v)} onClick={() => patch({ species: toggleIn(filter.species, s.v) })}>
                  {s.e} {s.v}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Activity" icon={<Activity size={15} />} active={filter.activity !== 'all'}>
            <div className="flex gap-2 mb-2">
              {(['all', 'active', 'dormant'] as const).map((a) => (
                <Chip key={a} on={(filter.activity || 'all') === a} onClick={() => patch({ activity: a })}>
                  {a === 'all' ? 'All' : a === 'active' ? 'Active' : 'Dormant'}
                </Chip>
              ))}
            </div>
            {filter.activity && filter.activity !== 'all' && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                <span>{filter.activity === 'active' ? 'Visited within' : 'No visit for'}</span>
                <input type="number" min={1} className="field-input !py-1.5 !w-20 !text-xs"
                  value={filter.dormantDays ?? 180}
                  onChange={(e) => patch({ dormantDays: Number(e.target.value) || undefined })} />
                <span>days</span>
              </div>
            )}
          </Section>

          <Section title="Client portal" icon={<Monitor size={15} />} active={!!filter.portal && filter.portal !== 'any'}>
            <div className="flex flex-wrap gap-2">
              {([['any', 'Any'], ['with', 'Has portal'], ['without', 'No portal'], ['active', 'Active portal']] as const).map(([v, l]) => (
                <Chip key={v} on={(filter.portal || 'any') === v} onClick={() => patch({ portal: v })}>{l}</Chip>
              ))}
            </div>
          </Section>

          <Section title="Value tier" icon={<Users size={15} />} active={!!filter.clientTypes?.length}>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_TYPES.map((t) => (
                <Chip key={t.value} on={!!filter.clientTypes?.includes(t.value)} onClick={() => patch({ clientTypes: toggleIn(filter.clientTypes, t.value) })}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Vaccination" icon={<Syringe size={15} />} active={!!filter.vaccine}>
            <DueHadFilter value={filter.vaccine} onChange={(v) => patch({ vaccine: v })} />
          </Section>

          <Section title="Deworming" icon={<Bug size={15} />} active={!!filter.deworming}>
            <DueHadFilter value={filter.deworming} onChange={(v) => patch({ deworming: v })} />
          </Section>

          <Section title="Outstanding debt" icon={<Wallet size={15} />} active={typeof filter.debtMin === 'number' || typeof filter.debtMax === 'number'}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Min (KES)</label>
                <input type="number" min={0} placeholder="0" className="field-input !py-2 !text-xs"
                  value={filter.debtMin ?? ''} onChange={(e) => patch({ debtMin: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Max (KES)</label>
                <input type="number" min={0} placeholder="Any" className="field-input !py-2 !text-xs"
                  value={filter.debtMax ?? ''} onChange={(e) => patch({ debtMax: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </div>
            </div>
          </Section>
        </div>

        {/* ---- Compose + send ---- */}
        <div className="lg:col-span-8 space-y-5">
          {/* Live count */}
          <div className="bg-gradient-to-br from-seafoam/10 to-transparent border border-seafoam/20 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-seafoam mb-1">Clients matched</p>
                {countLoading ? (
                  <p className="text-3xl font-black text-pine dark:text-zinc-100 flex items-center gap-2"><Loader2 size={22} className="animate-spin text-seafoam" /></p>
                ) : (
                  <p className="text-3xl font-black text-pine dark:text-zinc-100">{total}</p>
                )}
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{active ? 'match the current filters' : 'all clients (no filters set)'}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {CHANNELS.map((c) => (
                  <span key={c.v} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                    <span className="text-seafoam">{c.icon}</span>
                    <span className="font-black text-pine dark:text-zinc-200 tabular-nums w-8 text-right">{breakdown?.[c.v] ?? 0}</span>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 space-y-5">
            {/* Channels */}
            <div>
              <label className="field-label">Send via</label>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => {
                  const on = channels.includes(c.v);
                  return (
                    <button key={c.v} type="button" onClick={() => toggleChannel(c.v)}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12px] font-black border transition-all active:scale-95 ${
                        on ? 'bg-seafoam text-white border-seafoam shadow-sm shadow-seafoam/20'
                           : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-seafoam/50'
                      }`}>
                      {c.icon} {c.label}
                      {on && <span className="tabular-nums opacity-90">· {breakdown?.[c.v] ?? 0}</span>}
                      {c.note && <span className={`text-[8px] uppercase px-1 py-0.5 rounded ${on ? 'bg-white/20' : 'bg-amber-500/10 text-amber-500'}`}>{c.note}</span>}
                    </button>
                  );
                })}
              </div>
              {channels.includes('whatsapp') && (
                <p className="field-help mt-1.5 text-amber-600 dark:text-amber-400">WhatsApp messages are queued — delivery goes out once the WhatsApp sender is connected.</p>
              )}
            </div>

            <div>
              <label className="field-label">Subject</label>
              <input className="field-input" type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Vaccination reminder this month" maxLength={200} />
            </div>

            <div>
              <label className="field-label">Message</label>
              <textarea className="field-textarea" rows={9} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder={'Write your message here.\n\nBlank lines become paragraphs. Emails get an unsubscribe link automatically.'} />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                <AlertCircle size={12} /> Email skips anyone who unsubscribed.
              </p>
              <button onClick={handleSend} disabled={!canSend}
                className="bg-seafoam hover:bg-[#357066] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-seafoam/20 transition-all active:scale-95 flex items-center gap-2 shrink-0">
                {sending ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send to {reach}</>}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <History size={14} className="text-seafoam" />
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Broadcasts</h2>
            </div>
            {history.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-zinc-600 italic">No broadcasts sent yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((b) => (
                  <li key={b.id} className="border border-slate-100 dark:border-zinc-800 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-pine dark:text-zinc-100 truncate flex-1">{b.subject || '(no subject)'}</p>
                      <span className="text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.5 rounded-md">{b.channel}</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{fmtDate(b.createdAt)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md">
                        <CheckCircle2 size={9} /> {b.sentCount} sent
                      </span>
                      {b.failedCount > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-md">{b.failedCount} failed</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastView;
