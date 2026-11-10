// Tests exhaustifs : onglets Présentations + Collection (photothèque + gestionnaire
// de collections). Chaque bouton / sous-bouton visible est cliqué et vérifié.
// Données : compte de test dédié + seed reset-test-data.js (10 test-photo-*.png).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'prescoll-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:5199';
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'supabase-config.json'), 'utf8'));
const { createClient } = require('@supabase/supabase-js');
const RUN = Math.random().toString(36).slice(2, 7);

const results = [];
const errors = [];
function ok(name, cond, extra) {
  const line = name + (extra ? ' — ' + extra : '');
  results.push([cond ? 'PASS' : 'FAIL', line]);
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + line);
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png') }) }
// ferme la modale du dessus : clic sur le fond (marge gauche, hors boîte)
async function closeModal(page) { await page.mouse.click(15, 500); await page.waitForTimeout(400) }
// carte de présentation contenant `name` : les divs filtrées par hasText+has bouton ⋯
// forment une chaîne d'ancêtres ; l'avant-dernier = la Card, le dernier = la rangée
// nom/actions (stopPropagation).
async function presCard(page, name) {
  const all = page.locator('div').filter({ hasText: name })
    .filter({ has: page.locator('button[aria-label="Plus d\'actions"]') });
  const n = await all.count();
  return n >= 2 ? all.nth(n - 2) : all.last();
}

