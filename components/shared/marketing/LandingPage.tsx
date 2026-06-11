import React, { useState, useEffect, useRef } from 'react';
import { partnerTypeAPI, type FeaturedClinic } from '../../../services/modules/partnerType.api';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import desktopImg from '../../../assets/device-desktop.png';
import tabletImg from '../../../assets/device-tablet.png';
import mobileImg from '../../../assets/device-mobile.png';
import {
  Building2, Calendar, Package, BarChart3, Users, ArrowRight, Check,
  Smartphone, Monitor, Tablet, Star, Stethoscope, ShieldCheck,
  MapPin, Truck, BadgeCheck, Menu, X, Plus, Minus, Zap, Clock,
  Globe, TrendingUp, CreditCard, Bell, QrCode, Download,
} from 'lucide-react';
import { CLIENT_SCHEMA } from '../../../utils/import/schemas';
import { downloadTemplate } from '../../../utils/import/template';

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
const INK = '#144E35';
const INK_SOFT = '#1d4a46';
const MUTED = '#5c616d';
const SURFACE = '#f6f7f8';
const BORDER = '#ebecef';
const TEAL = '#1C7A5B';
const TEAL_DEEP = '#144E35';
const EASE = [0.65, 0, 0.35, 1] as const;

// ── Reusable bits ──────────────────────────────────────────────────────────
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#1C7A5B] mb-4">
    {children}
  </span>
);

