// Test Playwright du Studio DentoPic — compte de test fictif (test-creds.json).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'studio-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5199';
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));

const results = [];
const errors = [];
function ok(name, cond, extra) {
  results.push([cond ? 'PASS' : 'FAIL', name + (extra ? ' — ' + extra : '')]);
}
async function shot(page, name, full) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full });
}
// les modales se ferment en cliquant le fond (pas d'Echap)
async function closeModal(page) {
  await page.mouse.click(15, 475);
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|net::|404|Failed to load resource/.test(m.text()))
      errors.push('CONSOLE: ' + m.text().slice(0, 250));
  });

  // ---- Login ------------------------------------------------------------------
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle').catch(() => {});
  ok('login → dashboard', !page.url().includes('login'), page.url());

  // ---- Studio chargement ------------------------------------------------------
  await page.goto(BASE + '/studio', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, 's01-studio-empty');

  const banner = await page.locator('text=OUTILS DENTAIRES').count();
  ok('bandeau OUTILS DENTAIRES visible', banner > 0);

  const dentalBtns = ['Avant / après · 2 séances', 'Planche clinique', 'Protocoles & références',
    'Redresser le plan occlusal', 'Photo au miroir', 'Guides sourire', 'Original / retouche'];
  for (const label of dentalBtns) {
    const b = page.locator(`button:has-text("${label}")`).first();
    const present = await b.count() > 0;
    ok(`bouton dentaire « ${label} »`, present);
  }
  // sans document ouvert, Redresser/miroir/guides/original-retouche doivent être désactivés
  for (const label of ['Redresser le plan occlusal', 'Photo au miroir', 'Guides sourire', 'Original / retouche']) {
    const b = page.locator(`button:has-text("${label}")`).first();
    ok(`« ${label} » désactivé sans document`, await b.isDisabled());
  }
  for (const label of ['Avant / après · 2 séances', 'Planche clinique', 'Protocoles & références']) {
    const b = page.locator(`button:has-text("${label}")`).first();
    ok(`« ${label} » actif sans document`, !(await b.isDisabled()));
  }

  // ---- Panneau droit : absent sans document (RightPanel exige docOpen) ----------
  ok('panneau droit absent sans document', await page.getByText('Dentaire', { exact: true }).count() === 0);

  // ---- Nouveau document via Fichier --------------------------------------------
  await page.getByText('Fichier', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await shot(page, 's03-menu-fichier');
  await page.click('text=Nouveau document…');
  await page.waitForTimeout(500);
  await shot(page, 's04-newdoc-modal');
  await page.click('button:has-text("Créer")');
  await page.waitForTimeout(1200);
  await shot(page, 's05-doc-open');

  const canvas = await page.locator('canvas').count();
  ok('canevas créé (canvas présent)', canvas > 0, `${canvas} canvas`);

  // Panneau droit avec document : Dentaire actif par défaut + Histogramme visible
  ok('onglet « Dentaire » présent', await page.getByText('Dentaire', { exact: true }).count() > 0);
  ok('panneau Histogramme affiché par défaut', await page.locator('select option[value="lum"]').count() > 0);
  await shot(page, 's02-dental-panel');
  for (const label of ['Redresser le plan occlusal', 'Photo au miroir', 'Guides sourire', 'Original / retouche']) {
    const b = page.locator(`button:has-text("${label}")`).first();
    ok(`« ${label} » actif avec document`, !(await b.isDisabled()));
  }

  // ---- Dessin au pinceau --------------------------------------------------------
  const cv = page.locator('canvas').first();
  const box = await cv.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  await shot(page, 's06-brush-stroke');
  ok('tracé au pinceau (pas d\u2019erreur)', errors.length === 0);

  // Ctrl+Z → undo
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  ok('Ctrl+Z sans erreur', errors.length === 0);

  // ---- Guides sourire toggle ----------------------------------------------------
  await page.click('button:has-text("Guides sourire")');
  await page.waitForTimeout(500);
  const hideLbl = await page.locator('button:has-text("Masquer les guides sourire")').count();
  ok('guides sourire affichés → libellé « Masquer »', hideLbl > 0);
  await shot(page, 's07-smile-guides');
  await page.click('button:has-text("Masquer les guides sourire")');
  await page.waitForTimeout(300);

  // ---- Original / retouche ------------------------------------------------------
  await page.click('button:has-text("Original / retouche")');
  await page.waitForTimeout(600);
  const quitLbl = await page.locator('button:has-text("Quitter original / retouche")').count();
  ok('mode original/retouche actif', quitLbl > 0);
  await shot(page, 's08-original-retouche');
  if (quitLbl) await page.click('button:has-text("Quitter original / retouche")');
  await page.waitForTimeout(300);

  // ---- Modale Protocoles & références -------------------------------------------
  await page.locator('button:has-text("Protocoles & références")').first().click();
  await page.waitForTimeout(800);
  const protoVisible = await page.locator('text=/Bilan complet|Suivi|laboratoire/i').count();
  ok('modale Protocoles : parcours prédéfinis visibles', protoVisible > 0);
  await shot(page, 's09-protocols');
  await closeModal(page);
  const protoClosed = (await page.locator('text=/Bilan complet/i').count()) === 0;
  ok('modale Protocoles refermée (clic fond)', protoClosed);

  // ---- Modale Planche clinique --------------------------------------------------
  await page.locator('button:has-text("Planche clinique")').first().click();
  await page.waitForTimeout(700);
  const sheetVisible = await page.locator('text=/[Pp]lanche/').count();
  ok('modale Planche clinique ouverte', sheetVisible > 0);
  await shot(page, 's10-sheet-modal');
  await closeModal(page);

  // ---- Modale Avant/après 2 séances (montage) ------------------------------------
  await page.locator('button:has-text("Avant / après · 2 séances")').first().click();
  await page.waitForTimeout(700);
  const montageVisible = await page.locator('text=/[Aa]vant.*[Aa]près|[Mm]ontage/').count();
  ok('modale montage avant/après ouverte', montageVisible > 0);
  await shot(page, 's11-montage-modal');
  await closeModal(page);

  // ---- Menus Photoshop classiques ------------------------------------------------
  let mi = 0;
  for (const menu of ['Édition', 'Image', 'Calque', 'Affichage']) {
    const m = page.getByText(menu, { exact: true }).first();
    await m.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, 's12-menu-' + (mi++));
    await m.click({ timeout: 5000 }).catch(() => {}); // re-clic = fermer
    await page.waitForTimeout(250);
    ok(`menu « ${menu} » ouvert/fermé sans erreur`, errors.length === 0);
  }

  // ---- Réglages repliables --------------------------------------------------------
  const settingsTab = page.getByText('Réglages', { exact: true }).first();
  if (await settingsTab.count()) {
    await settingsTab.click();
    await page.waitForTimeout(400);
    const expo = await page.locator('text=/Exposition/').count();
    ok('section Exposition dans Réglages', expo > 0);
    await shot(page, 's13-settings');
  }

  // ---- Export rapide -------------------------------------------------------------
  await page.getByText('Fichier', { exact: true }).first().click();
  await page.waitForTimeout(400);
  const expItem = await page.locator('text=Export rapide PNG').count();
  ok('Export rapide PNG dans Fichier', expItem > 0);
  await page.getByText('Fichier', { exact: true }).first().click(); // refermer
  await page.waitForTimeout(250);

  console.log('\n===== RÉSULTATS STUDIO =====');
  results.forEach(([s, n]) => console.log(s + '  ' + n));
  const fails = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} PASS — ${fails} FAIL`);
  console.log('\n===== ERREURS RUNTIME =====');
  [...new Set(errors)].slice(0, 15).forEach((e) => console.log(e));
  if (!errors.length) console.log('(aucune)');

  await context.close();
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2) });
