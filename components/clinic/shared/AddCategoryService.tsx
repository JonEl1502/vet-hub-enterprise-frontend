import React, { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { visitsAPI, servicesAPI } from '../../../services';
import { toast } from '../../../services/utils/toast';

// Category-scoped "add service" for module pages (grooming report card,
// surgery record …): pick a catalog service of ONE category and add it as a
// task on the linked visit — the category trigger then auto-creates the
// module record, so the new service/procedure appears on the page. Mirrors
// the boarding-stay page's grooming picker, incl. the one-instance-per-
// service guard.
interface Props {
  appointmentId: string | number;
  // Catalog filter — substring of the category name (e.g. 'groom', 'surg').
  categoryKeyword: string;
  // Category stamped on the created task (drives the module trigger).
  taskCategory: string;
  // Names already on the visit for this category — duplicate guard + "Added" tags.
  existingNames: string[];
  label: string;
  tone?: 'pink' | 'rose';
  onAdded: () => void | Promise<void>;
}

const TONES = {
  pink: {
    btn: 'border-pink-300 dark:border-pink-900/50 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 hover:bg-pink-100',
    panel: 'border-pink-200 dark:border-pink-900/40 bg-pink-50/50 dark:bg-pink-950/20',
    title: 'text-pink-600',
    chip: 'border-pink-200 dark:border-pink-900/40 hover:border-pink-400',
    price: 'text-pink-500',
    custom: 'border-pink-300 dark:border-pink-900/50 text-pink-600 hover:bg-pink-100 dark:hover:bg-pink-950/40',
  },
  rose: {
    btn: 'border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100',
    panel: 'border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20',
    title: 'text-rose-600',
    chip: 'border-rose-200 dark:border-rose-900/40 hover:border-rose-400',
    price: 'text-rose-500',
    custom: 'border-rose-300 dark:border-rose-900/50 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40',
  },
};

const AddCategoryService: React.FC<Props> = ({ appointmentId, categoryKeyword, taskCategory, existingNames, label, tone = 'pink', onAdded }) => {
  const t = TONES[tone];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState<{ id: string; name: string; defaultPrice?: number }[]>([]);
  useEffect(() => {
    if (open && services.length === 0) {
      servicesAPI.catalog()
        .then(list => setServices((list || [])
          .filter((s: any) => String(s.categoryName || '').toLowerCase().includes(categoryKeyword))
          .map((s: any) => ({ id: String(s.id), name: s.name, defaultPrice: (s.priceEffective ?? s.defaultPrice) ?? undefined }))))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const added = (name: string) => existingNames.some(n => n.trim().toLowerCase() === name.trim().toLowerCase());

  const add = async (svc?: { id?: string; name: string; defaultPrice?: number }) => {
    const name = svc?.name || `${taskCategory} service`;
    if (added(name)) { toast.error(`"${name}" is already on this visit`); return; }
    setBusy(true);
    try {
      // serviceId lets the backend auto-apply a procedure recipe whose trigger
      // service matches this catalog service (and keeps the catalog FK).
      await visitsAPI.addTask(Number(appointmentId), { name, category: taskCategory, status: 'PENDING' as any, price: Number(svc?.defaultPrice ?? 0), serviceId: svc?.id } as any);
      toast.success(`Added "${name}" to this visit`);
      await onAdded();
    } catch (e: any) { toast.error(e?.message || 'Failed to add service'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(v => !v)} disabled={busy}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${t.btn}`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {label}
      </button>
      {open && (
        <div className={`rounded-xl border p-3 space-y-2 ${t.panel}`}>
          <p className={`text-[9px] font-black uppercase tracking-widest ${t.title}`}>Select {taskCategory.toLowerCase()} services</p>
          <div className="flex flex-wrap gap-1.5">
            {services.map(s => added(s.name) ? (
              <span key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {s.name} · Added
              </span>
            ) : (
              <button key={s.id} onClick={() => add(s)} disabled={busy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border text-[10px] font-bold text-pine dark:text-zinc-100 transition-all disabled:opacity-50 ${t.chip}`}>
                {s.name}{s.defaultPrice ? <span className={`font-mono ${t.price}`}>· {s.defaultPrice.toLocaleString()}</span> : null}
              </button>
            ))}
            {services.length === 0 && <span className="text-[10px] text-slate-400">No {taskCategory.toLowerCase()} services in your catalog yet.</span>}
            <button onClick={() => add()} disabled={busy}
              className={`px-3 py-1.5 rounded-lg border border-dashed text-[10px] font-bold transition-all disabled:opacity-50 ${t.custom}`}>+ Custom</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCategoryService;
