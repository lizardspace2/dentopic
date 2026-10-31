const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'acq-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'https://frontend-for-you.vercel.app';

async function snap(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, name + '.txt'), text);
  console.log('---', name, '---');
}

(async () => {
  const b = await chromium.launch({ headless: true });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', '' + (process.env.DP_USER||'') + '');
  await page.fill('input[type="password"]', '' + (process.env.DP_PASS||'') + '');
  await page.click('button:has-text("Se connecter")');
  await page.waitForTimeout(6000);
  await page.goto(BASE + '/acquisition', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Onboarding modal — step through all 5
  for (let i = 1; i <= 6; i++) {
    const dlg = await page.$('div.fixed.inset-0');
    if (!dlg) break;
    await snap(page, `onboarding-${i}`);
    const next = await dlg.$('button:last-of-type');
    if (!next) break;
    const label = await next.innerText();
    await next.click();
    await page.waitForTimeout(700);
    if (/commencer|terminer|parti|fermer/i.test(label)) break;
  }
  await snap(page, 'after-onboarding');

  // click DÉPART device card
  try {
    await page.click('text=ghhf', { timeout: 4000 });
    await snap(page, 'modal-device');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (e) { console.log('device modal fail', e.message.slice(0, 80)); }

  // click ARRIVÉE dossier selector
  try {
    await page.click('text=Sélectionner un dossier patient', { timeout: 4000 });
    await snap(page, 'modal-dossier');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (e) { console.log('dossier modal fail', e.message.slice(0, 80)); }

  // Capturer depuis mobile
  try {
    await page.click('button:has-text("Capturer depuis mobile")', { timeout: 4000 });
    await snap(page, 'modal-mobile');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (e) { console.log('mobile modal fail', e.message.slice(0, 80)); }

  // Nouvelle acquisition
  try {
    await page.click('button:has-text("Nouvelle acquisition")', { timeout: 4000 });
    await snap(page, 'modal-nouvelle');
  } catch (e) { console.log('nouvelle fail', e.message.slice(0, 80)); }

  await b.close();
})();
