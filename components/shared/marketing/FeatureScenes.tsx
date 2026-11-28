/**
 * "Every room in the clinic" — one row per job, alternating sides.
 *
 * Same design and feel as the Rekodi SmartLedger landing's "Everything in one
 * place" section (FeatureRows.tsx / Devices.tsx there), in VetHubCore's
 * palette (user, 2026-11-28): a real photo of the job being done, with the
 * SAME live screen on a desktop, a tablet and a phone over its lower corner;
 * the job's name is the big title, a ✱ tagline under it, a short lede and
 * three ticks.
 *
 * Screens are real captures of the staging demo practice (invented clients,
 * phone numbers masked), in public/landing/. Device frames are pure CSS.
 * ⚠️ Percentage padding inside a frame is measured against its PARENT, so the
 * width always sits on a wrapper div, never on the frame itself.
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  Check, ChevronLeft, ChevronRight, Building2, ShoppingBag, MessagesSquare, FlaskConical, Scissors,
  Pill, Wallet, BellRing, Award, ClipboardList, Tractor, Truck, Share2, BarChart3, UserCog, Sparkles,
} from 'lucide-react';

const EASE = [0.65, 0, 0.35, 1] as const;

interface Scene {
  id: string;
  name: string;
  tagline: string;
  lede: string;
  points: string[];
  photo: { src: string; alt: string; pos?: string };
  screen: string; // key into /landing/{desk,tab,phone}-<key>.webp
}

// Photos: Pexels licence (free to use, no attribution required; credited in
// public/landing/CREDITS.md). Hotlinked from Pexels for review; self-hosted
// once the picks are final.
const px = (id: string) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1400`;

const SCENES: Scene[] = [
  {
    id: 'checkin', name: 'Check-in & appointments', tagline: 'From the front door to the right vet.',
    lede: 'The owner walks in, the front desk finds the client and the animal in seconds, checks them in and hands the patient to a named vet, who is told straight away.',
    points: ['Walk-ins, bookings and follow-ups in one diary', 'Pick the vet at check-in; they get an alert the moment it lands', 'The desk goes straight back to the queue'],
    photo: { src: px('6235049'), alt: 'An owner and a vet with a small dog at the clinic' }, screen: 'checkin',
  },
  {
    id: 'consult', name: 'Consultations', tagline: 'A guided visit that writes the record for you.',
    lede: 'History, examination, diagnostics and treatment run as steps. Weight and temperature are taken once, every service lands on the bill as you go, and the visit ends with a reminder.',
    points: ['Vaccination, deworming and surgery visits follow their own steps', 'Lab and imaging ordered from the visit, results filed on the patient', 'The bill is already built when the vet presses done'],
    photo: { src: px('6235114'), alt: 'A vet examining a German Shepherd' }, screen: 'visits',
  },
  {
    id: 'client', name: 'Client app', tagline: 'Owners in the loop, from their own phone.',
    lede: "Pet owners and farmers see their animals' records, results and reminders, book visits and pay online — invited by your practice, and free for them.",
    points: ['Reminders and results on their phone', 'Book a visit without calling the desk', 'Herds, flocks and feeding plans for livestock owners'],
    photo: { src: px('4453148'), alt: 'An owner on her phone with her dog on the lawn' }, screen: 'portal',
  },
  {
    id: 'grooming', name: 'Grooming', tagline: 'Every dog in, groomed and collected.',
    lede: 'Grooming bookings with the services each animal is in for, who is on the table now and who is ready for pick-up — billed like everything else.',
    points: ['Baths, full grooms, nail trims and flea baths as priced services', 'Ready for pick-up at a glance', 'The same animal record the vets keep'],
    photo: { src: px('19145894'), alt: 'A groomer trimming a large dog' }, screen: 'grooming',
  },
  {
    id: 'boarding', name: 'Boarding & day-care', tagline: 'Stays, runs and daily care, billed by the night.',
    lede: 'Check animals into named runs, log feeding, walks and meds for every day of the stay, and check them out with the nights already on the bill.',
    points: ['Who is in, and who goes home today', 'Daily care logs the owner can trust', 'Nights billed automatically at check-out'],
    photo: { src: px('37443358'), alt: 'Dogs playing together in a day-care yard' }, screen: 'boarding',
  },
  {
    id: 'inpatient', name: 'Inpatient & ward', tagline: 'The ward, on one screen.',
    lede: 'Admit from the visit, chart medication and feeding through the day, and see what is due and who is ready to go home — right on the dashboard.',
    points: ['Meds and feeding due, by patient', 'Discharges due today, before they are late', 'Every dose drawn from stock and added to the bill'],
    photo: { src: px('4074725'), alt: 'A small dog on an IV drip at the clinic' }, screen: 'inpatient',
  },
];

const Shot: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <img src={src} alt={alt} loading="lazy" decoding="async" className="w-full h-full object-cover object-left-top" />
);

const Mac: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div>
    <div className="relative rounded-t-[3.2%_5%] bg-[#0b0d12] p-[1.6%] pb-[2.4%] shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45)]">
      <span className="absolute left-1/2 top-0 -translate-x-1/2 w-[11%] h-[2.6%] min-h-[5px] rounded-b-md bg-[#0b0d12] z-10" />
      <div className="aspect-[16/10] overflow-hidden rounded-[0.6%] bg-[#F7F5F0]"><Shot src={src} alt={alt} /></div>
    </div>
    <div className="relative -mx-[7%] h-[3.4%] min-h-[8px] rounded-b-[40%_100%] bg-gradient-to-b from-[#e4e6ea] via-[#c9ccd2] to-[#9ea2aa] shadow-[0_14px_24px_-10px_rgba(15,23,42,0.5)]">
      <span className="absolute left-1/2 top-0 -translate-x-1/2 w-[14%] h-[45%] rounded-b-lg bg-[#b5b9c0]" />
    </div>
  </div>
);

const Tablet: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div className="rounded-[7%/5%] bg-[#0b0d12] p-[3.4%] shadow-[0_26px_55px_rgba(15,23,42,0.36)]">
    <div className="aspect-[820/1180] overflow-hidden rounded-[3.5%/2.5%] bg-[#F7F5F0]"><Shot src={src} alt={alt} /></div>
  </div>
);

const Phone: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div className="rounded-[18%/8.5%] bg-[#0b0d12] p-[3.2%] shadow-[0_24px_50px_rgba(15,23,42,0.38)]">
    <div className="aspect-[390/844] overflow-hidden rounded-[15%/7%] bg-[#F7F5F0]"><Shot src={src} alt={alt} /></div>
  </div>
);

const FeatureScenes: React.FC = () => (
  <div className="mt-16 md:mt-24 space-y-24 sm:space-y-32">
    {SCENES.map((s, i) => {
      const flip = i % 2 === 1;
      return (
        <motion.article
          key={s.id} id={s.id}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: EASE }}
          className="scroll-mt-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          {/* Visual: photo, with the same screen on a desktop, a tablet and a phone over its lower corner. */}
          <div className={`relative pb-[24%] ${flip ? 'lg:order-2' : ''}`}>
            <div className={`relative w-[90%] aspect-[4/3] rounded-[1.75rem] overflow-hidden bg-[#eef1ee] border border-[#ebecef] ${flip ? 'ml-auto' : ''}`}>
              <img src={s.photo.src} alt={s.photo.alt} loading="lazy" decoding="async"
                className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: s.photo.pos || 'center' }} />
            </div>
            <div className={`absolute bottom-[4%] w-[56%] ${flip ? 'left-[4%]' : 'right-[4%]'}`}>
              <Mac src={`/landing/desk-${s.screen}.webp`} alt={`VetHubCore ${s.name} on a desktop`} />
            </div>
            <div className={`absolute bottom-0 w-[21%] ${flip ? 'left-[48%]' : 'right-[48%]'}`}>
              <Tablet src={`/landing/tab-${s.screen}.webp`} alt={`VetHubCore ${s.name} on a tablet`} />
            </div>
            <div className={`absolute bottom-0 w-[13.5%] max-w-[130px] ${flip ? 'left-0' : 'right-0'}`}>
              <Phone src={`/landing/phone-${s.screen}.webp`} alt={`VetHubCore ${s.name} on a phone`} />
            </div>
          </div>

          {/* Words: the job's name is the big title (Rekodi pattern, 2026-11-26). */}
          <div className={flip ? 'lg:order-1' : ''}>
            <h3 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black tracking-tight leading-[1.02] text-[#1C7A5B]">{s.name}</h3>
            <p className="mt-3 flex items-baseline gap-2 text-xl sm:text-2xl text-[#5c616d] font-semibold leading-snug">
              <span className="text-[#F2A41C] text-base sm:text-lg" aria-hidden="true">✱</span>{s.tagline}
            </p>
            <p className="mt-4 text-[#5c616d] text-[16px] leading-relaxed max-w-lg">{s.lede}</p>
            <ul className="mt-6 space-y-3">
              {s.points.map(p => (
                <li key={p} className="flex gap-3 items-start text-[#252a33]">
                  <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-[#CFE6D8] text-[#144E35] flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.article>
      );
    })}
  </div>
);


