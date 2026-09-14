/**
 * Herds & flocks. Livestock is managed by GROUP, not per animal — a dairy herd
 * of 40 is one row with a head count, not 40 patient records.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Milk, Pencil, Trash2 } from 'lucide-react';
import { livestockAPI, type AnimalGroup, type Farm } from '../../services/modules/livestock.api';
import { toast, dialog } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, PrimaryButton, EmptyState, Modal, Field, Card, FarmFilter, SPECIES, PickOrType , FilterBar} from './shared';
/**
 * ⚠️ ONE source of species knowledge, shared with the client portal. The breeds,
 * housing and purposes a Kenyan farm actually uses were already researched per
 * species for the portal's animal register; duplicating them here would let the
 * two drift and mean "layers" stopped meaning the same thing on both sides.
 */
import { speciesConfig, purposeLabel } from '../client/views/farmSpecies';

const blank = { farmId: '', name: '', species: 'CATTLE', breed: '', headCount: 0, purpose: '', housing: '', notes: '' };

const AnimalGroupsView: React.FC = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [groups, setGroups] = useState<AnimalGroup[]>([]);
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
      const res = await livestockAPI.listAnimalGroups(farmId || undefined);
      if (res.success && res.data?.groups) setGroups(res.data.groups);
    } finally { setLoading(false); }
  }, [farmId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setEditing({ ...blank, farmId: farmId || farms[0]?.id || '' });
  const openEdit = (g: AnimalGroup) => setEditing({
    id: g.id, farmId: g.farmId, name: g.name, species: g.species, breed: g.breed ?? '',
    headCount: g.headCount, purpose: g.purpose ?? '', housing: g.housing ?? '', notes: g.notes ?? '',
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Name is required'); return; }
    if (!editing.farmId) { toast.error('Choose a farm'); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: editing.name.trim(), species: editing.species, breed: editing.breed || null,
        headCount: Number(editing.headCount ?? 0), purpose: editing.purpose || null,
        housing: editing.housing || null, notes: editing.notes || null,
      };
      const res = editing.id
        ? await livestockAPI.updateAnimalGroup(editing.id, payload)
        : await livestockAPI.createAnimalGroup({ ...payload, farmId: editing.farmId });
      if (res.success && res.data?.group) {
        setGroups((prev) => editing.id
          ? prev.map((g) => (g.id === editing.id ? res.data!.group : g))
          : [res.data!.group, ...prev]);
        toast.success(editing.id ? 'Updated' : 'Herd/flock added');
        setEditing(null);
      }
    } finally { setSaving(false); }
  };

  const remove = async (g: AnimalGroup) => {
    const ok = await dialog.confirmDelete({ title: 'Archive herd/flock', message: 'History is kept.', entityName: g.name });
    if (!ok) return;
    const res = await livestockAPI.deleteAnimalGroup(g.id);
    if (res.success) { setGroups((prev) => prev.filter((x) => x.id !== g.id)); toast.success('Archived'); }
  };

  return (
    <LivestockPage
      title="Herds & Flocks"
      subtitle="Livestock grouped by species and purpose"
      icon={Milk}
      actions={<PrimaryButton onClick={openNew} disabled={farms.length === 0}>Add group</PrimaryButton>}
    >
      <FilterBar>
        <FarmFilter farms={farms} value={farmId} onChange={setFarmId} />
      </FilterBar>

      {loading ? (
        <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" message="Loading..." /></div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Milk}
          title="No herds or flocks yet"
          hint={farms.length === 0 ? 'Register a farm first.' : 'Add a group to track head count, feeding and produce.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{g.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">{g.farmName}</p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  {g.species}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{g.headCount}</span>
                <span className="text-[11px] text-slate-400 uppercase tracking-widest">head</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500 dark:text-zinc-400">
                {g.breed && <span>{g.breed}</span>}
                {g.purpose && <span>· {g.purpose}</span>}
                {g.housing && <span>· {g.housing}</span>}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-1">
                <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-seafoam"><Pencil size={13} /></button>
                <button onClick={() => remove(g)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit herd/flock' : 'Add herd/flock'} onClose={() => setEditing(null)} onSave={save} saving={saving}>
          {!editing.id && (
            <Field label="Farm">
              <select className="field-select" value={editing.farmId} onChange={(e) => setEditing({ ...editing, farmId: e.target.value })}>
                <option value="">Select a farm…</option>
                {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Name">
            <input className="field-input" value={editing.name} placeholder="e.g. Main dairy herd"
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Species">
              <select className="field-select" value={editing.species} onChange={(e) => setEditing({ ...editing, species: e.target.value })}>
                {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Head count">
              <input className="field-input" type="number" min="0" value={editing.headCount}
                onChange={(e) => setEditing({ ...editing, headCount: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Breed">
              <PickOrType
                options={speciesConfig(editing.species).breeds}
                value={editing.breed}
                onChange={(v) => setEditing({ ...editing, breed: v })}
                placeholder="Type the breed"
              />
            </Field>
            <Field label="Purpose">
              {/* Species-correct: a flock is kept for layers or broilers, never
                  for wool, and the global list offered both to everyone. */}
              <select className="field-select" value={editing.purpose}
                      onChange={(e) => setEditing({ ...editing, purpose: e.target.value })}>
                <option value="">—</option>
                {speciesConfig(editing.species).purposes.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
                {/* ⚠️ KEEP WHAT IS ALREADY STORED. The clinic module used to
                    write LAYERS/BROILERS while the shared config uses
                    LAYER/BROILER; without this the old value matches no option,
                    the select renders "—", and the next save silently erases a
                    purpose nobody meant to change. */}
                {editing.purpose
                  && !speciesConfig(editing.species).purposes.some((p) => p.key === editing.purpose) && (
                  <option value={editing.purpose}>
                    {purposeLabel(editing.purpose) ?? editing.purpose}
                  </option>
                )}
              </select>
            </Field>
          </div>
          <Field label="Housing">
            {/* "e.g. Zero-grazing unit" was being suggested for chickens. */}
            <PickOrType
              options={speciesConfig(editing.species).housing}
              value={editing.housing}
              onChange={(v) => setEditing({ ...editing, housing: v })}
              placeholder="Type how they are housed"
            />
          </Field>
          <Field label="Notes">
            <textarea className="field-textarea" rows={2} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
        </Modal>
      )}
    </LivestockPage>
  );
};

export default AnimalGroupsView;
