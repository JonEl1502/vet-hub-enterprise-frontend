/**
 * AdminClinicWizard — admin add/edit flow for clinics, replaces the
 * previous single-page AdminClinicFormPage. Three steps:
 *   1. Identity   (name, subdomain, slogan, contact, address, currency)
 *   2. Branding   (primary + secondary colours)
 *   3. Specialties (multi-select chips)
 *
 * Edit mode preloads the existing clinic; add mode starts blank. Uses the
 * shared <Wizard> shell so future entity wizards (Supplier, Freelancer)
 * have the same UX.
 */

import React, { useEffect, useState } from 'react';
import { Building2, Palette, Sparkles, Loader2 } from 'lucide-react';
import { clinicsAPI, Clinic, toast } from '../../../services';
import { CLINIC_SPECIALTIES } from '../../../constants';
import Wizard, { WizardStep } from '../../shared/common/Wizard';

interface Props {
  /** Present = edit mode, absent = create. */
  clinicId?: string | number | null;
  onClose: () => void;
  onSaved?: (clinic: Clinic) => void;
}

const empty = {
  name: '', email: '', phone: '', address: '', subdomain: '', slogan: '',
  primaryColor: '#1a5f4a', secondaryColor: '#7dd3c0', currency: 'USD',
};

const AdminClinicWizard: React.FC<Props> = ({ clinicId, onClose, onSaved }) => {
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

  const submit = async () => {
    if (!form.name.trim()) {
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

  const steps: WizardStep[] = [
    {
      id: 'identity',
      label: 'Identity',
      icon: Building2,
      // Identity is the only step with required fields. Branding/specialties
      // are optional, so no validate needed there.
      validate: () => {
        if (!form.name.trim()) return 'Clinic name is required.';
        if (!form.currency.trim()) return 'Currency is required.';
        return true;
      },
    },
    { id: 'branding',    label: 'Branding',    icon: Palette },
    { id: 'specialties', label: 'Specialties', icon: Sparkles },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-seafoam" size={28} />
      </div>
    );
  }

  return (
    <Wizard
      steps={steps}
      title={editing ? 'Edit Clinic' : 'Add Clinic'}
      subtitle={editing ? 'Update an existing clinic' : 'Create a new clinic'}
      onCancel={onClose}
      onFinish={submit}
      finishLabel={editing ? 'Save changes' : 'Create clinic'}
      isSubmitting={saving}
      error={error}
    >
      {(stepId) => {
        if (stepId === 'identity') return <IdentityStep form={form} setForm={setForm} />;
        if (stepId === 'branding') return <BrandingStep form={form} setForm={setForm} />;
        if (stepId === 'specialties') return <SpecialtiesStep specialties={specialties} setSpecialties={setSpecialties} />;
        return null;
      }}
    </Wizard>
  );
};

// ─────────────────────── Step bodies ────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm">
    {children}
  </section>
);

const IdentityStep: React.FC<{
  form: typeof empty;
  setForm: React.Dispatch<React.SetStateAction<typeof empty>>;
}> = ({ form, setForm }) => (
  <Card>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="field-label">Name *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field-input" placeholder="Happy Paws Veterinary" />
      </div>
      <div>
        <label className="field-label">Subdomain</label>
        <input value={form.subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value })} className="field-input" placeholder="happy-paws" />
      </div>
      <div className="md:col-span-2">
        <label className="field-label">Slogan</label>
        <input value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} className="field-input" placeholder="Caring for your companions" />
      </div>
      <div>
        <label className="field-label">Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field-input" placeholder="hello@clinic.com" />
      </div>
      <div>
        <label className="field-label">Phone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field-input" placeholder="+254 700 000 000" />
      </div>
      <div className="md:col-span-2">
        <label className="field-label">Address</label>
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="field-input" placeholder="123 Main Street, Nairobi" />
      </div>
      <div>
        <label className="field-label">Currency *</label>
        <input
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
          className="field-input font-mono uppercase"
          maxLength={3}
          placeholder="KES"
        />
      </div>
    </div>
  </Card>
);

const BrandingStep: React.FC<{
  form: typeof empty;
  setForm: React.Dispatch<React.SetStateAction<typeof empty>>;
}> = ({ form, setForm }) => (
  <Card>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="field-label">Primary colour</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
            className="w-12 h-9 rounded cursor-pointer border border-slate-200 dark:border-zinc-700"
          />
          <input
            type="text"
            value={form.primaryColor}
            onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
            className="field-input font-mono uppercase flex-1"
            maxLength={7}
          />
        </div>
      </div>
      <div>
        <label className="field-label">Secondary colour</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={form.secondaryColor}
            onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
            className="w-12 h-9 rounded cursor-pointer border border-slate-200 dark:border-zinc-700"
          />
          <input
            type="text"
            value={form.secondaryColor}
            onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
            className="field-input font-mono uppercase flex-1"
            maxLength={7}
          />
        </div>
      </div>
    </div>
    <div className="mt-4 p-3 rounded-lg border border-dashed border-slate-200 dark:border-zinc-700">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Preview</p>
      <div className="flex items-center gap-2">
        <span
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white"
          style={{ backgroundColor: form.primaryColor }}
        >
          Primary
        </span>
        <span
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white"
          style={{ backgroundColor: form.secondaryColor }}
        >
          Secondary
        </span>
      </div>
    </div>
  </Card>
);

const SpecialtiesStep: React.FC<{
  specialties: string[];
  setSpecialties: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ specialties, setSpecialties }) => (
  <Card>
    <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 mb-3">
      Pick the services and clinical focus areas this clinic offers. You can change these later.
    </p>
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
  </Card>
);

export default AdminClinicWizard;
