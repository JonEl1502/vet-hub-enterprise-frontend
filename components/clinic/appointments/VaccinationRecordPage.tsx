import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, Plus, ShieldCheck, Syringe } from 'lucide-react';
import toast from 'react-hot-toast';
import { Visit, User, TaskStatus } from '../../../types';
import { vaccinationsAPI, visitsAPI } from '../../../services';
import { VaccinationRecord } from '../../../services/modules/vaccinations.api';
import { useData } from '../../../contexts/DataContext';
import { printElementAsPdf } from '../shared/printPdf';

interface Props {
  appointment: Visit;
  staffMembers: User[];
  // Structural — App's local Clinic type and types.ts Clinic drift apart.
  activeClinic: { name: string; slogan?: string };
  onBack: () => void;
  onChanged?: () => void;
  // Jump back to the visit workflow (finalize + settle live there).
  onOpenAppointment?: (appointmentId: string) => void;
}

const STATUS_META: Record<string, { bg: string; fg: string; label: string }> = {
  ADMINISTERED: { bg: 'bg-emerald-100', fg: 'text-emerald-700', label: 'Administered' },
  SCHEDULED: { bg: 'bg-blue-100', fg: 'text-blue-700', label: 'Scheduled' },
  EXPIRED: { bg: 'bg-red-100', fg: 'text-red-700', label: 'Expired' },
};

const dateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '');

/**
 * Full-page vaccination record — the attending surface for a vaccination
 * encounter (same drawer→page migration as Lab/Imaging/Grooming). Left rail
 * lists + edits this visit's vaccination records (real `vaccinations` API);
 * the main pane renders the official certificate with PDF download.
 */
