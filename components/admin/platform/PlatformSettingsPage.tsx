import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Smartphone, DollarSign, AlertCircle, ExternalLink, Tags, ArrowLeft, CreditCard, Sparkles, KeyRound, Check, X, Eye, EyeOff, UserPlus } from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import {
  platformSettingsAPI,
  subscriptionPackagesAPI,
  PlatformSettings,
  SubscriptionPackagePlan,
} from '../../../services';

/**
 * SUPER_ADMIN-only page that manages:
 *  - VetHub Mpesa Daraja credentials (consumer key/secret/passkey/shortcode/callback)
 *  - USD → KES conversion rate
 *  - Per-package discount percentage (clinic packages)
 *
 * Secrets are write-only — the form shows whether each is set, but
 * never echoes the plaintext.
 */
interface Props {
  onBack?: () => void;
}

const PlatformSettingsPage: React.FC<Props> = ({ onBack }) => {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) => setRevealed((m) => ({ ...m, [key]: !m[key] }));
  const [activeProvider, setActiveProvider] = useState<'mpesa' | 'pesapal' | 'lipana' | 'paystack' | 'ai'>('mpesa');
  // AI provider draft — kept separate from payment draft so we can save it
  // independently. Secret fields are blank by default; only sent on save
  // when the admin actually typed something in (so we don't clobber the
  // existing key with an empty string).
  const [aiDraft, setAiDraft] = useState<{
    provider: 'auto' | 'anthropic' | 'openai' | 'groq' | 'none';
    anthropicApiKey: string;
    anthropicModel: string;
    openaiApiKey: string;
    openaiModel: string;
    groqApiKey: string;
    groqModel: string;
  }>({ provider: 'auto', anthropicApiKey: '', anthropicModel: '', openaiApiKey: '', openaiModel: '', groqApiKey: '', groqModel: '' });
  const [savingAi, setSavingAi] = useState(false);
  const [aiSavedAt, setAiSavedAt] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [draft, setDraft] = useState<{
    mpesaConsumerKey: string;
    mpesaConsumerSecret: string;
    mpesaPasskey: string;
    mpesaShortcode: string;
    mpesaCallbackBaseUrl: string;
    mpesaTestMode: boolean;
    pesapalConsumerKey: string;
    pesapalConsumerSecret: string;
    pesapalIpnId: string;
    pesapalCallbackBaseUrl: string;
    pesapalTestMode: boolean;
    // Lipana — one API key + a separate webhook secret. Amounts come from the
    // package table, so no amount/callback fields (callback uses the env var).
    lipanaSecretKey: string;
    lipanaWebhookSecret: string;
    // Paystack — secret key (server-side + webhook signing) + public key
    // (for reference / client-side use). Both editable here.
    paystackSecretKey: string;
    paystackPublicKey: string;
    usdToKesRate: string;
    displayCurrency: string;
    signupsEnabled: boolean;
  }>({
    mpesaConsumerKey: '',
    mpesaConsumerSecret: '',
    mpesaPasskey: '',
    mpesaShortcode: '',
    mpesaCallbackBaseUrl: '',
    mpesaTestMode: true,
    pesapalConsumerKey: '',
    pesapalConsumerSecret: '',
    pesapalIpnId: '',
    pesapalCallbackBaseUrl: '',
    pesapalTestMode: true,
    lipanaSecretKey: '',
    lipanaWebhookSecret: '',
    paystackSecretKey: '',
    paystackPublicKey: '',
    usdToKesRate: '130',
    displayCurrency: 'KES',
    signupsEnabled: true,
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
          pesapalIpnId: res.data.pesapalIpnId ?? '',
          pesapalCallbackBaseUrl: res.data.pesapalCallbackBaseUrl ?? '',
          pesapalTestMode: res.data.pesapalTestMode,
          paystackPublicKey: res.data.paystackPublicKey ?? '',
          usdToKesRate: String(res.data.usdToKesRate),
          displayCurrency: res.data.displayCurrency || 'KES',
          signupsEnabled: res.data.signupsEnabled !== false,
        }));
        setAiDraft({
          provider: res.data.aiProvider ?? 'auto',
          anthropicApiKey: '',
          anthropicModel: res.data.anthropicModel ?? '',
          openaiApiKey: '',
          openaiModel: res.data.openaiModel ?? '',
          groqApiKey: '',
          groqModel: res.data.groqModel ?? '',
        });
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

  // Mpesa block save — also covers usdToKesRate which sits inside the
  // Mpesa card. Pesapal has its own save button below.
  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const payload: any = {
        mpesaShortcode: draft.mpesaShortcode || null,
        mpesaCallbackBaseUrl: draft.mpesaCallbackBaseUrl || null,
        mpesaTestMode: draft.mpesaTestMode,
        usdToKesRate: Number(draft.usdToKesRate),
        displayCurrency: draft.displayCurrency || 'KES',
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

  // Public signups switch — its own save so it's independent of the payment tabs.
  const [savingSignups, setSavingSignups] = useState(false);
  const [signupsSavedAt, setSignupsSavedAt] = useState<number | null>(null);
  const saveSignups = async (next: boolean) => {
    setSavingSignups(true);
    setSettingsError(null);
    setDraft((d) => ({ ...d, signupsEnabled: next }));
    try {
      const res = await platformSettingsAPI.update({ signupsEnabled: next });
      if (res.success) {
        setSettings(res.data);
        setSignupsSavedAt(Date.now());
      } else {
        setSettingsError('Save failed');
        setDraft((d) => ({ ...d, signupsEnabled: !next }));
      }
    } catch (e: any) {
      setSettingsError(e?.message || 'Save failed');
      setDraft((d) => ({ ...d, signupsEnabled: !next }));
    } finally {
      setSavingSignups(false);
    }
  };

  const saveAiSettings = async () => {
    setSavingAi(true);
    setAiError(null);
    try {
      const payload: any = {
        aiProvider: aiDraft.provider,
        anthropicModel: aiDraft.anthropicModel || null,
        openaiModel: aiDraft.openaiModel || null,
        groqModel: aiDraft.groqModel || null,
      };
      // Only send the API key if the admin typed something. Don't overwrite
      // an existing key with an empty string.
      if (aiDraft.anthropicApiKey) payload.anthropicApiKey = aiDraft.anthropicApiKey;
      if (aiDraft.openaiApiKey)    payload.openaiApiKey    = aiDraft.openaiApiKey;
      if (aiDraft.groqApiKey)      payload.groqApiKey      = aiDraft.groqApiKey;

      const res = await platformSettingsAPI.update(payload);
      if (res.success) {
        setSettings(res.data);
        setAiSavedAt(Date.now());
        // Wipe key inputs after save — they're never echoed back.
        setAiDraft((d) => ({ ...d, anthropicApiKey: '', openaiApiKey: '', groqApiKey: '' }));
      } else {
        setAiError('Save failed');
      }
    } catch (e: any) {
      setAiError(e?.message || 'Save failed');
    } finally {
      setSavingAi(false);
    }
  };

  const clearAiKey = async (which: 'anthropic' | 'openai' | 'groq') => {
    setSavingAi(true);
    setAiError(null);
    try {
      const payload: any = which === 'anthropic'
        ? { anthropicApiKey: null }
        : which === 'openai'
        ? { openaiApiKey: null }
        : { groqApiKey: null };
      const res = await platformSettingsAPI.update(payload);
      if (res.success) {
        setSettings(res.data);
        setAiSavedAt(Date.now());
      }
    } catch (e: any) {
      setAiError(e?.message || 'Clear failed');
    } finally {
      setSavingAi(false);
    }
  };

  const [savingPesapal, setSavingPesapal] = useState(false);
  const [pesapalSavedAt, setPesapalSavedAt] = useState<number | null>(null);
  const [pesapalError, setPesapalError] = useState<string | null>(null);

  const savePesapal = async () => {
    setSavingPesapal(true);
    setPesapalError(null);
    try {
      const payload: any = {
        pesapalIpnId: draft.pesapalIpnId || null,
        pesapalCallbackBaseUrl: draft.pesapalCallbackBaseUrl || null,
        pesapalTestMode: draft.pesapalTestMode,
      };
      if (draft.pesapalConsumerKey)    payload.pesapalConsumerKey    = draft.pesapalConsumerKey;
      if (draft.pesapalConsumerSecret) payload.pesapalConsumerSecret = draft.pesapalConsumerSecret;

      const res = await platformSettingsAPI.update(payload);
      if (res.success) {
        setSettings(res.data);
        setPesapalSavedAt(Date.now());
        setDraft((d) => ({ ...d, pesapalConsumerKey: '', pesapalConsumerSecret: '' }));
      } else {
        setPesapalError('Save failed');
      }
    } catch (e: any) {
      setPesapalError(e?.message || 'Save failed');
    } finally {
      setSavingPesapal(false);
    }
  };

  // ── Lipana save — API key + webhook secret only ──────────────
  const [savingLipana, setSavingLipana] = useState(false);
  const [lipanaSavedAt, setLipanaSavedAt] = useState<number | null>(null);
  const [lipanaError, setLipanaError] = useState<string | null>(null);

  const saveLipana = async () => {
    setSavingLipana(true);
    setLipanaError(null);
    try {
      const payload: any = {};
      if (draft.lipanaSecretKey)     payload.lipanaSecretKey     = draft.lipanaSecretKey;
      if (draft.lipanaWebhookSecret) payload.lipanaWebhookSecret = draft.lipanaWebhookSecret;
      const res = await platformSettingsAPI.update(payload);
      if (res.success) {
        setSettings(res.data);
        setLipanaSavedAt(Date.now());
        setDraft((d) => ({ ...d, lipanaSecretKey: '', lipanaWebhookSecret: '' }));
      } else {
        setLipanaError('Save failed');
      }
    } catch (e: any) {
      setLipanaError(e?.message || 'Save failed');
    } finally {
      setSavingLipana(false);
    }
  };

  // ── Paystack save — single secret key ────────────────────────
  const [savingPaystack, setSavingPaystack] = useState(false);
  const [paystackSavedAt, setPaystackSavedAt] = useState<number | null>(null);
  const [paystackError, setPaystackError] = useState<string | null>(null);

  const savePaystack = async () => {
    setSavingPaystack(true);
    setPaystackError(null);
    try {
      const payload: any = {
        // Public key isn't secret — send the current value (clears if blank).
        paystackPublicKey: draft.paystackPublicKey || null,
      };
      if (draft.paystackSecretKey) payload.paystackSecretKey = draft.paystackSecretKey;
      const res = await platformSettingsAPI.update(payload);
      if (res.success) {
        setSettings(res.data);
        setPaystackSavedAt(Date.now());
        // Wipe the secret input (write-only); keep the public key visible.
        setDraft((d) => ({ ...d, paystackSecretKey: '', paystackPublicKey: res.data.paystackPublicKey ?? '' }));
      } else {
        setPaystackError('Save failed');
      }
    } catch (e: any) {
      setPaystackError(e?.message || 'Save failed');
    } finally {
      setSavingPaystack(false);
    }
  };

  // Wipe stored gateway keys (sets them to null). Used by the "Clear keys"
  // buttons so an admin can revoke a compromised/rotated key from here.
  const clearPaystack = async () => {
    if (!window.confirm('Remove the stored Paystack keys? Card payments will stop until new keys are saved.')) return;
    setSavingPaystack(true);
    setPaystackError(null);
    try {
      const res = await platformSettingsAPI.update({ paystackSecretKey: null, paystackPublicKey: null, paystackWebhookSecret: null });
      if (res.success) {
        setSettings(res.data);
        setPaystackSavedAt(Date.now());
        setDraft((d) => ({ ...d, paystackSecretKey: '', paystackPublicKey: '' }));
      } else { setPaystackError('Clear failed'); }
    } catch (e: any) {
      setPaystackError(e?.message || 'Clear failed');
    } finally { setSavingPaystack(false); }
  };

  const clearLipana = async () => {
    if (!window.confirm('Remove the stored Lipana keys? M-Pesa via Lipana will stop until new keys are saved.')) return;
    setSavingLipana(true);
    setLipanaError(null);
    try {
      const res = await platformSettingsAPI.update({ lipanaSecretKey: null, lipanaWebhookSecret: null });
      if (res.success) {
        setSettings(res.data);
        setLipanaSavedAt(Date.now());
        setDraft((d) => ({ ...d, lipanaSecretKey: '', lipanaWebhookSecret: '' }));
      } else { setLipanaError('Clear failed'); }
    } catch (e: any) {
      setLipanaError(e?.message || 'Clear failed');
    } finally { setSavingLipana(false); }
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

  const isMpesaConfigured = !!(
    settings &&
    settings.hasMpesaConsumerKey &&
    settings.hasMpesaConsumerSecret &&
    settings.hasMpesaPasskey &&
    settings.mpesaShortcode &&
    settings.mpesaCallbackBaseUrl
  );
  const isPesapalConfigured = !!(
    settings &&
    settings.hasPesapalConsumerKey &&
    settings.hasPesapalConsumerSecret &&
    settings.pesapalCallbackBaseUrl
  );
  // Lipana needs both the API key (sends STK) and the webhook secret
  // (confirms payment) — without the latter, payments never activate.
  const isLipanaConfigured = !!(
    settings && settings.hasLipanaSecretKey && settings.hasLipanaWebhookSecret
  );
  // Paystack only needs the secret key — it signs webhooks with it.
  const isPaystackConfigured = !!(settings && settings.hasPaystackSecretKey);

  const isAiConfigured = !!(
    settings &&
    (settings.aiProvider === 'anthropic'
      ? settings.hasAnthropicApiKey
      : settings.aiProvider === 'openai'
      ? settings.hasOpenaiApiKey
      : settings.aiProvider === 'groq'
      ? settings.hasGroqApiKey
      : settings.aiProvider === 'none'
      ? false
      : settings.hasAnthropicApiKey || settings.hasOpenaiApiKey || settings.hasGroqApiKey)
  );

  const providerTabs: Array<{
    id: 'mpesa' | 'pesapal' | 'lipana' | 'paystack' | 'ai';
    label: string;
    icon: React.ReactNode;
    accent: string;
    configured: boolean;
  }> = [
    { id: 'mpesa',    label: 'Mpesa Daraja', icon: <Smartphone size={12} />, accent: 'bg-emerald-500', configured: isMpesaConfigured },
    { id: 'pesapal',  label: 'Pesapal',      icon: <CreditCard size={12} />, accent: 'bg-fuchsia-500', configured: isPesapalConfigured },
    { id: 'lipana',   label: 'Lipana',       icon: <Smartphone size={12} />, accent: 'bg-violet-500',  configured: isLipanaConfigured },
    { id: 'paystack', label: 'Paystack',     icon: <CreditCard size={12} />, accent: 'bg-sky-500',     configured: isPaystackConfigured },
    { id: 'ai',       label: 'AI Provider',  icon: <Sparkles size={12} />,   accent: 'bg-indigo-500',  configured: isAiConfigured },
  ];

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20">
      {/* Page header — square back button + title (matches ClientProfileView) */}
      <header className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-lg active:scale-95 shrink-0"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">Platform Settings</h1>
          <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest truncate">
            VetHubCore-level Mpesa, Pesapal, Lipana &amp; Paystack, FX rate, and subscription discounts
          </p>
        </div>
      </header>

      {/* Public signups — platform-wide access switch (not provider-specific) */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-pine text-white rounded-lg"><UserPlus size={14} /></div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">Public signups</h2>
          </div>
          {signupsSavedAt && (
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1"><Check size={12} /> Saved</span>
          )}
        </header>
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-pine dark:text-zinc-100">Allow clinics to sign up themselves</p>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-zinc-400 max-w-xl leading-relaxed">
              When <b>ON</b>, the marketing site shows the self-serve signup wizard. When <b>OFF</b>, the
              “Create account” / “Start demo” buttons open a <b>Contact us for a demo</b> form (emailed to your
              team) and you create accounts here on the backend. Visitors pick up the change on their next page load.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.signupsEnabled}
            disabled={savingSignups}
            onClick={() => saveSignups(!draft.signupsEnabled)}
            className={`shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${draft.signupsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'} disabled:opacity-50`}
            title={draft.signupsEnabled ? 'Signups enabled' : 'Signups disabled'}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${draft.signupsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="px-4 pb-4 -mt-1">
          <span className={`text-[11px] font-black uppercase tracking-widest ${draft.signupsEnabled ? 'text-emerald-600' : 'text-amber-600'}`}>
            {savingSignups ? 'Saving…' : draft.signupsEnabled ? 'Signups ON — self-serve enabled' : 'Signups OFF — demo requests only'}
          </span>
        </div>
      </section>

      {/* Provider tabs — switch between payment provider configs (Mpesa, Pesapal, …) */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
        {providerTabs.map((t) => {
          const active = activeProvider === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveProvider(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap ${
                active
                  ? 'border-pine text-pine dark:border-zinc-100 dark:text-zinc-100'
                  : 'border-transparent text-slate-400 hover:text-pine dark:hover:text-zinc-200'
              }`}
            >
              <span className={`p-1 rounded ${t.accent} text-white flex items-center justify-center`}>{t.icon}</span>
              {t.label}
              <span
                title={t.configured ? 'Configured' : 'Not configured'}
                className={`w-1.5 h-1.5 rounded-full ${t.configured ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
            </button>
          );
        })}
      </div>

      {activeProvider === 'mpesa' && (<>
      {/* Mpesa Daraja section */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500 text-white rounded-lg"><Smartphone size={14} /></div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">VetHubCore Mpesa Daraja</h2>
          </div>
          {settings && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Last updated {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'}
            </p>
          )}
        </header>

        <div className="p-4 space-y-3">
          {loadingSettings ? (
            <div className="py-10"><LoadingSpinner message="Loading..." /></div>
          ) : (
            <>
              {settingsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5" /> {settingsError}
                </div>
              )}

              {/* Top-of-section status banner so the admin sees at a
                  glance what's still missing. */}
              {(() => {
                const missing: string[] = [];
                if (settings && !settings.hasMpesaConsumerKey) missing.push('Consumer Key');
                if (settings && !settings.hasMpesaConsumerSecret) missing.push('Consumer Secret');
                if (settings && !settings.hasMpesaPasskey) missing.push('Passkey');
                if (settings && !settings.mpesaShortcode) missing.push('Shortcode');
                if (settings && !settings.mpesaCallbackBaseUrl) missing.push('Callback URL');
                if (!settings) return null;
                return missing.length === 0 ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Mpesa is fully configured — STK push ready.
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Mpesa is not fully configured.</p>
                      <p className="font-medium mt-0.5">Missing: <span className="font-black">{missing.join(', ')}</span>. Fill the field(s) below and Save.</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    Consumer Key
                    {settings && (
                      settings.hasMpesaConsumerKey
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.mpesaConsumerKey ? 'text' : 'password'}
                      value={draft.mpesaConsumerKey}
                      onChange={(e) => setDraft({ ...draft, mpesaConsumerKey: e.target.value })}
                      placeholder={settings?.hasMpesaConsumerKey ? '•••••• (leave blank to keep)' : 'enter consumer key'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('mpesaConsumerKey')} aria-label={revealed.mpesaConsumerKey ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.mpesaConsumerKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    Consumer Secret
                    {settings && (
                      settings.hasMpesaConsumerSecret
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.mpesaConsumerSecret ? 'text' : 'password'}
                      value={draft.mpesaConsumerSecret}
                      onChange={(e) => setDraft({ ...draft, mpesaConsumerSecret: e.target.value })}
                      placeholder={settings?.hasMpesaConsumerSecret ? '•••••• (leave blank to keep)' : 'enter consumer secret'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('mpesaConsumerSecret')} aria-label={revealed.mpesaConsumerSecret ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.mpesaConsumerSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    Passkey (LipaNaMpesaOnline)
                    {settings && (
                      settings.hasMpesaPasskey
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.mpesaPasskey ? 'text' : 'password'}
                      value={draft.mpesaPasskey}
                      onChange={(e) => setDraft({ ...draft, mpesaPasskey: e.target.value })}
                      placeholder={settings?.hasMpesaPasskey ? '•••••• (leave blank to keep)' : 'enter passkey'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('mpesaPasskey')} aria-label={revealed.mpesaPasskey ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.mpesaPasskey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
                <div>
                  <label className="field-label flex items-center gap-1"><DollarSign size={11} /> Display currency (platform-wide)</label>
                  <select
                    value={draft.displayCurrency}
                    onChange={(e) => setDraft({ ...draft, displayCurrency: e.target.value })}
                    className="field-select"
                  >
                    <option value="KES">KES — Kenyan Shilling</option>
                    <option value="USD">USD — US Dollar</option>
                  </select>
                  <p className="field-help">
                    Every $ value in the system (admin reports, clinic billing, plan cards, sales-rep totals) displays in this currency. USD amounts auto-convert via the FX rate above.
                  </p>
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

      {/* How-to-get test paybill — Mpesa */}
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
      </>)}

      {activeProvider === 'pesapal' && (<>
      {/* Pesapal section — same shape as Mpesa, BYOK pattern. */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-fuchsia-500 text-white rounded-lg"><CreditCard size={14} /></div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">VetHubCore Pesapal</h2>
          </div>
          {settings && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Last updated {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'}
            </p>
          )}
        </header>

        <div className="p-4 space-y-3">
          {loadingSettings ? (
            <div className="py-10"><LoadingSpinner message="Loading..." /></div>
          ) : (
            <>
              {pesapalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5" /> {pesapalError}
                </div>
              )}

              {(() => {
                const missing: string[] = [];
                if (settings && !settings.hasPesapalConsumerKey) missing.push('Consumer Key');
                if (settings && !settings.hasPesapalConsumerSecret) missing.push('Consumer Secret');
                if (settings && !settings.pesapalCallbackBaseUrl) missing.push('Callback URL');
                if (!settings) return null;
                return missing.length === 0 ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Pesapal is fully configured — checkout ready.
                    {!settings.pesapalIpnId && <span className="ml-2 font-medium normal-case text-emerald-600 dark:text-emerald-400">IPN id will be auto-registered on first use.</span>}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Pesapal is not fully configured.</p>
                      <p className="font-medium mt-0.5">Missing: <span className="font-black">{missing.join(', ')}</span>. Fill the field(s) below and Save.</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    Consumer Key
                    {settings && (
                      settings.hasPesapalConsumerKey
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.pesapalConsumerKey ? 'text' : 'password'}
                      value={draft.pesapalConsumerKey}
                      onChange={(e) => setDraft({ ...draft, pesapalConsumerKey: e.target.value })}
                      placeholder={settings?.hasPesapalConsumerKey ? '•••••• (leave blank to keep)' : 'enter consumer key'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('pesapalConsumerKey')} aria-label={revealed.pesapalConsumerKey ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.pesapalConsumerKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    Consumer Secret
                    {settings && (
                      settings.hasPesapalConsumerSecret
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.pesapalConsumerSecret ? 'text' : 'password'}
                      value={draft.pesapalConsumerSecret}
                      onChange={(e) => setDraft({ ...draft, pesapalConsumerSecret: e.target.value })}
                      placeholder={settings?.hasPesapalConsumerSecret ? '•••••• (leave blank to keep)' : 'enter consumer secret'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('pesapalConsumerSecret')} aria-label={revealed.pesapalConsumerSecret ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.pesapalConsumerSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="field-label">IPN ID (optional)</label>
                  <input
                    value={draft.pesapalIpnId}
                    onChange={(e) => setDraft({ ...draft, pesapalIpnId: e.target.value })}
                    placeholder="Leave blank — we'll auto-register"
                    className="field-input"
                  />
                  <p className="field-help">If blank, the first transaction will register an IPN URL with Pesapal and stash the id here.</p>
                </div>
                <div>
                  <label className="field-label">Mode</label>
                  <select
                    value={draft.pesapalTestMode ? 'sandbox' : 'production'}
                    onChange={(e) => setDraft({ ...draft, pesapalTestMode: e.target.value === 'sandbox' })}
                    className="field-select"
                  >
                    <option value="sandbox">Sandbox (cybqa)</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="field-label">Callback Base URL</label>
                  <input
                    value={draft.pesapalCallbackBaseUrl}
                    onChange={(e) => setDraft({ ...draft, pesapalCallbackBaseUrl: e.target.value })}
                    placeholder="https://api.example.com (no trailing slash)"
                    className="field-input"
                  />
                  <p className="field-help">Pesapal IPN URL becomes <code>/api/v1/webhooks/vethub-pesapal/ipn</code>. Customer return URL uses <code>/billing/return</code>.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 mt-2">
                {pesapalSavedAt && Date.now() - pesapalSavedAt < 1500 && (
                  <span className="text-[10px] font-black text-emerald-500 uppercase">saved</span>
                )}
                <button
                  type="button"
                  onClick={savePesapal}
                  disabled={savingPesapal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40"
                >
                  {savingPesapal ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Pesapal
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="bg-fuchsia-50 dark:bg-fuchsia-900/10 border border-fuchsia-200 dark:border-fuchsia-900/30 rounded-xl p-4 text-sm">
        <h3 className="font-black text-fuchsia-700 dark:text-fuchsia-300 uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
          <ExternalLink size={12} /> How to get Pesapal sandbox keys
        </h3>
        <ol className="list-decimal pl-5 space-y-1 text-fuchsia-900 dark:text-fuchsia-200 text-[13px]">
          <li>Sign up at <a href="https://developer.pesapal.com" target="_blank" rel="noopener" className="underline">developer.pesapal.com</a> and create a sandbox app — keys appear at <code>cybqa.pesapal.com</code>.</li>
          <li>Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong> into the fields above.</li>
          <li>Leave <strong>IPN ID</strong> blank on first save — the first transaction registers the IPN URL automatically.</li>
          <li>Set <strong>Callback Base URL</strong> to the same value used for Mpesa — e.g. <code>https://api-staging.148.230.126.79.nip.io</code>.</li>
          <li>Keep <strong>Mode</strong> on Sandbox; switch to Production when you've been approved on <a href="https://www.pesapal.com" target="_blank" rel="noopener" className="underline">pesapal.com</a>.</li>
          <li>Pesapal renders the hosted card / mobile-money page — test cards are listed in their docs.</li>
        </ol>
      </section>
      </>)}

      {activeProvider === 'lipana' && (<>
      {/* Lipana section — one API key (sends STK + payment links) plus a
          separate webhook secret (confirms payment). Amounts come from the
          package table; callback URL uses PAYMENT_WEBHOOK_BASE_URL. */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-500 text-white rounded-lg"><Smartphone size={14} /></div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">VetHubCore Lipana</h2>
          </div>
          {settings && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Last updated {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'}
            </p>
          )}
        </header>

        <div className="p-4 space-y-3">
          {loadingSettings ? (
            <div className="py-10"><LoadingSpinner message="Loading..." /></div>
          ) : (
            <>
              {lipanaError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5" /> {lipanaError}
                </div>
              )}

              {settings && (
                isLipanaConfigured ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Lipana is fully configured — STK push ready.
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Lipana is not fully configured.</p>
                      <p className="font-medium mt-0.5">
                        Missing: <span className="font-black">{[
                          !settings.hasLipanaSecretKey && 'API Key',
                          !settings.hasLipanaWebhookSecret && 'Webhook Secret',
                        ].filter(Boolean).join(', ')}</span>. The API key sends the STK push; the webhook secret confirms payment — both are required.
                      </p>
                    </div>
                  </div>
                )
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    API Key (secret)
                    {settings && (
                      settings.hasLipanaSecretKey
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.lipanaSecretKey ? 'text' : 'password'}
                      value={draft.lipanaSecretKey}
                      onChange={(e) => setDraft({ ...draft, lipanaSecretKey: e.target.value })}
                      placeholder={settings?.hasLipanaSecretKey ? '•••••• (leave blank to keep)' : 'lip_sk_live_… or lip_sk_test_…'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('lipanaSecretKey')} aria-label={revealed.lipanaSecretKey ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.lipanaSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="field-help">The <code>lip_sk_test_</code> / <code>lip_sk_live_</code> prefix selects sandbox vs production automatically.</p>
                </div>
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    Webhook Secret
                    {settings && (
                      settings.hasLipanaWebhookSecret
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.lipanaWebhookSecret ? 'text' : 'password'}
                      value={draft.lipanaWebhookSecret}
                      onChange={(e) => setDraft({ ...draft, lipanaWebhookSecret: e.target.value })}
                      placeholder={settings?.hasLipanaWebhookSecret ? '•••••• (leave blank to keep)' : 'from Lipana dashboard → Webhooks'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('lipanaWebhookSecret')} aria-label={revealed.lipanaWebhookSecret ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.lipanaWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="field-help">A separate value from the API key — used to verify the payment-confirmation webhook.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 mt-2">
                {lipanaSavedAt && Date.now() - lipanaSavedAt < 1500 && (
                  <span className="text-[10px] font-black text-emerald-500 uppercase">saved</span>
                )}
                {(settings?.hasLipanaSecretKey || settings?.hasLipanaWebhookSecret) && (
                  <button
                    type="button"
                    onClick={clearLipana}
                    disabled={savingLipana}
                    className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40"
                  >
                    Clear keys
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveLipana}
                  disabled={savingLipana}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40"
                >
                  {savingLipana ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Lipana
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-900/30 rounded-xl p-4 text-sm">
        <h3 className="font-black text-violet-700 dark:text-violet-300 uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
          <ExternalLink size={12} /> Where these come from
        </h3>
        <ol className="list-decimal pl-5 space-y-1 text-violet-900 dark:text-violet-200 text-[13px]">
          <li>Sign in at <a href="https://lipana.dev" target="_blank" rel="noopener" className="underline">lipana.dev</a>.</li>
          <li><strong>API Keys</strong> → copy the secret key (<code>lip_sk_live_…</code> for production).</li>
          <li><strong>Webhooks</strong> → copy the signing secret into the Webhook Secret field.</li>
          <li>Point the Lipana webhook at <code>/api/v1/webhooks/vethub-lipana</code> on this API host. Subscription amounts are charged from the plan table — nothing to set here.</li>
        </ol>
      </section>
      </>)}

      {activeProvider === 'paystack' && (<>
      {/* Paystack section — a single secret key is all that's needed. Paystack
          signs webhooks with the secret key, and we use the hosted-redirect
          flow (no public key). Callback URL uses PAYMENT_WEBHOOK_BASE_URL. */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-500 text-white rounded-lg"><CreditCard size={14} /></div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">VetHubCore Paystack</h2>
          </div>
          {settings && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Last updated {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'}
            </p>
          )}
        </header>

        <div className="p-4 space-y-3">
          {loadingSettings ? (
            <div className="py-10"><LoadingSpinner message="Loading..." /></div>
          ) : (
            <>
              {paystackError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5" /> {paystackError}
                </div>
              )}

              {settings && (
                isPaystackConfigured ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Paystack is configured — card &amp; mobile-money checkout ready.
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Paystack is not configured.</p>
                      <p className="font-medium mt-0.5">Enter your <span className="font-black">Secret Key</span> below and Save. That's all Paystack needs.</p>
                    </div>
                  </div>
                )
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="field-label flex items-center gap-1.5">
                    Secret Key
                    {settings && (
                      settings.hasPaystackSecretKey
                        ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-widest">SET</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[8px] font-black tracking-widest">NOT SET</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={revealed.paystackSecretKey ? 'text' : 'password'}
                      value={draft.paystackSecretKey}
                      onChange={(e) => setDraft({ ...draft, paystackSecretKey: e.target.value })}
                      placeholder={settings?.hasPaystackSecretKey ? '•••••• (leave blank to keep)' : 'sk_live_… or sk_test_…'}
                      className="field-input pr-10"
                    />
                    <button type="button" onClick={() => toggleReveal('paystackSecretKey')} aria-label={revealed.paystackSecretKey ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                      {revealed.paystackSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="field-help">The <code>sk_test_</code> / <code>sk_live_</code> prefix selects test vs live automatically. Paystack signs webhooks with this key, so no separate webhook secret is needed.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="field-label">Public Key</label>
                  <input
                    type="text"
                    value={draft.paystackPublicKey}
                    onChange={(e) => setDraft({ ...draft, paystackPublicKey: e.target.value })}
                    placeholder="pk_live_… or pk_test_…"
                    className="field-input"
                  />
                  <p className="field-help">Publishable key — safe to expose. Not required for the hosted-checkout flow, but stored for reference / future inline checkout.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 mt-2">
                {paystackSavedAt && Date.now() - paystackSavedAt < 1500 && (
                  <span className="text-[10px] font-black text-emerald-500 uppercase">saved</span>
                )}
                {settings?.hasPaystackSecretKey && (
                  <button
                    type="button"
                    onClick={clearPaystack}
                    disabled={savingPaystack}
                    className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40"
                  >
                    Clear keys
                  </button>
                )}
                <button
                  type="button"
                  onClick={savePaystack}
                  disabled={savingPaystack}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40"
                >
                  {savingPaystack ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Paystack
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-900/30 rounded-xl p-4 text-sm">
        <h3 className="font-black text-sky-700 dark:text-sky-300 uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
          <ExternalLink size={12} /> Where the key comes from
        </h3>
        <ol className="list-decimal pl-5 space-y-1 text-sky-900 dark:text-sky-200 text-[13px]">
          <li>Sign in at <a href="https://dashboard.paystack.com" target="_blank" rel="noopener" className="underline">dashboard.paystack.com</a>.</li>
          <li><strong>Settings → API Keys &amp; Webhooks</strong> → copy the <strong>Secret Key</strong> (<code>sk_live_…</code> for live).</li>
          <li>Set the webhook URL there to <code>/api/v1/webhooks/vethub-paystack</code> on this API host.</li>
          <li>The hosted checkout offers card, M-Pesa &amp; bank automatically. Amounts are charged from the plan table.</li>
        </ol>
      </section>
      </>)}

      {activeProvider === 'ai' && (<>
      {/* AI Provider section — pick between Anthropic and OpenAI, paste keys */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500 text-white rounded-lg"><Sparkles size={14} /></div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">AI provider</h2>
          </div>
          {settings && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Last updated {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—'}
            </p>
          )}
        </header>

        <div className="p-4 space-y-5">
          {aiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={14} /> {aiError}
            </div>
          )}

          {/* Provider selector */}
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">Active provider</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {([
                { id: 'auto',      label: 'Auto',       desc: 'Pick whichever has a key' },
                { id: 'anthropic', label: 'Anthropic',  desc: 'Claude' },
                { id: 'openai',    label: 'OpenAI',     desc: 'GPT' },
                { id: 'groq',      label: 'Groq',       desc: 'Llama · Free tier' },
                { id: 'none',      label: 'Disabled',   desc: 'AI features off' },
              ] as const).map((opt) => {
                const active = aiDraft.provider === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAiDraft((d) => ({ ...d, provider: opt.id }))}
                    className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-zinc-700 hover:border-indigo-300'
                    }`}
                  >
                    <p className={`text-[11px] font-black uppercase tracking-tight ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-pine dark:text-zinc-100'}`}>{opt.label}</p>
                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Anthropic block */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-slate-400" />
                <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-wider">Anthropic (Claude)</p>
              </div>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                settings?.hasAnthropicApiKey
                  ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
              }`}>
                {settings?.hasAnthropicApiKey ? <><Check size={10} /> Key set</> : <><X size={10} /> No key</>}
              </span>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">API key</label>
              <div className="relative">
                <input
                  type={revealed.anthropicApiKey ? 'text' : 'password'}
                  value={aiDraft.anthropicApiKey}
                  onChange={(e) => setAiDraft((d) => ({ ...d, anthropicApiKey: e.target.value }))}
                  placeholder={settings?.hasAnthropicApiKey ? '••••••••  (leave blank to keep current)' : 'sk-ant-…'}
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button type="button" onClick={() => toggleReveal('anthropicApiKey')} aria-label={revealed.anthropicApiKey ? 'Hide key' : 'Show key'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                  {revealed.anthropicApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1">
                  Get a key <ExternalLink size={10} />
                </a>
                {settings?.hasAnthropicApiKey && (
                  <button type="button" onClick={() => clearAiKey('anthropic')} disabled={savingAi} className="text-[10px] text-red-500 hover:underline">
                    Clear stored key
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Model (optional)</label>
              <input
                value={aiDraft.anthropicModel}
                onChange={(e) => setAiDraft((d) => ({ ...d, anthropicModel: e.target.value }))}
                placeholder="claude-sonnet-4-6  (default)"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* OpenAI block */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-slate-400" />
                <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-wider">OpenAI (GPT)</p>
              </div>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                settings?.hasOpenaiApiKey
                  ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
              }`}>
                {settings?.hasOpenaiApiKey ? <><Check size={10} /> Key set</> : <><X size={10} /> No key</>}
              </span>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">API key</label>
              <div className="relative">
                <input
                  type={revealed.openaiApiKey ? 'text' : 'password'}
                  value={aiDraft.openaiApiKey}
                  onChange={(e) => setAiDraft((d) => ({ ...d, openaiApiKey: e.target.value }))}
                  placeholder={settings?.hasOpenaiApiKey ? '••••••••  (leave blank to keep current)' : 'sk-proj-…'}
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button type="button" onClick={() => toggleReveal('openaiApiKey')} aria-label={revealed.openaiApiKey ? 'Hide key' : 'Show key'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                  {revealed.openaiApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1">
                  Get a key <ExternalLink size={10} />
                </a>
                {settings?.hasOpenaiApiKey && (
                  <button type="button" onClick={() => clearAiKey('openai')} disabled={savingAi} className="text-[10px] text-red-500 hover:underline">
                    Clear stored key
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Model (optional)</label>
              <input
                value={aiDraft.openaiModel}
                onChange={(e) => setAiDraft((d) => ({ ...d, openaiModel: e.target.value }))}
                placeholder="gpt-4o-mini  (default)"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Groq block — free tier */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-slate-400" />
                <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-wider">Groq (Llama)</p>
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">Free tier</span>
              </div>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                settings?.hasGroqApiKey
                  ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
              }`}>
                {settings?.hasGroqApiKey ? <><Check size={10} /> Key set</> : <><X size={10} /> No key</>}
              </span>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">API key</label>
              <div className="relative">
                <input
                  type={revealed.groqApiKey ? 'text' : 'password'}
                  value={aiDraft.groqApiKey}
                  onChange={(e) => setAiDraft((d) => ({ ...d, groqApiKey: e.target.value }))}
                  placeholder={settings?.hasGroqApiKey ? '••••••••  (leave blank to keep current)' : 'gsk_…'}
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button type="button" onClick={() => toggleReveal('groqApiKey')} aria-label={revealed.groqApiKey ? 'Hide key' : 'Show key'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                  {revealed.groqApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1">
                  Get a free key <ExternalLink size={10} />
                </a>
                {settings?.hasGroqApiKey && (
                  <button type="button" onClick={() => clearAiKey('groq')} disabled={savingAi} className="text-[10px] text-red-500 hover:underline">
                    Clear stored key
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Model (optional)</label>
              <input
                value={aiDraft.groqModel}
                onChange={(e) => setAiDraft((d) => ({ ...d, groqModel: e.target.value }))}
                placeholder="llama-3.3-70b-versatile  (default)"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3 pt-1">
            {aiSavedAt && Date.now() - aiSavedAt < 4000 && (
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                <Check size={11} /> Saved
              </span>
            )}
            <button
              type="button"
              onClick={saveAiSettings}
              disabled={savingAi}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {savingAi ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {savingAi ? 'Saving…' : 'Save AI settings'}
            </button>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700 px-3 py-2.5 text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            <p><strong className="text-pine dark:text-zinc-200">How it works:</strong> Keys are encrypted at rest (AES-256-GCM) and never returned to the dashboard. Save flushes the in-process AI client cache on the next request, so a key change goes live immediately — no redeploy. Set provider to <em>Auto</em> to let the backend pick whichever key is present.</p>
          </div>
        </div>
      </section>
      </>)}

      {/* Subscription packages section removed — managed under the Plans admin page. */}

    </div>
  );
};

export default PlatformSettingsPage;
