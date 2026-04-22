import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import desktopImg from '../assets/device-desktop.png';
import tabletImg from '../assets/device-tablet.png';
import mobileImg from '../assets/device-mobile.png';
import {
  Building2, Calendar, Package, BarChart3, Users, ArrowRight, Check,
  Smartphone, Monitor, Tablet, Star, Stethoscope, ShieldCheck,
  MapPin, Truck, BadgeCheck, Menu, X, Plus, Minus, Zap, Clock,
  Globe, TrendingUp, CreditCard, Bell, QrCode,
} from 'lucide-react';

// Swap this URL for a licensed hero photograph (person-with-phone / clinic scene).
// Leave as empty string to fall back to the dark gradient background.
const HERO_BG_URL = '';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
  onDemo: () => void;
  onPricing: () => void;
  onSupplierSignup?: () => void;
}

// Deriv-inspired design tokens — dark neutral palette, VetHub teal accent,
// snappy easing, pill buttons, tight typography.
const INK = '#163C39';
const INK_SOFT = '#1d4a46';
const MUTED = '#5c616d';
const SURFACE = '#f6f7f8';
const BORDER = '#ebecef';
const TEAL = '#438883';
const TEAL_DEEP = '#163C39';
const EASE = [0.65, 0, 0.35, 1] as const;

// ── Reusable bits ──────────────────────────────────────────────────────────
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#438883] mb-4">
    {children}
  </span>
);

const SectionHeading = ({ eyebrow, title, sub }: { eyebrow?: string; title: React.ReactNode; sub?: string }) => (
  <div className="max-w-3xl">
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#163C39] leading-[1.05]">
      {title}
    </h2>
    {sub && <p className="mt-5 text-[#5c616d] text-lg leading-relaxed max-w-2xl">{sub}</p>}
  </div>
);

