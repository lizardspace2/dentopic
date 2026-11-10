// Ouvre un navigateur visible pour le login SmileCloud : le formulaire est
// pré-rempli, l'utilisateur clique le captcha + « S'identifier » à la main.
// Le script détecte la connexion, sauvegarde la session et capture les écrans.
const { chromium } = require('playwright');
const fs = require('fs');

const SHOTS = '../.tmp-shots';
const EMAIL = 'deepseekv3connect@proton.me';
const PASS = '01021986gR@@!!@';

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://app.smilecloud.com/login?lang=fr');
  await page.waitForTimeout(6000);
  try {
    await page.fill('input[name=username]', EMAIL);
    await page.fill('input[name=password]', PASS);
  } catch (e) { console.log('pré-remplissage:', e.message) }
  console.log('>>> FORMULAIRE PRÉ-REMPLI — cliquez le captcha puis « S\'identifier » dans la fenêtre <<<');

  // attend la connexion (sortie du domaine auth.smilecloud.com), max 4 min
  let loggedIn = false;
  for (let i = 0; i < 240; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    if (url.includes('app.smilecloud.com') && !url.includes('auth.smilecloud.com')) { loggedIn = true; break }
    if (page.isClosed()) { console.log('fenêtre fermée'); process.exit(1) }
  }
  if (!loggedIn) { console.log('LOGIN non détecté en 4 min'); await browser.close(); process.exit(2) }
  console.log('CONNECTÉ:', page.url());
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/sc-01-home.png` });
  await ctx.storageState({ path: 'smilecloud-state.json' });
  console.log('session sauvegardée — exploration…');
  console.log('body:', (await page.locator('body').innerText()).slice(0, 800).replace(/\n+/g, ' | '));
  await browser.close();
})();
