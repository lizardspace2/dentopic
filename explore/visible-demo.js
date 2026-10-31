const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://frontend-for-you.vercel.app', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', '' + (process.env.DP_USER||'') + '');
  await page.fill('input[type="password"]', '' + (process.env.DP_PASS||'') + '');
  await page.click('button:has-text("Se connecter")');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'screenshots/visible-dashboard.png', fullPage: true });
  console.log('VISIBLE OK — fermeture dans 20s');
  await page.waitForTimeout(20000);
  await browser.close();
})();
