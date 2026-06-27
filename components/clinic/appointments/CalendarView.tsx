import React, { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Visit, Pet, ApptStatus } from '../../../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Props {
  appointments: Visit[];
  pets: Pet[];
  onSelectAppointment: (id: number) => void;
  onReschedule?: (appointmentId: number, newDate: Date) => void;
  onNavigateToList: () => void;
}

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 640;

const CalendarView: React.FC<Props> = ({
  appointments,
  pets,
  onSelectAppointment,
  onReschedule,
  onNavigateToList,
}) => {
  const [view, setView] = useState<View>(() => isMobile() ? 'agenda' : 'day');
  const [date, setDate] = useState(new Date());

  // Transform appointments into calendar events
  const events = useMemo(() => {
    return appointments.map(appt => {
      const pet = pets.find(p => p.id === appt.petId);
      const appointmentDate = new Date(appt.date);

      return {
        id: appt.id,
        title: pet ? `${pet.name} - ${appt.tasks[0]?.category || 'Visit'}` : 'Unknown Pet',
        start: appointmentDate,
        end: new Date(appointmentDate.getTime() + 60 * 60 * 1000), // 1 hour default
        resource: appt,
      };
    });
  }, [appointments, pets]);

  // Custom event styling based on appointment status
  const eventStyleGetter = (event: any) => {
    const appt = event.resource as Visit;
    let backgroundColor = '#10b981'; // default green
    let borderColor = '#059669';

    switch (appt.status) {
      case ApptStatus.SCHEDULED:
        backgroundColor = '#3b82f6';
        borderColor = '#2563eb';
        break;
      case ApptStatus.IN_PROGRESS:
        backgroundColor = '#f59e0b';
        borderColor = '#d97706';
        break;
      case ApptStatus.COMPLETED:
        backgroundColor = '#10b981';
        borderColor = '#059669';
        break;
      case ApptStatus.CANCELLED:
        backgroundColor = '#ef4444';
        borderColor = '#dc2626';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: '6px',
        opacity: appt.status === ApptStatus.CANCELLED ? 0.6 : 1,
        color: 'white',
        fontSize: '0.72rem',
        fontWeight: '500',
        padding: '2px 6px',
      },
    };
  };

  const handleSelectEvent = (event: any) => {
    onSelectAppointment(event.id);
  };

  const handleEventDrop = ({ event, start }: any) => {
    if (onReschedule) {
      onReschedule(event.id, start);
    }
  };

  const handleNavigate = (newDate: Date) => {
    setDate(newDate);
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm text-seafoam shrink-0">
              <CalendarIcon size={16} className="sm:hidden" />
              <CalendarIcon size={20} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-pine dark:text-zinc-100 uppercase leading-none truncate">
                Calendar View
              </h2>
              <p className="text-seafoam dark:text-zinc-500 font-bold text-[9px] uppercase tracking-widest mt-0.5 sm:mt-1">
                {format(date, 'MMMM yyyy')}
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToList}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all text-xs sm:text-sm font-bold shrink-0"
          >
            <List size={14} className="sm:hidden" />
            <List size={16} className="hidden sm:block" />
            <span className="hidden sm:inline">List View</span>
            <span className="sm:hidden">List</span>
          </button>
        </div>

        {/* View switcher — visible on mobile */}
        <div className="flex gap-1.5 mt-2 sm:hidden">
          {(['agenda', 'day', 'week', 'month'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${view === v
                ? 'bg-seafoam text-white'
                : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-500'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div
        className="p-1.5 sm:p-6 calendar-container"
        style={{ height: view === 'month' ? 800 : undefined, flex: view === 'month' ? 'none' : '1 1 0', minHeight: view === 'month' ? undefined : 800 }}
      >
        <style>{`
          .custom-calendar .rbc-time-gutter .rbc-label,
          .custom-calendar .rbc-header,
          .custom-calendar .rbc-date-cell,
          .custom-calendar .rbc-today,
          .custom-calendar .rbc-off-range-bg,
          .custom-calendar .rbc-now { font-weight: 500; }
          .custom-calendar .rbc-event-label { font-weight: 400; font-size: 0.7rem; }
          .custom-calendar .rbc-event-content { font-weight: 500; font-size: 0.72rem; }
        `}</style>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          date={date}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          eventPropGetter={eventStyleGetter}
          style={{ height: view === 'month' ? '100%' : '100%' }}
          views={['month', 'week', 'day', 'agenda']}
          min={new Date(1970, 0, 1, 6, 0, 0)}
          max={new Date(1970, 0, 1, 20, 0, 0)}
          draggableAccessor={() => true}
          resizable
          popup
          className="custom-calendar"
        />
      </div>

      {/* Legend */}
      <div className="px-3 py-3 sm:px-6 sm:py-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status:</p>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-blue-500"></div>
            <span className="text-[10px] sm:text-xs text-slate-600 dark:text-zinc-400 font-medium">Scheduled</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-amber-500"></div>
            <span className="text-[10px] sm:text-xs text-slate-600 dark:text-zinc-400 font-medium">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-500"></div>
            <span className="text-[10px] sm:text-xs text-slate-600 dark:text-zinc-400 font-medium">Completed</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-red-500 opacity-60"></div>
            <span className="text-[10px] sm:text-xs text-slate-600 dark:text-zinc-400 font-medium">Cancelled</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
