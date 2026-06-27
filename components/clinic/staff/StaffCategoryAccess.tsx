import React, { useEffect, useState } from 'react';
import { Layers, Loader2, Save, Lock } from 'lucide-react';
import { staffScopeAPI, toast } from '../../../services';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';

/**
 * Epic C — assign a staff member to clinical categories and optionally restrict
 * them to only those module surfaces (category-scoped navigation). Operates on
 * the active clinic (scope is per UserClinic). Self-contained so it can drop into
 * the staff profile without touching its permission UI.
 */
const StaffCategoryAccess: React.FC<{ userId: string | number }> = ({ userId }) => {
  const { categories } = useReferenceData();
  const [scoped, setScoped] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    staffScopeAPI.get(userId)
      .then(res => { if (alive && res.success && res.data) { setScoped(res.data.scopedToCategories); setSelected(new Set(res.data.categoryIds)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  const toggle = (id: number) => setSelected(prev => {
    const n = new Set(prev); const k = String(id);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await staffScopeAPI.set(userId, [...selected], scoped);
      if (res.success) toast.success('Category access updated');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={16} className="text-seafoam" />
        <h3 className="text-sm font-black uppercase tracking-widest text-pine dark:text-zinc-100">Category access</h3>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-zinc-500 mb-4">Assign the categories this staff member handles. Optionally restrict their navigation to only those module pages.</p>

      {loading ? <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-seafoam" /></div> : (
        <>
          <label className="flex items-center justify-between gap-3 p-3 mb-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/30">
            <span className="flex items-center gap-2">
              <Lock size={14} className={scoped ? 'text-seafoam' : 'text-slate-400'} />
              <span>
                <span className="block text-sm font-bold text-pine dark:text-zinc-100">Restrict to assigned categories</span>
                <span className="block text-[11px] text-slate-400">When on, they only see those module pages (+ clients, patients, visits, reminders, appointments).</span>
              </span>
            </span>
            <button type="button" onClick={() => setScoped(s => !s)} className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${scoped ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-700'}`}>
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${scoped ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <div className="flex flex-wrap gap-2 mb-4">
            {categories.length === 0 ? <p className="text-[11px] text-slate-400">No categories defined for this clinic yet.</p> :
              categories.map(c => {
                const on = selected.has(String(c.id));
                return <button key={c.id} type="button" onClick={() => toggle(c.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-seafoam'}`}>{c.name}</button>;
              })}
          </div>

          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save access
          </button>
        </>
      )}
    </div>
  );
};

export default StaffCategoryAccess;
