import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Smartphone, DollarSign, AlertCircle, ExternalLink, Tags } from 'lucide-react';
import {
  platformSettingsAPI,
  subscriptionPackagesAPI,
  PlatformSettings,
  SubscriptionPackagePlan,
} from '../services';

/**
 * SUPER_ADMIN-only page that manages:
 *  - VetHub Mpesa Daraja credentials (consumer key/secret/passkey/shortcode/callback)
 *  - USD → KES conversion rate
 *  - Per-package discount percentage (clinic packages)
 *
 * Secrets are write-only — the form shows whether each is set, but
 * never echoes the plaintext.
 */
const PlatformSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<number | null>(null);

  const [draft, setDraft] = useState<{
    mpesaConsumerKey: string;
    mpesaConsumerSecret: string;
    mpesaPasskey: string;
    mpesaShortcode: string;
    mpesaCallbackBaseUrl: string;
    mpesaTestMode: boolean;
    usdToKesRate: string;
  }>({
    mpesaConsumerKey: '',
    mpesaConsumerSecret: '',
    mpesaPasskey: '',
    mpesaShortcode: '',
    mpesaCallbackBaseUrl: '',
    mpesaTestMode: true,
    usdToKesRate: '130',
  });

  const [packages, setPackages] = useState<SubscriptionPackagePlan[]>([]);
  const [savingPkgId, setSavingPkgId] = useState<string | null>(null);
  const [pkgError, setPkgError] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const res = await platformSettingsAPI.get();
      if (res.success) {
        setSettings(res.data);
        setDraft((d) => ({
          ...d,
          mpesaShortcode: res.data.mpesaShortcode ?? '',
          mpesaCallbackBaseUrl: res.data.mpesaCallbackBaseUrl ?? '',
          mpesaTestMode: res.data.mpesaTestMode,
          usdToKesRate: String(res.data.usdToKesRate),
        }));
      } else {
        setSettingsError('Failed to load platform settings');
      }
    } catch (e: any) {
      setSettingsError(e?.message || 'Failed to load platform settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadPackages = async () => {
    try {
      const res = await subscriptionPackagesAPI.list();
      if (res.success) setPackages(res.data.packages);
    } catch {
      // ignore — page still useful without packages list
    }
  };

  useEffect(() => {
    loadSettings();
    loadPackages();
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const payload: any = {
        mpesaShortcode: draft.mpesaShortcode || null,
        mpesaCallbackBaseUrl: draft.mpesaCallbackBaseUrl || null,
        mpesaTestMode: draft.mpesaTestMode,
        usdToKesRate: Number(draft.usdToKesRate),
      };
      // Only send secrets if user actually typed something. Never echo back.
      if (draft.mpesaConsumerKey)    payload.mpesaConsumerKey    = draft.mpesaConsumerKey;
      if (draft.mpesaConsumerSecret) payload.mpesaConsumerSecret = draft.mpesaConsumerSecret;
      if (draft.mpesaPasskey)        payload.mpesaPasskey        = draft.mpesaPasskey;

      const res = await platformSettingsAPI.update(payload);
      if (res.success) {
        setSettings(res.data);
        setSettingsSavedAt(Date.now());
        // Wipe secret inputs after save.
        setDraft((d) => ({ ...d, mpesaConsumerKey: '', mpesaConsumerSecret: '', mpesaPasskey: '' }));
      } else {
        setSettingsError('Save failed');
      }
    } catch (e: any) {
      setSettingsError(e?.message || 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const updatePackageDiscount = async (id: string, discount: number) => {
    setSavingPkgId(id);
    setPkgError(null);
    try {
      const res = await subscriptionPackagesAPI.update(id, { discountPercentage: discount });
      if (res.success) {
        setPackages((list) =>
          list.map((p) => (p.id === id ? { ...p, discountPercentage: discount } : p)),
        );
      } else {
        setPkgError('Update failed');
      }
    } catch (e: any) {
      setPkgError(e?.message || 'Update failed');
    } finally {
      setSavingPkgId(null);
    }
  };

  const usdRate = Number(draft.usdToKesRate) || 0;
  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => a.tier - b.tier),
    [packages],
  );

  return (
    <div className="animate-in fade-in duration-300 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Platform Settings</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold text-xs uppercase tracking-widest mt-1">
            VetHub-level Mpesa, FX rate, and subscription discounts
          </p>
        </div>
      </div>

      {/* Mpesa Daraja section */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500 text-white rounded-lg"><Smartphone size={14} /></div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">VetHub Mpesa Daraja</h2>
          </div>
          {settings && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Last updated {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'}
            </p>
          )}
        </header>

        <div className="p-4 space-y-3">
          {loadingSettings ? (
            <div className="py-10 text-center"><Loader2 size={20} className="animate-spin text-seafoam mx-auto" /></div>
          ) : (
            <>
              {settingsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5" /> {settingsError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Consumer Key {settings?.hasMpesaConsumerKey && <span className="ml-1 text-emerald-500">●</span>}</label>
                  <input
                    type="password"
                    value={draft.mpesaConsumerKey}
                    onChange={(e) => setDraft({ ...draft, mpesaConsumerKey: e.target.value })}
                    placeholder={settings?.hasMpesaConsumerKey ? '•••••• (leave blank to keep)' : 'enter consumer key'}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Consumer Secret {settings?.hasMpesaConsumerSecret && <span className="ml-1 text-emerald-500">●</span>}</label>
                  <input
                    type="password"
                    value={draft.mpesaConsumerSecret}
                    onChange={(e) => setDraft({ ...draft, mpesaConsumerSecret: e.target.value })}
                    placeholder={settings?.hasMpesaConsumerSecret ? '•••••• (leave blank to keep)' : 'enter consumer secret'}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Passkey (LipaNaMpesaOnline) {settings?.hasMpesaPasskey && <span className="ml-1 text-emerald-500">●</span>}</label>
                  <input
                    type="password"
                    value={draft.mpesaPasskey}
                    onChange={(e) => setDraft({ ...draft, mpesaPasskey: e.target.value })}
                    placeholder={settings?.hasMpesaPasskey ? '•••••• (leave blank to keep)' : 'enter passkey'}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Shortcode (paybill / till)</label>
                  <input
                    value={draft.mpesaShortcode}
                    onChange={(e) => setDraft({ ...draft, mpesaShortcode: e.target.value })}
                    placeholder="174379 (sandbox)"
                    className="field-input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="field-label">Callback Base URL</label>
                  <input
                    value={draft.mpesaCallbackBaseUrl}
                    onChange={(e) => setDraft({ ...draft, mpesaCallbackBaseUrl: e.target.value })}
                    placeholder="https://api.example.com (no trailing slash)"
                    className="field-input"
                  />
                  <p className="field-help">Daraja appends <code>/api/v1/webhooks/vethub-mpesa/callback</code>.</p>
                </div>
                <div>
                  <label className="field-label">Mode</label>
                  <select
                    value={draft.mpesaTestMode ? 'sandbox' : 'production'}
                    onChange={(e) => setDraft({ ...draft, mpesaTestMode: e.target.value === 'sandbox' })}
                    className="field-select"
                  >
                    <option value="sandbox">Sandbox (test)</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className="field-label flex items-center gap-1"><DollarSign size={11} /> USD → KES rate</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={draft.usdToKesRate}
                    onChange={(e) => setDraft({ ...draft, usdToKesRate: e.target.value })}
                    className="field-input"
                  />
                  <p className="field-help">Used to convert USD package amount to the KES integer Mpesa charges.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 mt-2">
                {settingsSavedAt && Date.now() - settingsSavedAt < 1500 && (
                  <span className="text-[10px] font-black text-emerald-500 uppercase">saved</span>
                )}
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40"
                >
                  {savingSettings ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save settings
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Packages discount section */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="p-1.5 bg-cyan-500 text-white rounded-lg"><Tags size={14} /></div>
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">Subscription packages</h2>
        </header>

        {pkgError && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{pkgError}</div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {sortedPackages.map((p) => {
            const discount = p.discountPercentage ?? 0;
            const effectiveUsd = +(p.price * (1 - discount / 100)).toFixed(2);
            const kesAmount = Math.round(effectiveUsd * usdRate);
            return (
              <div key={p.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                <div className="col-span-4">
                  <p className="text-sm font-black text-pine dark:text-zinc-100">{p.name} <span className="text-[10px] text-slate-400 font-bold">tier {p.tier}</span></p>
                  <p className="text-[11px] text-slate-500">{p.currency} {p.price.toFixed(2)} / {p.billingCycle.toLowerCase()}</p>
                </div>
                <div className="col-span-3">
                  <label className="field-label">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    defaultValue={String(discount)}
                    onBlur={(e) => {
                      const next = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      if (next !== discount) updatePackageDiscount(p.id, next);
                    }}
                    className="field-input"
                  />
                </div>
                <div className="col-span-3 text-right text-[11px] font-mono text-slate-400">
                  effective<br />
                  <span className="text-pine dark:text-zinc-100 font-bold text-sm">${effectiveUsd}</span>
                </div>
                <div className="col-span-2 text-right text-[11px] font-mono text-slate-400">
                  Mpesa<br />
                  <span className="text-pine dark:text-zinc-100 font-bold text-sm">KES {kesAmount.toLocaleString()}</span>
                </div>
                {savingPkgId === p.id && <Loader2 size={12} className="animate-spin text-seafoam col-span-12" />}
              </div>
            );
          })}
          {sortedPackages.length === 0 && (
            <p className="px-4 py-10 text-center text-xs font-bold text-slate-500">
              No packages yet. Run the seed (`scripts/seed-clinic-packages.js`).
            </p>
          )}
        </div>
      </section>

      {/* How-to-get test paybill */}
      <section className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 text-sm">
        <h3 className="font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
          <ExternalLink size={12} /> How to get a test paybill / till
        </h3>
        <ol className="list-decimal pl-5 space-y-1 text-amber-900 dark:text-amber-200 text-[13px]">
          <li>Sign in at <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener" className="underline">developer.safaricom.co.ke</a> and create a Daraja sandbox app.</li>
          <li>From the app's "Keys" tab copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong> into the fields above.</li>
          <li>For sandbox use <strong>Shortcode 174379</strong> and the <strong>LipaNaMpesaOnline test passkey</strong> shown on the simulator page.</li>
          <li>Set <strong>Callback Base URL</strong> to a publicly reachable URL — e.g. <code>https://api-staging.148.230.126.79.nip.io</code>. Daraja appends <code>/api/v1/webhooks/vethub-mpesa/callback</code>.</li>
          <li>Keep <strong>Mode</strong> on Sandbox until you go live; toggle to Production with real-store keys when you do.</li>
          <li>Test with phone <code>254708374149</code>, PIN <code>12345</code>.</li>
        </ol>
      </section>
    </div>
  );
};

export default PlatformSettingsPage;
