import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, Loader2, X } from 'lucide-react';
import { clinicsAPI, Clinic, toast } from '../services';
import { CLINIC_SPECIALTIES } from '../constants';

interface Props {
  clinicId?: string | number | null; // present = edit mode
  onClose: () => void;
  onSaved?: (clinic: Clinic) => void;
}

const empty = {
  name: '', email: '', phone: '', address: '', subdomain: '', slogan: '',
  primaryColor: '#1a5f4a', secondaryColor: '#7dd3c0', currency: 'USD',
};

const AdminClinicFormPage: React.FC<Props> = ({ clinicId, onClose, onSaved }) => {
  const editing = clinicId != null;
  const [form, setForm] = useState(empty);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setLoading(true);
    clinicsAPI.getById(Number(clinicId))
      .then((res: any) => {
        const c = res?.data?.clinic ?? res?.clinic ?? null;
        if (!c) {
          setError('Clinic not found');
          return;
        }
        setForm({
          name: c.name ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          address: c.address ?? '',
          subdomain: c.subdomain ?? '',
          slogan: c.slogan ?? '',
          primaryColor: c.primaryColor ?? '#1a5f4a',
          secondaryColor: c.secondaryColor ?? '#7dd3c0',
          currency: c.currency ?? 'USD',
        });
        setSpecialties(c.specialties || []);
      })
      .catch((e: any) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [editing, clinicId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast.error('Clinic name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, specialties };
      const res: any = editing
        ? await clinicsAPI.update(Number(clinicId), payload)
        : await clinicsAPI.create(payload);
      const saved = res?.data?.clinic ?? res?.clinic ?? null;
      toast.success(`Clinic ${editing ? 'updated' : 'created'}`);
      if (saved && onSaved) onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e?.message || `Failed to ${editing ? 'update' : 'create'} clinic`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-seafoam" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <header className="flex items-center justify-between py-3 mb-3 border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-bold text-seafoam hover:text-pine"
        >
          <ArrowLeft size={14} /> Back to clinics
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
          title="Close"
        >
          <X size={14} className="text-slate-500" />
        </button>
      </header>

      <div className="mb-5">
        <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">
          {editing ? 'Edit Clinic' : 'Add Clinic'}
        </h1>
        <p className="text-seafoam dark:text-zinc-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">
          {editing ? 'Update an existing clinic' : 'Create a new clinic'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{error}</div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <h2 className="section-header mb-3">Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="field-input" />
            </div>
            <div>
              <label className="field-label">Subdomain</label>
              <input value={form.subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value })} className="field-input" placeholder="e.g. happy-paws" />
            </div>
            <div className="md:col-span-2">
              <label className="field-label">Slogan</label>
              <input value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} className="field-input" />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field-input" />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field-input" />
            </div>
            <div className="md:col-span-2">
              <label className="field-label">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="field-input" />
            </div>
            <div>
              <label className="field-label">Currency</label>
              <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="field-input" maxLength={3} />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <h2 className="section-header mb-3">Branding</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Primary colour</label>
              <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="field-input h-10 cursor-pointer" />
            </div>
            <div>
              <label className="field-label">Secondary colour</label>
              <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="field-input h-10 cursor-pointer" />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <h2 className="section-header mb-3">Specialties</h2>
          <div className="flex flex-wrap gap-1.5">
            {(CLINIC_SPECIALTIES as Array<{ value: string; label: string; icon?: any }>).map((spec) => {
              const active = specialties.includes(spec.value);
              return (
                <button
                  key={spec.value}
                  type="button"
                  onClick={() =>
                    setSpecialties((s) =>
                      active ? s.filter((x) => x !== spec.value) : [...s, spec.value],
                    )
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition ${
                    active
                      ? 'bg-seafoam text-white border-seafoam'
                      : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
                  }`}
                >
                  {spec.icon} {spec.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {editing ? 'Save changes' : 'Create clinic'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminClinicFormPage;
