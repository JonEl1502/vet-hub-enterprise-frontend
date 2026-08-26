import React, { useState, useMemo, useEffect } from 'react';
import { Home, Loader2, Search, ShieldCheck, Dog, ArrowLeft, CalendarClock, Calculator } from 'lucide-react';
import { Pet } from '../../../types';
import { boardingAPI, visitsAPI, clientsAPI, toast } from '../../../services';
import FoodProgramFields, { FoodProgram } from '../shared/FoodProgramFields';
import { VACCINES, hasVaccineRecorded } from '../../../constants/vaccines';
import BoardingIntakeFields, { emptyBoardingIntake, BoardingIntakeValue } from '../shared/BoardingIntakeFields';
import { useData } from '../../../contexts/DataContext';
import { ownerAbbrev } from '../shared/ownerAbbrev';
import PaymentChannelPicker from '../shared/PaymentChannelPicker';
import { PaymentChannel, channelById } from '../shared/paymentChannels';

// Full-page boarding admission — converted from the old full-screen modal so
// admission is a real in-app page (sidebar + breadcrumb stay visible). Callers
// render it IN PLACE of their content while `isOpen` is true.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pets: Pet[];
  onCreated: () => void;
  // When admitting straight from a BOARDING appointment.
  initialPetId?: number;
  appointmentId?: string | number;
  // Clinic-wide default daily rate to pre-fill (overridable per stay).
  defaultRate?: number | null;
}

