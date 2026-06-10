import React, { useState } from 'react';
import { Check, Star, Building2, ArrowRight } from 'lucide-react';
import ClinicLogo from './ClinicLogo';
import { useClinic } from '../../../contexts/ClinicContext';

interface InitialClinicSelectionProps {
  onComplete: () => void;
}

const InitialClinicSelection: React.FC<InitialClinicSelectionProps> = ({ onComplete }) => {
  const { 
    clinics, 
    canMultiSelect, 
    selectMultipleClinics, 
    selectAllClinics,
    completeInitialSelection 
  } = useClinic();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleClinic = (clinicId: string) => {
    if (!canMultiSelect) {
      // Single selection only
      setSelectedIds([clinicId]);
    } else {
      // Multi-select
      setSelectedIds(prev => {
        if (prev.includes(clinicId)) {
          return prev.filter(id => id !== clinicId);
        } else {
          return [...prev, clinicId];
        }
      });
    }
  };

  const handleViewAll = () => {
    const allIds = clinics.map(c => c.id);
    setSelectedIds(allIds);
    selectMultipleClinics(allIds);
    completeInitialSelection();
    onComplete();
  };

  const handleContinue = () => {
    if (selectedIds.length === 0) return;
    
    selectMultipleClinics(selectedIds);
    completeInitialSelection();
    onComplete();
  };

  return (
    <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-12 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#1C7A5B]/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]"></div>

      <div className="max-w-6xl w-full space-y-12 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-[#144E35] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-xl shadow-[#144E35]/20">
            🐾
          </div>
          <h1 className="text-5xl font-black text-[#144E35] tracking-tighter uppercase">
            Select Your Workspace
          </h1>
          <p className="text-[#1C7A5B] text-xs font-black uppercase tracking-[0.4em]">
            Choose clinic{canMultiSelect ? '(s)' : ''} to access
          </p>
        </div>

        {/* Clinic Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {clinics.map(clinic => {
            const isSelected = selectedIds.includes(clinic.id);
            
            return (
              <button
                key={clinic.id}
                onClick={() => handleToggleClinic(clinic.id)}
                className={`relative p-6 rounded-xl border-3 transition-all hover:scale-105 active:scale-95 group text-left ${
                  isSelected
                    ? 'bg-white border-[#1C7A5B] shadow-xl shadow-[#1C7A5B]/20'
                    : 'bg-white/60 border-[#CFE6D8] hover:border-[#1C7A5B]/40'
                }`}
              >
                {/* Logo and Check */}
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-[#1C7A5B] text-white scale-110'
                        : 'bg-[#f4f7f7] text-[#144E35]'
                    }`}
                  >
                    <ClinicLogo logo={clinic.logo} fallback="🐾" />
                  </div>
                  {isSelected && (
                    <div className="p-2 bg-[#1C7A5B] rounded-lg text-white shadow-md shadow-[#1C7A5B]/20">
                      <Check size={16} />
                    </div>
                  )}
                </div>

                {/* Clinic Info */}
                <div className="space-y-2">
                  <h3
                    className={`text-xl font-black uppercase tracking-tight ${
                      isSelected ? 'text-[#144E35]' : 'text-[#144E35]/60'
                    }`}
                  >
                    {clinic.name}
                  </h3>
                  <p
                    className={`text-[9px] font-bold uppercase tracking-widest ${
                      isSelected ? 'text-[#1C7A5B]' : 'text-[#144E35]/40'
                    }`}
                  >
                    {clinic.subdomain}.vethubcore.com
                  </p>
                </div>

                {/* Additional Info */}
                {clinic.address && (
                  <div className="mt-6 pt-4 border-t border-dashed border-[#CFE6D8]">
                    <p className="text-xs text-[#144E35]/60 font-semibold flex items-center gap-2">
                      <Building2 size={14} />
                      {clinic.address}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6">
          {canMultiSelect && (
            <button
              onClick={handleViewAll}
              className="bg-white hover:bg-[#f4f7f7] text-[#1C7A5B] border-2 border-[#1C7A5B] px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95"
            >
              View All Clinics
            </button>
          )}
          
          <button
            onClick={handleContinue}
            disabled={selectedIds.length === 0}
            className="bg-[#144E35] hover:bg-[#1f544f] disabled:opacity-40 disabled:cursor-not-allowed text-white px-16 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-[#144E35]/20 transition-all active:scale-95 flex items-center gap-3 group"
          >
            Continue to Dashboard
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InitialClinicSelection;

