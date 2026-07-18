
import React, { useState, useMemo, useEffect } from 'react';
import { Handshake, Clinic, Referral, HandshakeStatus, ReferralStatus } from '../../../types';
import ClinicLogo from '../clinic-mgmt/ClinicLogo';
import {
  Building2, ArrowLeft, ShieldCheck, Repeat, ArrowUpRight,
  ArrowDownLeft, History, Globe, Info, Package, Layout,
  CheckCircle2, Clock, MapPin, ExternalLink, Activity, ArrowRight,
  Coins, Loader2, Check
} from 'lucide-react';
import { CLINIC_SPECIALTIES } from '../../../constants';
import { handshakesAPI, toast } from '../../../services';
import type { HandshakeServicePrice } from '../../../services/modules/handshakes.api';

// Escrow-style per-category price negotiation between the two clinics. One side
// proposes/counters an amount; the other agrees. Only an agreed price is usable
// to outsource that category on a visit (later phase).
const NegotiatedPricing: React.FC<{ handshakeId: string; activeClinicId: string; categories: string[] }> = ({ handshakeId, activeClinicId, categories }) => {
  const [prices, setPrices] = useState<Record<string, HandshakeServicePrice>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await handshakesAPI.listPrices(handshakeId);
      if (res.success && res.data?.prices) {
        const map: Record<string, HandshakeServicePrice> = {};
        res.data.prices.forEach(p => { map[p.category] = p; });
        setPrices(map);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [handshakeId]);

  const propose = async (category: string) => {
    const amount = Number(inputs[category]);
    if (!(amount >= 0) || inputs[category] === undefined || inputs[category] === '') { toast.error('Enter an amount'); return; }
    setBusy(category);
    try {
      const res = await handshakesAPI.proposePrice(handshakeId, { category, amount });
      if (res.success && res.data?.price) { setPrices(p => ({ ...p, [category]: res.data!.price })); setInputs(i => ({ ...i, [category]: '' })); toast.success('Price proposed'); }
    } catch (e: any) { toast.error(e?.message || 'Failed to propose'); } finally { setBusy(null); }
  };
  const agree = async (category: string) => {
    setBusy(category);
    try {
      const res = await handshakesAPI.agreePrice(handshakeId, { category });
      if (res.success && res.data?.price) { setPrices(p => ({ ...p, [category]: res.data!.price })); toast.success('Price agreed'); }
    } catch (e: any) { toast.error(e?.message || 'Failed to agree'); } finally { setBusy(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-seafoam" /></div>;

  return (
    <div className="space-y-3">
      {categories.map(cat => {
        const p = prices[cat];
        const mineProposed = p && String(p.proposedById) === String(activeClinicId);
        const theirProposed = p && !p.agreed && !mineProposed;
        const b = busy === cat;
        return (
          <div key={cat} className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-700">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{cat}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5">
                {!p ? <span className="text-slate-400">No price set</span>
                  : p.agreed ? <span className="text-emerald-600 dark:text-emerald-400">Agreed · {p.currency} {p.amount.toLocaleString()}</span>
                  : mineProposed ? <span className="text-amber-600 dark:text-amber-400">You proposed {p.currency} {p.amount.toLocaleString()} · awaiting partner</span>
                  : <span className="text-indigo-600 dark:text-indigo-400">Partner proposed {p.currency} {p.amount.toLocaleString()}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {theirProposed && (
                <button onClick={() => agree(cat)} disabled={b} className="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                  {b ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Agree
                </button>
              )}
              <input type="number" min={0} step="0.01" value={inputs[cat] ?? ''} onChange={e => setInputs(i => ({ ...i, [cat]: e.target.value }))}
                placeholder={p ? 'Counter' : 'Amount'}
                className="w-24 px-2 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
              <button onClick={() => propose(cat)} disabled={b} className="px-3 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                {p ? (mineProposed ? 'Update' : 'Counter') : 'Propose'}
              </button>
            </div>
          </div>
        );
      })}
      {categories.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">No service categories to price.</p>}
    </div>
  );
};

const specialtyIcon = (s: string) => CLINIC_SPECIALTIES.find(sp => sp.value === s)?.icon ?? null;

interface Props {
  handshake: Handshake;
  activeClinic: Clinic;
  allClinics: Clinic[];
  referrals: Referral[];
  onBack: () => void;
}

const HandshakeDetailView: React.FC<Props> = ({ handshake, activeClinic, allClinics, referrals, onBack }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'ledger'>('overview');

  const sameId = (a: any, b: any) => String(a) === String(b);
  const isIncomingRequest = sameId(handshake.receiverClinicId, activeClinic.id);
  const partnerId = isIncomingRequest ? handshake.requesterClinicId : handshake.receiverClinicId;

  // Prefer API-populated clinic refs, fall back to local clinic list, then a stub.
  const partnerFromApi = isIncomingRequest ? (handshake as any).requesterClinic : (handshake as any).receiverClinic;
  const partnerFromList = allClinics.find(c => sameId(c.id, partnerId));
  const partner: any = partnerFromApi
    || partnerFromList
    || { id: partnerId, name: 'Unknown Clinic', logo: '🏥', subdomain: '' };

  // Requester + receiver display refs (always show both on the detail page)
  const requesterDisplay = (handshake as any).requesterClinic
    || allClinics.find(c => sameId(c.id, handshake.requesterClinicId))
    || (sameId(handshake.requesterClinicId, activeClinic.id) ? activeClinic : { id: handshake.requesterClinicId, name: 'Unknown', logo: '🏥', subdomain: '' });
  const receiverDisplay = (handshake as any).receiverClinic
    || allClinics.find(c => sameId(c.id, handshake.receiverClinicId))
    || (sameId(handshake.receiverClinicId, activeClinic.id) ? activeClinic : { id: handshake.receiverClinicId, name: 'Unknown', logo: '🏥', subdomain: '' });

  const partnershipReferrals = useMemo(() => {
    return referrals.filter(r =>
      (sameId(r.originClinicId, activeClinic.id) && sameId(r.destClinicId, partner.id)) ||
      (sameId(r.originClinicId, partner.id) && sameId(r.destClinicId, activeClinic.id))
    );
  }, [referrals, activeClinic.id, partner.id]);

  const direction = useMemo(() => {
    const sent = referrals.some(r => sameId(r.originClinicId, activeClinic.id) && sameId(r.destClinicId, partner.id));
    const received = referrals.some(r => sameId(r.destClinicId, activeClinic.id) && sameId(r.originClinicId, partner.id));
    if (sent && received) return 'BOTH_WAYS';
    if (sent) return 'OUTGOING_ONLY';
    if (received) return 'INCOMING_ONLY';
    return 'IDLE';
  }, [referrals, activeClinic.id, partner.id]);

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-2 space-y-5">
        {/* Requester → Receiver banner */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 md:p-5 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-5">Partnership Flow</p>
          {/* Stacks vertically on mobile (arrow rotates down) — side-by-side
              squeezed the names to one letter on small screens. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden">
                <ClinicLogo logo={(requesterDisplay as any)?.logo} fallback="🏥" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Requester</p>
                <p className="text-base md:text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{(requesterDisplay as any)?.name}</p>
                {(requesterDisplay as any)?.subdomain && (
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{(requesterDisplay as any).subdomain}.vethubcore.io</p>
                )}
              </div>
            </div>

            <div className="shrink-0 px-2 self-center">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-pine dark:bg-zinc-100 text-white dark:text-pine flex items-center justify-center shadow-lg rotate-90 sm:rotate-0 transition-transform">
                <ArrowRight size={16}/>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 sm:justify-end text-left sm:text-right">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden sm:order-2">
                <ClinicLogo logo={(receiverDisplay as any)?.logo} fallback="🏥" />
              </div>
              <div className="min-w-0 sm:order-1">
                <p className="text-[9px] font-black text-seafoam uppercase tracking-widest mb-0.5">Receiver</p>
                <p className="text-base md:text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{(receiverDisplay as any)?.name}</p>
                {(receiverDisplay as any)?.subdomain && (
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{(receiverDisplay as any).subdomain}.vethubcore.io</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 md:p-6 shadow-sm space-y-4 md:space-y-6">
          <div className="flex items-center gap-3 md:gap-4 border-b border-slate-50 dark:border-zinc-800 pb-4 md:pb-6">
            <Info className="text-seafoam shrink-0" size={18} />
            <h3 className="text-base md:text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Partnership Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-6">
              {[
                { label: 'Partner Clinic', val: partner.name, icon: Building2 },
                { label: 'Clinic URL', val: `${partner.subdomain}.vethubcore.io`, icon: Globe },
                { label: 'Date Created', val: handshake.createdAt, icon: Clock },
              ].map(i => (
                <div key={i.label} className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-slate-400 aspect-square"><i.icon size={18}/></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                    <p className="text-pine dark:text-zinc-100 font-bold text-base leading-tight uppercase">{i.val}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
               <div className="p-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Traffic Vector</p>
                  <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-2xl ${direction === 'BOTH_WAYS' ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-zinc-900 text-seafoam'}`}>
                        <Repeat size={24} className={direction === 'BOTH_WAYS' ? 'animate-spin-slow' : ''} />
                     </div>
                     <div>
                        <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase">{direction.replace('_', ' ')}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Handshake status: {handshake.status}</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
          {handshake.note && (
            <div className="pt-6 border-t border-slate-50 dark:border-zinc-800">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Engangement Note</p>
              <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 italic text-sm text-slate-600 dark:text-zinc-400">
                "{handshake.note}"
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-pine rounded-2xl p-4 md:p-6 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:scale-125 transition-transform duration-1000"><Repeat size={64} /></div>
          <p className="text-mist/40 text-[10px] font-black uppercase tracking-[0.4em] mb-3">Partnership Value</p>
          <div className="space-y-2 mb-10">
             <h2 className="text-2xl sm:text-3xl font-black tracking-tighter">KES {partnershipReferrals.reduce((acc, r) => acc + r.payoutAmount, 0).toLocaleString()}</h2>
             <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">Aggregate Settlement</p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-8">
             <div>
                <p className="text-mist/40 text-[8px] font-black uppercase">Cases Handled</p>
                <p className="text-xl font-black">{partnershipReferrals.length}</p>
             </div>
             <div>
                <p className="text-mist/40 text-[8px] font-black uppercase">Success Rate</p>
                <p className="text-xl font-black">100%</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderServices = () => (
    <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
       <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 md:p-6 shadow-sm space-y-4 md:space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-50 dark:border-zinc-800 pb-6">
             <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg"><Package size={24}/></div>
             <h2 className="text-xl md:text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Authorized Service Matrix</h2>
          </div>

          {handshake.allowedServices.includes('OPEN') ? (
            <div className="p-6 text-center border-2 border-dashed border-seafoam/20 rounded-2xl bg-seafoam/5 group">
               <div className="w-14 h-14 bg-seafoam text-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-xl group-hover:scale-110 transition-transform">
                  <Globe size={26}/>
               </div>
               <h3 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Full Access Partnership</h3>
               <p className="text-slate-500 dark:text-zinc-400 mt-2 font-medium max-w-md mx-auto">This handshake permits bidirectional referral of all clinical services without restriction.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {handshake.allowedServices.map(svc => (
                 <div key={svc} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700 shadow-sm">
                    <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-xl shadow-sm shrink-0">🩺</div>
                    <div className="min-w-0">
                       <p className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{svc}</p>
                       <span className="text-[8px] font-black text-seafoam uppercase tracking-widest">Service Active</span>
                    </div>
                 </div>
               ))}
            </div>
          )}
       </div>

       {/* Negotiated per-category pricing (escrow-style) */}
       <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 md:p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-50 dark:border-zinc-800 pb-6">
             <div className="p-3 bg-seafoam text-white rounded-2xl shadow-lg"><Coins size={24}/></div>
             <div>
               <h2 className="text-xl md:text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Negotiated pricing</h2>
               <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Agree a price per category for services done by your partner. One side proposes, the other agrees or counters.</p>
             </div>
          </div>
          <NegotiatedPricing
            handshakeId={String(handshake.id)}
            activeClinicId={String(activeClinic.id)}
            categories={handshake.allowedServices.includes('OPEN') ? CLINIC_SPECIALTIES.map(s => s.value) : handshake.allowedServices}
          />
       </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-20">
      <header className="flex flex-col gap-6 pb-8 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam hover:text-pine transition-all shadow-lg active:scale-95 shrink-0">
             <ArrowLeft size={18}/>
           </button>
           <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-2xl md:text-3xl shadow-lg shrink-0 overflow-hidden">
                <ClinicLogo logo={partner.logo} fallback="🏥" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{partner.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 truncate">
                   Partner Profile
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0 hidden sm:block"></span>
                   <span className="hidden sm:inline">Clinic: {partner.subdomain}</span>
                </p>
                {(() => {
                  // Prefer specialties from the handshake clinic ref; fall back to the local clinic list.
                  const fromHandshakeRef = (partnerFromApi as any)?.specialties as string[] | undefined;
                  const fromList = (partnerFromList as any)?.specialties as string[] | undefined;
                  const specs = (fromHandshakeRef && fromHandshakeRef.length ? fromHandshakeRef : fromList) || [];
                  return specs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {specs.map((s: string) => (
                        <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md text-[9px] font-black uppercase tracking-wide">
                          {specialtyIcon(s)} {s}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
           </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl inline-flex min-w-max">
             {[
               { id: 'overview', label: 'Relationship', icon: Info },
               { id: 'services', label: 'Services', icon: Package },
               { id: 'ledger', label: 'Case History', icon: Activity },
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                   activeTab === tab.id
                     ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg'
                     : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
                 }`}
               >
                 <tab.icon size={12} />
                 {tab.label}
               </button>
             ))}
          </div>
        </div>
      </header>

      <div className="min-h-[50vh]">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'services' && renderServices()}
        {activeTab === 'ledger' && (
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[580px]">
                  <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 md:px-10 py-4 md:py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Case ID</th>
                      <th className="px-4 md:px-10 py-4 md:py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Service Sequence</th>
                      <th className="px-4 md:px-10 py-4 md:py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Direction</th>
                      <th className="px-4 md:px-10 py-4 md:py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                     {partnershipReferrals.map(r => (
                       <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-all group">
                          <td className="px-4 md:px-10 py-4 md:py-8"><span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight">REF-#{r.id}</span></td>
                          <td className="px-4 md:px-10 py-4 md:py-8">
                             <p className="text-pine dark:text-zinc-100 font-black text-sm md:text-base uppercase leading-tight">{r.serviceName}</p>
                             <p className="text-seafoam dark:text-zinc-500 text-[10px] font-bold mt-1 uppercase">Subject: {r.petName}</p>
                          </td>
                          <td className="px-4 md:px-10 py-4 md:py-8">
                             {r.originClinicId === activeClinic.id ? (
                               <div className="flex items-center gap-2 text-indigo-500">
                                  <ArrowUpRight size={14}/>
                                  <span className="text-[10px] font-black uppercase tracking-widest">Outgoing</span>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2 text-seafoam">
                                  <ArrowDownLeft size={14}/>
                                  <span className="text-[10px] font-black uppercase tracking-widest">Incoming</span>
                               </div>
                             )}
                          </td>
                          <td className="px-4 md:px-10 py-4 md:py-8 text-right">
                             <p className="text-base md:text-xl font-black font-mono text-emerald-600">KES {r.payoutAmount.toLocaleString()}</p>
                             <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-lg border border-emerald-500/20">{r.status}</span>
                          </td>
                       </tr>
                     ))}
                     {partnershipReferrals.length === 0 && (
                       <tr><td colSpan={4} className="py-40 text-center opacity-20 font-black uppercase tracking-[0.4em] text-sm">No Records Found</td></tr>
                     )}
                  </tbody>
                </table>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default HandshakeDetailView;