/**
 * MORE FEATURES — a sideways-scrolling strip after the six scenes
 * (user, 2026-11-28: "a horizontal scroll … multi-clinic, pet shop, VetHubCore
 * Community"). Snap scrolling with swipe on phones; arrow buttons on desktop.
 */
const MORE = [
  { icon: Building2,     title: 'Multi-clinic',            desc: 'Every branch on one login: staff, stock and records per branch, or all together.' },
  { icon: ShoppingBag,   title: 'Pet shop',                desc: 'Sell food, toys and accessories at the counter from the same stock the clinic uses.' },
  { icon: MessagesSquare,title: 'VetHubCore Community',    desc: 'Ask other vets, share cases and find referrals in a community built for the profession.' },
  { icon: FlaskConical,  title: 'Laboratory & imaging',    desc: 'In-house or sent-out tests, X-ray and ultrasound, filed on the patient.' },
  { icon: Scissors,      title: 'Surgery',                 desc: 'Procedure recipes with drugs, consumables and fees, priced by weight.' },
  { icon: Pill,          title: 'Pharmacy & stock',        desc: 'Buy in packs, dispense in tablets or mL, with batches and expiry tracked.' },
  { icon: Wallet,        title: 'Billing & payments',      desc: 'Bills build as you work. Card, mobile money or cash, part payments included.' },
  { icon: BellRing,      title: 'Reminders',               desc: 'Every visit ends with the next one booked: vaccines, deworming and rechecks.' },
  { icon: Award,         title: 'Certificates',            desc: 'Vaccination, birth and death certificates, printed from the record.' },
  { icon: ClipboardList, title: 'Procedure presets',       desc: 'One procedure, many versions: by weight, pregnancy or the patient\'s condition.' },
  { icon: Tractor,       title: 'Farms & livestock',       desc: 'Herds, flocks and feeding plans for farm vets and the farmers they serve.' },
  { icon: Truck,         title: 'Suppliers & orders',      desc: 'Purchase orders, deliveries and what you owe, straight into stock.' },
  { icon: Share2,        title: 'Partners & referrals',    desc: 'Share a record with a partner clinic or lab in two taps, and see who opened it.' },
  { icon: BarChart3,     title: 'Finance & reports',       desc: 'Revenue, part-paid and unpaid visits, compared period against period.' },
  { icon: UserCog,       title: 'Staff & roles',           desc: 'Front desk, vets, groomers and cashiers each see only what they need.' },
  { icon: Sparkles,      title: 'AI assist',               desc: 'Ask questions about your practice and draft notes, inside the app.' },
];

