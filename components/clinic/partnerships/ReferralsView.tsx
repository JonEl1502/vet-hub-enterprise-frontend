
import React, { useState, useMemo, useEffect } from 'react';
import { Referral, ReferralStatus, Clinic, Pet, Handshake, HandshakeStatus } from '../../../types';
import ClinicLogo from '../clinic-mgmt/ClinicLogo';
import { Search, ArrowUpRight, ArrowDownLeft, MoreVertical, Handshake as HandshakeIcon, ShieldCheck, Eye, X, Loader2, ArrowRight, Globe, RefreshCw, Clock, CheckCircle2, XCircle, Pencil, Trash2, Send } from 'lucide-react';
import VisitJobsInbox from './VisitJobsInbox';
import { clinicsAPI, handshakesAPI, toast } from '../../../services';
import { CLINIC_SPECIALTIES } from '../../../constants';

interface Props {
  referrals: Referral[];
  activeClinic: Clinic;
  clinics: Clinic[];
  pets: Pet[];
  handshakes: Handshake[];
  currentUser: any;
  onUpdateStatus: (refId: number, status: ReferralStatus) => void;
  onAddReferral: (ref: Omit<Referral, 'id' | 'date' | 'status'>) => void;
  onAcceptAndBook: (ref: Referral) => void;
  onInitiateHandshake: (h: Omit<Handshake, 'id' | 'createdAt'>) => void;
  onUpdateHandshake: (id: number | string, status: HandshakeStatus) => void;
  onViewHandshake: (id: number | string) => void;
  onOpenCreatePartnership: () => void;
  onRefreshHandshakes?: () => Promise<void> | void;
}

