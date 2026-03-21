
import React, { useState, useEffect, useRef } from 'react';
import { Appointment, Pet, Clinic, MedicalRecord, TaskStatus } from '../types';
import { ArrowLeft, Calendar, DollarSign, CheckCircle2, FileText, Receipt, Stethoscope, User, Phone, Mail, MapPin, Pill, Workflow } from 'lucide-react';
import { formatDate, formatTime } from '../services/utils/dateFormatter';
import { SERVICE_CATEGORIES } from '../constants';
import { appointmentMedicationsAPI, AppointmentMedication } from '../services/modules/appointmentMedications.api';

interface Props {
  appointment: Appointment;
  pet: Pet;
  clinic: Clinic;
  client?: { id: number; name: string; email: string; phone: string; address?: string };
  onBack: () => void;
  onRefresh?: () => Promise<void>;
  onOpenWorkflow?: () => void;
}

const AppointmentReadOnlyView: React.FC<Props> = ({ appointment, pet, clinic, client, onBack, onRefresh, onOpenWorkflow }) => {
  const progress = Math.round((appointment.tasks.filter(t => t.status === TaskStatus.COMPLETED).length / appointment.tasks.length) * 100);
  const activeMedRecord = pet.medicalHistory?.find(h => h.appointmentId === appointment.id);

  const [taskMedications, setTaskMedications] = useState<Record<number, AppointmentMedication[]>>({});

  const hasRefreshed = useRef(false);
  useEffect(() => {
    if (!hasRefreshed.current && onRefresh) {
      hasRefreshed.current = true;
      onRefresh().catch(error => console.error('Failed to refresh appointment data:', error));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadAllMedications = async () => {
      try {
        const allMeds = await appointmentMedicationsAPI.getMedicationsByAppointment(appointment.id.toString());
        const medsByTask: Record<number, AppointmentMedication[]> = {};
        allMeds.forEach((med: AppointmentMedication) => {
          if (med.taskId) {
            const taskId = parseInt(med.taskId);
            if (!medsByTask[taskId]) medsByTask[taskId] = [];
            medsByTask[taskId].push(med);
          }
        });
        setTaskMedications(medsByTask);
      } catch (error) {
        console.error('Failed to load appointment medications:', error);
      }
    };
    loadAllMedications();
  }, [appointment.id]);

  const tasksByCategory = appointment.tasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = [];
    acc[task.category].push(task);
    return acc;
  }, {} as Record<string, typeof appointment.tasks>);

  const getStatusBadge = (status: TaskStatus) => {
    const base = "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block ";
    switch (status) {
      case TaskStatus.COMPLETED: return base + "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
      case TaskStatus.IN_PROGRESS: return base + "bg-cyan/10 text-cyan border border-cyan/20";
      default: return base + "bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700";
    }
  };

  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
        >
          <ArrowLeft size={18} className="text-pine dark:text-zinc-100" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">Appointment Details</h1>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">#{appointment.id} · {formatDate(appointment.date)} · {formatTime(appointment.date)}</p>
        </div>
        {onOpenWorkflow && (
          <button
            onClick={onOpenWorkflow}
            className="shrink-0 flex items-center gap-2 px-3 py-2 bg-seafoam hover:bg-seafoam/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
          >
            <Workflow size={13} />
            <span className="hidden sm:inline">Open Workflow</span>
          </button>
        )}
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-r from-pine to-seafoam rounded-2xl p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl">
            {pet.species === 'Dog' ? '🐶' : '🐱'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-white tracking-tight uppercase truncate">{pet.name}</h2>
            <p className="text-white/80 text-xs font-medium">{pet.species} · {pet.breed}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block ${
              appointment.isPaid ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/30' : 'bg-amber-400/20 text-amber-100 border border-amber-300/30'
            }`}>{appointment.isPaid ? 'Paid' : 'Unpaid'}</span>
            <p className="text-white font-black font-mono text-base mt-1">{clinic.currency} {appointment.totalCost.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Calendar size={10}/> Status</p>
          <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase">{appointment.status.replace('_', ' ')}</p>
          <div className="mt-1.5 h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-seafoam transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[8px] text-slate-400 font-bold mt-0.5">{progress}% done</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><DollarSign size={10}/> Total</p>
          <p className="text-base font-black font-mono text-pine dark:text-zinc-100">{clinic.currency} {appointment.totalCost.toLocaleString()}</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{appointment.paymentMethod || 'Unpaid'}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Stethoscope size={10}/> Services</p>
          <p className="text-base font-black text-pine dark:text-zinc-100">{appointment.tasks.length}</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{new Set(appointment.tasks.map(t => t.category)).size} categories</p>
        </div>
      </div>

      {/* Client Info */}
      {client && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={14} className="text-seafoam" />
            <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Client</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <User size={13} className="text-slate-400" />, label: 'Name', value: client.name },
              { icon: <Phone size={13} className="text-slate-400" />, label: 'Phone', value: client.phone },
              { icon: <Mail size={13} className="text-slate-400" />, label: 'Email', value: client.email },
              ...(client.address ? [{ icon: <MapPin size={13} className="text-slate-400" />, label: 'Address', value: client.address }] : []),
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                {item.icon}
                <div className="min-w-0">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                  <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services & Tasks */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} className="text-seafoam" />
          <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Services & Tasks</h3>
        </div>
        <div className="space-y-3">
          {(Object.entries(tasksByCategory) as [string, typeof appointment.tasks][]).map(([category, tasks]) => (
            <div key={category}>
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-1.5 mb-2">
                <span className="text-sm">{SERVICE_CATEGORIES.find(c => c.name === category)?.icon || '📋'}</span>
                <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-400">{category}</h4>
              </div>
              <div className="space-y-1.5 pl-1">
                {tasks.map(task => (
                  <div key={task.id} className="bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-pine dark:text-zinc-100">{task.name}</p>
                        {task.notes && <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">{task.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={getStatusBadge(task.status)}>{task.status}</span>
                        <p className="text-xs font-black font-mono text-pine dark:text-zinc-100">{clinic.currency} {task.price?.toLocaleString()}</p>
                      </div>
                    </div>
                    {taskMedications[task.id]?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-zinc-700">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Pill size={11} className="text-purple-500" />
                          <p className="text-[8px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                            Medications ({taskMedications[task.id].length})
                          </p>
                        </div>
                        <div className="space-y-1">
                          {taskMedications[task.id].map((med) => (
                            <div key={med.id} className="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-purple-200 dark:border-purple-800">
                              <Pill size={11} className="text-purple-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{med.inventoryItem?.name || 'Medication'}</p>
                                <p className="text-[8px] text-slate-400">
                                  Qty: {med.quantity} {med.inventoryItem?.unit || 'units'}
                                  {med.isDeducted && <span className="ml-1.5 text-emerald-500">✓ Deducted</span>}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Medical Record */}
      {activeMedRecord && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} className="text-seafoam" />
            <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Medical Record</h3>
          </div>
          <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl border border-slate-100 dark:border-zinc-700 space-y-3">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosis</p>
              <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeMedRecord.diagnosis || 'No diagnosis recorded'}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Treatment</p>
              <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeMedRecord.treatment || 'No treatment recorded'}</p>
            </div>
            {activeMedRecord.medications?.length > 0 && (
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Medications</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {activeMedRecord.medications.map((med, idx) => (
                    <li key={idx} className="text-xs text-slate-700 dark:text-zinc-300">{med}</li>
                  ))}
                </ul>
              </div>
            )}
            {activeMedRecord.notes && (
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeMedRecord.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment */}
      {appointment.isPaid && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Receipt size={14} className="text-seafoam" />
            <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Payment</h3>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Method</p>
              <p className="text-xs font-bold text-pine dark:text-zinc-100">{appointment.paymentMethod}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Amount</p>
              <p className="text-sm font-black font-mono text-emerald-600">{clinic.currency} {appointment.totalCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
              <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Paid</span>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Date</p>
              <p className="text-xs font-bold text-pine dark:text-zinc-100">{formatDate(appointment.date)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pet & Clinic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope size={14} className="text-seafoam" />
            <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Pet</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Species', value: pet.species },
              { label: 'Breed', value: pet.breed },
              { label: 'Age', value: `${pet.age} yrs` },
              ...(pet.weight ? [{ label: 'Weight', value: `${pet.weight} kg` }] : []),
              ...(pet.color ? [{ label: 'Color', value: pet.color }] : []),
              ...(pet.microchipId ? [{ label: 'Microchip', value: pet.microchipId }] : []),
            ].map(item => (
              <div key={item.label} className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={14} className="text-seafoam" />
            <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Clinic</h3>
          </div>
          <div className="space-y-2">
            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Name</p>
              <p className="text-xs font-bold text-pine dark:text-zinc-100">{clinic.name}</p>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Location</p>
              <p className="text-xs font-bold text-pine dark:text-zinc-100">{clinic.location}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentReadOnlyView;
