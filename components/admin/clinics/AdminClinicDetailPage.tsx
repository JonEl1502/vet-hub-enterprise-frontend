import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Edit, Power, UserCheck, Sparkles, Loader2 } from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { clinicsAPI, Clinic, toast, cache } from '../../../services';
import ClinicLogo from '../../clinic/clinic-mgmt/ClinicLogo';
import { useAuth } from '../../../contexts/AuthContext';
import ClinicEmailVerify from './ClinicEmailVerify';
import EditUserDialog from '../shared/EditUserDialog';
import RecordPaidSubscriptionDialog from '../subscriptions/RecordPaidSubscriptionDialog';
import ComplimentaryTrialCard from './ComplimentaryTrialCard';
import { adminOrgAPI, ClinicSummary } from '../../../services/modules/adminOrg.api';
import { OrgSwitcher, FigureTiles, WarningsPanel, TabBar, RecordsTable, Pill, money, day as fmtDay, ago, statusTone, statusLabel } from '../orgs/OrgParts';

// Full-page admin clinic detail — converted from the tabbed modal on the
// Clinics management page so the drill-down is a real navigable page
// (nav key 'admin-clinic-detail', param clinicId).

interface Props {
  clinicId: string | number;
  onBack: () => void;
  onNavigate?: (view: string, params?: any) => void;
}

type Tab = 'overview' | 'clients' | 'patients' | 'visits' | 'invoices' | 'products' | 'billing' | 'users' | 'branches' | 'partners';

