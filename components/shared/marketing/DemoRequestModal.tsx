import React, { useState } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import { publicAPI } from '../../../services/modules/public.api';

interface DemoRequestModalProps {
  onClose: () => void;
  /**
   * WHO is being asked. Defaults to `clinic`, which is every existing caller.
   *
   * `/supplier-signup` falls back to this form when signups are closed
   * (2026-08-26), and a supplier was being asked for their CLINIC name, with
   * "Westlands Paws Vet Clinic" in the box and "number of branches" as the
   * prompt. The lead still arrives, but the visitor is told the product is not
   * for them, and the team cannot tell the two apart afterwards.
   */
  audience?: 'clinic' | 'supplier';
}

/**
 * "Contact us for a demo" lead form, shown in place of self-serve signup when
 * an admin has turned public signups off. Posts to the public /request-demo
 * endpoint, which emails the VetHub team via Resend and files the lead.
 *
 * ⚠️ The audience is sent as `audience`, NOT as a `source`. `source` is the
 * column the admin lead queues split on, so the server maps the audience to it
 * — a public form must not be able to write into that axis directly.
 */
const DemoRequestModal: React.FC<DemoRequestModalProps> = ({ onClose, audience = 'clinic' }) => {
  const isSupplier = audience === 'supplier';
  const copy = isSupplier
    ? {
        heading: 'Talk to us about supplying',
        sub: 'Tell us about your business and we’ll set you up with a guided demo and an account.',
        orgLabel: 'Company name',
        orgPlaceholder: 'ABC Pharmaceuticals Ltd',
        emailPlaceholder: 'you@company.com',
        messagePlaceholder: 'What you supply, where you deliver…',
        cta: 'Request a demo',
        doneSub: 'Our team will reach out shortly to schedule your demo and get your company set up.',
      }
    : {
        heading: 'Contact us for a demo',
        sub: 'Tell us about your clinic and we’ll set you up with a guided demo and an account.',
        orgLabel: 'Clinic name',
        orgPlaceholder: 'Westlands Paws Vet Clinic',
        emailPlaceholder: 'you@clinic.com',
        messagePlaceholder: 'Number of branches, what you’re looking for…',
        cta: 'Request a demo',
        doneSub: 'Our team will reach out shortly to schedule your demo and get your clinic set up.',
      };
  const [form, setForm] = useState({ name: '', clinicName: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSubmit = form.name.trim() && validEmail && (form.phone.trim() || form.message.trim()) && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await publicAPI.requestDemo({
        name: form.name.trim(),
        email: form.email.trim(),
        clinicName: form.clinicName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        message: form.message.trim() || undefined,
        audience,
      }, { showError: false });
      if (res.success) setDone(true);
      else setError(res.message || 'Something went wrong. Please try again.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0d2a27]/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h3 className="text-xl font-black tracking-tight text-[#144E35]">{copy.heading}</h3>
            <p className="mt-1 text-[13px] text-[#5c616d]">{copy.sub}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-[#144E35] shrink-0 mt-1" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="px-6 pb-8 pt-2 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#1C7A5B]/10 text-[#1C7A5B] grid place-items-center mb-4">
              <Check size={28} />
            </div>
            <h4 className="text-lg font-black text-[#144E35]">Thanks, we’ll be in touch!</h4>
            <p className="mt-2 text-[14px] text-[#5c616d]">
              {copy.doneSub}
            </p>
            <button
              onClick={onClose}
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-[#144E35] text-white font-bold text-[14px] hover:bg-[#0d2a27] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 pb-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="field-label">Your name<span className="text-red-500"> *</span></label>
                <input className="field-input" value={form.name} onChange={set('name')} placeholder="Dr. Jane Doe" autoFocus />
              </div>
              <div>
                {/* Still `clinicName` on the wire — it is the org-name column
                    on the lead, and renaming it would be a migration for a
                    label. The SERVER relabels it "Company" on a supplier lead. */}
                <label className="field-label">{copy.orgLabel}</label>
                <input className="field-input" value={form.clinicName} onChange={set('clinicName')} placeholder={copy.orgPlaceholder} />
              </div>
              <div>
                <label className="field-label">Email<span className="text-red-500"> *</span></label>
                <input className="field-input" type="email" value={form.email} onChange={set('email')} placeholder={copy.emailPlaceholder} />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input className="field-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+254 7XX XXX XXX" />
              </div>
              <div>
                <label className="field-label">Anything you’d like us to know?</label>
                <textarea className="field-textarea" rows={3} value={form.message} onChange={set('message')} placeholder={copy.messagePlaceholder} />
              </div>
              <p className="field-help">Leave a phone number or a message so we can reach you.</p>
              {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-[#144E35] text-white font-bold text-[15px] hover:bg-[#0d2a27] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending…' : <>{copy.cta} <ArrowRight size={16} /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DemoRequestModal;
