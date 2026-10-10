/**
 * Fake backend + signed-in farmer for the phone-sized browser tests in this folder.
 *
 * Nothing here talks to a real server: every /api/v1 call is answered from the
 * fixtures below, and anything the app POSTs is captured in `posts` so a test
 * can assert on exactly what a form would have sent. See README.md.
 */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

/** Where the dev server runs (`npm run dev`). */
export const BASE = process.env.E2E_BASE || 'http://localhost:3000';
export const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));

const bika = {
  id: 'a1', farmId: 'f1', animalGroupId: 'g1', animalGroupName: 'Dairy cows', name: 'Bika', species: 'Cattle',
  breed: 'Friesian', sex: 'FEMALE', dob: '2018-11-01', dobIsApprox: true, purpose: 'DAIRY', layingSince: null,
  tagNumber: null, rfidNumber: null, color: null, markings: null, weightValue: 496, weightUnit: 'kg',
  weighedOn: '2026-09-13T08:00:00.000Z', isPregnant: false, isLactating: true, expectedDueOn: null, status: 'ACTIVE',
  exitedOn: null, exitNote: null, acquiredOn: null, acquiredFrom: null, avatarUrl: null, notes: null,
  weights: [{ id: 'w1', weighedOn: '2026-09-13T08:00:00.000Z', weightValue: 496, weightUnit: 'kg' }],
};
const user = { id: '101', name: 'Kamau Wa Mwaura', firstName: 'Kamau', surname: 'Mwaura', email: 'k@example.com', role: 'CLIENT', emailVerified: true, clinicIds: [], customPermissions: [], avatar: '' };
const holdings = {
  petCount: 0, farmCount: 1, hasPets: false, hasFarms: true, canUseFarmMode: true, farmTier: 'FULL', optedIn: true,
  farmLimit: 0, groupLimit: 0, planName: 'Farmer', planTier: 2, suggestedMode: 'FARM', defaultSide: 'FARM', needsSideChoice: false,
  sides: { pets: { active: false, optedIn: false, count: 0, available: true }, farm: { active: true, optedIn: true, count: 1, available: true } },
};
const groups = [
  { id: 'g1', name: 'Dairy cows', species: 'Cattle', breed: null, headCount: 1, purpose: 'DAIRY', housing: null, males: 0, females: 1, adults: 1, young: 0, pregnant: 0, lactating: 1, purposeCounts: {} },
  { id: 'g2', name: 'ZA Charity', species: 'Poultry', breed: null, headCount: 7, purpose: 'LAYER', housing: null, males: 0, females: 7, adults: 7, young: 0, pregnant: 0, lactating: 0, purposeCounts: { LAYER: 7 } },
];

/** Installs the fake backend + a signed-in farmer. Returns the log of POSTs and any unmocked calls. */
export async function launch({ width = 400, height = 781, dark = true } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: dark ? 'dark' : 'light' });
  await ctx.addInitScript((u) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('authTokens', JSON.stringify({ accessToken: 'test-token', refreshToken: 'r' }));
    localStorage.setItem('authUser', JSON.stringify(u));
    localStorage.setItem('vethub:portalMode', 'FARM');
  }, user);
  const page = await ctx.newPage();
  const posts = [];
  const feedLogs = [];
  const produceRecs = [];
  const unmocked = [];
  const invited = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '');
    const origin = req.headers()['origin'] || BASE;
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const ok = (data, extra = {}) => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ success: true, data, ...extra }) });

    if (req.method() !== 'GET') {
      let body = null; try { body = req.postDataJSON(); } catch { /* none */ }
      posts.push({ method: req.method(), path, body });
      if (/clinic-invites$/.test(path)) { invited.push(String(body?.clinicId)); return ok({ clinicId: body?.clinicId, clinicName: 'Westlands Paws Vet Clinic', status: 'PENDING', alreadyAsked: false }); }
      if (/feeding-logs$/.test(path)) { const log = { id: 'l' + (feedLogs.length + 1), fedAt: body?.fedAt ?? new Date().toISOString(), quantityKg: body?.quantityKg ?? null, notes: body?.notes ?? null }; feedLogs.unshift(log); return ok({ log }); }
      if (/produce-records$/.test(path)) { const record = { id: 'p' + (produceRecs.length + 1), produce: body?.produce, recordedOn: body?.recordedOn ?? new Date().toISOString(), quantity: body?.quantity, unit: body?.unit, notes: body?.notes ?? null }; produceRecs.unshift(record); return ok({ record }); }
      if (/weights$/.test(path)) return ok({ weight: { id: 'w2', weighedOn: new Date().toISOString(), weightValue: body?.weightValue, weightUnit: 'kg' } });
      if (/\/ledger$/.test(path)) return ok({ entry: { id: 'e1', ...body } });
      return ok({});
    }
    if (/\/auth\/me$/.test(path)) return ok({ user });
    if (path === '/portal/me/holdings') return ok(holdings);
    if (path === '/portal/me/farms') return ok({ farms: [{ id: 'f1', name: 'Kamau Wa Mwaura Farm', farmType: 'MIXED', county: 'Kiambu', location: null, sizeAcres: 2, clinic: null, headCount: 8, animalGroupCount: 2, cropPlotCount: 0 }] });
    if (path === '/portal/me/farms/f1') return ok({ animalGroups: groups, cropPlots: [] });
    if (path === '/portal/me/farms/f1/summary') return ok({ windowFrom: null, windowDays: 60, income: 0, expense: 0, net: 0, currency: 'KES', byCategory: [] });
    if (path === '/portal/me/farms/f1/ledger') return ok({ entries: [], windowFrom: null, windowDays: 60 });
    if (path === '/portal/me/farms/f1/animal-summary') return ok({ named: 1, byGroup: { g1: 1 } });
    if (path === '/portal/me/farms/f1/animals') return ok({ animals: [bika] });
    if (path === '/portal/me/farm-animals/a1') return ok({ animal: bika });
    if (/feeding-logs$/.test(path)) return ok({ logs: feedLogs });
    if (/produce-records$/.test(path)) return ok({ records: produceRecs });
    if (path === '/portal/me/farms/f1/produce') return ok({ schedules: [], records: [] });
    if (path === '/portal/me/farms/f1/feeding') return ok({ plans: [] });
    if (path === '/portal/me/farms/f1/visit-requests') return ok({ requests: [] });
    if (path === '/portal/me/farms/f1/medical') return ok({ tier: 'FULL', linkedClinicId: null, treatments: [], clinical: [], withholding: [], spentOnHealth: 0, contacts: [] });
    if (path === '/portal/me/farm-clinics') { const unavailable = [{ id: 'c9', name: 'Westlands Paws Vet Clinic', city: 'Nairobi', phone: '0700 000 000' }]; return ok({ clinics: [], unavailable, invitedClinicIds: invited, filtered: 1 }); }
    if (path === '/portal/me/farms/f1/clinic-invites') return ok({ invites: invited.map((id) => ({ id: 'i1', clinicId: id, clinicName: 'Westlands Paws Vet Clinic', askedAt: new Date().toISOString() })) });
    if (path === '/portal/me/plan') return ok({ package: null });
    // Everything else the shell polls (messages, invoices, notifications…): empty but well-formed.
    unmocked.push(path);
    return ok({ invoices: [], messages: [], appointments: [], pets: [], clinics: [], notifications: [], unreadCount: 0, threads: [], items: [], farms: [], posts: [] });
  });
  return { browser, page, posts, unmocked, errors };
}

export const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png` });
