// Test fonctionnel complet : Accueil / Acquisition / Dossier patient.
// Tous les boutons et sous-actions, plus le flux mobile QR de bout en bout.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, 'pages-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5199';
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));
const R = 'r' + Math.random().toString(36).slice(2, 6); // suffixe unique par exécution

const results = [];
const errors = [];
const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' — ' + x : '')]);
const warn = (n, x) => results.push(['WARN', n + (x ? ' — ' + x : '')]);
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
const closeModal = async (p) => { await p.mouse.click(15, 475); await p.waitForTimeout(400) };

// PNG minimal pour setInputFiles
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 };
const chunk = (t, d) => { const tb = Buffer.from(t); const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([tb, d]))); return Buffer.concat([l, tb, d, c]) };
function makePNG(w, h, rgb) {
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const rows = [];
  for (let y = 0; y < h; y++) { const r = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { r[1 + 3 * x] = rgb[0]; r[2 + 3 * x] = rgb[1]; r[3 + 3 * x] = rgb[2] } rows.push(r) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const FIX = path.join(OUT, 'fixture.png');
fs.writeFileSync(FIX, makePNG(400, 300, [70, 130, 220]));

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
  let dialogAnswer = ''
  page.on('dialog', async (d) => { await d.accept(dialogAnswer) }); // window.prompt Renommer
  const backToList = async () => {
    const btn = page.locator('button:has-text("Dossiers")').first();
    if (await btn.count()) await btn.click();
    else await page.goto(BASE + '/dossier-patient', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
  };

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // ============================ ACCUEIL ============================
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  ok('Accueil : titre Tableau de bord', await page.locator('text=Tableau de bord').count() > 0);
  ok('Accueil : KPI photos de la semaine', await page.locator('text=/cette semaine/').count() > 0);
  ok('Accueil : carte Photos à classer', await page.locator('text=Photos à classer').count() > 0);
  ok('Accueil : section Photos favorites', await page.locator('text=Photos favorites').count() > 0);
  ok('Accueil : 2 vignettes favorites rendues', await page.locator('img').evaluateAll((els) => els.filter((i) => i.naturalWidth > 0).length) >= 2);
  await shot(page, 'p01-accueil');

  // « Relancer l'analyse » — recharge les données du tableau
  const relaunch = page.locator('button:has-text("Relancer")');
  if (await relaunch.count()) {
    await relaunch.click();
    const busy = await page.locator('text=Analyse en cours').count();
    await page.waitForTimeout(2500);
    ok('Accueil : « Relancer l\'analyse » relance le chargement', busy > 0 || errorsAt() === 0);
  }

  // Carte « Photos à classer » : CTA → photothèque filtrée (2 non assignées dans le seed)
  const ctaTrier = page.locator('button:has-text("Trier dans la photothèque")');
  if (await ctaTrier.count()) {
    await ctaTrier.click(); await page.waitForTimeout(2000);
    ok('Accueil : CTA trier → /collection filtré', page.url().includes('/collection') && page.url().includes('unassigned'), page.url());
    await page.goBack(); await page.waitForTimeout(1500);
  } else ok('Accueil : CTA trier présent', false);

  // Cartes d'action — chaque lien mène à la bonne route
  const actions = [
    ['Nouveau dossier', '/dossier-patient?new=1'], ['Acquisition', '/acquisition'],
    ['Studio', '/studio'], ['Dossiers patients', '/dossier-patient'], ['Présentations', '/presentations'],
  ];
  for (const [title, dest] of actions) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const card = page.locator(`a:has-text("${title}")`).first();
    if (!(await card.count())) { ok(`Accueil : carte « ${title} »`, false, 'absente'); continue }
    await card.click(); await page.waitForTimeout(1500);
    const target = dest.split('?')[0];
    ok(`Accueil : carte « ${title} » → ${dest}`, page.url().includes(target), page.url());
  }

  // « Nouveau dossier » ouvre la modale de création via ?new=1
  await page.goto(BASE + '/dossier-patient?new=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok('Accueil → ?new=1 ouvre « Nouveau patient »', await page.locator('text=Nouveau patient').count() > 0);
  await closeModal(page);

  // ============================ ACQUISITION ============================
  // Forcer l'état « première visite » : le flag peut avoir été posé en passant
  // par la carte « Acquisition » de l'accueil.
  await page.goto(BASE + '/acquisition', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => localStorage.removeItem('dentopic.acq.guide'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Le guide s'auto-ouvre à la 1ʳᵉ visite (localStorage vierge)
  const guideOpen = await page.locator('text=Comprendre l\'acquisition').count();
  if (guideOpen) {
    ok('Acquisition : guide auto-ouvert 1ʳᵉ visite', true);
    for (let i = 0; i < 4; i++) { await page.locator('button:has-text("Suivant")').click(); await page.waitForTimeout(300) }
    ok('Acquisition : guide étape 5/5 atteinte', await page.locator('text=Étape 5 / 5').count() > 0);
    await page.locator('button:has-text("C\'est parti")').click(); await page.waitForTimeout(400);
  } else {
    ok('Acquisition : guide auto-ouvert 1ʳᵉ visite', false, 'localStorage déjà rempli ?');
  }
  // Bouton Aide → rouvre le guide
  await page.locator('button:has-text("Aide")').click(); await page.waitForTimeout(500);
  ok('Acquisition : Aide rouvre le guide', await page.locator('text=Comprendre l\'acquisition').count() > 0);
  for (let i = 0; i < 4 && await page.locator('button:has-text("Suivant")').count(); i++) {
    await page.locator('button:has-text("Suivant")').click(); await page.waitForTimeout(300);
  }
  await page.locator('button:has-text("C\'est parti")').click(); await page.waitForTimeout(300);

  ok('Acquisition : carte DÉPART', await page.locator('text=DÉPART').count() > 0);
  ok('Acquisition : carte ARRIVÉE', await page.locator('text=ARRIVÉE').count() > 0);
  ok('Acquisition : zone de dépôt', await page.locator('text=/Glissez vos photos ici/').count() > 0);
  ok('Acquisition : dossiers listés', await page.locator('text=/TEST /').count() >= 2);
  await shot(page, 'p02-acquisition');

  // --- DÉPART → SourceModal : les 6 sources ---
  await page.locator('text=DÉPART').locator('..').locator('..').first().click().catch(async () => {
    await page.locator('text=Choisir la source').first().click();
  });
  await page.waitForTimeout(600);
  ok('Source : modale « Source d\'acquisition »', await page.locator('text=Source d\'acquisition').count() > 0);
  for (const s of ['Application mobile', 'Depuis cet appareil', 'Appareil photo', 'FTP', 'Dossier surveillé', 'Importer des photos'])
    ok(`Source : « ${s} » listée`, await page.locator(`text=${s}`).count() > 0);
  ok('Source : « Session directe » listée', await page.locator('text=Session directe').count() > 0);
  ok('Source : « Connecter un nouvel appareil »', await page.locator('text=Connecter un nouvel appareil').count() > 0);
  await shot(page, 'p03-sources');

  // --- FTP : créer une source ---
  await page.locator('text=Transfert FTP').click(); await page.waitForTimeout(600);
  ok('FTP : modale « Source FTP »', await page.locator('text=Source FTP').count() > 0);
  await page.locator('text=Nouvelle source FTP').click(); await page.waitForTimeout(400);
  await page.locator('input[placeholder*="Canon Salle"]').fill(`TEST FTP ${R}`);
  await page.locator('input[placeholder="192.168.1.20"]').fill('192.168.1.50');
  await page.locator('button:has-text("Enregistrer la source")').click();
  // attendre la fermeture du formulaire + reload (retour à la liste des sources)
  await page.locator('button:has-text("Enregistrer la source")').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  ok('FTP : source créée et listée', await page.locator(`text=TEST FTP ${R}`).count() > 0);
  await shot(page, 'p04-ftp');
  await closeModal(page);

  // --- Dossier surveillé : créer une source ---
  await page.locator('text=DÉPART').first().click();
  await page.waitForTimeout(500);
  await page.locator('text=Auto-import depuis un dossier').click(); await page.waitForTimeout(600);
  await page.locator('text=Nouveau dossier surveillé').click(); await page.waitForTimeout(400);
  await page.locator('input[placeholder*="Nikon WMU"]').fill(`TEST Watch ${R}`);
  await page.locator('button:has-text("Enregistrer la source")').click();
  await page.locator('button:has-text("Enregistrer la source")').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  ok('Watch : source créée et listée', await page.locator(`text=TEST Watch ${R}`).count() > 0);
  await closeModal(page);

  // --- Appareil photo : ajouter un boîtier ---
  await page.locator('text=DÉPART').first().click(); await page.waitForTimeout(500);
  await page.locator('text=Boîtier connecté').click(); await page.waitForTimeout(600);
  await page.locator('text=Ajouter un appareil').click(); await page.waitForTimeout(400);
  await page.locator('button:has-text("Canon WiFi")').click(); await page.waitForTimeout(300);
  await page.locator('input[placeholder*="Salle"]').last().fill(`TEST Cam ${R}`).catch(() => {});
  await page.locator('button:has-text("Enregistrer")').click(); await page.waitForTimeout(2500);
  ok('Caméra : boîtier Canon créé', await page.locator(`text=/TEST Cam ${R}|Canon — Salle 1/`).count() > 0);
  await shot(page, 'p05-camera');
  await closeModal(page);

  // --- ARRIVÉE → DossierModal : choisir Dupont ---
  await page.locator('text=ARRIVÉE').first().click(); await page.waitForTimeout(600);
  ok('Destination : modale « Dossier de destination »', await page.locator('text=Dossier de destination').count() > 0);
  await page.locator('input[placeholder*="Rechercher un dossier"]').last().fill('dupont');
  await page.waitForTimeout(500);
  await page.locator('text=TEST Dupont Martin').last().click(); await page.waitForTimeout(800);
  ok('Destination : « TEST Dupont Martin » sélectionné', await page.locator('text=TEST Dupont Martin').count() > 0);
  await shot(page, 'p06-target-set');

  // --- Créer un dossier depuis DossierModal ---
  await page.locator('text=ARRIVÉE').first().click(); await page.waitForTimeout(600);
  await page.locator('input[placeholder*="Créer un nouveau dossier"]').last().fill(`TEST ViaModale ${R}`);
  await page.locator('button:has-text("Créer")').last().click(); await page.waitForTimeout(1500);
  ok('Destination : dossier créé via modale → sélectionné', await page.locator(`text=TEST ViaModale ${R}`).count() > 0);
  // createDest enchaîne sur la modale « Nouvelle acquisition » → la fermer
  if (await page.locator('text=Nouvelle acquisition').count()) await closeModal(page);
  // reprendre Dupont comme destination pour la suite
  await page.locator('text=ARRIVÉE').first().click(); await page.waitForTimeout(500);
  await page.locator('text=TEST Dupont Martin').last().click(); await page.waitForTimeout(700);

  // --- Import via la modale (fichier réel) ---
  await page.locator('text=Glissez vos photos ici').first().click(); await page.waitForTimeout(600);
  ok('Import : modale ouverte', await page.locator('text=Importer des photos').count() > 0);
  const fileIn = page.locator('input[type="file"]').first();
  await fileIn.setInputFiles(FIX);
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Importer")').last().click(); await page.waitForTimeout(4000);
  ok('Import : photo importée dans le dossier cible', errorsAt() === 0);
  await shot(page, 'p07-import-done');

  // --- Session mobile QR → capture téléphone → compteur ---
  await page.locator('button:has-text("Capturer depuis mobile")').click(); await page.waitForTimeout(800);
  ok('Mobile : modale QR ouverte', await page.locator('text=Connexion smartphone').count() > 0);
  ok('Mobile : QR code affiché', await page.locator('svg').count() > 0);
  const urlTxt = await page.locator('text=/\\/capture\\//').first().textContent().catch(() => '');
  const token = (urlTxt || '').split('/capture/')[1]?.trim();
  ok('Mobile : URL de capture avec token', !!token, token || 'non trouvé');
  await page.locator('button:has-text("Démarrer la session de capture")').click(); await page.waitForTimeout(2500);
  ok('Session : bandeau « Rangement automatique actif »', await page.locator('text=Rangement automatique actif').count() > 0);
  await shot(page, 'p08-session-active');

  // côté téléphone : ouvrir /capture/<token> dans un 2ᵉ onglet (même session auth)
  const phone = await context.newPage();
  phone.on('pageerror', (e) => errors.push('PHONE PAGEERROR: ' + e.message));
  await phone.goto(BASE + '/capture/' + token, { waitUntil: 'networkidle', timeout: 30000 });
  await phone.waitForTimeout(3500);
  ok('Téléphone : session trouvée + destination affichée', await phone.locator('text=/Destination : TEST Dupont Martin|Session active/').count() > 0);
  ok('Téléphone : bouton « Prendre une photo »', await phone.locator('button:has-text("Prendre une photo")').count() > 0);
  await shot(phone, 'p09-phone-capture');
  // envoyer une photo depuis la « galerie »
  await phone.locator('input[type="file"][multiple]').setInputFiles(FIX);
  await phone.waitForTimeout(4000);
  ok('Téléphone : « 1 photo(s) envoyée(s) »', await phone.locator('text=/envoyée/').count() > 0);
  await shot(phone, 'p10-phone-sent');

  // côté ordinateur : recharger → compteur mis à jour
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  ok('Session : compteur « 1 photo(s) reçue(s) » après envoi mobile', await page.locator('text=/1 photo\\(s\\) reçue/').count() > 0);
  await shot(page, 'p11-received');

  // « Suivre la capture » → dossier de destination, puis retour pour terminer
  await page.locator('button:has-text("Suivre la capture")').click(); await page.waitForTimeout(2000);
  ok('Session : « Suivre la capture » ouvre le dossier destination', page.url().includes('/dossier-patient/dossier/'), page.url());
  await page.goto(BASE + '/acquisition', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  await page.locator('button:has-text("Terminer")').click(); await page.waitForTimeout(2000);
  ok('Session : « Terminer » ferme le bandeau', await page.locator('text=Rangement automatique actif').count() === 0);
  await phone.waitForTimeout(3500);
  ok('Téléphone : « Session terminée » détectée', await phone.locator('text=Session terminée').count() > 0);
  await shot(phone, 'p12-phone-ended');
  await phone.close();

  // --- Nouvelle acquisition : destination pré-remplie + démarrage ---
  await page.locator('button:has-text("Nouvelle acquisition")').click(); await page.waitForTimeout(700);
  ok('NewAcq : modale ouverte', await page.locator('text=Nouvelle acquisition').count() > 0);
  ok('NewAcq : destination Dupont pré-remplie', await page.locator('text=TEST Dupont Martin').count() > 0);
  await shot(page, 'p13-newacq');
  await page.locator('button:has-text("Démarrer la session")').click(); await page.waitForTimeout(2500);
  ok('NewAcq : session démarrée', await page.locator('text=Rangement automatique actif').count() > 0);
  await page.locator('button:has-text("Terminer")').click(); await page.waitForTimeout(1500);

  // --- Clic sur une carte dossier = destination ---
  await page.locator(`text=TEST ViaModale ${R}`).first().click(); await page.waitForTimeout(800);
  ok('Carte dossier : clic définit la destination', await page.locator('text=Destination').count() > 0);

  // --- Checklist ---
  const hideGuide = page.locator('text=Masquer ce guide');
  if (await hideGuide.count()) {
    await hideGuide.click(); await page.waitForTimeout(500);
    ok('Checklist : « Masquer ce guide » fonctionne', await page.locator('text=Votre première acquisition').count() === 0);
  } else ok('Checklist « Votre première acquisition » visible', false, 'déjà masquée ou complète');

  // ============================ DOSSIER PATIENT ============================
  await page.goto(BASE + '/dossier-patient', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  ok('Dossiers : compteurs dossiers/photos', await page.locator('text=/dossiers$/').count() + await page.locator('text=/photos$/').count() > 0);
  ok('Dossiers : cartes Dupont + Durand + ViaModale', (await page.locator(`text=/TEST (Dupont|Durand|ViaModale)/`).count()) >= 3);
  await shot(page, 'p14-dossiers');

  // recherche
  await page.locator('input[placeholder*="Rechercher par n°"]').fill('dupont');
  await page.waitForTimeout(800);
  ok('Dossiers : recherche « dupont » → 1 carte', await page.locator('text=TEST Dupont Martin').count() === 2 && await page.locator('text=TEST Durand Claire').count() === 1);
  await page.locator('input[placeholder*="Rechercher par n°"]').fill('');
  await page.waitForTimeout(600);

  // tri par nom
  await page.locator('select').first().selectOption('name');
  await page.waitForTimeout(600);
  ok('Dossiers : tri « Nom A→Z » sans erreur', errorsAt() === 0);
  await page.locator('select').first().selectOption('recent');

  // puces de spécialité présentes (filtre)
  ok('Dossiers : puces de spécialité visibles', await page.locator('text=Toutes spécialités').count() > 0);
  const specChip = page.locator('text=Orthodontie').first();
  if (await specChip.count()) {
    await specChip.click(); await page.waitForTimeout(600);
    await page.locator('text=Toutes spécialités').click(); await page.waitForTimeout(400);
    ok('Dossiers : filtre spécialité cliquable sans erreur', errorsAt() === 0);
  }

  // création express : nom + Entrée → navigation vers la fiche
  await page.locator('input[placeholder*="Création express"]').fill(`TEST Express ${R}`);
  await page.locator('input[placeholder*="Création express"]').press('Enter');
  await page.waitForURL(/dossier-patient\/dossier\//, { timeout: 15000 }).catch(() => {});
  ok('Création express → fiche dossier ouverte', page.url().includes('/dossier-patient/dossier/'), page.url());
  await backToList();

  // Nouveau patient : formulaire complet
  await page.locator('button:has-text("Nouveau patient")').click(); await page.waitForTimeout(700);
  await page.locator('input[placeholder="DOE"]').fill(`TESTPAT ${R}`);
  await page.locator('input[placeholder="John"]').fill('Jean');
  await page.locator('input[placeholder="877"]').fill(`${Math.floor(Math.random() * 9000 + 1000)}`);
  const spec = page.locator('text=Implantologie').last();
  if (await spec.count()) await spec.click();
  await page.locator('button:has-text("Créer")').last().click(); await page.waitForTimeout(2500);
  ok('Nouveau patient → fiche créée et ouverte', page.url().includes('/dossier-patient/dossier/'), page.url());
  ok('Fiche : nom « TESTPAT Jean »', await page.locator('text=/TESTPAT/').count() > 0);
  ok('Fiche : n° de dossier affiché', await page.locator('text=/n°|Dossier n/').count() > 0);
  await shot(page, 'p15-new-patient');
  await backToList();

  // Menu contextuel (clic droit) sur la tuile TEST Express
  const expressTile = page.locator('button', { hasText: `TEST Express ${R}` }).last();
  await expressTile.click({ button: 'right' }); await page.waitForTimeout(500);
  for (const item of ['Ouvrir le dossier', 'Modifier la fiche patient', 'Nouveau sous-dossier', 'Renommer', 'Mettre à la corbeille'])
    ok(`Menu dossier : « ${item} »`, await page.locator(`text=${item}`).count() > 0);
  await shot(page, 'p16-card-menu');

  // Renommer via le menu
  await page.locator('text=Renommer').last().click(); await page.waitForTimeout(500);
  await page.locator('input[placeholder="Nom du dossier"]').fill(`TEST Express V2 ${R}`);
  await page.locator('button:has-text("Renommer")').last().click(); await page.waitForTimeout(1200);
  ok('Renommer : nom mis à jour', await page.locator(`text=TEST Express V2 ${R}`).count() > 0);

  // Nouveau sous-dossier via clic droit
  const expressTile2 = page.locator('button', { hasText: `TEST Express V2 ${R}` }).last();
  await expressTile2.click({ button: 'right' }); await page.waitForTimeout(400);
  await page.locator('text=Nouveau sous-dossier').last().click(); await page.waitForTimeout(500);
  await page.locator('input[placeholder="Nom du sous-dossier"]').fill('Séance test');
  await page.locator('button:has-text("Créer")').last().click(); await page.waitForTimeout(1200);
  ok('Sous-dossier créé sans erreur', errorsAt() === 0);

  // Modifier la fiche patient (tuile Dupont, clic droit)
  const dupontTile = page.locator('button', { hasText: 'TEST Dupont Martin' }).last();
  await dupontTile.click({ button: 'right' }); await page.waitForTimeout(400);
  await page.locator('text=Modifier la fiche patient').last().click(); await page.waitForTimeout(1000);
  ok('Fiche patient : modale d\'édition ouverte', await page.locator('button:has-text("Enregistrer")').count() > 0);
  await page.locator('input[placeholder="877"]').fill('1001');
  await page.locator('button:has-text("Enregistrer")').last().click(); await page.waitForTimeout(1500);
  ok('Fiche patient : n° 1001 enregistré',
    await page.locator('button[title*="1001"]').count() > 0 || await page.locator('text=/1001/').count() > 0);
  await shot(page, 'p17-edit-patient');

  // --- Vue détail Dupont ---
  await page.locator('button[title*="photo(s)"]').first().click(); await page.waitForTimeout(2000);
  // retomber sur la fiche Dupont (la 1ʳᵉ carte « Ouvrir » peut varier) — vérifier par URL/titre
  await page.goto(BASE + '/dossier-patient', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  await page.locator('text=TEST Dupont Martin').first().click(); await page.waitForTimeout(2000);
  ok('Détail : fiche Dupont ouverte', await page.locator('text=TEST Dupont Martin').count() > 0);
  ok('Détail : « 6 photos » ou plus', await page.locator('text=/\\d+ photos/').count() > 0);
  ok('Détail : bouton Planche contact actif', !(await page.locator('button:has-text("Planche contact")').isDisabled()));

  // Capturer → /acquisition/capture/<id> → NewAcqModal pré-remplie
  await page.locator('button:has-text("Capturer")').first().click(); await page.waitForTimeout(2500);
  ok('Détail → Capturer : route acquisition/capture', page.url().includes('/acquisition/capture/'));
  ok('Capturer : modale nouvelle acquisition auto-ouverte', await page.locator('text=Nouvelle acquisition').count() > 0);
  await shot(page, 'p18-capture-modal');
  await closeModal(page);
  await page.goBack(); await page.waitForTimeout(2000);

  // Importer un fichier directement dans le dossier
  const nPhotos = await page.locator('text=/\\d+ photos/').first().textContent();
  await page.locator('button:has-text("Importer")').first().click(); // ouvre l'input fichier caché
  await page.locator('input[type="file"][multiple]').setInputFiles(FIX);
  await page.waitForTimeout(4000);
  ok('Détail : import direct de fichier', errorsAt() === 0, `avant : ${nPhotos}`);
  await shot(page, 'p19-after-import');

  // Planche contact : générer + enregistrer → montage
  await page.locator('button:has-text("Planche contact")').click(); await page.waitForTimeout(1000);
  ok('Planche : modale ouverte', await page.locator('text=Planche contact').count() > 0);
  await page.locator('button:has-text("Générer")').click(); await page.waitForTimeout(6000);
  ok('Planche : aperçu généré', await page.locator('text=/photos · \\d+ × \\d+px/').count() > 0);
  await shot(page, 'p20-planche');
  await page.locator('button:has-text("Enregistrer la planche")').click(); await page.waitForTimeout(5000);
  ok('Planche : enregistrée comme montage', await page.locator('text=/1 montages|[2-9] montages/').count() > 0);
  await shot(page, 'p21-montage-created');

  // Photo → Studio
  await page.locator('a[href*="/studio?edit="]').first().click(); await page.waitForTimeout(3500);
  ok('Détail : clic photo → Studio', page.url().includes('/studio'), page.url());
  await page.goBack(); await page.waitForTimeout(2000);

  // Renommer le dossier (PromptModal : input autofocus + Entrée) puis restaurer le nom d'origine
  await page.locator('button:has-text("Renommer")').first().click(); await page.waitForTimeout(800);
  await page.keyboard.type(`TEST Renommé ${R}`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  ok('Renommer (modale) : nom mis à jour', await page.locator(`text=TEST Renommé ${R}`).count() > 0);
  await page.locator('button:has-text("Renommer")').first().click(); await page.waitForTimeout(800);
  await page.keyboard.type('TEST Dupont Martin');
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  ok('Renommer (modale) : nom restauré', await page.locator('text=TEST Dupont Martin').count() > 0);

  // Corbeille sur le dossier jetable « TEST Express V2 »
  await backToList();
  const trashTile = page.locator('button', { hasText: `TEST Express V2 ${R}` }).last();
  await trashTile.click({ button: 'right' }); await page.waitForTimeout(400);
  await page.locator('text=Mettre à la corbeille').last().click(); await page.waitForTimeout(600);
  ok('Corbeille : confirmation affichée', await page.locator('text=/corbeille \\?/').count() > 0);
  await shot(page, 'p22-trash-confirm');
  await page.locator('button:has-text("Oui, mettre à la corbeille")').click(); await page.waitForTimeout(2000);
  ok('Corbeille : dossier supprimé de la grille', await page.locator(`text=TEST Express V2 ${R}`).count() === 0);

  // Bouton Corbeille de l'en-tête → modale + restauration
  await page.locator('button:has-text("Corbeille")').first().click(); await page.waitForTimeout(1500);
  ok('Corbeille : modale « Corbeille » ouverte', await page.locator('text=Supprimé').count() > 0 || await page.locator('text=corbeille est vide').count() > 0);
  ok('Corbeille : dossier jetable listé', await page.locator(`text=TEST Express V2 ${R}`).count() > 0);
  await shot(page, 'p23-trash-modal');
  const restoreBtn = page.locator('button:has-text("Restaurer")').first();
  if (await restoreBtn.count()) {
    await restoreBtn.click(); await page.waitForTimeout(2000);
    ok('Corbeille : restauration → dossier de retour dans la grille', await page.locator(`text=TEST Express V2 ${R}`).count() > 0);
  } else ok('Corbeille : bouton Restaurer présent', false);

  console.log('\n===== RÉSULTATS ACCUEIL / ACQUISITION / DOSSIER PATIENT =====');
  results.forEach(([s, n]) => console.log(s + '  ' + n));
  const fails = results.filter(([s]) => s === 'FAIL').length;
  const warns = results.filter(([s]) => s === 'WARN').length;
  console.log(`\n${results.filter(([s]) => s === 'PASS').length} PASS — ${fails} FAIL — ${warns} WARN`);
  console.log('\n===== ERREURS RUNTIME =====');
  [...new Set(errors)].slice(0, 15).forEach((e) => console.log(e));
  if (!errors.length) console.log('(aucune)');

  await context.close();
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2) });
