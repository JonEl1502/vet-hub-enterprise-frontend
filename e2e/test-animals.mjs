import fs from 'node:fs';
import { launch, BASE, shot, SHOTS } from './harness.mjs';
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ← ' + extra}`); };
const { browser, page, posts, errors } = await launch();

const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const lastPost = (re) => [...posts].reverse().find((p) => re.test(p.path));

await page.goto(`${BASE}/client/farm/animals`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByText('Bika', { exact: true }).first().click();
await page.waitForTimeout(600);
await shot(page, '10-animal-detail');
const section = (title) => page.locator('.cp-card', { hasText: new RegExp(`^\\s*${title}`, 'i') }).first();
const openRecord = async (title) => { await section(title).getByRole('button', { name: '+ Record' }).click(); await page.waitForTimeout(400); };
const submit = () => page.getByTestId('record-submit');
const closeModal = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); };

// ═════════ WEIGHT ═════════
await openRecord('Weight');
await shot(page, '11-weight-form');
check('weight: title "Weigh Bika"', await page.getByText('Weigh Bika').isVisible());
const wInput = page.locator('#rec-weight');
check('weight: opens the decimal keypad', (await wInput.getAttribute('inputmode')) === 'decimal');
check('weight: submit disabled while empty', await submit().isDisabled());
check('weight: "Same as last · 496kg" shortcut offered', await page.getByTestId('weight-same').isVisible());
await page.getByTestId('weight-same').click();
check('weight: shortcut fills 496', (await wInput.inputValue()) === '496');
await page.getByRole('button', { name: 'One kilo more' }).click();
check('weight: +1 → 497', (await wInput.inputValue()) === '497');
check('weight: shows change since last', /\+1\.0 kg since last/.test(await page.getByTestId('weight-delta').innerText()));
await page.getByRole('button', { name: 'One kilo less' }).click(); await page.getByRole('button', { name: 'One kilo less' }).click();
check('weight: −1 twice → 495 and shows −1.0', (await wInput.inputValue()) === '495' && /-1\.0 kg/.test(await page.getByTestId('weight-delta').innerText()));
await wInput.fill('0');
check('weight: 0 is refused', await submit().isDisabled());
await wInput.fill('498.5');
check('weight: date defaults to today', (await page.locator('#rec-date').inputValue()) === today());
await wInput.press('Enter'); await page.waitForTimeout(700);
let p = lastPost(/weights$/);
check('weight: Enter submits to /weights', !!p, JSON.stringify(posts));
check('weight: sends 498.5 and no date (server stamps "now")', p?.body?.weightValue === 498.5 && !('weighedOn' in (p?.body ?? {})), JSON.stringify(p?.body));
check('weight: modal closes after saving', (await page.getByText('Weigh Bika').count()) === 0);

await openRecord('Weight');
await page.locator('#rec-weight').fill('490');
await page.getByTestId('when-yesterday').click();
check('weight: "Yesterday" sets the date', (await page.locator('#rec-date').inputValue()) === yesterday());
await submit().click(); await page.waitForTimeout(700);
p = lastPost(/weights$/);
check('weight: back-dated entry sends weighedOn=yesterday', p?.body?.weighedOn === yesterday() && p?.body?.weightValue === 490, JSON.stringify(p?.body));

// ═════════ FEEDING ═════════
await openRecord('Feeding');
await shot(page, '12-feeding-form');
check('feeding: title "Feed Bika"', await page.getByText('Feed Bika').isVisible());
check('feeding: decimal keypad', (await page.locator('#rec-feed-qty').getAttribute('inputmode')) === 'decimal');
for (const k of ['1 kg', '2 kg', '5 kg', '10 kg']) check(`feeding: quick quantity "${k}"`, await page.getByRole('button', { name: k, exact: true }).isVisible());
for (const t of ['Napier', 'Hay', 'Dairy meal', 'Silage']) check(`feeding: cattle feed type "${t}"`, await page.getByRole('button', { name: t, exact: true }).isVisible());
check('feeding: no "same as last" before the first record', (await page.getByTestId('feed-same').count()) === 0);
await page.getByRole('button', { name: '5 kg', exact: true }).click();
await page.getByRole('button', { name: 'Napier', exact: true }).click();
await page.getByRole('button', { name: 'Morning', exact: true }).click();
check('feeding: picking a feed fills the text box', (await page.locator('#rec-feed-type').inputValue()) === 'Napier');
await submit().click(); await page.waitForTimeout(700);
p = lastPost(/feeding-logs$/);
check('feeding: sends quantity 5, notes "Napier"', p?.body?.quantityKg === 5 && p?.body?.notes === 'Napier', JSON.stringify(p?.body));
check('feeding: sends a time for "Morning" (06:30 local)', !!p?.body?.fedAt && new Date(p.body.fedAt).getHours() === 6 && new Date(p.body.fedAt).getMinutes() === 30, JSON.stringify(p?.body));
await page.waitForTimeout(300);
const feedText = await section('Feeding').innerText();
check('feeding: the list now shows the feed and amount', /Napier/.test(feedText) && /5kg/.test(feedText), feedText);
await shot(page, '13-feeding-recorded');
await openRecord('Feeding');
check('feeding: "Same as last · 5 kg" now offered', await page.getByTestId('feed-same').isVisible());
await page.locator('#rec-feed-qty').fill('3.5'); await page.locator('#rec-feed-qty').press('Enter'); await page.waitForTimeout(600);
p = lastPost(/feeding-logs$/);
check('feeding: quantity alone is enough (type & time optional)', p?.body?.quantityKg === 3.5 && !('notes' in p.body) && !('fedAt' in p.body), JSON.stringify(p?.body));

