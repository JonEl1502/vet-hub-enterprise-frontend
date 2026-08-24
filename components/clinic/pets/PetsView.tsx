
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Clinic, Pet } from '../../../types';
import { Search, Calendar, Plus, ShieldCheck, Users, Phone, Mail, CalendarPlus, CalendarClock, BellPlus, Edit, Trash2, MoreVertical, RefreshCw, X, Loader2, Filter, ChevronDown, AlertTriangle, ArrowRightLeft, Stethoscope } from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import OrphanedPetsModal from './OrphanedPetsModal';
import TransferClinicModal from '../clinic-mgmt/TransferClinicModal';
import AppointmentCreateModal from '../appointments/AppointmentCreateModal';
import ReminderCreateModal from '../reminders/ReminderCreateModal';
import { useAuth } from '../../../contexts/AuthContext';
import { FULL_ACCESS_ROLES, UserRole } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { petsAPI, remindersAPI, appointmentsAPI } from '../../../services';
import type { Reminder, Appointment } from '../../../services';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import { PaginationMeta } from '../../../services/types/pagination';
import Pagination from '../../shared/common/Pagination';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import ScopeClinicBadge from '../../shared/common/ScopeClinicBadge';
import PetAvatar from '../shared/PetAvatar';

interface Props {
  clinics: Clinic[];
  onViewPet: (id: number, initialTab?: string) => void;
  onGenerateAiSummary: (history: any[]) => void;
  loadingAi: boolean;
  onRegisterPet: () => void;
  onNewAppointment: (clientId: number, petId: number) => void;
  onEditPet?: (id: number) => void;
  onDeletePet?: (id: number) => void;
}

// Compact remaining-days label relative to today (calendar-day based).
const relDays = (iso?: string | null): { text: string; overdue: boolean } => {
  if (!iso) return { text: '', overdue: false };
  const d = new Date(iso);
  const now = new Date();
  const startTarget = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const startToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((startTarget - startToday) / 86400000);
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Tomorrow', overdue: false };
  if (diff > 1) return { text: `in ${diff}d`, overdue: false };
  if (diff === -1) return { text: '1d overdue', overdue: true };
  return { text: `${Math.abs(diff)}d overdue`, overdue: true };
};