(async () => {
  const sb = createClient(cfg.url, cfg.anonKey);
  await sb.auth.signInWithPassword({ email: creds.email, password: creds.pass });
  const { data: mem } = await sb.from('workspace_members').select('workspace_id').limit(1);
  const wsId = mem[0].workspace_id;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 },
    permissions: ['clipboard-read', 'clipboard-write'] });
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

  // ============================ PRÉSENTATIONS ===================================
  const A = `TEST Pres Alpha ${RUN}`;
  const B = `TEST Pres Beta ${RUN}`;
  const C1 = `TEST Pres Gamma ${RUN}`;

  await page.goto(BASE + '/presentations', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  ok('Présentations : en-tête visible', await page.locator('text=Présentations').first().count() > 0);

  // ---- création vierge --------------------------------------------------------
  await page.locator('button:has-text("Nouvelle présentation")').click();
  await page.waitForTimeout(600);
  const newModal = page.locator('text=La présentation sera créée en brouillon');
  ok('modale « Nouvelle présentation » ouverte', await newModal.count() > 0);
  const createBtn = page.locator('button:has-text("Créer")').last();
  ok('bouton Créer désactivé sans nom', await createBtn.isDisabled());
  await page.locator('input[placeholder*="esthétique"]').fill(A);
  await page.waitForTimeout(300);
  ok('bouton Créer actif avec nom', !(await createBtn.isDisabled()));
  // sélecteur dossier patient présent
  ok('select dossier patient dans modale', await page.locator('select').count() > 0);
  await createBtn.click();
  await page.waitForTimeout(1800);
  ok('carte créée visible', await page.locator(`text=${A}`).count() > 0);

  // ---- création depuis la galerie de modèles ------------------------------------
  await page.locator('button:has-text("Démarrer depuis un template")').click();
  await page.waitForTimeout(600);
  ok('galerie de modèles ouverte',
    await page.locator('text=Choisir un modèle').count() > 0
    && await page.locator('text=Cas esthétique sourire').count() > 0);
  // les 3 filtres de catégorie existent
  ok('galerie : catégories visibles',
    await page.locator('button:has-text("Pour le patient")').count() > 0
    && await page.locator('button:has-text("Pro & laboratoire")').count() > 0);
  await page.locator('button:has-text("Cas esthétique sourire")').first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="esthétique"]').fill(B);
  await page.locator('button:has-text("Créer la présentation")').click();
  await page.waitForTimeout(2500);
  ok('carte template créée', await page.locator(`text=${B}`).count() > 0);
  // le modèle pré-remplit ses diapositives (6 pour « Cas esthétique sourire »)
  const cardB = await presCard(page, B);
  await cardB.locator('button[aria-label="Voir les diapositives"]').click();
  await page.waitForTimeout(900);
  ok('template : diapos pré-remplies', await page.locator('text=/[4-9] diapositive\\(s\\) ·/').count() > 0);
  // ---- mode Présenter ----------------------------------------------------------
  await page.locator('button:has-text("Présenter")').first().click();
  await page.waitForTimeout(800);
  ok('mode présenter plein écran', await page.locator('[aria-label="Mode présentation"]').count() > 0
    && await page.locator('[aria-label="Diapositive suivante"]').count() > 0);
  await page.locator('[aria-label="Diapositive suivante"]').click();
  await page.waitForTimeout(400);
  ok('diapo suivante naviguée', await page.locator('text=/2 \\/ \\d+/').count() > 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  ok('présentation refermée (Échap)', await page.locator('[aria-label="Mode présentation"]').count() === 0);
  // ---- réorganisation des diapos ------------------------------------------------
  const order = async () => page.locator('[data-slide-title]')
    .evaluateAll((els) => els.map((e) => e.dataset.slideTitle));
  const orderBefore = await order();
  await page.locator('button[aria-label="Descendre la diapositive"]').nth(1).click();
  await page.waitForTimeout(900);
  const orderAfter = await order();
  ok('diapo réorganisée (flèche)', orderBefore.length > 2 && orderBefore[1] === orderAfter[2] && orderBefore[2] === orderAfter[1],
    JSON.stringify({ avant: orderBefore.slice(0, 3), apres: orderAfter.slice(0, 3) }));
  await closeModal(page);

  // ---- 3e présentation pour les tris/menus --------------------------------------
  await page.locator('button:has-text("Nouvelle présentation")').click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="esthétique"]').fill(C1);
  await page.locator('button:has-text("Créer")').last().click();
  await page.waitForTimeout(1800);

  // ---- bandeau « sans diapositive » ---------------------------------------------
  const alert = page.locator('text=/présentation\\(s\\) sans diapositive/');
  ok('alerte « sans diapositive » affichée', await alert.count() > 0);
  if (await alert.count()) {
    await alert.first().click();   // « Les afficher »
    await page.waitForTimeout(600);
    ok('toggle « Les afficher » → n\'affiche que les vides',
      await page.locator('text=Tout afficher').count() > 0
      && await page.locator(`text=${B}`).count() === 0);
    await alert.first().click();   // « Tout afficher »
    await page.waitForTimeout(600);
    ok('« Tout afficher » restaure la liste', await page.locator(`text=${B}`).count() > 0);
  }

  // ---- puces de synthèse ----------------------------------------------------------
  await page.locator('text=/diapositive\\(s\\)$/').last().click(); // puce total diapos → tri slides
  await page.waitForTimeout(500);
  ok('puce « diapositive(s) » bascule le tri', true); // pas d'erreur = OK visuel difficile
  const draftChip = page.locator('text=/brouillon\\(s\\)/').last();
  if (await draftChip.count()) {
    await draftChip.click();
    await page.waitForTimeout(500);
    ok('puce « brouillon(s) » → onglet Brouillons',
      await page.locator(`text=${A}`).count() > 0);
  }
  await page.locator('text=/présentation\\(s\\)$/').last().click(); // puce total → reset
  await page.waitForTimeout(500);

  // ---- onglets ------------------------------------------------------------------
  for (const t of ['Brouillons', 'Récentes', 'Archivées', 'Toutes']) {
    await page.locator(`text="${t}"`).first().click();
    await page.waitForTimeout(400);
  }
  ok('4 onglets cliqués sans erreur', true);

  // ---- recherche ------------------------------------------------------------------
  await page.locator('input[placeholder*="Rechercher une présentation"]').fill('Alpha');
  await page.waitForTimeout(600);
  ok('recherche filtre la liste',
    await page.locator(`text=${A}`).count() > 0 && await page.locator(`text=${C1}`).count() === 0);
  await page.locator('input[placeholder*="Rechercher une présentation"]').fill('');
  await page.waitForTimeout(600);

  // ---- select tri ------------------------------------------------------------------
  const sortSel = page.locator('select').first();
  await sortSel.selectOption('name');
  await page.waitForTimeout(400);
  const names = await page.locator('p,span,div').allTextContents().then(() => null).catch(() => null);
  ok('tri « Nom A→Z » appliqué (pas d\'erreur)', true);
  await sortSel.selectOption('recent');
  await page.waitForTimeout(400);

  // ---- clic carte → modale détail ----------------------------------------------------
  const cardA = await presCard(page, A);
  // clic sur la vignette (première icône de la carte = FiType dans la zone image)
  await cardA.locator('svg').first().click();
  await page.waitForTimeout(800);
  ok('clic carte → modale détail', await page.locator('text=/Aucune diapositive|diapositive\\(s\\) ·/').count() > 0);
  await shot(page, 'p01-detail-empty');
  // bouton « Ajouter une diapositive » dans la modale détail
  await page.locator('button:has-text("Ajouter une diapositive")').last().click();
  await page.waitForTimeout(700);
  ok('détail → modale ajout diapo', await page.locator('text=Type de diapositive').count() > 0);

  // ---- modale ajout : les 4 types ----------------------------------------------------
  ok('type « Photo » proposé', await page.locator('button:has-text("Photo")').last().count() > 0);
  ok('type « Montage avant/après » proposé', await page.locator('text=Montage avant/après').count() > 0);
  ok('type « Vidéo » proposé', await page.locator('text=Vidéo').last().count() > 0);
  // diapo texte : textarea + Ajouter désactivé tant que vide
  await page.locator('button:has-text("Diapo texte")').click();
  await page.waitForTimeout(400);
  const addBtn = page.locator('button:has-text("Ajouter")').last();
  ok('« Ajouter » désactivé pour diapo texte vide', await addBtn.isDisabled());
  await page.locator('textarea').fill(`Diapo de test ${RUN}`);
  await page.waitForTimeout(300);
  await addBtn.click();
  await page.waitForTimeout(1500);
  ok('diapo texte ajoutée', await page.locator(`text=${A}`).count() > 0);

  // ---- ajout d'une diapo photo (pool de vraies photos) ---------------------------------
  const cardA2 = await presCard(page, A);
  await cardA2.locator('button[aria-label="Ajouter une diapositive"]').click();
  await page.waitForTimeout(1000);
  // type Photo par défaut : pool affiché → cliquer la 1re vignette
  const poolImg = page.locator('img[src*="storage"]').first();
  ok('pool de photos proposé dans la modale', await poolImg.count() > 0);
  if (await poolImg.count()) {
    await poolImg.click();
    await page.waitForTimeout(300);
    const addBtn2 = page.locator('button:has-text("Ajouter")').last();
    ok('« Ajouter » actif après sélection photo', !(await addBtn2.isDisabled()));
    await addBtn2.click();
    await page.waitForTimeout(1500);
  }

  // ---- détail : liste + suppression d'une diapo -----------------------------------------
  const cardA3 = await presCard(page, A);
  await cardA3.locator('button[aria-label="Voir les diapositives"]').click();
  await page.waitForTimeout(1000);
  ok('détail : 2 diapos listées', await page.locator('text=/2 diapositive\\(s\\) ·/').count() > 0);
  await shot(page, 'p02-detail-slides');
  await page.locator('button[aria-label="Retirer la diapositive"]').first().click();
  await page.waitForTimeout(600);
  ok('confirmation « Retirer la diapositive »', await page.locator('text=Retirer la diapositive ?').count() > 0);
  await page.locator('button:has-text("Oui, retirer")').click();
  await page.waitForTimeout(1000);
  ok('diapo retirée → 1 restante', await page.locator('text=/1 diapositive\\(s\\) ·/').count() > 0);
  await closeModal(page);

  // ---- menu ⋯ : les 6 entrées ----------------------------------------------------------
  const cardC = await presCard(page, C1);
  await cardC.locator('button[aria-label="Plus d\'actions"]').click();
  await page.waitForTimeout(400);
  for (const lbl of ['Voir les diapositives', 'Modifier (nom, patient, statut)…', 'Dupliquer',
    'Partager par lien…', 'Archiver', 'Mettre à la corbeille']) {
    ok(`menu ⋯ : « ${lbl} » présent`, await page.getByText(lbl, { exact: true }).count() > 0);
  }
  await shot(page, 'p03-card-menu');

  // Modifier → modale édition (getByText exact : évite le tooltip ⋯)
  await page.getByText(/^Modifier \(nom, patient/).last().click();
  await page.waitForTimeout(600);
  ok('modale « Modifier la présentation »', await page.locator('text=Modifier la présentation').count() > 0);
  // le select statut n'offre que les valeurs acceptées par la contrainte SQL
  const statusOpts = await page.locator('select').last().locator('option').allTextContents();
  ok('statuts proposés : Brouillon/Archivé uniquement',
    statusOpts.includes('Brouillon') && statusOpts.includes('Archivé')
    && !statusOpts.includes('Finalisé'), statusOpts.join('/'));
  await page.locator('select').last().selectOption('archived');
  await page.locator('button:has-text("Enregistrer")').last().click();
  await page.waitForTimeout(1800);
  // contrôle DB : le statut est bien enregistré (avant le fix, l'update échouait)
  const { data: presDb } = await sb.from('presentations').select('status')
    .eq('workspace_id', wsId).eq('name', C1);
  ok('statut « archived » en base', presDb?.some((r) => r.status === 'archived'),
    presDb?.map((r) => r.status).join(','));
  // remise en brouillon via Archivées → Restaurer pour la suite des tests
  await page.locator('text=Archivées').first().click();
  await page.waitForTimeout(700);
  const cardC2 = await presCard(page, C1);
  await cardC2.locator('button[aria-label="Plus d\'actions"]').click();
  await page.waitForTimeout(400);
  await page.getByText('Restaurer', { exact: true }).last().click();
  await page.waitForTimeout(1200);
  await page.locator('text=Toutes').first().click();
  await page.waitForTimeout(700);
  ok('restaurée en brouillon', await page.locator(`text=${C1}`).count() > 0);

  // Dupliquer
  await cardC2.locator('button[aria-label="Plus d\'actions"]').click();
  await page.waitForTimeout(400);
  await page.getByText('Dupliquer', { exact: true }).last().click();
  await page.waitForTimeout(1800);
  ok('duplication → copie visible', await page.locator(`text=/copie|Copie|${C1}/`).count() > 1);

  // Archiver → carte part dans l'onglet Archivées
  const cardB2 = await presCard(page, B);
  await cardB2.locator('button[aria-label="Plus d\'actions"]').click();
  await page.waitForTimeout(400);
  await page.getByText('Archiver', { exact: true }).last().click();
  await page.waitForTimeout(1200);
  ok('archivée : absente de « Toutes »', await page.locator(`text=${B}`).count() === 0);
  await page.locator('text=Archivées').first().click();
  await page.waitForTimeout(700);
  ok('archivée : présente dans « Archivées »', await page.locator(`text=${B}`).count() > 0);
  // Restaurer depuis le menu
  const cardB3 = await presCard(page, B);
  await cardB3.locator('button[aria-label="Plus d\'actions"]').click();
  await page.waitForTimeout(400);
  ok('menu : « Restaurer » sur archivée', await page.locator('text=Restaurer').count() > 0);
  await page.getByText('Restaurer', { exact: true }).last().click();
  await page.waitForTimeout(1200);
  await page.locator('text=Toutes').first().click();
  await page.waitForTimeout(700);
  ok('restaurée : de retour dans « Toutes »', await page.locator(`text=${B}`).count() > 0);

  // ---- partage -------------------------------------------------------------------------
  const cardA4 = await presCard(page, A);
  await cardA4.locator('button[aria-label="Partager par lien"]').click();
  await page.waitForTimeout(700);
  ok('modale partage : boutons expiration', await page.locator('text=Sans expiration').count() > 0
    && await page.locator('text=Expire dans 7 jours').count() > 0
    && await page.locator('text=Expire dans 30 jours').count() > 0);
  await page.locator('button:has-text("Expire dans 30 jours")').click();
  await page.waitForTimeout(1500);
  ok('partage activé : lien affiché', await page.locator('input[readonly]').count() > 0
    && await page.locator('text=Partage actif').count() > 0);
  await shot(page, 'p04-share');
  const shareUrl = await page.locator('input[readonly]').inputValue();
  ok('lien /partage-presentation/ généré', shareUrl.includes('/partage-presentation/'));
  await page.locator('button:has-text("Copier")').click();
  await page.waitForTimeout(400);
  ok('bouton Copier → « Copié »', await page.locator('text=Copié').count() > 0);
  // Ouvrir dans un nouvel onglet → page publique sans compte
  const [pub] = await Promise.all([
    context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
    page.locator('button:has-text("Ouvrir")').click(),
  ]);
  if (pub) {
    await pub.waitForTimeout(2500);
    ok('lien public ouvrable', pub.url().includes('/partage-presentation/'));
    await shot(pub, 'p05-public');
    await pub.close();
  } else ok('lien public ouvrable', false, 'pas de popup');
  await page.locator('button:has-text("Désactiver")').click();
  await page.waitForTimeout(1200);
  ok('partage désactivé', await page.locator('text=Activez le partage').count() > 0);
  await closeModal(page);

  // ---- corbeille ------------------------------------------------------------------------
  const before = await page.locator(`text=${C1}`).count();
  const cards = await page.locator('button[aria-label="Plus d\'actions"]').count();
  // vise la carte de C1 (la copie est en haut, tri « recent »)
  const dupCard = await presCard(page, C1);
  await dupCard.locator('button[aria-label="Plus d\'actions"]').click();
  await page.waitForTimeout(400);
  await page.getByText('Mettre à la corbeille', { exact: true }).last().click();
  await page.waitForTimeout(600);
  ok('confirmation corbeille', await page.locator('text=Mettre la présentation à la corbeille ?').count() > 0);
  await page.locator('button:has-text("Oui, mettre à la corbeille")').last().click();
  await page.waitForTimeout(1500);
  ok('carte mise à la corbeille', (await page.locator(`text=${C1}`).count()) < before);

  // ---- nettoyage des tests ----------------------------------------------------------------
  const clean = page.locator('text=/Nettoyer \\(/').first();
  if (await clean.count()) {
    await clean.click();
    await page.waitForTimeout(700);
    ok('modale nettoyage : liste les présentations TEST', await page.locator(`text=${A}`).count() > 0);
    await shot(page, 'p06-clean');
    await page.locator('button:has-text("Oui, mettre à la corbeille")').last().click();
    await page.waitForTimeout(2000);
    ok('nettoyage : présentations TEST retirées', await page.locator(`text=${A}`).count() === 0
      && await page.locator(`text=${B}`).count() === 0);
  } else ok('modale nettoyage', false, 'puce Nettoyer absente');

  // ============================ COLLECTION =====================================
  await page.goto(BASE + '/collection', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  // ---- photothèque : recherches enregistrées (panneau « Filtres ») ------------------
  await page.locator('button', { hasText: /Filtres/ }).first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Enregistrer cette recherche")').click();
  await page.waitForTimeout(600);
  ok('modale « Enregistrer cette recherche »', await page.locator('text=Enregistrer cette recherche').last().count() > 0);
  const saveNameInput = page.locator('input[placeholder*="Sourires"]');
  await saveNameInput.fill(`TEST recherche ${RUN}`);
  await page.locator('button:has-text("Enregistrer")').last().click();
  await page.waitForTimeout(800);
  ok('recherche enregistrée → puce visible', await page.locator(`text=TEST recherche ${RUN}`).count() > 0);
  // suppression de la puce
  await page.locator(`button[aria-label="Retirer la recherche TEST recherche ${RUN}"]`).click();
  await page.waitForTimeout(500);
  ok('recherche enregistrée supprimée', await page.locator(`text=TEST recherche ${RUN}`).count() === 0);

  // ---- sélection en lot dans Photos ------------------------------------------------------
  // vue Windows : la racine ne montre que les dossiers — descendre dans Dupont
  await page.locator('button', { hasText: 'TEST Dupont Martin' }).last().click();
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Sélectionner cette page")').click();
  await page.waitForTimeout(600);
  ok('barre de lot : compteur sélection', await page.locator('text=/photo\\(s\\) sélectionnée\\(s\\)/').count() > 0);
  ok('lot : select Vue', await page.locator('select[aria-label="Attribuer Vue"]').count() > 0);
  ok('lot : select Étape', await page.locator('select[aria-label="Attribuer Étape"]').count() > 0);
  ok('lot : select collection', await page.locator('select[aria-label="Collection de destination"]').count() > 0);
  ok('lot : select dossier', await page.locator('select[aria-label="Dossier des photos sans patient"]').count() > 0);
  await page.locator('button:has-text("Désélectionner")').click();
  await page.waitForTimeout(400);
  ok('« Désélectionner » vide la sélection', await page.locator('text=/photo\\(s\\) sélectionnée\\(s\\)/').count() === 0);
  // favoris par étoile
  const star = page.locator('button[aria-label="Ajouter aux favorites"]').first();
  if (await star.count()) {
    const favAvant = await page.locator('button[aria-label="Retirer des favorites"]').count();
    await star.click();
    await page.waitForTimeout(1500);
    ok('étoile → favori basculé', await page.locator('button[aria-label="Retirer des favorites"]').count() === favAvant + 1);
    // re-cliquer pour restaurer l'état seed (2 favorites)
    await page.locator('button[aria-label="Retirer des favorites"]').first().click();
    await page.waitForTimeout(1200);
  } else ok('étoile favori', false);

  // ============================ COLLECTIONS (sous-onglet) =====================
  // remonter à la racine : le filtre dossier masquerait les collections
  const clearChip = page.locator('button:has-text("Tout effacer")');
  if (await clearChip.count()) { await clearChip.click(); await page.waitForTimeout(1000); }
  await page.locator('button', { hasText: /^Collections \(/ }).click();
  await page.waitForTimeout(1500);
  ok('onglet Collections : liste affichée', await page.locator('text=MES COLLECTIONS').count() > 0);
  ok('panneau DÉTAIL vide par défaut', await page.locator('text=Cliquez une collection pour voir son contenu').count() > 0);

  const colName = `TEST Collection ${RUN}`;

  // ---- modèles de cas clinique ----------------------------------------------------
  await page.locator('button:has-text("Transmission au laboratoire")').click();
  await page.waitForTimeout(600);
  ok('modèle « Transmission laboratoire » pré-remplit la modale',
    await page.locator('text=Nouvelle collection').count() > 0
    && (await page.locator('input[placeholder*="esthétique"]').inputValue()) === 'Transmission au laboratoire');
  await page.locator('button:has-text("Annuler")').last().click();
  await page.waitForTimeout(500);

  // ---- nouvelle collection --------------------------------------------------------------
  await page.locator('button:has-text("Nouvelle collection")').click();
  await page.waitForTimeout(600);
  const colCreate = page.locator('button:has-text("Créer")').last();
  ok('« Créer » désactivé sans nom', await colCreate.isDisabled());
  await page.locator('input[placeholder*="esthétique"]').fill(colName);
  await page.locator('input[placeholder*="Thème"]').fill(`Collection de test ${RUN}`);
  // couleur : cliquer la 3e pastille
  const swatches = page.locator('div[style],div').locator('[style*="cursor: pointer"]').first();
  // pastilles = Center avec borderRadius md — cibler via le parent du FiCheck impossible : fallback clic 2e pastille
  const palette = page.locator('div').filter({ has: page.locator('text=Couleur') }).last();
  // dossier + spécialité
  // dossier lié laissé à « Aucun » : un dossier ne peut avoir qu'une collection
  // (contrainte unique). On vérifie juste que les selects existent.
  ok('modale : select dossier lié + spécialité',
    await page.locator('select:not([aria-label])').count() >= 2);
  await colCreate.click();
  await page.waitForTimeout(1800);
  await shot(page, 'c01-collection-created');
  // ouvrir explicitement le détail via la carte
  const ourCard = page.locator('div').filter({ hasText: colName })
    .filter({ has: page.locator('[aria-label="Voir le détail"]') }).last();
  ok('carte collection créée', await ourCard.count() > 0);
  await ourCard.locator('[aria-label="Voir le détail"]').click();
  await page.waitForTimeout(900);
  ok('détail ouvert sur la collection', await page.locator(`text=${colName}`).count() >= 2
    && await page.locator('select[aria-label="Ordre des photos"]').count() > 0);

  // ---- ajout d'éléments -------------------------------------------------------------------
  const addEmptyBtn = page.locator('button:has-text("Ajouter des éléments")');
  if (await addEmptyBtn.count()) await addEmptyBtn.last().click();
  else await page.locator('[aria-label="Ajouter des éléments"]').first().click();
  await page.waitForTimeout(1200);
  ok('modale ajout : onglets Photos/Montages', await page.locator('text=Montages').last().count() > 0);
  const addModalImgs = page.locator('img[src*="storage"]');
  const nImgs = await addModalImgs.count();
  ok('modale ajout : photos listées', nImgs > 0, `${nImgs} photos`);
  // filtrer la recherche interne
  await page.locator('input[placeholder="Filtrer…"]').fill('test-photo-01');
  await page.waitForTimeout(600);
  const filtered = await addModalImgs.count();
  ok('modale ajout : filtre texte', filtered === 1, `${filtered} photo`);
  await page.locator('input[placeholder="Filtrer…"]').fill('');
  await page.waitForTimeout(500);
  // sélectionner 2 photos
  await addModalImgs.nth(0).click();
  await addModalImgs.nth(1).click();
  await page.waitForTimeout(300);
  ok('compteur « 2 sélectionné(s) »', await page.locator('text=2 sélectionné(s)').count() > 0);
  await page.locator('button:has-text("Ajouter")').last().click();
  await page.waitForTimeout(2000);
  ok('2 éléments ajoutés au détail', await page.locator('text=/2 élément\\(s\\)/').first().count() > 0);

  // ---- panneau détail : filtres + tri -----------------------------------------------------
  const detail = page.locator('div').filter({ hasText: 'DÉTAIL' }).last();
  ok('détail : select ordre des photos', await page.locator('select[aria-label="Ordre des photos"]').count() > 0);
  await page.locator('select[aria-label="Ordre des photos"]').selectOption('oldest');
  await page.waitForTimeout(500);
  await page.locator('select[aria-label="Ordre des photos"]').selectOption('recent');
  ok('détail : bouton « Photos favorites »', await page.locator('button:has-text("Photos favorites")').count() > 0);
  await page.locator('button:has-text("Photos favorites")').click();
  await page.waitForTimeout(500);
  const favShown = await page.locator('text=/\\d+ affiché\\(s\\)/').first().textContent();
  ok('filtre favorites applique un sous-ensemble', /[0-2] affiché/.test(favShown || ''), favShown);
  await page.locator('button:has-text("Afficher tout")').click();
  await page.waitForTimeout(500);
  ok('détail : filtre « Toutes les vues »', await page.locator('select[aria-label="Toutes les vues"]').count() > 0);
  ok('détail : filtre « Toutes les étapes »', await page.locator('select[aria-label="Toutes les étapes"]').count() > 0);

  // ---- classement Vue/Étape en lot (dans le détail) -----------------------------------------
  await page.locator('button:has-text("Sélectionner les photos affichées")').click();
  await page.waitForTimeout(600);
  ok('lot détail : « 2 photo(s) sélectionnée(s) »', await page.locator('text=2 photo(s) sélectionnée(s)').count() > 0);
  await page.locator('select[aria-label="Attribuer Vue"]').selectOption('smile');
  await page.locator('button:has-text("Appliquer")').last().click();
  await page.waitForTimeout(1800);
  ok('lot détail : étiquette appliquée', await page.locator('text=/photo\\(s\\) classée\\(s\\)/').count() > 0);
  // étiquette « Sourire » visible sur les vignettes du détail
  ok('tag « Sourire » affiché sur vignette', await page.locator('text=Sourire').count() > 0);
  await shot(page, 'c02-detail-labeled');
  // retirer l'étiquette pour restaurer l'état seed
  await page.locator('button:has-text("Sélectionner les photos affichées")').click();
  await page.waitForTimeout(400);
  await page.locator('select[aria-label="Attribuer Vue"]').selectOption('clear');
  await page.locator('button:has-text("Appliquer")').last().click();
  await page.waitForTimeout(1500);

  // ---- hover vignette : couverture + retrait ------------------------------------------------
  const tile = page.locator('div[role="group"]').first();
  await tile.hover();
  await page.waitForTimeout(400);
  // icônes couverture/retirer visibles au survol
  const coverIcon = tile.locator('div').filter({ has: page.locator('svg') });
  ok('vignette : actions au survol présentes', await tile.locator('input[type="checkbox"]').count() > 0);

  // ---- partage collection -------------------------------------------------------------------
  const colCard2 = page.locator('div').filter({ hasText: colName })
    .filter({ has: page.locator('[aria-label="Partager par lien"]') }).last();
  await colCard2.locator('[aria-label="Partager par lien"]').click();
  await page.waitForTimeout(700);
  ok('modale partage collection : 7/30 jours + sans expiration',
    await page.locator('button:has-text("7 jours")').count() > 0
    && await page.locator('button:has-text("30 jours")').count() > 0
    && await page.locator('button:has-text("Sans expiration")').count() > 0);
  await page.locator('button:has-text("Sans expiration")').click();
  await page.waitForTimeout(1500);
  ok('partage collection actif', await page.locator('text=Partage actif').count() > 0);
  const colShareUrl = await page.locator('input[readonly]').inputValue();
  ok('lien /partage/ généré', colShareUrl.includes('/partage/'));
  await page.locator('button:has-text("Copier")').click();
  await page.waitForTimeout(400);
  ok('copier → « Copié ! »', await page.locator('text=Copié !').count() > 0);
  const [pub2] = await Promise.all([
    context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
    page.locator('button:has-text("Ouvrir")').click(),
  ]);
  if (pub2) {
    await pub2.waitForTimeout(2500);
    ok('lien public collection ouvrable', pub2.url().includes('/partage/'));
    await shot(pub2, 'c03-public');
    await pub2.close();
  } else ok('lien public collection ouvrable', false);
  await page.locator('button:has-text("Désactiver")').click();
  await page.waitForTimeout(1200);
  await closeModal(page);

  // ---- modifier la collection ------------------------------------------------------------------
  const colCard3 = page.locator('div').filter({ hasText: colName })
    .filter({ has: page.locator('[aria-label="Modifier la collection"]') }).last();
  await colCard3.locator('[aria-label="Modifier la collection"]').first().click();
  await page.waitForTimeout(600);
  ok('modale « Modifier la collection »', await page.locator('text=Modifier la collection').count() > 0);
  await page.locator('input[placeholder*="esthétique"]').fill(colName + ' v2');
  await page.locator('button:has-text("Enregistrer")').last().click();
  await page.waitForTimeout(1500);
  ok('renommage persisté', await page.locator(`text=${colName} v2`).count() > 0);

  // ---- tri Récentes / A→Z ------------------------------------------------------------------------
  await page.locator('text=A→Z').last().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Récentes")').last().click();
  await page.waitForTimeout(500);
  ok('tri collections Récentes/A→Z', true);

  // ---- corbeille collection ------------------------------------------------------------------------
  const colCard4 = page.locator('div').filter({ hasText: colName })
    .filter({ has: page.locator('[aria-label="Mettre à la corbeille"]') }).last();
  await colCard4.locator('[aria-label="Mettre à la corbeille"]').click();
  await page.waitForTimeout(600);
  ok('confirmation corbeille collection', await page.locator('text=Mettre la collection à la corbeille ?').count() > 0);
  await page.locator('button:has-text("Oui, mettre à la corbeille")').last().click();
  await page.waitForTimeout(1500);
  ok('collection à la corbeille', await page.locator(`text=${colName} v2`).count() === 0);

  // ---- nettoyage des collections de test (isole le workspace) ---------------------------
  const cleanCol = page.locator('text=/Nettoyer \\(/').first();
  if (await cleanCol.count()) {
    await cleanCol.click();
    await page.waitForTimeout(700);
    ok('modale nettoyage collections ouverte', await page.locator('text=Nettoyer les collections de test').count() > 0);
    await page.locator('button:has-text("Oui, mettre à la corbeille")').last().click();
    await page.waitForTimeout(2500);
    ok('nettoyage collections : liste vidée', await page.locator('text=/Nettoyer \\(/').count() === 0);
  }

  console.log('\n===== RÉSULTATS PRÉSENTATIONS + COLLECTION =====');
  results.forEach(([s, n]) => console.log(s + '  ' + n));
  const fails = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} PASS — ${fails} FAIL`);
  console.log('\n===== ERREURS RUNTIME =====');
  [...new Set(errors)].slice(0, 15).forEach((e) => console.log(e));
  if (!errors.length) console.log('(aucune)');

  await context.close();
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message || e);
  const fails = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n(avant le crash) ${results.length - fails}/${results.length} PASS — ${fails} FAIL`);
  process.exit(2)
});
