/**
 * 250 — the login trail: who signed in, from where, and what failed.
 *
 * Two panels, in the order a human actually needs them:
 *   1. REPEAT FAILURES first, grouped by address. Four thousand rows is not a
 *      finding; "this address failed 60 times against 12 accounts last night"
 *      is. A raw feed buries that, so the grouping leads.
 *   2. The feed second, with a failures-only toggle.
 *
 * ⚠️ Every IP here is the VISITOR's, not Cloudflare's — see `utils/requestIp.ts`
 * on the backend. Sign-ins recorded before 250 live in `activity_logs` and hold
 * the PROXY's address; they are deliberately not shown here, because they would
 * look like the same kind of fact while being the wrong one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, RefreshCw, Loader2, Search, X, AlertTriangle, Globe, Monitor,
} from 'lucide-react';
import { loginEventsAPI, type LoginEvent, type SuspiciousOrigin } from '../../../services';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';

const OUTCOME: Record<string, { label: string; cls: string }> = {
  SUCCESS:      { label: 'Signed in',      cls: 'text-emerald-600 dark:text-emerald-400' },
  BAD_PASSWORD: { label: 'Wrong password', cls: 'text-rose-600 dark:text-rose-400' },
  NO_SUCH_USER: { label: 'No such account',cls: 'text-rose-600 dark:text-rose-400' },
  GOOGLE_ONLY:  { label: 'Google account', cls: 'text-amber-600 dark:text-amber-400' },
  SUSPENDED:    { label: 'Suspended',      cls: 'text-amber-600 dark:text-amber-400' },
};

/**
 * "Mozilla/5.0 (Macintosh; …) …Chrome/…" → "Chrome on macOS".
 *
 * Non-browser agents are named outright rather than guessed at. A sign-in from
 * `curl` or a script is the single most interesting row on this page, and
 * rendering it as "Browser on Unknown OS" actively hides that.
 */
const NON_BROWSER: Array<[RegExp, string]> = [
  [/^curl\//i, 'curl (command line)'],
  [/^wget/i, 'wget (command line)'],
  [/^PostmanRuntime/i, 'Postman'],
  [/^insomnia/i, 'Insomnia'],
  [/^python-requests|^aiohttp|^httpx/i, 'Python script'],
  [/^axios|^node-fetch|^undici|^got\//i, 'Node script'],
  [/^Go-http-client/i, 'Go client'],
  [/^okhttp|^Dart\//i, 'Mobile app client'],
  [/^Java\/|^Apache-HttpClient/i, 'Java client'],
  [/bot|crawler|spider/i, 'Bot / crawler'],
];

const device = (ua: string | null): string => {
  if (!ua) return 'Unknown device';
  for (const [re, label] of NON_BROWSER) if (re.test(ua)) return label;

  const os = /Windows/i.test(ua) ? 'Windows'
    : /Android/i.test(ua) ? 'Android'
    : /(iPhone|iPad|iOS)/i.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux' : 'Unknown OS';
  // Order matters: Edge and Opera both say "Chrome", and Chrome says "Safari".
  const browser = /Edg\//i.test(ua) ? 'Edge'
    : /OPR\//i.test(ua) ? 'Opera'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari' : 'Browser';
  // An unrecognised agent is not a browser we failed to name — say so.
  if (browser === 'Browser' && os === 'Unknown OS') return ua.split(/[\s/]/)[0].slice(0, 28) || 'Unknown device';
  return `${browser} on ${os}`;
};

/** "Nairobi, Kenya" when the city is known, else just the country. */
const place = (e: LoginEvent): string =>
  [e.city, e.countryName].filter(Boolean).join(', ') || 'Unknown';

const when = (iso: string) => new Date(iso).toLocaleString();

const LoginEventsPage: React.FC = () => {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [offenders, setOffenders] = useState<SuspiciousOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedOnly, setFailedOnly] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [f, s] = await Promise.all([
      loginEventsAPI.adminList({ limit: 200, failedOnly, email: q.trim() || undefined }),
      loginEventsAPI.adminSuspicious(24, 5),
    ]);
    if (f.success && f.data) setEvents(f.data.events);
    if (s.success && s.data) setOffenders(s.data.offenders);
    setLoading(false);
  }, [failedOnly, q]);

  // Debounced so typing an email does not fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { load(); }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <AdminPage>
      <AdminPageHeader
        icon={ShieldCheck}
        title="Sign-in activity"
        subtitle="Every login attempt — successful and failed — with the address and country it came from."
        actions={
          <button onClick={load} className="text-slate-400 hover:text-pine dark:hover:text-zinc-200">
            <RefreshCw size={14} />
          </button>
        }
      />

      {/* 1 — repeat failures, grouped. The finding, not the feed. */}
      {offenders.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 shadow-sm space-y-2">
          <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
            <AlertTriangle size={13} /> Repeat failures · last 24h
          </p>
          {offenders.map((o) => (
            <div key={o.ip} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
              <Globe size={13} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-pine dark:text-zinc-100 truncate font-mono">{o.ip}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-600">
                  {o.country ?? 'Unknown country'} · last {when(o.lastAt)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-rose-600 dark:text-rose-400">{o.failures} failed</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-600">
                  {o.accountsTargeted} account{o.accountsTargeted === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2 — the feed. */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by email…"
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg pl-8 pr-8 py-1.5 text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFailedOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${
              failedOnly
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400'
                : 'border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-200'
            }`}
          >
            Failures only
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
        ) : events.length === 0 ? (
          <p className="text-[11px] text-slate-400 dark:text-zinc-600 py-6 text-center">
            Nothing recorded yet. The trail starts from the deploy that added it — earlier sign-ins
            were logged with the proxy's address, not the visitor's, so they are not shown here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">
                  <th className="px-2 py-1.5">Who</th>
                  <th className="px-2 py-1.5">Result</th>
                  <th className="px-2 py-1.5">From</th>
                  <th className="px-2 py-1.5">Device</th>
                  <th className="px-2 py-1.5">When</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const o = OUTCOME[e.outcome] ?? { label: e.outcome, cls: 'text-slate-400' };
                  return (
                    <tr key={e.id} className="border-t border-slate-100 dark:border-zinc-800/60">
                      <td className="px-2 py-2">
                        <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate max-w-[220px]">
                          {e.user?.name || e.email}
                        </p>
                        {e.user?.name && (
                          <p className="text-[10px] text-slate-400 dark:text-zinc-600 truncate max-w-[220px]">{e.email}</p>
                        )}
                      </td>
                      <td className={`px-2 py-2 text-[10px] font-black uppercase tracking-wider ${o.cls}`}>{o.label}</td>
                      <td className="px-2 py-2">
                        <p className="text-[11px] font-mono text-slate-600 dark:text-zinc-300">{e.ipAddress ?? '—'}</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-600">{place(e)}</p>
                      </td>
                      <td className="px-2 py-2 text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        <Monitor size={11} className="inline mr-1 text-slate-400" />{device(e.userAgent)}
                      </td>
                      <td className="px-2 py-2 text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">{when(e.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPage>
  );
};

export default LoginEventsPage;
