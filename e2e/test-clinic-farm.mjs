import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
const BASE = 'http://localhost:3000';
const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ← ' + x}`); };

const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#8a6"/></svg>');
const animal = (o) => ({ farmId: 'f1', animalGroupId: 'g1', animalGroupName: 'Dairy cows', species: 'Cattle', breed: 'Friesian', sex: 'FEMALE', dob: null, dobIsApprox: false, purpose: 'DAIRY', layingSince: null, tagNumber: null, rfidNumber: null, color: null, markings: null, weightValue: 496, weightUnit: 'kg', weighedOn: iso(-20), isPregnant: false, isLactating: false, expectedDueOn: null, status: 'ACTIVE', exitedOn: null, exitNote: null, acquiredOn: null, acquiredFrom: null, avatarUrl: null, notes: null, weights: [{ id: 'w1', weighedOn: iso(-20), weightValue: 496, weightUnit: 'kg', notes: null }], ...o });
const animals = [
  animal({ id: 'a1', name: 'Bika', tagNumber: 'KE-12', avatarUrl: svg, isPregnant: true, isLactating: true,
    repro: { dueOn: iso(40), dueIsEstimate: true, daysToDue: 40, daysPregnant: 243, dryOffOn: iso(-20), dryOffInDays: -20, nextMilkingOn: iso(40), daysInMilk: 200, driedOffOn: null, breedingMethod: 'AI' } }),
  animal({ id: 'a2', name: 'Wanjiru', repro: { dueOn: null, dueIsEstimate: false, daysToDue: null, daysPregnant: null, dryOffOn: null, dryOffInDays: null, nextMilkingOn: null, daysInMilk: null, driedOffOn: null, breedingMethod: null } }),
];

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1300 }, deviceScaleFactor: 1, colorScheme: 'light' });
await ctx.addInitScript(() => { localStorage.setItem('authToken', 't'); });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const posts = [];
await page.route('**/api/v1/**', async (route) => {
  const req = route.request(); const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '');
  const origin = req.headers()['origin'] || BASE;
  const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const ok = (data) => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ success: true, data }) });
  if (req.method() !== 'GET') { let b = null; try { b = req.postDataJSON(); } catch {} posts.push({ path, body: b }); return ok({ reminder: { id: 'n1' } }); }
  if (path === '/clients/c1/livestock/access') return ok({ locked: false, tier: 'FULL', packageName: 'Farmer' });
  if (path === '/clients/c1/livestock/farms') return ok([{ id: 'f1', name: 'Kamau Wa Mwaura Farm', farmType: 'MIXED', county: 'Kiambu', location: null, sizeAcres: 2, clinic: { id: 'k1', name: 'Westlands Paws', logo: null }, headCount: 8, animalGroupCount: 2, cropPlotCount: 0 }]);
  if (path === '/clients/c1/livestock/farms/f1') return ok({ animalGroups: [{ id: 'g1', name: 'Dairy cows', species: 'Cattle', breed: null, headCount: 2, purpose: 'DAIRY' }], cropPlots: [] });
  if (path === '/clients/c1/livestock/farms/f1/animals') return ok({ locked: false, animals });
  if (path === '/clients/c1/livestock/farms/f1/treatments') return ok([
    { id: 't1', scope: 'ANIMAL', kind: 'TREATMENT', product: 'Oxytetracycline LA', dose: '10 ml', route: 'INJECTION_IM', reason: null, treatedOn: iso(-2), treatedCount: 1, target: 'Bika', administeredBy: 'VET', administeredName: 'Dr Wanjiku', meatSafeOn: iso(26), milkSafeOn: iso(3), meatHeld: true, milkHeld: true },
    { id: 't2', scope: 'GROUP', kind: 'DEWORMING', product: 'Albendazole', dose: null, route: 'ORAL', reason: null, treatedOn: iso(-60), treatedCount: 2, target: 'Dairy cows', administeredBy: 'OWNER', administeredName: null, meatSafeOn: null, milkSafeOn: null, meatHeld: false, milkHeld: false },
  ]);
  if (/feeding-logs$/.test(path)) return ok([{ id: 'l1', fedAt: iso(-1), quantityKg: 5, notes: 'Dairy meal' }]);
  if (/produce-records$/.test(path)) return ok([{ id: 'p1', produce: 'MILK', recordedOn: iso(-1), quantity: 11, unit: 'L', notes: null }]);
  if (path === '/livestock/farm-reminders') return ok({ reminders: [{ id: 'r1', farmId: 'f1', farmAnimalId: 'a1', animalName: 'Bika', farmName: 'Kamau Wa Mwaura Farm', ownerName: 'Kamau', kind: 'DRY_OFF', title: 'Dry off Bika (stop milking)', notes: null, dueOn: iso(-20), status: 'PENDING', source: 'SYSTEM' }] });
  return ok([]);
});

await page.goto(`${BASE}/e2e/preview/clinic-farm.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const body = await page.locator('body').innerText();
check('farm shown with owner clinic', /Kamau Wa Mwaura Farm/.test(body) && /Cared for by Westlands Paws/i.test(body), body.slice(0, 200));
check('stat strip', /Head/i.test(body) && /Kinds/i.test(body));
check('wears the farmer look (farm-skin panel)', await page.locator('.farm-skin').count() > 0);
check('withholding banner for Bika', /Under withholding now/.test(body) && /Oxytetracycline LA/.test(body) && /milk safe/.test(body), body);
check('reminders listed', /Dry off Bika/.test(body));
const cards = page.getByTestId('clinic-animal');
check('two animal cards', await cards.count() === 2);
const b = await cards.first().innerText();
check('Bika: In calf + Milking · day 200', /In calf/i.test(b) && /Milking · day 200/i.test(b), b);
check('Bika: due date (estimate) + stop milking + restart', /Due \(est\.\)/i.test(b) && /Stop milking/i.test(b) && /Milking starts again/i.test(b), b);
check('Bika has a photo', await cards.first().locator('img').count() === 1);
await cards.first().locator('button').first().click(); await page.waitForTimeout(600);
const open = await cards.first().innerText();
check('expanded: weight, feeding, produce', /Weight/i.test(open) && /Dairy meal/i.test(open) && /MILK/i.test(open), open);
await page.screenshot({ path: `${SHOTS}50-clinic-farm.png`, fullPage: true });
await page.getByRole('button', { name: /Advise on Bika/ }).click(); await page.waitForTimeout(300);
check('advise modal opens', await page.getByText('Advise the farmer').isVisible());
await page.locator('textarea').fill('Dry her off now and book a pre-calving check');
await page.getByRole('button', { name: 'Send to farmer' }).click(); await page.waitForTimeout(500);
const p = posts.find((x) => /farm-reminders$/.test(x.path));
check('advice posted for Bika on this farm', p?.body?.farmId === 'f1' && p?.body?.farmAnimalId === 'a1' && /Dry her off/.test(p?.body?.title), JSON.stringify(posts));
check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