// ═════════ PRODUCE ═════════
await openRecord('Produce');
await shot(page, '14-produce-form');
check('produce: title "Produce from Bika"', await page.getByText('Produce from Bika').isVisible());
for (const o of ['Milk', 'Skin', 'Other']) check(`produce: cow offers "${o}"`, await page.getByRole('button', { name: o, exact: true }).isVisible());
check('produce: liveweight is NOT offered as produce', (await page.getByRole('button', { name: 'Liveweight' }).count()) === 0);
check('produce: milk defaults the unit to Litres', (await page.getByTestId('unit-L').getAttribute('aria-pressed')) === 'true');
check('produce: milk offers Morning/Midday/Evening', await page.getByRole('button', { name: 'Evening', exact: true }).isVisible());
check('produce: submit disabled until a quantity', await submit().isDisabled());
await page.locator('#rec-qty').fill('12.5');
await page.getByRole('button', { name: 'Evening', exact: true }).click();
await submit().click(); await page.waitForTimeout(700);
p = lastPost(/produce-records$/);
check('produce: milk 12.5 L, "Evening milking"', p?.body?.produce === 'Milk' && p?.body?.quantity === 12.5 && p?.body?.unit === 'L' && p?.body?.notes === 'Evening milking', JSON.stringify(p?.body));
const prodText = await section('Produce').innerText();
check('produce: the list shows it', /Milk/.test(prodText) && /12\.5/.test(prodText), prodText);

await openRecord('Produce');
await page.getByRole('button', { name: 'Skin', exact: true }).click();
check('produce: Skin switches the unit to Pieces', (await page.getByTestId('unit-PCS').getAttribute('aria-pressed')) === 'true');
check('produce: Skin hides the milking choice', (await page.getByRole('button', { name: 'Evening', exact: true }).count()) === 0);
await page.locator('#rec-qty').fill('1');
await submit().click(); await page.waitForTimeout(700);
p = lastPost(/produce-records$/);
check('produce: skin 1 PCS', p?.body?.produce === 'Skin' && p?.body?.unit === 'PCS' && p?.body?.quantity === 1, JSON.stringify(p?.body));

await openRecord('Produce');
await page.getByRole('button', { name: 'Other', exact: true }).click();
check('produce: "Other" asks what it was', await page.getByLabel('What was it?').isVisible());
await page.locator('#rec-qty').fill('3');
check('produce: "Other" needs a name before saving', await submit().isDisabled());
await page.getByLabel('What was it?').fill('Manure');
await page.getByTestId('unit-KG').click();
await submit().click(); await page.waitForTimeout(700);
p = lastPost(/produce-records$/);
check('produce: other → "Manure" 3 KG', p?.body?.produce === 'Manure' && p?.body?.unit === 'KG' && p?.body?.quantity === 3, JSON.stringify(p?.body));

// ═════════ tap targets ═════════
await openRecord('Produce');
const sizes = await page.evaluate(() => [...document.querySelectorAll('[aria-pressed], [data-testid="record-submit"]')].map((b) => ({ t: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) })));
const small = sizes.filter((s) => s.h < 40);
check('every chip and the submit button are ≥ 40px tall (thumb-friendly)', small.length === 0, JSON.stringify(small));
await closeModal();

// ═════════ species-aware produce options (from the shared config) ═════════
await page.goto(`${BASE}/client/farm/animals`, { waitUntil: 'networkidle' });
const opts = await page.evaluate(async () => {
  const m = await import('/components/client/views/AnimalRecordForms.tsx');
  return Object.fromEntries(['Cattle', 'Goat', 'Sheep', 'Poultry', 'Pig', 'Donkey'].map((s) => [s, m.produceOptions(s).map((o) => `${o.label}:${o.unit}`)]));
});
console.log('produce options by species:', JSON.stringify(opts));
check('poultry → Eggs in trays', opts.Poultry.some((o) => o === 'Eggs:TRAY'), JSON.stringify(opts.Poultry));
check('sheep → Wool in kg + Skin', opts.Sheep.includes('Wool:KG') && opts.Sheep.includes('Skin:PCS'), JSON.stringify(opts.Sheep));
check('goat → Milk in litres + Skin', opts.Goat.includes('Milk:L') && opts.Goat.includes('Skin:PCS'), JSON.stringify(opts.Goat));
check('donkey → only "Other" (a donkey does not yield)', opts.Donkey.length === 1 && opts.Donkey[0].startsWith('Other'), JSON.stringify(opts.Donkey));

const real = errors.filter((e) => !/EventSource|text\/event-stream/.test(e));
check('no unexpected console errors', real.length === 0, real.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
