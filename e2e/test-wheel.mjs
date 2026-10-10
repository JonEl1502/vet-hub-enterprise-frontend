import fs from 'node:fs';
import { launch, BASE, shot, SHOTS } from './harness.mjs';
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ← ' + extra}`); };

const { browser, page, posts, errors } = await launch();
const go = async (path) => { await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); };
const wheel = () => page.getByRole('button', { name: 'Record something' });
const openWheel = async () => { await wheel().click(); await page.waitForTimeout(650); };

// ── bar ──
await go('/client/farm');
const bar = page.locator('nav.fixed.bottom-0');
for (const t of ['My Farm', 'Animals', 'Medical', 'More']) check(`bar has "${t}"`, await bar.getByText(t, { exact: true }).count() > 0);
check('bar no longer crams Market/Messages/Community/Profile', (await bar.getByText('Community', { exact: true }).count()) === 0);
check('centre button exists', await wheel().count() === 1);
const box = await wheel().boundingBox();
check('centre button is horizontally centred', Math.abs((box.x + box.width / 2) - 200) < 3, JSON.stringify(box));

// ── wheel opens, shows 3 actions ──
await openWheel();
await shot(page, '02-wheel-open');
for (const a of ['Feeding', 'Produce', 'Expense']) check(`wheel shows ${a}`, await page.getByRole('button', { name: a, exact: true }).isVisible());
check('wheel shows close hub', await page.getByRole('button', { name: 'Close', exact: true }).isVisible());
await page.keyboard.press('Escape'); await page.waitForTimeout(600);
check('Escape closes the wheel', await page.getByRole('button', { name: 'Feeding', exact: true }).count() === 0);

// ── each action deep-links to its form ──
await openWheel();
await page.getByRole('button', { name: 'Feeding', exact: true }).click(); await page.waitForTimeout(700);
check('Feeding opens "Fed them"', await page.getByText('Fed them').first().isVisible());
check('?record is removed from the address', !page.url().includes('record='), page.url());
await shot(page, '03-feeding-sheet');

await go('/client/farm'); await openWheel();
await page.getByRole('button', { name: 'Produce', exact: true }).click(); await page.waitForTimeout(700);
check('Produce opens "Milk & produce"', await page.getByText('Milk & produce').first().isVisible());
check('Produce offers Milk sold / Eggs sold chips', (await page.getByRole('button', { name: 'Milk sold' }).count()) > 0 && (await page.getByRole('button', { name: 'Eggs sold' }).count()) > 0);
check('Produce offers "Other produce" (wool, skin, grain)', await page.getByRole('button', { name: 'Other produce' }).count() > 0);
await shot(page, '04-produce-sheet');

await go('/client/farm'); await openWheel();
await page.getByRole('button', { name: 'Expense', exact: true }).click(); await page.waitForTimeout(700);
check('Expense opens "Expense"', await page.getByText('Expense', { exact: true }).first().isVisible());
for (const c of ['Feed', 'Transport', 'Labour', 'Other cost']) check(`Expense offers "${c}" chip`, await page.getByRole('button', { name: c, exact: true }).count() > 0);
await shot(page, '05-expense-sheet');

// ── record a real expense through the form ──
await page.getByRole('button', { name: 'Transport', exact: true }).click();
await page.getByPlaceholder('Transport to market').fill('Matatu to market');
await page.locator('input[placeholder="0"]').nth(1).fill('300');
const before = posts.length;
await page.getByRole('button', { name: 'Record it' }).click(); await page.waitForTimeout(800);
const led = posts.slice(before).find((p) => /\/ledger$/.test(p.path));
check('Expense POSTs to the farm ledger', !!led, JSON.stringify(posts.slice(before)));
check('…as category TRANSPORT', led?.body?.category === 'TRANSPORT', JSON.stringify(led?.body));
check('…with the amount 300', Number(led?.body?.amount) === 300, JSON.stringify(led?.body));
check('…and the item text', led?.body?.item === 'Matatu to market', JSON.stringify(led?.body));

// ── direct deep link + refresh does not re-open ──
await go('/client/farm?record=MILK_SALE');
check('deep link ?record=MILK_SALE opens the form', await page.getByText('Milk & produce').first().isVisible());
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
check('refresh does not re-open it', !(await page.getByText('Milk sold').first().isVisible().catch(() => false)));

// ── More menu ──
await go('/client/farm');
await bar.getByText('More', { exact: true }).click(); await page.waitForTimeout(400);
await shot(page, '06-more-menu');
for (const t of ['Market', 'Messages', 'Community', 'Profile']) check(`More lists ${t}`, await page.getByRole('link', { name: t }).count() > 0);
await page.getByRole('link', { name: 'Profile' }).click(); await page.waitForTimeout(600);
check('More → Profile navigates', page.url().includes('/client/settings'), page.url());
check('More closes after choosing', await page.getByRole('link', { name: 'Community' }).count() === 0 || !(await page.getByRole('link', { name: 'Community' }).first().isVisible().catch(() => false)));

// ── pet mode keeps its own bar ──
const real = errors.filter((e) => !/EventSource|text\/event-stream/.test(e));
check('no unexpected console errors', real.length === 0, real.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
