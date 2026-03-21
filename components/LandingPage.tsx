import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import desktopImg from '../assets/device-desktop.png';
import tabletImg  from '../assets/device-tablet.png';
import mobileImg  from '../assets/device-mobile.png';
import {
  Building2, Calendar, Package,
  BarChart3, Users, ArrowRight, Check,
  Smartphone, Monitor, Tablet,
  Star, HeartPulse, Stethoscope, Syringe,
  ShieldCheck, MapPin, Truck, BadgeCheck
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
  onDemo: () => void;
  onPricing: () => void;
}

// ── Organic blob shapes (SVG) ──────────────────────────────────────────────
const BlobYellow = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 400 400" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M320.5 60.6C355.1 92.2 376.3 139.3 368.6 182.4C360.9 225.5 324.3 264.6 283.7 289.4C243.1 314.2 198.5 324.7 158.1 312.1C117.7 299.5 81.5 263.8 62.8 221.8C44.1 179.8 43 131.6 61.7 96.5C80.4 61.4 118.9 39.4 158.4 26.9C197.9 14.4 238.4 11.4 270.1 25.6C301.8 39.8 320.5 60.6 320.5 60.6Z"
      fill="currentColor"
    />
  </svg>
);

const BlobLavender = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 500 500" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M421.4 175.5C448.7 218.4 453.2 276.2 432.6 320.8C412 365.4 366.3 396.8 318.4 414.7C270.5 432.6 220.4 437 172.5 419.2C124.6 401.4 78.9 361.4 55.6 311.4C32.3 261.4 31.4 201.4 53.7 153.8C76 106.2 121.5 71 169.4 53.6C217.3 36.2 267.6 36.6 313.5 55.6C359.4 74.6 394.1 132.6 421.4 175.5Z"
      fill="currentColor"
    />
  </svg>
);

const BlobTeal = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 450 450" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M380.2 112.4C409.8 153.8 415.5 213.4 397.8 261.9C380.1 310.4 339 347.8 294.5 370.7C250 393.6 202.1 402 156.4 388.8C110.7 375.6 67.2 340.8 45.5 295.2C23.8 249.6 23.9 193.2 46.2 148.6C68.5 104 113 71.2 159.3 54.6C205.6 38 253.7 37.6 296.2 55.8C338.7 74 350.6 71 380.2 112.4Z"
      fill="currentColor"
    />
  </svg>
);

