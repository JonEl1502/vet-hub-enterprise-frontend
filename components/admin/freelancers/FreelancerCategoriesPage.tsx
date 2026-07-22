import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, X, RefreshCw, GripVertical, Layers } from 'lucide-react';
import { freelancerCategoriesAPI, type FreelancerCategory, toast, dialog } from '../../../services';
import StatusToggle from '../../shared/common/StatusToggle';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';

const blankDraft = { name: '', description: '', sortOrder: 0, isActive: true };

const FreelancerCategoriesPage: React.FC<{ onNavigate?: (view: string, params?: any) => void }> = () => {
  const [cats, setCats] = useState<FreelancerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FreelancerCategory | null>(null);
  const [draft, setDraft] = useState<{ name: string; description: string; sortOrder: number; isActive: boolean }>(blankDraft);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await freelancerCategoriesAPI.list({ all: true });
      if (res.success && res.data?.categories) setCats(res.data.categories);
      else setError('Could not load categories.');
    } catch (e: any) {
      setError(e?.message || 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setDraft(blankDraft); setShowForm(true); };
  const openEdit = (c: FreelancerCategory) => {
    setEditing(c);
    setDraft({ name: c.name, description: c.description || '', sortOrder: c.sortOrder ?? 0, isActive: c.isActive });
    setShowForm(true);
  };

  const save = async () => {
    if (!draft.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await freelancerCategoriesAPI.update(editing.id, draft);
        toast.success('Category updated');
      } else {
        await freelancerCategoriesAPI.create(draft);
        toast.success('Category created');
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: FreelancerCategory) => {
    const ok = await dialog.confirmDelete({
      title: 'Delete Category',
      message: 'Freelancers currently using this category will have it removed from their profile. This cannot be undone.',
      entityName: c.name,
    });
    if (!ok) return;
    try {
      await freelancerCategoriesAPI.delete(c.id);
      toast.success('Category deleted');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  const toggleActive = async (c: FreelancerCategory, next: boolean) => {
    try {
      await freelancerCategoriesAPI.update(c.id, { isActive: next });
      toast.success(next ? 'Category activated' : 'Category deactivated');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    }
  };

  return (
    <AdminPage className="pb-20">
      <AdminPageHeader
        title="Freelancer Categories"
        subtitle="Preset services freelancers can advertise (e.g. dog walking)"
        icon={Layers}
        actions={
          <>
            <button onClick={load} disabled={loading} className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 flex items-center gap-1.5">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
            </button>
            <button onClick={openCreate} className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine flex items-center gap-1.5">
              <Plus size={12} /> New
            </button>
          </>
        }
      />

      {error && <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{error}</div>}

      {loading && cats.length === 0 ? (
        <LoadingSpinner contentArea message="Loading..." />
      ) : cats.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-slate-500">No categories yet. Add the first one.</div>
      ) : (
        <div className="space-y-2">
          {cats.map(c => (
            <div key={c.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical size={14} className="text-slate-300 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-pine dark:text-zinc-100 truncate">{c.name}</h3>
                    <span className="text-[9px] font-bold text-slate-400">#{c.sortOrder}</span>
                  </div>
                  {c.description && <p className="text-[11px] text-slate-500 truncate">{c.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <StatusToggle
                  isActive={c.isActive}
                  entityName={c.name}
                  entityKind="category"
                  onToggle={(next) => toggleActive(c, next)}
                />
                <button onClick={() => openEdit(c)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-all" title="Edit"><Pencil size={14} /></button>
                <button onClick={() => remove(c)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all" title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">{editing ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={14} className="text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="field-label">Name</label>
                <input className="field-input" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Dog walking" />
              </div>
              <div>
                <label className="field-label">Description (optional)</label>
                <textarea className="field-textarea" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Short summary of the service" rows={2} />
              </div>
              <div>
                <label className="field-label">Sort order</label>
                <input type="number" className="field-input" value={draft.sortOrder} onChange={e => setDraft(d => ({ ...d, sortOrder: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
};

export default FreelancerCategoriesPage;
