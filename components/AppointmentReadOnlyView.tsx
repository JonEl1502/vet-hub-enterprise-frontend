
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

  // State for medications
  const [taskMedications, setTaskMedications] = useState<Record<number, AppointmentMedication[]>>({});

  // Refresh appointment data once on mount — use a ref so this never re-fires
  // even if the onRefresh function reference changes between renders
  const hasRefreshed = useRef(false);
  useEffect(() => {
    if (!hasRefreshed.current && onRefresh) {
      hasRefreshed.current = true;
      onRefresh().catch(error => console.error('Failed to refresh appointment data:', error));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load all medications for the appointment on mount
  useEffect(() => {
    const loadAllMedications = async () => {
      try {
        const allMeds = await appointmentMedicationsAPI.getMedicationsByAppointment(appointment.id.toString());
        // Group medications by task ID
        const medsByTask: Record<number, AppointmentMedication[]> = {};
        allMeds.forEach((med: AppointmentMedication) => {
          if (med.taskId) {
            const taskId = parseInt(med.taskId);
            if (!medsByTask[taskId]) {
              medsByTask[taskId] = [];
            }
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

  // Group tasks by category
  const tasksByCategory = appointment.tasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = [];
    acc[task.category].push(task);
    return acc;
  }, {} as Record<string, typeof appointment.tasks>);

  const getStatusBadge = (status: TaskStatus) => {
    const base = "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block ";
    switch (status) {
      case TaskStatus.COMPLETED: return base + "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
      case TaskStatus.IN_PROGRESS: return base + "bg-cyan/10 text-cyan border border-cyan/20";
      case TaskStatus.PENDING: return base + "bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700";
      default: return base + "bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700";
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
        >
          <ArrowLeft size={20} className="text-pine dark:text-zinc-100" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">Appointment Details</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-medium">View complete appointment information</p>
        </div>
        {onOpenWorkflow && (
          <button
            onClick={onOpenWorkflow}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-seafoam hover:bg-seafoam/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
          >
            <Workflow size={14} />
            <span className="hidden sm:inline">Open Workflow</span>
          </button>
        )}
      </div>

      {/* Pet & Appointment Header Card */}
      <div className="bg-gradient-to-r from-pine to-seafoam rounded-3xl p-5 sm:p-8 shadow-lg">
        <div className="flex items-start sm:items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl sm:text-5xl">
            {pet.species === 'Dog' ? '🐶' : '🐱'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase mb-1 truncate">{pet.name}</h2>
            <p className="text-white/90 text-sm sm:text-base font-medium mb-2">{pet.species} • {pet.breed}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {formatDate(appointment.date)}
              </span>
              <span className="hidden sm:inline">•</span>
              <span>{formatTime(appointment.date)}</span>
              <span className="hidden sm:inline">•</span>
              <span className="font-bold">#{appointment.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Client Information Card */}
      {client && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <User size={20} className="text-seafoam" />
            <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Client Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <User size={18} className="text-slate-400" />
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Name</p>
                <p className="text-sm font-bold text-pine dark:text-zinc-100">{client.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <Phone size={18} className="text-slate-400" />
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                <p className="text-sm font-bold text-pine dark:text-zinc-100">{client.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <Mail size={18} className="text-slate-400" />
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                <p className="text-sm font-bold text-pine dark:text-zinc-100">{client.email}</p>
              </div>
            </div>
            {client.address && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <MapPin size={18} className="text-slate-400" />
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</p>
                  <p className="text-sm font-bold text-pine dark:text-zinc-100">{client.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-6">
          {/* Appointment Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl p-5 border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-3 mb-2">
                <Calendar size={20} className="text-seafoam" />
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</p>
              </div>
              <p className="text-lg font-black text-pine dark:text-zinc-100 uppercase">{appointment.status}</p>
              <div className="mt-2">
                <div className="h-2 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-seafoam transition-all" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{progress}% Complete</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl p-5 border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign size={20} className="text-seafoam" />
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Cost</p>
              </div>
              <p className="text-2xl font-black font-mono text-pine dark:text-zinc-100">{clinic.currency} {appointment.totalCost.toLocaleString()}</p>
              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block mt-2 ${
                appointment.isPaid
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
              }`}>
                {appointment.isPaid ? `Paid: ${appointment.paymentMethod}` : 'Unpaid'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl p-5 border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-3 mb-2">
                <Stethoscope size={20} className="text-seafoam" />
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Services</p>
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">{appointment.tasks.length}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {new Set(appointment.tasks.map(t => t.category)).size} Categories
              </p>
            </div>
          </div>

          {/* Services/Tasks Section */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <CheckCircle2 size={20} className="text-seafoam" />
              <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Services & Tasks</h3>
            </div>
            <div className="space-y-5">
              {(Object.entries(tasksByCategory) as [string, typeof appointment.tasks][]).map(([category, tasks]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                    <span className="text-lg">{SERVICE_CATEGORIES.find(c => c.name === category)?.icon || '📋'}</span>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">{category}</h4>
                  </div>
                  <div className="space-y-2 pl-2">
                    {tasks.map(task => (
                      <div key={task.id} className="bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-pine dark:text-zinc-100">{task.name}</p>
                            {task.notes && (
                              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{task.notes}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={getStatusBadge(task.status)}>{task.status}</span>
                            <p className="text-sm font-black font-mono text-pine dark:text-zinc-100">{clinic.currency} {task.price?.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Medications Display */}
                        {taskMedications[task.id] && taskMedications[task.id].length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Pill size={14} className="text-purple-500" />
                              <p className="text-[8px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                                Medications ({taskMedications[task.id].length})
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              {taskMedications[task.id].map((med) => (
                                <div key={med.id} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-lg border border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Pill size={12} className="text-purple-500 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">
                                        {med.inventoryItem?.name || 'Medication'}
                                      </p>
                                      <p className="text-[8px] text-slate-400">
                                        Qty: {med.quantity} {med.inventoryItem?.unit || 'units'}
                                        {med.isDeducted && <span className="ml-2 text-emerald-500">✓ Deducted</span>}
                                      </p>
                                    </div>
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

          {/* Medical Record Section */}
          {activeMedRecord && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <FileText size={20} className="text-seafoam" />
                <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Medical Record</h3>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-800 p-5 rounded-xl border border-slate-100 dark:border-zinc-700">
                <div className="space-y-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Diagnosis</p>
                    <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {activeMedRecord.diagnosis || 'No diagnosis recorded'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Treatment</p>
                    <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {activeMedRecord.treatment || 'No treatment recorded'}
                    </p>
                  </div>
                  {activeMedRecord.medications && activeMedRecord.medications.length > 0 && (
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Medications</p>
                      <ul className="list-disc list-inside space-y-1">
                        {activeMedRecord.medications.map((med, idx) => (
                          <li key={idx} className="text-sm text-slate-700 dark:text-zinc-300">{med}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {activeMedRecord.notes && (
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</p>
                      <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {activeMedRecord.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Payment Information */}
        {appointment.isPaid && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <Receipt size={20} className="text-seafoam" />
              <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Payment Details</h3>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Method</p>
                  <p className="text-sm font-bold text-pine dark:text-zinc-100">{appointment.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount Paid</p>
                  <p className="text-lg font-black font-mono text-emerald-600">{clinic.currency} {appointment.totalCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <span className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Paid
                  </span>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                  <p className="text-sm font-bold text-pine dark:text-zinc-100">{formatDate(appointment.date)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pet Information */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Stethoscope size={20} className="text-seafoam" />
            <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Pet Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Species</p>
              <p className="text-sm font-bold text-pine dark:text-zinc-100">{pet.species}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Breed</p>
              <p className="text-sm font-bold text-pine dark:text-zinc-100">{pet.breed}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Age</p>
              <p className="text-sm font-bold text-pine dark:text-zinc-100">{pet.age} years</p>
            </div>
            {pet.weight && (
              <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Weight</p>
                <p className="text-sm font-bold text-pine dark:text-zinc-100">{pet.weight} kg</p>
              </div>
            )}
            {pet.color && (
              <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Color</p>
                <p className="text-sm font-bold text-pine dark:text-zinc-100">{pet.color}</p>
              </div>
            )}
            {pet.microchipId && (
              <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Microchip ID</p>
                <p className="text-sm font-bold text-pine dark:text-zinc-100 font-mono">{pet.microchipId}</p>
              </div>
            )}
          </div>
        </div>

        {/* Clinic Information */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <MapPin size={20} className="text-seafoam" />
            <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Clinic Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Clinic Name</p>
              <p className="text-sm font-bold text-pine dark:text-zinc-100">{clinic.name}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
              <p className="text-sm font-bold text-pine dark:text-zinc-100">{clinic.location}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentReadOnlyView;

