import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Package2, RefreshCw, Search, Ban, Plus } from 'lucide-react';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { toast } from '../../../services/utils/toast';
import { featureCopy } from '../../../services/entitlements';
import {
  entitlementGrantsAPI,
  type EntitlementGrant,
  type GrantSubjectKind,
  type GrantSource,
} from '../../../services/modules/entitlementGrants.api';
import { bundleRulesAPI, type BundleRule } from '../../../services/modules/bundleRules.api';

/**
 * 284 + 285 — the admin surface for entitlements that did NOT come from a plan.
 *
 * Both were API-only until now, which meant in practice only an engineer could
 * issue one. Two panels, because they are two genuinely different jobs:
 *
 *  • GRANTS   — one account, one key, right now. The surgical alternative to
 *               extending a trial, which hands over the entire platform.
 *  • BUNDLES  — a standing rule that mints those grants for whoever qualifies.
 *
 * The list of feature keys deliberately comes from `featureCopy()` (the module
 * catalogue, migration 280) rather than a hardcoded array here — that is the
 * whole point of having given modules a home.
 */

const SUBJECT_KINDS: GrantSubjectKind[] = ['CLINIC', 'SUPPLIER', 'CLIENT'];
const SOURCES: GrantSource[] = ['ADMIN', 'PROMO', 'COMPENSATION', 'PILOT'];
const AUDIENCES = ['', 'CLINIC', 'SUPPLIER', 'CLIENT', 'LIVESTOCK'];

const input =
  'w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 ' +
  'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 focus:outline-none ' +
  'focus:ring-2 focus:ring-emerald-500/40';
const label = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1';
const card = 'rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4';
const btn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

