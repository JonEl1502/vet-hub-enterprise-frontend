import React, { useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { format, addMinutes, setHours, setMinutes, isBefore, isAfter, isSameDay } from 'date-fns';
import { Calendar, Clock, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { Visit, User as StaffUser } from '../../../types';
import 'react-datepicker/dist/react-datepicker.css';

interface TimeSlot {
  time: Date;
  available: boolean;
  conflicts: Visit[];
  staffAvailable: StaffUser[];
}

interface Props {
  selectedDate: Date;
  selectedTime?: string;
  onDateChange?: (date: Date) => void;
  onTimeChange?: (time: string) => void;
  onDateTimeChange?: (date: Date) => void;
  appointments?: Visit[];
  staff?: StaffUser[];
  staffMembers?: StaffUser[];
  existingAppointments?: Visit[];
  workingHours?: { start: number; end: number };
  slotDuration?: number; // in minutes
}

const DateTimePicker: React.FC<Props> = ({
  selectedDate,
  selectedTime = '',
  onDateChange,
  onTimeChange,
  onDateTimeChange,
  appointments,
  staff,
  staffMembers,
  existingAppointments,
  workingHours = { start: 8, end: 18 },
  slotDuration = 30,
}) => {
  const [showTimePicker, setShowTimePicker] = useState(true);

  // Support both prop patterns
  const appointmentsList = existingAppointments || appointments || [];
  const staffList = staffMembers || staff || [];

  // Generate time slots for the selected date
  const timeSlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const startHour = workingHours.start;
    const endHour = workingHours.end;

    let currentTime = setMinutes(setHours(selectedDate, startHour), 0);
    const endTime = setMinutes(setHours(selectedDate, endHour), 0);

    while (isBefore(currentTime, endTime)) {
      // Check for conflicts
      const conflicts = appointmentsList.filter(appt => {
        const apptDate = new Date(appt.date);
        return isSameDay(apptDate, selectedDate) &&
               format(apptDate, 'HH:mm') === format(currentTime, 'HH:mm');
      });

      // Check staff availability (simplified - assumes all staff available unless booked)
      const busyStaffIds = conflicts.map(c => c.tasks.map(t => t.assignedStaffId)).flat();
      const availableStaff = staffList.filter(s => !busyStaffIds.includes(s.id));

      slots.push({
        time: currentTime,
        available: conflicts.length < 3, // Allow up to 3 concurrent appointments
        conflicts,
        staffAvailable: availableStaff,
      });

      currentTime = addMinutes(currentTime, slotDuration);
    }

    return slots;
  }, [selectedDate, appointmentsList, staffList, workingHours, slotDuration]);

  // Get appointments for selected date
  const dayAppointments = useMemo(() => {
    return appointmentsList.filter(appt =>
      isSameDay(new Date(appt.date), selectedDate)
    );
  }, [appointmentsList, selectedDate]);

  const handleDateSelect = (date: Date | null) => {
    if (date) {
      if (onDateChange) {
        onDateChange(date);
      }

      // If using combined callback, also call it with the date
      if (onDateTimeChange) {
        onDateTimeChange(date);
      }

      setShowTimePicker(true);
    }
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    if (slot.available) {
      const timeStr = format(slot.time, 'HH:mm');

      if (onTimeChange) {
        onTimeChange(timeStr);
      }

      // If using combined callback, create a new date with the selected time
      if (onDateTimeChange) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const newDate = setMinutes(setHours(selectedDate, hours), minutes);
        onDateTimeChange(newDate);
      }

      setShowTimePicker(false);
    }
  };

  // Derive effective selected time: explicit prop or from selectedDate
  const effectiveSelectedTime = selectedTime || format(selectedDate, 'HH:mm');

  const getSlotClassName = (slot: TimeSlot) => {
    const isSelected = effectiveSelectedTime === format(slot.time, 'HH:mm');
    
    if (!slot.available) {
      return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 cursor-not-allowed opacity-50';
    }
    
    if (isSelected) {
      return 'bg-seafoam text-white border-seafoam shadow-md';
    }
    
    if (slot.conflicts.length > 0) {
      return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30';
    }
    
    return 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-seafoam';
  };

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <div className="space-y-2">
        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
          <Calendar size={12} />
          Visit Date
        </label>
        <div className="relative w-full">
          <DatePicker
            selected={selectedDate}
            onChange={handleDateSelect}
            minDate={new Date()}
            inline
            calendarClassName="custom-datepicker !w-full"
            dayClassName={(date) => {
              const hasAppointments = appointmentsList.some(appt =>
                isSameDay(new Date(appt.date), date)
              );
              return hasAppointments ? 'has-appointments' : '';
            }}
          />
        </div>
      </div>

      {/* Visit Density Indicator */}
      {dayAppointments.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-blue-600 dark:text-blue-400" />
            <p className="text-[10px] font-black text-blue-900 dark:text-blue-100 uppercase tracking-widest">
              {dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>
          <div className="h-2 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.min((dayAppointments.length / 10) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Time Slot Picker */}
      {showTimePicker && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock size={12} />
              Time Slot
            </label>
            <span className="text-[9px] font-black text-seafoam uppercase tracking-widest flex items-center gap-1">
              <Clock size={10} /> {effectiveSelectedTime}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto custom-scrollbar p-1">
            {timeSlots.map((slot, index) => (
              <button
                key={index}
                onClick={() => handleTimeSelect(slot)}
                disabled={!slot.available}
                className={`
                  relative p-3 rounded-lg border-2 transition-all text-left
                  ${getSlotClassName(slot)}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-black">
                    {format(slot.time, 'HH:mm')}
                  </span>
                  {slot.available ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={14} className="text-red-500" />
                  )}
                </div>

                {slot.conflicts.length > 0 && (
                  <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    {slot.conflicts.length} booked
                  </p>
                )}

                {slot.staffAvailable.length > 0 && slot.available && (
                  <div className="flex items-center gap-1 mt-1">
                    <User size={10} className="text-slate-400" />
                    <p className="text-[8px] text-slate-500 dark:text-zinc-400">
                      {slot.staffAvailable.length} staff
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 pt-2 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800"></div>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800"></div>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Busy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800"></div>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Full</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Date/Time Summary */}
      <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
          Selected Visit Time
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-pine dark:text-zinc-100">
            <Calendar size={16} className="text-seafoam" />
            <span className="font-bold text-sm">
              {format(selectedDate, 'MMM dd, yyyy')}
            </span>
          </div>
          {selectedTime && (
            <>
              <span className="text-slate-300 dark:text-zinc-600">•</span>
              <div className="flex items-center gap-2 text-pine dark:text-zinc-100">
                <Clock size={16} className="text-seafoam" />
                <span className="font-bold text-sm">{selectedTime}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateTimePicker;