const ReferralsView: React.FC<Props> = ({ referrals, activeClinic, clinics, pets, handshakes, currentUser, onUpdateStatus, onAddReferral, onAcceptAndBook, onInitiateHandshake, onUpdateHandshake, onViewHandshake, onOpenCreatePartnership, onRefreshHandshakes }) => {
  const [activeTab, setActiveTab] = useState<'handshakes' | 'outgoing' | 'incoming' | 'jobs'>('handshakes');
  const [searchQuery, setSearchQuery] = useState('');
  const [clinicResults, setClinicResults] = useState<Clinic[]>([]);
  const [isSearchingClinics, setIsSearchingClinics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Edit / delete a request. Backend allows update + delete on a handshake
  // (before accept and after) — wired straight to the API + a refresh.
  const [editing, setEditing] = useState<Handshake | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editServices, setEditServices] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const editOpen = editServices.includes('OPEN');
  const openEdit = (h: Handshake) => { setEditing(h); setEditNote((h as any).note || ''); setEditServices(h.allowedServices || []); };
  const toggleEditService = (s: string) => setEditServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev.filter(x => x !== 'OPEN'), s]);
  const saveEdit = async () => {
    if (!editing) return;
    setBusyId(String(editing.id));
    try {
      const res = await handshakesAPI.update(editing.id as any, { allowedServices: editServices, note: editNote.trim() || undefined } as any);
      if (res.success) { toast.success('Partnership request updated'); setEditing(null); await onRefreshHandshakes?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to update request'); } finally { setBusyId(null); }
  };
  const deleteHandshake = async (h: Handshake, partnerName: string) => {
    if (!window.confirm(`Delete the partnership request with ${partnerName}? This can’t be undone.`)) return;
    setBusyId(String(h.id));
    try {
      const res = await handshakesAPI.delete(h.id as any);
      if (res.success) { toast.success('Partnership request deleted'); await onRefreshHandshakes?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to delete request'); } finally { setBusyId(null); }
  };

  const handleRefresh = async () => {
    if (!onRefreshHandshakes) return;
    setIsRefreshing(true);
    try {
      await onRefreshHandshakes();
      setLastRefreshedAt(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setClinicResults([]);
      setIsSearchingClinics(false);
      return;
    }
    setIsSearchingClinics(true);
    const t = setTimeout(async () => {
      try {
        const res = await clinicsAPI.getAll({
          search: q,
          excludeClinicId: activeClinic?.id as any,
          limit: 10,
        });
        if (res.success && res.data?.clinics) {
          setClinicResults(res.data.clinics as unknown as Clinic[]);
        } else {
          setClinicResults([]);
        }
      } catch {
        setClinicResults([]);
      } finally {
        setIsSearchingClinics(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, activeClinic?.id]);

  const searchMatchesClinic = (clinicId: number | string | undefined) => {
    if (!searchQuery.trim()) return true;
    const clinic = clinics.find(c => String(c.id) === String(clinicId));
    return clinic?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
  };

  const filteredReferrals = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return referrals
      .filter(ref => ref && (activeTab === 'outgoing' ? ref.originClinicId === activeClinic?.id : ref.destClinicId === activeClinic?.id))
      .filter(ref => {
        if (!q) return true;
        const otherId = activeTab === 'outgoing' ? ref.destClinicId : ref.originClinicId;
        return (
          ref.serviceName?.toLowerCase().includes(q) ||
          ref.petName?.toLowerCase().includes(q) ||
          searchMatchesClinic(otherId)
        );
      });
  }, [referrals, activeTab, activeClinic?.id, searchQuery, clinics]);

  const activeHandshakes = useMemo(() => {
    const cid = String(activeClinic?.id);
    const base = handshakes.filter(h => h && (String(h.requesterClinicId) === cid || String(h.receiverClinicId) === cid));
    if (!searchQuery.trim()) return base;
    return base.filter(h => {
      const partnerId = String(h.requesterClinicId) === cid ? h.receiverClinicId : h.requesterClinicId;
      return searchMatchesClinic(partnerId as any);
    });
  }, [handshakes, activeClinic?.id, searchQuery, clinics]);

  const getStatusBadge = (status: string) => {
    const base = "px-3 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-wider flex items-center gap-1.5 ";
    if (status === ReferralStatus.REQUESTED || status === HandshakeStatus.PENDING) return base + "bg-amber-500/10 text-amber-600 border-amber-500/20";
    if (status === ReferralStatus.ACCEPTED || status === HandshakeStatus.ACCEPTED) return base + "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (status === ReferralStatus.COMPLETED) return base + "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    return base + "bg-red-500/10 text-red-600 border-red-500/20";
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-seafoam/10 flex items-center justify-center shrink-0"><HandshakeIcon size={20} className="text-seafoam" /></div>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Partners</h1>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Clinics you collaborate with across the VetHubCore network</p>
        </div>
      </div>

      {/* Search + New Partnership */}
      <div className="flex items-center gap-2 relative">
        <div className="relative group flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam" />
          <input
            type="text"
            placeholder="Search clinics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold shadow-sm"
          />
          {isSearchingClinics && <Loader2 size={14} className="absolute right-9 top-1/2 -translate-y-1/2 text-seafoam animate-spin" />}
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
              <X size={14} />
            </button>
          )}
          {searchQuery.trim().length >= 2 && clinicResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl z-[200] max-h-64 overflow-y-auto">
              {clinicResults.slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-bold text-pine dark:text-zinc-100 border-b border-slate-100 dark:border-zinc-800 last:border-b-0">
                  <span className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center text-base shrink-0"><ClinicLogo logo={(c as any).logo} fallback="🏥" /></span>
                  <span className="truncate flex-1">{c.name}</span>
                  <span className="text-[9px] text-slate-400">{(c as any).subdomain}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || !onRefreshHandshakes}
          title="Refresh partnerships"
          className="shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-seafoam hover:text-pine hover:border-seafoam/40 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/>
          <span className="hidden sm:inline">{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
        </button>
        <button onClick={onOpenCreatePartnership} className="shrink-0 bg-pine dark:bg-zinc-100 text-white dark:text-pine px-3 sm:px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap">
          <HandshakeIcon size={14}/> <span className="hidden sm:inline">New Partnership</span><span className="sm:hidden">New</span>
        </button>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 self-start inline-flex min-w-max">
          {[
            { id: 'handshakes', label: 'Partnerships', icon: HandshakeIcon },
            { id: 'outgoing', label: 'Outgoing', icon: ArrowUpRight },
            { id: 'incoming', label: 'Incoming', icon: ArrowDownLeft },
            { id: 'jobs', label: 'Jobs', icon: Send }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-zinc-700' : 'text-seafoam dark:text-zinc-500 hover:text-pine'
              }`}
            >
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'jobs' ? (
        <VisitJobsInbox />
      ) : activeTab === 'handshakes' ? (
        <>
        {/* Status summary + last-refreshed timestamp */}
        <div className="flex flex-wrap items-center justify-between gap-3 -mt-2">
          <div className="flex flex-wrap gap-2">
            {(() => {
              const counts = activeHandshakes.reduce(
                (acc, h) => {
                  if (h.status === HandshakeStatus.PENDING) acc.pending++;
                  else if (h.status === HandshakeStatus.ACCEPTED) acc.active++;
                  else if (h.status === HandshakeStatus.DECLINED) acc.declined++;
                  return acc;
                },
                { pending: 0, active: 0, declined: 0 }
              );
              return (
                <>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
                    <CheckCircle2 size={11} className="text-emerald-500"/> {counts.active} Active
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
                    <Clock size={11} className="text-amber-500"/> {counts.pending} Pending
                  </span>
                  {counts.declined > 0 && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
                      <XCircle size={11} className="text-red-500"/> {counts.declined} Declined
                    </span>
                  )}
                </>
              );
            })()}
          </div>
          {lastRefreshedAt && (
            <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
              Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           {activeHandshakes.map(h => {
             const sameId = (a: any, b: any) => String(a) === String(b);
             const isIncoming = sameId(h.receiverClinicId, activeClinic.id);

             // Resolve requester + receiver, preferring API-populated refs and falling back to clinic list.
             const requesterFromApi = (h as any).requesterClinic;
             const receiverFromApi = (h as any).receiverClinic;
             const requesterFromList = clinics.find(c => sameId(c.id, h.requesterClinicId));
             const receiverFromList = clinics.find(c => sameId(c.id, h.receiverClinicId));
             const requester = requesterFromApi || (isIncoming
               ? (requesterFromList ? { name: requesterFromList.name, logo: requesterFromList.logo, subdomain: requesterFromList.subdomain } : null)
               : { name: activeClinic.name, logo: (activeClinic as any).logo, subdomain: (activeClinic as any).subdomain });
             const receiver = receiverFromApi || (!isIncoming
               ? (receiverFromList ? { name: receiverFromList.name, logo: receiverFromList.logo, subdomain: receiverFromList.subdomain } : null)
               : { name: activeClinic.name, logo: (activeClinic as any).logo, subdomain: (activeClinic as any).subdomain });

             const partner = isIncoming ? requester : receiver;

             // Collapse allowedServices into a single summary (e.g. "1 service" or "Full Access")
             const services = h.allowedServices || [];
             const isOpen = services.includes('OPEN');
             const serviceCount = isOpen ? 0 : services.length;
             const serviceSummary = isOpen
               ? 'Full Access'
               : `${serviceCount} service${serviceCount === 1 ? '' : 's'}`;

             const isOutgoingPending = !isIncoming && h.status === HandshakeStatus.PENDING;
             const isAccepted = h.status === HandshakeStatus.ACCEPTED;
             const busy = busyId === String(h.id);
             return (
               <div
                 key={h.id}
                 className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 hover:border-seafoam transition-all shadow-sm flex flex-col gap-3"
               >
                  {/* Header — partner name leads the card */}
                  <div className="flex items-center gap-3">
                    <button onClick={() => onViewHandshake(h.id as any)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-xl overflow-hidden shrink-0">
                      <ClinicLogo logo={(partner as any)?.logo} fallback="🏥" />
                    </button>
                    <button onClick={() => onViewHandshake(h.id as any)} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight truncate">{(partner as any)?.name || 'Unknown clinic'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                        {isIncoming ? <ArrowDownLeft size={10} className="text-seafoam"/> : <ArrowUpRight size={10} className="text-indigo-500"/>}
                        {isIncoming ? 'Incoming' : 'Outgoing'}
                        <span className="text-slate-300">·</span>
                        {isOpen ? <Globe size={10} className="text-seafoam"/> : <ShieldCheck size={10}/>} {serviceSummary}
                      </p>
                    </button>
                    <span className={getStatusBadge(h.status)}>{h.status}</span>
                  </div>

                  {h.note && (
                    <div className="bg-slate-50 dark:bg-zinc-800/50 px-3 py-2 rounded-xl italic text-[10px] text-slate-600 dark:text-zinc-400 border border-slate-100 dark:border-zinc-700 line-clamp-2">
                      "{h.note}"
                    </div>
                  )}

                  {/* Footer — since date + actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                       Since {(h.createdAt || '').toString().slice(0, 10)}
                     </p>
                     <div className="flex flex-wrap gap-1.5 justify-end">
                        {isIncoming && h.status === HandshakeStatus.PENDING && (
                           <>
                             <button onClick={() => onUpdateHandshake(h.id as any, HandshakeStatus.DECLINED)} disabled={busy}
                               className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-red-500 transition-all disabled:opacity-50">Decline</button>
                             <button onClick={() => onUpdateHandshake(h.id as any, HandshakeStatus.ACCEPTED)} disabled={busy}
                               className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow disabled:opacity-50">Accept</button>
                           </>
                        )}
                        {(isOutgoingPending || isAccepted) && (
                          <button onClick={() => openEdit(h)} disabled={busy}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:border-seafoam transition-all disabled:opacity-50"><Pencil size={11}/> Edit</button>
                        )}
                        {isOutgoingPending && (
                          <button onClick={() => deleteHandshake(h, (partner as any)?.name || 'this clinic')} disabled={busy}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-red-500 transition-all disabled:opacity-50">{busy ? <Loader2 size={11} className="animate-spin"/> : <Trash2 size={11}/>} Delete</button>
                        )}
                        <button onClick={() => onViewHandshake(h.id as any)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-seafoam dark:text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700"><Eye size={11}/> View</button>
                     </div>
                  </div>
               </div>
             );
           })}
           {activeHandshakes.length === 0 && (
             <div className="col-span-full py-40 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-sm tracking-[0.4em]">No Partnerships Found</div>
           )}
        </div>
        </>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 md:px-10 py-4 md:py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Case Details</th>
                  <th className="px-4 md:px-10 py-4 md:py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Partner Clinic</th>
                  <th className="px-4 md:px-10 py-4 md:py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Progress</th>
                  <th className="px-4 md:px-10 py-4 md:py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest text-right">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredReferrals.length > 0 ? filteredReferrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <td className="px-4 md:px-10 py-4 md:py-8">
                      <div className="flex items-center gap-3 md:gap-5">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-xl md:text-2xl shrink-0">🧬</div>
                        <div>
                          <p className="text-pine dark:text-zinc-100 font-black text-sm md:text-lg leading-tight uppercase tracking-tight">{ref.serviceName}</p>
                          <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black mt-0.5 uppercase tracking-tighter">Subject: {ref.petName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-10 py-4 md:py-8">
                       <p className="text-pine dark:text-zinc-100 font-bold text-sm md:text-base leading-tight uppercase">{activeTab === 'outgoing' ? ref.destClinicName : ref.originClinicName}</p>
                       <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{ref.date}</p>
                    </td>
                    <td className="px-4 md:px-10 py-4 md:py-8">
                       <span className={getStatusBadge(ref.status)}>{ref.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 md:px-10 py-4 md:py-8 text-right">
                       <p className="text-pine dark:text-zinc-100 font-black text-base md:text-xl font-mono tracking-tighter">KES {ref.payoutAmount.toLocaleString()}</p>
                       <div className="mt-2 flex justify-end gap-2">
                          {activeTab === 'incoming' && ref.status === ReferralStatus.REQUESTED && (
                            <button onClick={() => onAcceptAndBook(ref)} className="px-3 md:px-5 py-2 md:py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95">Accept & Schedule</button>
                          )}
                          <button className="p-2 text-slate-300 hover:text-pine"><MoreVertical size={18}/></button>
                       </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-40 text-center opacity-20 uppercase font-black text-sm tracking-[0.4em]">No Referrals Found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit a partnership request — services + note (before or after accept) */}
      {editing && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => !busyId && setEditing(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 bg-gradient-to-br from-pine to-seafoam text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center"><Pencil size={18} /></div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">Edit request</h3>
                  <p className="text-[11px] text-white/80 font-medium">Update shared services &amp; note</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} disabled={!!busyId} className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Services shared</label>
                <button type="button" onClick={() => setEditServices(editOpen ? [] : ['OPEN'])}
                  className={`w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${editOpen ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>
                  <Globe size={13} /> Full open access
                </button>
                {!editOpen && (
                  <div className="flex flex-wrap gap-1.5">
                    {CLINIC_SPECIALTIES.map(s => (
                      <button key={s.value} type="button" onClick={() => toggleEditService(s.value)}
                        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${editServices.includes(s.value) ? 'bg-seafoam text-white border-seafoam' : 'bg-white dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-seafoam'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">Note <span className="text-slate-300 normal-case font-medium">(optional)</span></label>
                <textarea rows={2} value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Describe the partnership intent…"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setEditing(null)} disabled={!!busyId} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
                <button onClick={saveEdit} disabled={!!busyId || editServices.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine/90 disabled:opacity-60">
                  {busyId ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReferralsView;