const Pill = ({
  children, onClick, variant = 'primary', className = '', type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
}) => {
  const v = {
    primary:   'bg-[#438883] text-white hover:bg-[#163C39] shadow-[0_.5rem_1rem_.125rem_#16434220]',
    secondary: 'bg-white text-[#163C39] border border-[#ebecef] hover:border-[#163C39]/40',
    dark:      'bg-[#163C39] text-white hover:bg-[#1d4a46]',
    ghost:     'text-[#163C39] hover:text-[#438883]',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-bold text-[13px] tracking-[.02em] transition-all duration-150 ease-[cubic-bezier(.65,0,.35,1)] ${v} ${className}`}
    >
      {children}
    </button>
  );
};

// ── NAV ── Floating pill nav, centered; translucent over hero, solid white on scroll.
const Nav: React.FC<{ onLogin: () => void; onRegister: () => void; onPricing: () => void }> = ({
  onLogin, onRegister, onPricing,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 120);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const onDark = !scrolled;

  return (
    <div className="fixed top-4 md:top-5 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav
        className={`pointer-events-auto w-full max-w-[1080px] rounded-full transition-all duration-200 ease-[cubic-bezier(.65,0,.35,1)]
          ${scrolled
            ? 'bg-white shadow-[0_0.75rem_1.5rem_rgba(24,28,37,0.1)]'
            : 'bg-white/12 backdrop-blur-xl border border-white/15 shadow-[0_0.5rem_1rem_rgba(0,0,0,0.2)]'}`}
      >
        <div className="px-3 md:px-4 h-14 flex items-center justify-between gap-2">
          <a href="#" className="flex items-center gap-2 shrink-0 pl-2">
            <div className="w-7 h-7 rounded-md bg-[#438883] flex items-center justify-center text-sm leading-none">🐾</div>
            <span className={`font-black text-[15px] tracking-tight transition-colors ${onDark ? 'text-white' : 'text-[#163C39]'}`}>
              Vet<span className="text-[#438883]">Hub</span>
            </span>
          </a>

          <div className={`hidden lg:flex items-center gap-7 text-[13px] font-semibold transition-colors ${onDark ? 'text-white/90' : 'text-[#163C39]'}`}>
            <a href="#modules" className="hover:text-[#438883] transition-colors">Platform</a>
            <a href="#clinics" className="hover:text-[#438883] transition-colors">Clinics</a>
            <a href="#suppliers" className="hover:text-[#438883] transition-colors">Suppliers</a>
            <a href="#testimonials" className="hover:text-[#438883] transition-colors">Customers</a>
            <a href="#faq" className="hover:text-[#438883] transition-colors">FAQ</a>
            <button onClick={onPricing} className="hover:text-[#438883] transition-colors">Pricing</button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLogin}
              className={`hidden sm:inline-flex items-center h-10 px-5 rounded-full text-[13px] font-bold border transition-colors
                ${onDark ? 'border-white text-white hover:bg-white/10' : 'border-[#163C39] text-[#163C39] hover:bg-[#f6f7f8]'}`}
            >
              Log in
            </button>
            <Pill onClick={onRegister} variant="primary" className="hidden sm:inline-flex !h-10 !px-5 !py-0 !text-[13px]">
              Create account
            </Pill>
            <button
              onClick={() => setOpen(o => !o)}
              className={`lg:hidden p-2 transition-colors ${onDark ? 'text-white' : 'text-[#163C39]'}`}
              aria-label="menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden bg-white rounded-b-3xl px-4 pb-4 pt-2 flex flex-col gap-1 border-t border-[#ebecef]">
            <a href="#modules" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#163C39]">Platform</a>
            <a href="#clinics" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#163C39]">Clinics</a>
            <a href="#suppliers" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#163C39]">Suppliers</a>
            <a href="#testimonials" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#163C39]">Customers</a>
            <a href="#faq" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#163C39]">FAQ</a>
            <button onClick={() => { onPricing(); setOpen(false); }} className="py-2 text-[15px] font-semibold text-[#163C39] text-left">Pricing</button>
            <div className="flex gap-2 pt-3 border-t border-[#ebecef]">
              <Pill onClick={onLogin} variant="secondary" className="flex-1">Log in</Pill>
              <Pill onClick={onRegister} variant="primary" className="flex-1">Create account</Pill>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
};

// ── HERO ── Full-bleed dark hero with parallax bg + stacked headline + QR card + review strip.
const Hero: React.FC<{ onRegister: () => void; onDemo: () => void }> = ({ onRegister, onDemo }) => {
  const { scrollY } = useScroll();
  // Parallax layers — each transforms at a different rate to create depth.
  const bgY      = useTransform(scrollY, [0, 900], [0, 220]);   // photo/gradient drifts down slower
  const overlayY = useTransform(scrollY, [0, 900], [0, 80]);    // dark overlay drifts with bg
  const contentY = useTransform(scrollY, [0, 900], [0, -90]);   // copy floats up faster
  const deviceY  = useTransform(scrollY, [0, 900], [0, -140]);  // device image rises fastest
  const fadeOut  = useTransform(scrollY, [300, 700], [1, 0]);   // hero content fades as you scroll

  return (
    <section className="relative h-[min(980px,100vh)] md:min-h-[820px] bg-[#2a6560] overflow-hidden rounded-b-[1.75rem] md:rounded-b-[2.5rem]">

      {/* Background layer — photo or gradient fallback, parallax */}
      <motion.div style={{ y: bgY }} className="absolute -inset-y-16 inset-x-0 pointer-events-none">
        {HERO_BG_URL ? (
          <img src={HERO_BG_URL} alt="" className="w-full h-full object-cover select-none" draggable={false} />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_70%_15%,#4da89d_0%,#3a8a81_35%,#2a6560_70%,#1d4a46_100%)]" />
            <div
              className="absolute inset-0 opacity-90 mix-blend-screen"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 35%, rgba(103,204,195,0.45) 0, transparent 55%), radial-gradient(circle at 85% 75%, rgba(189,234,226,0.35) 0, transparent 55%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
              }}
            />
          </>
        )}
      </motion.div>

      {/* Dark legibility overlay — stronger on the left where text sits */}
      <motion.div
        style={{ y: overlayY }}
        className="absolute inset-0 bg-gradient-to-r from-[#163C39]/70 via-[#163C39]/25 to-transparent pointer-events-none"
      />

      {/* Decorative parallax device on the right (acts as the "lifestyle" subject) */}
      <motion.div
        style={{ y: deviceY }}
        className="hidden md:block absolute right-[-4%] top-[18%] w-[60%] lg:w-[52%] pointer-events-none opacity-90 drop-shadow-[0_2rem_3rem_rgba(0,0,0,0.5)]"
      >
        <img src={desktopImg} alt="" className="w-full select-none" draggable={false} />
      </motion.div>

      {/* Floating vet profile card — highest z-index, hovers above device + overlay */}
      <motion.div
        style={{ y: deviceY, opacity: fadeOut }}
        className="hidden md:block absolute right-[6%] lg:right-[10%] top-[32%] z-30"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-[1.25rem] pl-2 pr-5 py-2 shadow-[0_1.25rem_2rem_rgba(0,0,0,0.35)] border border-white/60"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#438883] to-[#163C39] text-white grid place-items-center font-black text-base leading-none">
            O
          </div>
          <div className="leading-tight">
            <p className="text-[14px] font-black text-[#163C39]">Dr. Otieno</p>
            <p className="text-[12px] font-semibold text-[#5c616d]">Small animals</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: contentY, opacity: fadeOut }} className="relative z-10 h-full">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 h-full flex flex-col justify-center pt-24 pb-32">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-white/80 text-lg md:text-2xl font-medium mb-3 md:mb-5"
          >
            Veterinary care for
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
            className="text-[56px] sm:text-[72px] md:text-[104px] lg:text-[132px] font-black tracking-tight text-white leading-[0.92]"
          >
            Every clinic<br />Every pet<br />Every team
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            className="mt-8 text-white/75 text-base md:text-lg max-w-md"
          >
            Appointments, records, inventory, and billing — one connected platform with 24/7 support.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            className="mt-8"
          >
            <Pill onClick={onRegister} variant="primary" className="!px-9 !py-4 !text-[14px]">
              Create account
            </Pill>
          </motion.div>

          {/* QR / app download card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
            className="mt-7 inline-flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-[1.25rem] pl-2 pr-5 py-2 shadow-[0_1rem_2rem_rgba(0,0,0,0.25)] w-fit"
          >
            <div className="w-14 h-14 rounded-lg bg-white grid place-items-center border border-[#ebecef]">
              <QrCode size={40} strokeWidth={1.25} className="text-[#163C39]" />
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-black text-[#163C39]">Download now</p>
              <p className="text-[13px] font-bold text-[#438883]">VetHub app</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Review strip pinned to the bottom of the hero (like a TrustBox band) */}
      <div className="absolute bottom-0 inset-x-0 bg-[#0d2a27]/95 backdrop-blur-md border-t border-white/10 py-3">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-white">
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(s => (
              <div key={s} className="w-6 h-6 bg-[#00b67a] grid place-items-center rounded-[3px]">
                <Star size={14} className="text-white" fill="currentColor" />
              </div>
            ))}
          </div>
          <span className="text-[13px] font-semibold">4.9 out of 5 · based on 2,140 verified clinic reviews</span>
        </div>
      </div>
    </section>
  );
};

// ── LAUREL + AWARD ── SVG wreath used to flank the center confidence card.
const Laurel: React.FC<{ flipped?: boolean }> = ({ flipped = false }) => (
  <svg
    width="36" height="72" viewBox="0 0 36 72"
    className={flipped ? 'scale-x-[-1]' : ''}
    fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
  >
    <path d="M30 4 Q 12 32 6 68" stroke="#787d88" strokeWidth="1" strokeLinecap="round" fill="none" />
    {Array.from({ length: 9 }).map((_, i) => {
      const t = i / 8;
      const cx = 30 - 22 * t - 4 * t * t;
      const cy = 4 + 62 * t;
      return (
        <ellipse
          key={i}
          cx={cx} cy={cy} rx="5" ry="1.8"
          transform={`rotate(${-35 - t * 25} ${cx} ${cy})`}
          fill="#787d88" opacity={0.7}
        />
      );
    })}
  </svg>
);

const Award: React.FC<{ title: string; subtitle: string; year: string }> = ({ title, subtitle, year }) => (
  <div className="flex items-center gap-3">
    <Laurel flipped />
    <div className="text-center max-w-[140px]">
      <p className="font-black text-[#163C39] text-[13px] leading-tight tracking-tight">{title}</p>
      <p className="text-[11px] text-[#5c616d] mt-1">{subtitle}</p>
      <p className="text-[11px] text-[#5c616d] mt-0.5">{year}</p>
    </div>
    <Laurel />
  </div>
);

// ── TRUST CONFIDENCE ── Center stat card flanked by award laurels.
const TrustConfidence: React.FC = () => (
  <section className="py-24 md:py-32 bg-white">
    <div className="max-w-[1280px] mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: EASE }}
        className="text-center max-w-3xl mx-auto mb-14 md:mb-20"
      >
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#163C39] leading-[1.05]">
          Run with confidence.
        </h2>
        <p className="mt-5 text-[#5c616d] text-base md:text-lg leading-relaxed">
          Clinics across 12 countries trust VetHub to run their practice — day in, day out.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-10 lg:gap-14 items-center max-w-5xl mx-auto">

        {/* Left awards */}
        <div className="flex flex-col gap-10 items-center lg:items-end order-2 lg:order-1">
          <Award title="Best Veterinary SaaS"  subtitle="Africa PetTech Awards" year="2025" />
          <Award title="Top Clinic Platform"   subtitle="VetTech Review"        year="2024" />
        </div>

        {/* Center card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
          className="order-1 lg:order-2 bg-[#f6f7f8] rounded-[1.5rem] py-12 px-10 md:px-14 md:py-16 text-center min-w-[280px]"
        >
          <p className="text-4xl md:text-5xl font-black text-[#c8c8c8] tracking-tight leading-none">2,000+</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#787d88] mt-2">Clinics worldwide</p>

          <p className="text-6xl md:text-7xl lg:text-[96px] font-black text-[#163C39] tracking-tight leading-none mt-10">1.2M+</p>
          <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#5c616d] mt-3">Visits managed / year</p>

          <p className="text-4xl md:text-5xl font-black text-[#c8c8c8] tracking-tight leading-none mt-10">2020</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#787d88] mt-2">Established since</p>
        </motion.div>

        {/* Right awards */}
        <div className="flex flex-col gap-10 items-center lg:items-start order-3">
          <Award title="Most Trusted Vet App"  subtitle="Africa PetTech Awards" year="2024" />
          <Award title="Best Customer Service" subtitle="VetForum Global"       year="2024" />
        </div>
      </div>
    </div>
  </section>
);

// ── MODULES ──────────────────────────────────────────────────────────────────
const Modules: React.FC = () => {
  const mods = [
    { icon: Building2,   title: 'Multi-clinic',     desc: 'Manage all your branches from one dashboard — staff, inventory, records.' },
    { icon: Calendar,    title: 'Smart scheduling', desc: 'Drag-and-drop calendar with conflict detection and automated reminders.' },
    { icon: Package,     title: 'Inventory',        desc: 'Track stock, set reorder points, manage batches and expiry dates.' },
    { icon: Users,       title: 'Client portal',    desc: 'Pet owners view records, book visits, and message your team.' },
    { icon: BarChart3,   title: 'Analytics',        desc: 'Real-time insights into revenue, staff efficiency, and appointments.' },
    { icon: ShieldCheck, title: 'Security',         desc: 'Enterprise-grade access control with role-based permissions.' },
  ];
  return (
    <section id="modules" className="py-24 md:py-32 bg-white">
      <div className="max-w-[1280px] mx-auto px-6">
        <SectionHeading
          eyebrow="Platform"
          title={<>Everything your clinic runs on.<br /><span className="text-[#5c616d]">All in one place.</span></>}
          sub="Six tightly integrated modules, designed for the way veterinary teams actually work."
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mods.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="group bg-[#f6f7f8] hover:bg-white rounded-[1.25rem] p-8 border border-transparent hover:border-[#ebecef] hover:shadow-[0_.5rem_1rem_.125rem_rgba(65,70,82,0.08)] transition-all duration-200 ease-[cubic-bezier(.65,0,.35,1)] cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-[#438883] text-white flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
                <m.icon size={22} />
              </div>
              <h3 className="text-xl font-black text-[#163C39] mb-2 tracking-tight">{m.title}</h3>
              <p className="text-[#5c616d] text-[15px] leading-relaxed">{m.desc}</p>
              <div className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#438883] opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight size={14} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── PLATFORMS (DEVICES) ──────────────────────────────────────────────────────
const Platforms: React.FC = () => (
  <section className="py-24 md:py-32 bg-[#f6f7f8]">
    <div className="max-w-[1280px] mx-auto px-6 grid lg:grid-cols-[1fr_1.1fr] gap-16 items-center">
      <div>
        <SectionHeading
          eyebrow="Works everywhere"
          title={<>Desktop, tablet,<br />and mobile.</>}
          sub="From the front desk to the exam room to house visits — VetHub adapts to how your team already works."
        />
        <div className="mt-10 space-y-5">
          {[
            { icon: Monitor,    title: 'Desktop',  desc: 'Full dashboard for reception and administration.' },
            { icon: Tablet,     title: 'Tablet',   desc: 'Ideal for exam rooms and on-the-spot clinical notes.' },
            { icon: Smartphone, title: 'Mobile',   desc: 'Stay connected anywhere, anytime, from the field.' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-white border border-[#ebecef] flex items-center justify-center shrink-0">
                <item.icon size={20} className="text-[#438883]" />
              </div>
              <div>
                <h4 className="font-black text-[#163C39] text-[17px] tracking-tight">{item.title}</h4>
                <p className="text-[#5c616d] text-[14px] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative"
      >
        <div className="relative z-10 drop-shadow-[0_1.5rem_2rem_rgba(24,28,37,0.15)]">
          <img src={desktopImg} alt="VetHub on Desktop" className="w-full rounded-2xl select-none" draggable={false} />
        </div>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-6 -left-8 w-[42%] z-20 drop-shadow-[0_1.5rem_2rem_rgba(24,28,37,0.18)]"
        >
          <img src={tabletImg} alt="VetHub on Tablet" className="w-full rounded-2xl select-none" draggable={false} />
        </motion.div>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-10 -right-4 w-[22%] z-30 drop-shadow-[0_1.5rem_2rem_rgba(24,28,37,0.2)]"
        >
          <img src={mobileImg} alt="VetHub on Mobile" className="w-full rounded-2xl select-none" draggable={false} />
        </motion.div>
        <div className="h-20" />
      </motion.div>
    </div>
  </section>
);

// ── INTEGRATIONS STRIP ───────────────────────────────────────────────────────
const Integrations: React.FC = () => {
  const partners = [
    { label: 'M-Pesa', icon: CreditCard },
    { label: 'Stripe', icon: CreditCard },
    { label: 'Zoho',   icon: Globe      },
    { label: 'Xero',   icon: BarChart3  },
    { label: 'Twilio', icon: Bell       },
    { label: 'IDEXX',  icon: Stethoscope},
  ];
  return (
    <section className="py-20 bg-white border-y border-[#ebecef]">
      <div className="max-w-[1280px] mx-auto px-6">
        <p className="text-center text-[12px] font-bold uppercase tracking-[0.2em] text-[#787d88] mb-10">
          Integrated with the tools your clinic already uses
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-8 items-center">
          {partners.map((p, i) => (
            <div key={i} className="flex items-center justify-center gap-2 text-[#5c616d] hover:text-[#163C39] transition-colors">
              <p.icon size={20} />
              <span className="font-black text-base tracking-tight">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── CLINICS SHOWCASE ─────────────────────────────────────────────────────────
const Clinics: React.FC = () => {
  const clinics = [
    { name: 'Nairobi Animal Hospital', city: 'Nairobi, Kenya',    rating: 4.9, visits: '1,240', specialty: 'Small animals' },
    { name: 'Cape Vet Centre',         city: 'Cape Town, SA',     rating: 4.8, visits: '980',   specialty: 'Exotic pets'   },
    { name: 'Kampala Pet Clinic',      city: 'Kampala, Uganda',   rating: 4.7, visits: '760',   specialty: 'Large animals' },
    { name: 'Dar es Salaam Vets',      city: 'Dar es Salaam, TZ', rating: 4.9, visits: '1,100', specialty: 'Surgery'       },
    { name: 'Kigali Animal Care',      city: 'Kigali, Rwanda',    rating: 4.8, visits: '640',   specialty: 'Dentistry'     },
    { name: 'Lagos Vet Hospital',      city: 'Lagos, Nigeria',    rating: 4.7, visits: '2,050', specialty: 'Emergency'     },
  ];
  return (
    <section id="clinics" className="py-24 md:py-32 bg-white">
      <div className="max-w-[1280px] mx-auto px-6">
        <SectionHeading
          eyebrow="Clinics on VetHub"
          title={<>Trusted across the continent.</>}
          sub="Veterinary practices from Cape Town to Cairo running their day-to-day on VetHub."
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinics.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-[1.25rem] p-6 border border-[#ebecef] hover:shadow-[0_.5rem_1rem_.125rem_rgba(65,70,82,0.08)] transition-all duration-200 ease-[cubic-bezier(.65,0,.35,1)]"
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-[#438883]/10 text-[#438883] flex items-center justify-center shrink-0">
                  <Stethoscope size={20} />
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  {[1,2,3,4,5].map(s => <Star key={s} size={11} fill="currentColor" />)}
                  <span className="text-[11px] font-bold text-[#5c616d] ml-1">{c.rating}</span>
                </div>
              </div>
              <h4 className="font-black text-[#163C39] text-[17px] tracking-tight">{c.name}</h4>
              <div className="flex items-center gap-1 text-[#787d88] text-[12px] mt-1">
                <MapPin size={11} />
                <span>{c.city}</span>
              </div>
              <div className="flex items-center justify-between pt-5 mt-5 border-t border-[#ebecef]">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#438883] bg-[#438883]/10 px-2.5 py-1 rounded-full">{c.specialty}</span>
                <span className="text-[11px] font-bold text-[#787d88]">{c.visits} visits</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── SUPPLIERS SHOWCASE ───────────────────────────────────────────────────────
const Suppliers: React.FC<{ onSupplierSignup?: () => void }> = ({ onSupplierSignup }) => {
  const suppliers = [
    { name: 'MedVet Supplies',      category: 'Pharmaceuticals', location: 'Nairobi, Kenya',  products: 340, verified: true  },
    { name: 'PetCare Distributors', category: 'Consumables',     location: 'Lagos, Nigeria',  products: 215, verified: true  },
    { name: 'VetEquip Africa',      category: 'Equipment',       location: 'Cape Town, SA',   products: 128, verified: true  },
    { name: 'AniPharm Ltd',         category: 'Vaccines',        location: 'Kampala, Uganda', products: 90,  verified: true  },
    { name: 'ClinicPlus Supplies',  category: 'Lab reagents',    location: 'Kigali, Rwanda',  products: 175, verified: false },
    { name: 'SurgiVet Co.',         category: 'Surgical tools',  location: 'Accra, Ghana',    products: 260, verified: true  },
  ];
  return (
    <section id="suppliers" className="py-24 md:py-32 bg-[#f6f7f8]">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <SectionHeading
            eyebrow="Marketplace"
            title={<>Powered by verified suppliers.</>}
            sub="Order medicines, equipment, and consumables from vetted partners — delivered to your clinic."
          />
          {onSupplierSignup && (
            <Pill onClick={onSupplierSignup} variant="dark">
              Join as supplier <ArrowRight size={15} />
            </Pill>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-[1.25rem] p-6 border border-[#ebecef] hover:shadow-[0_.5rem_1rem_.125rem_rgba(65,70,82,0.08)] transition-all duration-200 ease-[cubic-bezier(.65,0,.35,1)]"
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-[#163C39]/5 text-[#163C39] flex items-center justify-center shrink-0">
                  <Truck size={20} />
                </div>
                {s.verified && (
                  <div className="flex items-center gap-1 text-[#00bb86] text-[10px] font-bold">
                    <BadgeCheck size={14} />
                    <span>Verified</span>
                  </div>
                )}
              </div>
              <h4 className="font-black text-[#163C39] text-[17px] tracking-tight">{s.name}</h4>
              <div className="flex items-center gap-1 text-[#787d88] text-[12px] mt-1">
                <MapPin size={11} />
                <span>{s.location}</span>
              </div>
              <div className="flex items-center justify-between pt-5 mt-5 border-t border-[#ebecef]">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#438883] bg-[#438883]/10 px-2.5 py-1 rounded-full">{s.category}</span>
                <span className="text-[11px] font-bold text-[#787d88]">{s.products} products</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── TESTIMONIALS ─────────────────────────────────────────────────────────────
const Testimonials: React.FC = () => {
  const quotes = [
    {
      quote: 'Switching to VetHub cut our reception workload in half. Appointments, reminders, and billing just work.',
      name:  'Dr. Amina Otieno',
      role:  'Lead Vet, Nairobi Animal Hospital',
    },
    {
      quote: 'The inventory module alone paid for itself in three months. We stopped running out of vaccines.',
      name:  'Thabo Mokoena',
      role:  'Operations, Cape Vet Centre',
    },
    {
      quote: 'Onboarding four branches in two weeks felt impossible. VetHub made it feel routine.',
      name:  'Dr. Kemi Adebayo',
      role:  'Clinic Director, Lagos Vet Hospital',
    },
  ];
  return (
    <section id="testimonials" className="py-24 md:py-32 bg-white">
      <div className="max-w-[1280px] mx-auto px-6">
        <SectionHeading
          eyebrow="Customers"
          title={<>Quiet confidence,<br />from real clinics.</>}
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
              className="bg-[#f6f7f8] rounded-[1.25rem] p-8 flex flex-col"
            >
              <div className="flex items-center gap-0.5 text-amber-400 mb-5">
                {[1,2,3,4,5].map(s => <Star key={s} size={14} fill="currentColor" />)}
              </div>
              <blockquote className="text-[#163C39] text-[17px] leading-relaxed font-medium flex-1">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 pt-6 border-t border-[#ebecef]">
                <p className="font-black text-[#163C39] text-[15px] tracking-tight">{q.name}</p>
                <p className="text-[#5c616d] text-[13px] mt-0.5">{q.role}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── STEPS / HOW IT WORKS ─────────────────────────────────────────────────────
const Steps: React.FC<{ onRegister: () => void }> = ({ onRegister }) => {
  const steps = [
    { n: '01', title: 'Create your clinic', desc: 'Sign up in minutes. Add your branches, staff, and services.' },
    { n: '02', title: 'Import your data',   desc: 'Bring in clients, patients, and inventory from spreadsheets or your old system.' },
    { n: '03', title: 'Go live',            desc: 'Start booking, invoicing, and treating — from day one.' },
    { n: '04', title: 'Scale with confidence', desc: 'Open new branches, add suppliers, grow without rebuilding.' },
  ];
  return (
    <section className="py-24 md:py-32 bg-[#163C39] text-white">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="max-w-3xl">
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#438883] mb-4">Getting started</span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">
            Four steps from<br /><span className="text-white/60">spreadsheet to scaled.</span>
          </h2>
        </div>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
              className="relative p-6 rounded-[1.25rem] bg-white/5 border border-white/10 hover:border-white/25 transition-colors"
            >
              <div className="text-[11px] font-black tracking-[0.2em] text-[#438883]">{s.n}</div>
              <h4 className="mt-5 text-xl font-black tracking-tight">{s.title}</h4>
              <p className="mt-2 text-white/60 text-[14px] leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-12">
          <Pill onClick={onRegister} variant="primary">
            Start your clinic on VetHub <ArrowRight size={16} />
          </Pill>
        </div>
      </div>
    </section>
  );
};

// ── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ: React.FC = () => {
  const faqs = [
    { q: 'How long does onboarding take?', a: 'Most clinics are fully live within 7 days. Multi-branch groups with complex data migrations typically take 2–3 weeks.' },
    { q: 'Can VetHub handle multiple branches?', a: 'Yes. Manage any number of branches from one dashboard with per-branch staff, inventory, pricing, and reports.' },
    { q: 'Which payment methods do you support?', a: 'M-Pesa, card payments via Stripe, direct bank transfers, and cash — all reconciled in one ledger per branch.' },
    { q: 'Do pet owners get their own portal?', a: 'Yes. Clients can view pet records, book appointments, message your team, and pay invoices from web or mobile.' },
    { q: 'How does pricing work?', a: 'Simple per-branch subscription with unlimited staff. See full details on our pricing page.' },
    { q: 'Is my clinic’s data secure?', a: 'All data is encrypted in transit and at rest. Role-based permissions and audit logs come standard.' },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 md:py-32 bg-white">
      <div className="max-w-[960px] mx-auto px-6">
        <SectionHeading eyebrow="FAQ" title={<>Straight answers.</>} />
        <div className="mt-12 divide-y divide-[#ebecef] border-t border-b border-[#ebecef]">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <button
                key={i}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full text-left py-6 flex gap-6 items-start transition-colors hover:text-[#438883]"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-[17px] md:text-[19px] font-black text-[#163C39] tracking-tight">{f.q}</h4>
                    <span className="shrink-0 w-9 h-9 rounded-full bg-[#f6f7f8] flex items-center justify-center">
                      {isOpen ? <Minus size={16} className="text-[#163C39]" /> : <Plus size={16} className="text-[#163C39]" />}
                    </span>
                  </div>
                  {isOpen && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="mt-3 text-[#5c616d] text-[15px] leading-relaxed max-w-2xl"
                    >
                      {f.a}
                    </motion.p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ── FOOTER CTA ───────────────────────────────────────────────────────────────
const FooterCTA: React.FC<{ onRegister: () => void; onDemo: () => void; onPricing: () => void }> = ({
  onRegister, onDemo, onPricing,
}) => (
  <section className="bg-[#163C39] text-white py-28 md:py-36 overflow-hidden">
    <div className="max-w-[1280px] mx-auto px-6 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE }}
        className="text-5xl md:text-7xl lg:text-[104px] font-black tracking-tight leading-[0.95]"
      >
        Run your clinic,<br />
        <span className="text-white/40">beautifully.</span>
      </motion.h2>
      <p className="mt-8 text-white/60 text-lg md:text-xl max-w-xl mx-auto">
        Create a free VetHub account or try the demo clinic. No card required.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
        <Pill onClick={onRegister} variant="primary">
          Create free account <ArrowRight size={16} />
        </Pill>
        <Pill onClick={onDemo} variant="secondary">
          Try demo clinic
        </Pill>
        <button onClick={onPricing} className="text-[13px] font-bold text-white/70 hover:text-white inline-flex items-center gap-1.5 ml-2">
          View pricing <ArrowRight size={14} />
        </button>
      </div>
    </div>
  </section>
);

// ── FOOTER ───────────────────────────────────────────────────────────────────
const Footer: React.FC = () => (
  <footer className="bg-[#0d2a27] text-white/60 pt-20 pb-10">
    <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-8">
      <div className="col-span-2">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#438883] flex items-center justify-center text-base leading-none">🐾</div>
          <span className="font-black text-white text-[17px] tracking-tight">Vet<span className="text-[#438883]">Hub</span></span>
        </div>
        <p className="text-[14px] leading-relaxed max-w-sm">
          The operating system for modern veterinary practices. Built for clinics, multi-site groups, and the suppliers who serve them.
        </p>
      </div>

      {[
        { title: 'Platform',  links: ['Appointments', 'Inventory', 'Records', 'Billing', 'Analytics'] },
        { title: 'Marketplace', links: ['Clinics', 'Suppliers', 'Become a supplier', 'Pricing'] },
        { title: 'Company',   links: ['About', 'Careers', 'Contact', 'Privacy', 'Terms'] },
      ].map((col, i) => (
        <div key={i}>
          <h5 className="text-white font-black text-[13px] uppercase tracking-[0.15em] mb-4">{col.title}</h5>
          <ul className="space-y-3">
            {col.links.map(l => (
              <li key={l}><a href="#" className="text-[14px] hover:text-white transition-colors">{l}</a></li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    <div className="max-w-[1280px] mx-auto px-6 mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
      <p className="text-[13px]">© {new Date().getFullYear()} VetHub Enterprise. All rights reserved.</p>
      <div className="flex gap-6 text-[13px]">
        <a href="#" className="hover:text-white transition-colors">Privacy</a>
        <a href="#" className="hover:text-white transition-colors">Terms</a>
        <a href="#" className="hover:text-white transition-colors">Security</a>
      </div>
    </div>
  </footer>
);

// ── PAGE ─────────────────────────────────────────────────────────────────────
export default function LandingPage({ onLogin, onRegister, onDemo, onPricing, onSupplierSignup }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-[#163C39] antialiased">
      <Nav onLogin={onLogin} onRegister={onRegister} onPricing={onPricing} />
      <Hero onRegister={onRegister} onDemo={onDemo} />
      <TrustConfidence />
      <Modules />
      <Platforms />
      <Integrations />
      <Clinics />
      <Suppliers onSupplierSignup={onSupplierSignup} />
      <Testimonials />
      <Steps onRegister={onRegister} />
      <FAQ />
      <FooterCTA onRegister={onRegister} onDemo={onDemo} onPricing={onPricing} />
      <Footer />
    </div>
  );
}
