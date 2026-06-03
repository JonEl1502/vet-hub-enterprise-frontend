import React, { useEffect, useMemo } from 'react';
import { Building2, Truck, ChevronDown } from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';
import { useSupplier } from '../../../contexts/SupplierContext';
import { useManagementScope, MANAGE_CLINIC_KEY, MANAGE_SUPPLIER_KEY } from '../../../contexts/ManagementScopeContext';

// "Managing [entity] ▾" — a shared header control for every management page.
// Switches among the entities CURRENTLY SELECTED in the sidebar (locally), and
// scopes management-page requests to the chosen one via a localStorage header
// override the axios interceptor reads — without changing the sidebar selection.
const ManagingSwitcher: React.FC<{ kind: 'clinic' | 'supplier' }> = ({ kind }) => {
  const clinicCtx = useClinic();
  const supplierCtx = useSupplier();
  const { managedClinicId, managedSupplierId, setManagedClinic, setManagedSupplier } = useManagementScope();

  const isClinic = kind === 'clinic';
  const items = useMemo(() => {
    if (isClinic) {
      const list = clinicCtx.selectedClinics?.length ? clinicCtx.selectedClinics : (clinicCtx.clinics ?? []);
      return list.map((c: any) => ({ id: String(c.id), name: c.name }));
    }
    const list = supplierCtx.selectedSuppliers?.length ? supplierCtx.selectedSuppliers : (supplierCtx.suppliers ?? []);
    return list.map((s: any) => ({ id: String(s.id), name: s.name }));
  }, [isClinic, clinicCtx.selectedClinics, clinicCtx.clinics, supplierCtx.selectedSuppliers, supplierCtx.suppliers]);

  const managedId = isClinic ? managedClinicId : managedSupplierId;
  const setManaged = isClinic ? setManagedClinic : setManagedSupplier;
  const key = isClinic ? MANAGE_CLINIC_KEY : MANAGE_SUPPLIER_KEY;
  const itemsKey = items.map((i) => i.id).join(',');

  // Default/validate the managed target, and (re)assert the header override
  // whenever this switcher is mounted (i.e. we're on a management page).
  useEffect(() => {
    const ids = items.map((i) => i.id);
    if (items.length === 0) return;
    if (!managedId || !ids.includes(managedId)) {
      setManaged(items[0].id);
    } else {
      try { localStorage.setItem(key, managedId); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, managedId]);

  // On unmount (leaving management pages) clear ONLY the header override so the
  // rest of the app keeps using the sidebar multi-select. Keep the context
  // choice so hopping between management pages remembers the managed entity.
  useEffect(() => () => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }, [key]);

  if (items.length === 0) return null;

  const Icon = isClinic ? Building2 : Truck;
  const value = managedId && items.some((i) => i.id === managedId) ? managedId : items[0]?.id;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Managing</span>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam pointer-events-none" />
        <select
          value={value}
          onChange={(e) => setManaged(e.target.value)}
          disabled={items.length <= 1}
          className="appearance-none bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-9 py-2 text-sm font-bold text-pine dark:text-zinc-100 max-w-[16rem] sm:max-w-md focus:ring-2 focus:ring-seafoam/20 outline-none cursor-pointer truncate disabled:opacity-100 disabled:cursor-default"
          title={`Switch among your selected ${isClinic ? 'clinics' : 'suppliers'} (doesn't change the sidebar)`}
        >
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
        {items.length > 1 && <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
      </div>
    </div>
  );
};

export default ManagingSwitcher;
