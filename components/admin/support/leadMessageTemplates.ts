import type { DemoRequest } from '../../../services/modules/demoRequests.api';

/**
 * First-touch and follow-up messages for the outreach queue.
 *
 * Source of truth for the wording is the vault's marketing scripts
 * (`11 - Marketing/Scripts/Outreach scripts`). These are DRAFTS the sender
 * reads and edits before anything goes out — the panel never sends on its own.
 *
 * ⚠️ Only say what is true of the plan being pitched. The free first month and
 * the website bundle come from the pricing notes; if either changes, change it
 * here and in the vault, not just in one place.
 */

export interface MessageContext {
  /** "Hi Dr Wanjiru," / "Hi Royal Crest Veterinary Clinic team," */
  greeting: string;
  clinic: string;
  /** Town, when the research has one — "people searching for a vet in Kitengela". */
  town: string;
  sign: string;
  link: string;
}

export interface LeadMessageTemplate {
  id: string;
  label: string;
  /** Only offered (and listed first) when the clinic has no website. */
  needsNoWebsite?: boolean;
  /** Email subject line (WhatsApp ignores it). */
  subject: (c: MessageContext) => string;
  body: (c: MessageContext) => string;
  forSupplier?: boolean;
  forClinic?: boolean;
}

/**
 * What is true today: pet owners and farmers have their own portal where they
 * search for clinics (by name, town or nearest to them) and book. Only clinics
 * the platform has verified appear in that search, so this says clinics "can be
 * found" and does not promise more clients.
 */
const communityLine = 'VetHubCore is also a community: pet owners and farmers have their own portal where they search for clinics near them and book, so new clients can find you there.';

const stopLine = 'If this isn\'t for you, just say and I won\'t message again.';

export const LEAD_TEMPLATES: LeadMessageTemplate[] = [
  {
    id: 'first_site',
    label: 'First message (no website)',
    forClinic: true,
    needsNoWebsite: true,
    subject: c => `A website for ${c.clinic}`,
    body: c =>
`${c.greeting}

I'm ${c.sign} from VetHubCore. We make practice software for vet clinics in Kenya, with M-Pesa built into the billing, and we build websites for clinics too.

${communityLine}

I noticed ${c.clinic} doesn't have a website yet. We can build and host one for you${c.town ? `, so people searching for a vet in ${c.town} can find you and book` : ''}, and VetHubCore keeps your bookings, records and bills in one place.

Would a 2-minute video of how it works be useful? If not, no problem.`,
  },
  {
    id: 'first',
    label: 'First message',
    forClinic: true,
    subject: c => `Booking messages at ${c.clinic}`,
    body: c =>
`${c.greeting}

I'm ${c.sign} from VetHubCore. We make practice software for vet clinics in Kenya, with M-Pesa built into the billing.

${communityLine}

I saw ${c.clinic} and thought of all the booking messages that must pile up in WhatsApp. Would a 2-minute video of how other clinics handle that be useful? If not, no problem.`,
  },
  {
    id: 'yes',
    label: 'They said yes',
    forClinic: true,
    subject: c => `The 2-minute video for ${c.clinic}`,
    body: c =>
`Great, here it is: ${c.link}

The first month is full-access and free, with no card, so you can test it on one day of appointments. Want me to set that up?`,
  },
  {
    id: 'follow3',
    label: 'Follow-up, day 3',
    forClinic: true,
    forSupplier: true,
    subject: c => `Following up: ${c.clinic}`,
    body: c =>
`${c.greeting}

Following up in case my first message got buried. Here is the 2-minute look at bookings and invoicing: ${c.link}

Happy to answer anything. ${stopLine}`,
  },
  {
    id: 'follow7',
    label: 'Follow-up, day 7',
    forClinic: true,
    forSupplier: true,
    subject: c => `Last note about ${c.clinic}`,
    body: c =>
`${c.greeting}

Last note from me. Clinics usually start by testing it on one day of appointments, and I can set that up whenever you like. If it's not the right time, I'll leave you be.

${c.sign}`,
  },
  {
    id: 'last',
    label: 'Closing note, day 14',
    forClinic: true,
    forSupplier: true,
    subject: c => `Closing the loop, ${c.clinic}`,
    body: c =>
`I'll stop here so I don't clutter your phone. If it ever becomes useful: vethubcore.com. All the best with ${c.clinic}.

${c.sign}`,
  },
  {
    id: 'bundle',
    label: 'Website + VetHubCore',
    forClinic: true,
    subject: c => `A website for ${c.clinic}`,
    body: c =>
`${c.greeting}

Clinics without a website lose bookings to the ones that have one. I can build and host yours: free if you take VetHubCore Pro for two years, or KES 75,000 on a one-year plan. Want to see an example site first?

${c.sign}`,
  },
  {
    id: 'supplier',
    label: 'Supplier: first message',
    forSupplier: true,
    subject: c => `Reaching vet clinics: ${c.clinic}`,
    body: c =>
`${c.greeting}

${c.sign} from Nairobi here. I run VetHubCore, and vet clinics on it can order from suppliers on the platform. I thought ${c.clinic} may want to be where those clinics already are. Open to a short call about listing your products?

${stopLine}`,
  },
];

