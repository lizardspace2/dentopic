const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/reglage/reseaux', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  const t = () => pg.evaluate(() => document.body.innerText)
  const v = (n, x) => console.log(n.padEnd(26), x ? '✓' : '✗')
  // créer un compte de test pour voir/modifier/supprimer
  await pg.click('button:has-text("Connecter un réseau")'); await pg.waitForTimeout(500)
  await pg.click('[aria-label="Choisir Pinterest"]')
  await pg.fill('input[placeholder="@votre.cabinet"]', 'pinterest.e2e')
  await pg.locator('button:has-text("Connecter")').last().click(); await pg.waitForTimeout(1500)
  let x = await t()
  v('compte cree', x.includes('@pinterest.e2e'))
  // voir
  await pg.click('[aria-label="Voir pinterest.e2e"]'); await pg.waitForTimeout(1200)
  x = await t()
  v('modal detail', x.includes('Détail du compte') && x.includes('publication') && x.includes('Connecté'))
  await pg.screenshot({ path: 'shots/acc-detail.png', clip: { x: 450, y: 200, width: 560, height: 450 } })
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400)
  await pg.locator('[role="dialog"], .chakra-modal__content, div').first(); // noop
  // fermer via la croix ou clic overlay
  await pg.mouse.click(200, 500); await pg.waitForTimeout(500)
  // modifier
  await pg.click('[aria-label="Modifier pinterest.e2e"]'); await pg.waitForTimeout(600)
  x = await t()
  v('modal edition', x.includes('Modifier le compte'))
  await pg.fill('input[value="pinterest.e2e"]', 'pinterest.e2e-v2')
  await pg.locator('button:has-text("Enregistrer")').last().click(); await pg.waitForTimeout(1500)
  x = await t()
  v('handle modifie', x.includes('@pinterest.e2e-v2'))
  // supprimer → confirm
  await pg.click('[aria-label="Déconnecter pinterest.e2e-v2"]'); await pg.waitForTimeout(600)
  x = await t()
  v('popup confirm', x.includes('Voulez-vous vraiment déconnecter'))
  await pg.click('button:has-text("Oui, déconnecter")'); await pg.waitForTimeout(1500)
  x = await t()
  v('supprime', !x.includes('pinterest.e2e'))
  console.log('errors:', JSON.stringify(errs))
  await b.close()
})()
