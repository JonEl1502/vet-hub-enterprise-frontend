import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Shield, AlertTriangle, ChevronDown, ChevronRight, Users, Wallet } from 'lucide-react';
import { get } from '../../../services/api/client';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { formatDate } from '../../../services/utils/dateFormatter';

interface ClinicRow {
  clientId: string; clinicId: string; clinicName: string;
  outstanding: number; unpaidBills: number; totalSpent: number;
  lastVisitAt: string | null; clientType: string | null; clientRiskRate: number | null; maxDebt: number | null;
}
interface Identity {
  key: string; name: string; email: string | null; phone: string | null;
  portalLinked: boolean; clinicCount: number; totalOutstanding: number; totalSpent: number;
  flags: { multiClinic: boolean; debtJumper: boolean };
  clinics: ClinicRow[];
}
interface Overview {
  identities: Identity[];
  summary: { withDebt: number; totalOutstanding: number; debtJumpers: number; multiClinic: number };
}

const TYPE_TONE: Record<string, string> = {
  VERY_RISKY: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  RISKY: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  VALUED: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300',
  HIGH_VALUE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  VERY_HIGH_VALUE: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
};

/**
 * "All Protection" — platform-admin radar over client risk built from clinic
 * data (paid/unpaid visits + transactions). One row per pet-owner IDENTITY
 * (portal link or matched email/phone) with per-clinic breakdowns, flagging
 * identities that owe one clinic while actively visiting another.
 */
const AllProtectionView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyJumpers, setOnlyJumpers] = useState(false);
  const [onlyDebt, setOnlyDebt] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    get('/admin/protection', { cache: false })
      .then((res: any) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.identities
      .filter(i => !onlyJumpers || i.flags.debtJumper)
      .filter(i => !onlyDebt || i.totalOutstanding > 0);
  }, [data, onlyJumpers, onlyDebt]);

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20">
      <header className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        {onBack && (
          <button onClick={onBack} className="w-10 h-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam hover:border-seafoam transition-all shrink-0">
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-500 shrink-0"><Shield size={20} /></div>
        <div>
          <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">All Protection</h1>
          <p className="text-[11px] text-slate-400 font-medium">Cross-clinic client risk — unpaid bills, spend, and debt-jumpers moving clinics with debts left behind.</p>
        </div>
      </header>

      {loading ? (
        <div className="py-24"><LoadingSpinner size="lg" message="Scanning client risk..." /></div>
      ) : !data ? (
        <p className="text-sm text-slate-400 text-center py-16">Could not load protection data.</p>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Owners with debt', value: data.summary.withDebt, icon: Users, tone: 'text-amber-500' },
              { label: 'Total outstanding', value: `KES ${data.summary.totalOutstanding.toLocaleString()}`, icon: Wallet, tone: 'text-rose-500' },
              { label: 'Debt-jumpers', value: data.summary.debtJumpers, icon: AlertTriangle, tone: 'text-rose-600' },
              { label: 'Multi-clinic owners', value: data.summary.multiClinic, icon: Users, tone: 'text-seafoam' },
            ].map(t => (
              <div key={t.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <t.icon size={16} className={`${t.tone} mb-2`} />
                <p className="text-xl font-black text-pine dark:text-zinc-100">{t.value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setOnlyDebt(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${onlyDebt ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
              With outstanding balance
            </button>
            <button onClick={() => setOnlyJumpers(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${onlyJumpers ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
              Debt-jumpers only
            </button>
            <span className="text-[10px] font-bold text-slate-400 ml-auto">{rows.length} shown</span>
          </div>

          {/* Identities */}
          <div className="space-y-2">
            {rows.length === 0 ? (
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600 py-12 text-center">Nothing matches — all clear 🎉</p>
            ) : rows.map(i => (
              <div key={i.key} className={`bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm overflow-hidden ${i.flags.debtJumper ? 'border-rose-300 dark:border-rose-900/60' : 'border-slate-200 dark:border-zinc-800'}`}>
                <button onClick={() => setOpenKey(openKey === i.key ? null : i.key)} className="w-full flex items-center gap-3 p-4 text-left">
                  {openKey === i.key ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-pine dark:text-zinc-100 truncate">
                      {i.name || i.email || i.phone}
                      {i.flags.debtJumper && <span className="ml-2 px-2 py-0.5 rounded-md bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest">Debt-jumper</span>}
                      {i.portalLinked && <span className="ml-2 px-2 py-0.5 rounded-md bg-seafoam/10 text-seafoam text-[8px] font-black uppercase tracking-widest">Portal</span>}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{[i.email, i.phone].filter(Boolean).join(' · ')} · {i.clinicCount} clinic{i.clinicCount === 1 ? '' : 's'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${i.totalOutstanding > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>KES {i.totalOutstanding.toLocaleString()}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">owed · spent KES {i.totalSpent.toLocaleString()}</p>
                  </div>
                </button>
                {openKey === i.key && (
                  <div className="border-t border-slate-100 dark:border-zinc-800 divide-y divide-slate-50 dark:divide-zinc-800/60">
                    {i.clinics.map(c => (
                      <div key={c.clientId} className="flex flex-wrap items-center gap-3 px-4 py-3 pl-11">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.clinicName}</p>
                          <p className="text-[10px] text-slate-400">
                            last visit {c.lastVisitAt ? formatDate(c.lastVisitAt) : '—'} · spent KES {c.totalSpent.toLocaleString()}
                            {c.maxDebt != null ? ` · max debt KES ${Number(c.maxDebt).toLocaleString()}` : ''}
                            {c.clientRiskRate != null ? ` · risk ${c.clientRiskRate}/100` : ''}
                          </p>
                        </div>
                        {c.clientType && (
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${TYPE_TONE[c.clientType] || TYPE_TONE.VALUED}`}>
                            {c.clientType.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className={`text-xs font-black shrink-0 ${c.outstanding > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {c.outstanding > 0 ? `owes KES ${c.outstanding.toLocaleString()} (${c.unpaidBills})` : 'clear'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AllProtectionView;
