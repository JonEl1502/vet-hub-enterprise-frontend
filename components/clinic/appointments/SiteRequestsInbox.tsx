import React from 'react';
import {
  Globe, Loader2, Check, X, CalendarClock, Ban, UserPlus, UserCheck,
  ShieldAlert, Mail, Phone, MessageSquare, ChevronRight, Send,
} from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import {
  siteConnectAPI,
  type SiteRequest, type SiteRequestDetail, type SiteRequestStatus, type ClientStatus,
} from '../../../services/modules/siteConnect.api';
import { toast, dialog } from '../../../services';
import { useData } from '../../../contexts/DataContext';

/**
 * WEBSITE REQUESTS (269) — appointment requests submitted on the clinic's own
 * website. Spec: `backend/docs/SPEC_WEBSITE_INTEGRATION.md` §2.1, §2.3.
 *
 * ⚠️ A row here is NOT a booking. Nothing exists in the CRM until someone
 * presses Accept — that is what creates the client, the patient and the
 * appointment. The wording throughout says "request", never "booking".
 */

const STATUS_TONE: Record<SiteRequestStatus, string> = {
  NEW: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  ACKNOWLEDGED: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  ACCEPTED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  RESCHEDULE_PROPOSED: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  DECLINED: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
  SPAM: 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500',
};

const STATUS_LABEL: Record<SiteRequestStatus, string> = {
  NEW: 'New',
  ACKNOWLEDGED: 'Seen',
  ACCEPTED: 'Accepted',
  RESCHEDULE_PROPOSED: 'Time proposed',
  DECLINED: 'Declined',
  CANCELLED: 'Withdrawn',
  SPAM: 'Spam',
};

/**
 * The client-status badge. ⚠️ `HAS_PORTAL_ELSEWHERE` deliberately does not name
 * the other clinic: one portal login spans many client files, one per clinic,
 * so which clinic is another practice's relationship, not ours to show.
 */
const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: string; hint: string }> = {
  NEW_TO_THIS_CLINIC: {
    label: 'New to this clinic',
    tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    hint: 'No client file matches this phone or email. Accepting creates one.',
  },
  EXISTING_CLIENT: {
    label: 'Existing client',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    hint: 'Pick the right file below so this does not become a duplicate.',
  },
  EXISTING_CLIENT_WITH_PORTAL: {
    label: 'Existing client · has portal',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    hint: 'They already have a pet-owner account — nothing to invite.',
  },
  HAS_PORTAL_ELSEWHERE: {
    label: 'Already has a pet-owner account',
    tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    hint: 'This email already has an account. Accepting creates their file here and links it.',
  },
  EMAIL_IS_A_STAFF_ACCOUNT: {
    label: 'Staff email — cannot invite',
    tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    hint: 'That address belongs to a staff account, so no pet-owner invite can be sent to it.',
  },
};

const TABS: { value: string; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'ACKNOWLEDGED', label: 'Seen' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: '', label: 'All' },
];

const FIELD =
  'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 ' +
  'text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/25';
const LABEL = 'text-[9px] font-black text-seafoam uppercase tracking-widest px-0.5';

/** `2026-09-12` + `10:00` → a value `datetime-local` accepts. */
const toLocalInput = (date: string, time: string | null) => {
  const d = String(date).slice(0, 10);
  return `${d}T${time && /^\d{2}:\d{2}$/.test(time) ? time : '09:00'}`;
};