// ── Curvy SVG wave divider ─────────────────────────────────────────────────
const WaveDivider = ({ flip = false, fill = '#f0fdf9', bg = 'white' }: { flip?: boolean; fill?: string; bg?: string }) => (
  <div className="relative w-full overflow-hidden" style={{ height: 80, background: bg }}>
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full ${flip ? 'scale-y-[-1]' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1350,20 1440,40 L1440,80 L0,80 Z"
        fill={fill}
      />
    </svg>
  </div>
);

// ── Feature card ───────────────────────────────────────────────────────────
const FeatureCard = ({ icon: Icon, title, desc, color }: { icon: any; title: string; desc: string; color: string }) => (
  <motion.div
    whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(67,136,131,0.12)' }}
    className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col gap-4"
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color}`}>
      <Icon size={26} />
    </div>
    <div>
      <h3 className="text-lg font-black text-[#163C39] tracking-tight mb-2">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

export default function LandingPage({ onLogin, onRegister, onDemo, onPricing }: LandingPageProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();

  // Parallax transforms for blobs at different depths
  const blobYellowY  = useTransform(scrollY, [0, 600], [0, -120]);
  const blobLavY     = useTransform(scrollY, [0, 600], [0,  -60]);
  const blobTealY    = useTransform(scrollY, [0, 600], [0,  -90]);
  const heroTextY    = useTransform(scrollY, [0, 600], [0,  -40]);
  const heroCardY    = useTransform(scrollY, [0, 600], [0,   30]);

  useEffect(() => {
    const handle = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handle);
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-white text-[#163C39] font-sans overflow-x-hidden">

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#438883] flex items-center justify-center shadow-md text-lg leading-none">
              🐾
            </div>
            <span className="font-black text-xl tracking-tight text-[#163C39]">Vet<span className="text-[#438883]">Hub</span></span>
          </div>

          <div className="hidden md:flex items-center gap-10 text-xs font-bold uppercase tracking-widest text-slate-500">
            <a href="#features" className="hover:text-[#438883] transition-colors">Features</a>
            <a href="#stats"    className="hover:text-[#438883] transition-colors">Growth</a>
            <button onClick={onPricing} className="hover:text-[#438883] transition-colors">Pricing</button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="login-glow-ring hidden sm:block text-xs font-bold uppercase tracking-widest text-[#163C39] hover:text-[#438883] transition-colors px-4 py-2 rounded-full"
            >
              Login
            </button>
            <button onClick={onRegister} className="bg-[#438883] text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#163C39] transition-colors shadow-md shadow-[#438883]/20">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#f7fbfb]">

        {/* Blob — Yellow (top right) */}
        <motion.div style={{ y: blobYellowY }} className="absolute -top-20 -right-20 w-[480px] h-[480px] pointer-events-none z-0">
          <BlobYellow className="w-full h-full text-[#fef08a]" />
        </motion.div>

        {/* Blob — Lavender (bottom left) */}
        <motion.div style={{ y: blobLavY }} className="absolute -bottom-32 -left-32 w-[520px] h-[520px] pointer-events-none z-0">
          <BlobLavender className="w-full h-full text-[#c4b5fd]/60" />
        </motion.div>

        {/* Blob — Teal (bottom right) */}
        <motion.div style={{ y: blobTealY }} className="absolute bottom-0 right-0 w-[340px] h-[340px] pointer-events-none z-0 opacity-50">
          <BlobTeal className="w-full h-full text-[#a7f3d0]" />
        </motion.div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full pt-24 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — Clinic visual card */}
            <motion.div
              style={{ y: heroCardY }}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="relative order-2 lg:order-1"
            >
              {/* Main card */}
              <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-[#163C39] to-[#438883] aspect-[4/3] shadow-2xl shadow-[#163C39]/20">
                {/* Abstract clinic scene */}
                <div className="absolute inset-0 opacity-10">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full bg-white"
                      style={{
                        width: `${60 + i * 30}px`,
                        height: `${60 + i * 30}px`,
                        top: `${10 + i * 12}%`,
                        left: `${5 + i * 15}%`,
                        opacity: 0.3 + i * 0.05,
                      }}
                    />
                  ))}
                </div>

                {/* Vet icons overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-10">
                  <div className="flex gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <Stethoscope size={36} className="text-white" />
                    </div>
                    <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <HeartPulse size={36} className="text-white" />
                    </div>
                    <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <Syringe size={36} className="text-white" />
                    </div>
                  </div>
                  <div className="w-24 h-24 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border-4 border-white/40 shadow-2xl text-5xl leading-none">
                    🐾
                  </div>
                  <p className="text-white/70 text-sm font-semibold uppercase tracking-widest">Veterinary Care Platform</p>
                </div>
              </div>

              {/* Floating stat cards */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -right-6 top-8 bg-white rounded-2xl shadow-xl shadow-[#163C39]/10 p-4 border border-slate-100 min-w-[160px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <Check size={18} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Today's Visits</p>
                    <p className="text-xl font-black text-[#163C39]">24</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -left-6 bottom-12 bg-white rounded-2xl shadow-xl shadow-[#163C39]/10 p-4 border border-slate-100 min-w-[170px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#438883]/10 flex items-center justify-center">
                    <Star size={18} className="text-[#438883]" fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Avg Rating</p>
                    <p className="text-xl font-black text-[#163C39]">4.9 / 5.0</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right — Copy */}
            <motion.div
              style={{ y: heroTextY }}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
              className="order-1 lg:order-2"
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.92] mb-6 text-[#163C39]">
                Sharing the<br />
                care with<br />
                <span className="text-[#438883]">compassion.</span>
              </h1>

              <p className="text-slate-500 text-lg mb-8 leading-relaxed max-w-md">
                At <strong className="text-[#163C39]">VetHub</strong> our mission is to treat your practice and your patients with the utmost efficiency and love.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  onClick={onRegister}
                  className="flex items-center justify-center gap-2 bg-[#438883] text-white px-8 py-4 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-[#163C39] transition-colors shadow-lg shadow-[#438883]/25 group"
                >
                  Request Appointment <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={onDemo}
                  className="flex items-center justify-center gap-2 border-2 border-[#438883]/30 text-[#438883] px-8 py-4 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-[#438883]/5 transition-colors"
                >
                  Try Demo
                </button>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {['#438883', '#163C39', '#2EA1B8', '#5ba3a0'].map((color, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-xs shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      {['D','K','A','M'][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5 text-amber-400 mb-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} size={13} fill="currentColor" />)}
                  </div>
                  <span className="text-slate-400 text-sm">Trusted by 2,000+ clinics</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── WAVE DIVIDER ───────────────────────────────────────────────────── */}
      <WaveDivider fill="#f0fdf9" bg="#f7fbfb" />

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 bg-[#f0fdf9]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block text-[#438883] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#438883]/10 px-4 py-1.5 rounded-full">Everything you need</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#163C39] mb-4">Nothing you don't.</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">A comprehensive suite built specifically for veterinary professionals.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Building2, title: 'Multi-Clinic', desc: 'Manage all your branches from one dashboard — staff, inventory, records.', color: 'bg-[#438883]/10 text-[#438883]' },
              { icon: Calendar,  title: 'Smart Scheduling', desc: 'Drag-and-drop calendar with conflict detection and automated reminders.', color: 'bg-blue-50 text-blue-500' },
              { icon: Package,   title: 'Inventory Control', desc: 'Track stock, set reorder points, manage batches and expiry dates.', color: 'bg-[#163C39]/10 text-[#163C39]' },
              { icon: Users,     title: 'Client Portal', desc: 'Pet owners can view records, book visits, and message your team.', color: 'bg-purple-50 text-purple-500' },
              { icon: BarChart3, title: 'Analytics', desc: 'Real-time insights into revenue, staff efficiency, and appointments.', color: 'bg-amber-50 text-amber-500' },
              { icon: ShieldCheck, title: 'Security', desc: 'Enterprise-grade access control with role-based permissions.', color: 'bg-green-50 text-green-500' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <FeatureCard {...f} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAVE DIVIDER ───────────────────────────────────────────────────── */}
      <WaveDivider flip fill="#f0fdf9" bg="white" />

      {/* ── DEVICES ────────────────────────────────────────────────────────── */}
      <section className="py-28 bg-white overflow-hidden relative">
        {/* Decorative blob */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 pointer-events-none opacity-30">
          <BlobTeal className="w-full h-full text-[#438883]/30" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-block text-[#438883] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#438883]/10 px-4 py-1.5 rounded-full">Responsive</span>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#163C39] mb-6">Works on every device</h2>
              <p className="text-slate-500 text-lg mb-10 leading-relaxed">From the front desk to the exam room to the field — VetHub adapts.</p>
              <div className="space-y-6">
                {[
                  { icon: Monitor,    title: 'Desktop',    desc: 'Full dashboard for reception and administration.' },
                  { icon: Tablet,     title: 'Tablet',     desc: 'Ideal for exam rooms and on-the-spot notes.' },
                  { icon: Smartphone, title: 'Mobile',     desc: 'Stay connected anywhere, anytime.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-[#f0fdf9] border border-[#438883]/10 flex items-center justify-center shrink-0 group-hover:bg-[#438883]/10 transition-colors">
                      <item.icon size={22} className="text-[#438883]" />
                    </div>
                    <div>
                      <h4 className="font-black text-[#163C39] mb-0.5">{item.title}</h4>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Real device screenshots */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9 }}
              className="relative select-none"
            >
              {/* Desktop — MacBook (back, largest) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="relative z-10 drop-shadow-2xl"
              >
                <img
                  src={desktopImg}
                  alt="VetHub on Desktop"
                  className="w-full rounded-2xl"
                  draggable={false}
                />
              </motion.div>

              {/* Tablet — iPad (overlapping bottom-left) */}
              <motion.div
                initial={{ opacity: 0, x: -30, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.25 }}
                animate={{ y: [0, -8, 0] }}
                className="absolute -bottom-6 -left-8 w-[42%] z-20 drop-shadow-2xl"
              >
                <img
                  src={tabletImg}
                  alt="VetHub on Tablet"
                  className="w-full rounded-2xl"
                  draggable={false}
                />
              </motion.div>

              {/* Mobile — iPhone (overlapping bottom-right) */}
              <motion.div
                initial={{ opacity: 0, x: 30, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.4 }}
                animate={{ y: [0, 8, 0] }}
                className="absolute -bottom-10 -right-4 w-[24%] z-30 drop-shadow-2xl"
              >
                <img
                  src={mobileImg}
                  alt="VetHub on Mobile"
                  className="w-full rounded-2xl"
                  draggable={false}
                />
              </motion.div>

              {/* Bottom padding so overlapping devices aren't clipped */}
              <div className="h-24" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── WAVE DIVIDER ───────────────────────────────────────────────────── */}
      <WaveDivider fill="white" bg="#f7fbfb" />

      {/* ── STATS TIMELINE ─────────────────────────────────────────────────── */}
      <section id="stats" className="py-28 bg-[#f7fbfb] relative overflow-hidden">
        {/* Parallax blob */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          style={{ y: useTransform(scrollY, [400, 1400], [60, -60]) }}
          className="absolute left-0 top-1/4 w-80 h-80 pointer-events-none opacity-40"
        >
          <BlobLavender className="w-full h-full text-[#c4b5fd]/50" />
        </motion.div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <span className="inline-block text-[#438883] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#438883]/10 px-4 py-1.5 rounded-full">Growth</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#163C39] mb-4">Proven results</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">How clinics scale in their first year with VetHub.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { month: 'Month 1',  title: 'Onboarding',         desc: 'Migrate data, train staff, configure your clinic profile.', stat: '100%', label: 'Data Migrated' },
              { month: 'Month 3',  title: 'Efficiency Gains',   desc: 'Automation saves hours of manual scheduling and billing.',   stat: '15h',  label: 'Saved / Week' },
              { month: 'Month 6',  title: 'Client Growth',      desc: 'Patient portals and reminders drive return visits.',          stat: '+24%', label: 'Return Rate' },
              { month: 'Month 12', title: 'Enterprise Scaling', desc: 'Open new branches, managed from one dashboard.',              stat: '3×',   label: 'Growth Potential' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-3xl p-8 border border-slate-100 shadow-md flex flex-col"
              >
                <span className="text-[#438883] font-bold text-[10px] uppercase tracking-widest block mb-3">{item.month}</span>
                <h4 className="text-xl font-black text-[#163C39] mb-2">{item.title}</h4>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed flex-1">{item.desc}</p>
                <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                  <span className="text-4xl font-black text-[#438883]">{item.stat}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAVE DIVIDER ───────────────────────────────────────────────────── */}
      <WaveDivider fill="#f7fbfb" bg="white" />

      {/* ── FEATURED CLINICS ───────────────────────────────────────────────── */}
      <section className="py-28 bg-white relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 pointer-events-none opacity-15">
          <BlobYellow className="w-full h-full text-[#fef08a]" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-14"
          >
            <span className="inline-block text-[#438883] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#438883]/10 px-4 py-1.5 rounded-full">Featured Clinics</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#163C39] mb-4">Trusted by the best.</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Veterinary practices around the region using VetHub every day.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Nairobi Animal Hospital', city: 'Nairobi, Kenya',    rating: 4.9, visits: '1,240', specialty: 'Small Animals', color: 'bg-[#438883]/10 text-[#438883]' },
              { name: 'Cape Vet Centre',          city: 'Cape Town, SA',     rating: 4.8, visits: '980',   specialty: 'Exotic Pets',   color: 'bg-blue-50 text-blue-500' },
              { name: 'Kampala Pet Clinic',       city: 'Kampala, Uganda',   rating: 4.7, visits: '760',   specialty: 'Large Animals', color: 'bg-purple-50 text-purple-500' },
              { name: 'Dar es Salaam Vets',       city: 'Dar es Salaam, TZ', rating: 4.9, visits: '1,100', specialty: 'Surgery',       color: 'bg-amber-50 text-amber-500' },
              { name: 'Kigali Animal Care',       city: 'Kigali, Rwanda',    rating: 4.8, visits: '640',   specialty: 'Dentistry',     color: 'bg-green-50 text-green-500' },
              { name: 'Lagos Vet Hospital',       city: 'Lagos, Nigeria',    rating: 4.7, visits: '2,050', specialty: 'Emergency',     color: 'bg-rose-50 text-rose-500' },
            ].map((clinic, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(67,136,131,0.10)' }}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${clinic.color}`}>
                    <Stethoscope size={22} />
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 shrink-0 mt-1">
                    {[1,2,3,4,5].map(s => <Star key={s} size={11} fill="currentColor" />)}
                    <span className="text-[11px] font-bold text-slate-500 ml-1">{clinic.rating}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-black text-[#163C39] text-base tracking-tight">{clinic.name}</h4>
                  <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                    <MapPin size={11} />
                    <span>{clinic.city}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#438883] bg-[#438883]/8 px-2.5 py-1 rounded-full">{clinic.specialty}</span>
                  <span className="text-[11px] font-bold text-slate-400">{clinic.visits} visits</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAVE DIVIDER ───────────────────────────────────────────────────── */}
      <WaveDivider fill="white" bg="#f0fdf9" />

      {/* ── FEATURED SUPPLIERS ─────────────────────────────────────────────── */}
      <section className="py-28 bg-[#f0fdf9] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 pointer-events-none opacity-20">
          <BlobTeal className="w-full h-full text-[#438883]/30" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-14"
          >
            <span className="inline-block text-[#438883] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#438883]/10 px-4 py-1.5 rounded-full">Featured Suppliers</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#163C39] mb-4">Powered by great partners.</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Verified suppliers delivering medicines, equipment, and consumables to clinics on VetHub.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'MedVet Supplies',     category: 'Pharmaceuticals',  location: 'Nairobi, Kenya',  products: 340, verified: true, color: 'bg-[#163C39]/10 text-[#163C39]' },
              { name: 'PetCare Distributors',category: 'Consumables',      location: 'Lagos, Nigeria',  products: 215, verified: true, color: 'bg-[#438883]/10 text-[#438883]' },
              { name: 'VetEquip Africa',     category: 'Equipment',        location: 'Cape Town, SA',   products: 128, verified: true, color: 'bg-blue-50 text-blue-500' },
              { name: 'AniPharm Ltd',        category: 'Vaccines',         location: 'Kampala, Uganda', products: 90,  verified: true, color: 'bg-green-50 text-green-500' },
              { name: 'ClinicPlus Supplies', category: 'Lab Reagents',     location: 'Kigali, Rwanda',  products: 175, verified: false, color: 'bg-amber-50 text-amber-500' },
              { name: 'SurgiVet Co.',        category: 'Surgical Tools',   location: 'Accra, Ghana',    products: 260, verified: true, color: 'bg-purple-50 text-purple-500' },
            ].map((supplier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(67,136,131,0.10)' }}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${supplier.color}`}>
                    <Truck size={22} />
                  </div>
                  {supplier.verified && (
                    <div className="flex items-center gap-1 text-[#438883] text-[10px] font-bold shrink-0 mt-1">
                      <BadgeCheck size={14} />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-black text-[#163C39] text-base tracking-tight">{supplier.name}</h4>
                  <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                    <MapPin size={11} />
                    <span>{supplier.location}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#438883] bg-[#438883]/8 px-2.5 py-1 rounded-full">{supplier.category}</span>
                  <span className="text-[11px] font-bold text-slate-400">{supplier.products} products</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAVE DIVIDER ───────────────────────────────────────────────────── */}
      <WaveDivider fill="#f0fdf9" bg="white" />

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 bg-[#f0fdf9]" />
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] pointer-events-none opacity-60">
          <BlobLavender className="w-full h-full text-[#c4b5fd]/40" />
        </div>
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] pointer-events-none opacity-60">
          <BlobYellow className="w-full h-full text-[#fef08a]/60" />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="text-5xl text-center mb-6 opacity-60">🐾</div>
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-[#163C39] mb-6">Ready to transform<br />your practice?</h2>
            <p className="text-slate-500 text-xl mb-10 max-w-xl mx-auto">Join thousands of veterinary professionals who trust VetHub.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={onRegister} className="w-full sm:w-auto bg-[#163C39] text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#438883] transition-colors shadow-xl shadow-[#163C39]/20">
                Create Real Account
              </button>
              <button onClick={onDemo} className="w-full sm:w-auto border-2 border-[#438883]/30 text-[#438883] px-10 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#438883]/5 transition-colors">
                Try Test Account
              </button>
              <button onClick={onPricing} className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-500 hover:text-[#163C39] font-bold text-sm transition-colors">
                View Pricing <ArrowRight size={15} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#163C39] text-white/50 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#438883] flex items-center justify-center text-base leading-none">
              🐾
            </div>
            <span className="font-black text-white tracking-tight">Vet<span className="text-[#438883]">Hub</span></span>
          </div>
          <div className="flex gap-8 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} VetHub Enterprise. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
