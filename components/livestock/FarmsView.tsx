/**
 * Farms — the anchor entity of the Livestock module. Everything else (herds,
 * plots, feeding, produce) hangs off a farm.
 *
 * A farm's owner is an existing `clients` row; registering a farm flags that
 * client `is_livestock`, which is what routes them to the livestock experience
 * instead of the pet-owner portal.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Warehouse, Trash2, Pencil, Search, MapPin, Milk, Wheat } from 'lucide-react';
import { livestockAPI, type Farm } from '../../services/modules/livestock.api';
import { clientsAPI, toast, dialog } from '../../services';
import { useClinic } from '../../contexts/ClinicContext';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, PrimaryButton, EmptyState, Modal, Field, Card } from './shared';

const FARM_TYPES = [
  { value: 'MIXED', label: 'Mixed (animals + crops)' },
  { value: 'LIVESTOCK', label: 'Livestock only' },
  { value: 'CROP', label: 'Crops only' },
];

const blank = {
  name: '', ownerClientId: '', farmType: 'MIXED', county: '', location: '',
  sizeAcres: '' as string | number, notes: '',
};

const FarmsView: React.FC = () => {
  const { selectedClinicIds } = useClinic();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<(typeof blank & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await livestockAPI.listFarms();
      if (res.success && res.data?.farms) setFarms(res.data.farms);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, selectedClinicIds.join(',')]);

  // Owners come from the clinic's client list — a farm can't be hung off a
  // client of another clinic (the server enforces this too).
  const loadClients = useCallback(async () => {
    if (clients.length) return;
    try {
      const res = await clientsAPI.getAll({ limit: 500 });
      if (res.success && Array.isArray(res.data?.clients)) setClients(res.data.clients);
    } catch { /* non-fatal — the picker just stays empty */ }
  }, [clients.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return farms;
    return farms.filter((f) =>
      `${f.name} ${f.county ?? ''} ${f.ownerClientName ?? ''}`.toLowerCase().includes(q));
  }, [farms, search]);

  const openNew = () => { loadClients(); setEditing({ ...blank }); };
  const openEdit = (f: Farm) => {
    loadClients();
    setEditing({
      id: f.id, name: f.name, ownerClientId: f.ownerClientId, farmType: f.farmType,
      county: f.county ?? '', location: f.location ?? '',
      sizeAcres: f.sizeAcres ?? '', notes: f.notes ?? '',
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Farm name is required'); return; }
    if (!editing.id && !editing.ownerClientId) { toast.error('Choose an owner'); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: editing.name.trim(),
        farmType: editing.farmType,
        county: editing.county || null,
        location: editing.location || null,
        sizeAcres: editing.sizeAcres === '' ? null : Number(editing.sizeAcres),
        notes: editing.notes || null,
      };
      const res = editing.id
        ? await livestockAPI.updateFarm(editing.id, payload)
        : await livestockAPI.createFarm({ ...payload, ownerClientId: editing.ownerClientId });
      if (res.success && res.data?.farm) {
        // Update in place — no refetch needed, the POST/PUT returns the row.
        setFarms((prev) => editing.id
          ? prev.map((f) => (f.id === editing.id ? res.data!.farm : f))
          : [res.data!.farm, ...prev]);
        toast.success(editing.id ? 'Farm updated' : 'Farm registered');
        setEditing(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f: Farm) => {
    const ok = await dialog.confirmDelete({
      title: 'Archive farm',
      message: 'The farm and its feeding/produce history are kept, but it will no longer appear in lists.',
      entityName: f.name,
    });
    if (!ok) return;
    const res = await livestockAPI.deleteFarm(f.id);
    if (res.success) {
      setFarms((prev) => prev.filter((x) => x.id !== f.id));
      toast.success('Farm archived');
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" message="Loading farms..." /></div>;
  }

  return (
    <LivestockPage
      title="Farms"
      subtitle="Every farm on this clinic"
      icon={Warehouse}
      actions={<PrimaryButton onClick={openNew}>New farm</PrimaryButton>}
    >
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="field-input pl-9"
          placeholder="Search farms, owners, counties…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title={search ? 'No farms match' : 'No farms yet'}
          hint={search ? 'Try a different search.' : 'Register a farm to start tracking herds, feeding and produce.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{f.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                    {f.ownerClientName || 'Owner unknown'}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  {f.farmType}
                </span>
              </div>

              {(f.county || f.location) && (
                <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                  <MapPin size={11} className="shrink-0" />
                  {[f.county, f.location].filter(Boolean).join(' · ')}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1"><Milk size={11} /> {f.headCount ?? 0} head</span>
                <span className="flex items-center gap-1"><Wheat size={11} /> {f.cropPlotCount ?? 0} plots</span>
                {f.sizeAcres != null && <span>{f.sizeAcres} acres</span>}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-1">
                <button onClick={() => openEdit(f)} title="Edit"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-seafoam"><Pencil size={13} /></button>
                <button onClick={() => remove(f)} title="Archive"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Edit farm' : 'Register a farm'}
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
          saveLabel={editing.id ? 'Save' : 'Register'}
        >
          <Field label="Farm name">
            <input className="field-input" value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Kamau Dairy" />
          </Field>

          {!editing.id && (
            <Field label="Owner (client)">
              <select className="field-select" value={editing.ownerClientId}
                onChange={(e) => setEditing({ ...editing, ownerClientId: e.target.value })}>
                <option value="">Select a client…</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name || [c.firstName, c.surname].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                Registering a farm marks this client as a livestock client.
              </p>
            </Field>
          )}

          <Field label="Farm type">
            <select className="field-select" value={editing.farmType}
              onChange={(e) => setEditing({ ...editing, farmType: e.target.value })}>
              {FARM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="County">
              <input className="field-input" value={editing.county}
                onChange={(e) => setEditing({ ...editing, county: e.target.value })} placeholder="e.g. Nakuru" />
            </Field>
            <Field label="Size (acres)">
              <input className="field-input" type="number" min="0" step="0.1" value={editing.sizeAcres}
                onChange={(e) => setEditing({ ...editing, sizeAcres: e.target.value })} />
            </Field>
          </div>

          <Field label="Location">
            <input className="field-input" value={editing.location}
              onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Village / ward / directions" />
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

export default FarmsView;
