const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'screenshots');
const BASE = 'https://frontend-for-you.vercel.app';

const ROUTES = [
  ['recherche', '/recherche'],
  ['acquisition', '/acquisition'],
  ['dossier-patient', '/dossier-patient'],
  ['studio', '/studio'],
  ['collection', '/collection'],
  ['publication', '/publication'],
  ['presentations', '/presentations'],
  ['reglage', '/reglage'],
  ['reglage-profil', '/reglage/profil'],
  ['reglage-appareils', '/reglage/appareils'],
  ['signup', '/signup'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: path.join(__dirname, 'auth-state.json'),
  });
  const page = await context.newPage();

  for (const [name, route] of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, `route-${name}.png`), fullPage: false });
      const text = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync(path.join(OUT, `route-${name}.txt`), text);
      console.log(`OK ${name} -> ${page.url()} | title: ${await page.title()}`);
    } catch (e) {
      console.log(`FAIL ${name}: ${e.message}`);
    }
  }

  // also dump the supabase key from the js bundle
  const resp = await page.goto(BASE + '/assets/supabase-Dk7vBIeG.js');
  const js = await resp.text();
  fs.writeFileSync(path.join(OUT, 'supabase-bundle.js'), js);
  const m = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
  const key = js.match(/eyJ[A-Za-z0-9_\-\.]{50,}/);
  console.log('SUPABASE URL:', m && m[0]);
  console.log('ANON KEY:', key && key[0].slice(0, 60) + '...');
  fs.writeFileSync(path.join(__dirname, 'supabase-config.json'), JSON.stringify({
    url: m && m[0],
    anonKey: key && key[0],
  }, null, 2));

  await context.close();
  await browser.close();
})();
