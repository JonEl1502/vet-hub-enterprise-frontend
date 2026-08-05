/**
 * AdminClinicWizard — admin add/edit flow for clinics, replaces the
 * previous single-page AdminClinicFormPage. Three steps:
 *   1. Identity   (name, subdomain, slogan, contact, address, currency)
 *   2. Owner      (ADD MODE ONLY — the login for this clinic)
 *   3. Branding   (primary + secondary colours)
 *   4. Specialties (multi-select chips)
 *
 * ⚠️ The Owner step exists because a clinic with no owner CANNOT BE SIGNED
 * INTO — the owner's email is the login. This wizard created the org and
 * nothing else, so every clinic added here was unreachable until someone
 * attached a user by hand (user, 2026-08-05: "where do i add the user, the
 * owner"). Edit mode skips it: changing owners is a transfer, not a create.
 *
 * Edit mode preloads the existing clinic; add mode starts blank. Uses the
 * shared <Wizard> shell so future entity wizards (Supplier, Freelancer)
 * have the same UX.
 */

import React, { useEffect, useState } from 'react';
import { Building2, Palette, Sparkles, Loader2, UserPlus, Copy, Check } from 'lucide-react';
import { clinicsAPI, Clinic, toast } from '../../../services';
import { CLINIC_SPECIALTIES } from '../../../constants';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
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

/** The clinic's first user. Blank password ⇒ the server generates one and
 *  returns it ONCE, which is the path we want an admin to take. */
const emptyOwner = { firstName: '', surname: '', email: '', phone: '', password: '' };

const AdminClinicWizard: React.FC<Props> = ({ clinicId, onClose, onSaved }) => {
  const editing = clinicId != null;
  const [form, setForm] = useState(empty);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [owner, setOwner] = useState(emptyOwner);
  /** Shown after create — the one and only time the password is readable. */
  const [issued, setIssued] = useState<{ email: string; password?: string } | null>(null);
  const [copied, setCopied] = useState(false);
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
      const payload: any = { ...form, specialties };
      // Owner rides along on CREATE only — the server makes the user and the
      // org in one call so the clinic is signable-into the moment it exists.
      if (!editing && owner.email.trim()) {
        payload.owner = {
          email: owner.email.trim(),
          firstName: owner.firstName.trim(),
          surname: owner.surname.trim(),
          phone: owner.phone.trim() || undefined,
          password: owner.password.trim() || undefined,
        };
      }
      const res: any = editing
        ? await clinicsAPI.update(Number(clinicId), payload)
        : await clinicsAPI.create(payload);
      const data = res?.data ?? res ?? {};
      const saved = data.clinic ?? null;
      toast.success(`Clinic ${editing ? 'updated' : 'created'}`);
      if (saved && onSaved) onSaved(saved);
      // A generated password is readable EXACTLY once. Hold the wizard open on
      // a hand-off panel instead of closing — closing would destroy the only
      // copy that will ever exist.
      if (!editing && data.ownerEmail && data.temporaryPassword) {
        setIssued({ email: data.ownerEmail, password: data.temporaryPassword });
        return;
      }
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
    ...(editing ? [] : [{
      id: 'owner',
      label: 'Owner',
      icon: UserPlus,
      validate: () => {
        if (!owner.email.trim()) return 'An owner email is required — it is the login for this clinic.';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner.email.trim())) return 'That email does not look valid.';
        if (!owner.firstName.trim()) return "The owner's first name is required.";
        return true;
      },
    } as WizardStep]),
    { id: 'branding',    label: 'Branding',    icon: Palette },
    { id: 'specialties', label: 'Specialties', icon: Sparkles },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  // The credentials hand-off replaces the wizard body: the generated password
  // is readable ONCE and closing the wizard destroys it, so it must not be
  // something you can click past by accident.
  if (issued) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Clinic created</h2>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Give these to the owner. The password is shown <strong>once</strong> — the server keeps
            no readable copy, so if you lose it they must reset it.
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Login</span>
            <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{issued.email}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Temporary password</span>
            <span className="font-mono text-sm font-black text-pine dark:text-zinc-100">{issued.password}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`${issued.email} / ${issued.password}`)
                .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
                .catch(() => toast.error('Could not copy — select the text instead'));
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy both'}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Done
          </button>
        </div>
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
        if (stepId === 'owner') return <OwnerStep owner={owner} setOwner={setOwner} clinicName={form.name} />;
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

const OwnerStep: React.FC<{
  owner: typeof emptyOwner;
  setOwner: React.Dispatch<React.SetStateAction<typeof emptyOwner>>;
  clinicName: string;
}> = ({ owner, setOwner, clinicName }) => (
  <Card>
    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3">
      The owner is the clinic's first user, and their email is the login.
      {clinicName.trim() ? <> Without one, <strong>{clinicName.trim()}</strong> cannot be signed into.</> : ' Without one the clinic cannot be signed into.'}
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="field-label">First name *</label>
        <input value={owner.firstName} onChange={(e) => setOwner({ ...owner, firstName: e.target.value })} className="field-input" placeholder="Amina" />
      </div>
      <div>
        <label className="field-label">Surname</label>
        <input value={owner.surname} onChange={(e) => setOwner({ ...owner, surname: e.target.value })} className="field-input" placeholder="Otieno" />
      </div>
      <div>
        <label className="field-label">Email * (this is the login)</label>
        <input type="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} className="field-input" placeholder="owner@clinic.com" />
      </div>
      <div>
        <label className="field-label">Phone</label>
        <input value={owner.phone} onChange={(e) => setOwner({ ...owner, phone: e.target.value })} className="field-input" placeholder="+254 700 000 000" />
      </div>
      <div className="md:col-span-2">
        <label className="field-label">Temporary password</label>
        <input value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} className="field-input" placeholder="Leave blank to generate one" />
        <p className="field-help">
          Leave blank and one is generated and shown to you <strong>once</strong> after the clinic is
          created. Nothing readable is stored on the server either way.
        </p>
      </div>
    </div>
  </Card>
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
