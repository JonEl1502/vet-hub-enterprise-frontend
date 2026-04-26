// Country reference data for the signup flow + region-aware pricing.
// `region` drives which SubscriptionPackagePrice row is loaded.
// `currency` is informational (display-only); checkout currency is decided by the
// matched SubscriptionPackagePrice on the backend.

export type Region =
  | 'AFRICA'
  | 'ASIA'
  | 'LATAM'
  | 'MIDDLE_EAST'
  | 'EUROPE'
  | 'OCEANIA'
  | 'NORTH_AMERICA';

export interface Country {
  code: string;       // ISO-3166 alpha-2
  name: string;
  flag: string;       // emoji
  dialCode: string;   // E.164 prefix incl. +
  currency: string;   // ISO-4217
  region: Region;
}

export const COUNTRIES: Country[] = [
  // ── AFRICA ───────────────────────────────────────────────
  { code: 'KE', name: 'Kenya',         flag: '🇰🇪', dialCode: '+254', currency: 'KES', region: 'AFRICA' },
  { code: 'UG', name: 'Uganda',        flag: '🇺🇬', dialCode: '+256', currency: 'UGX', region: 'AFRICA' },
  { code: 'TZ', name: 'Tanzania',      flag: '🇹🇿', dialCode: '+255', currency: 'TZS', region: 'AFRICA' },
  { code: 'RW', name: 'Rwanda',        flag: '🇷🇼', dialCode: '+250', currency: 'RWF', region: 'AFRICA' },
  { code: 'ET', name: 'Ethiopia',      flag: '🇪🇹', dialCode: '+251', currency: 'ETB', region: 'AFRICA' },
  { code: 'NG', name: 'Nigeria',       flag: '🇳🇬', dialCode: '+234', currency: 'NGN', region: 'AFRICA' },
  { code: 'GH', name: 'Ghana',         flag: '🇬🇭', dialCode: '+233', currency: 'GHS', region: 'AFRICA' },
  { code: 'ZA', name: 'South Africa',  flag: '🇿🇦', dialCode: '+27',  currency: 'ZAR', region: 'AFRICA' },
  { code: 'EG', name: 'Egypt',         flag: '🇪🇬', dialCode: '+20',  currency: 'EGP', region: 'AFRICA' },
  { code: 'MA', name: 'Morocco',       flag: '🇲🇦', dialCode: '+212', currency: 'MAD', region: 'AFRICA' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', dialCode: '+225', currency: 'XOF', region: 'AFRICA' },
  { code: 'SN', name: 'Senegal',       flag: '🇸🇳', dialCode: '+221', currency: 'XOF', region: 'AFRICA' },
  { code: 'CM', name: 'Cameroon',      flag: '🇨🇲', dialCode: '+237', currency: 'XAF', region: 'AFRICA' },
  { code: 'ZM', name: 'Zambia',        flag: '🇿🇲', dialCode: '+260', currency: 'ZMW', region: 'AFRICA' },
  { code: 'ZW', name: 'Zimbabwe',      flag: '🇿🇼', dialCode: '+263', currency: 'ZWL', region: 'AFRICA' },
  { code: 'BW', name: 'Botswana',      flag: '🇧🇼', dialCode: '+267', currency: 'BWP', region: 'AFRICA' },
  { code: 'MZ', name: 'Mozambique',    flag: '🇲🇿', dialCode: '+258', currency: 'MZN', region: 'AFRICA' },

  // ── MIDDLE EAST ──────────────────────────────────────────
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dialCode: '+971', currency: 'AED', region: 'MIDDLE_EAST' },
  { code: 'SA', name: 'Saudi Arabia',         flag: '🇸🇦', dialCode: '+966', currency: 'SAR', region: 'MIDDLE_EAST' },
  { code: 'QA', name: 'Qatar',                flag: '🇶🇦', dialCode: '+974', currency: 'QAR', region: 'MIDDLE_EAST' },
  { code: 'KW', name: 'Kuwait',               flag: '🇰🇼', dialCode: '+965', currency: 'KWD', region: 'MIDDLE_EAST' },
  { code: 'BH', name: 'Bahrain',              flag: '🇧🇭', dialCode: '+973', currency: 'BHD', region: 'MIDDLE_EAST' },
  { code: 'OM', name: 'Oman',                 flag: '🇴🇲', dialCode: '+968', currency: 'OMR', region: 'MIDDLE_EAST' },
  { code: 'IL', name: 'Israel',               flag: '🇮🇱', dialCode: '+972', currency: 'ILS', region: 'MIDDLE_EAST' },
  { code: 'TR', name: 'Türkiye',              flag: '🇹🇷', dialCode: '+90',  currency: 'TRY', region: 'MIDDLE_EAST' },
  { code: 'JO', name: 'Jordan',               flag: '🇯🇴', dialCode: '+962', currency: 'JOD', region: 'MIDDLE_EAST' },
  { code: 'LB', name: 'Lebanon',              flag: '🇱🇧', dialCode: '+961', currency: 'LBP', region: 'MIDDLE_EAST' },

  // ── ASIA ────────────────────────────────────────────────
  { code: 'IN', name: 'India',         flag: '🇮🇳', dialCode: '+91',  currency: 'INR', region: 'ASIA' },
  { code: 'PK', name: 'Pakistan',      flag: '🇵🇰', dialCode: '+92',  currency: 'PKR', region: 'ASIA' },
  { code: 'BD', name: 'Bangladesh',    flag: '🇧🇩', dialCode: '+880', currency: 'BDT', region: 'ASIA' },
  { code: 'LK', name: 'Sri Lanka',     flag: '🇱🇰', dialCode: '+94',  currency: 'LKR', region: 'ASIA' },
  { code: 'NP', name: 'Nepal',         flag: '🇳🇵', dialCode: '+977', currency: 'NPR', region: 'ASIA' },
  { code: 'PH', name: 'Philippines',   flag: '🇵🇭', dialCode: '+63',  currency: 'PHP', region: 'ASIA' },
  { code: 'ID', name: 'Indonesia',     flag: '🇮🇩', dialCode: '+62',  currency: 'IDR', region: 'ASIA' },
  { code: 'VN', name: 'Vietnam',       flag: '🇻🇳', dialCode: '+84',  currency: 'VND', region: 'ASIA' },
  { code: 'TH', name: 'Thailand',      flag: '🇹🇭', dialCode: '+66',  currency: 'THB', region: 'ASIA' },
  { code: 'MY', name: 'Malaysia',      flag: '🇲🇾', dialCode: '+60',  currency: 'MYR', region: 'ASIA' },
  { code: 'SG', name: 'Singapore',     flag: '🇸🇬', dialCode: '+65',  currency: 'SGD', region: 'ASIA' },
  { code: 'HK', name: 'Hong Kong',     flag: '🇭🇰', dialCode: '+852', currency: 'HKD', region: 'ASIA' },
  { code: 'TW', name: 'Taiwan',        flag: '🇹🇼', dialCode: '+886', currency: 'TWD', region: 'ASIA' },
  { code: 'JP', name: 'Japan',         flag: '🇯🇵', dialCode: '+81',  currency: 'JPY', region: 'ASIA' },
  { code: 'KR', name: 'South Korea',   flag: '🇰🇷', dialCode: '+82',  currency: 'KRW', region: 'ASIA' },
  { code: 'CN', name: 'China',         flag: '🇨🇳', dialCode: '+86',  currency: 'CNY', region: 'ASIA' },
  { code: 'KH', name: 'Cambodia',      flag: '🇰🇭', dialCode: '+855', currency: 'KHR', region: 'ASIA' },
  { code: 'MM', name: 'Myanmar',       flag: '🇲🇲', dialCode: '+95',  currency: 'MMK', region: 'ASIA' },

  // ── EUROPE ──────────────────────────────────────────────
  { code: 'GB', name: 'United Kingdom',   flag: '🇬🇧', dialCode: '+44', currency: 'GBP', region: 'EUROPE' },
  { code: 'IE', name: 'Ireland',          flag: '🇮🇪', dialCode: '+353', currency: 'EUR', region: 'EUROPE' },
  { code: 'DE', name: 'Germany',          flag: '🇩🇪', dialCode: '+49', currency: 'EUR', region: 'EUROPE' },
  { code: 'FR', name: 'France',           flag: '🇫🇷', dialCode: '+33', currency: 'EUR', region: 'EUROPE' },
  { code: 'IT', name: 'Italy',            flag: '🇮🇹', dialCode: '+39', currency: 'EUR', region: 'EUROPE' },
  { code: 'ES', name: 'Spain',            flag: '🇪🇸', dialCode: '+34', currency: 'EUR', region: 'EUROPE' },
  { code: 'PT', name: 'Portugal',         flag: '🇵🇹', dialCode: '+351', currency: 'EUR', region: 'EUROPE' },
  { code: 'NL', name: 'Netherlands',      flag: '🇳🇱', dialCode: '+31', currency: 'EUR', region: 'EUROPE' },
  { code: 'BE', name: 'Belgium',          flag: '🇧🇪', dialCode: '+32', currency: 'EUR', region: 'EUROPE' },
  { code: 'CH', name: 'Switzerland',      flag: '🇨🇭', dialCode: '+41', currency: 'CHF', region: 'EUROPE' },
  { code: 'AT', name: 'Austria',          flag: '🇦🇹', dialCode: '+43', currency: 'EUR', region: 'EUROPE' },
  { code: 'SE', name: 'Sweden',           flag: '🇸🇪', dialCode: '+46', currency: 'SEK', region: 'EUROPE' },
  { code: 'NO', name: 'Norway',           flag: '🇳🇴', dialCode: '+47', currency: 'NOK', region: 'EUROPE' },
  { code: 'DK', name: 'Denmark',          flag: '🇩🇰', dialCode: '+45', currency: 'DKK', region: 'EUROPE' },
  { code: 'FI', name: 'Finland',          flag: '🇫🇮', dialCode: '+358', currency: 'EUR', region: 'EUROPE' },
  { code: 'PL', name: 'Poland',           flag: '🇵🇱', dialCode: '+48', currency: 'PLN', region: 'EUROPE' },
  { code: 'CZ', name: 'Czechia',          flag: '🇨🇿', dialCode: '+420', currency: 'CZK', region: 'EUROPE' },
  { code: 'GR', name: 'Greece',           flag: '🇬🇷', dialCode: '+30', currency: 'EUR', region: 'EUROPE' },
  { code: 'RO', name: 'Romania',          flag: '🇷🇴', dialCode: '+40', currency: 'RON', region: 'EUROPE' },
  { code: 'HU', name: 'Hungary',          flag: '🇭🇺', dialCode: '+36', currency: 'HUF', region: 'EUROPE' },
  { code: 'UA', name: 'Ukraine',          flag: '🇺🇦', dialCode: '+380', currency: 'UAH', region: 'EUROPE' },

  // ── NORTH AMERICA ───────────────────────────────────────
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1',   currency: 'USD', region: 'NORTH_AMERICA' },
  { code: 'CA', name: 'Canada',        flag: '🇨🇦', dialCode: '+1',   currency: 'CAD', region: 'NORTH_AMERICA' },
  { code: 'MX', name: 'Mexico',        flag: '🇲🇽', dialCode: '+52',  currency: 'MXN', region: 'LATAM' },

  // ── LATAM ──────────────────────────────────────────────
  { code: 'BR', name: 'Brazil',     flag: '🇧🇷', dialCode: '+55',  currency: 'BRL', region: 'LATAM' },
  { code: 'AR', name: 'Argentina',  flag: '🇦🇷', dialCode: '+54',  currency: 'ARS', region: 'LATAM' },
  { code: 'CL', name: 'Chile',      flag: '🇨🇱', dialCode: '+56',  currency: 'CLP', region: 'LATAM' },
  { code: 'CO', name: 'Colombia',   flag: '🇨🇴', dialCode: '+57',  currency: 'COP', region: 'LATAM' },
  { code: 'PE', name: 'Peru',       flag: '🇵🇪', dialCode: '+51',  currency: 'PEN', region: 'LATAM' },
  { code: 'UY', name: 'Uruguay',    flag: '🇺🇾', dialCode: '+598', currency: 'UYU', region: 'LATAM' },
  { code: 'EC', name: 'Ecuador',    flag: '🇪🇨', dialCode: '+593', currency: 'USD', region: 'LATAM' },
  { code: 'VE', name: 'Venezuela',  flag: '🇻🇪', dialCode: '+58',  currency: 'VES', region: 'LATAM' },

  // ── OCEANIA ─────────────────────────────────────────────
  { code: 'AU', name: 'Australia',   flag: '🇦🇺', dialCode: '+61',  currency: 'AUD', region: 'OCEANIA' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dialCode: '+64',  currency: 'NZD', region: 'OCEANIA' },
];

