
import React, { useState, useEffect, useCallback } from 'react';
import { Client, Pet, Visit, ApptStatus, Message, FULL_ACCESS_ROLES, UserRole, ClientType, ClientDiscount } from '../../../types';
import { CLIENT_TYPES, COUNTRIES } from '../../../constants';

/**
 * Financials sub-views — ONE row (user, 2026-08-04). It used to be a tab row
 * plus a "Show" chip row that repeated Bills / Invoices / Payments; Payments is
 * a real view now, and Credits / Refunds pin the timeline to that kind.
 */
const FINANCE_TABS = [
  { id: 'transactions', label: 'Overview' },
  { id: 'bills', label: 'Bills' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'credits', label: 'Credits' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'statements', label: 'Statements' },
  { id: 'discounts', label: 'Discounts & Credits' },
];

const TITLE_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Hon'];
import { Transaction } from '../../../services/modules/transactions.api';
import ReconciliationDocument from '../receipts/ReconciliationDocument';
import { printElementAsPdf } from '../shared/printPdf';
import { useClinic } from '../../../contexts/ClinicContext';
import { clientDiscountsAPI, clientsAPI, messagingAPI, toast, PlatformMessage } from '../../../services';
import { uploadsAPI } from '../../../services/modules/uploads.api';
import { Mail, Phone, MapPin, CreditCard, PawPrint, Calendar, ArrowLeft, ChevronRight, ChevronDown, Play, MessageSquare, Activity, MessageCircle, FileText, Receipt, Edit2, Save, X, Plus, TrendingUp, Clock, Printer, Eye, MoreVertical, CheckCircle2, Map, Shield, Stethoscope, Award, Globe, User, Tag, Percent, Trash2, Bell, Star, ScrollText, FolderOpen, Camera, Loader2 } from 'lucide-react';
import RemindersApptsTab from '../shared/RemindersApptsTab';
import ClientPaymentsTab from './ClientPaymentsTab';
import PetAvatar from '../shared/PetAvatar';
import ClientBillsTab from './ClientBillsTab';
import CreditTopUpModal from './CreditTopUpModal';
import { AccountStatCards, AccountFilterBar, useAccountFilters } from './ClientAccountHub';
import ClientAccountHub, { ClientStatementTab, ClientFilesTab, preferredMethod, isSettled } from './ClientAccountHub';
import { ClientBilling } from '../../../services/modules/clients.api';
import { formatDate, formatDateTime } from '../../../services/utils/dateFormatter';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  client: Client;
  pets: Pet[];
  transactions: Transaction[];
  appointments: Visit[];
  onBack: () => void;
  initialTab?: string;
  /** Glow the payment that settled this invoice (arrived from a void attempt). */
  highlightInvoiceId?: string | number | null;
  /** Open this reminder on the Reminders tab, expanded (2026-08-18). */
  focusReminderId?: string | null;
  /**
   * Report the open tab up so the nav entry remembers it and Back returns
   * here as it was, rather than resetting to Overview.
   */
  onTabChange?: (tab: string) => void;
  appointmentsUnpaidOnly?: boolean;
  onViewPet: (id: number) => void;
  onOpenMessaging: () => void;
  allMessages: Message[];
  onUpdateClient?: (id: number, data: Partial<Client>) => Promise<void>;
  onProcessPayment?: (apptId: number, method: string) => void;
  onViewAppointment?: (appointmentId: number) => void;
  onOpenMedicalRecord?: (petId: number, visitId: number) => void;
  onManageWorkflow?: (appointmentId: number) => void;
  /**
   * The read-only visit sheet, kept SEPARATE from `onViewAppointment`.
   *
   * `onViewAppointment` now opens the workflow (user, 2026-08-06: "visit
   * workflow is superior to visit details"), which is right for the generic
   * rows — but this view also renders explicit Workflow / Details PAIRS, and
   * pointing both at the workflow would give two buttons one destination.
   * The Details button in those pairs uses this.
   */
  onViewVisitDetails?: (appointmentId: number) => void;
  /** Open a visit ON its Bill tab, next action pulsed (Financials → Bills). */
  onOpenVisitBill?: (visitId: number) => void;
  onScheduleAppointment?: () => void;
  onAddPet?: () => void;
}

