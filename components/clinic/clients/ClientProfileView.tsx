
import React, { useState, useEffect, useCallback } from 'react';
import { Client, Pet, Visit, ApptStatus, Message, FULL_ACCESS_ROLES, UserRole, ClientType, ClientDiscount } from '../../../types';
import { CLIENT_TYPES, COUNTRIES } from '../../../constants';

const TITLE_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Hon'];
import { Transaction } from '../../../services/modules/transactions.api';
import { clientDiscountsAPI, clientsAPI, messagingAPI, toast, PlatformMessage } from '../../../services';
import { Mail, Phone, MapPin, CreditCard, PawPrint, Calendar, ArrowLeft, ChevronRight, ChevronDown, Play, MessageSquare, Activity, MessageCircle, FileText, Receipt, Edit2, Save, X, Plus, TrendingUp, Clock, Printer, Eye, MoreVertical, CheckCircle2, Map, Shield, Stethoscope, Award, Globe, User, Tag, Percent, Trash2, Bell } from 'lucide-react';
import RemindersApptsTab from '../shared/RemindersApptsTab';
import { formatDate, formatDateTime } from '../../../services/utils/dateFormatter';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  client: Client;
  pets: Pet[];
  transactions: Transaction[];
  appointments: Visit[];
  onBack: () => void;
  initialTab?: string;
  appointmentsUnpaidOnly?: boolean;
  onViewPet: (id: number) => void;
  onOpenMessaging: () => void;
  allMessages: Message[];
  onUpdateClient?: (id: number, data: Partial<Client>) => Promise<void>;
  onProcessPayment?: (apptId: number, method: string) => void;
  onViewAppointment?: (appointmentId: number) => void;
  onOpenMedicalRecord?: (petId: number, visitId: number) => void;
  onManageWorkflow?: (appointmentId: number) => void;
  onScheduleAppointment?: () => void;
  onAddPet?: () => void;
}