const BY_CODE: Record<string, Country> = COUNTRIES.reduce((acc, c) => {
  acc[c.code] = c;
  return acc;
}, {} as Record<string, Country>);

export function getCountry(code: string | null | undefined): Country | undefined {
  return code ? BY_CODE[code.toUpperCase()] : undefined;
}

// ── Region pricing multipliers (vs NORTH_AMERICA = 1.0) ───
export const REGION_MULTIPLIER: Record<Region, number> = {
  AFRICA: 0.4,
  ASIA: 0.5,
  LATAM: 0.65,
  MIDDLE_EAST: 0.8,
  EUROPE: 0.9,
  OCEANIA: 0.95,
  NORTH_AMERICA: 1.0,
};

export const REGION_LABEL: Record<Region, string> = {
  AFRICA: 'Africa',
  ASIA: 'Asia',
  LATAM: 'Latin America',
  MIDDLE_EAST: 'Middle East',
  EUROPE: 'Europe',
  OCEANIA: 'Oceania',
  NORTH_AMERICA: 'North America',
};

// ── Auto-detection ────────────────────────────────────────
// Browser timezone → ISO-2 country mapping. Covers the common cases; the rest
// fall through to a best-guess by timezone region prefix.
const TZ_TO_COUNTRY: Record<string, string> = {
  'Africa/Nairobi': 'KE', 'Africa/Kampala': 'UG', 'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kigali': 'RW', 'Africa/Addis_Ababa': 'ET', 'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH', 'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG',
  'Africa/Casablanca': 'MA', 'Africa/Abidjan': 'CI', 'Africa/Dakar': 'SN',
  'Africa/Douala': 'CM', 'Africa/Lusaka': 'ZM', 'Africa/Harare': 'ZW',
  'Africa/Gaborone': 'BW', 'Africa/Maputo': 'MZ',
  'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM',
  'Asia/Jerusalem': 'IL', 'Europe/Istanbul': 'TR', 'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
  'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Bangkok': 'TH', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Singapore': 'SG',
  'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Phnom_Penh': 'KH',
  'Asia/Yangon': 'MM',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE',
  'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Athens': 'GR',
  'Europe/Bucharest': 'RO', 'Europe/Budapest': 'HU', 'Europe/Kyiv': 'UA',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA',
  'America/Halifax': 'CA',
  'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Buenos_Aires': 'AR',
  'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE',
  'America/Montevideo': 'UY', 'America/Guayaquil': 'EC', 'America/Caracas': 'VE',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ',
};

export function detectCountryCode(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_TO_COUNTRY[tz]) return TZ_TO_COUNTRY[tz];
    // Fallback: pick first country whose region prefix matches the TZ continent
    if (tz) {
      const continent = tz.split('/')[0];
      const match = COUNTRIES.find((c) => {
        if (continent === 'Africa') return c.region === 'AFRICA';
        if (continent === 'Europe') return c.region === 'EUROPE';
        if (continent === 'Asia') return c.region === 'ASIA';
        if (continent === 'Australia' || continent === 'Pacific') return c.region === 'OCEANIA';
        return false;
      });
      if (match) return match.code;
    }
  } catch {
    // Intl unavailable (very old browsers) — fall through
  }
  // Last-resort fallback — try browser language country tag (e.g. "en-KE")
  try {
    const lang = navigator.language || (navigator.languages && navigator.languages[0]);
    if (lang && lang.includes('-')) {
      const cc = lang.split('-')[1].toUpperCase();
      if (BY_CODE[cc]) return cc;
    }
  } catch {
    // ignore
  }
  return null;
}