const SectionHeading = ({ eyebrow, title, sub }: { eyebrow?: string; title: React.ReactNode; sub?: string }) => (
  <div className="max-w-3xl">
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#144E35] leading-[1.05]">
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
    primary:   'bg-[#1C7A5B] text-white hover:bg-[#144E35] shadow-[0_.5rem_1rem_.125rem_#16434220]',
    secondary: 'bg-white text-[#144E35] border border-[#ebecef] hover:border-[#144E35]/40',
    dark:      'bg-[#144E35] text-white hover:bg-[#1d4a46]',
    ghost:     'text-[#144E35] hover:text-[#1C7A5B]',
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
            <div className="w-7 h-7 rounded-md bg-[#1C7A5B] flex items-center justify-center p-1"><img src="/vethubcore-mark-white.svg" alt="VetHub Core" className="w-full h-full object-contain" /></div>
            <span className={`font-black text-[15px] tracking-tight transition-colors ${onDark ? 'text-white' : 'text-[#144E35]'}`}>
              VetHub<span className="text-[#F2A41C]">Core</span>
            </span>
          </a>

          <div className={`hidden lg:flex items-center gap-7 text-[13px] font-semibold transition-colors ${onDark ? 'text-white/90' : 'text-[#144E35]'}`}>
            <a href="#modules" className="hover:text-[#1C7A5B] transition-colors">Platform</a>
            {/* Clinics / Suppliers nav hidden until we have real data to show */}
            {/* <a href="#clinics" className="hover:text-[#1C7A5B] transition-colors">Clinics</a> */}
            {/* <a href="#suppliers" className="hover:text-[#1C7A5B] transition-colors">Suppliers</a> */}
            <a href="#testimonials" className="hover:text-[#1C7A5B] transition-colors">Customers</a>
            <a href="#faq" className="hover:text-[#1C7A5B] transition-colors">FAQ</a>
            <button onClick={onPricing} className="hover:text-[#1C7A5B] transition-colors">Pricing</button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLogin}
              className={`hidden sm:inline-flex items-center h-10 px-5 rounded-full text-[13px] font-bold border transition-colors
                ${onDark ? 'border-white text-white hover:bg-white/10' : 'border-[#144E35] text-[#144E35] hover:bg-[#f6f7f8]'}`}
            >
              Log in
            </button>
            <Pill onClick={onRegister} variant="primary" className="hidden sm:inline-flex !h-10 !px-5 !py-0 !text-[13px]">
              Create account
            </Pill>
            <button
              onClick={() => setOpen(o => !o)}
              className={`lg:hidden p-2 transition-colors ${onDark ? 'text-white' : 'text-[#144E35]'}`}
              aria-label="menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden bg-white rounded-b-3xl px-4 pb-4 pt-2 flex flex-col gap-1 border-t border-[#ebecef]">
            <a href="#modules" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#144E35]">Platform</a>
            {/* Clinics / Suppliers nav hidden until we have real data to show */}
            {/* <a href="#clinics" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#144E35]">Clinics</a> */}
            {/* <a href="#suppliers" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#144E35]">Suppliers</a> */}
            <a href="#testimonials" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#144E35]">Customers</a>
            <a href="#faq" onClick={() => setOpen(false)} className="py-2 text-[15px] font-semibold text-[#144E35]">FAQ</a>
            <button onClick={() => { onPricing(); setOpen(false); }} className="py-2 text-[15px] font-semibold text-[#144E35] text-left">Pricing</button>
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
        className="absolute inset-0 bg-gradient-to-r from-[#144E35]/70 via-[#144E35]/25 to-transparent pointer-events-none"
      />

      {/* Decorative parallax device on the right (acts as the "lifestyle" subject) */}
      <motion.div
        style={{ y: deviceY }}
        className="hidden md:block absolute right-[-4%] top-[18%] w-[60%] lg:w-[52%] pointer-events-none opacity-90 drop-shadow-[0_2rem_3rem_rgba(0,0,0,0.5)]"
      >
        <img src={desktopImg} alt="" className="w-full select-none" draggable={false} />
      </motion.div>

      {/* Floating vet profile card — highest z-index, hovers above device + overlay */}
      {/* <motion.div
        style={{ y: deviceY, opacity: fadeOut }}
        className="hidden md:block absolute right-[6%] lg:right-[10%] top-[32%] z-30"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-[1.25rem] pl-2 pr-5 py-2 shadow-[0_1.25rem_2rem_rgba(0,0,0,0.35)] border border-white/60"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1C7A5B] to-[#144E35] text-white grid place-items-center font-black text-base leading-none">
            O
          </div>
          <div className="leading-tight">
            <p className="text-[14px] font-black text-[#144E35]">Dr. Otieno</p>
            <p className="text-[12px] font-semibold text-[#5c616d]">Small animals</p>
          </div>
        </motion.div>
      </motion.div> */}

      {/* Content */}
      <motion.div style={{ y: contentY, opacity: fadeOut }} className="relative z-10 h-full">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 h-full flex flex-col justify-center pt-36 pb-32">
          {/* Brand lockup — paw mark + VetHubCore wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex items-center gap-3 mb-6 md:mb-8"
          >
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur grid place-items-center shadow-lg p-2.5">
              <img src="/vethubcore-mark-white.svg" alt="VetHub Core" className="w-full h-full object-contain" />
            </div>
            <span className="text-3xl md:text-4xl font-black tracking-tight text-white">
              VetHub<span className="text-[#F2A41C]">Core</span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
            className="text-[32px] sm:text-[42px] md:text-[52px] lg:text-[60px] font-black tracking-tight text-white leading-[0.98] max-w-[15ch]"
          >
            The operating system for veterinary clinics.
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            className="mt-7 max-w-md"
          >
            <p className="text-white font-bold text-sm md:text-base tracking-wide">
              Every clinic · Every pet · Every team
            </p>
            <p className="mt-2 text-white/70 text-sm md:text-base leading-relaxed">
              Appointments, records, inventory, and billing — one connected platform with 24/7 support.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            className="mt-8 flex flex-col items-start gap-2.5"
          >
            <Pill onClick={onDemo} variant="primary" className="!px-9 !py-4 !text-[14px]">
              Start your 1-month free demo
            </Pill>
            <p className="text-white/60 text-[12px] font-semibold">
              Full access · No card required
            </p>
          </motion.div>

          {/* QR / app download card — hidden until the mobile app ships (no app yet).
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
            className="mt-7 inline-flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-[1.25rem] pl-2 pr-5 py-2 shadow-[0_1rem_2rem_rgba(0,0,0,0.25)] w-fit"
          >
            <div className="w-14 h-14 rounded-lg bg-white grid place-items-center border border-[#ebecef]">
              <QrCode size={40} strokeWidth={1.25} className="text-[#144E35]" />
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-black text-[#144E35]">Download now</p>
              <p className="text-[13px] font-bold text-[#1C7A5B]">VetHubCore app</p>
            </div>
          </motion.div>
          */}
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
          <span className="text-[13px] font-semibold">Loved by veterinary teams &mdash; rated five stars by clinics on VetHubCore</span>
        </div>
      </div>
    </section>
  );
};

