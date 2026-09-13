/**
 * Farms — the anchor entity of the Livestock module. Everything else (herds,
 * plots, feeding, produce) hangs off a farm.
 *
 * A farm's owner is an existing `clients` row; registering a farm flags that
 * client `is_livestock`, which is what routes them to the livestock experience
 * instead of the pet-owner portal.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Warehouse, Trash2, Pencil, Search, MapPin, Milk, Wheat, ArrowRight, Stethoscope, X, Layers } from 'lucide-react';
import { livestockAPI, type Farm, type VetOfficer, type AnimalGroup } from '../../services/modules/livestock.api';
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
  sizeAcres: '' as string | number, notes: '', linkedVetUserId: '',
};

const FarmsView: React.FC = () => {
  const { selectedClinicIds } = useClinic();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [officers, setOfficers] = useState<VetOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  /**
   * One farm, opened. A card that lists a head count and cannot be opened is a
   * dead end — the herds behind that number are the reason a vet looks.
   * Loaded on demand rather than with the list: most farms are never opened,
   * and a groups query per card would be N requests for one screen.
   */
  const [detail, setDetail] = useState<Farm | null>(null);
  const [detailGroups, setDetailGroups] = useState<AnimalGroup[] | null>(null);
  useEffect(() => {
    if (!detail) { setDetailGroups(null); return; }
    livestockAPI.listAnimalGroups(detail.id)
      .then((r) => { if (r.success && r.data) setDetailGroups(r.data.groups); })
      .catch(() => setDetailGroups([]));
  }, [detail]);

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

  // Vet officers power the linkage picker — clinic vets AND independents
  // (county officers), fetched once and reused by both modals.
  const loadOfficers = useCallback(async () => {
    if (officers.length) return;
    try {
      const res = await livestockAPI.listVetOfficers();
      if (res.success && res.data?.officers) setOfficers(res.data.officers);
    } catch { /* non-fatal — picker just stays empty */ }
  }, [officers.length]);

  const openNew = () => { loadClients(); loadOfficers(); setEditing({ ...blank }); };
  const openEdit = (f: Farm) => {
    loadClients();
    loadOfficers();
    setEditing({
      id: f.id, name: f.name, ownerClientId: f.ownerClientId, farmType: f.farmType,
      county: f.county ?? '', location: f.location ?? '',
      sizeAcres: f.sizeAcres ?? '', notes: f.notes ?? '',
      linkedVetUserId: f.linkedVetUserId ?? '',
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
        linkedVetUserId: editing.linkedVetUserId || null,
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
              {/* Identity — a mark, the farm, then who owns it. The owner is
                  the person a vet rings, so it is not a footnote. */}
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-seafoam/10 dark:bg-seafoam/15 flex items-center justify-center shrink-0">
                  <Warehouse size={18} className="text-seafoam" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-black text-slate-800 dark:text-white truncate">{f.name}</p>
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      {f.farmType}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                    {f.ownerClientName || 'Owner unknown'}
                  </p>
                  {(f.county || f.location) && (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1 truncate">
                      <MapPin size={10} className="shrink-0" />
                      {[f.county, f.location].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              {/* The numbers, given the room the old single line denied them —
                  head count is what a vet reads first. */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { icon: Milk, label: 'Head', value: f.headCount ?? 0 },
                  { icon: Layers, label: 'Kinds', value: f.animalGroupCount ?? 0 },
                  { icon: Wheat, label: 'Plots', value: f.cropPlotCount ?? 0 },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-2.5 py-2">
                    <Icon size={11} className="text-slate-400" />
                    <p className="text-base font-black text-slate-800 dark:text-zinc-100 leading-none mt-1 tabular-nums">{value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {f.sizeAcres != null && (
                <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500">{f.sizeAcres} acres</p>
              )}
              {/* Says WHY this clinic can see it — their client, or a farm the
                  owner linked from the portal. */}
              {f.linkedClinicId && (
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1">
                  <Stethoscope size={11} /> Linked to this clinic
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-1">
                <button
                  onClick={() => setDetail(f)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  View details <ArrowRight size={12} />
                </button>
                <button onClick={() => openEdit(f)} title="Edit"
                  className="p-2 rounded-lg text-slate-400 hover:text-pine dark:hover:text-seafoam"><Pencil size={13} /></button>
                <button onClick={() => remove(f)} title="Archive"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── One farm, opened ─────────────────────────────────────────────
          Read-only on purpose. Editing the farm is the pencil; this answers
          "what is on this farm", which is the question a vet arrives with. */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-150">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 px-6 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-black text-pine dark:text-zinc-100 truncate">{detail.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {[detail.ownerClientName, detail.county, detail.location].filter(Boolean).join(' · ') || 'No owner or location set'}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Head', value: detail.headCount ?? 0 },
                  { label: 'Kinds', value: detail.animalGroupCount ?? 0 },
                  { label: 'Plots', value: detail.cropPlotCount ?? 0 },
                  { label: 'Acres', value: detail.sizeAcres ?? '—' },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2.5">
                    <p className="text-lg font-black text-slate-800 dark:text-zinc-100 leading-none tabular-nums">{m.value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{m.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Herds &amp; flocks</p>
                {detailGroups === null ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : detailGroups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 px-4 py-6 text-center">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Nothing recorded on this farm yet. The owner adds herds from their portal, or
                      you can add them under Herds &amp; Flocks.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {detailGroups.map((g) => (
                      <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-zinc-100 truncate">{g.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                            {[g.species, g.breed, g.housing].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black text-slate-800 dark:text-zinc-100 tabular-nums leading-none">{g.headCount}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Head</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail.notes && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Notes</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{detail.notes}</p>
                </div>
              )}
            </div>
          </div>
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

          <Field label="Attending vet officer">
            <select className="field-select" value={editing.linkedVetUserId}
              onChange={(e) => setEditing({ ...editing, linkedVetUserId: e.target.value })}>
              <option value="">None — self-managed</option>
              {officers.filter((o) => o.kind === 'CLINIC_VET').length > 0 && (
                <optgroup label="Our clinic">
                  {officers.filter((o) => o.kind === 'CLINIC_VET')
                    .map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              )}
              {officers.filter((o) => o.kind === 'INDEPENDENT').length > 0 && (
                <optgroup label="Independent · county vet officers">
                  {officers.filter((o) => o.kind === 'INDEPENDENT')
                    .map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              )}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">
              Full linkage options live on Farm Settings.
            </p>
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