const AdminClinicDetailPage: React.FC<Props> = ({ clinicId, onBack, onNavigate }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MERCHANT_ADMIN';
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [details, setDetails] = useState<{ users: any[]; branches: any[]; partners: any[]; billing?: any } | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  // Status flow — inline confirm card with a branch-scope choice when the
  // clinic has branches (mirrors the list page's chooser).
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [statusScope, setStatusScope] = useState<'this' | 'with-branches'>('this');
  const [statusBusy, setStatusBusy] = useState(false);
  /** 294 — the account being edited in the shared dialog. */
  const [editUser, setEditUser] = useState<any | null>(null);
  /** 302 — recording a subscription paid for outside the gateways. */
  const [grantOpen, setGrantOpen] = useState(false);
  /** 326 — figures, plan and "needs attention", from /admin/orgs. */
  const [summary, setSummary] = useState<ClinicSummary | null>(null);
  const [allClinics, setAllClinics] = useState<Array<{ id: string; name: string; hint?: string; isActive?: boolean }>>([]);

  useEffect(() => {
    clinicsAPI.getAll()
      .then((res: any) => {
        const list = (res?.data?.clinics ?? res?.clinics ?? []) as any[];
        const flat: any[] = [];
        const walk = (arr: any[], parent?: string) => arr.forEach((x) => {
          flat.push({ id: String(x.id), name: x.name, isActive: x.isActive !== false, hint: parent ? `Branch of ${parent}` : (x.city || undefined) });
          if (Array.isArray(x.branches) && x.branches.length) walk(x.branches, x.name);
        });
        walk(list);
        const seen = new Set<string>();
        setAllClinics(flat.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setClinic(null); setDetails(null); setSummary(null); setTab('overview'); setConfirmStatus(false);
    adminOrgAPI.clinicSummary(String(clinicId))
      .then(r => { if (alive && r.success && r.data) setSummary(r.data); })
      .catch(() => {});
    clinicsAPI.getById(Number(clinicId), { cache: false })
      .then(r => { if (alive && r.success && r.data?.clinic) setClinic(r.data.clinic); })
      .catch(() => {});
    clinicsAPI.adminDetails(Number(clinicId))
      .then(r => { if (alive && r.success && r.data) setDetails(r.data as any); })
      .catch(() => {});
    return () => { alive = false; };
  }, [clinicId]);

  const applyStatus = async () => {
    if (!clinic) return;
    const next = !clinic.isActive;
    setStatusBusy(true);
    try {
      await clinicsAPI.setStatus(Number(clinic.id), next, { scope: (details?.branches.length ?? 0) > 0 ? statusScope : 'this' });
      cache.invalidatePattern('/clinics');
      setClinic({ ...clinic, isActive: next });
      setConfirmStatus(false);
      toast.success(`Clinic ${next ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  if (!clinic) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
          <ArrowLeft size={13} /> Clinics
        </button>
        <div className="py-20 flex justify-center"><LoadingSpinner contentArea message="Loading clinic…" /></div>
      </div>
    );
  }

  const c: any = clinic;
  const rows: Array<[string, React.ReactNode]> = [
    ['Status', c.isActive ? 'Active' : 'Inactive'],
    ['Email', c.email
      ? <ClinicEmailVerify
          clinicId={String(c.id)}
          email={c.email}
          verified={!!c.emailVerified}
          verifiedAt={c.emailVerifiedAt}
          onChanged={(verified) => setClinic(cl => (cl ? ({ ...cl, emailVerified: verified, emailVerifiedAt: verified ? new Date().toISOString() : null } as any) : cl))}
        />
      : '—'],
    ['Phone', c.phone || '—'],
    ['Address', c.address || '—'],
    ['City', c.city || '—'],
    ['Region', c.region || '—'],
    ['Subdomain', c.subdomain || '—'],
    ['Currency', c.currency || '—'],
    ['Rating', c.rating != null ? String(c.rating) : '—'],
    ['Branches', details ? String(details.branches.length) : '…'],
    ['Brought in by', 'referredBy' in c
      ? (c.referredBy
          ? <span className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-300">
              <UserCheck size={13} /> {c.referredBy.name}
              {c.referredBy.code && <span className="font-mono text-[11px] opacity-70">· {c.referredBy.code}</span>}
            </span>
          : <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <Sparkles size={13} /> Self-registered
            </span>)
      : '—'],
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-400 hover:text-seafoam transition-all">
          <ArrowLeft size={14} /> Clinics
        </button>
        {allClinics.length > 1 && (
          <OrgSwitcher label="clinic" current={String(c.id)} options={allClinics}
            onPick={(id) => onNavigate?.('admin-clinic-detail', { clinicId: id })} />
        )}
      </div>

      {/* Header banner */}
      <div className="bg-gradient-to-br from-pine to-pine/90 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-white/15 overflow-hidden flex items-center justify-center text-2xl shrink-0">
          {c.logo ? <ClinicLogo logo={c.logo} /> : <Building2 size={28} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Clinic</p>
          <h1 className="text-xl font-black tracking-tight truncate">{c.name}</h1>
          {c.slogan && <p className="text-[11px] text-white/70 italic truncate">"{c.slogan}"</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${c.isActive ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'}`}>
            <Power size={12} /> {c.isActive ? 'Active' : 'Inactive'}
          </span>
          {summary && (
            <span className="text-[12px] font-semibold text-white/80">
              {summary.plan ? `${summary.plan.name} to ${fmtDay(summary.plan.expiresAt)}` : 'No active plan'}
            </span>
          )}
        </div>
      </div>

      {/* 326 — the branch line: a branch takes the main clinic's plan, so
          say whose it is before anyone records a payment here. */}
      {summary?.parent && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] text-slate-600 dark:text-zinc-300">
          <Building2 size={15} className="text-seafoam" />
          This is a branch of
          <button onClick={() => onNavigate?.('admin-clinic-detail', { clinicId: summary.parent!.id })} className="font-semibold text-seafoam hover:underline">{summary.parent.name}</button>
          and uses its plan.
        </div>
      )}

      {summary && (
        <FigureTiles figures={[
          { label: 'Clients', value: summary.figures.clients.toLocaleString(), onClick: () => setTab('clients') },
          { label: 'Patients', value: summary.figures.patients.toLocaleString(), onClick: () => setTab('patients') },
          { label: 'Visits this month', value: summary.figures.visitsThisMonth.toLocaleString(), onClick: () => setTab('visits') },
          { label: 'Billed this month', value: money(summary.currency, summary.figures.revenueThisMonth), hint: `${summary.figures.openInvoices} open invoice${summary.figures.openInvoices === 1 ? '' : 's'}`, onClick: () => setTab('invoices') },
          { label: 'Staff', value: summary.figures.staff.toLocaleString(), onClick: () => setTab('users') },
          { label: 'Last sign-in', value: ago(summary.figures.lastLoginAt) },
        ]} />
      )}
      {summary && (
        <WarningsPanel warnings={summary.warnings} onAction={(a) => {
          if (a.kind === 'open-clinic' && a.id) onNavigate?.('admin-clinic-detail', { clinicId: a.id });
          else if (a.kind === 'open-billing') setTab('billing');
          else if (a.kind === 'open-users') setTab('users');
          else if (a.kind === 'open-products') setTab('products');
          else if (a.kind === 'edit') onNavigate?.('admin-clinic-edit', { clinicId: String(c.id) });
        }} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main — tabbed detail */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <TabBar value={tab} onChange={(id) => setTab(id as Tab)} tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'clients', label: 'Clients', count: summary?.figures.clients ?? null },
            { id: 'patients', label: 'Patients', count: summary?.figures.patients ?? null },
            { id: 'visits', label: 'Visits' },
            { id: 'invoices', label: 'Invoices' },
            { id: 'products', label: 'Products' },
            { id: 'users', label: 'Users', count: details ? details.users.length : null },
            { id: 'branches', label: 'Branches', count: details ? details.branches.length : null },
            { id: 'partners', label: 'Partners', count: details ? details.partners.length : null },
            { id: 'billing', label: 'Billing' },
          ]} />
          {RECORD_TABS.includes(tab) && (
            <ClinicRecords clinicId={String(c.id)} kind={tab} currency={c.currency || 'KES'} />
          )}
          <div className={RECORD_TABS.includes(tab) ? 'hidden' : 'p-5'}>
            {tab === 'overview' && (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{k}</dt>
                      <dd className="text-sm font-bold text-pine dark:text-zinc-100 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
                {Array.isArray(c.specialties) && c.specialties.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.specialties.map((s: string) => (
                        <span key={s} className="px-2.5 py-1 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-wider">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {['billing', 'users', 'branches', 'partners'].includes(tab) && !details && (
              <div className="py-10 flex justify-center"><LoadingSpinner contentArea message="Loading…" /></div>
            )}
            {/* 299 — WHAT THIS CLINIC IS PAYING FOR.
                An admin had no way to see this: answering "what do they
                actually hold" meant SSHing to the box and querying three tables
                by hand (2026-09-10). The plan and its add-ons are listed
                separately because they ARE separate — 293 fixed five lookups
                that conflated them. */}
            {tab === 'billing' && details && (() => {
              const b = details.billing;
              if (!b) return <p className="text-sm text-slate-400 text-center py-8">No billing information.</p>;
              const money = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;
              const day = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
              const CYCLE: Record<string, string> = {
                MONTHLY: '1 month', QUARTERLY: '3 months', SEMIANNUAL: '6 months',
                YEARLY: '1 year', BIENNIAL: '2 years', TRIENNIAL: '3 years',
              };
              return (
                <div className="space-y-4">
                  {summary?.plan?.inheritedFrom && (
                    <div className="rounded-xl border border-seafoam/30 bg-seafoam/[0.05] p-3 text-[13px] text-slate-600 dark:text-zinc-300">
                      Uses <b className="text-pine dark:text-zinc-100">{summary.plan.name}</b> from {summary.plan.inheritedFrom.name}, to {fmtDay(summary.plan.expiresAt)}. Plans for this branch are recorded on the main clinic.
                    </div>
                  )}
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[240px] rounded-xl border border-slate-200 dark:border-zinc-800 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{summary?.parent ? 'Plan saved on this branch' : 'Current plan'}</p>
                      {b.plan ? (
                        <>
                          <p className="text-base font-black text-pine dark:text-zinc-100 mt-1">{b.plan.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                            {CYCLE[b.plan.billingCycle] ?? b.plan.billingCycle} · started {day(b.plan.startedAt)} · renews {day(b.plan.expiresAt)}
                          </p>
                          {b.plan.cancellationMode && (
                            <p className="mt-1 text-[11px] font-bold text-amber-600">Cancellation scheduled ({b.plan.cancellationMode})</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-bold text-slate-400 mt-1">
                          No active plan{b.trialEndsAt ? ` — on trial to ${day(b.trialEndsAt)}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-[240px] rounded-xl border border-slate-200 dark:border-zinc-800 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Add-ons · {b.addOns.length}</p>
                      {b.addOns.length === 0 ? (
                        <p className="text-sm font-bold text-slate-400 mt-1">None</p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {b.addOns.map((a: any) => (
                            <li key={a.id} className="text-[12px] text-slate-700 dark:text-zinc-200 flex justify-between gap-3">
                              <span className="font-bold">{a.name}</span>
                              <span className="text-slate-400 whitespace-nowrap">to {day(a.expiresAt)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {b.prodTest && (
                        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Demo / test org</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recent payments</p>
                      {/* 302 — the fault-tolerant path: money that arrived with no
                          attempt behind it. The dialog itself steers to Reconcile
                          first, because that one asks the gateway. */}
                      <button
                        onClick={() => (summary?.parent ? onNavigate?.('admin-clinic-detail', { clinicId: summary.parent.id }) : setGrantOpen(true))}
                        title={summary?.parent ? `Record it on ${summary.parent.name}: a branch uses the main clinic's plan` : undefined}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:border-pine/40 transition-colors"
                      >
                        {summary?.parent ? `Record on ${summary.parent.name}` : 'Record a paid subscription'}
                      </button>
                    </div>
                    {b.payments.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4">No payment attempts recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                            <th className="py-2 pr-3">Date</th><th className="py-2 px-3">Package</th><th className="py-2 px-3">Channel</th><th className="py-2 px-3">Amount</th><th className="py-2 pl-3">Status</th>
                          </tr></thead>
                          <tbody>
                            {b.payments.map((p: any) => (
                              <tr key={`${p.channel}-${p.id}`} className="border-b border-slate-50 dark:border-zinc-800/60">
                                <td className="py-2 pr-3 text-slate-400">{day(p.createdAt)}</td>
                                <td className="py-2 px-3 font-bold text-pine dark:text-zinc-100">
                                  {p.packageName}
                                  {/* 288 — a bundled charge bought more than the plan it names. */}
                                  {p.lineItems && p.lineItems.length > 1 && (
                                    <span className="ml-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">+{p.lineItems.length - 1} more</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-500">{p.channel}</td>
                                <td className="py-2 px-3 font-mono">{money(p.amount)}</td>
                                <td className="py-2 pl-3">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                    p.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600'
                                    : p.status === 'PENDING' ? 'bg-amber-500/10 text-amber-600'
                                    : 'bg-red-500/10 text-red-500'
                                  }`}>{p.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {tab === 'users' && details && (
              details.users.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No users attached to this clinic.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-2 pr-3">Name</th><th className="py-2 px-3">Email</th><th className="py-2 px-3">Role</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Joined</th><th className="py-2 pl-3 text-right">Edit</th>
                  </tr></thead>
                  <tbody>
                    {details.users.map((u: any) => (
                      <tr key={u.id} className="border-b border-slate-50 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 font-bold text-pine dark:text-zinc-100">{u.name}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-zinc-400">{u.email}</td>
                        <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-wider">{String(u.role).replace('_', ' ')}</span></td>
                        <td className="py-2 px-3">{u.isActive ? <span className="text-green-600 font-bold">Active</span> : <span className="text-red-500 font-bold">Inactive</span>}</td>
                        <td className="py-2 px-3 text-slate-400">{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="py-2 pl-3 text-right">
                          {/* 294 — the SAME dialog the Users directory opens.
                              `lockedClinicId` keeps this clinic selected: detaching
                              someone from the org you are currently looking at, on a
                              screen that then stops listing them, is a confusing way
                              to lose a member of staff. Do that from the directory. */}
                          <button
                            onClick={() => setEditUser(u)}
                            title="Edit account"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100 hover:border-pine/40 transition-colors"
                          >
                            <Edit size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>)
            )}
            {tab === 'branches' && details && (
              details.branches.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">This clinic has no branches.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-2 pr-3">Branch</th><th className="py-2 px-3">City</th><th className="py-2 px-3">Subdomain</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Created</th>
                  </tr></thead>
                  <tbody>
                    {details.branches.map((b: any) => (
                      <tr key={b.id} className="border-b border-slate-50 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 font-bold text-pine dark:text-zinc-100">{b.name}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-zinc-400">{[b.city, b.countryCode].filter(Boolean).join(', ') || '—'}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-zinc-400">{b.subdomain}</td>
                        <td className="py-2 px-3">{b.isActive ? <span className="text-green-600 font-bold">Active</span> : <span className="text-red-500 font-bold">Inactive</span>}</td>
                        <td className="py-2 pl-3 text-slate-400">{b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>)
            )}
            {tab === 'partners' && details && (
              details.partners.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No partnerships (handshakes) yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-2 pr-3">Partner clinic</th><th className="py-2 px-3">Direction</th><th className="py-2 px-3">Services</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Since</th>
                  </tr></thead>
                  <tbody>
                    {details.partners.map((h: any) => (
                      <tr key={`${h.id}-${h.direction}`} className="border-b border-slate-50 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 font-bold text-pine dark:text-zinc-100">{h.partner}{h.partnerCity ? <span className="text-slate-400 font-medium"> · {h.partnerCity}</span> : null}</td>
                        <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${h.direction === 'SENT' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-violet-500/10 text-violet-500'}`}>{h.direction === 'SENT' ? 'Sent' : 'Received'}</span></td>
                        <td className="py-2 px-3 text-slate-500 dark:text-zinc-400">{(h.services || []).join(', ') || '—'}</td>
                        <td className="py-2 px-3"><span className={`font-bold ${h.status === 'ACCEPTED' ? 'text-green-600' : h.status === 'PENDING' ? 'text-amber-600' : 'text-red-500'}`}>{String(h.status).toLowerCase()}</span></td>
                        <td className="py-2 pl-3 text-slate-400">{h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>)
            )}
          </div>
        </div>

        {/* Side rail — admin actions */}
        {isAdmin && (
          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm sticky top-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</p>
            <button
              onClick={() => onNavigate?.('admin-clinic-edit', { clinicId: String(c.id) })}
              className="w-full px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              <Edit size={14} /> Edit
            </button>
            {!confirmStatus ? (
              <button
                onClick={() => { setStatusScope('this'); setConfirmStatus(true); }}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${c.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600' : 'bg-green-500/10 hover:bg-green-500/20 text-green-600'}`}
              >
                <Power size={14} /> {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
            ) : (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <p className="text-xs font-bold text-pine dark:text-zinc-100">
                  {c.isActive ? 'Deactivate' : 'Activate'} “{c.name}”?
                </p>
                {(details?.branches.length ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    {([['this', 'This clinic only'], ['with-branches', `Also its ${details!.branches.length} branch${details!.branches.length === 1 ? '' : 'es'}`]] as const).map(([v, label]) => (
                      <label key={v} className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer">
                        <input type="radio" name="status-scope" checked={statusScope === v} onChange={() => setStatusScope(v)} className="accent-seafoam" />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setConfirmStatus(false)} disabled={statusBusy} className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest">Cancel</button>
                  <button onClick={applyStatus} disabled={statusBusy} className={`flex-1 px-3 py-2 rounded-lg text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 ${c.isActive ? 'bg-amber-500' : 'bg-green-600'}`}>
                    {statusBusy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />} Confirm
                  </button>
                </div>
              </div>
            )}
            {/* 328 — a branch follows its main clinic's trial, so the gift is
                given on the main clinic only. */}
            {summary && !summary.parent && (
              <ComplimentaryTrialCard
                clinicId={String(c.id)}
                clinicName={c.name}
                currency={summary.currency}
                shell={summary.shell}
                trialEndsAt={summary.trialEndsAt}
                complimentary={summary.complimentary ?? null}
                onChanged={() => {
                  adminOrgAPI.clinicSummary(String(clinicId)).then((r) => { if (r.success && r.data) setSummary(r.data); }).catch(() => {});
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* 302 — SUPER_ADMIN only on the server; the button is simply absent for
          anyone else because the endpoint would refuse them anyway. */}
      {grantOpen && clinic && (
        <RecordPaidSubscriptionDialog
          ownerKind="CLINIC"
          ownerId={String(clinic.id)}
          ownerName={clinic.name}
          ownerShell={(clinic as any).shell ?? summary?.shell ?? null}
          onClose={() => setGrantOpen(false)}
          onGranted={() => {
            adminOrgAPI.clinicSummary(String(clinicId)).then((r) => { if (r.success && r.data) setSummary(r.data); }).catch(() => {});
            clinicsAPI.adminDetails(Number(clinicId))
              .then((r) => { if (r.success && r.data) setDetails(r.data as any); })
              .catch(() => {});
          }}
        />
      )}

      {/* 294 — shared with the Admin → Users directory; see EditUserDialog. */}
      {editUser && (
        <EditUserDialog
          user={editUser}
          /* No clinic picker here on purpose: these rows are scoped to THIS
             org, so they cannot describe a user's full membership — and
             `clinicIds` replaces the whole list. Reassign from Admin → Users,
             where the list is authoritative. */
          clinics={[]}
          currentUserId={user ? Number(user.id) : undefined}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            // Refetch the org's people rather than patching one row: a role
            // change here can move somebody out of this clinic entirely.
            clinicsAPI.adminDetails(Number(clinicId))
              .then((r) => { if (r.success && r.data) setDetails(r.data as any); })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
};

const RECORD_TABS: string[] = ['clients', 'patients', 'visits', 'invoices', 'products'];

/** 326 — one searchable, paged table per kind of record the clinic owns. */
const ClinicRecords: React.FC<{ clinicId: string; kind: string; currency: string }> = ({ clinicId, kind, currency }) => {
  const load = (q: { page: number; search: string; status?: string }) =>
    adminOrgAPI.clinicRecords(clinicId, kind, q).then((r) => {
      if (!r.success || !r.data) throw new Error('Could not load.');
      return r.data;
    });
  const cur = (v: number) => money(currency, v);
  const common = { load, scopeKey: `${clinicId}:${kind}` };
  switch (kind) {
    case 'clients':
      return <RecordsTable key={kind} {...common} searchPlaceholder="Search name, phone, email or code" empty="No clients yet."
        columns={[
          { key: 'name', label: 'Client', primary: true, render: (r) => <>{r.name}{r.code && <span className="ml-1.5 text-[11px] font-mono text-slate-400">{r.code}</span>}</> },
          { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
          { key: 'pets', label: 'Pets', align: 'right', render: (r) => r.pets },
          { key: 'spent', label: 'Spent', align: 'right', render: (r) => cur(r.totalSpent) },
          { key: 'last', label: 'Last visit', render: (r) => fmtDay(r.lastVisitAt) },
          { key: 'portal', label: 'Portal', render: (r) => (r.hasPortal ? <Pill tone="violet">Portal</Pill> : '—') },
          { key: 'joined', label: 'Joined', render: (r) => fmtDay(r.joinedAt) },
        ]} />;
    case 'patients':
      return <RecordsTable key={kind} {...common} searchPlaceholder="Search name, species, breed, code or chip" empty="No patients yet."
        columns={[
          { key: 'name', label: 'Patient', primary: true, render: (r) => <>{r.name}{r.code && <span className="ml-1.5 text-[11px] font-mono text-slate-400">{r.code}</span>}</> },
          { key: 'species', label: 'Species', render: (r) => [r.species, r.breed].filter(Boolean).join(' · ') || '—' },
          { key: 'gender', label: 'Sex', render: (r) => r.gender || '—' },
          { key: 'owner', label: 'Owner', render: (r) => r.owner || '—' },
          { key: 'status', label: 'Status', render: (r) => (!r.isAlive ? <Pill tone="slate">Deceased</Pill> : r.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="red">Inactive</Pill>) },
          { key: 'added', label: 'Added', render: (r) => fmtDay(r.createdAt) },
        ]} />;
    case 'visits':
      return <RecordsTable key={kind} {...common} searchPlaceholder="Search patient or client" empty="No visits yet."
        columns={[
          { key: 'when', label: 'Date', primary: true, render: (r) => fmtDay(r.scheduledAt) },
          { key: 'pet', label: 'Patient', render: (r) => r.pet },
          { key: 'client', label: 'Client', render: (r) => r.client || '—' },
          { key: 'type', label: 'Type', render: (r) => statusLabel(r.type) },
          { key: 'vet', label: 'Vet', render: (r) => r.vet || '—' },
          { key: 'status', label: 'Status', render: (r) => <Pill tone={statusTone(r.status)}>{statusLabel(r.status)}</Pill> },
          { key: 'total', label: 'Total', align: 'right', render: (r) => <>{cur(r.total)}{r.isPaid && <span className="ml-1 text-emerald-500">✓</span>}</> },
        ]} />;
    case 'invoices':
      return <RecordsTable key={kind} {...common} searchPlaceholder="Search invoice number" empty="No invoices yet."
        statusOptions={[{ value: 'OPEN', label: 'Open' }, { value: 'PARTIAL', label: 'Part paid' }, { value: 'PAID', label: 'Paid' }, { value: 'VOID', label: 'Void' }]}
        columns={[
          { key: 'no', label: 'Invoice', primary: true, render: (r) => <span className="font-mono">{r.number}</span> },
          { key: 'client', label: 'Client', render: (r) => r.client },
          { key: 'date', label: 'Issued', render: (r) => fmtDay(r.issuedAt) },
          { key: 'status', label: 'Status', render: (r) => <Pill tone={statusTone(r.status)}>{statusLabel(r.status)}</Pill> },
          { key: 'total', label: 'Total', align: 'right', render: (r) => cur(r.total) },
        ]} />;
    case 'products':
      return <RecordsTable key={kind} {...common} searchPlaceholder="Search product or category" empty="No products in stock records."
        columns={[
          { key: 'name', label: 'Product', primary: true, render: (r) => r.name },
          { key: 'cat', label: 'Category', render: (r) => r.category || '—' },
          { key: 'qty', label: 'In stock', align: 'right', render: (r) => <span className={r.quantity <= 0 ? 'text-red-500 font-semibold' : ''}>{r.quantity.toLocaleString()}</span> },
          { key: 'price', label: 'Price', align: 'right', render: (r) => cur(r.price) },
          { key: 'exp', label: 'Expires', render: (r) => fmtDay(r.expiryDate) },
        ]} />;
    default:
      return null;
  }
};

export default AdminClinicDetailPage;
