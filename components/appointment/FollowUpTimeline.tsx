import React from 'react';
import { Appointment } from '../../types';
import { Calendar, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatDate, formatTime } from '../../services/utils/dateFormatter';
import { motion } from 'framer-motion';

interface Props {
  appointments: Appointment[];
  currentAppointmentId: number;
  onNavigate: (appointmentId: number) => void;
}

const FollowUpTimeline: React.FC<Props> = ({
  appointments,
  currentAppointmentId,
  onNavigate,
}) => {
  if (appointments.length === 0) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'IN_PROGRESS':
        return <Clock size={16} className="text-amber-500" />;
      case 'CANCELLED':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <Calendar size={16} className="text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20';
      case 'IN_PROGRESS':
        return 'border-amber-500 bg-amber-50 dark:bg-amber-950/20';
      case 'CANCELLED':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRight size={16} className="text-seafoam" />
        <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
          Follow-up Timeline
        </h3>
      </div>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-seafoam via-blue-500 to-purple-500" />

        {/* Timeline Items */}
        <div className="space-y-4">
          {appointments.map((appt, index) => {
            const isCurrent = appt.id === currentAppointmentId;
            const isFirst = index === 0;
            const isLast = index === appointments.length - 1;

            return (
              <motion.div
                key={appt.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                {/* Timeline Node */}
                <div className={`absolute left-0 w-12 h-12 rounded-full border-4 flex items-center justify-center ${
                  isCurrent
                    ? 'border-seafoam bg-seafoam shadow-lg shadow-seafoam/30 scale-110'
                    : getStatusColor(appt.status)
                } transition-all`}>
                  {isCurrent ? (
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  ) : (
                    getStatusIcon(appt.status)
                  )}
                </div>

                {/* Content */}
                <div className="ml-16">
                  <button
                    onClick={() => onNavigate(appt.id)}
                    disabled={isCurrent}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isCurrent
                        ? 'border-seafoam bg-seafoam/5 cursor-default'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-sm text-pine dark:text-zinc-100 uppercase">
                            Visit #{appt.id}
                          </h4>
                          {isFirst && (
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase rounded border border-blue-500/20">
                              Initial
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-seafoam/10 text-seafoam text-[8px] font-black uppercase rounded border border-seafoam/20">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(appt.date)}
                          </span>
                          <span>•</span>
                          <span>{formatTime(appt.date)}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                        appt.status === 'COMPLETED'
                          ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                          : appt.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                          : appt.status === 'CANCELLED'
                          ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                          : 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                      }`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Services Preview */}
                    {appt.tasks && appt.tasks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Array.from(new Set(appt.tasks.map(t => t.category))).slice(0, 3).map((category, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[8px] font-bold rounded"
                          >
                            {category}
                          </span>
                        ))}
                        {appt.tasks.length > 3 && (
                          <span className="px-2 py-0.5 text-seafoam text-[8px] font-bold">
                            +{appt.tasks.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FollowUpTimeline;

