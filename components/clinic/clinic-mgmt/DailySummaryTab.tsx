import React from 'react';
import {
  MailCheck, Loader2, Clock, Users, Send, AlertTriangle, CheckCircle2, RefreshCw, CalendarDays, Sunrise,
} from 'lucide-react';
import { digestAPI, type DigestSettings, type DigestData, type DigestRow } from '../../../services/modules/digest.api';
import { toast } from '../../../services';

/**
 * DAILY SUMMARY — one email per clinic, each evening.
 *
 * Today's half is a close-out: what is still open, which reminders nobody
 * actioned. Tomorrow's half is a stand-up: who is booked, who goes home, what
 * falls due.
 *
 * ⚠️ The hour is in the CLINIC'S timezone, not the browser's. Whoever is
 * reading this screen may not be in the same country as the clinic, so the zone
 * is printed beside the control rather than assumed.
 *
 * ⚠️ Recipients are DERIVED — the clinic address, the owner and the branch
 * manager — and shown read-only. An editable list here would quietly become a
 * mailing list, and this is a management read-out of a whole clinic's day.
 */

const LABEL = 'text-[9px] font-black text-seafoam uppercase tracking-widest px-0.5';

const hourLabel = (h: number) => {
  const suffix = h < 12 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${String(h).padStart(2, '0')}:00 · ${twelve}${suffix}`;
};

const dayLabel = (key: string) => {
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

const Tile: React.FC<{ value: number; label: string; tone?: 'neutral' | 'good' | 'warn' }> = ({ value, label, tone = 'neutral' }) => (
  <div className={`rounded-xl px-2.5 py-2 text-center ${
    tone === 'warn'
      ? 'bg-amber-50 dark:bg-amber-950/30'
      : tone === 'good'
        ? 'bg-seafoam/10 dark:bg-seafoam/15'
        : 'bg-slate-50 dark:bg-zinc-800/60'
  }`}>
    <p className={`text-lg font-black leading-none ${
      tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : tone === 'good' ? 'text-seafoam' : 'text-pine dark:text-zinc-100'
    }`}>{value}</p>
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mt-1">{label}</p>
  </div>
);

const RowList: React.FC<{ rows: DigestRow[]; total: number; empty: string }> = ({ rows, total, empty }) => {
  if (!rows.length) return <p className="text-[11px] font-semibold italic text-slate-400 dark:text-zinc-600">{empty}</p>;
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2 text-[11px]">
          <span className="font-black text-seafoam w-10 shrink-0">{r.time || '—'}</span>
          <span className="min-w-0">
            <span className="font-bold text-pine dark:text-zinc-100">{r.pet}</span>
            <span className="text-slate-400 dark:text-zinc-500"> · {r.client}</span>
            <span className="block text-[10px] font-semibold text-slate-400 dark:text-zinc-500">{r.detail}</span>
          </span>
        </div>
      ))}
      {/* Say what was left out. A list that silently stops under-reports the day. */}
      {total > rows.length && (
        <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-600">+ {total - rows.length} more in the email</p>
      )}
    </div>
  );
};

const DailySummaryTab: React.FC = () => {
  const [cfg, setCfg] = React.useState<DigestSettings | null>(null);
  const [data, setData] = React.useState<DigestData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadPreview = React.useCallback((silent = false) => {
    if (!silent) setRefreshing(true);
    digestAPI.preview()
      .then((r) => { if (r?.data) setData(r.data); })
      .catch(() => { /* preview is a nicety — the settings above still work */ })
      .finally(() => setRefreshing(false));
  }, []);

  React.useEffect(() => {
    setLoading(true);
    digestAPI.getSettings()
      .then((r) => { if (r?.data) setCfg(r.data); })
      .catch(() => toast.error('Could not load the daily summary settings'))
      .finally(() => setLoading(false));
    loadPreview(true);
  }, [loadPreview]);

  const save = async (patch: { enabled?: boolean; hour?: number; recipientIds?: string[] }) => {
    setSaving(true);
    try {
      const r = await digestAPI.saveSettings(patch);
      if (r?.data) setCfg(r.data);
      if (patch.enabled !== undefined) toast.success(patch.enabled ? 'Daily summary on' : 'Daily summary off');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Ticking saves immediately, like the hour control — this panel has no Save
   * of its own, and a checkbox that silently needs a button pressed elsewhere
   * is a setting people believe they changed.
   */
  const toggleRecipient = async (id: string) => {
    if (!cfg) return;
    const next = cfg.staff.some((p) => p.id === id && p.selected)
      ? cfg.staff.filter((p) => p.selected && p.id !== id).map((p) => p.id)
      : [...cfg.staff.filter((p) => p.selected).map((p) => p.id), id];
    await save({ recipientIds: next });
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await digestAPI.sendTest();
      if (r?.data?.sent) toast.success('Sent — check your own inbox');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-8 flex items-center justify-center">
        <Loader2 size={18} className="animate-spin text-seafoam" />
      </div>
    );
  }
  if (!cfg) return null;

  const noRecipients = cfg.recipients.length === 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <MailCheck size={16} className="text-seafoam" />
        <div className="min-w-0">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">Daily summary email</h3>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
            One email each evening: how today closed, and what tomorrow holds.
          </p>
        </div>
      </div>

      {/* ── The switch ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-pine dark:text-zinc-100">
              {cfg.enabled ? 'Sending every evening' : 'Not sending'}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
              Today&rsquo;s visits, appointments and reminders, then tomorrow&rsquo;s expected
              checkouts, bookings and reminders due. Nothing is sent to clients — this goes to the
              clinic only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => save({ enabled: !cfg.enabled })}
            disabled={saving}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-40 ${
              cfg.enabled
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
            }`}
          >
            {cfg.enabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={LABEL}><Clock size={9} className="inline mb-0.5 mr-1" />Send at</label>
            <select
              value={cfg.hour}
              onChange={(e) => save({ hour: Number(e.target.value) })}
              disabled={saving}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/25"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
            {/* The zone is the clinic's, and whoever reads this may not be in it. */}
            <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
              {cfg.timezone.replace('_', ' ')} — the clinic&rsquo;s own time, not yours
            </p>
          </div>

          <div className="space-y-1">
            <label className={LABEL}><Users size={9} className="inline mb-0.5 mr-1" />Goes to</label>
            <div className="rounded-lg border border-slate-200 dark:border-zinc-700 divide-y divide-slate-100 dark:divide-zinc-800 max-h-44 overflow-y-auto">
              {/* The owner is fixed. Letting them untick themselves is how a
                  clinic ends up with the summary on and nobody receiving it. */}
              {cfg.owner && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800/50">
                  <CheckCircle2 size={13} className="shrink-0 text-seafoam" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{cfg.owner.name}</span>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 truncate">{cfg.owner.email}</span>
                  </span>
                  <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-seafoam">Owner</span>
                </div>
              )}
              {cfg.staff.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                  <input
                    type="checkbox"
                    checked={p.selected}
                    disabled={saving}
                    onChange={() => toggleRecipient(p.id)}
                    className="shrink-0 accent-seafoam"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{p.name}</span>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 truncate">{p.email}</span>
                  </span>
                  <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">
                    {p.role.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
              {!cfg.owner && cfg.staff.length === 0 && (
                <p className="px-2.5 py-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Nobody at this clinic has an email address on file.
                </p>
              )}
            </div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
              The owner always receives it. Tick anyone else who should.
              {/* Someone with no address is not shown at all — a tick box that
                  can never deliver is worse than an absence. */}
            </p>
          </div>
        </div>

        {cfg.enabled && noRecipients && (
          <p className="flex items-start gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Switched on, but there is no address to send to. Add a clinic email under Branding.
          </p>
        )}
        {!cfg.emailConfigured && (
          <p className="flex items-start gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Email is not configured on this server, so nothing will actually send.
          </p>
        )}
        {cfg.lastSentOn && (
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={12} /> Last sent for {dayLabel(cfg.lastSentOn)}
          </p>
        )}

        <button
          type="button"
          onClick={sendTest}
          disabled={testing || !cfg.emailConfigured}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 hover:border-seafoam disabled:opacity-40"
        >
          {testing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Send me a test
        </button>
        <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
          Goes to your own address only, and does not use up today&rsquo;s send.
        </p>
      </div>

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      {data && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-pine dark:text-zinc-100">What tonight&rsquo;s email would say</p>
            <button
              type="button"
              onClick={() => loadPreview()}
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
              <CalendarDays size={10} className="inline mb-0.5 mr-1" />Today · {dayLabel(data.today)}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <Tile value={data.recap.visitsTotal} label="Visits" />
              <Tile value={data.recap.completed} label="Done" tone="good" />
              <Tile value={data.recap.inProgress} label="Open" tone={data.recap.inProgress ? 'warn' : 'neutral'} />
              <Tile value={data.recap.awaitingPayment} label="To pay" tone={data.recap.awaitingPayment ? 'warn' : 'neutral'} />
              <Tile value={data.recap.neverArrived} label="No-show" />
              <Tile value={data.recap.remindersMissed} label="Rem. left" tone={data.recap.remindersMissed ? 'warn' : 'neutral'} />
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className={LABEL}>Visits still open</p>
                <RowList rows={data.recap.openVisits} total={data.recap.inProgress + data.recap.awaitingPayment} empty="Every visit closed out." />
              </div>
              <div>
                <p className={LABEL}>Reminders not actioned</p>
                <RowList rows={data.recap.missedReminders} total={data.recap.remindersMissed} empty="Nothing left hanging." />
              </div>
            </div>
            {data.overdueReminders > 0 && (
              <p className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {data.overdueReminders} reminder{data.overdueReminders === 1 ? '' : 's'} overdue from before today.
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-zinc-800 pt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
              <Sunrise size={10} className="inline mb-0.5 mr-1" />Tomorrow · {dayLabel(data.tomorrow)}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              <Tile value={data.outlook.appointments} label="Appts" />
              <Tile value={data.outlook.scheduledVisits} label="Booked" />
              <Tile value={data.outlook.checkouts} label="Going home" />
              <Tile value={data.outlook.staying} label="In overnight" />
              <Tile value={data.outlook.remindersDue} label="Rem. due" />
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className={LABEL}>Expected checkouts</p>
                <RowList rows={data.outlook.checkoutRows} total={data.outlook.checkouts} empty="Nobody due home." />
              </div>
              <div>
                <p className={LABEL}>Appointments</p>
                <RowList rows={data.outlook.appointmentRows} total={data.outlook.appointments} empty="None booked yet." />
              </div>
              <div>
                <p className={LABEL}>Reminders due</p>
                <RowList rows={data.outlook.reminderRows} total={data.outlook.remindersDue} empty="None fall due." />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySummaryTab;
