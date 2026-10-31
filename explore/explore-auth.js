const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'screenshots');
const BASE = 'https://frontend-for-you.vercel.app';
const EMAIL = '' + (process.env.DP_USER||'') + '';
const PASS = '' + (process.env.DP_PASS||'') + '';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const apiCalls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('supabase') || url.includes('/api/') || url.includes('functions')) {
      apiCalls.push(`${req.method()} ${url}`);
    }
  });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // fill login
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.screenshot({ path: path.join(OUT, '02-login-filled.png') });
  await page.click('button[type="submit"]:has-text("Se connecter"), button:has-text("Se connecter")');
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle').catch(() => {});

  console.log('URL after login:', page.url());
  console.log('TITLE:', await page.title());
  await page.screenshot({ path: path.join(OUT, '03-after-login.png'), fullPage: true });
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, '03-after-login.txt'), text);
  console.log('--- TEXT ---');
  console.log(text.slice(0, 3000));

  // save storage state for later reuse
  await context.storageState({ path: path.join(__dirname, 'auth-state.json') });

  // enumerate nav links
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'))
  );
  console.log('--- HREFS ---');
  console.log(JSON.stringify([...new Set(links)], null, 1));

  console.log('--- API CALLS ---');
  [...new Set(apiCalls)].forEach(r => console.log(r));

  await context.close();
  await browser.close();
})();
