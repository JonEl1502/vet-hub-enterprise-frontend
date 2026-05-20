import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowLeft } from 'lucide-react';
import CountrySelect from '../common/CountrySelect';
import {
  detectCountryCode,
  getCountry,
  REGION_MULTIPLIER,
  REGION_LABEL,
  type Country,
  type Region,
} from '../../../utils/countries';

interface PricingPageProps {
  onBack: () => void;
  onRegister: () => void;
}

// USD anchor prices — must match the basePriceUsd values in seed-packages.ts
interface Plan {
  name: string;
  basePriceUsd: number;
  desc: string;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Manager',
    basePriceUsd: 16,
    desc: 'Perfect for single-vet practices.',
    features: ['Up to 500 patients', 'Up to 5 staff', 'Scheduling & medical records', 'Inventory tracking', 'Email support'],
  },
  {
    name: 'Pro',
    basePriceUsd: 48,
    desc: 'Ideal for growing multi-branch clinics.',
    features: ['Up to 2,000 patients', 'Up to 20 staff', 'Inventory + vaccinations', 'Financial reports', 'Priority support'],
    popular: true,
  },
  {
    name: 'Enterprise',
    basePriceUsd: 112,
    desc: 'For large networks and hospital groups.',
    features: ['Unlimited patients & staff', 'Multi-clinic management', 'Advanced analytics', 'Custom integrations', 'Dedicated manager'],
  },
];

export default function PricingPage({ onBack, onRegister }: PricingPageProps) {
  const [countryCode, setCountryCode] = useState<string>('US');

  useEffect(() => {
    const detected = detectCountryCode();
    if (detected) setCountryCode(detected);
  }, []);

  const country = getCountry(countryCode);
  const region: Region = country?.region ?? 'NORTH_AMERICA';
  const multiplier = REGION_MULTIPLIER[region];

  const formatPrice = useMemo(() => {
    return (basePriceUsd: number) => {
      const adjusted = Math.round(basePriceUsd * multiplier);
      return adjusted.toLocaleString('en-US');
    };
  }, [multiplier]);

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
      <section className="pt-20 pb-8 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block text-[#438883] font-bold text-[10px] uppercase tracking-[0.3em] mb-4 bg-[#438883]/10 px-4 py-1.5 rounded-full">Pricing</span>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[#163C39] mb-4">Simple, transparent.</h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Fair pricing for every region. Prices auto-adjust based on your country.</p>
        </motion.div>
      </section>

      {/* Region selector */}
      <section className="pb-12 px-6">
        <div className="max-w-md mx-auto">
          <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2 text-center">
            Showing prices for
          </label>
          <CountrySelect
            value={countryCode}
            onChange={(c: Country) => setCountryCode(c.code)}
          />
          <p className="mt-2 text-center text-[11px] font-bold text-[#163C39]/50">
            {country?.flag} {REGION_LABEL[region]} pricing — billed in USD.
            {multiplier < 1 && (
              <span className="text-[#438883] ml-1">{Math.round((1 - multiplier) * 100)}% off NA list price.</span>
            )}
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-28 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 items-center">
          {PLANS.map((p) => ({
            name: p.name,
            price: formatPrice(p.basePriceUsd),
            desc: p.desc,
            features: p.features,
            popular: !!p.popular,
          })).map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className={`relative rounded-3xl p-8 border transition-shadow ${
                plan.popular
                  ? 'bg-[#163C39] border-[#163C39] shadow-2xl shadow-[#163C39]/20 md:-translate-y-4'
                  : 'bg-white border-slate-200 shadow-sm hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#438883] text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Most Popular
                </div>
              )}
              <h3 className={`text-xl font-black mb-2 ${plan.popular ? 'text-white' : 'text-[#163C39]'}`}>{plan.name}</h3>
              <p className={`text-sm mb-6 ${plan.popular ? 'text-white/60' : 'text-slate-400'}`}>{plan.desc}</p>
              <div className="mb-6 pb-6 border-b" style={{ borderColor: plan.popular ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }}>
                <span className={`text-5xl font-black tracking-tighter ${plan.popular ? 'text-white' : 'text-[#163C39]'}`}>${plan.price}</span>
                <span className={`text-sm ml-1 ${plan.popular ? 'text-white/50' : 'text-slate-400'}`}>/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className={`flex items-center gap-3 text-sm ${plan.popular ? 'text-white/80' : 'text-slate-600'}`}>
                    <Check size={16} className="text-[#438883] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onRegister}
                className={`w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${
                  plan.popular
                    ? 'bg-[#438883] text-white hover:bg-[#3a7a75]'
                    : 'bg-[#f0fdf9] text-[#163C39] hover:bg-[#438883]/10'
                }`}
              >
                Choose {plan.name}
              </button>
            </motion.div>
          ))}
        </div>

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
