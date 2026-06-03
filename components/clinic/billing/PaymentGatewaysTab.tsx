import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Smartphone,
  Check,
  Save,
  RefreshCw,
  AlertCircle,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { paymentGatewaysAPI } from '../../../services/modules/paymentGateways.api';
import { dialog } from '../../../services';
import type {
  PaymentGatewayConfig,
  PaymentProvider,
  UpsertGatewayPayload,
} from '../../../services/modules/paymentGateways.api';

interface Props {
  clinicId: number | string;
}

type FieldSpec = { key: string; label: string; placeholder?: string };

type ProviderDef = {
  provider: PaymentProvider;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  blurb: string;
  pickerTagline: string;
  publicFields: FieldSpec[];
  secretFields: FieldSpec[];
};

// Add a new gateway by appending an entry here — the picker and setup view
// pick it up automatically.
const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    provider: 'STRIPE',
    title: 'Stripe (Card payments)',
    icon: CreditCard,
    blurb: 'Accept Visa / Mastercard / Apple Pay via your own Stripe account.',
    pickerTagline: 'Visa · Mastercard · Apple Pay',
    publicFields: [
      { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_test_...' },
      { key: 'accountCountry', label: 'Country (ISO-2)', placeholder: 'KE' },
    ],
    secretFields: [
      { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_test_... or sk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Signing Secret', placeholder: 'whsec_...' },
    ],
  },
  {
    provider: 'MPESA',
    title: 'M-Pesa Daraja (STK Push)',
    icon: Smartphone,
    blurb: 'Customers pay with M-Pesa; money lands in your Till / Paybill.',
    pickerTagline: 'Safaricom Daraja · STK Push',
    publicFields: [
      { key: 'shortcode', label: 'Till / Paybill Shortcode', placeholder: '174379' },
      { key: 'businessShortcode', label: 'Business Shortcode (if different)', placeholder: 'Optional' },
      { key: 'accountReference', label: 'Account Reference', placeholder: 'VetHubCore' },
      { key: 'transactionDesc', label: 'Transaction Description', placeholder: 'Veterinary' },
    ],
    secretFields: [
      { key: 'consumerKey', label: 'Consumer Key' },
      { key: 'consumerSecret', label: 'Consumer Secret' },
      { key: 'passkey', label: 'STK Passkey' },
    ],
  },
  {
    provider: 'PAYSTACK',
    title: 'Paystack (Card + Mobile Money)',
    icon: CreditCard,
    blurb: 'One checkout for cards, bank, and mobile money (incl. M-Pesa) via your Paystack account.',
    pickerTagline: 'Cards · Bank · Mobile Money',
    publicFields: [
      { key: 'publicKey', label: 'Public Key', placeholder: 'pk_test_... or pk_live_...' },
      { key: 'callbackUrl', label: 'Return URL (optional)', placeholder: 'Where to send the payer after payment' },
    ],
    secretFields: [
      { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_test_... or sk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Secret (optional)', placeholder: 'Defaults to your secret key' },
    ],
  },
];

type FormState = {
  isTestMode: boolean;
  isActive: boolean;
  displayName: string;
  publicConfig: Record<string, string>;
  credentials: Record<string, string>;
};

const emptyForm: FormState = {
  isTestMode: true,
  isActive: true,
  displayName: '',
  publicConfig: {},
  credentials: {},
};

const initialForms = (): Record<PaymentProvider, FormState> => {
  const out = {} as Record<PaymentProvider, FormState>;
  for (const def of PROVIDER_REGISTRY) out[def.provider] = { ...emptyForm };
  return out;
};

const PaymentGatewaysTab: React.FC<Props> = ({ clinicId }) => {
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<PaymentGatewayConfig[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<PaymentProvider, FormState>>(initialForms);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await paymentGatewaysAPI.list(clinicId);
        if (res.success && res.data) {
          setConfigs(res.data);
          const next = initialForms();
          for (const c of res.data) {
            next[c.provider] = {
              isTestMode: c.isTestMode,
              isActive: c.isActive,
              displayName: c.displayName || '',
              publicConfig: { ...c.publicConfig },
              credentials: {},
            };
          }
          setForms(next);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load payment gateways');
      } finally {
        setLoading(false);
      }
    })();
  }, [clinicId]);

  const getConfig = (provider: PaymentProvider) =>
    configs.find((c) => c.provider === provider);

  const updateForm = (provider: PaymentProvider, patch: Partial<FormState>) => {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  };

  const updateField = (
    provider: PaymentProvider,
    bucket: 'publicConfig' | 'credentials',
    key: string,
    value: string
  ) => {
    setForms((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [bucket]: { ...prev[provider][bucket], [key]: value },
      },
    }));
  };

  const save = async (provider: PaymentProvider) => {
    setSaving(provider);
    setError(null);
    try {
      const f = forms[provider];
      const payload: UpsertGatewayPayload = {
        mode: 'BYOK',
        isTestMode: f.isTestMode,
        isActive: f.isActive,
        displayName: f.displayName || undefined,
        publicConfig: f.publicConfig,
        credentials: Object.fromEntries(
          Object.entries(f.credentials).filter(([, v]) => v && v.trim().length > 0)
        ),
      };
      const res = await paymentGatewaysAPI.upsert(clinicId, provider, payload);
      if (res.success && res.data) {
        setConfigs((prev) => {
          const others = prev.filter((c) => c.provider !== provider);
          return [...others, res.data];
        });
        // Clear entered secrets after save — server returned masked state
        updateForm(provider, { credentials: {} });
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to save gateway');
    } finally {
      setSaving(null);
    }
  };

  const runTest = async (provider: PaymentProvider) => {
    setTesting(provider);
    try {
      const res = await paymentGatewaysAPI.test(clinicId, provider);
      setTestResult((prev) => ({
        ...prev,
        [provider]: {
          ok: !!(res.success && res.data?.ok),
          message: res.data?.message || (res.success ? 'OK' : 'Test failed'),
        },
      }));
    } catch (e: any) {
      setTestResult((prev) => ({
        ...prev,
        [provider]: { ok: false, message: e?.response?.data?.message || e?.message || 'Test failed' },
      }));
    } finally {
      setTesting(null);
    }
  };

  const toggleActive = async (provider: PaymentProvider, isActive: boolean) => {
    try {
      const res = await paymentGatewaysAPI.setActive(clinicId, provider, isActive);
      if (res.success && res.data) {
        setConfigs((prev) => prev.map((c) => (c.provider === provider ? res.data : c)));
        updateForm(provider, { isActive });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle gateway');
    }
  };

  const remove = async (provider: PaymentProvider) => {
    const ok = await dialog.confirm({
      title: `Remove ${provider} gateway?`,
      message: 'Stored credentials will be revoked. You can reconfigure later.',
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await paymentGatewaysAPI.remove(clinicId, provider);
      setConfigs((prev) => prev.filter((c) => c.provider !== provider));
      updateForm(provider, { ...emptyForm });
    } catch (e: any) {
      setError(e?.message || 'Failed to remove gateway');
    }
  };

  const renderField = (
    provider: PaymentProvider,
    bucket: 'publicConfig' | 'credentials',
    spec: { key: string; label: string; placeholder?: string },
    config: PaymentGatewayConfig | undefined
  ) => {
    const f = forms[provider];
    const value = f[bucket][spec.key] || '';
    const isSecret = bucket === 'credentials';
    const secretAlreadySet = isSecret && config?.hasSecret?.[spec.key];
    const showKey = `${provider}.${spec.key}`;
    const reveal = !!showSecret[showKey];

    return (
      <div key={spec.key} className="space-y-1.5">
        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 flex items-center gap-1.5">
          {spec.label}
          {isSecret && <Shield size={10} className="text-seafoam/70" />}
          {secretAlreadySet && (
            <span className="ml-auto text-[8px] font-bold text-emerald-600 normal-case">• stored</span>
          )}
        </label>
        <div className="relative">
          <input
            type={isSecret && !reveal ? 'password' : 'text'}
            value={value}
            placeholder={
              secretAlreadySet
                ? 'Leave blank to keep current — enter a new value to replace'
                : spec.placeholder
            }
            onChange={(e) => updateField(provider, bucket, spec.key, e.target.value)}
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20 pr-9"
            autoComplete="off"
          />
          {isSecret && value && (
            <button
              type="button"
              onClick={() => setShowSecret((prev) => ({ ...prev, [showKey]: !reveal }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-seafoam"
            >
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderProviderSetup = (def: ProviderDef) => {
    const { provider, title, icon: Icon, publicFields, secretFields, blurb } = def;
    const config = getConfig(provider);
    const f = forms[provider];
    const result = testResult[provider];

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="p-1.5 bg-seafoam text-white rounded-lg shadow-md">
            <Icon size={16} />
          </div>
          <div className="flex-1">
            <h2 className="section-header">{title}</h2>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5 normal-case">{blurb}</p>
          </div>
          {config && (
            <span
              className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                config.isActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {config.isActive ? 'Active' : 'Disabled'}
            </span>
          )}
        </div>

        {/* Mode toggles */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={f.isTestMode}
              onChange={(e) => updateForm(provider, { isTestMode: e.target.checked })}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
              Test / Sandbox
            </span>
          </label>
          <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => {
                updateForm(provider, { isActive: e.target.checked });
                if (config) toggleActive(provider, e.target.checked);
              }}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
              Accept Payments
            </span>
          </label>
        </div>

        <div className="space-y-3">
          {publicFields.map((spec) => renderField(provider, 'publicConfig', spec, config))}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3">
          {secretFields.map((spec) => renderField(provider, 'credentials', spec, config))}
        </div>

        {result && (
          <div
            className={`flex items-start gap-2 p-2.5 rounded-lg text-[10px] font-bold ${
              result.ok
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-rose-50 text-rose-800'
            }`}
          >
            {result.ok ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{result.message}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => save(provider)}
            disabled={saving === provider}
            className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-2.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving === provider ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {saving === provider ? 'SAVING' : 'SAVE'}
          </button>
          <button
            onClick={() => runTest(provider)}
            disabled={testing === provider || !config}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 flex items-center gap-1.5"
          >
            {testing === provider ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            TEST
          </button>
          {config && (
            <button
              onClick={() => remove(provider)}
              className="px-3 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 flex items-center gap-1.5"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-8 shadow-sm text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
        Loading gateways...
      </div>
    );
  }

  const renderPicker = () => (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/50">
        <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
          Payment Gateways
        </p>
        <span className="text-[9px] font-bold text-slate-400 normal-case">
          {configs.length} configured · {PROVIDER_REGISTRY.length - configs.length} available
        </span>
      </div>
      <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800">
        <span className="w-7" />
        <span>Provider</span>
        <span className="text-right w-20">Status</span>
        <span className="w-4" />
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
        {PROVIDER_REGISTRY.map((def) => {
          const { provider, title, icon: Icon, pickerTagline } = def;
          const config = getConfig(provider);
          const status = !config
            ? { label: 'Not set up', cls: 'bg-slate-100 text-slate-500' }
            : config.isActive
              ? { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' }
              : { label: 'Disabled', cls: 'bg-amber-100 text-amber-700' };

          return (
            <li key={provider}>
              <button
                type="button"
                onClick={() => setSelectedProvider(provider)}
                className="group w-full text-left grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2.5 hover:bg-seafoam/5 dark:hover:bg-zinc-800/70 active:bg-seafoam/10 transition-colors"
              >
                <div className="p-1.5 bg-seafoam text-white rounded-lg shadow-sm">
                  <Icon size={14} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-wide truncate">
                    {title}
                  </h3>
                  <p className="text-[9px] font-medium text-slate-500 normal-case truncate">
                    {pickerTagline}
                  </p>
                </div>
                <span
                  className={`justify-self-end text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap ${status.cls}`}
                >
                  {status.label}
                </span>
                <div className="text-slate-300 group-hover:text-seafoam transition-colors">
                  {config ? <ChevronRight size={14} /> : <Plus size={14} />}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const selectedDef = selectedProvider
    ? PROVIDER_REGISTRY.find((d) => d.provider === selectedProvider)
    : null;

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4">
      <div className="bg-seafoam/10 dark:bg-zinc-800 border border-seafoam/30 rounded-xl p-4 flex items-start gap-3">
        <Shield className="text-seafoam shrink-0 mt-0.5" size={16} />
        <div>
          <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-wide">
            Bring your own payment keys
          </p>
          <p className="text-[10px] text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
            Connect each clinic or branch to its own payment account. Payments settle directly into your
            merchant of record. Secrets are encrypted at rest (AES-256-GCM) — VetHubCore never sees the plaintext
            after save.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-[10px] font-bold flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!selectedDef && renderPicker()}

      {selectedDef && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setSelectedProvider(null);
              setTestResult({});
            }}
            className="flex items-center gap-1.5 text-[10px] font-black text-seafoam uppercase tracking-widest hover:text-pine dark:hover:text-zinc-100 transition-colors"
          >
            <ChevronLeft size={14} />
            All gateways
          </button>
          {renderProviderSetup(selectedDef)}
        </div>
      )}
    </div>
  );
};

export default PaymentGatewaysTab;
