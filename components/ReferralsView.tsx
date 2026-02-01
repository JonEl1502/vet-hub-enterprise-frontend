
import React, { useState, useMemo } from 'react';
import { Referral, ReferralStatus, Clinic, Pet, Handshake, HandshakeStatus } from '../types';
import { Search, Plus, Filter, ArrowUpRight, ArrowDownLeft, MoreVertical, CheckCircle2, Clock, AlertCircle, Handshake as HandshakeIcon, Globe, Building2, ChevronRight, X, Info, ShieldCheck, Heart, Eye } from 'lucide-react';

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
}

const ReferralsView: React.FC<Props> = ({ referrals, activeClinic, clinics, pets, handshakes, currentUser, onUpdateStatus, onAddReferral, onAcceptAndBook, onInitiateHandshake, onUpdateHandshake, onViewHandshake }) => {
  const [activeTab, setActiveTab] = useState<'handshakes' | 'outgoing' | 'incoming'>('handshakes');
  const [isHandshakeModalOpen, setIsHandshakeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [handshakeSearch, setHandshakeSearch] = useState('');
  
  // Handshake Form State
  const [selectedDestId, setSelectedDestId] = useState<number | null>(null);
  const [isAllServices, setIsAllServices] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [handshakeNote, setHandshakeNote] = useState('');

  const filteredReferrals = useMemo(() => {
    return referrals
      .filter(ref => ref && (activeTab === 'outgoing' ? ref.originClinicId === activeClinic?.id : ref.destClinicId === activeClinic?.id))
      .filter(ref =>
        ref && (
          ref.serviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ref.petName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
  }, [referrals, activeTab, activeClinic?.id, searchQuery]);

  const activeHandshakes = useMemo(() => {
    return handshakes.filter(h => h && (h.requesterClinicId === activeClinic?.id || h.receiverClinicId === activeClinic?.id));
  }, [handshakes, activeClinic?.id]);

  const handshakeSearchClinics = useMemo(() => {
    const term = handshakeSearch.toLowerCase();
    const list = clinics.filter(c => c && c.id !== activeClinic?.id && c.name?.toLowerCase().includes(term));

    // Split into Cluster vs External
    const currentUserId = currentUser?.id;
    const activeClinicOwnerId = activeClinic?.ownerId;

    const cluster = list.filter(c => c && c.ownerId && (c.ownerId === currentUserId || c.ownerId === activeClinicOwnerId));
    const external = list.filter(c => c && c.ownerId && (c.ownerId !== currentUserId && c.ownerId !== activeClinicOwnerId));

    return { cluster, external };
  }, [clinics, handshakeSearch, activeClinic, currentUser]);

  const getStatusBadge = (status: string) => {
    const base = "px-3 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-wider flex items-center gap-1.5 ";
    if (status === ReferralStatus.REQUESTED || status === HandshakeStatus.PENDING) return base + "bg-amber-500/10 text-amber-600 border-amber-500/20";
    if (status === ReferralStatus.ACCEPTED || status === HandshakeStatus.ACCEPTED) return base + "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (status === ReferralStatus.COMPLETED) return base + "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    return base + "bg-red-500/10 text-red-600 border-red-500/20";
  };

  const handleHandshakeSubmit = () => {
    if (!selectedDestId) return;
    onInitiateHandshake({
      requesterClinicId: activeClinic.id,
      receiverClinicId: selectedDestId,
      status: HandshakeStatus.PENDING,
      allowedServices: isAllServices ? ['OPEN'] : selectedServices,
      note: handshakeNote
    });
    setIsHandshakeModalOpen(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Partnerships</h1>
          <p className="text-seafoam dark:text-zinc-500 font-bold mt-1 uppercase tracking-widest text-[10px]">B2B Cluster Handshakes & Case Dispatch</p>
        </div>
        <div className="flex gap-4">
           <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam transition-colors">🔍</span>
              <input 
                type="text" 
                placeholder="Filter network..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-6 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-72 transition-all font-bold"
              />
           </div>
           <button onClick={() => setIsHandshakeModalOpen(true)} className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-pine/20 transition-all active:scale-95 flex items-center gap-2">
             <HandshakeIcon size={16}/> Initiate Handshake
           </button>
        </div>
      </header>

      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
        {[
          { id: 'handshakes', label: 'Network Handshakes', icon: HandshakeIcon },
          { id: 'outgoing', label: 'Outgoing Cases', icon: ArrowUpRight },
          { id: 'incoming', label: 'Incoming Referrals', icon: ArrowDownLeft }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-lg border border-slate-200 dark:border-zinc-700' : 'text-seafoam dark:text-zinc-500 hover:text-pine'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
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
             <div className="col-span-full py-40 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-sm tracking-[0.4em]">No Network Handshakes Found</div>
           )}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Case Details</th>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Partner Clinic</th>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Progress</th>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest text-right">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredReferrals.length > 0 ? filteredReferrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-2xl">🧬</div>
                      <div>
                        <p className="text-pine dark:text-zinc-100 font-black text-lg leading-tight uppercase tracking-tight">{ref.serviceName}</p>
                        <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black mt-0.5 uppercase tracking-tighter">Subject: {ref.petName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                     <p className="text-pine dark:text-zinc-100 font-bold text-base leading-tight uppercase">{activeTab === 'outgoing' ? ref.destClinicName : ref.originClinicName}</p>
                     <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{ref.date}</p>
                  </td>
                  <td className="px-10 py-8">
                     <span className={getStatusBadge(ref.status)}>{ref.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-10 py-8 text-right">
                     <p className="text-pine dark:text-zinc-100 font-black text-xl font-mono tracking-tighter">KES {ref.payoutAmount.toLocaleString()}</p>
                     <div className="mt-2 flex justify-end gap-2">
                        {activeTab === 'incoming' && ref.status === ReferralStatus.REQUESTED && (
                          <button onClick={() => onAcceptAndBook(ref)} className="px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95">Accept & Schedule</button>
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
      )}

      {/* Handshake Initiation Modal */}
      {isHandshakeModalOpen && (
        <div className="fixed inset-0 bg-pine/90 dark:bg-zinc-950/90 backdrop-blur-xl z-[500] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-4xl w-full p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <header className="flex justify-between items-start mb-10 border-b border-slate-100 dark:border-zinc-800 pb-6">
                 <div>
                    <h2 className="text-3xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Create Partnership</h2>
                    <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black uppercase mt-1 tracking-widest">Connect with other veterinary clinics in the network</p>
                 </div>
                 <button onClick={() => setIsHandshakeModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={28}/></button>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                 <div className="lg:col-span-7 space-y-8">
                    <div className="relative group">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={20}/>
                       <input
                         placeholder="Search Clinics..."
                         value={handshakeSearch}
                         onChange={e => setHandshakeSearch(e.target.value)}
                         className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-12 pr-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-seafoam/5"
                       />
                    </div>

                    <div className="space-y-6">
                       {handshakeSearchClinics.cluster.length > 0 && (
                         <div className="space-y-3">
                           <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Building2 size={12}/> Same Organization
                           </p>
                           <div className="space-y-2">
                              {handshakeSearchClinics.cluster.map(c => (
                                <button key={c.id} onClick={() => setSelectedDestId(c.id)} className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${selectedDestId === c.id ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500' : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 hover:border-slate-200'}`}>
                                   <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-xl shadow-sm">{c.logo}</div>
                                      <div className="text-left">
                                         <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase">{c.name}</p>
                                         <p className="text-[8px] font-bold text-slate-400 uppercase">{c.subdomain}.vethub.io</p>
                                      </div>
                                   </div>
                                   {selectedDestId === c.id && <CheckCircle2 className="text-indigo-500" size={18}/>}
                                </button>
                              ))}
                           </div>
                         </div>
                       )}

                       <div className="space-y-3">
                          <p className="text-[9px] font-black text-seafoam uppercase tracking-[0.2em] flex items-center gap-2">
                             <Globe size={12}/> External Clinics
                          </p>
                          <div className="space-y-2">
                             {handshakeSearchClinics.external.length > 0 ? handshakeSearchClinics.external.map(c => (
                               <button key={c.id} onClick={() => setSelectedDestId(c.id)} className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${selectedDestId === c.id ? 'bg-seafoam/5 border-seafoam' : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 hover:border-slate-200'}`}>
                                  <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-xl shadow-sm">{c.logo}</div>
                                     <div className="text-left">
                                        <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase">{c.name}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">{c.subdomain}.vethub.io</p>
                                     </div>
                                  </div>
                                  {selectedDestId === c.id && <CheckCircle2 className="text-seafoam" size={18}/>}
                               </button>
                             )) : (
                               <p className="py-8 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-2xl">No clinics found</p>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="lg:col-span-5 space-y-8">
                    <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-inner space-y-8">
                       <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Service Permissions</h3>
                       
                       <div className="space-y-4">
                          <button onClick={() => setIsAllServices(!isAllServices)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isAllServices ? 'bg-seafoam text-white border-seafoam shadow-lg' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-400'}`}>
                             <div className="flex items-center gap-3">
                                <Globe size={18}/>
                                <span className="text-[10px] font-black uppercase">Open Cluster Interface</span>
                             </div>
                             {isAllServices && <CheckCircle2 size={16}/>}
                          </button>
                          
                          {!isAllServices && (
                            <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                               {['Surgical', 'Laboratory', 'Imaging', 'In-patient', 'Consult'].map(svc => {
                                 const isS = selectedServices.includes(svc);
                                 return (
                                   <button key={svc} onClick={() => setSelectedServices(prev => isS ? prev.filter(x => x !== svc) : [...prev, svc])} className={`p-3 rounded-lg text-[8px] font-black uppercase border transition-all ${isS ? 'bg-indigo-500 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-400'}`}>
                                      {svc}
                                   </button>
                                 );
                               })}
                            </div>
                          )}
                       </div>

                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Engagement Note</label>
                          <textarea 
                            value={handshakeNote}
                            onChange={e => setHandshakeNote(e.target.value)}
                            rows={4} 
                            placeholder="Optional initialization message..." 
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-xs font-medium text-pine dark:text-zinc-100 outline-none resize-none" 
                          />
                       </div>

                       <div className="pt-4">
                          <button 
                            onClick={handleHandshakeSubmit}
                            disabled={!selectedDestId} 
                            className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-30 transition-all"
                          >
                             Commit Protocol
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReferralsView;
