import React from 'react';
import { Pet } from '../../types';
import { Calendar, Heart, Scale, Cake } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  pet: Pet;
  appointmentDate: string;
}

const PatientCard: React.FC<Props> = ({ pet, appointmentDate }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm group"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform duration-300">
          {pet.species === 'Dog' ? '🐶' : '🐱'}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tighter leading-tight uppercase truncate">
            {pet.name}
          </h2>
          <p className="text-[9px] font-bold text-seafoam uppercase tracking-widest">
            {pet.species} • {pet.breed}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
            <Cake size={12} />
            <span className="font-medium">Age</span>
          </div>
          <span className="font-bold text-pine dark:text-zinc-100">
            {pet.age} {pet.age === 1 ? 'year' : 'years'}
          </span>
        </div>

        {pet.weight && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <Scale size={12} />
              <span className="font-medium">Weight</span>
            </div>
            <span className="font-bold text-pine dark:text-zinc-100">
              {pet.weight} kg
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
            <Calendar size={12} />
            <span className="font-medium">Visit</span>
          </div>
          <span className="font-bold text-pine dark:text-zinc-100">
            {new Date(appointmentDate).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Medical Alerts */}
      {pet.medicalHistory && pet.medicalHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 mb-2">
            <Heart size={12} className="text-red-500" />
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Medical History
            </p>
          </div>
          <div className="space-y-1">
            {pet.medicalHistory.slice(0, 3).map((record, idx) => (
              <div key={idx} className="text-[9px] text-slate-600 dark:text-zinc-400 truncate">
                • {record.diagnosis || 'General checkup'}
              </div>
            ))}
            {pet.medicalHistory.length > 3 && (
              <p className="text-[8px] text-seafoam font-bold">
                +{pet.medicalHistory.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PatientCard;

