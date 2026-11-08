// Test Playwright photothèque + Studio avec données fictives réelles (seed-test-data.js).
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'lib-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5199';
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'supabase-config.json'), 'utf8'));

const results = [];
const errors = [];
function ok(name, cond, extra) {
  results.push([cond ? 'PASS' : 'FAIL', name + (extra ? ' — ' + extra : '')]);
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png') }) }
async function closeModal(page) { await page.mouse.click(15, 475); await page.waitForTimeout(400) }

(async () => {
  // ids de 2 photos de Dupont dans des séances différentes (pour ?edit&compare)
  const sb = createClient(cfg.url, cfg.anonKey);
  await sb.auth.signInWithPassword({ email: creds.email, password: creds.pass });
  const { data: mem } = await sb.from('workspace_members').select('workspace_id').limit(1);
  const wsId = mem[0].workspace_id;
  const { data: d1 } = await sb.from('dossiers').select('id').eq('name', 'TEST Dupont Martin').single();
  const { data: photos } = await sb.from('patient_photos').select('id,capture_session_id,taken_at')
    .eq('workspace_id', wsId).eq('dossier_id', d1.id).order('taken_at');
  const pBefore = photos.find((p) => p.capture_session_id);
  const pAfter = photos.find((p) => p.capture_session_id && p.capture_session_id !== pBefore.capture_session_id);
  console.log('compare pair:', pBefore && pBefore.id.slice(0, 8), '→', pAfter && pAfter.id.slice(0, 8));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|net::|404|Failed to load resource/.test(m.text()))
      errors.push('CONSOLE: ' + m.text().slice(0, 250));
  });
  const errorsAt = () => errors.length;

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // ---- Photothèque : liste -----------------------------------------------------
  await page.goto(BASE + '/collection', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  ok('Photothèque : compteur « 10 photo(s) »', await page.locator('text=10 photo(s)').count() > 0);

  // vignettes chargées via URLs signées
  await page.waitForTimeout(2500);
  const imgs = await page.locator('img').evaluateAll((els) =>
    els.filter((i) => i.naturalWidth > 0 && i.src.includes('storage')).length);
  ok('vignettes rendues via URLs signées', imgs >= 8, `${imgs} images`);
  await shot(page, 'l01-photos');

  // ---- Filtres rapides -----------------------------------------------------------
  await page.locator('button', { hasText: /^Favorites$/ }).click();
  await page.waitForTimeout(1500);
  ok('Favorites → 2 photo(s)', await page.locator('text=2 photo(s)').count() > 0);
  await shot(page, 'l02-favorites');
  await page.locator('button', { hasText: /^À classer$/ }).click();
  await page.waitForTimeout(1500);
  ok('À classer → 2 photo(s)', await page.locator('text=2 photo(s)').count() > 0);
  await shot(page, 'l03-unassigned');
  await page.locator('button', { hasText: 'Tout effacer' }).click();
  await page.waitForTimeout(1500);

  // ---- Filtre par vue -----------------------------------------------------------
  await page.locator('select[aria-label="Toutes les vues"]').selectOption('smile');
  await page.waitForTimeout(1500);
  ok('filtre vue « Sourire » → 2 photo(s)', await page.locator('text=2 photo(s)').count() > 0);
  await page.locator('select[aria-label="Toutes les vues"]').selectOption('');
  await page.waitForTimeout(1200);

  // ---- Recherche texte -------------------------------------------------------------
  await page.locator('input[placeholder*="Patient"]').fill('dupont');
  await page.waitForTimeout(1800);
  ok('recherche « dupont » → 6 photo(s)', await page.locator('text=6 photo(s)').count() > 0);
  await shot(page, 'l04-search-dupont');
  await page.locator('input[placeholder*="Patient"]').fill('');
  await page.waitForTimeout(1500);

  // ---- Patients : séances / comparer -------------------------------------------------
  await page.locator('button', { hasText: /^Patients \(/ }).click();
  await page.waitForTimeout(1200);
  ok('Patients : 2 dossiers listés', await page.locator('text=/TEST Dupont Martin|TEST Durand Claire/').count() >= 2);
  await shot(page, 'l05-patients');
  const dupontCard = page.locator('div').filter({ hasText: 'TEST Dupont Martin' })
    .filter({ has: page.locator('button:has-text("Séances / comparer")') }).last();
  await dupontCard.locator('button:has-text("Séances / comparer")').click();
  await page.waitForTimeout(1500);
  const sessionsVisible = await page.locator('text=/Comparer deux séances/').count();
  ok('timeline patient : section comparaison de séances', sessionsVisible > 0);
  await shot(page, 'l06-timeline');

  // vue « Sourire » (défaut) présente dans les 2 séances du seed → candidats des 2 côtés
  await page.waitForTimeout(1000);
  const candA = page.locator('button[aria-label^="Choisir"][aria-label*="avant"]').first();
  const candB = page.locator('button[aria-label^="Choisir"][aria-label*="après"]').first();
  ok('candidat AVANT proposé (vue commune)', await candA.count() > 0);
  ok('candidat APRÈS proposé (vue commune)', await candB.count() > 0);
  if (await candA.count() && await candB.count()) {
    await candA.click(); await candB.click();
    await page.waitForTimeout(400);
    const cmpBtn = page.locator('button:has-text("Comparer dans le Studio")');
    ok('bouton Comparer dans le Studio actif', !(await cmpBtn.isDisabled()));
    await shot(page, 'l07-compare-picked');
    await cmpBtn.click();
    await page.waitForTimeout(4000);
    ok('navigation vers /studio avec comparaison', page.url().includes('/studio'));
  }
  await shot(page, 'l08-studio-compare');
  const compareUI = await page.locator('text=Comparer les séances').count();
  ok('interface « Comparer les séances » dans le Studio', compareUI > 0);
  const modeSel = await page.locator('select option[value="slider"]').count();
  ok('modes curseur/côte-à-côte/superposition', modeSel > 0);

  // ---- Studio : ouvrir une photo + pellicule -----------------------------------------
  await page.goto(BASE + '/collection', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('button[aria-label="Ouvrir test-photo-01.png dans le Studio"]').click();
  await page.waitForTimeout(3500);
  await shot(page, 'l09-studio-photo');
  ok('Studio : photo ouverte (canvas)', await page.locator('canvas').count() > 0);
  const ctx = await page.locator('text=TEST Dupont Martin').count();
  ok('contexte patient « TEST Dupont Martin » affiché', ctx > 0);
  const strip = await page.locator('text=/PHOTOS DU (DOSSIER|CABINET)/').count();
  ok('pellicule de photos visible', strip > 0);
  const stripCount = await page.locator('text=/\\d+ affichée/').count();
  ok('pellicule non vide', stripCount > 0);
  await shot(page, 'l10-filmstrip');

  console.log('\n===== RÉSULTATS PHOTOTHÈQUE + STUDIO (données réelles fictives) =====');
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
