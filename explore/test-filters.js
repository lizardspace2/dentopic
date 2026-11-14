// Non-régression « UI simplifiée » : filtres repliables + éléments retirés.
// Vérifie que le pattern « recherche + bouton Filtres + cartouches amovibles »
// fonctionne sur chaque page, et que les contrôles morts/tutoriels sont absents.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'filter-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5199';
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));

const results = [];
const errors = [];
const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' — ' + x : '')]);
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });

(async () => {
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
  ok('login', !page.url().includes('login'));

  // ============================ ACQUISITION ============================
  await page.goto(BASE + '/acquisition', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  ok('Acq : pas de guide « Comprendre l\'acquisition »',
    await page.locator('text=Comprendre l\'acquisition').count() === 0);
  ok('Acq : pas de bouton Aide mort', await page.locator('button:has-text("Aide")').count() === 0);
  // la recherche filtre réellement la liste de dossiers
  const acqSearch = page.locator('input[placeholder*="Rechercher un dossier"]');
  ok('Acq : champ de recherche présent', await acqSearch.count() > 0);
  if (await acqSearch.count()) {
    await acqSearch.fill('dupont');
    await page.waitForTimeout(700);
    ok('Acq : recherche filtre les dossiers',
      await page.locator('text=TEST Dupont Martin').count() > 0
      && await page.locator('text=TEST Durand Claire').count() === 0);
    await acqSearch.fill('zzz-aucun-resultat');
    await page.waitForTimeout(700);
    ok('Acq : recherche sans résultat → message',
      await page.locator('text=/[Aa]ucun/').count() > 0);
    await acqSearch.fill('');
    await page.waitForTimeout(500);
  }
  await shot(page, 'f01-acquisition');

  // ============================ PUBLICATION ============================
  await page.goto(BASE + '/publication', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  ok('Pub : pas de bouton « Campagne IA »', await page.locator('text=/Campagne IA|Campagne/').count() === 0);
  ok('Pub : panneau latéral épuré (pas d\'Objectifs/Moments/Événements)',
    await page.locator('text=/^Objectifs$|^Meilleurs moments$|Événements à venir/').count() === 0);
  ok('Pub : guide masqué par défaut', await page.locator('text=Publier pour la première fois').count() === 0);
  // le seul bouton Aide de l'app : bascule le guide
  const aide = page.locator('button:has-text("Aide")').first();
  ok('Pub : bouton Aide présent', await aide.count() > 0);
  await aide.click();
  await page.waitForTimeout(600);
  ok('Pub : Aide affiche le guide', await page.locator('text=Publier pour la première fois').count() > 0);
  await aide.click();
  await page.waitForTimeout(500);
  ok('Pub : Aide masque le guide', await page.locator('text=Publier pour la première fois').count() === 0);
  // filtre Type repliable
  ok('Pub : puces Type masquées par défaut', await page.getByText('TYPE', { exact: true }).count() === 0);
  await page.locator('button:has-text("Filtres")').first().click();
  await page.waitForTimeout(500);
  ok('Pub : panneau Filtres → TYPE', await page.getByText('TYPE', { exact: true }).count() > 0);
  await page.getByRole('button', { name: 'Story', exact: true }).click();
  await page.waitForTimeout(500);
  ok('Pub : cartouche « Type : Story × » amovible',
    await page.locator('button:has-text("Type : Story ×")').count() > 0);
  await page.locator('button:has-text("Type : Story ×")').click();
  await page.waitForTimeout(400);
  await shot(page, 'f02-publication');

  // ============================ PRÉSENTATIONS ============================
  await page.goto(BASE + '/presentations', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  ok('Prés : vue par défaut = recherche + Filtres (statuts masqués)',
    await page.locator('input[placeholder*="Rechercher une présentation"]').count() > 0
    && await page.locator('button:has-text("Brouillons (")').count() === 0);
  const presFiltres = page.locator('button:has-text("Filtres")').first();
  await presFiltres.click();
  await page.waitForTimeout(500);
  ok('Prés : panneau Filtres → STATUT + TRI',
    await page.getByText('STATUT', { exact: true }).count() > 0
    && await page.getByText('TRI', { exact: true }).count() > 0);
  ok('Prés : puces statut avec compteurs',
    await page.locator('button:has-text("Toutes (")').count() > 0
    && await page.locator('button:has-text("Archivées (")').count() > 0);
  // filtre + cartouche amovible + Tout effacer
  await page.locator('button:has-text("Brouillons (")').first().click();
  await page.waitForTimeout(500);
  ok('Prés : cartouche « Brouillons × »', await page.locator('button:has-text("Brouillons ×")').count() > 0);
  await page.getByRole('button', { name: 'Plus de diapos', exact: true }).click();
  await page.waitForTimeout(400);
  ok('Prés : cartouche « Tri : Plus de diapos × »',
    await page.locator('button:has-text("Tri : Plus de diapos ×")').count() > 0);
  ok('Prés : bouton « Tout effacer »', await page.locator('button:has-text("Tout effacer")').count() > 0);
  await page.locator('button:has-text("Tout effacer")').click();
  await page.waitForTimeout(500);
  ok('Prés : « Tout effacer » réinitialise',
    await page.locator('button:has-text("Brouillons ×")').count() === 0
    && await page.locator('button:has-text("Tri :")').count() === 0);
  // le panneau reste ouvert tant qu'il est déplié manuellement
  ok('Prés : panneau repliable', (await presFiltres.getAttribute('aria-expanded')) === 'true');
  await presFiltres.click();
  await page.waitForTimeout(400);
  ok('Prés : panneau refermé', (await presFiltres.getAttribute('aria-expanded')) === 'false');
  await shot(page, 'f03-presentations');

  // ============================ DOSSIER PATIENT ============================
  await page.goto(BASE + '/dossier-patient', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  ok('Dossiers : recherche + Filtres (tri masqué par défaut)',
    await page.getByText('TRI', { exact: true }).count() === 0
    && await page.getByText('SPÉCIALITÉ', { exact: true }).count() === 0);
  await page.locator('button:has-text("Filtres")').first().click();
  await page.waitForTimeout(500);
  ok('Dossiers : panneau → TRI + SPÉCIALITÉ',
    await page.getByText('TRI', { exact: true }).count() > 0
    && await page.getByText('SPÉCIALITÉ', { exact: true }).count() > 0);
  await page.getByRole('button', { name: 'Nb de photos', exact: true }).click();
  await page.waitForTimeout(500);
  ok('Dossiers : cartouche tri amovible',
    await page.locator('button:has-text("Tri : Nb de photos ×")').count() > 0);
  await page.locator('button:has-text("Tout effacer")').click();
  await page.waitForTimeout(400);
  ok('Dossiers : « Tout effacer » réinitialise',
    await page.locator('button:has-text("Tri :")').count() === 0);
  await shot(page, 'f04-dossiers');

  // ============================ PHOTOTHÈQUE (référence) ============================
  await page.goto(BASE + '/collection', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const libFiltres = page.locator('button:has-text("Filtres")').first();
  ok('Photothèque : bouton Filtres présent', await libFiltres.count() > 0);
  await libFiltres.click();
  await page.waitForTimeout(600);
  ok('Photothèque : panneau ouvert (Enregistrer cette recherche)',
    await page.locator('button:has-text("Enregistrer cette recherche")').count() > 0);
  await shot(page, 'f05-phototheque');

  // ============================ COLLECTIONS → panneau détail ============================
  await page.locator('button', { hasText: /^Collections \(/ }).click();
  await page.waitForTimeout(1500);
  const colCard = page.locator('[aria-label="Voir le détail"]').first();
  if (await colCard.count()) {
    await colCard.click();
    await page.waitForTimeout(900);
    const detailFiltres = page.locator('button:has-text("Filtres")').last();
    ok('Collection détail : bouton Filtres', await detailFiltres.count() > 0);
    await detailFiltres.click();
    await page.waitForTimeout(500);
    ok('Collection détail : TRI + étiquettes cliniques',
      await page.getByText('TRI', { exact: true }).count() > 0
      && await page.getByText('ÉTIQUETTES CLINIQUES', { exact: true }).count() > 0);
    await shot(page, 'f06-collection-detail');
  } else ok('Collection détail : une collection existe', false, 'aucune carte');

  // ============================ RÉGLAGES : pas de boutons morts ============================
  for (const r of ['reglage', 'reglage/reseaux', 'reglage/protocoles', 'reglage/brand', 'reglage/stockage', 'reglage/membres', 'reglage/pro']) {
    await page.goto(BASE + '/' + r, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    ok(`Réglage ${r} : pas de bouton Aide mort`,
      await page.locator('button:has-text("Aide")').count() === 0);
  }
  ok('Réglage Pro : « Activé » (plan courant) conservé',
    await page.locator('button:has-text("Activé")').count() > 0
    || await page.locator('text=Activé').count() > 0);

  // ============================ AUTRES ONGLETS : rendu sans erreur ============================
  for (const [route, label] of [['/', 'Accueil'], ['/recherche', 'Recherche'], ['/studio', 'Studio']]) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    ok(`${label} : rend sans erreur`, errorsAt() === 0);
  }

  console.log('\n===== RÉSULTATS FILTRES / SIMPLIFICATION =====');
  results.forEach(([s, n]) => console.log(s + '  ' + n));
  const fails = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} PASS — ${fails} FAIL`);
  console.log('\n===== ERREURS RUNTIME =====');
  [...new Set(errors)].slice(0, 15).forEach((e) => console.log(e));
  if (!errors.length) console.log('(aucune)');

  await context.close();
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2) });