// ── DRUM-ROLL NUMBER ── each digit spins from 0 to its target value as the stat enters view.
const RollingDigit: React.FC<{ digit: number; delay?: number; duration?: number }> = ({
  digit, delay = 0, duration = 1.4,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  return (
    <span
      ref={ref}
      className="inline-block overflow-hidden"
      style={{ height: '1em', lineHeight: 1, verticalAlign: 'baseline' }}
    >
      <motion.span
        className="block"
        initial={{ y: 0 }}
        animate={inView ? { y: `-${digit}em` } : { y: 0 }}
        transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ lineHeight: 1 }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="block" style={{ height: '1em', lineHeight: 1 }}>{i}</span>
        ))}
      </motion.span>
    </span>
  );
};

const RollingValue: React.FC<{ value: string; baseDelay?: number; duration?: number }> = ({
  value, baseDelay = 0, duration = 1.4,
}) => {
  let digitIndex = 0;
  return (
    <span className="inline-flex items-baseline tabular-nums" style={{ lineHeight: 1 }}>
      {value.split('').map((ch, i) => {
        if (/\d/.test(ch)) {
          const d = Number(ch);
          const delay = baseDelay + digitIndex * 0.08;
          digitIndex++;
          return <RollingDigit key={i} digit={d} delay={delay} duration={duration} />;
        }
        return (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.35, delay: baseDelay + duration * 0.75 }}
          >
            {ch}
          </motion.span>
        );
      })}
    </span>
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

