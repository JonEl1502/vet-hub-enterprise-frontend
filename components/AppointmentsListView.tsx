
import React, { useState, useMemo } from 'react';
import { Appointment, ApptStatus, Pet, User, Clinic } from '../types';
import { CreditCard, MoreVertical, Eye, Workflow } from 'lucide-react';
import { formatDate, formatTime } from '../services/utils/dateFormatter';

interface Props {
  appointments: Appointment[];
  pets: Pet[];
  clinics: Clinic[];
  allStaff: User[];
  onManageWorkflow: (id: number) => void;
  onUpdateApptStatus: (id: number, status: ApptStatus) => void;
  onOpenBooking: () => void;
  onProcessPayment?: (apptId: number, method: string) => void;
  onViewDetails?: (id: number) => void;
}

const AppointmentsListView: React.FC<Props> = ({
  appointments,
  pets,
  clinics,
  allStaff,
  onManageWorkflow,
  onUpdateApptStatus,
  onOpenBooking,
  onProcessPayment,
  onViewDetails
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ApptStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter(appt => activeTab === 'ALL' || appt.status === activeTab)
      .filter(appt => {
        const pet = pets.find(p => p.id === appt.petId);
        const searchLower = searchQuery.toLowerCase();
        return (
          pet?.name.toLowerCase().includes(searchLower) ||
          appt.id.toString().includes(searchLower)
        );
      });
  }, [appointments, activeTab, searchQuery, pets]);

  const getStatusBadge = (status: ApptStatus) => {
    const base = "px-3 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-wider ";
    switch (status) {
      case ApptStatus.SCHEDULED: return base + "bg-cyan/10 text-cyan border-cyan/20";
      case ApptStatus.IN_PROGRESS: return base + "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case ApptStatus.COMPLETED: return base + "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case ApptStatus.CANCELLED: return base + "bg-red-500/10 text-red-500 border-red-500/20";
      default: return base + "bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 border-slate-200 dark:border-zinc-700";
    }
  };

  // Calculate visit number per pet based on appointment date order
  const getVisitNumber = (appointment: Appointment): number => {
    const petAppointments = appointments
      .filter(a => a.petId === appointment.petId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return petAppointments.findIndex(a => a.id === appointment.id) + 1;
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Operations</h1>
          <p className="text-seafoam dark:text-zinc-400 font-medium mt-1">Enterprise scheduling and visit orchestration</p>
        </div>
        <div className="flex gap-4">
           <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam">🔍</span>
              <input 
                type="text" 
                placeholder="Search Patient Node..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-6 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-72 transition-all font-bold"
              />
           </div>
           <button onClick={onOpenBooking} className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-pine/20 dark:shadow-none transition-all active:scale-95">
             + New Visit
           </button>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
        {['ALL', ...Object.values(ApptStatus)].map((status) => (
          <button 
            key={status}
            onClick={() => setActiveTab(status as any)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === status ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-lg dark:shadow-none' : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* List - Desktop Table (hidden on mobile) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 dark:shadow-none">
        <div className="overflow-x-auto rounded-[2.5rem]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Patient Identity</th>
                {/* <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Clinical Node</th> */}
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Schedule</th>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Services</th>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Payment</th>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest whitespace-nowrap">Status</th>
                <th className="px-10 py-6 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest whitespace-nowrap text-right">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredAppointments.length > 0 ? filteredAppointments.map((appt) => {
                const pet = pets.find(p => p.id === appt.petId);
                const clinic = clinics.find(c => c.id === appt.clinicId);
                const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                const servicesCount = appt.tasks.length;
                return (
                  <tr key={appt.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shrink-0">
                          {pet?.species === 'Dog' ? '🐶' : '🐱'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-pine dark:text-zinc-100 font-black text-lg leading-tight">{pet?.name}</p>
                            {appt.parentAppointmentId && (
                              <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                Follow-up
                              </span>
                            )}
                          </div>
                          <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black mt-0.5 uppercase tracking-tighter">Visit #{getVisitNumber(appt)}</p>
                        </div>
                      </div>
                    </td>
                    {/* <td className="px-10 py-8">
                       <div className="flex items-center gap-2">
                          <span className="text-xl shrink-0">{clinic?.logo}</span>
                          <div className="min-w-0">
                             <p className="text-pine dark:text-zinc-200 font-black text-xs truncate">{clinic?.name}</p>
                             <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{clinic?.subdomain}</p>
                          </div>
                       </div>
                    </td> */}
                    <td className="px-10 py-8 whitespace-nowrap">
                      <p className="text-pine dark:text-zinc-200 font-bold text-base leading-tight">{formatDate(appt.date)}</p>
                      <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black mt-0.5 uppercase tracking-widest">{formatTime(appt.date)}</p>
                    </td>
                    <td className="px-10 py-8 whitespace-nowrap">
                      <div className="space-y-1">
                        <p className="text-pine dark:text-zinc-200 font-bold text-sm">{categoriesCount} {categoriesCount === 1 ? 'Category' : 'Categories'}</p>
                        <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest">{servicesCount} {servicesCount === 1 ? 'Service' : 'Services'}</p>
                      </div>
                    </td>
                    <td className="px-10 py-8 whitespace-nowrap">
                      <div className="space-y-2">
                        <p className="text-pine dark:text-zinc-100 font-black font-mono text-base">{clinic?.currency || 'KES'} {appt.totalCost.toLocaleString()}</p>
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-block ${
                          appt.isPaid
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {appt.isPaid ? `Paid: ${appt.paymentMethod}` : 'Unpaid'}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-8 whitespace-nowrap">
                      <span className={getStatusBadge(appt.status)}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-10 py-8 text-right overflow-visible">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === appt.id ? null : appt.id)}
                          className="bg-seafoam hover:bg-seafoam/90 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm flex items-center gap-2 ml-auto"
                        >
                          <MoreVertical size={14} />
                          Actions
                        </button>
                        {openDropdownId === appt.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenDropdownId(null)}
                            />
                            <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 z-20 overflow-hidden shadow-xl">
                              <button
                                onClick={() => {
                                  onManageWorkflow(appt.id);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100"
                              >
                                <Workflow size={16} className="text-seafoam" />
                                <div>
                                  <p className="font-black text-[10px] uppercase tracking-widest">View Workflow</p>
                                  <p className="text-[8px] text-slate-400 dark:text-zinc-500">Manage appointment tasks</p>
                                </div>
                              </button>
                              {onViewDetails && (
                                <button
                                  onClick={() => {
                                    onViewDetails(appt.id);
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100 border-t border-slate-100 dark:border-zinc-800"
                                >
                                  <Eye size={16} className="text-seafoam" />
                                  <div>
                                    <p className="font-black text-[10px] uppercase tracking-widest">View Details</p>
                                    <p className="text-[8px] text-slate-400 dark:text-zinc-500">Read-only appointment view</p>
                                  </div>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="py-40 text-center">
                     <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6 opacity-40">📅</div>
                     <p className="text-pine dark:text-zinc-100 font-black text-xl uppercase tracking-tighter">Clinical Node Clear</p>
                     <p className="text-seafoam dark:text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">No scheduled activity in this context.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View (shown only on mobile) */}
      <div className="md:hidden space-y-4">
        {filteredAppointments.length > 0 ? filteredAppointments.map((appt) => {
          const pet = pets.find(p => p.id === appt.petId);
          const clinic = clinics.find(c => c.id === appt.clinicId);
          const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
          const servicesCount = appt.tasks.length;
          return (
            <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg shadow-slate-200/30 dark:shadow-none overflow-visible">
              {/* Card Header */}
              <div className="bg-slate-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 flex items-center justify-center text-2xl">
                    {pet?.species === 'Dog' ? '🐶' : '🐱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-pine dark:text-zinc-100 font-black text-base">{pet?.name}</p>
                    <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black uppercase tracking-tighter">Visit #{getVisitNumber(appt)}</p>
                  </div>
                  <span className={getStatusBadge(appt.status)}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-4">
                {/* Clinic */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Clinic</span>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-lg">{clinic?.logo}</span>
                    <div>
                      <p className="text-pine dark:text-zinc-100 font-black text-sm">{clinic?.name}</p>
                      <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{clinic?.subdomain}</p>
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Schedule</span>
                  <div className="text-right">
                    <p className="text-pine dark:text-zinc-100 font-bold">{formatDate(appt.date)}</p>
                    <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-widest">{formatTime(appt.date)}</p>
                  </div>
                </div>

                {/* Services */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Services</span>
                  <div className="text-right">
                    <p className="text-pine dark:text-zinc-100 font-bold">{categoriesCount} {categoriesCount === 1 ? 'Category' : 'Categories'}</p>
                    <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-widest">{servicesCount} {servicesCount === 1 ? 'Service' : 'Services'}</p>
                  </div>
                </div>

                {/* Payment */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Payment</span>
                  <div className="text-right">
                    <p className="text-pine dark:text-zinc-100 font-black font-mono text-base">{clinic?.currency || 'KES'} {appt.totalCost.toLocaleString()}</p>
                    <span className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest inline-block mt-2 ${
                      appt.isPaid
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {appt.isPaid ? `Paid: ${appt.paymentMethod}` : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer - Action Buttons */}
              <div className="bg-slate-50 dark:bg-zinc-800/50 px-6 py-4 border-t border-slate-200 dark:border-zinc-800">
                <div className="space-y-2">
                  <button
                    onClick={() => onManageWorkflow(appt.id)}
                    className="w-full bg-seafoam hover:bg-seafoam/90 text-white px-4 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Workflow size={16} />
                    View Workflow
                  </button>
                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(appt.id)}
                      className="w-full bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-pine dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 px-4 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Eye size={16} />
                      View Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6 opacity-40">📅</div>
            <p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">Clinical Node Clear</p>
            <p className="text-seafoam dark:text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">No scheduled activity in this context.</p>
          </div>
        )}
      </div>
      </div>
  );
};

export default AppointmentsListView;
