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
  // Mutable animal with the server's breeding arithmetic mirrored (farmRepro.ts) so the page has real dates to show.
  const animal = { ...bika, photos: [], pregnantSince: null, breedingMethod: null, lactatingSince: '2026-06-01', driedOffOn: null };
  const DAYMS = 86400000;
  const dayISO = (d) => new Date(d).toISOString().slice(0, 10);
  const addD = (iso, n) => dayISO(new Date(iso + 'T00:00:00Z').getTime() + n * DAYMS);
  const diffD = (iso) => Math.round((new Date(iso + 'T00:00:00Z').getTime() - new Date(dayISO(Date.now()) + 'T00:00:00Z').getTime()) / DAYMS);
  const withRepro = () => {
    const a = animal; const due = a.isPregnant ? (a.expectedDueOn ? String(a.expectedDueOn).slice(0, 10) : a.pregnantSince ? addD(a.pregnantSince, 283) : null) : null;
    const dry = due ? addD(due, -60) : null;
    return { ...a, repro: {
      gestationDays: 283, dryOffDays: 60, pregnantSince: a.pregnantSince, daysPregnant: a.isPregnant && a.pregnantSince ? -diffD(a.pregnantSince) : null,
      dueOn: due, dueIsEstimate: !!due && !a.expectedDueOn, daysToDue: due ? diffD(due) : null,
      dryOffOn: dry, dryOffInDays: a.isLactating && dry ? diffD(dry) : null, nextMilkingOn: due,
      daysInMilk: a.isLactating && a.lactatingSince ? -diffD(a.lactatingSince) : null, lactatingSince: a.lactatingSince, driedOffOn: a.driedOffOn, breedingMethod: a.breedingMethod,
    } };
  };
  await ctx.route('https://storage.test/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'PUT,OPTIONS' }, body: '' }));
  const PNG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#8a6"/></svg>');
  const stock = [{ id: 's1', farmId: 'f1', name: 'Dairy meal', category: 'FEED', baseUnit: 'KG', baleKg: null, quantity: 100, minThreshold: 20, notes: null, updatedAt: new Date().toISOString() }];
  const movements = [];
  const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const reminders = [
    { id: 'r1', farmId: 'f1', farmAnimalId: 'a1', animalName: 'Bika', kind: 'DUE_SOON', title: 'Bika is due', notes: 'Estimated from the service date — confirm with your vet.', dueOn: inDays(5), status: 'PENDING', source: 'SYSTEM', fromClinic: null },
    { id: 'r2', farmId: 'f1', farmAnimalId: 'a1', animalName: 'Bika', kind: 'DRY_OFF', title: 'Dry off Bika (stop milking)', notes: null, dueOn: inDays(-3), status: 'PENDING', source: 'SYSTEM', fromClinic: null },
    { id: 'r3', farmId: 'f1', farmAnimalId: null, animalName: null, kind: 'ADVICE', title: 'Book a pre-calving check', notes: 'Bring her weight record.', dueOn: inDays(10), status: 'PENDING', source: 'CLINIC', fromClinic: 'Westlands Paws' },
  ];
  const flags = (i) => ({ ...i, low: i.minThreshold > 0 && i.quantity <= i.minThreshold, empty: i.quantity <= 0 });
  const KG = { KG: 1, BAG_20: 20, BAG_50: 50, BAG_100: 100 };
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
      if (/\/stock\/use$/.test(path)) {
        const it = stock.find((x) => x.id === body.itemId); const base = (KG[body.unit] ?? (body.unit === 'BALE' ? (it.baleKg || 0) : 1)) * body.quantity;
        const short = base > it.quantity; it.quantity = Math.max(0, it.quantity - base);
        feedLogs.unshift({ id: 'l' + (feedLogs.length + 1), fedAt: body.fedAt ?? new Date().toISOString(), quantityKg: base, notes: it.name });
        movements.unshift({ id: 'm' + movements.length, itemId: it.id, kind: 'USE', quantity: -base, occurredAt: new Date().toISOString(), note: null });
        return ok({ item: flags(it), ranShort: short, shortBy: short ? base - it.quantity : 0 });
      }
      if (/\/stock\/items$/.test(path)) { const item = { id: 's' + (stock.length + 1), farmId: 'f1', name: body.name, category: body.category, baseUnit: body.baseUnit ?? 'KG', baleKg: null, quantity: 0, minThreshold: body.minThreshold ?? 0, notes: null, updatedAt: new Date().toISOString() }; stock.push(item); return ok({ item: flags(item) }); }
      if (/farm-stock\/[^/]+\/purchase$/.test(path)) { const it = stock.find((x) => path.includes('/' + x.id + '/')); const base = (KG[body.unit] ?? (body.unit === 'BALE' ? (it.baleKg || 0) : 1)) * body.quantity; it.quantity += base; movements.unshift({ id: 'm' + movements.length, itemId: it.id, kind: 'PURCHASE', quantity: base, occurredAt: new Date().toISOString(), note: null }); return ok({ item: flags(it) }); }
      if (/farm-stock\/[^/]+\/adjust$/.test(path)) { const it = stock.find((x) => path.includes('/' + x.id + '/')); it.quantity = (KG[body.unit] ?? 1) * body.quantity; return ok({ item: flags(it) }); }
      if (/farm-stock\/[^/]+$/.test(path) && req.method() === 'PATCH') { const it = stock.find((x) => path.endsWith('/' + x.id)); if (body.baleKg != null) it.baleKg = body.baleKg; return ok({ item: flags(it) }); }
      if (/farm-animals\/a1\/photos\/upload-url$/.test(path)) return ok({ uploadUrl: 'https://storage.test/put/' + Date.now() + '.jpg', publicUrl: PNG + '#' + animal.photos.length, key: 'k' });
      if (/farm-animals\/a1\/photos$/.test(path)) { const photo = { id: 'ph' + (animal.photos.length + 1), url: body.url, caption: null, createdAt: new Date().toISOString() }; animal.photos.unshift(photo); if (!animal.avatarUrl) animal.avatarUrl = body.url; return ok({ photo }); }
      if (/farm-animal-photos\/[^/]+\/cover$/.test(path)) { const ph = animal.photos.find((x) => path.includes('/' + x.id + '/')); animal.avatarUrl = ph.url; return ok({ ok: true }); }
      if (/farm-animal-photos\/[^/]+$/.test(path) && req.method() === 'DELETE') { const i = animal.photos.findIndex((x) => path.endsWith('/' + x.id)); const [gone] = animal.photos.splice(i, 1); if (animal.avatarUrl === gone.url) animal.avatarUrl = animal.photos[0]?.url ?? null; return ok({ ok: true }); }
      if (/farm-animals\/a1\/calved$/.test(path)) { Object.assign(animal, { isPregnant: false, pregnantSince: null, expectedDueOn: null, breedingMethod: null, isLactating: true, lactatingSince: body.date, driedOffOn: null }); return ok({ ok: true, calvedOn: body.date }); }
      if (/farm-animals\/a1$/.test(path) && req.method() === 'PATCH') {
        Object.assign(animal, body);
        if (body.isPregnant === false) Object.assign(animal, { pregnantSince: null, expectedDueOn: null, breedingMethod: null });
        if (body.pregnantSince && body.expectedDueOn === undefined) animal.expectedDueOn = null;
        if (body.driedOffOn) animal.isLactating = false;
        if (body.isLactating === true) animal.driedOffOn = null;
        return ok({ animal: withRepro() });
      }
      if (/farm-reminders\/[^/]+$/.test(path) && req.method() === 'PATCH') { const r = reminders.find((x) => path.endsWith('/' + x.id)); r.status = body.status; return ok({ ok: true }); }
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
    if (path === '/portal/me/farms/f1/animals') return ok({ animals: [withRepro()] });
    if (path === '/portal/me/farm-animals/a1') return ok({ animal: withRepro() });
    if (path === '/portal/me/farm-animals/a1/summary') return ok({ feed: { kg30d: 42.5, byItem: [{ name: 'Dairy meal', kg: 42.5 }] }, milk: { litres30d: 310, litres7d: 80, perDay7d: 11.4 } });
    if (/feeding-logs$/.test(path)) return ok({ logs: feedLogs });
    if (/produce-records$/.test(path)) return ok({ records: produceRecs });
    if (path === '/portal/me/farms/f1/produce') return ok({ schedules: [], records: [] });
    if (path === '/portal/me/farms/f1/feeding') return ok({ plans: [] });
    if (path === '/portal/me/farms/f1/visit-requests') return ok({ requests: [] });
    if (path === '/portal/me/farms/f1/medical') return ok({ tier: 'FULL', linkedClinicId: null, treatments: [], clinical: [], withholding: [], spentOnHealth: 0, contacts: [] });
    if (path === '/portal/me/farms/f1/reminders') return ok({ reminders: reminders.filter((r) => r.status === 'PENDING') });
    if (path === '/portal/me/farms/f1/stock') return ok({ items: stock.map(flags), lowCount: stock.filter((i) => flags(i).low).length });
    if (/farm-stock\/[^/]+\/movements$/.test(path)) return ok({ movements });
    if (path === '/portal/me/farm-clinics') { const unavailable = [{ id: 'c9', name: 'Westlands Paws Vet Clinic', city: 'Nairobi', phone: '0700 000 000' }]; return ok({ clinics: [], unavailable, invitedClinicIds: invited, filtered: 1 }); }
    if (path === '/portal/me/farms/f1/clinic-invites') return ok({ invites: invited.map((id) => ({ id: 'i1', clinicId: id, clinicName: 'Westlands Paws Vet Clinic', askedAt: new Date().toISOString() })) });
    if (path === '/portal/me/plan') return ok({ package: null });
    // Everything else the shell polls (messages, invoices, notifications…): empty but well-formed.
    unmocked.push(path);
    return ok({ invoices: [], messages: [], appointments: [], pets: [], clinics: [], notifications: [], unreadCount: 0, threads: [], items: [], farms: [], posts: [] });
  });
  return { browser, page, posts, unmocked, errors, stock, animal, reminders };
}

export const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png` });
