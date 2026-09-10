import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Loader2, PawPrint, CalendarCheck, BellRing, Receipt, ArrowRight, MapPin } from 'lucide-react';
import { publicAPI, type PublicClinic } from '../../services/modules/public.api';
import BrandMark from '../shared/common/BrandMark';

/**
 * 297 — WHERE A CLINIC'S QR CODE LANDS.
 *
 * A practice prints `app.vethubcore.com/c/<their-slug>` on a poster, a receipt
 * or a collar tag. Scanning it reaches this page.
 *
 * ── Why a landing rather than pointing the QR at an auth screen ────────────
 * Neither existing door works for a scan:
 *   · `/client/login` assumes an account, so a new owner bounces off it.
 *   · `/client/signup` assumes intent — it says nothing about what this is or
 *     whose QR was just scanned, and then makes the person SEARCH a directory
 *     for the clinic they are physically standing in.
 * One page can confirm the scan, say what it is for, and offer both doors —
 * carrying the clinic through either.
 *
 * ⚠️ PUBLIC. It has to be: whoever scanned it has no account yet. So it shows
 * only what is already on the clinic's own signage — name, logo, town — and
 * the server's projection is the real boundary (see public.controller).
 *
 * ⚠️ The clinic is auto-attached on SIGNUP ONLY (user, 2026-09-10). A QR gets
 * photographed and forwarded; silently attaching an EXISTING account because
 * someone opened a link would hand a practice a stranger's records. Someone
 * signing up here is making that choice; someone logging in already made a
 * different one.
 */

const WHAT_YOU_GET = [
  { icon: PawPrint, title: 'Your pets, on your phone', body: 'Vaccinations, visits and treatment history — the whole record, not a paper card that lives in a drawer.' },
  { icon: CalendarCheck, title: 'Book without calling', body: 'Ask for a slot and the clinic confirms it. No hold music.' },
  { icon: BellRing, title: 'Reminders that arrive', body: "Boosters, follow-ups and check-ups, before they're overdue rather than after." },
  { icon: Receipt, title: 'Bills and receipts in one place', body: 'See what you owe and what you have paid, any time.' },
];

const ClinicLanding: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let alive = true;
    if (!slug) { setState('missing'); return; }
    publicAPI.clinicBySlug(slug)
      .then((r) => {
        if (!alive) return;
        if (r.success && r.data?.clinic) { setClinic(r.data.clinic); setState('ready'); }
        else setState('missing');
      })
      .catch(() => { if (alive) setState('missing'); });
    return () => { alive = false; };
  }, [slug]);

  const go = (path: string) => {
    if (!clinic) { navigate(path); return; }
    const q = new URLSearchParams({ clinic: clinic.id, clinicName: clinic.name });
    navigate(`${path}?${q.toString()}`);
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f2]">
        <Loader2 className="w-6 h-6 animate-spin text-pine" />
      </div>
    );
  }

  /**
   * A poster outlives the practice that printed it, so a dead slug is a normal
   * outcome — not an error state. Offer the ordinary way in rather than a
   * dead end.
   */
  if (state === 'missing' || !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#faf7f2]">
        <div className="max-w-md text-center">
          <BrandMark />
          <h1 className="mt-5 text-xl font-black text-pine">We couldn't find that clinic</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            The code may be out of date, or the practice may no longer be on VetHubCore.
            You can still create an account and search for them.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <Link to="/client/signup" className="px-5 py-3 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest">
              Create an account
            </Link>
            <Link to="/client/login" className="px-5 py-3 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600">
              I already have one
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const accent = clinic.primaryColor || '#1b4332';

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      {/* Identity first — the scan has to be confirmed before anyone types. */}
      <header className="px-6 pt-10 pb-8 text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${clinic.secondaryColor || accent})` }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-white/15 grid place-items-center text-2xl overflow-hidden shrink-0">
              {clinic.logo && clinic.logo.startsWith('http')
                ? <img src={clinic.logo} alt="" className="w-full h-full object-cover" />
                : (clinic.logo || clinic.name.charAt(0))}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Your clinic on VetHubCore</p>
              <h1 className="text-2xl font-black leading-tight truncate">{clinic.name}</h1>
              {(clinic.slogan || clinic.city) && (
                <p className="text-xs text-white/80 mt-0.5 flex items-center gap-1.5 truncate">
                  {clinic.city && <><MapPin size={11} /> {clinic.city}</>}
                  {clinic.slogan && clinic.city && <span className="opacity-50">·</span>}
                  {clinic.slogan}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-lg font-black text-pine">Keep your pets' records with you</h2>
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
          {clinic.name} uses VetHubCore. Set up a free account and their records, appointments
          and bills follow you — on your phone, whenever you need them.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WHAT_YOU_GET.map((w) => (
            <div key={w.title} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${accent}14` }}>
                <w.icon size={16} style={{ color: accent }} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-pine">{w.title}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5 leading-relaxed">{w.body}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Both doors, because a poster is read by new and returning owners
            alike and the QR cannot know which is scanning it. */}
        <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => go('/client/signup')}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-lg"
            style={{ background: accent }}
          >
            I'm new here <ArrowRight size={14} />
          </button>
          <button
            onClick={() => go('/client/login')}
            className="flex-1 px-5 py-3.5 rounded-xl border border-slate-300 bg-white text-xs font-black uppercase tracking-widest text-slate-600"
          >
            I already have an account
          </button>
        </div>

        <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
          Signing up here connects you to {clinic.name} automatically. You can add or change
          clinics later from your profile, and your records stay with each clinic either way.
        </p>
      </main>
    </div>
  );
};

export default ClinicLanding;