const AdmitBoardingModal: React.FC<Props> = ({ isOpen, onClose, pets, onCreated, initialPetId, appointmentId, defaultRate }) => {
  const { clients } = useData();
  // "(J.K. Lusisa)" next to the pet so staff confirm it's the right client.
  const ownerAbbrevOf = (pet: Pet) =>
    ownerAbbrev(clients.find(c => String(c.id) === String((pet as any).ownerId ?? (pet as any).owner?.id))?.name);
  const [petId, setPetId] = useState<number | null>(initialPetId ?? null);
  const [petSearch, setPetSearch] = useState('');
  const [dropOffAt, setDropOffAt] = useState(() => new Date().toISOString().slice(0, 16));
  // ONE value object — the shared intake owns every field below drop-off.
  const [intake, setIntake] = useState<BoardingIntakeValue>(() => ({
    ...emptyBoardingIntake(), food: { providedByClient: true },
  }));
  const { gate } = intake;
  const vaccines = gate.vaccines;
  const recommended = gate.recommended;
  const clientAgreed = gate.clientAgreed;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stay ESTIMATE (user spec 7b, 2026-08-03): once the visit's own bill is
  // settled, the stay is quoted up front — (food/day × days) + (rate × days) —
  // and the client either pays it NOW (banked as client credit that discharge
  // billing draws automatically) or pays at pickup.
  const [payChoice, setPayChoice] = useState<'discharge' | 'now'>('discharge');
  /**
   * The CHANNEL is what staff pick ("Pochi", "Cheque"); the `PaymentMethod`
   * enum it settles as is derived from it, so the ledger keeps recording what
   * it always did while reconciliation gains the detail it was missing.
   *
   * This used to be four flat method options (Cash / M-Pesa / Card / Bank
   * transfer) and nothing else — so an estimate taken at the gate was the one
   * payment in the product that could not be told apart from a Paybill after
   * the fact, and carried neither the M-Pesa code nor the paying number. Every
   * other money screen has captured all three since 2026-08-13.
   */
  const [payChannelId, setPayChannelId] = useState('CASH');
  const [payReference, setPayReference] = useState('');
  const [payPayer, setPayPayer] = useState('');
  const estDays = useMemo(() => {
    if (!intake.expectedPickupAt) return null;
    const fromT = dropOffAt ? new Date(dropOffAt).getTime() : Date.now();
    const toT = new Date(intake.expectedPickupAt).getTime();
    if (!(toT > fromT)) return null;
    return Math.max(1, Math.ceil((toT - fromT) / 86_400_000));
  }, [dropOffAt, intake.expectedPickupAt]);
  const estRate = Number(intake.dailyRate) || 0;
  const estFoodPerDay = (!intake.food?.providedByClient && intake.food?.billable !== false)
    ? (Number(intake.food?.ratePerMeal) || 0) * (Number(intake.food?.mealsPerDay) || 0) : 0;
  const estTotal = estDays != null ? (estRate + estFoodPerDay) * estDays : null;

  // Pre-fill the daily rate from the clinic default each time the page opens
  // (only when the user hasn't already typed one).
  useEffect(() => {
    if (isOpen && defaultRate != null) setIntake(v => (v.dailyRate === '' ? { ...v, dailyRate: String(defaultRate) } : v));
  }, [isOpen, defaultRate]);

  // Seed the patient each time the page opens — the component stays mounted,
  // so the useState initializer doesn't re-run when opened from a visit's
  // Boarding chip with a fresh initialPetId.
  useEffect(() => {
    if (isOpen) setPetId(initialPetId ?? null);
  }, [isOpen, initialPetId]);

  const selectedPet = useMemo(() => pets.find(p => String(p.id) === String(petId)) ?? null, [pets, petId]);

  const matches = useMemo(() => {
    const q = petSearch.trim().toLowerCase();
    if (!q) return [] as Pet[];
    return pets.filter(p => p.name?.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q)).slice(0, 8);
  }, [pets, petSearch]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPet) { setError('Select a patient to board.'); return; }
    const clientId = (selectedPet as any).ownerId ?? (selectedPet as any).owner?.id;
    if (!clientId) { setError('This patient has no owner on record.'); return; }
    // Admission gate: intake weight + vaccination check are required —
    // unless staff record a vaccine RECOMMENDATION (logged on the journey).
    if (!gate.intakeWeight || Number(gate.intakeWeight) <= 0) { setError('Intake weight is required.'); return; }
    const recommendedList = VACCINES.filter(v => recommended[v.key]).map(v => v.label);
    if (!hasVaccineRecorded(vaccines) && recommendedList.length === 0) {
      setError('Record a vaccination — or recommend vaccines below to proceed.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await boardingAPI.create({
        petId: selectedPet.id,
        clientId,
        appointmentId,
        dropOffAt: dropOffAt ? new Date(dropOffAt).toISOString() : undefined,
        expectedPickupAt: intake.expectedPickupAt ? new Date(intake.expectedPickupAt).toISOString() : undefined,
        kennel: intake.kennel || undefined,
        dailyRate: intake.dailyRate ? Number(intake.dailyRate) : undefined,
        intakeWeight: gate.intakeWeight ? Number(gate.intakeWeight) : undefined,
        vaccineChecklist: vaccines,
        foodProgram: intake.food,
        belongings: intake.belongings || undefined,
        // NOTE: `temperament` is captured in the shared intake but the boarding
        // API has no column for it yet — it is NOT persisted here. Add a field
        // before relying on it. (S2, 2026-08-03)
        specialInstructions: intake.specialInstructions || undefined,
        feedingInstructions: intake.feedingInstructions || undefined,
        medicationInstructions: intake.medicationInstructions || undefined,
        emergencyContact: intake.emergencyContact || undefined,
      });
      if (res.success) {
        // Estimate prepayment — lands as client credit; the discharge
        // collection draws it before asking for cash (server `useCredit`).
        if (payChoice === 'now' && estTotal != null && estTotal > 0) {
          try {
            await clientsAPI.recordAdvance(clientId, {
              amount: estTotal,
              // Derived from the channel, never picked separately — the enum is
              // the ledger's truth and the channel is a label on it.
              paymentMethod: channelById(payChannelId)?.method ?? 'CASH',
              note: `Boarding estimate prepayment — ${selectedPet.name}, ${estDays} day${estDays === 1 ? '' : 's'} (rate ${estRate}/day${estFoodPerDay ? ` + food ${estFoodPerDay}/day` : ''})`,
              channel: payChannelId,
              // The descriptive note above is kept as the note; the reference is
              // the client's own proof and belongs in its own field, which is
              // what reconciliation searches on.
              ...(payReference.trim() ? { reference: payReference.trim() } : {}),
              ...(payPayer.trim() ? { payer: payPayer.trim() } : {}),
            });
            toast.success(`Estimate collected — banked as client credit; discharge billing draws it automatically`);
          } catch {
            toast.error("Admitted, but the estimate payment failed — record it from the client's Payments tab.");
          }
        }
        // Journey log + (if agreed) vaccination work on the stay's visit.
        const stay: any = (res.data as any)?.stay ?? res.data;
        const apptId = stay?.appointmentId;
        if (apptId && recommendedList.length > 0) {
          visitsAPI.addEvent(apptId, {
            label: `Vaccines recommended at boarding gate: ${recommendedList.join(', ')} — ${clientAgreed ? 'client agreed; added to visit for vaccination' : 'awaiting client decision'}`,
            kind: 'action',
          }).catch(() => {});
          if (clientAgreed) {
            recommendedList.forEach(l => {
              visitsAPI.addTask(Number(apptId), { name: `${l} vaccination`, category: 'Vaccination', price: 0, status: 'PENDING' } as any).catch(() => {});
            });
          }
        }
        onCreated(); onClose();
      }
      else setError(res.message || 'Failed to admit');
    } catch (err: any) {
      setError(err?.message || 'Failed to admit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onClose} disabled={submitting} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Boarding
      </button>

      {/* Header banner */}
      <div className="bg-gradient-to-br from-pine to-seafoam text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><Home size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Boarding admission</p>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2 min-w-0">
            <Dog size={18} className="shrink-0" /> <span className="truncate">{selectedPet ? `${selectedPet.name}` : 'Admit to Boarding'}</span>
          </h1>
          <p className="text-[11px] text-white/70 truncate">
            {selectedPet ? `${selectedPet.breed ? `${selectedPet.breed} · ` : ''}${selectedPet.species ?? ''}` : 'Check a patient in for a boarding stay'}
          </p>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/15 flex items-center gap-1.5">
          <CalendarClock size={12} /> New stay
        </span>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>}

        {/* Patient picker */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <label className="field-label">Patient *</label>
          {selectedPet ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl">
              <span className="flex items-center gap-2 text-sm font-bold text-pine dark:text-zinc-100 min-w-0">
                <Dog size={15} className="text-seafoam shrink-0" />
                <span className="truncate">{selectedPet.name} · {selectedPet.species} <span className="text-slate-400 font-semibold">{ownerAbbrevOf(selectedPet)}</span></span>
              </span>
              <button type="button" onClick={() => { setPetId(null); setPetSearch(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500">Change</button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field-input field-icon-left" placeholder="Search patient by name…" value={petSearch} onChange={e => setPetSearch(e.target.value)} />
              {matches.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                  {matches.map(p => (
                    <button key={p.id} type="button" onClick={() => { setPetId(p.id); setPetSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                      <Dog size={14} className="text-seafoam" /> <span className="font-bold text-pine dark:text-zinc-100">{p.name}</span> <span className="text-slate-400 text-xs">{p.species} · {p.breed}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Drop-off is the only admit-specific field — the wizard's visit
            already carries its date/time. Everything else below is THE shared
            boarding intake, identical to the New Visit gate check
            (user, 2026-08-03: "both must be exactly the same"). */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Drop-off</p>
          <div className="max-w-[260px]">
            <label className="field-label">Drop-off</label>
            <input type="datetime-local" className="field-input" value={dropOffAt} onChange={e => setDropOffAt(e.target.value)} />
          </div>
        </section>

        <BoardingIntakeFields
          value={intake}
          onChange={patch => setIntake(v => ({ ...v, ...patch }))}
          petId={petId}
          petWeight={(selectedPet as any)?.weight ?? null}
          petWeightAt={(selectedPet as any)?.updatedAt ?? null}
        />

        {/* Stay estimate — quoted up front from expected pickup + rate + food
            program; pay now (banks as credit) or at discharge. */}
        {estDays != null && (estRate > 0 || estFoodPerDay > 0) && (
          <section className="bg-white dark:bg-zinc-900 border border-seafoam/30 rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5">
              <Calculator size={13} /> Stay estimate · {estDays} day{estDays === 1 ? '' : 's'}
            </p>
            <div className="space-y-1.5">
              {estRate > 0 && (
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-zinc-300">
                  <span>Boarding — {estRate.toLocaleString()} × {estDays} day{estDays === 1 ? '' : 's'}</span>
                  <span className="font-black font-mono text-pine dark:text-zinc-100">{(estRate * estDays).toLocaleString()}</span>
                </div>
              )}
              {estFoodPerDay > 0 && (
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-zinc-300">
                  <span>Food — {(Number(intake.food?.ratePerMeal) || 0).toLocaleString()} × {Number(intake.food?.mealsPerDay) || 0} meal{(Number(intake.food?.mealsPerDay) || 0) === 1 ? '' : 's'}/day × {estDays} day{estDays === 1 ? '' : 's'}</span>
                  <span className="font-black font-mono text-pine dark:text-zinc-100">{(estFoodPerDay * estDays).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-slate-100 dark:border-zinc-800 text-sm">
                <span className="font-black uppercase tracking-wide text-pine dark:text-zinc-100">Estimated total</span>
                <span className="font-black font-mono text-seafoam">{(estTotal ?? 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([['discharge', 'Pay at discharge'], ['now', 'Collect estimate now']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setPayChoice(v)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    payChoice === v ? 'bg-seafoam text-white border-seafoam' : 'bg-white dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
            {/* Channel + its own reference + who paid — the same trio every
                other money screen captures. Full width under the choice rather
                than inline beside it: it is a grid of grouped options, and
                squeezing it into the button row would wrap on a phone. */}
            {payChoice === 'now' && (
              <PaymentChannelPicker
                className="pt-1"
                value={payChannelId}
                onChange={(c: PaymentChannel) => setPayChannelId(c.id)}
                reference={payReference}
                onReferenceChange={setPayReference}
                payer={payPayer}
                onPayerChange={setPayPayer}
              />
            )}
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
              {payChoice === 'now'
                ? 'Collected now and banked as client credit — the discharge bill draws it automatically; any difference settles then.'
                : 'Nothing collected now — the stay accrues per day and the whole bill settles at pickup.'}
            </p>
          </section>
        )}

        {/* PINNED (user, 2026-08-04) — same treatment as the inpatient gate.
            `sticky`, not `fixed`, so it stays inside the <form> and the submit
            button keeps working; safe-area padding clears the home indicator. */}
        <div className="sticky bottom-0 z-20 flex sm:justify-end gap-3 pt-3 -mx-2 px-2 sm:-mx-4 sm:px-4 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-t border-slate-200 dark:border-zinc-800"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {/* Sized, not stretched. `flex-1` on BOTH made two half-viewport
              slabs on a full-page form — a ~900px primary button reads as a
              banner, not a control, and gives Cancel the same visual weight as
              the action it is meant to be an escape from. The inpatient gate
              took this call on 2026-08-22; this page is full-page too and never
              got it (user, 2026-08-26: "cancle admint buttons too big").
              ⚠️ `flex-1 sm:flex-none` — full-width halves stay on a PHONE,
              where a wide thumb target is the right answer and there is no
              extra room to waste. Only the wide screen sizes them down. */}
          <button type="button" onClick={onClose} disabled={submitting} className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-xs uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 sm:flex-none px-8 py-2.5 bg-seafoam text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-seafoam/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-seafoam/20">
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Admitting…</> : <><Home size={18} /> Admit</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdmitBoardingModal;
