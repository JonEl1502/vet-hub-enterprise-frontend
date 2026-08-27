import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, Loader2, Search, X, Save, ShieldAlert, BadgeCheck, Landmark, Phone } from 'lucide-react';
import { hrAPI, HrPerson, HrEmploymentRecord, HrContractType, HrEmploymentStatus } from '../../../services/modules/hr.api';
import {
  Card, Empty, Field, INPUT, BTN_PRIMARY, BTN_GHOST, Pill, PersonChip,
  EMPLOYMENT_TONE, CONTRACT_LABEL, titleCase, prettyDate,
} from './hrShared';

const CONTRACTS: HrContractType[] = ['PERMANENT', 'FIXED_TERM', 'LOCUM', 'CASUAL', 'INTERN', 'ATTACHMENT'];
const STATUSES: HrEmploymentStatus[] = ['PROBATION', 'ACTIVE', 'SUSPENDED', 'ON_NOTICE', 'RESIGNED', 'TERMINATED'];
/** Statuses that make an end date coherent — mirrors the service's guard. */
const ENDING: HrEmploymentStatus[] = ['ON_NOTICE', 'RESIGNED', 'TERMINATED'];

/**
 * HR ▸ People — the roster, and the employment file behind each person.
 *
 * The list is driven from who is ATTACHED to the clinic, not from who has an
 * employment record, so a new hire appears here the moment they are added to
 * the clinic and before anyone has filled anything in. "No file yet" is the
 * actionable state, not an absence.
 */
