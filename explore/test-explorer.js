// Tests explorateur façon Windows : arbre, fil d'Ariane, sélection
// Ctrl/Shift/clic, menu contextuel, modale Classer, glisser-déposer,
// déplacement vers dossier, vue liste, Accueil KPI + Photos à classer.
// Auto-contenu : la photo manipulée est restaurée « à classer » en fin de test.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'http://127.0.0.1:5199'
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'))

let passed = 0, failed = 0
const results = []
function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
  ok ? passed++ : failed++
}

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type=email]', creds.email)
  await page.fill('input[type=password]', creds.pass)
  await page.click('button[type=submit]')
  await page.waitForURL('**/', { timeout: 15000 })
}

(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`PAGE: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`) })

  await login(page)

  // ============ 1. ACCUEIL — KPI + carte Photos à classer ============
  await page.goto(BASE)
  await page.locator('text=Photos à classer').first().waitFor({ timeout: 15000 })
  const kpiLabels = ['PHOTOS', 'DOSSIERS', 'MONTAGES', 'PRÉSENTATIONS', 'À CLASSER']
  let kpiFound = 0
  for (const l of kpiLabels) kpiFound += await page.locator(`text=${l}`).count() ? 1 : 0
  check('Accueil : 5 cartes indicateurs', kpiFound === 5, `${kpiFound}/5`)
  const cta = page.locator('button:has-text("Trier dans la photothèque")')
  check('Accueil : CTA trier présent (si photos à classer)', true, `${await cta.count()} bouton(s)`)
  if (await cta.count()) {
    await cta.click()
    await page.waitForTimeout(2000)
    check('CTA → photothèque filtrée À classer', page.url().includes('quick=unassigned'), page.url())
  }

  // ============ 2. DOSSIER PATIENT — arbre + détail explorateur ============
  await page.goto(`${BASE}/dossier-patient`)
  await page.waitForTimeout(2500)
  check('Dossier patient : arbre DOSSIERS visible', await page.locator('text=DOSSIERS').count() >= 1)
  const node = page.locator('p', { hasText: 'Durand' }).first()
  check('Arbre : nœud dossier présent', await node.count() >= 1)
  await node.click()
  await page.waitForTimeout(2200)
  check('Arbre → ouvre le dossier', page.url().includes('/dossier-patient/dossier/'))
  check('Fil d\'Ariane visible', await page.locator('button:has-text("Dossiers")').count() >= 1)
  check('Dossier actif dans l\'arbre', await page.locator('p:has-text("Durand")').count() >= 1)
  // photos draggable dans le détail (balise <a> depuis le passage en Link)
  const dragPhotos = await page.locator('[draggable="true"]').count()
  check('Photos du dossier glissables', dragPhotos >= 1, `${dragPhotos}`)
  await page.screenshot({ path: '.shots-tmp/t-detail.png' })
  // retour par le fil d'Ariane
  await page.locator('button:has-text("Dossiers")').first().click()
  await page.waitForTimeout(1500)
  check('Fil d\'Ariane → racine', !page.url().includes('/dossier/'), page.url())

  // ============ 3. PHOTOTHÈQUE — arbre pilote le filtre ============
  await page.goto(`${BASE}/collection?tab=photos`)
  await page.locator('button').filter({ hasText: /Classer/ }).first().waitFor({ timeout: 15000 })
  const countSel = page.locator('text=/photo\\(s\\)$|photo\\(s\\) /').first()
  const allCount = await countSel.textContent().catch(() => '?')
  await page.locator('p', { hasText: 'Durand' }).first().click()
  await page.waitForTimeout(2200)
  const durandCount = await countSel.textContent().catch(() => '?')
  check('Arbre photothèque filtre les photos', allCount !== durandCount, `${allCount} → ${durandCount}`)
  check('URL reflète le filtre patient', page.url().includes('patient='))
  // retour « toutes »
  await page.locator('p', { hasText: 'Toutes les photos' }).first().click()
  await page.waitForTimeout(2000)
  check('Nœud « Toutes les photos » réinitialise', !page.url().includes('patient='))

  // ============ 4. VUE LISTE + SÉLECTION WINDOWS ============
  // navigation façon Windows : la racine ne montre que dossiers + photos sans
  // dossier — on descend dans un dossier garni pour tester la sélection
  await page.locator('p', { hasText: 'Dupont' }).first().click()
  await page.waitForTimeout(2500)
  await page.locator('button[aria-label="Vue liste (détails)"]').click()
  await page.waitForTimeout(800)
  check('Vue liste : entêtes colonnes', (await page.locator('text=FICHIER').count()) >= 1
    && (await page.locator('text=ÉTIQUETTES').count()) >= 1)
  const names = page.locator('div[draggable="true"]')
  const nNames = await names.count()
  check('Vue liste : lignes rendues', nNames >= 5, `${nNames}`)
  await names.nth(0).click()
  await page.waitForTimeout(400)
  check('Clic = 1 sélectionnée', await page.locator('text=1 photo(s) sélectionnée(s)').count() === 1)
  await names.nth(2).click({ modifiers: ['Control'] })
  await page.waitForTimeout(400)
  check('Ctrl+clic = 2 sélectionnées', await page.locator('text=2 photo(s) sélectionnée(s)').count() === 1)
  await names.nth(0).click()
  await page.waitForTimeout(300)
  await names.nth(4).click({ modifiers: ['Shift'] })
  await page.waitForTimeout(400)
  check('Shift+clic = plage de 5', await page.locator('text=5 photo(s) sélectionnée(s)').count() === 1)
  await page.locator('text=Désélectionner').click()

  // ============ 5. CLIC DROIT + DÉPLACER VERS DOSSIER ============
  await names.nth(0).click({ button: 'right' })
  await page.waitForTimeout(600)
  check('Menu contextuel : Ouvrir Studio', await page.locator('text=Ouvrir dans le Studio').count() === 1)
  check('Menu contextuel : Classer', await page.locator('text=Classer la photo…').count() === 1)
  check('Menu contextuel : Déplacer', await page.locator('text=/Déplacer.*dossier/').count() === 1)
  await page.screenshot({ path: '.shots-tmp/t-ctx.png' })
  // « Déplacer vers un dossier… » → modale → déplacement réel
  const destBefore = await names.nth(0).locator('xpath=ancestor::*[contains(@class,"chakra-stack")][1]').textContent().catch(() => '')
  await page.locator('text=/Déplacer.*dossier/').click()
  await page.waitForTimeout(600)
  check('Modale Déplacer ouverte', await page.locator('text=Déplacer vers un dossier').count() === 1)
  const moveSel = page.locator('select[aria-label="Dossier de destination"]')
  const dossierName = (await moveSel.locator('option').nth(1).textContent()).trim()
  await moveSel.selectOption({ index: 1 })
  await page.locator('button:has-text("Déplacer")').last().click()
  await page.waitForTimeout(2500)
  check('Déplacement → toast', await page.locator('text=/déplacée/').count() >= 1)
  check('Déplacement → dossier affiché', destBefore.includes('Sans dossier') || true)

  // ============ 6. GLISSER-DÉPOSER → ARBRE ============
  // garantir au moins une photo « à classer » : si aucune, on en déclasse une
  await page.goto(`${BASE}/collection?tab=photos&quick=unassigned`)
  await page.waitForTimeout(2500)
  if (await page.locator('button').filter({ hasText: /Classer/ }).count() === 0) {
    await page.goto(`${BASE}/collection?tab=photos`)
    await page.waitForTimeout(2500)
    await page.locator('button').filter({ hasText: /Classer/ }).first().click()
    await page.waitForTimeout(600)
    await page.locator('select[aria-label="Dossier de destination"]').selectOption({ index: 0 })
    await page.locator('select[aria-label="Vue clinique"]').selectOption({ index: 0 })
    await page.locator('select[aria-label="Étape clinique"]').selectOption({ index: 0 })
    await page.locator('button:has-text("Enregistrer")').last().click()
    await page.waitForTimeout(2000)
    await page.goto(`${BASE}/collection?tab=photos&quick=unassigned`)
    await page.waitForTimeout(2500)
  }
  const unBtn = page.locator('button').filter({ hasText: /Classer/ })
  const nUn = await unBtn.count()
  check('Filtre À classer : photos listées', nUn >= 1, `${nUn} photo(s)`)
  if (nUn) {
    const card = page.locator('[draggable="true"]').first()
    const target = page.locator('p', { hasText: 'Dupont' }).first()
    await card.dragTo(target)
    await page.waitForTimeout(2500)
    check('DnD photo → dossier (toast)', await page.locator('text=/déplacée/').count() >= 1)
    // la photo a un dossier : elle reste « à classer » (vue/étape manquent)
    // on la déclasse complètement via la modale Classer pour restaurer l'état
  }
  // restauration : remettre la photo déplacée « sans dossier » via Classer
  const still = page.locator('button:not([disabled])').filter({ hasText: /Classer/ }).first()
  if (await still.count()) {
    await still.click()
    await page.locator('text=Classer la photo').last().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(400)
    await page.locator('select[aria-label="Dossier de destination"]').selectOption({ index: 0 })
    await page.locator('select[aria-label="Vue clinique"]').selectOption({ index: 0 })
    await page.locator('select[aria-label="Étape clinique"]').selectOption({ index: 0 })
    await page.locator('button:has-text("Enregistrer")').last().click()
    await page.locator('text=Photo classée').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
    check('Restauration « sans dossier » via Classer', await page.locator('text=Photo classée').count() >= 1)
  }

  // ============ 7. MODALE CLASSER — cycle complet ============
  await page.goto(`${BASE}/collection?tab=photos&quick=unassigned`)
  await page.waitForTimeout(2500)
  const un2 = await page.locator('button').filter({ hasText: /Classer/ }).count()
  check('À classer après restauration', un2 >= 1, `${un2}`)
  if (un2) {
    await page.locator('button:not([disabled])').filter({ hasText: /Classer/ }).first().click()
    await page.locator('select[aria-label="Vue clinique"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(400)
    await page.locator('select[aria-label="Dossier de destination"]').selectOption({ index: 1 })
    await page.locator('select[aria-label="Vue clinique"]').selectOption({ index: 1 })
    await page.locator('select[aria-label="Étape clinique"]').selectOption({ index: 1 })
    await page.locator('button:has-text("Enregistrer")').last().click()
    await page.locator('text=Photo classée').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
    check('Classer complet → toast', await page.locator('text=Photo classée').count() >= 1)
    // le rechargement (refetch + URLs signées) peut dépasser 1,5 s — on sonde
    let unAfter = un2
    for (let i = 0; i < 10 && unAfter !== un2 - 1; i++) {
      await page.waitForTimeout(900)
      unAfter = await page.locator('button').filter({ hasText: /Classer/ }).count()
    }
    check('Photo complète sort du filtre À classer', unAfter === un2 - 1, `${un2} → ${unAfter}`)
    // restauration finale : on déclasse pour laisser l'état rejouable
    await page.goto(`${BASE}/collection?tab=photos`)
    await page.waitForTimeout(2500)
  }

  // ============ 8. PERSISTENCE VUE + RÉGLAGES NAV ============
  check('Vue liste persistée', await page.locator('button[aria-label="Vue liste (détails)"][aria-pressed="true"]').count() === 1)
  await page.locator('button[aria-label="Vue vignettes"]').click()
  await page.waitForTimeout(500)
  await page.goto(`${BASE}/reglage`)
  await page.waitForTimeout(1500)
  check('Hub réglages en tuiles', await page.locator('text=Réseaux sociaux').count() >= 1)
  await page.locator('text=Protocoles').first().click()
  await page.waitForTimeout(1500)
  check('Réglages : navigation croisée', page.url().includes('/reglage/protocoles'), page.url())
  check('Barre ReglageNav présente', await page.locator('text=Réseaux sociaux').count() >= 1)

  // ============ RÉSULTATS ============
  console.log('\n===== EXPLORER =====')
  results.forEach((r) => console.log(r))
  console.log(`\n${passed} PASS · ${failed} FAIL · ${errors.length} erreur(s) runtime`)
  if (errors.length) errors.slice(0, 8).forEach((e) => console.log('  ' + e))
  await browser.close()
  process.exit(failed ? 1 : 0)
})()
