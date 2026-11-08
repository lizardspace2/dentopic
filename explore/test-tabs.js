// Test Playwright des autres onglets DentoPic — compte de test fictif.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'tab-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5199';
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));

const results = [];
const errors = [];
function ok(name, cond, extra) {
  results.push([cond ? 'PASS' : 'FAIL', name + (extra ? ' — ' + extra : '')]);
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

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle').catch(() => {});
  ok('login', !page.url().includes('login'));
  const errorsAt = () => errors.length;

  // ---- Accueil ------------------------------------------------------------------
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 't01-accueil.png'), fullPage: true });
  ok('Accueil rend sans erreur', errorsAt() === 0);

  // ---- Recherche ------------------------------------------------------------------
  await page.goto(BASE + '/recherche', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 't02-recherche.png'), fullPage: true });
  const searchInput = await page.locator('input[placeholder*="echerch"], input[type="search"], input[placeholder]').count();
  ok('Recherche : champ de recherche présent', searchInput > 0);
  if (searchInput) {
    await page.locator('input[placeholder]').first().fill('dupont');
    await page.waitForTimeout(1200);
    ok('Recherche : saisie sans erreur', errorsAt() === 0);
    await page.screenshot({ path: path.join(OUT, 't02b-recherche-dupont.png') });
  }
  ok('Recherche rend sans erreur', errorsAt() === 0);

  // ---- Acquisition ------------------------------------------------------------------
  await page.goto(BASE + '/acquisition', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 't03-acquisition.png'), fullPage: true });
  ok('Acquisition rend sans erreur', errorsAt() === 0);

  // ---- Dossier patient ------------------------------------------------------------------
  await page.goto(BASE + '/dossier-patient', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 't04-dossier.png'), fullPage: true });
  ok('Dossier patient rend sans erreur', errorsAt() === 0);

  // ---- Collection / Photothèque ------------------------------------------------------------------
  await page.goto(BASE + '/collection', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, 't05-phototheque.png'), fullPage: true });
  const photoTab = await page.locator('button', { hasText: /^Photos \(/ }).count();
  const patTab = await page.locator('button', { hasText: /^Patients \(/ }).count();
  const colTab = await page.locator('button', { hasText: /^Collections \(/ }).count();
  ok('Photothèque : onglet Photos', photoTab > 0);
  ok('Photothèque : onglet Patients', patTab > 0);
  ok('Photothèque : onglet Collections', colTab > 0);
  const favQuick = await page.locator('text=/[Ff]avorites|[Ff]avoris/').count();
  ok('Photothèque : raccourci Favorites', favQuick > 0);
  const unassigned = await page.locator('text=/[ÀAa] classer/').count();
  ok('Photothèque : raccourci À classer', unassigned > 0);
  // recherche dans la photothèque
  const libSearch = page.locator('input[placeholder]').first();
  if (await libSearch.count()) {
    await libSearch.fill('test');
    await page.waitForTimeout(1000);
    ok('Photothèque : recherche sans erreur', errorsAt() === 0);
    await page.screenshot({ path: path.join(OUT, 't05b-phototheque-search.png') });
  }
  ok('Photothèque rend sans erreur', errorsAt() === 0);

  // ---- Publication ------------------------------------------------------------------
  await page.goto(BASE + '/publication', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 't06-publication.png'), fullPage: true });
  ok('Publication rend sans erreur', errorsAt() === 0);

  // ---- Présentations ------------------------------------------------------------------
  await page.goto(BASE + '/presentations', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 't07-presentations.png'), fullPage: true });
  ok('Présentations rend sans erreur', errorsAt() === 0);

  // ---- Réglages ------------------------------------------------------------------
  for (const r of ['reglage', 'reglage/profil', 'reglage/protocoles', 'reglage/appareils', 'reglage/reseaux', 'reglage/membres', 'reglage/stockage', 'reglage/brand']) {
    await page.goto(BASE + '/' + r, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, 't08-' + r.replace(/\//g, '_') + '.png'), fullPage: r === 'reglage' });
    ok(`Réglage ${r} rend sans erreur`, errorsAt() === 0);
  }

  console.log('\n===== RÉSULTATS ONGLETS =====');
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