const ClientProfileView: React.FC<Props> = ({ client, pets, transactions, appointments, onBack, initialTab = 'overview', appointmentsUnpaidOnly = false, onViewPet, onOpenMessaging, allMessages, onUpdateClient, onProcessPayment, onViewAppointment, onOpenMedicalRecord, onManageWorkflow, onScheduleAppointment, onAddPet }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
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
          <div className="w-[60%] shrink-0">
            <div className="grid grid-cols-3 divide-x divide-seafoam/25">
              <div className="p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-seafoam/10 rounded-lg"><Calendar size={12} className="text-seafoam" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{totalAppointments}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
              </div>
              <div className="p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg"><CheckCircle2 size={12} className="text-emerald-500" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{completedAppointments}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Done</p>
              </div>
              <div className="p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-amber-500/10 rounded-lg"><Clock size={12} className="text-amber-500" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{upcomingAppointments}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Upcoming</p>
              </div>
            </div>
          </div>
          {/* Avg/Visit (owners) or Pets + Last Visit (staff/vets) */}
          {hasFullAccess ? (
            <div className="flex-1 p-3 text-center flex flex-col items-center justify-center">
              <div className="p-1.5 bg-purple-500/10 rounded-lg mb-1.5"><TrendingUp size={12} className="text-purple-500" /></div>
              <p className="text-sm font-black text-pine dark:text-zinc-100 leading-tight mb-0.5">{client.currency} {averageSpendPerVisit.toFixed(0)}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Avg/Visit</p>
            </div>
          ) : (
            <div className="flex-1 p-3 text-center flex flex-col items-center justify-center">
              <div className="p-1.5 bg-cyan-500/10 rounded-lg mb-1.5"><Activity size={12} className="text-cyan-500" /></div>
              {(() => {
                const last = appointments.filter(a => a.status === ApptStatus.COMPLETED).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                return <p className="text-sm font-black text-pine dark:text-zinc-100 leading-tight mb-0.5">{last ? formatDate(last.date) : '—'}</p>;
              })()}
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Last Visit</p>
            </div>
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
                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-2.5 text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Appts</p>
                       <p className="text-lg font-black text-amber-500 leading-none">{client.appointmentCount || appointments.length}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-2.5 text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Completed</p>
                       <p className="text-lg font-black text-emerald-500 leading-none">{completedAppointments}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-2.5 text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Spent</p>
                       <p className="text-sm font-black text-purple-500 leading-none">{client.currency || 'KES'} {client.totalSpent?.toLocaleString() || '0'}</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Risk & Credit — full-width row inside Identity Profile */}
           {(() => {
             const displayType = CLIENT_TYPES.find(t => t.value === client.clientType);
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
                     <div onClick={() => onViewPet(pet.id)} className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shrink-0 aspect-square">{pet.species === 'Dog' ? '🐶' : '🐱'}</div>
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
                               onClick={(e) => { e.stopPropagation(); onViewAppointment(petScheduled[0].id); }}
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
                                       <button onClick={() => { onViewAppointment(appt.id); setOpenUpcomingPetId(null); }} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded text-[7px] font-black uppercase hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
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
             {hasFullAccess ? <CreditCard size={100}/> : <Calendar size={100}/>}
           </div>
           {hasFullAccess ? (
             <>
               <p className="text-mist/40 text-[9px] font-black uppercase tracking-widest mb-2">Lifetime Spending</p>
               <h2 className="text-4xl font-black font-mono tracking-tighter mb-5">{client.currency} {(client.totalSpent || 0).toLocaleString()}</h2>
             </>
           ) : (
             <>
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
             </>
           )}
           <button
            onClick={onOpenMessaging}
            className="w-full bg-white text-pine py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 relative z-10"
           >
            <MessageSquare size={16} /> Messaging Portal
           </button>
        </div>
        
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
      <header className="flex flex-col gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-lg active:scale-95 shrink-0">
             <ArrowLeft size={18}/>
           </button>
           <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <img src={client.avatar} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-2 border-white dark:border-zinc-950 shadow-lg shrink-0 aspect-square" alt="" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{client.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 truncate">
                   Client Profile
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0"></span>
                   ID: {client.id}
                </p>
              </div>
           </div>
           {client.email && (
             <button
               data-tour="client-invite"
               onClick={handleInviteToPortal}
               disabled={inviting || invited}
               title={`Email ${client.email} an invite to the pet-owner portal`}
               className="ml-auto md:ml-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 shrink-0 disabled:opacity-60 border-seafoam text-seafoam hover:bg-seafoam hover:text-white dark:border-zinc-700"
             >
               {invited ? <CheckCircle2 size={12} /> : <Mail size={12} />}
               {inviting ? 'Sending…' : invited ? 'Invite sent' : 'Invite to portal'}
             </button>
           )}
        </div>

        <div data-tour="client-tabs" className="flex w-full bg-slate-50 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-x-auto no-scrollbar scroll-smooth">
           {[
             { id: 'overview', label: 'Summary', icon: Activity },
             { id: 'pets', label: 'Patients', icon: PawPrint },
             { id: 'appointments', label: 'Visits', icon: Calendar },
             { id: 'schedule', label: 'Reminders & Appts', icon: Bell },
             { id: 'medical', label: 'Medical History', icon: FileText },
             ...(hasFullAccess ? [{ id: 'transactions', label: 'Transactions', icon: Receipt }] : []),
             { id: 'discounts', label: 'Discounts', icon: Tag },
             { id: 'outreach', label: 'Messaging', icon: MessageCircle },
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                 activeTab === tab.id
                   ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg'
                   : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-200'
               }`}
             >
               <tab.icon size={12} />
               {tab.label}
             </button>
           ))}
        </div>
      </header>

      <div className="min-h-[50vh]">
        {activeTab === 'overview' && renderOverview()}
        {/* Reminders & appointment bookings across this client's pets — today & future first. */}
        {activeTab === 'schedule' && (
          <RemindersApptsTab
            clientId={client.id}
            petNames={Object.fromEntries(pets.map(p => [String(p.id), p.name]))}
          />
        )}
        {activeTab === 'pets' && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4">
              {pets.length > 0 ? pets.map(pet => (
                <div key={pet.id} onClick={() => onViewPet(pet.id)} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 hover:border-seafoam transition-all cursor-pointer group shadow-sm">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shrink-0 aspect-square">{pet.species === 'Dog' ? '🐶' : '🐱'}</div>
                      <div className="min-w-0 flex-1">
                         <p className="text-pine dark:text-zinc-100 font-black text-lg truncate uppercase">{pet.name}</p>
                         <p className="text-seafoam text-[9px] font-black uppercase tracking-widest">{pet.breed}</p>
                      </div>
                   </div>
                   <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Species</span>
                         <span className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{pet.species}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Age</span>
                         <span className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{pet.age} yrs</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Weight</span>
                         <span className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{pet.weight} kg</span>
                      </div>
                   </div>
                </div>
              )) : (
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
                            {hasFullAccess && !appt.isPaid && onProcessPayment && (
                              <button onClick={() => { setSelectedApptId(appt.id); setShowPaymentModal(true); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                <CreditCard size={13} /> Process Payment
                              </button>
                            )}
                            <div className="mx-3 my-1 border-t border-slate-100 dark:border-zinc-800" />
                            {hasFullAccess && (
                              <button onClick={() => { setDocModal({ type: 'invoice', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                                <Printer size={13} /> Invoice
                              </button>
                            )}
                            {hasFullAccess && appt.isPaid && (
                              <button onClick={() => { setDocModal({ type: 'receipt', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                <Receipt size={13} /> Receipt
                              </button>
                            )}
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
        {activeTab === 'transactions' && (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start animate-in fade-in slide-in-from-right-4">
              {clientTransactions.length > 0 ? clientTransactions.map((tx: any) => (
                <div key={tx.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:border-seafoam transition-all">
                   <div className="flex justify-between items-start mb-4 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Receipt size={18} className="text-emerald-500" />
                         </div>
                         <div className="min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">Transaction #{tx.id}</p>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-1">
                              {formatDate(tx.createdAt || tx.date)} • {tx.method}
                            </p>
                         </div>
                      </div>
                      <div className="text-right shrink-0">
                         <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600">{client.currency} {tx.amount.toLocaleString()}</p>
                         <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20 inline-block mt-1.5">
                           {tx.status || 'SETTLED'}
                         </span>
                      </div>
                   </div>
                   <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-3 items-center justify-between">
                      <div className="flex flex-wrap gap-3">
                        {tx.appointmentId && (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">Visit #{tx.appointmentId}</p>
                           </div>
                        )}
                        {tx.receiptNumber && (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt #</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">{tx.receiptNumber}</p>
                           </div>
                        )}
                        {tx.appointment?.pet && (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pet</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">{tx.appointment.pet.name}</p>
                           </div>
                        )}
                      </div>
                      {tx.appointmentId && onViewAppointment && (
                        <button
                          onClick={() => onViewAppointment(parseInt(tx.appointmentId))}
                          className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors flex items-center gap-1"
                        >
                          View Visit →
                        </button>
                      )}
                   </div>
                </div>
              )) : (
                 <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">
                   No transactions found
                 </div>
              )}
           </div>
        )}
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
                    <div key={d.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 sm:p-5 shadow-sm transition-all ${
                      isActive ? 'border-emerald-300 dark:border-emerald-700/50' :
                      d.isRedeemed ? 'border-blue-200 dark:border-blue-800/40 opacity-70' :
                      'border-red-200 dark:border-red-800/40 opacity-60'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-emerald-500/10' : d.isRedeemed ? 'bg-blue-500/10' : 'bg-red-500/10'
                          }`}>
                            <Tag size={18} className={isActive ? 'text-emerald-500' : d.isRedeemed ? 'text-blue-500' : 'text-red-400'} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">{d.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-lg font-black font-mono ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
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
                      {d.note && (
                        <p className="text-xs text-slate-500 dark:text-zinc-400 italic mt-2 pl-[52px]">"{d.note}"</p>
                      )}
                      {/* Actions */}
                      {isActive && hasFullAccess && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
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

            {(docModal.type === 'invoice' || docModal.type === 'receipt') && (
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
                {docModal.type === 'receipt' && docModal.appt.isPaid && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <Receipt size={14} className="text-emerald-500" />
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">Paid via {docModal.appt.paymentMethod}</p>
                  </div>
                )}
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                  <Printer size={14} /> Print {docModal.type === 'invoice' ? 'Invoice' : 'Receipt'}
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

      {/* Payment Modal */}
      {showPaymentModal && selectedApptId && onProcessPayment && (
        <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in">
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
    // Light poll so owner replies appear while the tab is open.
    const t = setInterval(() => { load(true); messagingAPI.markClientRead(clientId); }, 20000);
    return () => clearInterval(t);
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