const Award: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="flex items-center gap-3">
    <Laurel flipped />
    <div className="text-center max-w-[140px]">
      <p className="font-black text-[#144E35] text-[13px] leading-tight tracking-tight">{title}</p>
      <p className="text-[11px] text-[#5c616d] mt-1">{subtitle}</p>
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
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#144E35] leading-[1.05]">
          Run with confidence.
        </h2>
        <p className="mt-5 text-[#5c616d] text-base md:text-lg leading-relaxed">
          Built for veterinary teams who care about the details &mdash; reliable, secure, and ready when you are.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-10 lg:gap-14 items-center max-w-5xl mx-auto">

        {/* Left awards */}
        <div className="flex flex-col gap-10 items-center lg:items-end order-2 lg:order-1">
          <Award title="Built for veterinary teams"   subtitle="From front desk to exam room" />
          <Award title="Secure by default"            subtitle="Encrypted in transit and at rest" />
        </div>

        {/* Center card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
          className="order-1 lg:order-2 bg-[#f6f7f8] rounded-[1.5rem] py-12 px-10 md:px-14 md:py-16 text-center min-w-[280px]"
        >
          <p className="text-4xl md:text-5xl font-black text-[#c8c8c8] tracking-tight leading-none">
            One platform
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#787d88] mt-2">For every clinic</p>

          <p className="text-6xl md:text-7xl lg:text-[96px] font-black text-[#144E35] tracking-tight leading-none mt-10">
            24/7
          </p>
          <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#5c616d] mt-3">Support &amp; uptime</p>

          <p className="text-4xl md:text-5xl font-black text-[#c8c8c8] tracking-tight leading-none mt-10">
            Always-on
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#787d88] mt-2">Web · Tablet · Mobile</p>
        </motion.div>

        {/* Right awards */}
        <div className="flex flex-col gap-10 items-center lg:items-start order-3">
          <Award title="Designed for scale"           subtitle="Single clinic to multi-site groups" />
          <Award title="Friendly customer support"    subtitle="Real people, real answers" />
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
              <div className="w-12 h-12 rounded-xl bg-[#1C7A5B] text-white flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
                <m.icon size={22} />
              </div>
              <h3 className="text-xl font-black text-[#144E35] mb-2 tracking-tight">{m.title}</h3>
              <p className="text-[#5c616d] text-[15px] leading-relaxed">{m.desc}</p>
              <div className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1C7A5B] opacity-0 group-hover:opacity-100 transition-opacity">
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
          sub="From the front desk to the exam room to house visits — VetHubCore adapts to how your team already works."
        />
        <div className="mt-10 space-y-5">
          {[
            { icon: Monitor,    title: 'Desktop',  desc: 'Full dashboard for reception and administration.' },
            { icon: Tablet,     title: 'Tablet',   desc: 'Ideal for exam rooms and on-the-spot clinical notes.' },
            { icon: Smartphone, title: 'Mobile',   desc: 'Stay connected anywhere, anytime, from the field.' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-white border border-[#ebecef] flex items-center justify-center shrink-0">
                <item.icon size={20} className="text-[#1C7A5B]" />
              </div>
              <div>
                <h4 className="font-black text-[#144E35] text-[17px] tracking-tight">{item.title}</h4>
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
          <img src={desktopImg} alt="VetHubCore on Desktop" className="w-full rounded-2xl select-none" draggable={false} />
        </div>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-6 -left-8 w-[42%] z-20 drop-shadow-[0_1.5rem_2rem_rgba(24,28,37,0.18)]"
        >
          <img src={tabletImg} alt="VetHubCore on Tablet" className="w-full rounded-2xl select-none" draggable={false} />
        </motion.div>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-10 -right-4 w-[22%] z-30 drop-shadow-[0_1.5rem_2rem_rgba(24,28,37,0.2)]"
        >
          <img src={mobileImg} alt="VetHubCore on Mobile" className="w-full rounded-2xl select-none" draggable={false} />
        </motion.div>
        <div className="h-20" />
      </motion.div>
    </div>
  </section>
);

// ── INTEGRATIONS STRIP ───────────────────────────────────────────────────────
const Integrations: React.FC = () => {
  const categories = [
    { label: 'Mobile money', icon: CreditCard },
    { label: 'Card payments', icon: CreditCard },
    { label: 'Accounting',   icon: BarChart3  },
    { label: 'Messaging',    icon: Bell       },
    { label: 'Lab systems',  icon: Stethoscope},
    { label: 'Web & email',  icon: Globe      },
  ];
  return (
    <section className="py-20 bg-white border-y border-[#ebecef]">
      <div className="max-w-[1280px] mx-auto px-6">
        <p className="text-center text-[12px] font-bold uppercase tracking-[0.2em] text-[#787d88] mb-10">
          Connects to the tools your clinic already uses
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-8 items-center">
          {categories.map((p, i) => (
            <div key={i} className="flex items-center justify-center gap-2 text-[#5c616d] hover:text-[#144E35] transition-colors">
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
  const clinicTypes = [
    { title: 'Small-animal clinics',    desc: 'Routine care, vaccinations, and wellness visits for cats and dogs.',     specialty: 'Small animals' },
    { title: 'Multi-site groups',       desc: 'Run several branches from one dashboard with shared records and billing.', specialty: 'Multi-branch'  },
    { title: 'Mobile & house-call vets', desc: 'Take your practice on the road with offline-friendly mobile tools.',      specialty: 'Mobile'        },
    { title: 'Surgical & specialist',   desc: 'Plan theatre lists, anaesthetics, and post-op care in one workflow.',     specialty: 'Surgery'       },
    { title: 'Equine & large animal',   desc: 'Field visits, herd records, and bulk medication tracking made simple.',    specialty: 'Large animals' },
    { title: 'Emergency & after-hours', desc: 'Fast triage, on-call rotas, and rapid invoicing for urgent care.',         specialty: 'Emergency'     },
  ];
  return (
    <section id="clinics" className="py-24 md:py-32 bg-white">
      <div className="max-w-[1280px] mx-auto px-6">
        <SectionHeading
          eyebrow="Built for every clinic"
          title={<>One platform, many practices.</>}
          sub="From a single-vet practice to a multi-branch group, VetHubCore adapts to how your team already works."
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinicTypes.map((c, i) => (
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
                <div className="w-11 h-11 rounded-xl bg-[#1C7A5B]/10 text-[#1C7A5B] flex items-center justify-center shrink-0">
                  <Stethoscope size={20} />
                </div>
              </div>
              <h4 className="font-black text-[#144E35] text-[17px] tracking-tight">{c.title}</h4>
              <p className="text-[#5c616d] text-[13px] mt-2 leading-relaxed">{c.desc}</p>
              <div className="flex items-center justify-between pt-5 mt-5 border-t border-[#ebecef]">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1C7A5B] bg-[#1C7A5B]/10 px-2.5 py-1 rounded-full">{c.specialty}</span>
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
  const supplierCategories = [
    { category: 'Pharmaceuticals', desc: 'Source prescription medicines from approved manufacturers and distributors.' },
    { category: 'Consumables',     desc: 'Gloves, syringes, dressings &mdash; the everyday essentials, restocked on time.' },
    { category: 'Equipment',       desc: 'Imaging, anaesthesia, dental, and theatre equipment from trusted vendors.'    },
    { category: 'Vaccines',        desc: 'Cold-chain vaccines tracked from order to administration.'                    },
    { category: 'Lab reagents',    desc: 'In-house diagnostics, reagents, and consumables for your lab.'                },
    { category: 'Surgical tools',  desc: 'Instruments, suture, and surgical kit for routine and specialist procedures.' },
  ];
  return (
    <section id="suppliers" className="py-24 md:py-32 bg-[#f6f7f8]">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <SectionHeading
            eyebrow="Marketplace"
            title={<>Powered by verified suppliers.</>}
            sub="Order medicines, equipment, and consumables from vetted partners &mdash; delivered to your clinic."
          />
          {onSupplierSignup && (
            <Pill onClick={onSupplierSignup} variant="dark">
              Join as supplier <ArrowRight size={15} />
            </Pill>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplierCategories.map((s, i) => (
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
                <div className="w-11 h-11 rounded-xl bg-[#144E35]/5 text-[#144E35] flex items-center justify-center shrink-0">
                  <Truck size={20} />
                </div>
                <div className="flex items-center gap-1 text-[#00bb86] text-[10px] font-bold">
                  <BadgeCheck size={14} />
                  <span>Verified</span>
                </div>
              </div>
              <h4 className="font-black text-[#144E35] text-[17px] tracking-tight">{s.category}</h4>
              <p className="text-[#5c616d] text-[13px] mt-2 leading-relaxed">{s.desc}</p>
              <div className="flex items-center justify-between pt-5 mt-5 border-t border-[#ebecef]">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1C7A5B] bg-[#1C7A5B]/10 px-2.5 py-1 rounded-full">Marketplace</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── COMMUNITY HINT ───────────────────────────────────────────────────────────
// Stand-in for the Clinics + Suppliers showcase sections until real data is
// available. Warm, generic copy — no counts, no logos, no names.
const CommunityHint: React.FC = () => (
  <section className="py-24 md:py-32 bg-[#f6f7f8]">
    <div className="max-w-[1100px] mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <Eyebrow>A growing community</Eyebrow>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#144E35] leading-[1.05]">
          So many clinics. So many suppliers.<br />
          <span className="text-[#5c616d]">All in one place.</span>
        </h2>
        <p className="mt-6 text-[#5c616d] text-lg leading-relaxed max-w-2xl mx-auto">
          Veterinary teams and the suppliers who serve them are quietly making
          VetHubCore part of how they work every day. Come join them.
        </p>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { label: 'Clinics',   sub: 'Joining every week' },
            { label: 'Suppliers', sub: 'Onboarding now'     },
            { label: 'Branches',  sub: 'Connected daily'    },
            { label: 'Visits',    sub: 'Managed end-to-end' },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: EASE, delay: i * 0.06 }}
              className="bg-white rounded-2xl border border-[#ebecef] py-7 px-5"
            >
              <p className="text-2xl md:text-3xl font-black text-[#144E35] tracking-tight">Many</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1C7A5B] mt-2">{s.label}</p>
              <p className="text-[12px] text-[#787d88] mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// ── TESTIMONIALS ─────────────────────────────────────────────────────────────
const Testimonials: React.FC = () => {
  const quotes = [
    {
      quote: 'A practice management system that gets out of the way and lets your team focus on the animals in front of them.',
      role:  'Designed for lead veterinarians',
    },
    {
      quote: 'Inventory, batches, and reorder points handled in the background so you stop running out of vaccines and consumables.',
      role:  'Built for clinic operations',
    },
    {
      quote: 'Open a new branch, add staff, migrate clients &mdash; without rebuilding your workflow from scratch.',
      role:  'Made for growing multi-site groups',
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
              <blockquote className="text-[#144E35] text-[17px] leading-relaxed font-medium flex-1">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 pt-6 border-t border-[#ebecef]">
                <p className="font-black text-[#144E35] text-[13px] tracking-tight">{q.role}</p>
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
    <section className="py-24 md:py-32 bg-[#144E35] text-white">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="max-w-3xl">
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#1C7A5B] mb-4">Getting started</span>
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
              <div className="text-[11px] font-black tracking-[0.2em] text-[#1C7A5B]">{s.n}</div>
              <h4 className="mt-5 text-xl font-black tracking-tight">{s.title}</h4>
              <p className="mt-2 text-white/60 text-[14px] leading-relaxed">{s.desc}</p>
              {s.n === '02' && (
                <button
                  onClick={() => downloadTemplate(CLIENT_SCHEMA)}
                  className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#1C7A5B] hover:text-white transition-colors"
                >
                  <Download size={13} />
                  Download sample template
                </button>
              )}
            </motion.div>
          ))}
        </div>
        <div className="mt-12">
          <Pill onClick={onRegister} variant="primary">
            Start your clinic on VetHubCore <ArrowRight size={16} />
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
    { q: 'Can VetHubCore handle multiple branches?', a: 'Yes. Manage any number of branches from one dashboard with per-branch staff, inventory, pricing, and reports.' },
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
                className="w-full text-left py-6 flex gap-6 items-start transition-colors hover:text-[#1C7A5B]"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-[17px] md:text-[19px] font-black text-[#144E35] tracking-tight">{f.q}</h4>
                    <span className="shrink-0 w-9 h-9 rounded-full bg-[#f6f7f8] flex items-center justify-center">
                      {isOpen ? <Minus size={16} className="text-[#144E35]" /> : <Plus size={16} className="text-[#144E35]" />}
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
  <section className="bg-[#144E35] text-white py-28 md:py-36 overflow-hidden">
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
        Create a free VetHubCore account or try the demo clinic. No card required.
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
          <div className="w-8 h-8 rounded-lg bg-[#1C7A5B] flex items-center justify-center p-1.5"><img src="/vethubcore-mark-white.svg" alt="VetHub Core" className="w-full h-full object-contain" /></div>
          <span className="font-black text-white text-[17px] tracking-tight">VetHub<span className="text-[#F2A41C]">Core</span></span>
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
      <p className="text-[13px]">© {new Date().getFullYear()} VetHubCore Enterprise. All rights reserved.</p>
      <div className="flex gap-6 text-[13px]">
        <a href="#" className="hover:text-white transition-colors">Privacy</a>
        <a href="#" className="hover:text-white transition-colors">Terms</a>
        <a href="#" className="hover:text-white transition-colors">Security</a>
      </div>
    </div>
  </footer>
);

// ── Partners (admin-tiered clinics) ──────────────────────────────────────────
const Partners: React.FC = () => {
  const [clinics, setClinics] = useState<FeaturedClinic[]>([]);
  useEffect(() => {
    partnerTypeAPI.featuredClinics(12)
      .then((r) => { if (r.success && r.data?.clinics) setClinics(r.data.clinics); })
      .catch(() => {});
  }, []);
  // Render nothing until at least one tiered, verified clinic exists.
  if (clinics.length === 0) return null;
  return (
    <section id="partners" className="py-24 md:py-32 bg-[#f6f7f8]">
      <div className="max-w-[1280px] mx-auto px-6">
        <SectionHeading
          eyebrow="Partners"
          title={<>Trusted clinics on VetHubCore.</>}
          sub="Featured veterinary practices running their whole day-to-day on VetHubCore."
        />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {clinics.map((c) => (
            <div key={c.id} className="rounded-2xl border border-[#ebecef] bg-white p-5 flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-[#144E35] flex items-center justify-center text-2xl overflow-hidden shrink-0">
                {c.logo && c.logo.startsWith('http')
                  ? <img src={c.logo} alt="" className="w-full h-full object-cover" />
                  : <span>{c.logo || '🐾'}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-[#144E35] truncate">{c.name}</h3>
                  {c.tier && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white whitespace-nowrap" style={{ backgroundColor: c.tier.color || '#1C7A5B' }}>
                      {c.tier.name}
                    </span>
                  )}
                </div>
                {c.slogan && <p className="text-[13px] text-[#5c616d] truncate">{c.slogan}</p>}
                <p className="text-[12px] text-[#9aa0ac] mt-0.5">
                  {[c.city, c.rating > 0 ? `★ ${c.rating.toFixed(1)}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── PAGE ─────────────────────────────────────────────────────────────────────
export default function LandingPage({ onLogin, onRegister, onDemo, onPricing, onSupplierSignup }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-[#144E35] antialiased">
      <Nav onLogin={onLogin} onRegister={onRegister} onPricing={onPricing} />
      <Hero onRegister={onRegister} onDemo={onDemo} />
      <TrustConfidence />
      <Modules />
      <Platforms />
      <Integrations />
      {/* Real-data Clinics + Suppliers showcases hidden until we have data.
          Re-enable by uncommenting these and restoring the #clinics /
          #suppliers nav links above. The component definitions are kept
          intact further up in this file. */}
      {/* <Clinics /> */}
      {/* <Suppliers onSupplierSignup={onSupplierSignup} /> */}
      <Partners />
      <CommunityHint />
      <Testimonials />
      <Steps onRegister={onRegister} />
      <FAQ />
      <FooterCTA onRegister={onRegister} onDemo={onDemo} onPricing={onPricing} />
      <Footer />
    </div>
  );
}
