import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowLeft, Loader2 } from 'lucide-react';
import { subscriptionPackagesAPI, type SubscriptionPackagePlan } from '../../../services/modules/subscriptionPackages.api';

interface PricingPageProps {
  onBack: () => void;
  onRegister: () => void;
}

// Display currency as a symbol when we know one, otherwise fall back to the
// ISO code. Prices are whatever the back office configured — no country /
// region adjustment happens here.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', KES: 'KSh', NGN: '₦', ZAR: 'R', INR: '₹',
};

const formatPrice = (amount: number, currency: string) => {
  const sym = CURRENCY_SYMBOLS[currency?.toUpperCase()];
  const value = Number(amount || 0).toLocaleString('en-US');
  return sym ? `${sym}${value}` : `${currency} ${value}`;
};

// BO `features` may include catalog identifiers (e.g. "view:dashboard",
// "service:medical-records"). Those are internal access flags — hide them from
// the marketing card and only show human-readable bullet copy.
const displayFeatures = (features: string[] = []) => features.filter(f => !f.includes(':'));

export default function PricingPage({ onBack, onRegister }: PricingPageProps) {
  const [packages, setPackages] = useState<SubscriptionPackagePlan[]>([]);
  const [currentPackageId, setCurrentPackageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await subscriptionPackagesAPI.list();
        if (cancelled) return;
        if (res.success && res.data?.packages) {
          // Clinic-facing plans only, sorted by tier so the layout is stable.
          const list = res.data.packages
            .filter(p => p.isActive !== false && (!p.audiences || p.audiences.includes('CLINIC')))
            .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
          setPackages(list);
          setCurrentPackageId(res.data.currentPackageId ?? null);
        } else {
          setError('Could not load plans right now.');
        }
      } catch {
        if (!cancelled) setError('Could not load plans right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Highlight the middle tier as "Most Popular" for a balanced 3-card layout.
  const popularId = useMemo(
    () => (packages.length ? packages[Math.floor(packages.length / 2)]?.id : undefined),
    [packages],
  );

  return (
    <div className="min-h-screen bg-[#f7fbfb] text-[#163C39] font-sans overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-[#163C39] transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-xl bg-[#438883] flex items-center justify-center text-sm leading-none">🐾</div>
            <span className="font-black text-lg tracking-tight text-[#163C39]">Vet<span className="text-[#438883]">Hub</span>Core Pricing</span>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-20 pb-12 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block text-[#438883] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#438883]/10 px-4 py-1.5 rounded-full">Pricing</span>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[#163C39] mb-4">Simple, transparent.</h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">One clear price per plan. Pick the tier that fits your practice.</p>
        </motion.div>
      </section>

      {/* Plans */}
      <section className="pb-28 px-6">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
            <Loader2 size={20} className="animate-spin text-[#438883]" />
            <span className="text-sm font-bold uppercase tracking-widest">Loading plans…</span>
          </div>
        ) : error ? (
          <p className="text-center text-slate-400 text-sm py-24">{error}</p>
        ) : packages.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-24">No plans are available right now.</p>
        ) : (
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 items-center">
            {packages.map((p, i) => {
              const popular = p.id === popularId;
              const isCurrent = currentPackageId != null && p.id === currentPackageId;
              const features = displayFeatures(p.features);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -8 }}
                  className={`relative rounded-3xl p-8 border transition-shadow ${
                    popular
                      ? 'bg-[#163C39] border-[#163C39] shadow-2xl shadow-[#163C39]/20 md:-translate-y-4'
                      : 'bg-white border-slate-200 shadow-sm hover:shadow-lg'
                  }`}
                >
                  {popular && !isCurrent && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#438883] text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      Most Popular
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#438883] text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      Current Plan
                    </div>
                  )}
                  <h3 className={`text-xl font-black mb-6 ${popular ? 'text-white' : 'text-[#163C39]'}`}>{p.name}</h3>
                  <div className="mb-6 pb-6 border-b" style={{ borderColor: popular ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }}>
                    <span className={`text-5xl font-black tracking-tighter ${popular ? 'text-white' : 'text-[#163C39]'}`}>{formatPrice(p.price, p.currency)}</span>
                    <span className={`text-sm ml-1 ${popular ? 'text-white/50' : 'text-slate-400'}`}>/mo</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {features.map((f, j) => (
                      <li key={j} className={`flex items-center gap-3 text-sm ${popular ? 'text-white/80' : 'text-slate-600'}`}>
                        <Check size={16} className="text-[#438883] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={onRegister}
                    disabled={isCurrent}
                    className={`w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-400 cursor-default'
                        : popular
                        ? 'bg-[#438883] text-white hover:bg-[#3a7a75]'
                        : 'bg-[#f0fdf9] text-[#163C39] hover:bg-[#438883]/10'
                    }`}
                  >
                    {isCurrent ? 'Current Plan' : `Choose ${p.name}`}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* FAQ / note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-2xl mx-auto mt-20 text-center"
        >
          <p className="text-slate-400 text-sm leading-relaxed">
            All plans include a <strong className="text-[#163C39]">14-day free trial</strong> — no credit card required.
            Need a custom quote for a large network?{' '}
            <a href="mailto:vethubcore@gmail.com" className="text-[#438883] font-bold hover:underline">Contact us</a>.
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-[#163C39] text-white/50 py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#438883] flex items-center justify-center text-sm leading-none">🐾</div>
            <span className="font-black text-white tracking-tight text-sm">Vet<span className="text-[#438883]">Hub</span>Core</span>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} VetHubCore Enterprise. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
