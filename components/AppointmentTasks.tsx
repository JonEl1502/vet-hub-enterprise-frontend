
import React from 'react';
import { Appointment, ApptTask, TaskStatus } from '../types';

interface Props {
  appointment: Appointment;
  onUpdateStatus: (apptId: number, taskId: number, status: TaskStatus) => void;
  onManageWorkflow: (apptId: number) => void;
}

const AppointmentTasks: React.FC<Props> = ({ appointment, onUpdateStatus, onManageWorkflow }) => {
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
      case TaskStatus.IN_PROGRESS: return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      case TaskStatus.BLOCKED: return 'bg-red-500/20 text-red-500 border-red-500/30';
      default: return 'bg-zinc-800 text-zinc-500 border-zinc-700';
    }
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-sm hover:border-[#3f3f46] transition-all">
      <div className="px-6 py-4 bg-[#27272a]/30 border-b border-[#27272a] flex justify-between items-center">
        <h3 className="text-white font-semibold">Live Treatment Workflow</h3>
        <span className="text-[#71717a] text-xs font-mono">ID: {appointment.id}</span>
      </div>
      <div className="p-6 space-y-4">
        {appointment.tasks.slice(0, 3).map((task) => (
          <div 
            key={task.id} 
            className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
              task.status === TaskStatus.COMPLETED ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900 border-transparent'
            }`}
          >
            <div className="flex items-center gap-4">
              <input 
                type="checkbox" 
                checked={task.status === TaskStatus.COMPLETED}
                disabled={task.status === TaskStatus.BLOCKED}
                onChange={() => onUpdateStatus(appointment.id, task.id, task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED)}
                className="w-5 h-5 rounded border-[#3f3f46] bg-[#09090b] text-indigo-500 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <div>
                <p className={`text-sm font-medium ${task.status === TaskStatus.COMPLETED ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                  {task.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono uppercase tracking-wider">{task.category}</span>
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${getStatusColor(task.status)}`}>
              {task.status}
            </span>
          </div>
        ))}
        {appointment.tasks.length > 3 && (
          <p className="text-center text-xs text-zinc-600 italic">+{appointment.tasks.length - 3} more tasks in this workflow</p>
        )}
      </div>
      
      <div className="px-6 py-4 bg-[#27272a]/30 border-t border-[#27272a] flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <p className="text-[#a1a1aa] text-[10px] font-bold uppercase tracking-wider">Cloud Synchronized</p>
        </div>
        <button 
          onClick={() => onManageWorkflow(appointment.id)}
          className="text-indigo-500 text-xs font-bold hover:underline"
        >
          Manage Full Workflow &rarr;
        </button>
      </div>
    </div>
  );
};

export default AppointmentTasks;