const PetsView: React.FC<Props> = ({ clinics, onViewPet, onGenerateAiSummary, loadingAi, onRegisterPet, onNewAppointment, onEditPet, onDeletePet }) => {
  const [searchQuery, setSearchQuery] = useState('');
  // A–Z alphabet filter by patient name ('#' = non-letter start).
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  // Stacked less-used-filters panel (slides from under the primary card).
  const [advOpen, setAdvOpen] = useState(false);
  const { pets, clients, appointments, totals, isLoadingPets, isLoadingClients, refreshPets, ensurePets, ensureClients, ensureAppointments, petStatus, setPetStatus } = useData();
  useEffect(() => { ensurePets(); ensureClients(); ensureAppointments(); }, [ensurePets, ensureClients, ensureAppointments]);

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  /**
   * 100 PER PAGE BY DEFAULT (user, 2026-08-24: "i want it to start here at 100").
   *
   * 10 was chosen when a clinic had tens of records. Westlands Paws has 4,171
   * patients — 418 pages of ten — so the default made the list unusable for
   * exactly the clinics with enough data to need it. Not persisted, so this
   * moves everyone at once rather than only new sessions.
   */
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [showOrphans, setShowOrphans] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Pet | null>(null);
  // Pet whose "New appointment" / "New reminder" modal is open (null = closed).
  const [apptModalPet, setApptModalPet] = useState<Pet | null>(null);
  const [reminderModalPet, setReminderModalPet] = useState<Pet | null>(null);

  // Soonest pending reminder + upcoming appointment booking per pet, for the
  // card badges. Loaded once for the active clinic and grouped by petId.
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [bookings, setBookings] = useState<Appointment[]>([]);
  const loadRemAppts = useCallback(async () => {
    try {
      const [remRes, apptRes] = await Promise.all([
        remindersAPI.list({ status: 'PENDING' }),
        appointmentsAPI.list({}),
      ]);
      if (remRes.success && remRes.data?.reminders) setReminders(remRes.data.reminders);
      if (apptRes.success && apptRes.data?.appointments) setBookings(apptRes.data.appointments);
    } catch { /* card badges are best-effort */ }
  }, []);
  useEffect(() => { loadRemAppts(); }, [loadRemAppts]);

  // petId -> soonest pending reminder (earliest dueAt, incl. overdue).
  const nextReminderByPet = useMemo(() => {
    const m: Record<string, Reminder> = {};
    for (const r of reminders) {
      const cur = m[r.petId];
      if (!cur || new Date(r.dueAt).getTime() < new Date(cur.dueAt).getTime()) m[r.petId] = r;
    }
    return m;
  }, [reminders]);

  // petId -> next upcoming appointment booking (earliest future scheduledAt, active status).
  const nextApptByPet = useMemo(() => {
    const m: Record<string, Appointment> = {};
    const now = Date.now();
    const dead = new Set(['CANCELLED', 'NO_SHOW', 'CONVERTED']);
    for (const a of bookings) {
      if (dead.has(a.status)) continue;
      if (new Date(a.scheduledAt).getTime() < now) continue;
      const cur = m[a.petId];
      if (!cur || new Date(a.scheduledAt).getTime() < new Date(cur.scheduledAt).getTime()) m[a.petId] = a;
    }
    return m;
  }, [bookings]);
  const { user } = useAuth();
  const hasFullAccess = FULL_ACCESS_ROLES.includes((user?.role as UserRole));
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MERCHANT_ADMIN';
  const clinicNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clinics) m.set(String(c.id), c.name);
    return m;
  }, [clinics]);

  type PetFilter = 'all' | 'upcoming' | 'pastCount' | 'hasVaccines' | 'orphaned' | 'withOwner';
  const [petFilter, setPetFilter] = useState<PetFilter>('all');
  const [pastCountMin, setPastCountMin] = useState<number>(3);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [pastCountDialogOpen, setPastCountDialogOpen] = useState(false);
  const [pastCountInput, setPastCountInput] = useState<string>('3');
  const filterContainerRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    };
    if (filterDropdownOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [filterDropdownOpen]);

  const [apiPetResults, setApiPetResults] = useState<Pet[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  const localFiltered = useMemo(() => {
    if (searchQuery.length < 3) return pets;
    const q = searchQuery.toLowerCase();
    return pets.filter(p => {
      // The OWNER counts as a match too (user, 2026-08-24). Staff often know the
      // person, not the animal — and the owner is printed on the card, so a name
      // plainly on screen was one this filter could not find. The API-fallback
      // search below matches on the same fields.
      const o: any = (p as any).owner;
      return (
        p.name.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        (p.breed || '').toLowerCase().includes(q) ||
        (o?.name || '').toLowerCase().includes(q) ||
        (o?.phone || '').toLowerCase().includes(q) ||
        (o?.email || '').toLowerCase().includes(q)
      );
    });
  }, [pets, searchQuery]);

  // API fallback when local search returns nothing
  useEffect(() => {
    if (searchQuery.length < 3 || localFiltered.length > 0) {
      setApiPetResults([]);
      setIsSearchingApi(false);
      return;
    }
    setIsSearchingApi(true);
    const timer = setTimeout(async () => {
      try {
        const res = await petsAPI.getAll({ page: 1, limit: 20, search: searchQuery }, { cache: false });
        if (res.success && res.data?.pets) {
          setApiPetResults(res.data.pets.map((p: any) => ({
            id: typeof p.id === 'string' ? parseInt(p.id) : p.id,
            clinicId: typeof p.clinicId === 'string' ? parseInt(p.clinicId) : p.clinicId,
            ownerId: typeof p.ownerId === 'string' ? parseInt(p.ownerId) : p.ownerId,
            name: String(p.name || ''),
            species: String(p.species || ''),
            breed: String(p.breed || ''),
            gender: (String(p.gender || 'Male')) as 'Male' | 'Female',
            // Age stays EMPTY when unknown. `?? 0` used to turn "we don't know"
            // into "0", which reads as a newborn. Migrated records carry a
            // sentinel dob and the API now returns null age for them.
            age: p.age ?? '',
            dob: p.dob || '',
            weight: p.weightValue != null ? `${p.weightValue}${p.weightUnit || 'kg'}` : (p.weight || ''),
            avatar: String(p.avatarUrl || p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`),
            isActive: p.isActive !== false,
            medicalHistory: [],
            vaccinations: [],
            rfidChipNumber: p.rfidChipNumber || '',
            appointmentCount: p.appointmentCount || 0,
          } as unknown as Pet)));
        } else {
          setApiPetResults([]);
        }
      } catch {
        setApiPetResults([]);
      } finally {
        setIsSearchingApi(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, localFiltered.length]);

  const searchFiltered = useMemo(() => {
    return localFiltered.length > 0 ? localFiltered : apiPetResults;
  }, [localFiltered, apiPetResults]);

  const filtered = useMemo(() => {
    let list = searchFiltered;
    if (dateRange) {
      list = list.filter(pet => {
        const petAppts = appointments.filter(a => a.petId === pet.id);
        return petAppts.some(a => {
          const d = new Date(a.date);
          return d >= dateRange.start && d <= dateRange.end;
        });
      });
    }
    if (petFilter === 'upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter(pet =>
        appointments.some(a =>
          a.petId === pet.id &&
          a.status === ApptStatus.SCHEDULED &&
          new Date(a.date) >= today
        )
      );
    } else if (petFilter === 'pastCount') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter(pet => {
        const pastCount = appointments.filter(a =>
          a.petId === pet.id && new Date(a.date) < today
        ).length;
        return pastCount >= pastCountMin;
      });
    } else if (petFilter === 'hasVaccines') {
      list = list.filter(pet => (pet.vaccinationCount ?? pet.vaccinations?.length ?? 0) > 0);
    } else if (petFilter === 'orphaned' || petFilter === 'withOwner') {
      // An orphan has nobody to bill, remind or call, so being able to LIST
      // them is the difference between fixing a few and never finding them.
      // `ownerId` 0/null both mean unlinked depending on where the row came from.
      const hasOwner = (pet: any) => {
        const o = pet.ownerId;
        return o !== null && o !== undefined && Number(o) > 0;
      };
      list = petFilter === 'orphaned' ? list.filter(p => !hasOwner(p)) : list.filter(hasOwner);
    }
    if (letterFilter) {
      list = list.filter(p => {
        const name = (p.name || '').trim();
        if (letterFilter === '#') return !/^[a-z]/i.test(name);
        return name.toUpperCase().startsWith(letterFilter);
      });
    }
    return list;
  }, [searchFiltered, appointments, dateRange, petFilter, pastCountMin, letterFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, dateRange, petFilter, pastCountMin, letterFilter]);

  /**
   * PAGES BEYOND WHAT IS CACHED ARE FETCHED FROM THE SERVER.
   *
   * DataContext loads the first 1,000 patients, but the page count below comes
   * from the server's TRUE total — so Westlands Paws, with 4,171 patients,
   * offered 418 pages at 10/pg and rendered NOTHING from page 101 on:
   * `filtered.slice(1000, 1010)` of a 1,000-row array is empty. The count was
   * honest and the server was fine; the list was slicing an array that stopped
   * short. Exactly the fault ClientsView fixed on 2026-08-17 — this is that fix,
   * ported. It also makes the larger page sizes real: 1000/pg page 2 is a
   * server fetch, not an empty slice.
   *
   * Only for the UNFILTERED list. Every filter here runs client-side over the
   * cached rows, so once one is active the server's ordering and total no
   * longer describe what is on screen and paging must stay local.
   */
  const [remotePage, setRemotePage] = useState<{ page: number; rows: Pet[] } | null>(null);
  const [loadingRemotePage, setLoadingRemotePage] = useState(false);
  const sliceStart = (currentPage - 1) * itemsPerPage;
  const isUnfilteredForPaging = searchQuery.length < 3 && !dateRange && petFilter === 'all' && !letterFilter;
  const beyondCache = isUnfilteredForPaging && sliceStart >= filtered.length && filtered.length > 0;

  useEffect(() => {
    if (!beyondCache) { setRemotePage(null); return; }
    let cancelled = false;
    setLoadingRemotePage(true);
    petsAPI
      .getAll({ page: currentPage, limit: itemsPerPage, status: petStatus } as any, { cache: false } as any)
      .then((res: any) => {
        if (cancelled) return;
        const raw = res?.data?.pets || res?.data?.data || [];
        // Same normalisation DataContext applies, so a server row renders
        // identically to a cached one (ids are strings over the wire).
        const rows: Pet[] = raw.map((p: any) => ({
          ...p,
          id: parseInt(p.id),
          clinicId: p.clinicId != null ? parseInt(p.clinicId) : undefined,
          ownerId: p.ownerId != null ? parseInt(p.ownerId) : undefined,
        }));
        setRemotePage({ page: currentPage, rows });
      })
      .catch(() => { if (!cancelled) setRemotePage(null); })
      .finally(() => { if (!cancelled) setLoadingRemotePage(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beyondCache, currentPage, itemsPerPage, petStatus]);

  const paginatedPets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    if (beyondCache) return remotePage?.page === currentPage ? remotePage.rows : [];
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage, beyondCache, remotePage]);

  // When the user isn't narrowing the list, trust the server total (so the
  // pagination footer shows e.g. "1-100/200" honestly) AND let totalPages
  // reflect that total so page 2 is reachable. With local filters active,
  // pagination tracks the filtered subset since the server total is irrelevant.
  const isUnfiltered = searchQuery.length < 3 && !dateRange;
  const dbTotal = isUnfiltered && typeof totals.pets === 'number' ? totals.pets : filtered.length;
  const effectiveTotal = Math.max(filtered.length, dbTotal);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / itemsPerPage));
  const paginationMeta: PaginationMeta = {
    currentPage,
    totalPages,
    totalItems: dbTotal,
    itemsPerPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLimitChange = (limit: number) => {
    setItemsPerPage(limit);
    setCurrentPage(1);
  };

  /** Returns all upcoming scheduled visits for a pet, sorted by date */
  const getUpcomingVisits = (petId: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointments
      .filter(a => a.petId === petId && a.status === ApptStatus.SCHEDULED && new Date(a.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      <div className="space-y-4 mb-6 relative z-[55]">
        <div className={`flex flex-col gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-sm stacked-filter-primary ${advOpen ? 'stacked-open bg-white dark:bg-zinc-900' : 'z-[55]'}`}>
          {/* Row 1 — Search alone */}
          <div className="relative group w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search by patient, owner, phone… (min 3 chars)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all font-bold shadow-xs"
            />
            {isSearchingApi && <Loader2 size={14} className="absolute right-9 top-1/2 -translate-y-1/2 text-seafoam animate-spin" />}
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>


          {/* Row 2 — Date picker (full width) */}
          <div className="flex items-center gap-2 w-full">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-full"
              buttonClassName="w-full justify-between"
            />
          </div>

          {/* Row 3 — Filter + Register + Reload.
              Mobile: filter pill on its own row so it isn't squeezed by the
              action buttons; sm+: single row as before. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 relative z-[55]">
            <div className="relative z-[55] sm:flex-1 sm:min-w-0 w-full" ref={filterContainerRef}>
              <button
                onClick={() => setFilterDropdownOpen(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              >
                <Filter size={14} className="text-seafoam shrink-0" />
                <span className="truncate flex-1 min-w-0 text-left">
                  {petFilter === 'all' && 'All Patients'}
                  {petFilter === 'upcoming' && 'Upcoming Visit'}
                  {petFilter === 'pastCount' && `With ${pastCountMin}+ Past Visits`}
                  {petFilter === 'hasVaccines' && 'With Vaccination Records'}
                  {petFilter === 'orphaned' && 'Orphaned — no owner'}
                  {petFilter === 'withOwner' && 'With an owner'}
                </span>
                {petFilter !== 'all' && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setPetFilter('all'); setPastCountDialogOpen(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setPetFilter('all'); setPastCountDialogOpen(false); } }}
                    className="ml-1 p-0.5 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </span>
                )}
                <ChevronDown size={16} className={`transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {filterDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-[min(260px,90vw)] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => { setPetFilter('all'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${petFilter === 'all' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => { setPetFilter('upcoming'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${petFilter === 'upcoming' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      Upcoming Visit
                    </button>
                    <button
                      onClick={() => { setPetFilter('orphaned'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${petFilter === 'orphaned' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      Orphaned — no owner
                    </button>
                    <button
                      onClick={() => { setPetFilter('withOwner'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${petFilter === 'withOwner' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      With an owner
                    </button>
                    <button
                      onClick={() => { setPetFilter('hasVaccines'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${petFilter === 'hasVaccines' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      With Vaccination Records
                    </button>
                    <button
                      onClick={() => {
                        setPastCountInput(String(pastCountMin));
                        setPastCountDialogOpen(true);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${petFilter === 'pastCount' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      With X+ Past Visits…
                    </button>

                    {pastCountDialogOpen && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                        <label className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">
                          Minimum Past Visits
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={pastCountInput}
                          onChange={(e) => setPastCountInput(e.target.value)}
                          autoFocus
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPastCountDialogOpen(false)}
                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const n = Math.max(1, parseInt(pastCountInput, 10) || 1);
                              setPastCountMin(n);
                              setPetFilter('pastCount');
                              setPastCountDialogOpen(false);
                              setFilterDropdownOpen(false);
                            }}
                            className="flex-1 px-4 py-2 bg-seafoam text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-pine transition-all"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Lifecycle filter — segmented control. Defaults to Alive so the
                list hides deceased patients unless explicitly requested. */}
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 w-full sm:w-auto shrink-0">
              {([
                { key: 'alive', label: 'Alive' },
                { key: 'deceased', label: 'Deceased' },
                { key: 'all', label: 'All' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPetStatus(opt.key)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    petStatus === opt.key
                      ? 'bg-seafoam text-white shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100'
                  }`}
                  title={opt.key === 'alive' ? 'Hide deceased patients' : opt.key === 'deceased' ? 'Show only deceased patients' : 'Show every patient'}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Action buttons — grouped so on mobile they share one row. */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                data-tour="pets-register"
                onClick={onRegisterPet}
                className="shrink-0 compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-xs shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-4 sm:px-5 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
              >
                <Plus size={14} className="inline ml-1" /> Register
              </button>
              {hasFullAccess && (
                <button
                  onClick={() => setShowOrphans(true)}
                  className="shrink-0 compact-button bg-white dark:bg-zinc-900 border border-amber-300 text-amber-600 dark:text-amber-400 shadow-sm transition-all active:scale-95 px-3 sm:px-4 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-1.5"
                  title="Find pets whose owner was deleted and reassign them"
                >
                  <AlertTriangle size={14} /> Orphans
                </button>
              )}
              {/* Icon-only: an explicit 36×36 square, which is the house
                  control height. `compact-button`'s px-4/py-2 around a 14px
                  icon left it shorter and tighter than the Register/Orphans
                  pills beside it, which reads as squeezed at every width
                  (user, 2026-08-24).
                  ⚠️ `self-stretch aspect-square` was tried first and is WRONG
                  here — measured 16px wide on staging. A flex item resolves its
                  MAIN size (width, in a row) from content before the cross-axis
                  stretch happens, so `aspect-ratio` has no height to derive a
                  width from and the button collapses to its icon. A fixed
                  square cannot collapse. */}
              <button
                onClick={() => refreshPets()}
                disabled={isLoadingPets || isLoadingClients}
                className="shrink-0 compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center justify-center active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed w-9 h-9 p-0 ml-auto sm:ml-0"
                title="Refresh pet data"
              >
                <RefreshCw size={14} className={isLoadingPets || isLoadingClients ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Toggle for the stacked A–Z / less-used filters panel below. */}
          <button
            type="button"
            onClick={() => setAdvOpen(v => !v)}
            className={`self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              letterFilter ? 'bg-seafoam text-white' : 'text-slate-400 hover:text-pine dark:hover:text-zinc-200'
            }`}
          >
            🔎 More filters {letterFilter ? '· on' : ''} {advOpen ? '▲' : '▼'}
          </button>
        </div>

        {/* Stacked panel — slides out from UNDER the primary card. */}
        {advOpen && (
          <div className="stacked-filter-panel bg-slate-100/80 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl px-4 pb-2.5 space-y-2">
            {/* A–Z alphabet filter (by patient name) */}
            <div className="flex flex-wrap items-center gap-1">
              {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'].map(L => {
                const active = L === 'ALL' ? !letterFilter : letterFilter === L;
                return (
                  <button
                    key={L}
                    onClick={() => setLetterFilter(L === 'ALL' ? null : L)}
                    className={`min-w-[26px] px-1.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${active ? 'bg-seafoam text-white shadow-sm' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-seafoam hover:border-seafoam/40'}`}
                  >
                    {L}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isLoadingPets || isLoadingClients || loadingRemotePage ? (
        <div className="py-32">
          <LoadingSpinner size="lg" message="Loading patients..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-visible">
          {isSearchingApi && (
            <div className="flex items-center justify-center gap-2 py-3 border-b border-slate-100 dark:border-zinc-800">
              <Loader2 size={14} className="animate-spin text-seafoam" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Searching server...</p>
            </div>
          )}
          {paginationMeta.totalItems > 10 && paginationMeta.totalPages > 1 && (
            <div className="px-4 pt-4">
              <Pagination meta={paginationMeta} onPageChange={handlePageChange} compact />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-visible">
            {paginatedPets.map((pet, index) => {
              /**
               * THE PET CARRIES ITS OWNER — trust that first (216).
               *
               * This was `clients.find(c => c.id === pet.ownerId)` alone, and
               * `clients` is only the page DataContext has loaded. On a clinic
               * with 4,171 patients most owners are not in it, so a card for a
               * client who is right there in the pet payload rendered
               * "External" with a blank phone (user, 2026-08-24). The lookup
               * stays as the fallback — it carries fields the embedded owner
               * does not.
               */
              const cachedOwner = clients.find(c => c.id === pet.ownerId);
              const owner = (pet as any).owner
                ? { ...(cachedOwner || {}), ...(pet as any).owner }
                : cachedOwner;
              const upcomingVisits = getUpcomingVisits(pet.id);
              const upcomingVisit = upcomingVisits[0];
              const extraVisits = upcomingVisits.length - 1;
              const isVaccination = upcomingVisit?.tasks?.some((t: any) => t.category.toLowerCase().includes('vac'));
              const isDeceased = pet.isAlive === false;
              const nextAppt = nextApptByPet[String(pet.id)];
              const nextReminder = nextReminderByPet[String(pet.id)];
              const apptRel = relDays(nextAppt?.scheduledAt);
              const reminderRel = relDays(nextReminder?.dueAt);

              return (
                <motion.div
                  key={pet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => onViewPet(pet.id)}
                  role="button"
                  className={`compact-card overflow-visible hover:z-[50] cursor-pointer ${
                    isDeceased
                      ? '!bg-red-50/60 dark:!bg-red-950/20 border-red-300 dark:border-red-800/60 shadow-[0_0_0_2px_rgba(239,68,68,0.18),0_4px_20px_rgba(239,68,68,0.12)] hover:shadow-[0_0_0_2px_rgba(239,68,68,0.35),0_8px_28px_rgba(239,68,68,0.22)] hover:!border-red-400'
                      : upcomingVisit
                        ? isVaccination
                          ? 'border-indigo-200 dark:border-indigo-800/60 shadow-[0_0_0_2px_rgba(129,140,248,0.18),0_4px_20px_rgba(129,140,248,0.12)] hover:shadow-[0_0_0_2px_rgba(129,140,248,0.4),0_8px_28px_rgba(129,140,248,0.22)]'
                          : 'border-amber-200 dark:border-amber-800/60 shadow-[0_0_0_2px_rgba(251,191,36,0.18),0_4px_20px_rgba(251,191,36,0.12)] hover:shadow-[0_0_0_2px_rgba(251,191,36,0.4),0_8px_28px_rgba(251,191,36,0.22)]'
                        : ''
                  }`}
                >
                  <div className="flex gap-2 items-start">
                    {/* LEFT: pet info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <PetAvatar
                          pet={pet}
                          size={44}
                          rounded="rounded-xl"
                          className="group-hover:scale-105 transition-transform"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="card-title text-sm truncate leading-tight">{pet.name}</h3>
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'vaccines'); }}
                              className="p-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-100 dark:border-indigo-500/20 hover:scale-110 transition-transform"
                            >
                              <ShieldCheck size={10} />
                            </button>
                            {isDeceased && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[9px] font-black uppercase tracking-widest">
                                Deceased
                              </span>
                            )}
                          </div>
                          <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest">{[pet.breed, pet.species, pet.age].filter(Boolean).join(' • ')}</p>
                          {/* Owning clinic/branch — only when multiple clinics are in scope. */}
                          <ScopeClinicBadge clinicId={(pet as any).clinicId} clinicName={pet.clinicName} className="mt-1" />
                        </div>
                      </div>

                      {/* Owner: name, phone, email. A patient card that names an
                          animal and not the person to ring is half a card — the
                          phone was already here but rendered blank whenever the
                          lookup missed, and the email was never shown at all. */}
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                          <Users size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                          <span className="truncate">{owner?.name || 'External'}</span>
                        </div>
                        {owner?.phone && (
                          <a
                            href={`tel:${owner.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold hover:text-seafoam transition-colors"
                            title={`Call ${owner.phone}`}
                          >
                            <Phone size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                            <span className="truncate">{owner.phone}</span>
                          </a>
                        )}
                        {owner?.email && (
                          <a
                            href={`mailto:${owner.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold hover:text-seafoam transition-colors"
                            title={`Email ${owner.email}`}
                          >
                            <Mail size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                            <span className="truncate">{owner.email}</span>
                          </a>
                        )}
                      </div>

                    </div>

                    {/* RIGHT COLUMN: badge + actions icon with inline menu */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 pt-1">
                      {/* Always-visible upcoming visit badge */}
                      {upcomingVisit && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black select-none whitespace-nowrap ${
                          isVaccination
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-700/50'
                            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700/50'
                        }`}>
                          <Calendar size={8} />
                          <span>{formatDate(upcomingVisit.date)}</span>
                          {extraVisits > 0 && <span className="opacity-70 ml-0.5">+{extraVisits}</span>}
                        </div>
                      )}

                      {/* What's due — appointment + reminder, right column. */}
                      {nextAppt && (
                        <button type="button" title="View in Reminders & Appts"
                          onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'schedule'); }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan/10 text-cyan ring-1 ring-cyan/20 text-[8px] font-black uppercase tracking-wider whitespace-nowrap hover:bg-cyan/20 hover:scale-105 transition-all">
                          <CalendarClock size={9} className="shrink-0" />
                          Appt {apptRel.text}
                        </button>
                      )}
                      {nextReminder && (
                        <button type="button" title="View in Reminders & Appts"
                          onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'schedule'); }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider whitespace-nowrap ring-1 hover:scale-105 transition-all ${
                          reminderRel.overdue
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-red-200 dark:ring-red-700/50 hover:bg-red-100 dark:hover:bg-red-900/50'
                            : 'bg-seafoam/10 text-seafoam ring-seafoam/20 hover:bg-seafoam/20'
                        }`}>
                          <BellPlus size={9} className="shrink-0" />
                          Reminder {reminderRel.text}
                        </button>
                      )}

                      {/* Quick actions, then the ⋮ menu — one row.
                          The three things reception actually DOES to a patient
                          (open a visit now, book an appointment, set a reminder)
                          were two interactions deep — hover the ⋮, then aim at a
                          menu row — while the top of the card sat empty
                          (user, 2026-08-24). They are buttons on the card now,
                          in that space; the menu keeps everything else.
                          They carry their NAMES from `sm:` up (user, 2026-08-24:
                          "there is space") — an icon alone is a guess until you
                          hover it, and a first-time user does not hover.
                          ⚠️ Heights still match: the 14px icon sets the height in
                          every one of them, including the icon-only ⋮, so the
                          9px label widens the pills without making them taller. */}
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); if (pet.isAlive === false) return; onNewAppointment(pet.ownerId, pet.id); }}
                          disabled={pet.isAlive === false}
                          title={pet.isAlive === false ? 'Patient deceased — no new visits' : 'Open a visit for this patient now'}
                          aria-label="Start new visit"
                          className="relative z-10 flex items-center gap-1.5 px-2 sm:px-2.5 py-2 bg-seafoam/10 text-seafoam border border-seafoam/20 rounded-lg hover:bg-seafoam hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-seafoam/10 disabled:hover:text-seafoam"
                        >
                          <Stethoscope size={14} className="shrink-0" /><span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest">Visit</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (pet.isAlive === false) return; setApptModalPet(pet); }}
                          disabled={pet.isAlive === false}
                          title={pet.isAlive === false ? 'Patient deceased — no new appointments' : 'Create an appointment (a visit is spawned from it)'}
                          aria-label="Create appointment"
                          className="relative z-10 flex items-center gap-1.5 px-2 sm:px-2.5 py-2 bg-cyan/10 text-cyan border border-cyan/20 rounded-lg hover:bg-cyan hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan/10 disabled:hover:text-cyan"
                        >
                          <CalendarPlus size={14} className="shrink-0" /><span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest">Appt</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (pet.isAlive === false) return; setReminderModalPet(pet); }}
                          disabled={pet.isAlive === false}
                          title={pet.isAlive === false ? 'Patient deceased — no new reminders' : 'Set a reminder for this patient'}
                          aria-label="New reminder"
                          className="relative z-10 flex items-center gap-1.5 px-2 sm:px-2.5 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-lg hover:bg-amber-500 hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50 dark:disabled:hover:bg-amber-500/10 disabled:hover:text-amber-600"
                        >
                          <BellPlus size={14} className="shrink-0" /><span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest">Reminder</span>
                        </button>
                      <div className="relative group/actions flex items-center">
                        {/* Menu opens to the LEFT, pr-2 bridge keeps hover alive */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 pr-2 z-50 opacity-0 pointer-events-none group-hover/actions:opacity-100 group-hover/actions:pointer-events-auto transition-opacity duration-150 delay-500 group-hover/actions:delay-0">
                          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1.5 shadow-xl w-44">
                            {/* Start New Visit · Create Appointment · New
                                Reminder moved ONTO the card (user, 2026-08-24)
                                — see the quick-action row above. Deliberately
                                not left here as well: one action with two homes
                                is how a menu grows stale. */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewPet(pet.id); }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                              <Search size={12} className="text-slate-500 dark:text-zinc-400 shrink-0" />
                              <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">View Patient</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'appointments'); }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                            >
                              <Calendar size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">View Visits</span>
                            </button>
                            {onEditPet && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditPet(pet.id); }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors border-t border-slate-100 dark:border-zinc-800 mt-1 pt-2"
                              >
                                <Edit size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">Edit Pet</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setTransferTarget(pet); }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                              >
                                <ArrowRightLeft size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">Transfer to clinic</span>
                              </button>
                            )}
                            {onDeletePet && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeletePet(pet.id); }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 size={12} className="text-red-600 dark:text-red-400 shrink-0" />
                                <span className="text-red-600 dark:text-red-400 font-bold text-[10px]">Delete Pet</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <button onClick={(e) => e.stopPropagation()} aria-label="More actions" className="relative z-10 p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-white hover:bg-seafoam rounded-lg transition-all shadow-sm">
                          <MoreVertical size={14} />
                        </button>
                      </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats — the card carried only weight + visits, which is
                      less than the row already knows (user, 2026-08-03: "the pet
                      card can hv more data"). Sex/neutered, vaccination count
                      and records count come free with the patient payload. */}
                  {/* One stat STRIP, not four nested cards (user, 2026-08-04:
                      "these inner cards are not making it beautiful").
                      Four filled boxes inside an already-bordered card read as
                      boxes-in-a-box, and each carried its own tint — emerald,
                      slate, indigo, slate — so a row of pets looked like a
                      colour chart. Now: hairline dividers, no fills, value
                      first and label under it, so the numbers are what you
                      scan. Colour is reserved for MEANING — a patient with no
                      vaccines on file greys out rather than glowing indigo. */}
                  <div className="grid grid-cols-4 pt-3 mt-1 border-t border-slate-100 dark:border-zinc-800 divide-x divide-slate-100 dark:divide-zinc-800">
                    {(() => {
                      const vaccines = Number(pet.vaccinationCount ?? pet.vaccinations?.length ?? 0);
                      const cells: { label: string; value: string; tone: string; muted?: boolean }[] = [
                        { label: 'Weight', value: pet.weight ? String(pet.weight) : '—', tone: 'text-emerald-600 dark:text-emerald-400', muted: !pet.weight },
                        { label: 'Visits', value: String(pet.appointmentCount || 0), tone: 'text-cyan-600 dark:text-cyan-400', muted: !pet.appointmentCount },
                        { label: 'Vaccines', value: String(vaccines), tone: 'text-indigo-600 dark:text-indigo-400', muted: vaccines === 0 },
                        { label: 'Sex', value: `${pet.gender || '—'}${pet.isNeutered ? ' ·N' : ''}`, tone: 'text-amber-600 dark:text-amber-400', muted: !pet.gender },
                      ];
                      return cells.map(c => (
                        <div key={c.label} className="px-2.5 first:pl-0 last:pr-0 min-w-0">
                          {/* Colour on the NUMBER, not behind it — the value is
                              what you scan, and four tinted panels behind four
                              numbers is what made the card noisy. A stat with
                              nothing on file greys out instead of shouting. */}
                          <p className={`font-display text-base font-black leading-none truncate ${
                            c.muted ? 'text-slate-300 dark:text-zinc-600' : c.tone
                          }`}>
                            {c.value}
                          </p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mt-1.5 truncate">
                            {c.label}
                          </p>
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Clinical flags — allergies and chronic conditions are the
                      two a vet wants BEFORE opening the record. */}
                  {((pet.allergies?.length ?? 0) > 0 || (pet.chronicConditions?.length ?? 0) > 0 || (pet.healthAlerts?.length ?? 0) > 0) && (
                    <div className="flex flex-wrap items-center gap-1 pt-1.5">
                      {(pet.allergies ?? []).slice(0, 2).map(a => (
                        <span key={`al-${a}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200/70 dark:ring-amber-700/40 text-[8px] font-black uppercase tracking-wider">
                          <AlertTriangle size={8} className="shrink-0" /> {a}
                        </span>
                      ))}
                      {(pet.chronicConditions ?? []).slice(0, 2).map(c => (
                        <span key={`cc-${c}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 ring-1 ring-rose-200/70 dark:ring-rose-700/40 text-[8px] font-black uppercase tracking-wider">
                          {c}
                        </span>
                      ))}
                      {(pet.healthAlerts ?? []).slice(0, 1).map(h => (
                        <span key={`ha-${h}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200/70 dark:ring-red-700/40 text-[8px] font-black uppercase tracking-wider">
                          <AlertTriangle size={8} className="shrink-0" /> {h}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          <Pagination
            meta={paginationMeta}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            showLimitSelector={true}
            alsoStickyBottom
          />
        </div>
      )}
      <OrphanedPetsModal
        isOpen={showOrphans}
        onClose={() => setShowOrphans(false)}
        onAfterReassign={() => refreshPets()}
      />
      <TransferClinicModal
        isOpen={!!transferTarget}
        subject="pet"
        subjectId={transferTarget?.id ?? null}
        subjectLabel={transferTarget?.name}
        currentClinicId={transferTarget?.clinicId}
        currentClinicName={transferTarget?.clinicName ?? null}
        onClose={() => setTransferTarget(null)}
        onConfirm={async (toClinicId) => {
          if (!transferTarget) return;
          await petsAPI.transfer(transferTarget.id, toClinicId);
          await refreshPets();
        }}
      />
      {apptModalPet && (
        <AppointmentCreateModal
          pets={pets}
          clients={clients}
          prefill={{ petId: String(apptModalPet.id), petLabel: apptModalPet.name }}
          source="FRONT_DESK"
          onClose={() => setApptModalPet(null)}
          onSaved={() => { setApptModalPet(null); loadRemAppts(); }}
        />
      )}
      {reminderModalPet && (
        <ReminderCreateModal
          petId={reminderModalPet.id}
          clientId={reminderModalPet.ownerId}
          petLabel={reminderModalPet.name}
          onClose={() => setReminderModalPet(null)}
          onSaved={() => { setReminderModalPet(null); loadRemAppts(); }}
        />
      )}
    </motion.div>
  );
};

export default PetsView;