export const MoreFeatures: React.FC = () => {
  const track = React.useRef<HTMLDivElement>(null);
  const nudge = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  };
  return (
    <div className="mt-24 sm:mt-32">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#1C7A5B]">And there is more</p>
          <h3 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-[#144E35]">Everything else a practice needs.</h3>
        </div>
        <div className="hidden md:flex gap-2 shrink-0">
          <button type="button" aria-label="Scroll features left" onClick={() => nudge(-1)}
            className="w-11 h-11 rounded-full border border-[#dfe3e6] bg-white text-[#144E35] flex items-center justify-center hover:border-[#1C7A5B] hover:text-[#1C7A5B] active:scale-95 transition">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Scroll features right" onClick={() => nudge(1)}
            className="w-11 h-11 rounded-full border border-[#dfe3e6] bg-white text-[#144E35] flex items-center justify-center hover:border-[#1C7A5B] hover:text-[#1C7A5B] active:scale-95 transition">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div ref={track}
        className="mt-8 -mx-6 px-6 flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ overscrollBehaviorX: 'contain' }}>
        {MORE.map(f => (
          <div key={f.title}
            className="snap-start shrink-0 w-[78%] sm:w-[300px] bg-[#f6f7f8] hover:bg-white rounded-[1.25rem] p-7 border border-transparent hover:border-[#ebecef] hover:shadow-[0_.5rem_1rem_.125rem_rgba(65,70,82,0.08)] transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-[#1C7A5B] text-white flex items-center justify-center mb-5"><f.icon size={22} /></div>
            <h4 className="text-lg font-black text-[#144E35] tracking-tight">{f.title}</h4>
            <p className="mt-2 text-[#5c616d] text-[15px] leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeatureScenes;