const HrPeopleTab: React.FC = () => {
  const [people, setPeople] = useState<HrPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    hrAPI.people()
      .then(r => setPeople(r.data?.people ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return people;
    return people.filter(p =>
      `${p.name} ${p.email ?? ''} ${p.record?.jobTitle ?? ''} ${p.record?.staffNumber ?? ''}`.toLowerCase().includes(n));
  }, [people, q]);

  const open = people.find(p => p.userId === openId) || null;
  const missing = people.filter(p => !p.hasRecord).length;

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, role, staff no."
            className={`${INPUT} pl-8`} />
        </div>
        {missing > 0 && (
          <Pill tone="amber">
            <ShieldAlert size={9} /> {missing} without a file
          </Pill>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty icon={Users} title="Nobody here"
          hint={q ? 'No one matches that search.' : 'Add staff to this clinic from the Staff Directory first — HR reads that list.'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
          {filtered.map(p => (
            <Card key={p.userId} className="p-3.5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <PersonChip name={p.name} url={p.avatarUrl} sub={p.record?.jobTitle || titleCase(p.role)} />
                {p.hasRecord && p.record
                  ? <Pill tone={EMPLOYMENT_TONE[p.record.status]}>{titleCase(p.record.status)}</Pill>
                  : <Pill tone="amber">No file</Pill>}
              </div>

              <div className="mt-auto pt-3 space-y-0.5">
                {p.record ? (
                  <>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {CONTRACT_LABEL[p.record.contractType]}
                      {p.record.staffNumber ? ` · ${p.record.staffNumber}` : ''}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400">
                      Started {prettyDate(p.record.startedOn)}
                    </p>
                  </>
                ) : (
                  <p className="text-[9px] font-bold text-slate-400">
                    Attached {prettyDate(p.joinedAt)} — no employment file yet
                  </p>
                )}
              </div>

              <div className="mt-2 flex justify-end">
                <button className={BTN_GHOST} onClick={() => setOpenId(p.userId)}>
                  {p.hasRecord ? 'Open file' : 'Create file'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <EmploymentDrawer person={open} onClose={() => setOpenId(null)} onSaved={() => { setOpenId(null); load(); }} />
      )}
    </div>
  );
};

/**
 * The employment file.
 *
 * ⚠️ Pay is rendered on `'basicSalary' in record`, NOT on a truthiness check.
 * The server OMITS pay keys for a non-owner rather than nulling them; a
 * manager shown an empty salary box would fill it in and the save would drop
 * it silently. `canSeePay` is false when the key is absent, and the whole
 * section is hidden with a line saying why.
 */
const EmploymentDrawer: React.FC<{ person: HrPerson; onClose: () => void; onSaved: () => void }> = ({ person, onClose, onSaved }) => {
  const rec = person.record;
  // A brand-new file has no record at all, so pay visibility cannot be read
  // from it — fall back to asking the server for this one person.
  const [canSeePay, setCanSeePay] = useState<boolean>(!!rec && 'basicSalary' in rec);
  const [form, setForm] = useState<any>(() => ({ ...(rec ?? {}) }));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rec) return;
    let alive = true;
    hrAPI.person(person.userId)
      .then(r => { if (alive) setCanSeePay(!!r.data?.record ? 'basicSalary' in (r.data.record as any) : true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [person.userId, rec]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const status: HrEmploymentStatus = form.status || 'PROBATION';
  const needsEndStatus = !!form.endedOn && !ENDING.includes(status);

  const save = async () => {
    if (needsEndStatus) { toast.error('An end date needs a status of On notice, Resigned or Terminated'); return; }
    setBusy(true);
    try {
      const res = await hrAPI.saveEmployment(person.userId, form);
      if (res.data?.record) { toast.success('Employment file saved'); onSaved(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center p-4 overflow-y-auto bg-pine/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-3xl my-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <PersonChip name={person.name} url={person.avatarUrl} sub={person.email} />
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          <section className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <BadgeCheck size={11} /> The job
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Staff number"><input className={INPUT} value={form.staffNumber ?? ''} onChange={e => set('staffNumber', e.target.value)} /></Field>
              <Field label="Job title"><input className={INPUT} value={form.jobTitle ?? ''} onChange={e => set('jobTitle', e.target.value)} /></Field>
              <Field label="Department"><input className={INPUT} value={form.department ?? ''} onChange={e => set('department', e.target.value)} /></Field>
              <Field label="Contract">
                <select className={INPUT} value={form.contractType ?? 'PERMANENT'} onChange={e => set('contractType', e.target.value)}>
                  {CONTRACTS.map(c => <option key={c} value={c}>{CONTRACT_LABEL[c]}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={INPUT} value={status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}
                </select>
              </Field>
              <Field label="Started">
                <input type="date" className={INPUT} value={(form.startedOn ?? '').slice(0, 10)} onChange={e => set('startedOn', e.target.value)} />
              </Field>
              {status === 'PROBATION' && (
                <Field label="Probation ends">
                  <input type="date" className={INPUT} value={(form.probationEndsOn ?? '').slice(0, 10)} onChange={e => set('probationEndsOn', e.target.value)} />
                </Field>
              )}
              <Field label="Ended">
                <input type="date" className={INPUT} value={(form.endedOn ?? '').slice(0, 10)} onChange={e => set('endedOn', e.target.value)} />
              </Field>
              {!!form.endedOn && (
                <Field label="Reason for leaving" className="sm:col-span-2">
                  <input className={INPUT} value={form.endReason ?? ''} onChange={e => set('endReason', e.target.value)} />
                </Field>
              )}
            </div>
            {needsEndStatus && (
              <p className="text-[9px] font-black uppercase tracking-wider text-rose-500">
                An end date needs a status of On notice, Resigned or Terminated
              </p>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Landmark size={11} /> Pay, bank and statutory
            </p>
            {canSeePay ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Basic salary">
                  <input type="number" min={0} step="0.01" className={INPUT} value={form.basicSalary ?? ''} onChange={e => set('basicSalary', e.target.value)} />
                </Field>
                <Field label="Paid">
                  <select className={INPUT} value={form.payFrequency ?? 'MONTHLY'} onChange={e => set('payFrequency', e.target.value)}>
                    {['MONTHLY', 'FORTNIGHTLY', 'WEEKLY', 'DAILY', 'HOURLY'].map(f => <option key={f} value={f}>{titleCase(f)}</option>)}
                  </select>
                </Field>
                <Field label="KRA PIN"><input className={INPUT} value={form.kraPin ?? ''} onChange={e => set('kraPin', e.target.value)} /></Field>
                <Field label="NSSF no."><input className={INPUT} value={form.nssfNumber ?? ''} onChange={e => set('nssfNumber', e.target.value)} /></Field>
                <Field label="SHIF no."><input className={INPUT} value={form.shifNumber ?? ''} onChange={e => set('shifNumber', e.target.value)} /></Field>
                <Field label="Bank"><input className={INPUT} value={form.bankName ?? ''} onChange={e => set('bankName', e.target.value)} /></Field>
                <Field label="Branch"><input className={INPUT} value={form.bankBranch ?? ''} onChange={e => set('bankBranch', e.target.value)} /></Field>
                <Field label="Account no."><input className={INPUT} value={form.bankAccount ?? ''} onChange={e => set('bankAccount', e.target.value)} /></Field>
              </div>
            ) : (
              <p className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                Pay, bank details and statutory numbers are visible to the clinic owner only. Everything else on this
                file is yours to edit — saving will not touch them.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Phone size={11} /> Who to call
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Emergency contact"><input className={INPUT} value={form.emergencyName ?? ''} onChange={e => set('emergencyName', e.target.value)} /></Field>
              <Field label="Their phone"><input className={INPUT} value={form.emergencyPhone ?? ''} onChange={e => set('emergencyPhone', e.target.value)} /></Field>
              <Field label="Relationship"><input className={INPUT} value={form.emergencyRelation ?? ''} onChange={e => set('emergencyRelation', e.target.value)} /></Field>
              <Field label="Next of kin"><input className={INPUT} value={form.nextOfKinName ?? ''} onChange={e => set('nextOfKinName', e.target.value)} /></Field>
              <Field label="Their phone"><input className={INPUT} value={form.nextOfKinPhone ?? ''} onChange={e => set('nextOfKinPhone', e.target.value)} /></Field>
              <Field label="Relationship"><input className={INPUT} value={form.nextOfKinRelation ?? ''} onChange={e => set('nextOfKinRelation', e.target.value)} /></Field>
            </div>
          </section>

          <Field label="Notes">
            <textarea rows={2} className={INPUT} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save file
          </button>
        </div>
      </div>
    </div>
  );
};

export default HrPeopleTab;
