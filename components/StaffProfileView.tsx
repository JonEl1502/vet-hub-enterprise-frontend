
import React, { useState, useMemo } from 'react';
import { User, UserRole, Clinic, Appointment, ApptTask, TaskStatus, ActivityLog } from '../types';
import { ShieldCheck, Mail, Calendar, Hash, BadgeCheck, GraduationCap, ArrowLeft, History, BarChart3, ClipboardList, Clock, CheckCircle2, Layout, Activity, User as UserIcon } from 'lucide-react';

interface Props {
  staff: User;
  clinics: Clinic[];
  appointments: Appointment[];
  onBack: () => void;
}

const StaffProfileView: React.FC<Props> = ({ staff, clinics, appointments, onBack }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'activity'>('profile');

  const staffWork = useMemo(() => {
    const tasks: ApptTask[] = [];
    const apptsHandled = new Set<number>();
    
    appointments.forEach(a => {
      a.tasks.forEach(t => {
        if (t.assignedStaffId === staff.id) {
          tasks.push(t);
          apptsHandled.add(a.id);
        }
      });
    });

    const categoryStats: Record<string, number> = {};
    tasks.forEach(t => {
      categoryStats[t.category] = (categoryStats[t.category] || 0) + 1;
    });

    return {
      totalVisits: apptsHandled.size,
      totalServices: tasks.length,
      completedServices: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      categoryStats: Object.entries(categoryStats).sort((a, b) => b[1] - a[1])
    };
  }, [appointments, staff.id]);

  const renderProfile = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm space-y-10">
             <div className="flex items-center gap-4 border-b border-slate-100 dark:border-zinc-800 pb-6">
                <ShieldCheck className="text-seafoam" size={24}/>
                <h3 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Identity Profile</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                   {[
                     { label: 'Legal Identity', val: staff.name, icon: UserIcon },
                     { label: 'System Access Role', val: staff.role.replace('_', ' '), icon: ShieldCheck },
                     { label: 'ID Number', val: staff.idNumber || 'NOT_PROVIDED', icon: Hash },
                   ].map(i => (
                     <div key={i.label} className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-slate-400 aspect-square"><i.icon size={18}/></div>
                        <div className="min-w-0">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                           <p className="text-pine dark:text-zinc-100 font-bold text-base leading-tight truncate uppercase">{i.val}</p>
                        </div>
                     </div>
                   ))}
                </div>
                <div className="space-y-6">
                   {[
                     { label: 'Secure Email', val: staff.email, icon: Mail },
                     { label: 'Temporal Origin (DOB)', val: staff.dob || 'Unknown', icon: Calendar },
                     { label: 'Bio Age', val: staff.age ? `${staff.age} Years` : 'Unknown', icon: Clock },
                   ].map(i => (
                     <div key={i.label} className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-slate-400 aspect-square"><i.icon size={18}/></div>
                        <div className="min-w-0">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                           <p className="text-pine dark:text-zinc-100 font-bold text-base leading-tight truncate uppercase">{i.val}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm">
             <div className="flex items-center gap-3 mb-8">
                <GraduationCap className="text-seafoam" size={20}/>
                <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Verified Certifications</h3>
             </div>
             <div className="flex flex-wrap gap-3">
                {staff.certifications?.length ? staff.certifications.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest">
                     <BadgeCheck size={14}/>
                     {c}
                  </div>
                )) : (
                  <div className="w-full py-12 text-center border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-30 font-black uppercase text-[10px] tracking-widest">No certified credentials on file.</div>
                )}
             </div>
          </div>
       </div>

       <div className="space-y-8">
          <div className="bg-pine rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-1000"><Activity size={100} /></div>
             <p className="text-mist/40 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Operational Status</p>
             <div className="flex items-center gap-4 mb-8">
                <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-2xl font-black uppercase tracking-tighter">Active Status</span>
             </div>
             <p className="text-mist/60 text-[10px] font-bold uppercase tracking-widest">Currently Active</p>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Clinic Authorization</h4>
             <div className="flex flex-wrap gap-2">
                {staff.clinicIds.map(cid => (
                  <div key={cid} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-lg">
                     <span className="text-lg">{clinics.find(c => c.id === cid)?.logo}</span>
                     <span className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">{clinics.find(c => c.id === cid)?.name}</span>
                  </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );

  const renderStats = () => (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            { label: 'Visits Handled', val: staffWork.totalVisits, icon: History, color: 'text-seafoam', bg: 'bg-seafoam/10' },
            { label: 'Services Provided', val: staffWork.totalServices, icon: ClipboardList, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: 'Services Completed', val: staffWork.completedServices, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Efficiency Rate', val: '98%', icon: BarChart3, color: 'text-cyan', bg: 'bg-cyan/10' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
               <div className={`w-12 h-12 rounded-2xl ${s.bg} ${s.color} flex items-center justify-center mb-4`}><s.icon size={24}/></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
               <h3 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter">{s.val}</h3>
            </div>
          ))}
       </div>

       <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm">
          <div className="flex items-center justify-between mb-10">
             <div>
                <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Clinical Specialization</h3>
                <p className="text-seafoam text-[9px] font-black uppercase tracking-widest">Service category distribution</p>
             </div>
          </div>
          <div className="space-y-6">
             {staffWork.categoryStats.map(([cat, count]) => {
                const percentage = Math.round((count / staffWork.totalServices) * 100);
                return (
                  <div key={cat} className="space-y-2">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase">
                        <span className="text-slate-500 dark:text-zinc-400">{cat}</span>
                        <span className="text-pine dark:text-zinc-100">{count} Services • {percentage}%</span>
                     </div>
                     <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-seafoam transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                     </div>
                  </div>
                );
             })}
          </div>
       </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
       <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-6">
           <button onClick={onBack} className="w-12 h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center text-seafoam hover:text-pine transition-all shadow-lg active:scale-95">
             <ArrowLeft size={20}/>
           </button>
           <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 flex items-center justify-center text-4xl shadow-xl shrink-0 overflow-hidden">
                <img src={staff.avatar} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="min-w-0">
                <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{staff.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 truncate">
                   Staff Profile
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0"></span>
                   ID: STF-{staff.id}
                </p>
              </div>
           </div>
        </div>

        <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-x-auto no-scrollbar scroll-smooth">
           {[
             { id: 'profile', label: 'Profile', icon: UserIcon },
             { id: 'stats', label: 'Performance', icon: BarChart3 },
             { id: 'activity', label: 'Activity Log', icon: History },
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
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
      </header>

      <div className="min-h-[50vh]">
         {activeTab === 'profile' && renderProfile()}
         {activeTab === 'stats' && renderStats()}
         {activeTab === 'activity' && (
            <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4">
                <div className="relative pl-8 space-y-12 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-slate-200 dark:before:bg-zinc-800 before:rounded-full">
                  {staff.activityLogs?.length ? staff.activityLogs.map((log, idx) => (
                    <div key={log.id} className="relative group">
                       <div className="absolute -left-10 top-0 w-5 h-5 rounded-full border-4 border-white dark:border-zinc-950 bg-seafoam shadow-xl transition-transform group-hover:scale-125 z-10"></div>
                       <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm transition-all group-hover:shadow-xl group-hover:border-seafoam/20">
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                <span className="bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-300 px-3 py-1 rounded-lg text-[8px] font-black uppercase border border-slate-200 dark:border-zinc-700 tracking-widest">{log.action}</span>
                                <h4 className="text-sm font-black text-pine dark:text-zinc-100 uppercase mt-2">{log.description}</h4>
                             </div>
                             <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">{log.timestamp}</p>
                          </div>
                       </div>
                    </div>
                  )) : (
                    <div className="py-40 text-center opacity-20 font-black uppercase tracking-[0.4em] text-sm">No recent activity.</div>
                  )}
                </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default StaffProfileView;