const ClientProfileView: React.FC<Props> = ({ client, pets, transactions, appointments, onBack, initialTab = 'overview', highlightInvoiceId, focusReminderId, onTabChange, appointmentsUnpaidOnly = false, onViewPet, onOpenMessaging, allMessages, onUpdateClient, onProcessPayment, onViewAppointment, onOpenMedicalRecord, onManageWorkflow, onViewVisitDetails, onScheduleAppointment, onAddPet, onOpenVisitBill }) => {
  // This view has no `activeClinic` prop; the printed document still needs a
  // clinic name on it. With a multi-clinic scope the first selected one is the
  // right answer here — the client is being viewed within that scope.
  const { selectedClinics } = useClinic();
  const receiptClinicName = selectedClinics[0]?.name ?? '';
  const [activeTab, setActiveTab] = useState(initialTab);
  /**
   * Cross-tab jump: a payment's INV link asks for "invoices:<visitId>". The tab
   * state lives here, so the compound value is unpacked here rather than every
   * child inventing its own way to reach a sibling tab.
   */
  const [focusInvoiceVisitId, setFocusInvoiceVisitId] = useState<string | null>(null);
  const [focusReceiptNumber, setFocusReceiptNumber] = useState<string | null>(null);
  const goTab = (tab: string) => {
    const [name, arg] = String(tab).split(':');
    setFocusInvoiceVisitId(name === 'invoices' && arg ? arg : null);
    setFocusReceiptNumber(name === 'receipts' && arg ? arg : null);
    setActiveTab(name as any);
    onTabChange?.(name);
  };
  // Shown immediately after upload so the new photo appears without waiting for
  // the parent's client list to refetch.
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  // Mirror the open tab into the navigation entry. Safe to fire on mount too:
  // `rememberNavParams` no-ops when the value has not changed.
  useEffect(() => { onTabChange?.(activeTab); }, [activeTab, onTabChange]);
  // Timeline filters live here so the bar can sit above the cards and tabs.
  const [accountFilters, setAccountFilters] = useAccountFilters();
  const [topUpOpen, setTopUpOpen] = useState(false);
  // "Collect payment" deep-links here with the visits list pre-filtered to unpaid.
  const [unpaidOnly, setUnpaidOnly] = useState(appointmentsUnpaidOnly);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [docModal, setDocModal] = useState<{ type: 'invoice' | 'receipt' | 'medical_record' | 'notes'; appt: Visit } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<Partial<Client>>(client);
  const [isSaving, setIsSaving] = useState(false);
  // Pet-owner portal invite (emails the client an accept link).
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);

  const handleInviteToPortal = async () => {
    setInviting(true);
    try {
      const res: any = await clientsAPI.inviteToPortal(client.id);
      if (res?.success) {
        setInvited(true);
        toast.success(`Portal invite sent to ${client.email}`);
      }
    } catch {
      // 409 (already has account) / 400 (no email) surface via the API's showError toast.
    } finally {
      setInviting(false);
    }
  };

  // Dormant portal account → "log back in" nudge email.
  const [waking, setWaking] = useState(false);
  const [woken, setWoken] = useState(false);
  const handleWakeClient = async () => {
    setWaking(true);
    try {
      const res: any = await clientsAPI.wakePortalClient(client.id);
      if (res?.success) {
        setWoken(true);
        toast.success(`Wake-up email sent to ${client.email}`);
      }
    } catch { /* API layer toasts */ }
    finally { setWaking(false); }
  };
  const [notes, setNotes] = useState<string[]>(
    client.internalNotes ? client.internalNotes.split(',').map(n => n.trim()).filter(Boolean) : []
  );
  const [newNote, setNewNote] = useState('');
  const [openUpcomingPetId, setOpenUpcomingPetId] = useState<number | null>(null);

  // Discount state
  const [discounts, setDiscounts] = useState<ClientDiscount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [discountForm, setDiscountForm] = useState({ name: '', discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED', value: '', expiresAt: '', note: '' });
  const [discountSaving, setDiscountSaving] = useState(false);

  const { user } = useAuth();
  const hasFullAccess = FULL_ACCESS_ROLES.includes(user?.role as UserRole);

  // Account money for the header strip + the Payments hub: one fetch feeds
  // both (the collect flow in ClientPaymentsTab keeps its own copy and calls
  // `loadBilling` back through onChanged so the header stays honest).
  const [billing, setBilling] = useState<ClientBilling | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [billingLoading, setBillingLoading] = useState(true);
  const loadBilling = useCallback(async () => {
    if (!hasFullAccess) { setBillingLoading(false); return; }
    try {
      const [b, c] = await Promise.all([
        clientsAPI.getBilling(client.id, { silent: true } as any),
        clientsAPI.credit(client.id).catch(() => null),
      ]);
      if (b.success && b.data) setBilling(b.data);
      if (c?.success && c.data) setCreditBalance(Number(c.data.balance) || 0);
    } catch { /* header falls back to the client aggregate */ }
    finally { setBillingLoading(false); }
  }, [client.id, hasFullAccess]);
  useEffect(() => { loadBilling(); }, [loadBilling]);

  /**
   * Money that arrived somewhere else — a portal top-up, another till — while
   * this profile was open (user, 2026-08-18).
   *
   * The collect panel reads the credit figure ONCE on load, so a client who
   * topped up through the portal after the page opened was offered KES 0.00 of
   * credit against a balance the header already showed. Nothing was wrong with
   * the data; the screen had no reason to look again.
   *
   * `vethub:stream` is re-broadcast by DataContext from the SSE feed, so any
   * open view can listen without prop-drilling.
   */
  useEffect(() => {
    const onStream = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (detail?.type !== 'client.credit.changed') return;
      // Only if it is THIS client — a busy clinic streams everyone's money.
      if (String(detail?.payload?.clientId ?? '') !== String(client.id)) return;
      loadBilling();
    };
    window.addEventListener('vethub:stream', onStream as EventListener);
    return () => window.removeEventListener('vethub:stream', onStream as EventListener);
  }, [client.id, loadBilling]);

  const money2 = (n: number) =>
    `${client.currency || 'KES'} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lastPayment = (billing?.payments ?? [])
    .filter(p => p.status !== 'VOIDED')
    .sort((a, b) => new Date(b.settledAt || b.createdAt).getTime() - new Date(a.settledAt || a.createdAt).getTime())[0] ?? null;
  const headerOutstanding = billing?.outstanding ?? client.outstandingBalance ?? 0;

  // ── Brought-forward balance (212) ─────────────────────────────────────────
  // Money owed in the system this clinic migrated off. Held apart from
  // headerOutstanding on purpose: that figure is what WE invoiced, and folding
  // in a debt we never billed would misstate it. Actualise turns it into a real
  // invoice, at which point it moves into Outstanding and this disappears.
  const [actualising, setActualising] = useState(false);
  const [legacyCleared, setLegacyCleared] = useState(false);
  const legacyBalance = legacyCleared ? 0 : Number((client as any).legacyBalance ?? 0);
  const legacySource = (client as any).legacyBalanceSource as string | undefined;

  const handleActualise = async () => {
    const cur = client.currency || 'KES';
    if (!window.confirm(
      `Raise an invoice for ${cur} ${legacyBalance.toLocaleString()} carried over from ${legacySource || 'the previous system'}?\n\n` +
      `${client.name} will owe this in VetHub and it will show in reports and ageing. ` +
      `An invoice raised in error has to be voided — it cannot be undone from here.`,
    )) return;
    setActualising(true);
    try {
      const res: any = await clientsAPI.actualiseLegacyBalance(client.id);
      const num = res?.data?.invoiceNumber || res?.invoiceNumber;
      setLegacyCleared(true);
      toast.success(num ? `Invoice ${num} raised` : 'Invoice raised');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not raise the invoice');
    } finally {
      setActualising(false);
    }
  };
  /**
   * Where a visit sits on Bill → Invoice → Payment, for the visit-card menu.
   * The menu used to offer "Process Payment" and "Invoice" on every visit,
   * including one still IN_PROGRESS (user, 2026-08-04: "menu is old old") —
   * actions that either 400 or print a document that does not exist yet.
   */
  const billRowFor = React.useCallback(
    (visitId: number | string) => (billing?.invoices ?? []).find(i => String(i.visitId) === String(visitId)),
    [billing],
  );

  const loadDiscounts = useCallback(async () => {
    setDiscountsLoading(true);
    try {
      const res = await clientDiscountsAPI.getAll(client.id);
      if (res.success && res.data?.discounts) setDiscounts(res.data.discounts);
    } catch {} finally { setDiscountsLoading(false); }
  }, [client.id]);

  useEffect(() => {
    if (activeTab === 'discounts') loadDiscounts();
  }, [activeTab, loadDiscounts]);

  const handleCreateDiscount = async () => {
    if (!discountForm.name || !discountForm.value || !discountForm.expiresAt) return;
    setDiscountSaving(true);
    try {
      const res = await clientDiscountsAPI.create(client.id, {
        name: discountForm.name,
        discountType: discountForm.discountType,
        value: parseFloat(discountForm.value),
        expiresAt: new Date(discountForm.expiresAt).toISOString(),
        note: discountForm.note || undefined,
      });
      if (res.success && res.data?.discount) {
        setDiscounts(prev => [res.data!.discount, ...prev]);
        setDiscountForm({ name: '', discountType: 'PERCENTAGE', value: '', expiresAt: '', note: '' });
        setShowAddDiscount(false);
      }
    } catch {} finally { setDiscountSaving(false); }
  };

  const handleDeleteDiscount = async (discountId: number) => {
    try {
      const res = await clientDiscountsAPI.delete(client.id, discountId);
      if (res.success) setDiscounts(prev => prev.filter(d => d.id !== discountId));
    } catch {}
  };

  // Next upcoming appointment for this client
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextAppointment = appointments
    .filter(a => a.status === ApptStatus.SCHEDULED && new Date(a.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
  const nextApptPet = nextAppointment ? pets.find(p => p.id === nextAppointment.petId) : null;

  const clientMessages = allMessages.filter(m => m.clientId === client.id);

  // Filter transactions from local data (props)
  const clientTransactions = transactions.filter(tx => tx.fromId === client.id || tx.toId === client.id);

  // Calculate statistics - use COMPLETED appointments for accurate metrics
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(a => a.status === ApptStatus.COMPLETED).length;
  const upcomingAppointments = appointments.filter(a => a.status === ApptStatus.SCHEDULED).length;
  // Average spend should only consider completed visits
  const averageSpendPerVisit = completedAppointments > 0 ? client.totalSpent / completedAppointments : 0;

  // Per-pet scheduled appointments for quick workflow access
  const scheduledByPet = pets.map(p => ({
    pet: p,
    scheduled: appointments
      .filter(a => a.petId === p.id && a.status === ApptStatus.SCHEDULED)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  })).filter(x => x.scheduled.length > 0);

  // Calculate visit number per pet based on appointment date order
  const getVisitNumber = (appointment: Visit): number => {
    const petAppointments = appointments
      .filter(a => a.petId === appointment.petId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return petAppointments.findIndex(a => a.id === appointment.id) + 1;
  };

  const handleSave = async () => {
    if (!onUpdateClient) return;
    setIsSaving(true);
    try {
      await onUpdateClient(client.id, editedClient);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update client:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedClient(client);
    setIsEditing(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !onUpdateClient) return;
    const updated = [...notes, newNote.trim()];
    setNotes(updated);
    setNewNote('');
    try { await onUpdateClient(client.id, { internalNotes: updated.join(',') }); } catch {}
  };

  const handleRemoveNote = async (idx: number) => {
    if (!onUpdateClient) return;
    const updated = notes.filter((_, i) => i !== idx);
    setNotes(updated);
    try { await onUpdateClient(client.id, { internalNotes: updated.length > 0 ? updated.join(',') : '' }); } catch {}
  };

const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-2 space-y-4">
        {/* Single summary card: stats + upcoming + identity, sections split by accent dividers */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden divide-y divide-seafoam/25">
        <div data-tour="client-stats" className="flex divide-x divide-seafoam/25">
          {/* Counts — 3 cols */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-3 divide-x divide-seafoam/25">
              <div className="p-2.5 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-seafoam/10 rounded-lg"><Calendar size={12} className="text-seafoam" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{totalAppointments}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
              </div>
              <div className="p-2.5 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg"><CheckCircle2 size={12} className="text-emerald-500" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{completedAppointments}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Done</p>
              </div>
              <div className="p-2.5 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-amber-500/10 rounded-lg"><Clock size={12} className="text-amber-500" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{upcomingAppointments}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Upcoming</p>
              </div>
            </div>
          </div>
          {/* Avg/Visit + Lifetime spend (owners) or Last Visit (staff/vets) */}
          {hasFullAccess ? (
            <>
              <div className="w-[20%] p-2.5 text-center flex flex-col items-center justify-center">
                <div className="p-1.5 bg-purple-500/10 rounded-lg mb-1.5"><TrendingUp size={12} className="text-purple-500" /></div>
                <p className="text-xs font-black text-pine dark:text-zinc-100 leading-tight mb-0.5">{client.currency} {averageSpendPerVisit.toFixed(0)}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Avg/Visit</p>
              </div>
              <div className="w-[24%] p-2.5 text-center flex flex-col items-center justify-center">
                <div className="p-1.5 bg-seafoam/10 rounded-lg mb-1.5"><CreditCard size={12} className="text-seafoam" /></div>
                <p className="text-xs font-black text-pine dark:text-zinc-100 leading-tight mb-0.5">{client.currency} {(client.totalSpent || 0).toLocaleString()}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Lifetime</p>
              </div>
            </>
          ) : (
            <div className="flex-1 p-2.5 text-center flex flex-col items-center justify-center">
              <div className="p-1.5 bg-cyan-500/10 rounded-lg mb-1.5"><Activity size={12} className="text-cyan-500" /></div>
              {(() => {
                const last = appointments.filter(a => a.status === ApptStatus.COMPLETED).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                return <p className="text-sm font-black text-pine dark:text-zinc-100 leading-tight mb-0.5">{last ? formatDate(last.date) : '—'}</p>;
              })()}
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Last Visit</p>
            </div>
          )}
          {/* Quick messaging entry */}
          {onOpenMessaging && (
            <button onClick={onOpenMessaging} title="Messaging Portal" className="px-2.5 flex flex-col items-center justify-center gap-1.5 hover:bg-seafoam/5 transition-colors shrink-0">
              <div className="p-1.5 bg-seafoam/10 rounded-lg"><MessageSquare size={12} className="text-seafoam" /></div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Message</p>
            </button>
          )}
        </div>
        {/* Per-pet scheduled appointment quick access */}
        {scheduledByPet.length > 0 && onViewAppointment && (
        <div data-tour="client-quickaccess">
          <div className="divide-y divide-seafoam/15">
              {scheduledByPet.map(({ pet, scheduled }) => (
                <div key={pet.id} className="px-3 py-2 bg-amber-50/40 dark:bg-amber-900/10">
                  {scheduled.length === 1 ? (
                    <button
                      onClick={() => (onManageWorkflow || onViewAppointment)?.(scheduled[0].id)}
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{pet.species === 'Dog' ? '🐶' : '🐱'}</span>
                        <div className="text-left">
                          <p className="text-[8px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">{pet.name} — {formatDate(scheduled[0].date)}</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"><Play size={9} /> Workflow</span>
                    </button>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setOpenUpcomingPetId(openUpcomingPetId === pet.id ? null : pet.id)}
                        className="w-full flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{pet.species === 'Dog' ? '🐶' : '🐱'}</span>
                          <span className="text-[8px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">{pet.name} — {scheduled.length} Visits</span>
                        </div>
                        <ChevronDown size={12} className={`text-amber-500 transition-transform duration-200 ${openUpcomingPetId === pet.id ? 'rotate-180' : ''}`} />
                      </button>
                      {openUpcomingPetId === pet.id && (
                        <div className="mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden z-20">
                          {scheduled.map(appt => (
                            <button
                              key={appt.id}
                              onClick={() => { (onManageWorkflow || onViewAppointment)?.(appt.id); setOpenUpcomingPetId(null); }}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all border-b last:border-b-0 border-slate-100 dark:border-zinc-800"
                            >
                              <div className="flex items-center gap-2">
                                <Play size={10} className="text-amber-500 shrink-0" />
                                <p className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase">{formatDate(appt.date)}</p>
                              </div>
                              <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider">Go →</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
        )}

        <div data-tour="client-identity" className={`p-4 sm:p-5 transition-all ${isEditing ? 'ring-2 ring-inset ring-seafoam/25' : ''}`}>
           <div className="flex items-center justify-between border-b border-seafoam/20 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <Activity className="text-seafoam" size={20} />
                <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Identity Profile</h3>
              </div>
              <div className="flex items-center gap-2">
                {onUpdateClient && (
                  <button
                    data-tour="client-edit"
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-seafoam/90 transition-all disabled:opacity-50"
                  >
                    {isEditing ? (
                      <>
                        <Save size={12} />
                        {isSaving ? 'Saving...' : 'Save'}
                      </>
                    ) : (
                      <>
                        <Edit2 size={12} />
                        Edit
                      </>
                    )}
                  </button>
                )}
                {isEditing && (
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-300 dark:hover:bg-zinc-700 transition-all"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                )}
              </div>
           </div>
           <div className="space-y-4">
              {/* Avatar (full-width when present) */}
              {client.avatarUrl && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400 shrink-0">
                    <User size={14}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Avatar</p>
                    <div className="flex items-center gap-2">
                      <img src={client.avatarUrl} alt="Client avatar" className="w-8 h-8 rounded-full" />
                      <span className="text-xs text-slate-500 truncate">{client.avatarUrl}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Identity fields — responsive multi-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3">
                 {/* Name components */}
                 {(() => {
                   const computedFullName = [
                     editedClient.title, editedClient.firstName, editedClient.secondName, editedClient.surname,
                   ].filter(Boolean).join(' ').trim();
                   type FieldKind = 'text' | 'select' | 'date' | 'readonly';
                   const fields: Array<{
                     label: string;
                     field: keyof Client;
                     val: any;
                     icon: any;
                     type?: string;
                     kind: FieldKind;
                     options?: { value: string; label: string }[];
                   }> = [
                     { label: 'Title', field: 'title', val: isEditing ? editedClient.title : client.title, icon: User, kind: 'select',
                       options: TITLE_OPTIONS.map(t => ({ value: t, label: t })) },
                     { label: 'First Name', field: 'firstName', val: isEditing ? editedClient.firstName : client.firstName, icon: User, kind: 'text', type: 'text' },
                     { label: 'Second Name', field: 'secondName', val: isEditing ? editedClient.secondName : client.secondName, icon: User, kind: 'text', type: 'text' },
                     { label: 'Surname', field: 'surname', val: isEditing ? editedClient.surname : client.surname, icon: User, kind: 'text', type: 'text' },
                     { label: 'Full Name', field: 'name', val: isEditing ? (computedFullName || '—') : client.name, icon: Activity, kind: 'readonly' },
                     { label: 'Gender', field: 'gender', val: isEditing ? editedClient.gender : client.gender, icon: User, kind: 'select',
                       options: ['Male', 'Female', 'Other'].map(g => ({ value: g, label: g })) },
                     { label: 'Email', field: 'email', val: isEditing ? editedClient.email : client.email, icon: Mail, kind: 'text', type: 'email' },
                     { label: 'Phone', field: 'phone', val: isEditing ? editedClient.phone : client.phone, icon: Phone, kind: 'text', type: 'tel' },
                     { label: 'Address', field: 'address', val: isEditing ? editedClient.address : client.address, icon: MapPin, kind: 'text', type: 'text' },
                     { label: 'Country', field: 'country', val: isEditing ? editedClient.country : client.country, icon: MapPin, kind: 'select',
                       options: COUNTRIES.map(c => ({ value: c.name, label: c.name })) },
                     { label: 'Region', field: 'region', val: isEditing ? editedClient.region : client.region, icon: Globe, kind: 'text', type: 'text' },
                     { label: 'Date of Birth', field: 'dob', val: isEditing ? editedClient.dob : (client.dob ? formatDate(client.dob) : null), icon: Calendar, kind: 'date' },
                   ];
                   return fields.map(i => (
                     <div key={i.label} className="flex items-center gap-3 group">
                        <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400 aspect-square shrink-0"><i.icon size={14}/></div>
                        <div className="min-w-0 flex-1">
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                           {isEditing && i.kind === 'select' ? (
                             <select
                               value={(i.val as string) || ''}
                               onChange={(e) => setEditedClient({ ...editedClient, [i.field]: e.target.value || undefined })}
                               className="w-full text-pine dark:text-zinc-200 font-bold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                             >
                               <option value="">—</option>
                               {i.options!.map(o => (
                                 <option key={o.value} value={o.value}>{o.label}</option>
                               ))}
                             </select>
                           ) : isEditing && i.kind === 'text' ? (
                             <input
                               type={i.type}
                               value={(i.val as string) || ''}
                               onChange={(e) => setEditedClient({ ...editedClient, [i.field]: e.target.value })}
                               className="w-full text-pine dark:text-zinc-200 font-bold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                               autoFocus={i.field === 'firstName'}
                             />
                           ) : isEditing && i.kind === 'date' ? (
                             <input
                               type="date"
                               value={editedClient.dob ? new Date(editedClient.dob).toISOString().split('T')[0] : ''}
                               onChange={(e) => setEditedClient({ ...editedClient, dob: e.target.value })}
                               className="w-full text-pine dark:text-zinc-200 font-bold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                             />
                           ) : (
                             <p className="text-pine dark:text-zinc-200 font-bold text-sm leading-tight truncate">{i.val || '—'}</p>
                           )}
                        </div>
                     </div>
                   ));
                 })()}
                 {/* Lat / Lng — spans full row */}
                 <div className="flex items-start gap-3 sm:col-span-2 xl:col-span-3">
                   <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400 shrink-0"><Map size={14}/></div>
                   <div className="min-w-0 flex-1">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Coordinates</p>
                     {isEditing ? (
                       <div className="flex gap-2">
                         <input
                           type="number"
                           step="any"
                           placeholder="Latitude"
                           value={editedClient.lat ?? ''}
                           onChange={e => setEditedClient({ ...editedClient, lat: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                           className="w-full text-pine dark:text-zinc-200 font-bold text-sm bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                         />
                         <input
                           type="number"
                           step="any"
                           placeholder="Longitude"
                           value={editedClient.lng ?? ''}
                           onChange={e => setEditedClient({ ...editedClient, lng: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                           className="w-full text-pine dark:text-zinc-200 font-bold text-sm bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                         />
                       </div>
                     ) : (
                       <p className="text-pine dark:text-zinc-200 font-bold text-sm leading-tight font-mono">
                         {client.lat && client.lng ? `${client.lat.toFixed(5)}, ${client.lng.toFixed(5)}` : '—'}
                       </p>
                     )}
                   </div>
                 </div>

              </div>

              {/* Metadata — full-width horizontal stat band */}
              <div className="pt-3 border-t border-seafoam/20">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Metadata</p>
                 {/* Joined / Last Visit / Total Pets — counts, spend + completed
                     now live in the stats row above (dedup). */}
                 <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-2.5 text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Joined At</p>
                       <p className="text-sm font-black text-pine dark:text-zinc-200 leading-none">{client.joinedAt ? formatDate(client.joinedAt) : '—'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-2.5 text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Last Visit</p>
                       <p className="text-sm font-black text-pine dark:text-zinc-200 leading-none">{client.lastVisitAt ? formatDate(client.lastVisitAt) : '—'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-2.5 text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Pets</p>
                       <p className="text-lg font-black text-seafoam leading-none">{client.petCount || pets.length}</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Risk & Credit — EDIT inputs only; the read display now lives in the
               right sidebar card (below Messaging Portal, above Recent Activity). */}
           {(() => {
             const displayType = CLIENT_TYPES.find(t => t.value === client.clientType);
             if (!isEditing) return null;
             return (
               <div className="mt-4 pt-3 border-t border-seafoam/20">
                 <div className="flex items-center gap-2 mb-3">
                   <Shield size={14} className={displayType?.color || 'text-slate-400'} />
                   <p className="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-[0.15em]">Risk & Credit</p>
                 </div>
                 {isEditing ? (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     {/* Left: type chips + note */}
                     <div className="space-y-3">
                       <div>
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Client Type</p>
                         <div className="flex flex-wrap gap-1.5">
                           {CLIENT_TYPES.map(t => (
                             <button
                               key={t.value}
                               type="button"
                               onClick={() => setEditedClient({ ...editedClient, clientType: editedClient.clientType === t.value ? undefined : t.value as ClientType })}
                               className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${editedClient.clientType === t.value ? `${t.bg} ${t.color} border-transparent shadow-sm` : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}
                             >
                               {t.icon}{t.label}
                             </button>
                           ))}
                         </div>
                       </div>
                       <textarea
                         rows={2}
                         value={editedClient.clientTypeNote ?? ''}
                         onChange={e => setEditedClient({ ...editedClient, clientTypeNote: e.target.value })}
                         className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-3 py-2 text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam resize-none"
                         placeholder="Notes about this client's type…"
                       />
                     </div>
                     {/* Right: max debt + risk score */}
                     <div className="space-y-3">
                       <div>
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Max Debt ({client.currency})</p>
                         <input
                           type="number" min="0" step="0.01"
                           value={editedClient.maxDebt ?? ''}
                           onChange={e => setEditedClient({ ...editedClient, maxDebt: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                           className="w-full text-sm bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-3 py-2 text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam"
                           placeholder="0.00"
                         />
                       </div>
                       <div>
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Risk Score (0–100)</p>
                         <input
                           type="number" min="0" max="100" step="1"
                           value={editedClient.clientRiskRate ?? ''}
                           onChange={e => setEditedClient({ ...editedClient, clientRiskRate: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                           className="w-full text-sm bg-slate-50 dark:bg-zinc-800 border border-seafoam/40 rounded-lg px-3 py-2 text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam"
                           placeholder="0"
                         />
                       </div>
                     </div>
                   </div>
                 ) : (
                   <div className="flex flex-wrap items-start gap-4">
                     {/* Type badge + note */}
                     <div className="flex-1 min-w-[160px] space-y-1.5">
                       {displayType ? (
                         <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${displayType.bg} ${displayType.color}`}>
                           {displayType.icon}{displayType.label}
                         </span>
                       ) : (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700">
                           Unclassified
                         </span>
                       )}
                       {client.clientTypeNote && (
                         <p className="text-xs text-slate-500 dark:text-zinc-400 italic leading-relaxed">"{client.clientTypeNote}"</p>
                       )}
                     </div>
                     {/* Max Debt chip */}
                     <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-center min-w-[100px]">
                       <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Max Debt</p>
                       <p className={`text-sm font-black ${displayType?.color || 'text-pine dark:text-zinc-100'}`}>
                         {client.maxDebt != null ? `${client.currency} ${client.maxDebt.toLocaleString()}` : '—'}
                       </p>
                     </div>
                     {/* Risk Score chip */}
                     <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-center min-w-[100px]">
                       <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Risk Score</p>
                       <p className={`text-sm font-black ${displayType?.color || 'text-pine dark:text-zinc-100'}`}>
                         {client.clientRiskRate != null ? <>{client.clientRiskRate}<span className="text-[9px] font-bold text-slate-400">/100</span></> : '—'}
                       </p>
                     </div>
                   </div>
                 )}
               </div>
             );
           })()}

        </div>
        </div>

        {/* Map visualization if coordinates exist */}
        {(client.lat && client.lng) && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <Map className="text-cyan" size={20} />
              <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Client Location</h3>
              <span className="ml-auto text-[9px] font-mono text-slate-400">{client.lat.toFixed(5)}, {client.lng.toFixed(5)}</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 h-48">
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${client.lng - 0.015},${client.lat - 0.015},${client.lng + 0.015},${client.lat + 0.015}&layer=mapnik&marker=${client.lat},${client.lng}`}
                width="100%" height="100%"
                title="Client location"
                className="border-0"
                loading="lazy"
              />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                 <PawPrint className="text-cyan" size={20} />
                 <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Registered Pets</h3>
              </div>
              <span className="text-[9px] font-black bg-cyan/10 text-cyan px-2.5 py-1 rounded-lg uppercase tracking-widest">{pets.length} Patients</span>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pets.map(pet => {
                const petScheduled = appointments.filter(a => a.petId === pet.id && a.status === ApptStatus.SCHEDULED).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const hasScheduled = petScheduled.length > 0;
                return (
                  <div key={pet.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${hasScheduled ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-400/60 dark:border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800 hover:border-seafoam'}`}>
                     <div onClick={() => onViewPet(pet.id)} className="shrink-0"><PetAvatar pet={pet} size={36} rounded="rounded-xl" className="group-hover:scale-110 transition-transform" /></div>
                     <div onClick={() => onViewPet(pet.id)} className="min-w-0 flex-1">
                        <p className="text-pine dark:text-zinc-100 font-black text-sm truncate uppercase">{pet.name}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${hasScheduled ? 'text-amber-600 dark:text-amber-400' : 'text-seafoam dark:text-zinc-500'}`}>
                          {hasScheduled ? `${petScheduled.length} Scheduled` : pet.breed}
                        </p>
                     </div>
                     {hasScheduled && onViewAppointment ? (
                       <div className="flex flex-col items-end gap-1 ml-auto shrink-0">
                         {petScheduled.length === 1 ? (
                           <>
                             <button
                               onClick={(e) => { e.stopPropagation(); (onManageWorkflow || onViewAppointment)?.(petScheduled[0].id); }}
                               className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all"
                             >
                               <Play size={9} /> Workflow
                             </button>
                             <button
                               onClick={(e) => { e.stopPropagation(); (onViewVisitDetails || onViewAppointment)(petScheduled[0].id); }}
                               className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                             >
                               <Eye size={9} /> Details
                             </button>
                           </>
                         ) : (
                           <div className="relative">
                             <button
                               onClick={(e) => { e.stopPropagation(); setOpenUpcomingPetId(openUpcomingPetId === pet.id ? null : pet.id); }}
                               className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all"
                             >
                               <Calendar size={9} /> {petScheduled.length} Scheduled
                             </button>
                             {openUpcomingPetId === pet.id && (
                               <div className="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-30 overflow-hidden" onClick={e => e.stopPropagation()}>
                                 {petScheduled.map(appt => (
                                   <div key={appt.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-zinc-800">
                                     <span className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase">{formatDate(appt.date)}</span>
                                     <div className="flex gap-1">
                                       <button onClick={() => { (onManageWorkflow || onViewAppointment)?.(appt.id); setOpenUpcomingPetId(null); }} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500 text-white rounded text-[7px] font-black uppercase hover:bg-amber-600 transition-all">
                                         <Play size={7} /> Workflow
                                       </button>
                                       <button onClick={() => { (onViewVisitDetails || onViewAppointment)(appt.id); setOpenUpcomingPetId(null); }} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded text-[7px] font-black uppercase hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                                         <Eye size={7} /> Details
                                       </button>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     ) : (
                       <ChevronRight size={14} className="ml-auto text-slate-200 group-hover:text-seafoam" onClick={() => onViewPet(pet.id)} />
                     )}
                  </div>
                );
              })}
           </div>
        </div>
      </div>

      <div>
      {/* Single sidebar card: spending/next-visit + activity + notes, accent dividers */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden divide-y divide-seafoam/25">

        <div className="bg-pine p-5 text-white relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
             <Calendar size={100}/>
           </div>
           {/* Next Visit (lifetime spend moved to the stats row above — dedup). */}
           <p className="text-mist/40 text-[9px] font-black uppercase tracking-widest mb-2">Next Visit</p>
           {nextAppointment ? (
             <div className="mb-5">
               <h2 className="text-2xl font-black font-mono tracking-tighter">{formatDate(nextAppointment.date)}</h2>
               {nextApptPet && <p className="text-mist/60 text-[10px] font-black uppercase tracking-widest mt-1">{nextApptPet.name}</p>}
             </div>
           ) : (
             <div className="mb-5">
               <p className="text-mist/60 text-sm font-bold mb-3">No upcoming appointments</p>
               {onScheduleAppointment && (
                 <button
                   onClick={onScheduleAppointment}
                   className="bg-seafoam/20 hover:bg-seafoam/30 text-white border border-seafoam/40 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                 >
                   <Plus size={14} /> Schedule Visit
                 </button>
               )}
             </div>
           )}
           <button
            onClick={onOpenMessaging}
            className="w-full bg-white text-pine py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 relative z-10"
           >
            <MessageSquare size={16} /> Messaging Portal
           </button>
        </div>

        {/* Risk & Credit — read display, relocated here from the identity card. */}
        {!isEditing && (() => {
          const displayType = CLIENT_TYPES.find(t => t.value === client.clientType);
          return (
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={13} className={displayType?.color || 'text-slate-400'} />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk &amp; Credit</h4>
              </div>
              <div className="space-y-2.5">
                <div>
                  {displayType ? (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${displayType.bg} ${displayType.color}`}>{displayType.icon}{displayType.label}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700">Unclassified</span>
                  )}
                  {client.clientTypeNote && <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic mt-1.5 leading-relaxed">"{client.clientTypeNote}"</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl px-3 py-2 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Max Debt</p>
                    <p className={`text-xs font-black ${displayType?.color || 'text-pine dark:text-zinc-100'}`}>{client.maxDebt != null ? `${client.currency} ${client.maxDebt.toLocaleString()}` : '—'}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl px-3 py-2 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Risk Score</p>
                    <p className={`text-xs font-black ${displayType?.color || 'text-pine dark:text-zinc-100'}`}>{client.clientRiskRate != null ? <>{client.clientRiskRate}<span className="text-[8px] font-bold text-slate-400">/100</span></> : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="p-4 sm:p-5">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recent Activity</h4>
           <div className="space-y-3">
              {appointments.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-sm text-slate-400 shrink-0 aspect-square">📅</div>
                   <div className="min-w-0">
                      <p className="text-[10px] font-black text-pine dark:text-zinc-200 truncate uppercase">Visit #{a.id}</p>
                      <p className="text-[8px] font-bold text-slate-400">{formatDate(a.date)}</p>
                   </div>
                   <span className="ml-auto text-[8px] font-black bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md border border-emerald-500/20 uppercase">{a.status}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Internal Notes */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={13} className="text-seafoam" />
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Internal Notes</h4>
          </div>

          {notes.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {notes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2 group">
                  <span className="text-seafoam font-black mt-0.5 shrink-0 text-xs">•</span>
                  <span className="text-xs text-pine dark:text-zinc-200 flex-1 leading-relaxed">{note}</span>
                  {onUpdateClient && (
                    <button
                      onClick={() => handleRemoveNote(idx)}
                      className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                    >
                      <X size={11} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!notes.length && (
            <p className="text-[10px] text-slate-400 dark:text-zinc-600 italic mb-3">No notes yet.</p>
          )}

          {onUpdateClient && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam/30"
              />
              <button
                onClick={handleAddNote}
                className="px-3 py-2 bg-seafoam/10 border border-seafoam/30 text-seafoam rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-seafoam/20 transition-all flex items-center gap-1"
              >
                <Plus size={11} /> Add
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Identity row on top; the tab bar sits BELOW it, full width. */}
      <header className="space-y-4">
        {/* Identity card — avatar + contacts on the left, the account's money
            on the right (reference design, 2026-08-02). */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col xl:flex-row xl:items-start gap-5 xl:gap-8">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
              <button onClick={onBack} className="w-10 h-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-sm active:scale-95 shrink-0 mt-1.5">
                <ArrowLeft size={17}/>
              </button>
              <div className="relative shrink-0 group">
                <img src={avatarOverride || client.avatar} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-white dark:border-zinc-950 shadow-lg aspect-square object-cover" alt="" />
                {/* Change the photo here rather than only in the edit form —
                    this is where you are looking when you notice it is wrong. */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (!file.type.startsWith('image/')) { toast.error('Pick an image file'); return; }
                    setAvatarBusy(true);
                    try {
                      const up = await uploadsAPI.upload(file, 'client');
                      const url = (up as any)?.publicUrl || (up as any)?.url;
                      if (!url) throw new Error('Upload did not return a URL');
                      await clientsAPI.update(Number(client.id), { avatarUrl: url } as any);
                      setAvatarOverride(url);
                      toast.success('Photo updated');
                    } catch (err: any) {
                      toast.error(err?.response?.data?.message || err?.message || 'Could not update the photo');
                    } finally { setAvatarBusy(false); }
                  }}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarBusy}
                  title="Change profile photo"
                  className="absolute inset-0 rounded-full bg-black/45 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-100"
                >
                  {avatarBusy
                    ? <Loader2 size={20} className="animate-spin" />
                    : <span className="flex flex-col items-center gap-0.5"><Camera size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Change</span></span>}
                </button>
                {client.portalStatus === 'active' && (
                  <span title="Active portal account"
                        className="absolute bottom-1 right-1 min-w-[24px] min-h-[24px] rounded-full bg-emerald-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow">
                    P
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-pine dark:text-zinc-100 tracking-tight leading-none truncate">{client.name}</h1>
                  {(() => {
                    const t = CLIENT_TYPES.find(x => x.value === client.clientType);
                    return t ? (
                      <>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${t.bg} ${t.color}`}>{t.label} Client</span>
                        <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                      </>
                    ) : null;
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                  {client.phone && <span className="inline-flex items-center gap-1.5 min-w-0"><Phone size={11} className="text-slate-400 shrink-0" /> {client.phone}</span>}
                  {client.email && <span className="inline-flex items-center gap-1.5 min-w-0 truncate"><Mail size={11} className="text-slate-400 shrink-0" /> <span className="truncate">{client.email}</span></span>}
                  {(client.address || client.region || client.country) && (
                    <span className="inline-flex items-center gap-1.5 min-w-0 truncate"><MapPin size={11} className="text-slate-400 shrink-0" /> <span className="truncate">{[client.address || client.region, client.country].filter(Boolean).join(', ')}</span></span>
                  )}
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                  Joined: {client.joinedAt ? formatDate(client.joinedAt) : '—'}
                  <span className="mx-2 text-slate-200 dark:text-zinc-700">|</span>
                  ID: CL-{String(client.id).padStart(5, '0')}
                </p>
                {/* Portal account row — none → invite · dormant → wake · active → ✓ */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
          {client.portalStatus === 'active' ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-900">
              <CheckCircle2 size={11} /> Portal · Active
            </span>
          ) : client.portalStatus === 'dormant' ? (
            <>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-900">
                <Clock size={11} /> Portal · Dormant
              </span>
              <button
                onClick={handleWakeClient}
                disabled={waking || woken}
                title={`Email ${client.email || 'the client'} a "log back in" nudge`}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-60 border-amber-400 text-amber-600 hover:bg-amber-500 hover:text-white"
              >
                {woken ? <CheckCircle2 size={11} /> : <Bell size={11} />}
                {waking ? 'Sending…' : woken ? 'Nudge sent' : 'Wake client'}
              </button>
            </>
          ) : client.email ? (
            <button
              data-tour="client-invite"
              onClick={handleInviteToPortal}
              disabled={inviting || invited}
              title={`Email ${client.email} an invite to the pet-owner portal`}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-60 border-seafoam text-seafoam hover:bg-seafoam hover:text-white dark:border-zinc-700"
            >
              {invited ? <CheckCircle2 size={12} /> : <Mail size={12} />}
              {inviting ? 'Sending…' : invited ? 'Invite sent' : 'Invite to portal'}
            </button>
          ) : null}
                </div>
              </div>
            </div>

            {/* Financial strip — lifetime spend, what's owed, what's banked,
                and whether the account is live. Money is owner/manager-only. */}
            <div className="shrink-0 w-full xl:w-auto flex flex-col justify-between gap-3">
              {hasFullAccess ? (
                <>
                  <div className={`grid grid-cols-2 ${legacyBalance > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} rounded-xl border border-slate-100 dark:border-zinc-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-zinc-800 overflow-hidden`}>
                    <div className="px-4 py-3 text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Spend (Lifetime)</p>
                      <p className="text-sm font-black font-mono text-pine dark:text-zinc-100 whitespace-nowrap">{money2(client.totalSpent || 0)}</p>
                    </div>
                    {/* The number you owe is the number you click (user,
                        2026-08-04) — straight to the invoices you can settle. */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('invoices')}
                      title={headerOutstanding > 0 ? 'Settle outstanding invoices' : 'Open invoices'}
                      className="px-4 py-3 text-center transition-all hover:bg-rose-50/60 dark:hover:bg-rose-950/20 active:scale-[0.98]"
                    >
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Outstanding Balance</p>
                      <p className={`text-sm font-black font-mono whitespace-nowrap ${headerOutstanding > 0 ? 'text-rose-500' : 'text-pine dark:text-zinc-100'}`}>{money2(headerOutstanding)}</p>
                      {headerOutstanding > 0 && (
                        <p className="text-[7px] font-black uppercase tracking-widest text-rose-400 mt-0.5">Click to settle</p>
                      )}
                    </button>
                    {/* CARRIED OVER (212). Deliberately its own cell rather than
                        folded into Outstanding Balance above: that figure is money
                        THIS clinic invoiced, and quietly adding a debt it never
                        billed would misstate what the client owes. Pressing this
                        raises a real LEGACY invoice, after which the amount moves
                        into Outstanding Balance and this cell disappears. */}
                    {legacyBalance > 0 && (
                      <button type="button" onClick={handleActualise} disabled={actualising}
                        title={`Raise an invoice for the ${legacySource || 'previous system'} balance so it can be collected here`}
                        className="px-4 py-3 text-center transition-all hover:bg-amber-50/60 dark:hover:bg-amber-950/20 active:scale-[0.98] disabled:opacity-50">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Carried Over</p>
                        <p className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">{money2(legacyBalance)}</p>
                        <p className="text-[7px] font-black uppercase tracking-widest text-amber-500 mt-0.5">{actualising ? 'Raising…' : 'Actualise'}</p>
                      </button>
                    )}
                    <button type="button" onClick={() => setTopUpOpen(true)}
                      title="Receive a payment from this client, ahead of any bill"
                      className="px-4 py-3 text-center transition-all hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 active:scale-[0.98]">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Available Credit</p>
                      <p className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{money2(creditBalance)}</p>
                      <p className="text-[7px] font-black uppercase tracking-widest text-emerald-500 mt-0.5">Receive payment</p>
                    </button>
                    <div className="px-4 py-3 text-center flex flex-col items-center justify-between">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Client Status</p>
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
                        client.isActive !== false ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'
                      }`}>{client.isActive !== false ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-2 gap-y-1 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1.5"><CreditCard size={11} className="text-slate-400" /> Last Payment: <span className="text-pine dark:text-zinc-200 font-black">{lastPayment ? formatDate(lastPayment.settledAt || lastPayment.createdAt) : '—'}</span></span>
                    <span className="text-slate-200 dark:text-zinc-700">|</span>
                    <span>Preferred Payment: <span className="text-pine dark:text-zinc-200 font-black">{preferredMethod(billing?.payments ?? [])}</span></span>
                  </div>
                </>
              ) : (
                <span className={`self-start xl:self-end inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                  client.isActive !== false ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'
                }`}>{client.isActive !== false ? 'Active Client' : 'Inactive Client'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar — underline style (reference design). Deep-link ids are
            unchanged: 'transactions' is still the Payments tab. */}
        <div data-tour="client-tabs" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth">
           <div className="flex min-w-max px-2">
             {[
               { id: 'overview', label: 'Overview', icon: Activity },
               { id: 'pets', label: `Pets (${pets.length})`, icon: PawPrint },
               { id: 'appointments', label: 'Visits', icon: Calendar },
               // ONE money tab (user, 2026-08-03). Invoices / Payments /
               // Receipts / Statements / Discounts sat alongside each other AND
               // were repeated as filters inside Payments — five top-level tabs
               // for one subject. They are sub-tabs of Financials now.
               ...(hasFullAccess ? [{ id: 'transactions', label: 'Financials', icon: CreditCard }] : []),
               { id: 'outreach', label: 'Communication', icon: MessageCircle },
               { id: 'files', label: 'Files', icon: FolderOpen },
               { id: 'schedule', label: 'Reminders & Appts', icon: Bell },
               { id: 'medical', label: 'Medical History', icon: Stethoscope },
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`flex items-center gap-2 px-4 py-3.5 text-[9px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition-all ${
                   activeTab === tab.id
                     ? 'border-seafoam text-seafoam'
                     : 'border-transparent text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-200'
                 }`}
               >
                 <tab.icon size={13} />
                 {tab.label}
               </button>
             ))}
           </div>
        </div>
      </header>

      <div className="min-h-[50vh]">
        {activeTab === 'overview' && renderOverview()}
        {/* Reminders & appointment bookings across this client's pets — today & future first. */}
        {activeTab === 'schedule' && (
          <RemindersApptsTab
            clientId={client.id}
            petNames={Object.fromEntries(pets.map(p => [String(p.id), p.name]))}
            focusReminderId={focusReminderId}
          />
        )}
        {activeTab === 'pets' && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4">
              {pets.length > 0 ? pets.map(pet => {
                const petVisits = appointments.filter(a => a.petId === pet.id);
                const petScheduled = petVisits.filter(a => a.status === ApptStatus.SCHEDULED);
                const alerts = [...(pet.allergies ?? []), ...(pet.chronicConditions ?? []), ...((pet as any).healthAlerts ?? [])];
                return (
                <div key={pet.id} onClick={() => onViewPet(pet.id)}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 hover:border-seafoam hover:shadow-md transition-all cursor-pointer group shadow-sm">
                   {/* Identity — photo, name, and what it IS, on one line. The
                       card used to spend a third of its height on an avatar and
                       then list four key/value rows (user, 2026-08-04). */}
                   <div className="flex items-start gap-3">
                      <PetAvatar pet={pet} size={44} rounded="rounded-xl" className="group-hover:scale-105 transition-transform" />
                      <div className="min-w-0 flex-1">
                         <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-pine dark:text-zinc-100 font-black text-base truncate uppercase leading-none">{pet.name}</p>
                            {pet.isAlive === false && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[8px] font-black uppercase tracking-widest">Deceased</span>
                            )}
                            {petScheduled.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 text-[8px] font-black uppercase tracking-widest">
                                {petScheduled.length} scheduled
                              </span>
                            )}
                         </div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-seafoam mt-1 truncate">
                           {[pet.breed, pet.species].filter(Boolean).join(' · ')}
                         </p>
                         <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate">
                           {[pet.gender, pet.age, pet.weight].filter(Boolean).join(' · ') || '—'}
                         </p>
                      </div>
                      <ChevronRight size={14} className="text-slate-200 dark:text-zinc-700 group-hover:text-seafoam shrink-0 mt-1" />
                   </div>

                   {/* The numbers a client's pet card should answer for. */}
                   <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                      {[
                        { l: 'Visits', v: String(petVisits.length), cls: 'text-pine dark:text-zinc-100' },
                        { l: 'Vaccines', v: String((pet as any).vaccinationCount ?? pet.vaccinations?.length ?? 0), cls: 'text-indigo-600 dark:text-indigo-400' },
                        { l: 'Weight', v: pet.weight || '—', cls: 'text-emerald-600 dark:text-emerald-400' },
                      ].map(t => (
                        <div key={t.l} className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl px-2 py-2 text-center">
                           <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{t.l}</p>
                           <p className={`text-sm font-black truncate ${t.cls}`}>{t.v}</p>
                        </div>
                      ))}
                   </div>

                   {alerts.length > 0 && (
                     <div className="flex flex-wrap gap-1 mt-2">
                       {alerts.slice(0, 3).map(a => (
                         <span key={a} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200/70 dark:ring-amber-800/40 text-[8px] font-black uppercase tracking-wider">
                           {a}
                         </span>
                       ))}
                       {alerts.length > 3 && <span className="text-[8px] font-black text-slate-400">+{alerts.length - 3}</span>}
                     </div>
                   )}
                </div>
                );
              }) : (
                 <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
                   <PawPrint size={32} className="text-slate-200 dark:text-zinc-700" />
                   <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No patients registered</p>
                   {onAddPet && (
                     <button
                       onClick={onAddPet}
                       className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-lg"
                     >
                       <Plus size={14} /> Add Patient
                     </button>
                   )}
                 </div>
              )}
           </div>
        )}
        {activeTab === 'appointments' && (() => {
           const visibleAppts = unpaidOnly ? appointments.filter(a => !a.isPaid) : appointments;
           return (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setUnpaidOnly(v => !v)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${unpaidOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-rose-400'}`}>
                  {unpaidOnly ? 'Unpaid only ✕' : 'Show unpaid only'}
                </button>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{visibleAppts.length} {unpaidOnly ? 'unpaid' : 'total'}</span>
              </div>
              {visibleAppts.length > 0 ? (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{visibleAppts.map(appt => {
                const pet = pets.find(p => p.id === appt.petId);
                const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                const servicesCount = appt.tasks.length;
                return (
                <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:border-seafoam transition-all relative">
                   {/* Header */}
                   <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0 aspect-square">
                           {pet?.species === 'Dog' ? '🐶' : '🐱'}
                         </div>
                         <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">{pet?.name || 'Unknown Pet'}</p>
                              {appt.parentAppointmentId && (
                                <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">Follow-up</span>
                              )}
                              <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                appt.status === ApptStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                appt.status === ApptStatus.IN_PROGRESS ? 'bg-cyan/10 text-cyan border-cyan/20' :
                                'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'
                              }`}>{appt.status}</span>
                            </div>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">Visit #{getVisitNumber(appt)} • {formatDate(appt.date)}</p>
                         </div>
                      </div>
                      {/* Action Menu */}
                      <div className="relative shrink-0 ml-2">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === appt.id ? null : appt.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-pine hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === appt.id && (
                          <div className="absolute right-0 top-9 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                            {onViewAppointment && (
                              <button onClick={() => { onViewAppointment(appt.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-seafoam/10 hover:text-seafoam transition-all">
                                <Eye size={13} /> View Visit
                              </button>
                            )}
                            {/* ONE money action, and it is the next act in the
                                chain for THIS visit — not every action at once. */}
                            {hasFullAccess && (() => {
                              const row = billRowFor(appt.id);
                              const settled = row ? isSettled(row as any) : !!appt.isPaid;
                              const invoiced = (row?.invoices?.length ?? 0) > 0;
                              const finalized = !!row?.collectable || settled;
                              const item = (icon: any, label: string, cls: string, run: () => void) => (
                                <button onClick={() => { run(); setOpenMenuId(null); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${cls}`}>
                                  {React.createElement(icon, { size: 13 })} {label}
                                </button>
                              );
                              if (settled) {
                                return (
                                  <>
                                    <div className="mx-3 my-1 border-t border-slate-100 dark:border-zinc-800" />
                                    {item(Receipt, 'Receipt', 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                                      () => setDocModal({ type: 'receipt', appt }))}
                                    {item(Printer, 'Invoice', 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800',
                                      () => setDocModal({ type: 'invoice', appt }))}
                                  </>
                                );
                              }
                              if (!finalized) {
                                // Nothing to bill against yet — say so instead of
                                // offering payment on an unfinalized visit.
                                return (
                                  <>
                                    <div className="mx-3 my-1 border-t border-slate-100 dark:border-zinc-800" />
                                    <p className="px-3 py-2 text-[9px] font-bold text-slate-400 leading-relaxed">
                                      Not finalized — finish the visit to raise its bill.
                                    </p>
                                  </>
                                );
                              }
                              return (
                                <>
                                  <div className="mx-3 my-1 border-t border-slate-100 dark:border-zinc-800" />
                                  {invoiced
                                    ? item(CreditCard, 'Settle invoice', 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                                        () => setActiveTab('invoices'))
                                    : item(FileText, 'Generate invoice', 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                                        () => (onOpenVisitBill ?? onViewAppointment)?.(appt.id))}
                                  {invoiced && item(Printer, 'Invoice', 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800',
                                    () => setDocModal({ type: 'invoice', appt }))}
                                </>
                              );
                            })()}
                            <button onClick={() => { setDocModal({ type: 'medical_record', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-cyan hover:bg-cyan/10 transition-all">
                              <Award size={13} /> Health Certificate
                            </button>
                            <button onClick={() => { setDocModal({ type: 'notes', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                              <MessageSquare size={13} /> Notes
                            </button>
                          </div>
                        )}
                      </div>
                   </div>

                   {/* Body */}
                   <div className="space-y-2">
                      {hasFullAccess && (
                        <div className="flex items-center justify-between">
                          <p className="text-base font-black font-mono text-pine dark:text-zinc-200">{client.currency} {appt.totalCost.toLocaleString()}</p>
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${
                            appt.isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>{appt.isPaid ? 'PAID' : 'UNPAID'}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {appt.tasks.slice(0, 4).map(task => (
                          <span key={task.id} className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 px-2 py-1 rounded-lg border border-slate-100 dark:border-zinc-700">
                            {task.name}
                          </span>
                        ))}
                        {appt.tasks.length > 4 && (
                          <span className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-400 px-2 py-1 rounded-lg">+{appt.tasks.length - 4} more</span>
                        )}
                      </div>
                      {appt.assignedStaff && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Staff: {appt.assignedStaff.name}</p>
                      )}
                   </div>
                   {/* View Certificate */}
                   <button
                     onClick={() => setDocModal({ type: 'medical_record', appt })}
                     className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 w-full flex items-center justify-between text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest hover:text-seafoam dark:hover:text-seafoam transition-colors group"
                   >
                     <span className="flex items-center gap-1.5"><Award size={11} className="group-hover:scale-110 transition-transform" /> View Health Certificate</span>
                     <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                   </button>
                </div>
              )})}</div>) : (
                 <div className="py-16 flex flex-col items-center justify-center gap-4 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
                   <Calendar size={32} className="text-slate-200 dark:text-zinc-700" />
                   <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No appointments scheduled</p>
                   {onScheduleAppointment && (
                     <button
                       onClick={onScheduleAppointment}
                       className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-pine/90 transition-all shadow-lg"
                     >
                       <Plus size={14} /> Schedule Visit
                     </button>
                   )}
                 </div>
              )}
           </div>
        ); })()}
        {activeTab === 'outreach' && (
           <div className="animate-in fade-in slide-in-from-right-4">
              <ClientPlatformThread clientId={client.id} clientName={client.name} onOpenMessaging={onOpenMessaging} />
           </div>
        )}
        {activeTab === 'medical' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start animate-in fade-in slide-in-from-right-4">
              {(() => {
                const medAppts = appointments
                  .filter(a => a.status === ApptStatus.COMPLETED || a.status === ApptStatus.PENDING_PAYMENT)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                if (medAppts.length === 0) return (
                  <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">
                    No medical records found
                  </div>
                );
                return medAppts.map(appt => {
                  const apptPet = pets.find(p => p.id === appt.petId);
                  const allMeds = appt.tasks.flatMap(t => (t.medications ?? []) as any[]);
                  const categories = [...new Set(appt.tasks.map(t => t.category).filter(Boolean))];
                  return (
                    <div
                      key={appt.id}
                      onClick={() => onOpenMedicalRecord?.(appt.petId, appt.id)}
                      title="Open medical record"
                      className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:border-seafoam transition-all ${onOpenMedicalRecord ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0">
                            {apptPet?.species === 'Dog' ? '🐶' : '🐱'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">{apptPet?.name || 'Unknown Pet'}</p>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-1">
                              {formatDate(appt.date)}{appt.time ? ` • ${appt.time}` : ''} • Appt #{appt.id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDocModal({ type: 'medical_record', appt }); }}
                            className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors"
                          >
                            Certificate →
                          </button>
                          {onViewAppointment && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewAppointment(appt.id); }}
                              className="text-[8px] font-black uppercase bg-seafoam/10 text-seafoam px-2 py-1 rounded-lg border border-seafoam/20 hover:bg-seafoam/20 transition-all"
                            >
                              View Appt
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Services</p>
                          <div className="space-y-1">
                            {appt.tasks.map(t => (
                              <div key={t.id} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-seafoam shrink-0" />
                                <p className="text-sm text-slate-700 dark:text-zinc-300">{t.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {categories.map(cat => (
                              <span key={cat} className="text-[7px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20 px-1.5 py-0.5 rounded">{cat}</span>
                            ))}
                          </div>
                        )}
                        {appt.notes && (
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Clinical Notes</p>
                            <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed italic">{appt.notes}</p>
                          </div>
                        )}
                        {allMeds.length > 0 && (
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Medications</p>
                            <div className="flex flex-wrap gap-2">
                              {allMeds.map((m: any, idx: number) => (
                                <span key={idx} className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-1 rounded-lg">
                                  {m.inventoryItem?.name || 'Unknown'}{m.quantity ? ` × ${m.quantity}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
           </div>
        )}
        {/* Payments (tab id stays 'transactions' for deep links): the account
            hub — stat cards, timeline, summary donut, quick actions. */}
        {/* Financials — one tab, five sub-views. */}
        {FINANCE_TABS.some(t => t.id === activeTab) && (
          <div className="space-y-4 mb-4">
            {/* Filters first (user, 2026-08-04), then the account cards, then
                ONE tab row — the old sub-tabs and "Show" chips were two rows
                saying Bills / Invoices / Payments twice. */}
            <AccountFilterBar value={accountFilters} onChange={setAccountFilters} currency={client.currency || 'KES'} />
            <AccountStatCards
              client={client}
              billing={billing}
              credit={creditBalance}
              currency={client.currency || 'KES'}
              onSettle={() => setActiveTab('invoices')}
              onTopUp={() => setTopUpOpen(true)}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {FINANCE_TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                    activeTab === t.id
                      ? 'bg-seafoam text-white border-seafoam'
                      : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:text-seafoam'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {(activeTab === 'transactions' || activeTab === 'credits' || activeTab === 'refunds') && (
          <ClientAccountHub
            client={client}
            billing={billing}
            credit={creditBalance}
            loading={billingLoading}
            currency={client.currency || 'KES'}
            canCollect={hasFullAccess}
            onRefresh={loadBilling}
            onViewVisit={onOpenVisitBill ?? onViewAppointment}
            onGoTab={goTab}
            filters={accountFilters}
            kind={activeTab === 'credits' ? 'CREDIT' : activeTab === 'refunds' ? 'REFUND' : 'ALL'}
          />
        )}
        {activeTab === 'payments' && (
          <ClientPaymentsTab
            clientId={client.id}
            currency={client.currency || 'KES'}
            canCollect={hasFullAccess}
            onViewVisit={onOpenVisitBill ?? onViewAppointment}
            onChanged={loadBilling}
            clientName={client.name}
            clientPhone={client.phone}
            only="payments"
            highlightInvoiceId={highlightInvoiceId}
            onGoTab={goTab}
          />
        )}
        {/* Bills — stage one of Bill → Invoice → Payment → Receipt: the bill
            document per visit, and the button that turns it into an invoice. */}
        {activeTab === 'bills' && (
          <ClientBillsTab
            clientId={client.id}
            currency={client.currency || 'KES'}
            canManage={hasFullAccess}
            onViewVisit={onOpenVisitBill ?? onViewAppointment}
            onGoToVisitBill={onOpenVisitBill}
            onChanged={loadBilling}
          />
        )}
        {/* Invoices: the collect flow — multi-select outstanding invoices into
            ONE reversible payment, printable invoice documents per row. */}
        {activeTab === 'invoices' && (
          <ClientPaymentsTab
            clientId={client.id}
            currency={client.currency || 'KES'}
            canCollect={hasFullAccess}
            onViewVisit={onOpenVisitBill ?? onViewAppointment}
            onChanged={loadBilling}
            clientName={client.name}
            clientPhone={client.phone}
            only="invoices"
            onGoTab={goTab}
            focusVisitId={focusInvoiceVisitId}
          />
        )}
        {activeTab === 'receipts' && (
          <ClientPaymentsTab
            clientId={client.id}
            currency={client.currency || 'KES'}
            canCollect={hasFullAccess}
            onViewVisit={onOpenVisitBill ?? onViewAppointment}
            onChanged={loadBilling}
            clientName={client.name}
            clientPhone={client.phone}
            only="receipts"
            onGoTab={goTab}
            focusReceiptNumber={focusReceiptNumber}
          />
        )}
        {activeTab === 'statements' && (
          <ClientStatementTab clientId={client.id} currency={client.currency || 'KES'} />
        )}
        {activeTab === 'files' && <ClientFilesTab clientId={client.id} canEdit={hasFullAccess} />}
        {activeTab === 'discounts' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {/* Add Discount Button */}
            {hasFullAccess && !showAddDiscount && (
              <button
                onClick={() => setShowAddDiscount(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-lg"
              >
                <Plus size={14} /> Add Discount
              </button>
            )}

            {/* Add Discount Form */}
            {showAddDiscount && (
              <div className="bg-white dark:bg-zinc-900 border border-seafoam/40 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">New Discount</h3>
                  <button onClick={() => setShowAddDiscount(false)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Name *</label>
                    <input
                      type="text"
                      value={discountForm.name}
                      onChange={e => setDiscountForm({ ...discountForm, name: e.target.value })}
                      placeholder="e.g. Loyalty Reward, Senior Citizen"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</label>
                    <div className="flex gap-2">
                      {(['PERCENTAGE', 'FIXED'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDiscountForm({ ...discountForm, discountType: t })}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                            discountForm.discountType === t
                              ? 'bg-seafoam/10 text-seafoam border-seafoam/40'
                              : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          {t === 'PERCENTAGE' ? <><Percent size={11} /> %</> : <>{client.currency || 'KES'}</>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Value *</label>
                    <input
                      type="number"
                      min="0"
                      max={discountForm.discountType === 'PERCENTAGE' ? '100' : undefined}
                      step="0.01"
                      value={discountForm.value}
                      onChange={e => setDiscountForm({ ...discountForm, value: e.target.value })}
                      placeholder={discountForm.discountType === 'PERCENTAGE' ? '15' : '500'}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Expires At *</label>
                    <input
                      type="date"
                      value={discountForm.expiresAt}
                      onChange={e => setDiscountForm({ ...discountForm, expiresAt: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Note (optional)</label>
                    <input
                      type="text"
                      value={discountForm.note}
                      onChange={e => setDiscountForm({ ...discountForm, note: e.target.value })}
                      placeholder="Reason for discount..."
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowAddDiscount(false)} className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-pine transition-colors">Cancel</button>
                  <button
                    onClick={handleCreateDiscount}
                    disabled={discountSaving || !discountForm.name || !discountForm.value || !discountForm.expiresAt}
                    className="flex items-center gap-2 px-5 py-2 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-seafoam/90 transition-all disabled:opacity-50"
                  >
                    <Save size={13} />
                    {discountSaving ? 'Saving...' : 'Create Discount'}
                  </button>
                </div>
              </div>
            )}

            {/* Discounts List */}
            {discountsLoading ? (
              <div className="py-16 text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Loading discounts...</p></div>
            ) : discounts.length > 0 ? (
              <div className="space-y-3">
                {discounts.map(d => {
                  const isExpired = new Date(d.expiresAt) < new Date();
                  const isActive = !d.isRedeemed && !isExpired;
                  return (
                    <div key={d.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-3.5 shadow-sm transition-all ${
                      isActive ? 'border-emerald-300 dark:border-emerald-700/50' :
                      d.isRedeemed ? 'border-blue-200 dark:border-blue-800/40 opacity-70' :
                      'border-red-200 dark:border-red-800/40 opacity-60'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-emerald-500/10' : d.isRedeemed ? 'bg-blue-500/10' : 'bg-red-500/10'
                          }`}>
                            <Tag size={16} className={isActive ? 'text-emerald-500' : d.isRedeemed ? 'text-blue-500' : 'text-red-400'} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">{d.name}</p>
                              <span className={`text-base font-black font-mono ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {d.discountType === 'PERCENTAGE' ? `${d.value}%` : `${client.currency || 'KES'} ${Number(d.value).toLocaleString()}`}
                              </span>
                              <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                                isActive ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                                d.isRedeemed ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {isActive ? 'Active' : d.isRedeemed ? 'Redeemed' : 'Expired'}
                              </span>
                            </div>
                            {d.note && (
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic mt-0.5 truncate">"{d.note}"</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            {isExpired ? 'Expired' : 'Expires'} {formatDate(d.expiresAt)}
                          </p>
                          {d.isRedeemed && d.redeemedAt && (
                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">
                              Redeemed {formatDate(d.redeemedAt)}
                            </p>
                          )}
                          {d.creatorName && (
                            <p className="text-[8px] font-bold text-slate-400">by {d.creatorName}</p>
                          )}
                        </div>
                      </div>
                      {/* Remove sits with the meta, not in a footer band of its
                          own — the card was mostly empty space below the note. */}
                      {isActive && hasFullAccess && (
                        <div className="mt-1.5 flex justify-end">
                          <button
                            onClick={() => handleDeleteDiscount(d.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          >
                            <Trash2 size={10} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
                <Tag size={32} className="mx-auto text-slate-200 dark:text-zinc-700 mb-3" />
                <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No discounts yet</p>
                {hasFullAccess && (
                  <button
                    onClick={() => setShowAddDiscount(true)}
                    className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-lg mx-auto"
                  >
                    <Plus size={14} /> Add First Discount
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {/* Rest of tabs logic mapped to existing profile views */}
      </div>

      {/* Click-outside overlay for action menus */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Document Modal */}
      {docModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[800] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setDocModal(null)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                  {docModal.type === 'invoice' && '📄 Invoice'}
                  {docModal.type === 'receipt' && '🧾 Payment Receipt'}
                  {docModal.type === 'medical_record' && '🏥 Health Certificate'}
                  {docModal.type === 'notes' && '💬 Visit Notes'}
                </h2>
                <p className="text-seafoam text-[9px] font-black uppercase tracking-widest mt-0.5">
                  Visit #{getVisitNumber(docModal.appt)} • {formatDate(docModal.appt.date)}
                </p>
              </div>
              <button onClick={() => setDocModal(null)} className="text-slate-400 hover:text-pine"><X size={18} /></button>
            </div>

            {docModal.type === 'receipt' && (
              <div className="space-y-4">
                {/* 157: receipt when the bill is filled, reconciliation slip when
                    it is not. Replaces a block that showed the visit total as
                    though it were the amount paid, plus a "Paid via X" chip that
                    only rendered when `isPaid` — so a part-paid bill showed
                    nothing at all. */}
                <ReconciliationDocument
                  domId="client-receipt-doc"
                  visitId={docModal.appt.id}
                  clinicName={receiptClinicName}
                  sourceCurrency={client.currency}
                  targetCurrency={client.currency}
                  visitRef={String(getVisitNumber(docModal.appt))}
                  visitDate={formatDate(docModal.appt.date)}
                  client={{ name: client.name, phone: client.phone }}
                  lines={docModal.appt.tasks.map(t => ({ id: t.id, name: t.name, amount: t.price ?? null }))}
                />
                <button
                  onClick={() => printElementAsPdf('client-receipt-doc', `Visit ${getVisitNumber(docModal.appt)} payment`, false)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                  <Printer size={14} /> Print
                </button>
              </div>
            )}

            {docModal.type === 'invoice' && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{client.name}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{formatDate(docModal.appt.date)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Services</p>
                  {docModal.appt.tasks.map(task => (
                    <div key={task.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-xs font-bold text-pine dark:text-zinc-200">{task.name}</span>
                      <span className="text-xs font-black text-pine dark:text-zinc-200">{client.currency} {task.price?.toLocaleString() || '—'}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Total</span>
                    <span className="text-lg font-black text-seafoam">{client.currency} {docModal.appt.totalCost.toLocaleString()}</span>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                  <Printer size={14} /> Print Invoice
                </button>
              </div>
            )}

            {docModal.type === 'medical_record' && (() => {
              const petForAppt = pets.find(p => p.id === docModal.appt.petId);
              const appt = docModal.appt;
              const allMeds = appt.tasks.flatMap(t => (t.medications ?? []) as any[]);
              const categories = [...new Set(appt.tasks.map(t => t.category))];
              return (
                <div className="space-y-0 font-mono">
                  {/* Certificate top bar */}
                  <div className="bg-pine text-white px-5 py-4 rounded-t-xl flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-white/10 rounded-lg"><Shield size={16} /></div>
                      <div>
                        <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Certificate of</p>
                        <p className="text-sm font-black uppercase tracking-tight leading-tight">Veterinary Care</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-white/50 uppercase tracking-widest">Cert No.</p>
                      <p className="text-sm font-black tracking-tight">#{appt.id}</p>
                    </div>
                  </div>

                  {/* Decorative rule */}
                  <div className="h-1.5 bg-gradient-to-r from-seafoam via-cyan to-seafoam" />

                  {/* Body */}
                  <div className="border border-t-0 border-slate-200 dark:border-zinc-700 rounded-b-xl overflow-hidden">
                    {/* Patient + owner */}
                    <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800">
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Patient</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase leading-tight">{petForAppt?.name}</p>
                        <p className="text-[9px] text-slate-500 dark:text-zinc-400">{petForAppt?.species}{petForAppt?.breed ? ` · ${petForAppt.breed}` : ''}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Owner</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100 leading-tight">{client.name}</p>
                        <p className="text-[9px] text-slate-500 dark:text-zinc-400">{client.phone}</p>
                      </div>
                    </div>

                    {/* Date + categories */}
                    <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-zinc-800 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-800/20">
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Visit Date</p>
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100">{formatDate(appt.date)}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Service Categories</p>
                        <div className="flex flex-wrap gap-1">
                          {categories.map(cat => (
                            <span key={cat} className="text-[7px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20 px-1.5 py-0.5 rounded">{cat}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5"><Stethoscope size={9} /> Services Performed</p>
                      <div className="space-y-1">
                        {appt.tasks.map(t => (
                          <div key={t.id} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-seafoam shrink-0" />
                            <p className="text-[10px] text-slate-700 dark:text-zinc-200">{t.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Medications */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Medications Administered</p>
                      {allMeds.length > 0 ? (
                        <div className="space-y-1">
                          {allMeds.map((m: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                              <p className="text-[10px] text-slate-700 dark:text-zinc-200">{m.inventoryItem?.name || 'Unknown'} <span className="text-slate-400">× {m.quantity} {m.inventoryItem?.unit || ''}</span></p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-400 italic">None administered</p>
                      )}
                    </div>

                    {/* Clinical notes */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Clinical Notes</p>
                      <p className="text-[10px] text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {appt.notes || <span className="italic text-slate-300 dark:text-zinc-600">No clinical notes recorded.</span>}
                      </p>
                    </div>

                    {/* Vet signature + status stamp */}
                    <div className="px-4 py-4 flex items-end justify-between">
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-3">Attending Veterinarian</p>
                        <div className="w-32 border-b border-slate-300 dark:border-zinc-600 mb-1" />
                        <p className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{appt.leadStaff?.name || appt.assignedStaff?.name || '—'}</p>
                        <p className="text-[8px] text-slate-400">{appt.leadStaff?.role || 'Veterinarian'}</p>
                      </div>
                      <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 ${appt.status === ApptStatus.COMPLETED ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-amber-400 text-amber-600 dark:text-amber-400'}`}>
                        <CheckCircle2 size={14} />
                        <p className="text-[7px] font-black uppercase tracking-wider mt-0.5 text-center leading-tight">{appt.status === ApptStatus.COMPLETED ? 'Verified' : appt.status}</p>
                      </div>
                    </div>
                  </div>

                  {/* Print */}
                  <button className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                    <Printer size={13} /> Print Certificate
                  </button>
                </div>
              );
            })()}

            {docModal.type === 'notes' && (
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 min-h-[100px]">
                  <p className="text-xs text-slate-500 dark:text-zinc-400 italic">{docModal.appt.notes || 'No notes recorded for this appointment.'}</p>
                </div>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest">Staff: {docModal.appt.assignedStaff?.name || 'Unassigned'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <CreditTopUpModal
        open={topUpOpen}
        clientId={client.id}
        clientName={client.name}
        currency={client.currency || 'KES'}
        currentCredit={creditBalance}
        onClose={() => setTopUpOpen(false)}
        onDone={loadBilling}
      />

      {/* Payment Modal */}
      {showPaymentModal && selectedApptId && onProcessPayment && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
              <header className="text-center mb-8">
                 <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Process Payment</h2>
                 <p className="text-seafoam text-[9px] font-black uppercase mt-1 tracking-widest">Select Payment Method</p>
              </header>
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { value: 'M_PESA', label: 'M-PESA' },
                   { value: 'CARD', label: 'CARD' },
                   { value: 'CASH', label: 'CASH' },
                   { value: 'BANK_TRANSFER', label: 'BANK' }
                 ].map(method => (
                   <button
                    key={method.value}
                    onClick={() => {
                      onProcessPayment(selectedApptId, method.value);
                      setShowPaymentModal(false);
                      setSelectedApptId(null);
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700 hover:border-seafoam transition-all group active:scale-95"
                   >
                     <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg shadow-xs text-slate-300 group-hover:text-seafoam transition-colors"><CreditCard size={24}/></div>
                     <span className="text-[9px] font-black uppercase tracking-widest">{method.label}</span>
                   </button>
                 ))}
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedApptId(null);
                }}
                className="w-full mt-6 py-3 text-slate-400 dark:text-zinc-600 font-black text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors"
              >
                Cancel
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

// Live two-way platform thread with the pet owner — the staff side of the
// portal's Messages chat. Owner bubbles left, clinic bubbles right; opening
// the tab marks the owner's messages read.
const ClientPlatformThread: React.FC<{ clientId: string | number; clientName: string; onOpenMessaging: () => void }> = ({ clientId, clientName, onOpenMessaging }) => {
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await messagingAPI.clientThread(clientId, silent ? { silent: true } : undefined);
      setMessages(res.data?.messages ?? []);
    } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => {
    setLoading(true);
    load();
    messagingAPI.markClientRead(clientId);
    // Light poll so owner replies appear while the tab is open; the SSE
    // stream (below) makes replies land instantly, the poll is the fallback.
    const t = setInterval(() => { load(true); messagingAPI.markClientRead(clientId); }, 20000);
    const onStream = (ev: Event) => {
      const e = (ev as CustomEvent).detail;
      if (e?.type === 'message.new' && String(e?.payload?.clientId ?? '') === String(clientId)) {
        load(true);
        messagingAPI.markClientRead(clientId);
      }
    };
    window.addEventListener('vethub:stream', onStream);
    return () => { clearInterval(t); window.removeEventListener('vethub:stream', onStream); };
  }, [clientId, load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await messagingAPI.send({ clientId, body: body.trim() });
      if (res.data?.message) { setBody(''); await load(true); }
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col" style={{ height: 'min(62vh, 560px)' }}>
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-seafoam/10 flex items-center justify-center text-seafoam shrink-0"><MessageCircle size={18}/></div>
          <div className="min-w-0">
            <p className="text-pine dark:text-zinc-100 font-black text-sm truncate">{clientName}</p>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Portal conversation</p>
          </div>
        </div>
        <button onClick={onOpenMessaging}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-seafoam border border-seafoam/30 rounded-xl hover:bg-seafoam/5 transition-all shrink-0">
          <Plus size={12} /> Broadcast
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600 py-10">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <MessageCircle size={28} className="text-slate-200 dark:text-zinc-700" />
            <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No messages yet</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Messages you send here appear in {clientName}'s pet-owner portal.</p>
          </div>
        ) : messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromOwner ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[78%] p-3 rounded-2xl text-sm font-medium ${
              m.fromOwner
                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-bl-sm'
                : 'bg-seafoam text-white rounded-br-sm'
            }`}>
              {m.subject && <p className="font-black text-xs mb-0.5">{m.subject}</p>}
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              <p className={`text-[9px] mt-1 font-bold ${m.fromOwner ? 'text-slate-400 dark:text-zinc-500' : 'text-white/70'}`}>
                {!m.fromOwner && m.senderName ? `${m.senderName} · ` : ''}{formatDateTime(m.sentAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="p-3 border-t border-slate-100 dark:border-zinc-800 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          rows={1}
          placeholder={`Reply to ${clientName}…`}
          className="field-textarea flex-1"
          style={{ minHeight: '2.6rem', maxHeight: '6rem' }}
        />
        <button type="submit" disabled={busy || !body.trim()}
                className="h-[2.6rem] px-4 bg-seafoam text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-seafoam/90 transition-all disabled:opacity-50 shrink-0">
          Send
        </button>
      </form>
    </div>
  );
};

export default ClientProfileView;
