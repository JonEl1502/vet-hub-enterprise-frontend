/** Crop plots — planted areas and their harvest windows. */
import React, { useCallback, useEffect, useState } from 'react';
import { Wheat, Pencil, Trash2, CalendarClock } from 'lucide-react';
import { livestockAPI, type CropPlot, type Farm } from '../../services/modules/livestock.api';
import { toast, dialog } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, PrimaryButton, EmptyState, Modal, Field, Card, FarmFilter, fmtDate, dateInput } from './shared';

const blank = { farmId: '', name: '', crop: '', sizeAcres: '' as string | number, plantedOn: '', expectedHarvestOn: '', notes: '' };

const CropPlotsView: React.FC = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plots, setPlots] = useState<CropPlot[]>([]);
  const [farmId, setFarmId] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(typeof blank & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    livestockAPI.listFarms().then((r) => { if (r.success && r.data?.farms) setFarms(r.data.farms); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await livestockAPI.listCropPlots(farmId || undefined);
      if (res.success && res.data?.plots) setPlots(res.data.plots);
    } finally { setLoading(false); }
  }, [farmId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setEditing({ ...blank, farmId: farmId || farms[0]?.id || '' });
  const openEdit = (p: CropPlot) => setEditing({
    id: p.id, farmId: p.farmId, name: p.name, crop: p.crop, sizeAcres: p.sizeAcres ?? '',
    plantedOn: dateInput(p.plantedOn), expectedHarvestOn: dateInput(p.expectedHarvestOn), notes: p.notes ?? '',
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.crop.trim()) { toast.error('Name and crop are required'); return; }
    if (!editing.farmId) { toast.error('Choose a farm'); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: editing.name.trim(), crop: editing.crop.trim(),
        sizeAcres: editing.sizeAcres === '' ? null : Number(editing.sizeAcres),
        plantedOn: editing.plantedOn || null,
        expectedHarvestOn: editing.expectedHarvestOn || null,
        notes: editing.notes || null,
      };
      const res = editing.id
        ? await livestockAPI.updateCropPlot(editing.id, payload)
        : await livestockAPI.createCropPlot({ ...payload, farmId: editing.farmId });
      if (res.success && res.data?.plot) {
        setPlots((prev) => editing.id
          ? prev.map((p) => (p.id === editing.id ? res.data!.plot : p))
          : [res.data!.plot, ...prev]);
        toast.success(editing.id ? 'Updated' : 'Plot added');
        setEditing(null);
      }
    } finally { setSaving(false); }
  };

  const remove = async (p: CropPlot) => {
    const ok = await dialog.confirmDelete({ title: 'Archive plot', message: 'History is kept.', entityName: p.name });
    if (!ok) return;
    const res = await livestockAPI.deleteCropPlot(p.id);
    if (res.success) { setPlots((prev) => prev.filter((x) => x.id !== p.id)); toast.success('Archived'); }
  };

  const harvestSoon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 14;
  };

  return (
    <LivestockPage
      title="Crop Plots"
      subtitle="Planted areas and harvest windows"
      icon={Wheat}
      actions={<PrimaryButton onClick={openNew} disabled={farms.length === 0}>Add plot</PrimaryButton>}
    >
      <FarmFilter farms={farms} value={farmId} onChange={setFarmId} />

      {loading ? (
        <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" message="Loading..." /></div>
      ) : plots.length === 0 ? (
        <EmptyState icon={Wheat} title="No crop plots yet"
          hint={farms.length === 0 ? 'Register a farm first.' : 'Add a plot to track planting and harvest.'} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plots.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">{p.farmName}</p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  {p.crop}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                <p>Planted · {fmtDate(p.plantedOn)}</p>
                <p className={harvestSoon(p.expectedHarvestOn) ? 'text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1' : ''}>
                  {harvestSoon(p.expectedHarvestOn) && <CalendarClock size={11} />}
                  Harvest · {fmtDate(p.expectedHarvestOn)}
                </p>
                {p.sizeAcres != null && <p>{p.sizeAcres} acres</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-1">
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-seafoam"><Pencil size={13} /></button>
                <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit plot' : 'Add crop plot'} onClose={() => setEditing(null)} onSave={save} saving={saving}>
          {!editing.id && (
            <Field label="Farm">
              <select className="field-select" value={editing.farmId} onChange={(e) => setEditing({ ...editing, farmId: e.target.value })}>
                <option value="">Select a farm…</option>
                {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plot name">
              <input className="field-input" value={editing.name} placeholder="e.g. North field"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Crop">
              <input className="field-input" value={editing.crop} placeholder="e.g. Maize"
                onChange={(e) => setEditing({ ...editing, crop: e.target.value })} />
            </Field>
          </div>
          <Field label="Size (acres)">
            <input className="field-input" type="number" min="0" step="0.1" value={editing.sizeAcres}
              onChange={(e) => setEditing({ ...editing, sizeAcres: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Planted on">
              <input className="field-input" type="date" value={editing.plantedOn}
                onChange={(e) => setEditing({ ...editing, plantedOn: e.target.value })} />
            </Field>
            <Field label="Expected harvest">
              <input className="field-input" type="date" value={editing.expectedHarvestOn}
                onChange={(e) => setEditing({ ...editing, expectedHarvestOn: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="field-textarea" rows={2} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
        </Modal>
      )}
    </LivestockPage>
  );
};

export default CropPlotsView;
