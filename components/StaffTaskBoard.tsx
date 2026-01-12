
import React, { useState, useMemo } from 'react';
import { Appointment, ApptTask, TaskStatus, User, UserRole } from '../types';
import { mockStaff } from '../store';

interface Props {
  currentUser: User;
  appointments: Appointment[];
  staffMembers: User[];
  onUpdateStatus: (apptId: number, taskId: number, status: TaskStatus) => void;
  onReassign: (apptId: number, taskId: number, staffId: number) => void;
  onViewAppointment: (apptId: number) => void;
}

const StaffTaskBoard: React.FC<Props> = ({ currentUser, appointments, staffMembers, onUpdateStatus, onReassign, onViewAppointment }) => {
  const [filterStaffId, setFilterStaffId] = useState<number>(currentUser.id);
  const [activeTab, setActiveTab] = useState<TaskStatus | 'ALL'>('ALL');

  const allTasks = useMemo(() => {
    const tasks: (ApptTask & { apptId: number; apptName: string })[] = [];
    appointments.forEach(appt => {
      appt.tasks.forEach(task => {
        tasks.push({ ...task, apptId: appt.id, apptName: `Appointment #${appt.id}` });
      });
    });
    return tasks;
  }, [appointments]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      const matchStaff = t.assignedStaffId === filterStaffId;
      const matchStatus = activeTab === 'ALL' || t.status === activeTab;
      return matchStaff && matchStatus;
    });
  }, [allTasks, filterStaffId, activeTab]);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case TaskStatus.IN_PROGRESS: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case TaskStatus.BLOCKED: return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Staff Task Board</h1>
          <p className="text-zinc-500 mt-1">Manage and track live clinical workflows</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Viewing For:</label>
          <select 
            value={filterStaffId}
            onChange={(e) => setFilterStaffId(Number(e.target.value))}
            className="bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
          </select>
        </div>
      </header>

      <div className="flex gap-4 border-b border-[#27272a]">
        {['ALL', TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.BLOCKED].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks.length > 0 ? filteredTasks.map((task) => (
          <div key={`${task.apptId}-${task.id}`} className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 hover:border-indigo-500/30 transition-all flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-widest ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
                <button 
                  onClick={() => onViewAppointment(task.apptId)}
                  className="text-[10px] text-zinc-600 font-mono hover:text-indigo-500 transition-colors"
                >
                  {task.apptName} &rarr;
                </button>
              </div>
              <h3 className="text-white font-bold text-lg mb-1">{task.name}</h3>
              <p className="text-zinc-500 text-xs uppercase tracking-tighter font-semibold">{task.category}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-[#27272a] space-y-4">
              <div className="flex flex-wrap gap-2">
                {[TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.BLOCKED].map(status => (
                  <button 
                    key={status}
                    onClick={() => onUpdateStatus(task.apptId, task.id, status)}
                    disabled={task.status === status}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                      task.status === status 
                      ? 'bg-zinc-800 text-zinc-600 border-zinc-700 cursor-default shadow-inner' 
                      : 'bg-[#1d1d21] text-zinc-400 border-transparent hover:border-indigo-500'
                    }`}
                  >
                    Set {status.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">Reassign:</label>
                <select 
                  onChange={(e) => onReassign(task.apptId, task.id, Number(e.target.value))}
                  className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-[10px] text-zinc-300 focus:ring-1 focus:ring-indigo-500 outline-none flex-1"
                >
                  <option value="">Move task...</option>
                  {staffMembers.filter(s => s.id !== filterStaffId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-[#27272a] rounded-3xl bg-[#18181b]/30">
            <span className="text-4xl mb-4 opacity-20">✅</span>
            <p className="text-zinc-500 text-sm font-medium">No tasks found matching these filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffTaskBoard;
