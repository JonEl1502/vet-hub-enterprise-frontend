import fs from 'node:fs';
import { launch, BASE, shot, SHOTS } from './harness.mjs';
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ← ' + x}`); };

const { browser, page, posts, errors, stock } = await launch();
const go = async (path) => { await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); };
const last = (re) => [...posts].reverse().find((p) => re.test(p.path));

// ── home card ──
await go('/client/farm');
check('home shows the Store card with the item and balance', await page.getByText('Dairy meal').first().isVisible() && await page.getByText('100 kg').first().isVisible());

// ── store page ──
await go('/client/farm/store');
check('store lists Dairy meal at 100 kg', await page.getByText('Dairy meal').first().isVisible() && await page.getByText('100 kg').first().isVisible());
check('store hints in bags', await page.getByText(/2 bags of 50 kg/).isVisible());
await shot(page, '20-store');

// add stock in 50 kg bags with a price
await page.getByRole('button', { name: 'Add stock' }).first().click();
await page.locator('input[placeholder="0"]').first().fill('2');
await page.getByRole('button', { name: '50 kg bag', exact: true }).click();
await page.locator('input[placeholder="0"]').nth(1).fill('5400');
await shot(page, '21-add-stock');
await page.getByRole('button', { name: 'Add to store' }).click(); await page.waitForTimeout(700);
let p = last(/purchase$/);
check('purchase posts 2 × BAG_50 with the price', p?.body?.quantity === 2 && p?.body?.unit === 'BAG_50' && p?.body?.amount === 5400, JSON.stringify(p?.body));
check('balance is now 200 kg', await page.getByText('200 kg').first().isVisible());

// new item: hay in bales (asks for kg per bale)
await page.getByRole('button', { name: 'Add item' }).click();
await page.getByPlaceholder(/Dairy meal, Hay/).fill('Hay');
await page.getByRole('button', { name: 'Hay & forage', exact: true }).click();
await page.getByRole('button', { name: 'Add and enter stock' }).click(); await page.waitForTimeout(700);
p = last(/stock\/items$/);
check('new item posts name + category + KG', p?.body?.name === 'Hay' && p?.body?.category === 'FORAGE' && p?.body?.baseUnit === 'KG', JSON.stringify(p?.body));
await page.locator('input[placeholder="0"]').first().fill('10');
await page.getByRole('button', { name: 'Bale', exact: true }).click();
check('bale asks how many kg', await page.getByText('How many kg in one bale?').isVisible());
await page.getByPlaceholder('e.g. 20').fill('15');
await page.getByRole('button', { name: 'Add to store' }).click(); await page.waitForTimeout(700);
check('bale weight saved on the item', last(/farm-stock\/s2$/)?.body?.baleKg === 15, JSON.stringify(posts.slice(-3)));
check('10 bales × 15 kg = 150 kg', await page.getByText('150 kg').first().isVisible());

// ── feed from the wheel: whole farm ──
await go('/client/farm?record=FEED');
check('Feeding opens the store form', await page.getByText('What did you feed?').isVisible());
await page.getByRole('button', { name: /^Dairy meal · / }).click();
check('"All animals" is the default target', (await page.getByRole('button', { name: 'All animals' }).getAttribute('aria-pressed')) === 'true');
await page.locator('#feed-store-qty').fill('1');
await page.getByRole('button', { name: '50 kg bag', exact: true }).click();
await shot(page, '22-feed-form');
await page.getByTestId('record-submit').click(); await page.waitForTimeout(700);
p = last(/stock\/use$/);
check('feeds 1 × BAG_50 to the whole farm (no animal/herd)', p?.body?.quantity === 1 && p?.body?.unit === 'BAG_50' && !p.body.farmAnimalId && !p.body.animalGroupId, JSON.stringify(p?.body));
check('store dropped to 150 kg', stock.find((i) => i.id === 's1').quantity === 150, String(stock[0].quantity));

// herd target
await go('/client/farm?record=FEED');
await page.getByRole('button', { name: 'A herd / flock' }).click();
await page.locator('select').first().selectOption('g1');
await page.locator('#feed-store-qty').fill('3');
await page.getByTestId('record-submit').click(); await page.waitForTimeout(700);
p = last(/stock\/use$/);
check('herd feeding sends animalGroupId g1', p?.body?.animalGroupId === 'g1' && p?.body?.quantity === 3, JSON.stringify(p?.body));

// one named animal (FULL)
await go('/client/farm?record=FEED');
await page.getByRole('button', { name: 'One animal' }).click();
await page.locator('select').first().selectOption('a1');
await page.locator('#feed-store-qty').fill('2');
await page.getByTestId('record-submit').click(); await page.waitForTimeout(700);
p = last(/stock\/use$/);
check('one-animal feeding sends farmAnimalId a1', p?.body?.farmAnimalId === 'a1', JSON.stringify(p?.body));

// running short is allowed, and said
stock[0].quantity = 1;
await go('/client/farm?record=FEED');
await page.locator('#feed-store-qty').fill('5');
await page.getByTestId('record-submit').click(); await page.waitForTimeout(700);
check('over-feeding still records and says so', await page.getByText(/your store showed/i).first().isVisible());

// count it
await go('/client/farm/store');
await page.getByRole('button', { name: 'Count it' }).first().click();
await page.locator('input[type=number]').first().fill('40');
await page.getByRole('button', { name: 'Set balance' }).click(); await page.waitForTimeout(700);
check('count sets the balance (40 kg)', last(/adjust$/)?.body?.quantity === 40 && stock[0].quantity === 40, JSON.stringify(last(/adjust$/)?.body));

const real = errors.filter((e) => !/EventSource|text\/event-stream/.test(e));
check('no console errors', real.length === 0, real.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
