import React from 'react';
import { Check, Star } from 'lucide-react';
import ClinicLogo from './ClinicLogo';
import { useClinic } from '../contexts/ClinicContext';

interface ClinicSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ClinicSwitcherModal: React.FC<ClinicSwitcherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { clinics, selectedClinicIds, toggleClinic } = useClinic();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl z-[1000] flex flex-col items-center justify-center p-8 overflow-y-auto animate-in fade-in duration-300">
      <div className="max-w-6xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">
            Switch Clinic
          </h2>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-[0.4em]">
            Select your active clinic
          </p>
        </div>

        {/* Clinic Grid - Added px-6 for horizontal padding */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
          {clinics.map((c) => {
            const isActive = selectedClinicIds.includes(c.id);

            return (
              <button
                key={c.id}
                onClick={() => toggleClinic(c.id)}
                className={`relative p-6 rounded-xl border-3 transition-all hover:scale-105 active:scale-95 group text-left ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 border-seafoam shadow-xl'
                    : 'bg-white/5 border-slate-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Logo and Check */}
                <div className="flex justify-between items-start mb-6">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg overflow-hidden ${
                      isActive
                        ? 'bg-seafoam text-white'
                        : 'bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100'
                    }`}
                  >
                    <ClinicLogo logo={c.logo} fallback="🐾" />
                  </div>
                  {isActive && (
                    <div className="p-2 bg-seafoam rounded-lg text-white shadow-md shadow-seafoam/20">
                      <Check size={16} />
                    </div>
                  )}
                </div>

                {/* Clinic Info */}
                <div className="space-y-1">
                  <h3
                    className={`text-xl font-black uppercase tracking-tight ${
                      isActive ? 'text-pine dark:text-zinc-100' : 'text-slate-400'
                    }`}
                  >
                    {c.name}
                  </h3>
                  <p
                    className={`text-[9px] font-bold uppercase tracking-widest ${
                      isActive ? 'text-seafoam' : 'text-slate-400'
                    }`}
                  >
                    {c.subdomain}.vethub.com
                  </p>
                </div>

                {/* Metrics - Only show if available */}
                {(c.balance !== undefined || c.rating !== undefined) && (
                  <div className="mt-8 pt-6 border-t border-dashed border-slate-200 dark:border-zinc-800">
                    <div className="flex justify-between items-end">
                      {c.balance !== undefined && (
                        <div>
                          <p
                            className={`text-[8px] font-black uppercase tracking-widest mb-1 ${
                              isActive ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Revenue
                          </p>
                          <p
                            className={`text-xl font-black font-mono ${
                              isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            {c.currency || 'KES'} {c.balance.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {c.rating !== undefined && (
                        <div
                          className={`flex items-center gap-1 text-[10px] font-black ${
                            isActive ? 'text-amber-500' : 'text-slate-300'
                          }`}
                        >
                          <Star size={12} fill="currentColor" />
                          {c.rating}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Apply Button */}
        <button
          onClick={onClose}
          className="compact-button bg-seafoam hover:bg-seafoam/80 text-white shadow-xl transition-all self-center"
        >
          Apply Session Matrix
        </button>
      </div>
    </div>
  );
};

export default ClinicSwitcherModal;