const VaccinationRecordPage: React.FC<Props> = ({ appointment, staffMembers, activeClinic, onBack, onChanged, onOpenAppointment }) => {
  const { pets, clients } = useData();
  const pet = pets.find(p => String(p.id) === String(appointment.petId)) || (appointment.pet as any);
  const client = clients.find(c => String(c.id) === String(appointment.clientId)) || (appointment.client as any);

  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const load = () => vaccinationsAPI.getByAppointment(String(appointment.id))
    .then(recs => {
      setRecords(recs);
      setSelectedId(prev => prev && recs.some(r => r.id === prev) ? prev : recs[0]?.id ?? null);
      // Reconcile on open — records administered in past sessions complete
      // their visit tasks now (sync used to run only on the click itself).
      syncVisitTasks(recs);
    })
    .catch(() => {})
    .finally(() => setLoaded(true));
  useEffect(() => { load(); }, [appointment.id]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) setPrintMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const recs = await vaccinationsAPI.createFromAppointment(String(appointment.id));
      toast.success(`${recs.length} vaccination record${recs.length !== 1 ? 's' : ''} created`);
      await load(); onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Failed to create vaccination records'); }
    finally { setBusy(false); }
  };

  // Marking a record ADMINISTERED completes its vaccination service task on
  // the visit, so the visit's services progress + finalize gate move with it.
  const syncVisitTasks = async (recs: VaccinationRecord[]) => {
    const norm = (s?: string) => (s || '').trim().toLowerCase();
    const administered = recs.filter(r => r.status === 'ADMINISTERED');
    const allDone = recs.length > 0 && administered.length === recs.length;
    const due = (appointment.tasks || []).filter(t =>
      norm(t.category).includes('vaccin') && t.status !== TaskStatus.COMPLETED &&
      (allDone || administered.some(r => norm(r.vaccineName).includes(norm(t.name)) || norm(t.name).includes(norm(r.vaccineName))))
    );
    if (!due.length) return;
    const results = await Promise.allSettled(due.map(t => visitsAPI.updateTask(Number(appointment.id), Number(t.id), { status: TaskStatus.COMPLETED })));
    if (results.some(r => r.status === 'fulfilled')) {
      toast.success(`Vaccination service${due.length > 1 ? 's' : ''} marked complete on the visit`);
      onChanged?.();
    }
  };

  const patch = async (id: string, data: any) => {
    const next = records.map(r => r.id === id ? { ...r, ...data } : r);
    setRecords(next);
    try {
      await vaccinationsAPI.update(id, data);
      onChanged?.();
      if (data.status === 'ADMINISTERED') await syncVisitTasks(next);
    }
    catch (e: any) { toast.error(e?.message || 'Failed to save'); load(); }
  };

  const rec = records.find(r => r.id === selectedId) || null;
  const administeringStaff = rec ? staffMembers.find(s => String(s.id) === String(rec.administeredById)) : undefined;
  const certSerial = rec ? `VC-${String(rec.id).slice(-6).toUpperCase()}-${String(pet?.id ?? '').padStart(4, '0')}` : '';
  const statusMeta = rec ? (STATUS_META[rec.status] || STATUS_META.SCHEDULED) : STATUS_META.SCHEDULED;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Back
      </button>

      {/* Header banner */}
      <div className="bg-gradient-to-br from-emerald-700 to-teal-600 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><Syringe size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Vaccination visit</p>
          <h1 className="text-xl font-black tracking-tight truncate">{pet?.name ?? 'Patient'}</h1>
          <p className="text-[11px] text-white/70 truncate">{pet?.breed ? `${pet.breed} · ` : ''}{pet?.species ?? ''}{client?.name ? ` · Owner: ${client.name}` : ''}</p>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/15">
          {records.length} record{records.length !== 1 ? 's' : ''}
        </span>
        {onOpenAppointment && (
          <button onClick={() => onOpenAppointment(String(appointment.id))} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">
            Open visit workflow
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Records rail — the attending record: vaccine, batch, dates, by whom. */}
        <div className="lg:col-span-4 space-y-3">
          {loaded && records.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-center shadow-sm">
              <Syringe size={22} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-3">No vaccination records for this visit yet.</p>
              <button onClick={generate} disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm transition-all active:scale-95">
                <Plus size={12} /> {busy ? 'Creating…' : 'Generate from visit services'}
              </button>
            </div>
          )}
          {records.map(r => {
            const m = STATUS_META[r.status] || STATUS_META.SCHEDULED;
            const sel = r.id === selectedId;
            return (
              <div key={r.id} onClick={() => setSelectedId(r.id)}
                className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${sel ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-slate-200 dark:border-zinc-800 hover:border-emerald-300'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black text-pine dark:text-zinc-100 text-sm leading-tight">{r.vaccineName}</p>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${m.bg} ${m.fg}`}>{m.label}</span>
                </div>
                {sel && (
                  <div className="mt-3 grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                    <div className="col-span-2">
                      <label className="field-label">Vaccine</label>
                      <input className="field-input" defaultValue={r.vaccineName} onBlur={e => e.target.value.trim() && e.target.value !== r.vaccineName && patch(r.id, { vaccineName: e.target.value.trim() })} />
                    </div>
                    <div>
                      <label className="field-label">Batch No.</label>
                      <input className="field-input" defaultValue={r.batchNumber || ''} onBlur={e => (e.target.value || '') !== (r.batchNumber || '') && patch(r.id, { batchNumber: e.target.value })} />
                    </div>
                    <div>
                      <label className="field-label">Status</label>
                      <select className="field-select" value={r.status} onChange={e => patch(r.id, { status: e.target.value })}>
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="ADMINISTERED">Administered</option>
                        <option value="EXPIRED">Expired</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Administered</label>
                      <input type="date" className="field-input" defaultValue={dateInput(r.administeredAt)} onBlur={e => e.target.value && patch(r.id, { administeredAt: new Date(e.target.value).toISOString(), status: 'ADMINISTERED' })} />
                    </div>
                    <div>
                      <label className="field-label">Next / Expiry</label>
                      <input type="date" className="field-input" defaultValue={dateInput(r.expiryDate)} onBlur={e => e.target.value && patch(r.id, { expiryDate: new Date(e.target.value).toISOString() })} />
                    </div>
                    <div className="col-span-2">
                      <label className="field-label">Administered by</label>
                      <select className="field-select" value={r.administeredById ? String(r.administeredById) : ''} onChange={e => patch(r.id, { administeredById: e.target.value || undefined })}>
                        <option value="">—</option>
                        {staffMembers.map(s => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {records.length > 0 && (
            <button onClick={generate} disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95">
              <Plus size={12} /> {busy ? 'Checking…' : 'Sync records from visit services'}
            </button>
          )}
        </div>

        {/* Certificate — same official document as the visit modal, full width. */}
        <div className="lg:col-span-8">
          {rec ? (() => {
            const adminDate = rec.administeredAt ? new Date(rec.administeredAt) : null;
            const expDate = new Date(rec.expiryDate);
            const issuedDate = new Date();
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-pine dark:text-zinc-100">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Vaccination Certificate</span>
                  </div>
                  <div className="relative" ref={printMenuRef}>
                    <button onClick={() => setPrintMenuOpen(o => !o)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-sm hover:shadow-md transition-all active:scale-95">
                      <Download size={13} /> Download PDF
                      <ChevronRight size={11} className={`transition-transform ${printMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                    {printMenuOpen && (
                      <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100">
                        <button onClick={() => { setPrintMenuOpen(false); printElementAsPdf('vaccine-cert-page', 'Vaccination Certificate ' + certSerial, false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800">
                          <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-700/40" /> Coloured
                        </button>
                        <button onClick={() => { setPrintMenuOpen(false); printElementAsPdf('vaccine-cert-page', 'Vaccination Certificate ' + certSerial, true); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 border-t border-slate-100 dark:border-zinc-800">
                          <span className="w-3 h-3 rounded-full bg-slate-700 border border-slate-300" /> Black &amp; White
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div id="vaccine-cert-page" className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/40 rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-emerald-600 text-white px-6 py-5 flex items-start justify-between relative overflow-hidden">
                    <div className="absolute -right-6 -bottom-8 opacity-10"><ShieldCheck size={120} /></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} />
                        <p className="text-lg font-black uppercase tracking-tighter">Vaccination Certificate</p>
                      </div>
                      <p className="text-[9px] text-white/70 font-bold mt-1 tracking-wider uppercase">Serial · {certSerial}</p>
                    </div>
                    <div className="relative z-10 text-right">
                      <p className="text-sm font-black uppercase tracking-tight">{activeClinic.name}</p>
                      {activeClinic.slogan && <p className="text-[9px] text-white/70 mt-0.5">{activeClinic.slogan}</p>}
                      <p className="text-[9px] text-white/70 mt-0.5 uppercase tracking-wider">Official Immunization Record</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-emerald-100 dark:divide-emerald-900/30 border-b border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-900/10">
                    <div className="px-5 py-3">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Patient</p>
                      <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase leading-tight">{pet?.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight mt-0.5">{pet?.species}{pet?.breed ? ` · ${pet.breed}` : ''}</p>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {pet?.gender && (
                          <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Sex</p>
                            <p className="text-[10px] font-bold text-pine dark:text-zinc-200">{pet.gender}</p>
                          </div>
                        )}
                        {pet?.age != null && (
                          <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Age</p>
                            <p className="text-[10px] font-bold text-pine dark:text-zinc-200">{pet.age} yr</p>
                          </div>
                        )}
                        {pet?.weight && (
                          <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Weight</p>
                            <p className="text-[10px] font-bold text-pine dark:text-zinc-200">{pet.weight}</p>
                          </div>
                        )}
                      </div>
                      {(pet?.rfidChipNumber || pet?.tagNumber) && (
                        <div className="mt-2 flex gap-3">
                          {pet?.rfidChipNumber && (
                            <div>
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Microchip</p>
                              <p className="text-[10px] font-mono font-bold text-pine dark:text-zinc-200">{pet.rfidChipNumber}</p>
                            </div>
                          )}
                          {pet?.tagNumber && (
                            <div>
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Tag</p>
                              <p className="text-[10px] font-mono font-bold text-pine dark:text-zinc-200">{pet.tagNumber}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Owner</p>
                      <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase leading-tight">{client?.name ?? '—'}</p>
                      <div className="mt-2 space-y-0.5">
                        {client?.phone && (
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400"><span className="font-black text-slate-400 mr-1">PHONE</span>{client.phone}</p>
                        )}
                        {client?.email && (
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400"><span className="font-black text-slate-400 mr-1">EMAIL</span>{client.email}</p>
                        )}
                        {client?.address && (
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400"><span className="font-black text-slate-400 mr-1">ADDR</span>{client.address}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                        <Syringe size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Vaccine Administered</p>
                        <p className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight leading-tight">{rec.vaccineName}</p>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0 self-start ${statusMeta.bg} ${statusMeta.fg}`}>{statusMeta.label}</span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Date Administered</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100">{adminDate ? adminDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Next / Expiry</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100">{expDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Batch No.</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100 font-mono">{rec.batchNumber || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Administered By</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100">{administeringStaff?.name || '—'}</p>
                        {administeringStaff?.role && (
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider">{String(administeringStaff.role).replace('_', ' ')}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-200 dark:border-zinc-700 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Issued On</p>
                      <p className="text-[11px] font-bold text-pine dark:text-zinc-200">{issuedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      <p className="text-[9px] text-slate-400 mt-2 max-w-xs">This certificate is generated from verified clinic records and serves as official proof of immunization for the named animal.</p>
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="w-16 h-16 rounded-full border-2 border-emerald-600 text-emerald-700 flex flex-col items-center justify-center bg-white dark:bg-zinc-900">
                        <ShieldCheck size={22} />
                        <span className="text-[6px] font-black uppercase tracking-widest mt-0.5">Verified</span>
                      </div>
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Clinic Stamp</p>
                    </div>
                  </div>

                  <div className="px-6 py-2 bg-emerald-600 text-white flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest">VetHubCore Enterprise · Clinic-Verified</span>
                    <span className="text-[8px] font-mono tracking-widest">#{certSerial}</span>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center shadow-sm">
              <ShieldCheck size={26} className="mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
              <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500">
                {loaded ? 'Generate the vaccination records to see the certificate here.' : 'Loading records…'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VaccinationRecordPage;
