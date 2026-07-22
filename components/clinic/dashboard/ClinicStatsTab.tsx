import React, { useEffect, useMemo, useState } from 'react';
import { Users, Dog, BriefcaseMedical, CalendarClock, Stethoscope, Home } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import { useData } from '../../../contexts/DataContext';
import { useStaff } from '../../../contexts/StaffContext';
import { boardingAPI, inpatientAPI } from '../../../services';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';

/**
 * Clinic → Stats (first tab): the operational headline numbers — clients
 * (+ new in the filtered window), pets, staff, visits, inpatient & boarding
 * occupancy — with the same chart language as the supplier dashboard
 * (area trend · status pie · horizontal top-N bar).
 */

const ENCOUNTER_COLORS: Record<string, string> = {
  'VET VISIT': '#0d9488',
  VACCINATION: '#f59e0b',
  GROOMING: '#ec4899',
  BOARDING: '#6366f1',
  EMERGENCY: '#ef4444',
  OTHER: '#94a3b8',
};

const ClinicStatsTab: React.FC = () => {
  const { clients, pets, appointments } = useData() as any;
  const { staff } = useStaff() as any;
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [stays, setStays] = useState<any[]>([]);
  const [hospitalizations, setHospitalizations] = useState<any[]>([]);

  useEffect(() => {
    boardingAPI.list('all').then(r => { if (r.success && r.data?.stays) setStays(r.data.stays); }).catch(() => {});
    inpatientAPI.list('all').then(r => { if (r.success && r.data?.hospitalizations) setHospitalizations(r.data.hospitalizations); }).catch(() => {});
  }, []);

  const inRange = (iso: string | Date | null | undefined) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (dateRange?.start && d < new Date(dateRange.start)) return false;
    if (dateRange?.end) { const e = new Date(dateRange.end); e.setHours(23, 59, 59, 999); if (d > e) return false; }
    return true;
  };

  const stats = useMemo(() => {
    const visitsInRange = (appointments || []).filter((a: any) => a.status !== 'CANCELLED' && (dateRange ? inRange(a.date) : true));
    const newClients = (clients || []).filter((c: any) => inRange(c.createdAt || c.registeredAt)).length;
    const ACTIVE_STAY = new Set(['ACTIVE', 'CHECKED_IN']);
    const ACTIVE_HOSP = new Set(['ADMITTED', 'ACTIVE', 'IN_TREATMENT']);
    return {
      clients: (clients || []).length,
      newClients: dateRange ? newClients : null,
      pets: (pets || []).length,
      staff: (staff || []).length,
      visits: visitsInRange.length,
      boardingNow: stays.filter((s: any) => ACTIVE_STAY.has(String(s.status || '').toUpperCase())).length,
      boardingInRange: dateRange ? stays.filter((s: any) => inRange(s.checkInAt || s.createdAt)).length : stays.length,
      inpatientNow: hospitalizations.filter((h: any) => ACTIVE_HOSP.has(String(h.status || '').toUpperCase())).length,
      inpatientInRange: dateRange ? hospitalizations.filter((h: any) => inRange(h.admittedAt || h.createdAt)).length : hospitalizations.length,
    };
  }, [clients, pets, staff, appointments, stays, hospitalizations, dateRange]);

  // Area: visits per month, last 6 months (date filter ignored — it's a trend).
  const visitsByMonth = useMemo(() => {
    const months: { month: string; visits: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.toLocaleDateString(undefined, { month: 'short' }), visits: 0 });
    }
    const startWindow = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    for (const a of appointments || []) {
      if (a.status === 'CANCELLED') continue;
      const d = new Date(a.date);
      if (d < startWindow || d > now) continue;
      const idx = (d.getFullYear() - startWindow.getFullYear()) * 12 + d.getMonth() - startWindow.getMonth();
      if (months[idx]) months[idx].visits += 1;
    }
    return months;
  }, [appointments]);

  // Pie: visits by encounter type (respects the date filter).
  const visitsByEncounter = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of appointments || []) {
      if (a.status === 'CANCELLED' || (dateRange && !inRange(a.date))) continue;
      const key = a.visitType === 'EMERGENCY' ? 'EMERGENCY'
        : a.visitType === 'VACCINATION' ? 'VACCINATION'
        : String(a.encounterType || 'VET_VISIT').replace('_', ' ');
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: ENCOUNTER_COLORS[name] ?? ENCOUNTER_COLORS.OTHER }));
  }, [appointments, dateRange]);

  // Horizontal bar: top service categories by line count (respects date filter).
  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of appointments || []) {
      if (a.status === 'CANCELLED' || (dateRange && !inRange(a.date))) continue;
      for (const t of a.tasks || []) {
        const cat = t.category || 'Other';
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name: name.length > 18 ? `${name.slice(0, 17)}…` : name, count }));
  }, [appointments, dateRange]);

  const tiles: Array<{ icon: React.ElementType; label: string; value: number; sub?: string | null; tone: string }> = [
    { icon: Users, label: 'Clients', value: stats.clients, sub: stats.newClients != null ? `+${stats.newClients} new in range` : null, tone: 'text-seafoam' },
    { icon: Dog, label: 'Patients', value: stats.pets, tone: 'text-amber-500' },
    { icon: BriefcaseMedical, label: 'Staff', value: stats.staff, tone: 'text-indigo-500' },
    { icon: CalendarClock, label: dateRange ? 'Visits in range' : 'Visits (all time)', value: stats.visits, tone: 'text-emerald-500' },
    { icon: Stethoscope, label: 'Inpatient', value: stats.inpatientNow, sub: `${stats.inpatientInRange} ${dateRange ? 'admitted in range' : 'all time'}`, tone: 'text-rose-500' },
    { icon: Home, label: 'Boarding', value: stats.boardingNow, sub: `${stats.boardingInRange} ${dateRange ? 'checked in, in range' : 'all time'}`, tone: 'text-sky-500' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinic at a glance{dateRange ? ' · filtered' : ''}</p>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <t.icon size={16} className={t.tone} />
            <p className="text-2xl font-black text-pine dark:text-zinc-100 mt-2">{t.value.toLocaleString()}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{t.label}</p>
            {t.sub && <p className="text-[9px] font-bold text-seafoam mt-0.5">{t.sub}</p>}
          </div>
        ))}
      </div>

      {/* Visits trend — same area-chart language as the supplier dashboard */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Visits — Last 6 Months</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={visitsByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="visitsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={35} />
            <Tooltip formatter={(v: any) => [v, 'Visits']} contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }} />
            <Area type="monotone" dataKey="visits" stroke="#0d9488" strokeWidth={2.5} fill="url(#visitsGrad)" dot={{ r: 3, fill: '#0d9488' }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visits by encounter — pie */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Visits by Encounter</h2>
          {visitsByEncounter.length === 0 ? (
            <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No visit data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={visitsByEncounter} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {visitsByEncounter.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Tooltip formatter={(v: any, name) => [v, name]} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top service categories — horizontal bar */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Top Service Categories</h2>
          {topCategories.length === 0 ? (
            <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No service data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip formatter={(v: any) => [v, 'Services']} contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" fill="#0d9488" radius={[0, 8, 8, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicStatsTab;
