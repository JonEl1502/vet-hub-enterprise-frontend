import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Home, Loader2, Save } from 'lucide-react';
import { Visit, ApptStatus } from '../../../types';
import { visitsAPI, toast } from '../../../services';
import { useData } from '../../../contexts/DataContext';

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Visit;
}

const EditVisitModal: React.FC<EditAppointmentModalProps> = ({ isOpen, onClose, appointment }) => {
  const { updateAppointmentOptimistically } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: appointment.date.split('T')[0],
    time: appointment.date.split('T')[1]?.substring(0, 5) || '09:00',
    status: appointment.status,
    isHouseCall: appointment.isHouseCall || false,
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: appointment.date.split('T')[0],
        time: appointment.date.split('T')[1]?.substring(0, 5) || '09:00',
        status: appointment.status,
        isHouseCall: appointment.isHouseCall || false,
      });
      setError(null);
    }
  }, [isOpen, appointment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const updateData = {
        apptDate: formData.date,
        apptTime: formData.time,
        status: formData.status,
        isHouseCall: formData.isHouseCall,
      };

      const response: any = await visitsAPI.update(appointment.id, updateData);

      if (response.success) {
        const updated = response.data.appointment as any;
        updateAppointmentOptimistically(appointment.id, (prev) => ({
          ...prev,
          date: updated.scheduledAt ?? updated.date ?? prev.date,
          status: updated.status ?? prev.status,
          isHouseCall: updated.isHouseCall ?? prev.isHouseCall,
        }));
        toast.success('Visit updated successfully');
        onClose();
      } else {
        throw new Error(response.message || 'Failed to update appointment');
      }
    } catch (err: any) {
      console.error('Failed to update appointment:', err);
      setError(err.message || 'Failed to update appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Calendar size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
              Edit Visit
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            disabled={isSubmitting}
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-2xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Date *
              </label>
              <div className="relative">
                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                />
              </div>
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Time *
              </label>
              <div className="relative">
                <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ApptStatus })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none"
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </div>

            {/* House Call */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
              <Home size={20} className="text-slate-400" />
              <div className="flex-1">
                <label className="block text-sm font-black text-pine dark:text-zinc-100">
                  House Call
                </label>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Mark this appointment as a house call
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isHouseCall: !formData.isHouseCall })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.isHouseCall ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    formData.isHouseCall ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-seafoam/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-seafoam/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditVisitModal;
