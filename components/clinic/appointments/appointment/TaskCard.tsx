import React from 'react';
import { ApptTask, TaskStatus, User } from '../../../../types';
import { Share2, Trash2, Pill, FileText, Wand2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  task: ApptTask;
  status: TaskStatus;
  assignedStaffId?: number;
  availableStaff: User[];
  isPaid: boolean;
  isLoading: boolean;
  onStatusChange: () => void;
  onStaffChange: (staffId: number) => void;
  onDelete?: () => void;
  onOpenMedication: () => void;
  onOpenNotes: () => void;
  onOpenAI: () => void;
  currency: string;
  medicationCount?: number;
}

const TaskCard: React.FC<Props> = ({
  task,
  status,
  assignedStaffId,
  availableStaff,
  isPaid,
  isLoading,
  onStatusChange,
  onStaffChange,
  onDelete,
  onOpenMedication,
  onOpenNotes,
  onOpenAI,
  currency,
  medicationCount = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 transition-all group hover:border-seafoam/30 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={status === TaskStatus.COMPLETED}
            onChange={onStatusChange}
            disabled={isPaid}
            className="w-4 h-4 rounded border-slate-300 text-seafoam focus:ring-seafoam cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold uppercase tracking-tight truncate ${
              status === TaskStatus.COMPLETED 
                ? 'text-slate-400 line-through' 
                : 'text-pine dark:text-zinc-100'
            }`}>
              {task.name}
            </p>
            <p className="text-[7px] font-black text-seafoam uppercase tracking-widest mt-0.5">
              {currency} {task.price?.toLocaleString()}
            </p>
          </div>
        </div>

        {!isPaid && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={onOpenMedication}
              className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-purple-500 rounded-lg transition-all relative"
              title="Add Medication"
            >
              <Pill size={12} />
              {medicationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                  {medicationCount}
                </span>
              )}
            </button>
            <button 
              onClick={onOpenNotes}
              className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-blue-500 rounded-lg transition-all"
              title="Add Notes"
            >
              <FileText size={12} />
            </button>
            <button 
              onClick={onOpenAI}
              className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-amber-500 rounded-lg transition-all"
              title="AI Assistant"
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Wand2 size={12} />
              )}
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                title="Delete Task"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Staff Assignment */}
      {!isPaid && (
        <div className="mt-2">
          <select
            value={assignedStaffId || ''}
            onChange={(e) => onStaffChange(Number(e.target.value))}
            className="w-full text-[10px] font-bold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
          >
            <option value="">Assign Staff...</option>
            {availableStaff.map(staff => (
              <option key={staff.id} value={staff.id}>
                {staff.name} ({staff.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Task Notes Preview */}
      {task.notes && (
        <div className="mt-2 p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
          <p className="text-[9px] text-slate-600 dark:text-zinc-400 line-clamp-2">
            {task.notes}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default TaskCard;

