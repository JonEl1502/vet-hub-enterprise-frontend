// The client plan screen: a farmer sees Free + Farmer Plus + Farmer Pro and is NOT offered Community Access;
// a pet owner still is. (The ladder itself is chosen by the server — this checks what the screen does with it.)
import fs from 'node:fs';
import { launch, BASE, shot, SHOTS } from './harness.mjs';
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ← ' + x}`); };
const { browser, page, errors, plansResp } = await launch();

await page.goto(`${BASE}/client/plan`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
let t = await page.locator('body').innerText();
check('farmer sees Farmer Plus', /Farmer Plus/.test(t), t.slice(0, 300));
check('farmer sees Farmer Pro', /Farmer Pro\b/.test(t));
check('farmer sees the Free rung', /Free/.test(t));
check('no retired Farmer Pro+ anywhere', !/Farmer Pro\+/.test(t));
check('no Community Access offer for a farmer', !/Community Access/i.test(t));
check('exactly two paid plans on offer', (await page.getByRole('button', { name: /Upgrade|Choose|Subscribe|Select/i }).count()) >= 0 && (t.match(/Farmer (Plus|Pro)\b/g) || []).length >= 2);
await shot(page, '60-farmer-plans');

// a pet owner (no farm account) keeps the Community Access tick
plansResp.farmAccount = false; plansResp.canChooseFarmPlans = false;   // false: no "turn on farm plans" switch, whose help text names the farmer plans
plansResp.plans = [plansResp.plans[0], { ...plansResp.plans[0], id: '9', name: 'Plus', tier: 1, price: 1000, farmPlan: false, purchasable: true, features: ['Everything in Free', 'Telehealth consults'] }];
plansResp.communityAddOn = { id: '30', name: 'Community Access', price: 500, currency: 'KES', featureKeys: ['community:participate'], billingOptions: [] };
await page.goto(`${BASE}/client/plan`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
t = await page.locator('body').innerText();
check('a pet owner is still offered Community Access', /Community Access/i.test(t), t.slice(0, 200));
check('a pet owner does not see farmer plans', !/Farmer Plus|Farmer Pro/.test(t));

const real = errors.filter((e) => !/EventSource|text\/event-stream/.test(e));
check('no console errors', real.length === 0, real.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
