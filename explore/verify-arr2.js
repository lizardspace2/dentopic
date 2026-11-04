const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('dentopic.acq.guide', '1'))
  const pg = await ctx.newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/acquisition', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(3000)
  const t = () => pg.evaluate(() => document.body.innerText)
  const v = (n, x) => console.log(n.padEnd(36), x ? '✓' : '✗')
  const has = (sel) => pg.locator(sel).count()

  // survol ARRIVÉE vide
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1000)
  v('bulle ARRIVÉE visible', (await t()).includes('Choisir la destination'))
  v('dossiers récents cliquables', (await has('[aria-label*="TESTCASE"]')) > 0)
  v('actions Parcourir/Capturer', (await has('[aria-label="Parcourir"]')) > 0 && (await has('[aria-label="Capturer"]')) > 0)
  await pg.screenshot({ path: 'shots/tip-arrivee-vide.png' })

  // clic dossier → destination posée
  await pg.locator('[aria-label*="TESTCASE"]').first().click(); await pg.waitForTimeout(1200)
  v('clic dossier → destination posée', (await t()).includes('Destination sélectionnée'))

  // re-survol → bulle remplie
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1200)
  x = await t()
  v('remplie → badge + métadonnées', x.includes('Destination') && x.includes('TESTCASE'))
  v('remplie → Ouvrir/Changer/Capturer', (await has('[aria-label="Ouvrir"]')) > 0 && (await has('[aria-label="Capturer"]')) > 0)
  await pg.screenshot({ path: 'shots/tip-arrivee-remplie.png' })

  // DÉPART vide → catalogue
  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(1000)
  x = await t()
  v('bulle DÉPART catalogue', x.includes('Choisir la source') && x.includes('Application mobile'))
  v('sources cliquables', (await has('[aria-label="Application mobile"]')) > 0 && (await has('[aria-label="Importer des photos"]')) > 0)
  v('appareils listés', (await t()).includes('APPAREILS CONFIGURÉS'))
  await pg.screenshot({ path: 'shots/tip-depart-vide.png' })

  // clic « Importer des photos » dans la bulle → source + modal import
  await pg.locator('[aria-label="Importer des photos"]').first().click(); await pg.waitForTimeout(1200)
  v('clic source → modal import', (await t()).includes('Glissez') || (await t()).includes('Importer'))
  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
