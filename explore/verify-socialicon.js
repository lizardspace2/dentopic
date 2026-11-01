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
  await pg.click('button:has-text("Connecter un réseau")'); await pg.waitForTimeout(800)
  await pg.screenshot({ path: 'shots/social-modal.png', clip: { x: 400, y: 150, width: 650, height: 550 } })
  const x = await pg.evaluate(() => document.body.innerText)
  console.log('9 puces:', ['Instagram','Facebook','TikTok','LinkedIn','YouTube','Pinterest','X (Twitter)','Threads','Google Business'].every((s) => x.includes(s)))
  // connecter youtube pour voir la vignette couleur dans la liste
  await pg.click('[aria-label="Choisir YouTube"]')
  await pg.fill('input[placeholder="@votre.cabinet"]', 'chaine.e2e')
  await pg.locator('button:has-text("Connecter")').last().click(); await pg.waitForTimeout(1500)
  await pg.screenshot({ path: 'shots/social-list.png', clip: { x: 180, y: 190, width: 700, height: 250 } })
  console.log('youtube listé:', (await pg.evaluate(() => document.body.innerText)).includes('@chaine.e2e'))
  // nettoyage
  await pg.click('[aria-label="Déconnecter chaine.e2e"]'); await pg.waitForTimeout(500)
  await pg.click('button:has-text("Oui, déconnecter")'); await pg.waitForTimeout(1200)
  console.log('errors:', JSON.stringify(errs))
  await b.close()
})()
