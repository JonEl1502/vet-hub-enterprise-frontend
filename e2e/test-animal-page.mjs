import fs from 'node:fs';
import { launch, BASE, shot, SHOTS } from './harness.mjs';
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ← ' + x}`); };

const { browser, page, posts, errors, animal } = await launch();
const last = (re, method) => [...posts].reverse().find((p) => re.test(p.path) && (!method || p.method === method));
const ymd = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const daysAgo = (n) => ymd(Date.now() - n * 86400000);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FABJADq0TqQ1hAAAAAElFTkSuQmCC', 'base64');

await page.goto(`${BASE}/client/farm/animals`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByText('Bika').first().click(); await page.waitForTimeout(700);

// ── hero ──
check('hero shows the name', await page.getByRole('heading', { name: 'Bika' }).first().isVisible());
check('no photo yet → "Add a photo"', await page.getByText('Add a photo').isVisible());
await shot(page, '30-hero-empty');
await page.locator('input[type=file]').setInputFiles({ name: 'bika.png', mimeType: 'image/png', buffer: png });
await page.waitForTimeout(1500);
check('photo: asked for an upload URL', !!last(/photos\/upload-url$/));
check('photo: registered after upload', !!last(/farm-animals\/a1\/photos$/));
check('photo: appears in the hero', await page.locator('img[alt="Bika"]').count() > 0);
check('photo: becomes the cover', !!animal.avatarUrl);
await page.locator('input[type=file]').setInputFiles({ name: 'bika2.png', mimeType: 'image/png', buffer: png });
await page.waitForTimeout(1500);
check('second photo added', animal.photos.length === 2);
await shot(page, '31-hero-photos');
await page.locator('img[alt="Bika"]').first().click(); await page.waitForTimeout(300);
check('tap opens the photo viewer', await page.getByRole('dialog', { name: 'Photo' }).isVisible());
await page.getByRole('button', { name: 'Delete' }).click(); await page.waitForTimeout(800);
check('delete removes a photo', animal.photos.length === 1);

// ── totals ──
const totals = await page.getByTestId('animal-totals').innerText();
check('totals: fed 42.5 kg, milk 310 L', /42\.5/.test(totals) && /310/.test(totals), totals);

// ── pregnancy: served 100 days ago, by AI ──
await page.getByRole('button', { name: /Mark in calf/ }).click(); await page.waitForTimeout(300);
check('asks "since when?"', await page.getByText('In calf — since when?').isVisible());
await page.locator('input[type=date]').first().fill(daysAgo(100));
await page.getByRole('button', { name: 'AI', exact: true }).click();
const prev = await page.locator('.bg-slate-50, .dark\\:bg-zinc-800\\/60').filter({ hasText: 'Stop milking' }).first().innerText().catch(() => '');
check('preview shows due, stop-milking and restart dates', /Due:/.test(prev) && /Stop milking:/.test(prev) && /Milking starts again:/.test(prev), prev);
await shot(page, '32-pregnancy-sheet');
await page.getByTestId('record-submit').click(); await page.waitForTimeout(800);
let p = last(/farm-animals\/a1$/, 'PATCH');
check('saves served date + method', p?.body?.isPregnant === true && p?.body?.pregnantSince === daysAgo(100) && p?.body?.breedingMethod === 'AI', JSON.stringify(p?.body));
const card = await page.getByText('Breeding & milking').locator('xpath=ancestor::div[contains(@class,"cp-card")][1]').innerText();
check('card: day 100 of about 283', /Day 100 of about 283/.test(card), card);
check('card: lists Due, Stop milking, Milking starts again', /Due \(estimate\)/.test(card) && /Stop milking/.test(card) && /Milking starts again/.test(card), card);
await shot(page, '33-pregnant-card');

// ── dry off, then calved ──
await page.getByRole('button', { name: 'Dry off' }).click(); await page.waitForTimeout(300);
await page.getByTestId('record-submit').click(); await page.waitForTimeout(800);
p = last(/farm-animals\/a1$/, 'PATCH');
check('dry off sends driedOffOn', !!p?.body?.driedOffOn, JSON.stringify(p?.body));
check('…and she is no longer shown as milking', (await page.getByText(/^Not milking|Dry since/).count()) > 0);
await page.getByRole('button', { name: /She calved/ }).click(); await page.waitForTimeout(300);
await page.getByTestId('record-submit').click(); await page.waitForTimeout(900);
check('calving posts to /calved', !!last(/a1\/calved$/));
check('calved: pregnancy cleared, milking started', animal.isPregnant === false && animal.isLactating === true);
check('page shows milking again', await page.getByText(/Milking · day/).first().isVisible());

// ── "not sure" path ──
await page.getByRole('button', { name: /Mark in calf/ }).click();
await page.getByRole('button', { name: 'Not sure', exact: true }).click();
await page.getByTestId('record-submit').click(); await page.waitForTimeout(800);
p = last(/farm-animals\/a1$/, 'PATCH');
check('"not sure" saves pregnant with no dates', p?.body?.isPregnant === true && !('pregnantSince' in p.body) && !('expectedDueOn' in p.body), JSON.stringify(p?.body));
check('…and tells her what to add', await page.getByText(/Add when she was served/).isVisible());
await page.getByRole('button', { name: 'Not pregnant' }).click(); await page.waitForTimeout(700);
check('"Not pregnant" clears it', animal.isPregnant === false);

const real = errors.filter((e) => !/EventSource|text\/event-stream/.test(e));
check('no console errors', real.length === 0, real.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
