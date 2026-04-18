
import React, { useState, useMemo, useEffect } from 'react';
import { Referral, ReferralStatus, Clinic, Pet, Handshake, HandshakeStatus } from '../types';
import { Search, ArrowUpRight, ArrowDownLeft, MoreVertical, Handshake as HandshakeIcon, ShieldCheck, Eye, X, Loader2 } from 'lucide-react';
import { clinicsAPI } from '../services';

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
  onUpdateHandshake: (id: number, status: HandshakeStatus) => void;
  onViewHandshake: (id: number) => void;
  onOpenCreatePartnership: () => void;
}

const ReferralsView: React.FC<Props> = ({ referrals, activeClinic, clinics, pets, handshakes, currentUser, onUpdateStatus, onAddReferral, onAcceptAndBook, onInitiateHandshake, onUpdateHandshake, onViewHandshake, onOpenCreatePartnership }) => {
  const [activeTab, setActiveTab] = useState<'handshakes' | 'outgoing' | 'incoming'>('handshakes');
  const [searchQuery, setSearchQuery] = useState('');
  const [clinicResults, setClinicResults] = useState<Clinic[]>([]);
  const [isSearchingClinics, setIsSearchingClinics] = useState(false);

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
    const base = handshakes.filter(h => h && (h.requesterClinicId === activeClinic?.id || h.receiverClinicId === activeClinic?.id));
    if (!searchQuery.trim()) return base;
    return base.filter(h => {
      const partnerId = h.requesterClinicId === activeClinic?.id ? h.receiverClinicId : h.requesterClinicId;
      return searchMatchesClinic(partnerId);
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
                  <span className="text-base">{(c as any).logo || '🏥'}</span>
                  <span className="truncate flex-1">{c.name}</span>
                  <span className="text-[9px] text-slate-400">{(c as any).subdomain}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           {activeHandshakes.map(h => {
             const partnerId = h.requesterClinicId === activeClinic.id ? h.receiverClinicId : h.requesterClinicId;
             const partner = clinics.find(c => c.id === partnerId);
             const isIncoming = h.receiverClinicId === activeClinic.id;
             return (
               <div key={h.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 hover:border-seafoam transition-all shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-3xl shadow-inner">{partner?.logo}</div>
                      <span className={getStatusBadge(h.status)}>{h.status}</span>
                    </div>
                    <h3 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tight leading-tight uppercase">{partner?.name}</h3>
                    <p className="text-seafoam text-[10px] font-black uppercase tracking-widest mt-1">{partner?.subdomain}.vethub.io</p>
                    
                    <div className="mt-8 pt-6 border-t border-slate-50 dark:border-zinc-800 space-y-4">
                       <div className="flex items-center gap-2 text-slate-400">
                          <ShieldCheck size={14}/>
                          <span className="text-[10px] font-black uppercase tracking-widest truncate">Allowed Services: {h.allowedServices.join(', ')}</span>
                       </div>
                       {h.note && (
                         <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl italic text-[10px] text-slate-600 dark:text-zinc-400 border border-slate-100 dark:border-zinc-700 line-clamp-2">
                           "{h.note}"
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 dark:border-zinc-800 flex items-center justify-between">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Since {h.createdAt}</p>
                     <div className="flex gap-2">
                        {isIncoming && h.status === HandshakeStatus.PENDING ? (
                           <button onClick={() => onUpdateHandshake(h.id, HandshakeStatus.ACCEPTED)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">Accept</button>
                        ) : (
                          <button onClick={() => onViewHandshake(h.id)} className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-800 text-seafoam dark:text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-pine transition-all">
                             <Eye size={12}/> View Profile
                          </button>
                        )}
                        <button className="p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl text-slate-400 hover:text-pine border border-slate-100 dark:border-zinc-700"><MoreVertical size={16}/></button>
                     </div>
                  </div>
               </div>
             );
           })}
           {activeHandshakes.length === 0 && (
             <div className="col-span-full py-40 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-sm tracking-[0.4em]">No Partnerships Found</div>
           )}
        </div>
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