const ageLabel = (months: number | null) => {
  if (months == null) return 'age not given';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y}y` : null, m ? `${m}m` : null].filter(Boolean).join(' ') || '0m';
};

interface Props {
  /** Reload the bookings list behind this tab once a request becomes one. */
  onAccepted?: () => void;
}

const SiteRequestsInbox: React.FC<Props> = ({ onAccepted }) => {
  /**
   * ⚠️ Accepting can CREATE a client and a patient, and the booking cards
   * behind this tab resolve their names out of DataContext's cached lists. A
   * row created a second ago is not in them, so without these refreshes the new
   * booking renders as a nameless "Patient ·" until a full page reload — which
   * is exactly how it looked the first time this was opened on staging.
   */
  const { refreshClients, refreshPets } = useData() as any;
  const [tab, setTab] = React.useState('NEW');
  const [rows, setRows] = React.useState<SiteRequest[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<SiteRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Accept form
  const [clientChoice, setClientChoice] = React.useState<string>('new');
  const [petChoice, setPetChoice] = React.useState<string>('new');
  const [dob, setDob] = React.useState('');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [note, setNote] = React.useState('');
  const [invite, setInvite] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    siteConnectAPI.listRequests({ status: tab || undefined })
      .then((r) => {
        setRows(r?.data?.requests ?? []);
        setCounts(r?.data?.counts ?? {});
      })
      .catch(() => toast.error('Could not load website requests'))
      .finally(() => setLoading(false));
  }, [tab]);

  React.useEffect(load, [load]);

  // A request arriving while the page is open should not need a refresh — the
  // clinic stream already carries the ding for portal bookings.
  React.useEffect(() => {
    const onStream = (e: any) => {
      if (String(e?.detail?.type || '').startsWith('site.request')) load();
    };
    window.addEventListener('vethub:stream', onStream);
    return () => window.removeEventListener('vethub:stream', onStream);
  }, [load]);

  const open = async (r: SiteRequest) => {
    if (openId === r.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(r.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await siteConnectAPI.getRequest(r.id);
      const d = res?.data ?? null;
      setDetail(d);
      if (d) {
        const firstCandidate = d.candidates[0];
        setClientChoice(firstCandidate ? firstCandidate.id : 'new');
        setPetChoice('new');
        setDob(d.request.pet.suggestedDob ?? '');
        setScheduledAt(toLocalInput(d.request.preferredDate, d.request.preferredTime));
        setNote('');
        // Pre-ticked when the visitor asked for it — and only when it can
        // actually be sent. Staff may still tick it for someone who did not ask.
        setInvite(d.request.portal.optIn && d.portal.canInvite);
      }
      if (r.status === 'NEW') {
        siteConnectAPI.acknowledge(r.id).then(() => {
          setRows((list) => list.map((x) => (x.id === r.id ? { ...x, status: 'ACKNOWLEDGED' } : x)));
        }).catch(() => {});
      }
    } catch {
      toast.error('Could not open that request');
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const accept = async () => {
    if (!detail) return;
    const d = detail;
    if (!scheduledAt) return toast.error('Pick the date and time you are giving them');
    const usingNewPet = petChoice === 'new';
    if (usingNewPet && !dob) {
      return toast.error("Confirm the patient's date of birth — a website visitor only gives an approximate age");
    }
    setBusy(true);
    try {
      const res = await siteConnectAPI.accept(d.request.id, {
        ...(clientChoice === 'new'
          ? {
              newClient: {
                firstName: d.request.owner.name.split(' ')[0] || d.request.owner.name,
                surname: d.request.owner.name.split(' ').slice(1).join(' '),
                phone: d.request.owner.phoneE164 ?? d.request.owner.phone,
                email: d.request.owner.email ?? undefined,
              },
            }
          : { clientId: clientChoice }),
        ...(usingNewPet
          ? {
              newPet: {
                name: d.request.pet.name,
                species: d.request.pet.species,
                breed: d.request.pet.breed ?? undefined,
                gender: d.request.pet.sex ?? undefined,
                dob,
              },
            }
          : { petId: petChoice }),
        scheduledAt: new Date(scheduledAt).toISOString(),
        note: note.trim() || undefined,
        sendPortalInvite: invite,
      });
      const portal = res?.data?.portal;
      toast.success('Accepted — it is on the schedule now');
      // An invite that could not be sent must be SAID, not swallowed: the
      // clinic thinks the owner was invited otherwise.
      if (invite && portal && !portal.invited) {
        toast.error(`Booked, but the portal invite was not sent — ${portal.reason}`);
      }
      setOpenId(null); setDetail(null);
      load();
      // Order does not matter, but all three must happen: the inbox, the cached
      // people the cards name, and the bookings list itself.
      Promise.allSettled([refreshClients?.(), refreshPets?.()]).then(() => onAccepted?.());
    } finally {
      setBusy(false);
    }
  };

  const propose = async (d: SiteRequestDetail) => {
    if (!scheduledAt) return toast.error('Pick the time you want to offer instead');
    setBusy(true);
    try {
      await siteConnectAPI.propose(d.request.id, { proposedAt: new Date(scheduledAt).toISOString(), note: note.trim() || undefined });
      toast.success('New time offered');
      setOpenId(null); setDetail(null); load();
    } finally { setBusy(false); }
  };

  const decline = async (d: SiteRequestDetail) => {
    // `prompt` resolves with the text, or null when cancelled — so an empty
    // string is a real answer ("decline, say nothing"), not a cancel.
    const reason = await dialog.prompt({
      title: 'Decline this request',
      message: 'What should we tell them? This is sent back to the website.',
      label: 'Reason',
      placeholder: 'We are fully booked that day.',
      confirmLabel: 'Decline',
      variant: 'danger',
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await siteConnectAPI.decline(d.request.id, { reason: reason.trim() || undefined });
      toast.success('Declined');
      setOpenId(null); setDetail(null); load();
    } finally { setBusy(false); }
  };

  const spam = async (d: SiteRequestDetail) => {
    const ok = await dialog.confirm({
      title: 'Mark as spam?',
      message: 'It is filed away and nothing at all is sent back — no email, no reply to the website.',
      confirmLabel: 'Mark as spam',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await siteConnectAPI.markSpam(d.request.id);
      setOpenId(null); setDetail(null); load();
    } finally { setBusy(false); }
  };

  const candidate = detail?.candidates.find((c) => c.id === clientChoice) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => { setTab(t.value); setOpenId(null); setDetail(null); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${tab === t.value ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>
              {t.label}
              {t.value && counts[t.value] ? <span className="ml-1.5 text-seafoam">{counts[t.value]}</span> : null}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
          Requests from your website. Nothing is booked until you accept one.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="md" /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Globe size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No website requests</p>
          <p className="text-[11px] text-slate-400 max-w-sm mt-1">
            Connect your website in Clinic Management → Website, and requests your visitors
            send will land here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <button type="button" onClick={() => open(r)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 ${STATUS_TONE[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">
                    {r.pet.name} <span className="text-slate-400 font-bold">({r.pet.species})</span> · {r.owner.name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {r.serviceLabel || 'No service given'} · {new Date(r.preferredDate).toLocaleDateString()}
                    {r.preferredTime ? ` at ${r.preferredTime}` : ''} · {r.reference}
                  </p>
                </div>
                {r.portal.optIn && (
                  <span title="Asked to keep track of their pet's health" className="shrink-0 text-violet-500"><UserPlus size={13} /></span>
                )}
                <ChevronRight size={14} className={`shrink-0 text-slate-300 transition-transform ${openId === r.id ? 'rotate-90' : ''}`} />
              </button>

              {openId === r.id && (
                <div className="border-t border-slate-100 dark:border-zinc-800 p-3 space-y-3">
                  {detailLoading || !detail ? (
                    <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-seafoam" /></div>
                  ) : (
                    <>
                      {/* What they actually sent */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className={LABEL}>What they sent</p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5"><Phone size={11} /> {detail.request.owner.phone}{detail.request.owner.phoneE164 && detail.request.owner.phoneE164 !== detail.request.owner.phone && <span className="text-slate-400">→ {detail.request.owner.phoneE164}</span>}</p>
                          {detail.request.owner.email && <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5"><Mail size={11} /> {detail.request.owner.email}</p>}
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                            {detail.request.pet.name} · {detail.request.pet.species}
                            {detail.request.pet.breed ? ` · ${detail.request.pet.breed}` : ''} · {ageLabel(detail.request.pet.ageMonths)}
                          </p>
                          {detail.request.message && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex gap-1.5"><MessageSquare size={11} className="shrink-0 mt-0.5" /> <span className="italic">"{detail.request.message}"</span></p>
                          )}
                        </div>

                        {/* Who this might already be */}
                        <div className="space-y-1.5">
                          <p className={LABEL}>Who this is</p>
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${CLIENT_STATUS[detail.clientStatus].tone}`}>
                            {CLIENT_STATUS[detail.clientStatus].label}
                          </span>
                          <p className="text-[10px] text-slate-400 leading-relaxed">{CLIENT_STATUS[detail.clientStatus].hint}</p>
                        </div>
                      </div>

                      {detail.request.status === 'ACCEPTED' ? (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
                          <UserCheck size={13} className="text-emerald-600 shrink-0" />
                          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            Already accepted — it is on the schedule.
                          </p>
                        </div>
                      ) : ['DECLINED', 'CANCELLED', 'SPAM'].includes(detail.request.status) ? (
                        <p className="text-[11px] text-slate-400">This request is closed.</p>
                      ) : (
                        <>
                          {/* Match, then confirm */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className={LABEL}>Client file</p>
                              <select className={FIELD} value={clientChoice}
                                onChange={(e) => { setClientChoice(e.target.value); setPetChoice('new'); }}>
                                <option value="new">Create a new client</option>
                                {detail.candidates.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name} · {c.phone}{c.code ? ` · ${c.code}` : ''}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <p className={LABEL}>Patient</p>
                              <select className={FIELD} value={petChoice} onChange={(e) => setPetChoice(e.target.value)}>
                                <option value="new">Create "{detail.request.pet.name}" as a new patient</option>
                                {(candidate?.pets ?? []).map((p) => (
                                  <option key={p.id} value={p.id}>{p.name} · {p.species}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {petChoice === 'new' && (
                            <div>
                              <p className={LABEL}>Date of birth — confirm it</p>
                              <input type="date" className={FIELD} value={dob} onChange={(e) => setDob(e.target.value)} />
                              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                Pre-filled from the {ageLabel(detail.request.pet.ageMonths)} they typed on the website.
                                A patient record keeps this forever, so it is worth asking.
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className={LABEL}>Date and time you are giving them</p>
                              <input type="datetime-local" className={FIELD} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                            </div>
                            <div>
                              <p className={LABEL}>Message back to them (optional)</p>
                              <input className={FIELD} value={note} placeholder="See you then — bring his card."
                                onChange={(e) => setNote(e.target.value)} />
                            </div>
                          </div>

                          {/* The portal conversion */}
                          <label className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${detail.portal.canInvite ? 'border-slate-200 dark:border-zinc-700 cursor-pointer' : 'border-slate-200 dark:border-zinc-800 opacity-60 cursor-not-allowed'}`}>
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-pine"
                              checked={invite}
                              disabled={!detail.portal.canInvite}
                              onChange={(e) => setInvite(e.target.checked)}
                            />
                            <span className="min-w-0">
                              <span className="block text-[11px] font-black text-pine dark:text-zinc-100">
                                Invite them to the pet-owner portal
                                {detail.request.portal.optIn && <span className="ml-1.5 text-violet-500 font-bold">· they asked for this</span>}
                              </span>
                              <span className="block text-[10px] text-slate-400 leading-relaxed mt-0.5">
                                {detail.portal.canInvite
                                  ? "We email them a link to set up their own account — records, reminders and visit history. Nothing is sent until you accept."
                                  : detail.portal.reason}
                              </span>
                            </span>
                          </label>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button type="button" onClick={accept} disabled={busy}
                              className="px-4 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Accept
                            </button>
                            <button type="button" onClick={() => propose(detail)} disabled={busy}
                              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-violet-600 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                              <CalendarClock size={12} /> Offer this time instead
                            </button>
                            <button type="button" onClick={() => decline(detail)} disabled={busy}
                              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-rose-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                              <X size={12} /> Decline
                            </button>
                            <button type="button" onClick={() => spam(detail)} disabled={busy}
                              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-400 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                              <Ban size={12} /> Spam
                            </button>
                          </div>

                          {detail.clientStatus === 'EMAIL_IS_A_STAFF_ACCOUNT' && (
                            <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2.5">
                              <ShieldAlert size={13} className="text-rose-500 shrink-0 mt-0.5" />
                              <p className="text-[10px] text-rose-700 dark:text-rose-300 leading-relaxed">
                                The email on this request belongs to a staff account. You can still book
                                the appointment — but no pet-owner invite will be sent to that address.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SiteRequestsInbox;
