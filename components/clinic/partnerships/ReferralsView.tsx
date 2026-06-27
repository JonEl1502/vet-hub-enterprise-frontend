
import React, { useState, useMemo, useEffect } from 'react';
import { Referral, ReferralStatus, Clinic, Pet, Handshake, HandshakeStatus } from '../../../types';
import ClinicLogo from '../clinic-mgmt/ClinicLogo';
import { Search, ArrowUpRight, ArrowDownLeft, MoreVertical, Handshake as HandshakeIcon, ShieldCheck, Eye, X, Loader2, ArrowRight, Globe, RefreshCw, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { clinicsAPI } from '../../../services';

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
  const [activeTab, setActiveTab] = useState<'handshakes' | 'outgoing' | 'incoming'>('handshakes');
  const [searchQuery, setSearchQuery] = useState('');
  const [clinicResults, setClinicResults] = useState<Clinic[]>([]);
  const [isSearchingClinics, setIsSearchingClinics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

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
            { id: 'incoming', label: 'Incoming', icon: ArrowDownLeft }
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

      {activeTab === 'handshakes' ? (
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

             return (
               <button
                 key={h.id}
                 onClick={() => onViewHandshake(h.id as any)}
                 className="text-left w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-7 hover:border-seafoam hover:shadow-md transition-all shadow-sm flex flex-col justify-between"
               >
                  <div>
                    {/* Top row — direction badge + status */}
                    <div className="flex items-center justify-between mb-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        isIncoming
                          ? 'bg-seafoam/10 text-seafoam border-seafoam/20'
                          : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                      }`}>
                        {isIncoming ? <ArrowDownLeft size={10}/> : <ArrowUpRight size={10}/>}
                        {isIncoming ? 'Incoming' : 'Outgoing'}
                      </span>
                      <span className={getStatusBadge(h.status)}>{h.status}</span>
                    </div>

                    {/* Requester → Receiver visual */}
                    <div className="flex items-center justify-between gap-3 mb-5">
                      {/* Requester */}
                      <div className="flex flex-col items-center text-center min-w-0 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-2xl shadow-inner mb-2 overflow-hidden">
                          <ClinicLogo logo={(requester as any)?.logo} fallback="🏥" />
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Requester</p>
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight leading-tight truncate w-full">
                          {(requester as any)?.name || 'Unknown'}
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="shrink-0 px-2">
                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-seafoam">
                          <ArrowRight size={16}/>
                        </div>
                      </div>

                      {/* Receiver */}
                      <div className="flex flex-col items-center text-center min-w-0 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-2xl shadow-inner mb-2 overflow-hidden">
                          <ClinicLogo logo={(receiver as any)?.logo} fallback="🏥" />
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Receiver</p>
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight leading-tight truncate w-full">
                          {(receiver as any)?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Service summary (collapsed) */}
                    <div className="mt-6 pt-5 border-t border-slate-50 dark:border-zinc-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen
                          ? <Globe size={14} className="text-seafoam shrink-0"/>
                          : <ShieldCheck size={14} className="text-slate-400 shrink-0"/>
                        }
                        <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 truncate">
                          {serviceSummary}
                        </span>
                      </div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                        See details
                      </span>
                    </div>

                    {h.note && (
                      <div className="mt-4 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl italic text-[10px] text-slate-600 dark:text-zinc-400 border border-slate-100 dark:border-zinc-700 line-clamp-2">
                        "{h.note}"
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-5 border-t border-slate-50 dark:border-zinc-800 flex items-center justify-between">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                       Since {(h.createdAt || '').toString().slice(0, 10)}
                     </p>
                     <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        {isIncoming && h.status === HandshakeStatus.PENDING && (
                           <>
                             <button
                               onClick={() => onUpdateHandshake(h.id as any, HandshakeStatus.DECLINED)}
                               className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-red-500 transition-all"
                             >
                               Decline
                             </button>
                             <button
                               onClick={() => onUpdateHandshake(h.id as any, HandshakeStatus.ACCEPTED)}
                               className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                             >
                               Accept
                             </button>
                           </>
                        )}
                        {!(isIncoming && h.status === HandshakeStatus.PENDING) && (
                          <span className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-seafoam dark:text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700">
                             <Eye size={12}/> View
                          </span>
                        )}
                     </div>
                  </div>
               </button>
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

    </div>
  );
};

export default ReferralsView;
