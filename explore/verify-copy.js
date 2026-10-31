const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'copy-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5431';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('CONSOLE: ' + m.text().slice(0, 200)));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'c01-login.png') });
  console.log('login title:', await page.title());

  // login
  await page.fill('input[type="email"]', '' + (process.env.DP_USER||'') + '');
  await page.fill('input[type="password"]', '' + (process.env.DP_PASS||'') + '');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  await page.waitForLoadState('networkidle').catch(() => {});
  console.log('after login url:', page.url());
  await page.screenshot({ path: path.join(OUT, 'c02-dashboard.png'), fullPage: true });

  const routes = ['recherche', 'acquisition', 'dossier-patient', 'studio', 'collection', 'publication', 'presentations', 'reglage', 'reglage/profil', 'reglage/appareils'];
  for (const r of routes) {
    try {
      await page.goto(BASE + '/' + r, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, 'c-' + r.replace(/\//g, '_') + '.png'), fullPage: r === 'reglage' });
      console.log('OK', r, await page.title());
    } catch (e) {
      console.log('FAIL', r, e.message.slice(0, 100));
    }
  }
  console.log('--- ERRORS ---');
  [...new Set(errors)].slice(0, 20).forEach((e) => console.log(e));
  await context.close();
  await browser.close();
})();
