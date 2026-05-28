import React, { useEffect, useState } from 'react';
import {
  Users, Plus, RefreshCw, Copy, Trash2, Edit3, Save, X, CheckCircle2,
} from 'lucide-react';
import { salesRepAPI, type SalesRep } from '../../../services/modules/salesRep.api';
import { toast } from '../../../services';

const SalesRepsAdminPage: React.FC = () => {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await salesRepAPI.list();
      if (res.success && res.data?.reps) setReps(res.data.reps);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success(`Code ${code} copied`);
  };

  const copyLink = (code: string) => {
    const base = window.location.origin;
    const url = `${base}/signup?ref=${code}`;
    navigator.clipboard?.writeText(url);
    toast.success('Referral link copied');
  };

  const revoke = async (rep: SalesRep) => {
    if (!confirm(`Revoke ${rep.name}'s referral code (${rep.referralCode})? They'll stop attributing new signups but historical attribution stays.`)) return;
    const res = await salesRepAPI.revoke(rep.id);
    if (res.success) {
      toast.success(`${rep.name} revoked`);
      refresh();
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase flex items-center gap-3">
            <Users className="text-seafoam" size={32}/> Sales Reps
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            VetHub Core employees who bring in clinics · live attribution stats
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800">
            {loading ? <RefreshCw size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Refresh
          </button>
          <button onClick={() => setShowEnroll(true)} className="h-10 px-4 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95">
            <Plus size={12}/> Enroll Rep
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Rep</th>
                <th className="text-left px-4 py-2 font-semibold">Code</th>
                <th className="text-right px-4 py-2 font-semibold">Brought</th>
                <th className="text-right px-4 py-2 font-semibold">Paid</th>
                <th className="text-right px-4 py-2 font-semibold">Active</th>
                <th className="text-right px-4 py-2 font-semibold">USD Attributed</th>
                <th className="text-right px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {reps.length ? reps.map((r) => (
                <RepRow key={r.id} rep={r} onCopyCode={copyCode} onCopyLink={copyLink} onRevoke={revoke} onChange={refresh}/>
              )) : (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">
                  {loading ? 'Loading…' : 'No sales reps enrolled yet. Click "Enroll Rep" to get started.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEnroll && <EnrollModal onClose={() => setShowEnroll(false)} onSaved={refresh}/>}
    </div>
  );
};

const RepRow: React.FC<{
  rep: SalesRep;
  onCopyCode: (code: string) => void;
  onCopyLink: (code: string) => void;
  onRevoke: (r: SalesRep) => void;
  onChange: () => void;
}> = ({ rep, onCopyCode, onCopyLink, onRevoke, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rep.referralCode);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft || draft === rep.referralCode) { setEditing(false); return; }
    setSaving(true);
    const res = await salesRepAPI.updateCode(rep.id, draft);
    setSaving(false);
    if (res.success) {
      toast.success('Code updated');
      setEditing(false);
      onChange();
    }
  };

  return (
    <tr className="text-slate-700 dark:text-zinc-300">
      <td className="px-4 py-3">
        <p className="font-medium text-pine dark:text-zinc-100">{rep.name}</p>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500">{rep.email}</p>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <input value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} className="font-mono px-2 py-1 rounded-md bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs w-32" autoFocus/>
            <button onClick={save} disabled={saving} className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200"><Save size={10}/></button>
            <button onClick={() => { setEditing(false); setDraft(rep.referralCode); }} className="p-1.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500"><X size={10}/></button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-xs">{rep.referralCode}</span>
            <button onClick={() => onCopyCode(rep.referralCode)} className="p-1 text-slate-400 hover:text-pine" title="Copy code"><Copy size={10}/></button>
            <button onClick={() => onCopyLink(rep.referralCode)} className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300 hover:underline" title="Copy signup link">link</button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono">{rep.stats.clinicsBrought}</td>
      <td className="px-4 py-3 text-right font-mono">{rep.stats.clinicsWithPaidSub}</td>
      <td className="px-4 py-3 text-right font-mono">{rep.stats.activeSubs}</td>
      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">${rep.stats.totalUsdAttributed.toFixed(2)}</td>
      <td className="px-4 py-3 text-right">
        {!editing && (
          <div className="inline-flex gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-pine" title="Edit code"><Edit3 size={12}/></button>
            <button onClick={() => onRevoke(rep)} className="p-1.5 text-rose-400 hover:text-rose-600" title="Revoke"><Trash2 size={12}/></button>
          </div>
        )}
      </td>
    </tr>
  );
};

const EnrollModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setSaving(true);
    const res = await salesRepAPI.enroll(email.trim(), code.trim() || undefined);
    setSaving(false);
    if (res.success) {
      toast.success('Sales rep enrolled');
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Enroll a sales rep</h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            The user must already exist (have them sign up first). We'll mint a referral code unless you supply one.
          </p>
        </div>
        <Field label="User email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rep@vethubcore.com" className={modalInput} autoFocus/>
        </Field>
        <Field label="Referral code (optional)">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="auto-generated if blank" className={`${modalInput} font-mono`}/>
        </Field>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={submit} disabled={saving || !email.trim()} className="flex-1 py-2.5 rounded-xl bg-pine text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 active:scale-95">
            {saving ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    {children}
  </div>
);

const modalInput = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30';

export default SalesRepsAdminPage;