const SUPPLIER_TYPES = new Set(['MANUFACTURER', 'DISTRIBUTOR', 'RETAILER', 'LAB_EQUIPMENT']);

export const isSupplierLead = (lead: Pick<DemoRequest, 'orgType'>) =>
  !!lead.orgType && SUPPLIER_TYPES.has(String(lead.orgType));

export function templatesFor(lead: Pick<DemoRequest, 'orgType'>): LeadMessageTemplate[] {
  const noSite = hasNoWebsite(lead);
  return LEAD_TEMPLATES
    .filter(t => (isSupplierLead(lead) ? t.forSupplier : t.forClinic))
    .filter(t => !t.needsNoWebsite || noSite);
}

/**
 * True when the research says there is no site: an empty website field, or the
 * sheet's own note ("Website Status: None", "No website"). Suppliers are never
 * pitched a website here.
 */
export function hasNoWebsite(lead: Pick<DemoRequest, 'website' | 'message' | 'orgType'>): boolean {
  if (isSupplierLead(lead)) return false;
  if ((lead.website || '').trim()) return false;
  const msg = String(lead.message || '');
  // Researched leads carry a status line; an inbound request with no website
  // field is not evidence of anything, so only trust the explicit note.
  return /website status:\s*none|no website/i.test(msg);
}

/** "Hi Dr Wanjiru," when there is a person's name, otherwise a team greeting. */
export function greetingFor(lead: Pick<DemoRequest, 'name' | 'clinicName'>): string {
  const clinic = (lead.clinicName || '').trim();
  const name = (lead.name || '').trim();
  const isPerson = name && name.toLowerCase() !== clinic.toLowerCase() && !/clinic|vet|hospital|animal|ltd|limited|centre|center|agrovet|pharm/i.test(name);
  if (isPerson) return `Hi ${name.split(/\s+/).slice(0, 2).join(' ')},`;
  return `Hi ${clinic || name || 'there'} team,`;
}

const DIAL: Record<string, string> = {
  KENYA: '254', UGANDA: '256', TANZANIA: '255', RWANDA: '250', ETHIOPIA: '251',
  NIGERIA: '234', GHANA: '233', 'SOUTH AFRICA': '27', ZAMBIA: '260', ZIMBABWE: '263',
  MALAWI: '265', BOTSWANA: '267', 'UNITED KINGDOM': '44', UK: '44', 'UNITED STATES': '1', USA: '1',
};

/**
 * Digits-only international number for wa.me, or null when it can't be made
 * safely. A leading 0 only becomes a country code when the lead's country is
 * known — guessing Kenya for a Tanzanian number would message a stranger.
 */
export function whatsappNumber(phone?: string | null, country?: string | null): string | null {
  if (!phone) return null;
  const raw = phone.trim();
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) {
    const cc = DIAL[String(country || '').trim().toUpperCase()];
    if (!cc) return null;
    d = cc + d.slice(1);
  }
  return d.length >= 10 && d.length <= 15 ? d : null;
}