/** Keys split into comma/space/newline separated tokens, blanks dropped. */
const parseKeys = (s: string): string[] =>
  s.split(/[\s,]+/).map((k) => k.trim()).filter(Boolean);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label: l, hint, children, className = '',
}) => (
  <div className={className}>
    <span className={label}>{l}</span>
    {children}
    {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

const KeyChip: React.FC<{ k: string }> = ({ k }) => (
  <span
    title={k}
    className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono text-slate-600 dark:text-zinc-300"
  >
    {featureCopy(k).label}
  </span>
);

const GrantsAndBundlesAdminPage: React.FC = () => {
  // ── Grants panel ─────────────────────────────────────────────────────────
  const [kind, setKind] = useState<GrantSubjectKind>('CLINIC');
  const [subjectId, setSubjectId] = useState('');
  const [grants, setGrants] = useState<EntitlementGrant[] | null>(null);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [draft, setDraft] = useState({ featureKey: '', source: 'ADMIN' as GrantSource, days: '', reason: '' });

  const lookup = useCallback(async () => {
    if (!subjectId.trim()) return;
    setLoadingGrants(true);
    try {
      const r = await entitlementGrantsAPI.listForSubject(kind, subjectId.trim());
      setGrants(r.success && r.data ? r.data.grants : []);
    } catch {
      toast.error('Could not load grants for that account');
      setGrants([]);
    } finally {
      setLoadingGrants(false);
    }
  }, [kind, subjectId]);

  const issue = async () => {
    if (!subjectId.trim()) return toast.error('Enter an account id first');
    const keys = parseKeys(draft.featureKey);
    if (keys.length === 0) return toast.error('Enter at least one feature key');
    if (!draft.reason.trim()) return toast.error('A reason is required — it is what makes this explainable later');

    // One request per key: the API grants exactly one key per row on purpose,
    // so a grant can be revoked and explained one entitlement at a time.
    let ok = 0;
    for (const featureKey of keys) {
      try {
        const r = await entitlementGrantsAPI.create({
          subjectKind: kind,
          subjectId: subjectId.trim(),
          featureKey,
          source: draft.source,
          days: draft.days ? Number(draft.days) : null,
          reason: draft.reason.trim(),
        });
        if (r.success) ok += 1;
        else toast.error(`${featureKey}: ${r.message ?? 'refused'}`);
      } catch (e: any) {
        toast.error(`${featureKey}: ${e?.message ?? 'refused'}`);
      }
    }
    if (ok) {
      toast.success(`Granted ${ok} ${ok === 1 ? 'entitlement' : 'entitlements'}`);
      setDraft({ featureKey: '', source: 'ADMIN', days: '', reason: '' });
      lookup();
    }
  };

  const revoke = async (g: EntitlementGrant) => {
    try {
      const r = await entitlementGrantsAPI.revoke(g.id);
      if (r.success) { toast.success(`Revoked ${featureCopy(g.featureKey).label}`); lookup(); }
      else toast.error(r.message ?? 'Could not revoke');
    } catch { toast.error('Could not revoke'); }
  };

  // ── Bundles panel ────────────────────────────────────────────────────────
  const [rules, setRules] = useState<BundleRule[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [rule, setRule] = useState({
    label: '', audience: '', whenAllOf: '', whenMinTier: '0', thenGrant: '', durationDays: '', notes: '',
  });

  const loadRules = useCallback(async () => {
    try {
      const r = await bundleRulesAPI.list();
      setRules(r.success && r.data ? r.data.rules : []);
    } catch { setRules([]); }
  }, []);
  useEffect(() => { loadRules(); }, [loadRules]);

  const createRule = async () => {
    const grant = parseKeys(rule.thenGrant);
    if (!rule.label.trim()) return toast.error('A label is required — the customer sees it');
    if (grant.length === 0) return toast.error('Name at least one key to grant');
    const cond = parseKeys(rule.whenAllOf);
    const floor = Number(rule.whenMinTier || 0);
    // Mirror the server guard so the confirmation happens BEFORE the request,
    // rather than as a 400 the admin has to interpret.
    if (cond.length === 0 && floor === 0) {
      const ok = window.confirm(
        'This rule has no condition and no tier floor, so it will fire for EVERY account in its audience. Create it anyway?',
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await bundleRulesAPI.create({
        label: rule.label.trim(),
        notes: rule.notes.trim() || null,
        audience: rule.audience || null,
        whenAllOf: cond,
        whenMinTier: floor,
        thenGrant: grant,
        durationDays: rule.durationDays ? Number(rule.durationDays) : null,
        allowUnconditional: cond.length === 0 && floor === 0,
      } as any);
      if (r.success) {
        toast.success('Bundle rule created');
        setRule({ label: '', audience: '', whenAllOf: '', whenMinTier: '0', thenGrant: '', durationDays: '', notes: '' });
        loadRules();
      } else toast.error(r.message ?? 'Refused');
    } catch (e: any) { toast.error(e?.message ?? 'Refused'); }
    finally { setBusy(false); }
  };

  const toggleRule = async (r: BundleRule) => {
    try {
      const res = await bundleRulesAPI.update(r.id, { isActive: !r.isActive });
      if (res.success) {
        toast.success(r.isActive ? 'Rule deactivated' : 'Rule activated');
        loadRules();
      } else toast.error(res.message ?? 'Could not update');
    } catch { toast.error('Could not update'); }
  };

  const runReconcile = async () => {
    setBusy(true);
    try {
      const r = await bundleRulesAPI.reconcile();
      const res = r.data?.result;
      toast.success(
        `Reconciled ${res?.scanned ?? 0} accounts — ${res?.granted ?? 0} granted, ${res?.revoked ?? 0} revoked`,
      );
      if (subjectId.trim()) lookup();
    } catch { toast.error('Reconcile failed'); }
    finally { setBusy(false); }
  };

  const liveGrants = useMemo(() => (grants ?? []).filter((g) => g.isLive), [grants]);
  const pastGrants = useMemo(() => (grants ?? []).filter((g) => !g.isLive), [grants]);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Grants & Bundles"
        subtitle="Entitlements that did not come from a plan — issued directly, or minted by a rule."
        icon={Gift}
        actions={
          <button onClick={runReconcile} disabled={busy} className={`${btn} bg-pine text-white hover:opacity-90`}>
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Run reconcile
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── GRANTS ─────────────────────────────────────────────────────── */}
        <section className={card}>
          <h2 className="flex items-center gap-2 font-black text-pine dark:text-zinc-100 mb-1">
            <Gift size={15} /> Grant to one account
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
            The surgical alternative to extending a trial &mdash; that grants everything.
            One key at a time, always with a reason, always revocable.
          </p>

          <div className="grid grid-cols-[7rem_1fr_auto] gap-2 items-end mb-4">
            <Field label="Account type">
              <select value={kind} onChange={(e) => setKind(e.target.value as GrantSubjectKind)} className={input}>
                {SUBJECT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Account id">
              <input
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="e.g. 2"
                className={input}
              />
            </Field>
            <button onClick={lookup} disabled={!subjectId.trim()} className={`${btn} bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200`}>
              <Search size={13} /> Look up
            </button>
          </div>

          {loadingGrants && <LoadingSpinner />}

          {grants !== null && !loadingGrants && (
            <div className="space-y-3 mb-5">
              <div>
                <p className={label}>Live now ({liveGrants.length})</p>
                {liveGrants.length === 0 ? (
                  <p className="text-xs text-slate-400">No active grants on this account.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {liveGrants.map((g) => (
                      <li key={g.id} className="flex items-start gap-2 text-xs border border-slate-100 dark:border-zinc-800 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <KeyChip k={g.featureKey} />
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{g.source}</span>
                            {g.endsAt
                              ? <span className="text-[10px] text-amber-600">until {String(g.endsAt).slice(0, 10)}</span>
                              : <span className="text-[10px] text-slate-400">open-ended</span>}
                          </div>
                          <p className="text-slate-500 dark:text-zinc-400 mt-0.5 truncate" title={g.reason}>{g.reason}</p>
                        </div>
                        <button onClick={() => revoke(g)} className="shrink-0 text-rose-500 hover:text-rose-600" title="Revoke">
                          <Ban size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {pastGrants.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Expired or revoked ({pastGrants.length})
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {pastGrants.map((g) => (
                      <li key={g.id} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <KeyChip k={g.featureKey} />
                        <span>{g.revokedAt ? 'revoked' : 'expired'}</span>
                        <span className="truncate">· {g.reason}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-2">
            <Field label="Feature keys" hint="One or more, comma or space separated.">
              <input value={draft.featureKey} onChange={(e) => setDraft({ ...draft, featureKey: e.target.value })}
                placeholder="view:boarding, view:imaging" className={`${input} font-mono`} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Source">
                <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as GrantSource })} className={input}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Days" hint="Blank = until revoked.">
                <input type="number" min={1} value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })}
                  placeholder="30" className={input} />
              </Field>
            </div>
            <Field label="Reason" hint="Required. This is what a colleague reads in six months.">
              <input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                placeholder="Goodwill after the March outage" className={input} />
            </Field>
            <button onClick={issue} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700 w-full justify-center`}>
              <Plus size={13} /> Issue grant
            </button>
          </div>
        </section>

        {/* ── BUNDLES ────────────────────────────────────────────────────── */}
        <section className={card}>
          <h2 className="flex items-center gap-2 font-black text-pine dark:text-zinc-100 mb-1">
            <Package2 size={15} /> Bundle rules
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
            &ldquo;Buy these, get that free.&rdquo; A rule mints grants for whoever qualifies and
            revokes them when they stop &mdash; the condition is <em>all of these keys held</em>,
            plus an optional tier floor. Nothing more expressive, on purpose.
          </p>

          {rules === null ? <LoadingSpinner /> : rules.length === 0 ? (
            <p className="text-xs text-slate-400 mb-4">No rules yet.</p>
          ) : (
            <ul className="space-y-2 mb-5">
              {rules.map((r) => (
                <li key={r.id} className="border border-slate-100 dark:border-zinc-800 rounded-lg p-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-zinc-100 truncate">{r.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {r.audience ?? 'any audience'}
                        {r.whenMinTier > 0 && ` · tier ≥ ${r.whenMinTier}`}
                        {r.durationDays ? ` · ${r.durationDays} days` : ' · while held'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleRule(r)}
                      className={`${btn} shrink-0 ${r.isActive
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-slate-200 dark:bg-zinc-700 text-slate-500'}`}
                    >
                      {r.isActive ? 'Live' : 'Off'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {r.whenAllOf.length === 0
                      ? <span className="text-[10px] text-amber-600 font-bold">fires for everyone</span>
                      : r.whenAllOf.map((k) => <KeyChip key={k} k={k} />)}
                    <span className="text-slate-400 text-[11px] px-0.5">&rarr;</span>
                    {r.thenGrant.map((k) => <KeyChip key={k} k={k} />)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-2">
            <Field label="Label" hint="Shown to the customer as the reason they have it.">
              <input value={rule.label} onChange={(e) => setRule({ ...rule, label: e.target.value })}
                placeholder="Included with your Farms + Pharmacy bundle" className={input} />
            </Field>
            <Field label="When the account holds ALL of" hint="Blank + tier 0 means every account in the audience.">
              <input value={rule.whenAllOf} onChange={(e) => setRule({ ...rule, whenAllOf: e.target.value })}
                placeholder="livestock:farms, view:pharmacy" className={`${input} font-mono`} />
            </Field>
            <Field label="Then grant">
              <input value={rule.thenGrant} onChange={(e) => setRule({ ...rule, thenGrant: e.target.value })}
                placeholder="view:boarding" className={`${input} font-mono`} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Audience">
                <select value={rule.audience} onChange={(e) => setRule({ ...rule, audience: e.target.value })} className={input}>
                  {AUDIENCES.map((a) => <option key={a} value={a}>{a || 'Any'}</option>)}
                </select>
              </Field>
              <Field label="Min tier">
                <input type="number" min={0} value={rule.whenMinTier}
                  onChange={(e) => setRule({ ...rule, whenMinTier: e.target.value })} className={input} />
              </Field>
              <Field label="Days" hint="Blank = while held.">
                <input type="number" min={1} value={rule.durationDays}
                  onChange={(e) => setRule({ ...rule, durationDays: e.target.value })} placeholder="30" className={input} />
              </Field>
            </div>
            <button onClick={createRule} disabled={busy} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700 w-full justify-center`}>
              <Plus size={13} /> Create rule
            </button>
            <p className="text-[10px] text-slate-400">
              A new rule takes effect on the next subscription change or the hourly sweep &mdash;
              use <strong>Run reconcile</strong> above to apply it now.
            </p>
          </div>
        </section>
      </div>
    </AdminPage>
  );
};

export default GrantsAndBundlesAdminPage;
