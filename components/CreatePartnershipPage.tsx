
import React, { useState, useEffect, useMemo } from 'react';
import { Clinic, Handshake, HandshakeStatus } from '../types';
import { clinicsAPI } from '../services/modules/clinics.api';
import {
  ArrowLeft, Search, Globe, Building2, CheckCircle2, X,
  Handshake as HandshakeIcon, Shield, Loader2,
} from 'lucide-react';
import { CLINIC_SPECIALTIES } from '../constants';

const SPECIALTIES = CLINIC_SPECIALTIES.map(s => s.value);

const specialtyIcon = (s: string) => CLINIC_SPECIALTIES.find(sp => sp.value === s)?.icon ?? null;

interface Props {
  activeClinic: Clinic;
  currentUser: any;
  onBack: () => void;
  onSubmit: (h: Omit<Handshake, 'id' | 'createdAt'>) => void;
}

const CreatePartnershipPage: React.FC<Props> = ({ activeClinic, currentUser, onBack, onSubmit }) => {
  const [clinics, setClinics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAllServices, setIsAllServices] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    clinicsAPI.getAll({ bypassCache: true } as any)
      .then((res: any) => {
        if (res.success && res.data?.clinics) {
          setClinics(res.data.clinics);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const activeClinicIdStr = String(activeClinic.id);
  const currentOwnerId = currentUser?.id ? String(currentUser.id) : null;
  const activeOwnerId = activeClinic.ownerId ? String(activeClinic.ownerId) : null;

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return clinics.filter(c => {
      if (String(c.id) === activeClinicIdStr) return false;
      if (term && !c.name?.toLowerCase().includes(term)) return false;
      if (specialtyFilter && !(c.specialties || []).includes(specialtyFilter)) return false;
      return true;
    });
  }, [clinics, search, specialtyFilter, activeClinicIdStr]);

  const { cluster, external } = useMemo(() => {
    const cluster = filtered.filter(c => {
      const ownId = c.ownerId ? String(c.ownerId) : null;
      return ownId && (ownId === currentOwnerId || ownId === activeOwnerId);
    });
    const clusterIds = new Set(cluster.map((c: any) => String(c.id)));
    const external = filtered.filter(c => !clusterIds.has(String(c.id)));
    return { cluster, external };
  }, [filtered, currentOwnerId, activeOwnerId]);

  const selectedClinic = clinics.find(c => String(c.id) === selectedId);

  const handleSubmit = () => {
    if (!selectedId) return;
    setIsSubmitting(true);
    onSubmit({
      requesterClinicId: activeClinic.id as number,
      receiverClinicId: Number(selectedId),
      status: HandshakeStatus.PENDING,
      allowedServices: isAllServices ? ['OPEN'] : selectedServices,
      note,
    });
    // onBack is called by parent after store update
  };

  const ClinicCard = ({ clinic }: { clinic: any }) => {
    const isSelected = String(clinic.id) === selectedId;
    const specs: string[] = clinic.specialties || [];
    return (
      <button
        onClick={() => setSelectedId(String(clinic.id))}
        className={`w-full text-left flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
          isSelected
            ? 'bg-seafoam/5 border-seafoam shadow-md'
            : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 flex items-center justify-center text-2xl shrink-0">
            {clinic.logo || '🐾'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase truncate">{clinic.name}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{clinic.subdomain}.vethub.io</p>
            {specs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {specs.map(s => (
                  <span key={s} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md text-[8px] font-black uppercase tracking-wide">
                    {specialtyIcon(s)} {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {isSelected && <CheckCircle2 className="text-seafoam shrink-0 ml-3" size={20} />}
      </button>
    );
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam hover:text-pine transition-all shadow-lg active:scale-95 shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Create Partnership</h1>
          <p className="text-seafoam dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest mt-0.5">Connect with clinics in the VetHub network</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left — clinic search & list */}
        <div className="lg:col-span-7 space-y-6">
          {/* Search + specialty filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={18} />
              <input
                placeholder="Search clinics by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-black text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSpecialtyFilter(null)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  !specialtyFilter ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-transparent shadow-md' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800'
                }`}
              >
                All Clinics
              </button>
              {SPECIALTIES.map(s => (
                <button
                  key={s}
                  onClick={() => setSpecialtyFilter(prev => prev === s ? null : s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    specialtyFilter === s ? 'bg-indigo-500 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-indigo-300'
                  }`}
                >
                  {specialtyIcon(s)} {s}
                </button>
              ))}
            </div>
          </div>

          {/* Clinic list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 className="animate-spin mr-3" size={20} />
              <span className="text-[11px] font-black uppercase tracking-widest">Loading clinics...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {cluster.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Building2 size={11} /> Same Organization
                  </p>
                  <div className="space-y-2">
                    {cluster.map((c: any) => <ClinicCard key={c.id} clinic={c} />)}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[9px] font-black text-seafoam uppercase tracking-[0.2em] flex items-center gap-2">
                  <Globe size={11} /> External Network
                </p>
                <div className="space-y-2">
                  {external.length > 0
                    ? external.map((c: any) => <ClinicCard key={c.id} clinic={c} />)
                    : (
                      <div className="py-16 text-center border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-300 dark:text-zinc-600 uppercase tracking-widest">No clinics found</p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — configuration panel */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 md:p-8 shadow-inner space-y-8">

            {/* Selected clinic preview */}
            {selectedClinic ? (
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800">
                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-2xl shrink-0">
                  {selectedClinic.logo || '🐾'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase truncate">{selectedClinic.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{selectedClinic.subdomain}.vethub.io</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700">
                <HandshakeIcon className="text-slate-300 dark:text-zinc-600 shrink-0" size={20} />
                <p className="text-[10px] font-black text-slate-300 dark:text-zinc-600 uppercase tracking-widest">Select a clinic from the list</p>
              </div>
            )}

            {/* Service permissions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield size={13} className="text-seafoam" />
                <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Service Permissions</h3>
              </div>

              <button
                onClick={() => setIsAllServices(!isAllServices)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                  isAllServices ? 'bg-seafoam text-white border-seafoam shadow-lg' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Globe size={16} />
                  <span className="text-[10px] font-black uppercase tracking-wide">Full Open Access</span>
                </div>
                {isAllServices && <CheckCircle2 size={15} />}
              </button>

              {!isAllServices && (
                <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                  {['Surgical', 'Laboratory', 'Imaging', 'In-patient', 'Consult', 'Emergency'].map(svc => {
                    const on = selectedServices.includes(svc);
                    return (
                      <button
                        key={svc}
                        onClick={() => setSelectedServices(prev => on ? prev.filter(x => x !== svc) : [...prev, svc])}
                        className={`p-2.5 rounded-lg text-[9px] font-black uppercase border transition-all ${on ? 'bg-indigo-500 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-400'}`}
                      >
                        {svc}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Engagement Note (optional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="Introduce your clinic or describe the partnership intent..."
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs font-medium text-pine dark:text-zinc-100 outline-none resize-none focus:ring-2 focus:ring-seafoam/20"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!selectedId || isSubmitting}
              className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-pine/20 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <HandshakeIcon size={14} />}
              Send Partnership Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePartnershipPage;
