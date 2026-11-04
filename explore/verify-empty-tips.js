const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
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
  const killGuide = () => pg.evaluate(() => {
    const m = [...document.querySelectorAll('div')].find((d) => d.innerText.includes("Comprendre l'acquisition"))
    const xb = m && [...m.querySelectorAll('button')].find((bb) => !bb.innerText.trim())
    xb && xb.click()
  })
  if ((await t()).includes("Comprendre l'acquisition")) { await killGuide(); await pg.waitForTimeout(600) }

  // ---- ÉTAT VIDE : survol DÉPART sans source sélectionnée ----
  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(1000)
  let x = await t()
  v('vide → plus la vieille phrase', !x.includes('Cliquer pour choisir la source des photos'))
  v('vide → catalogue des sources', x.includes('Application mobile') && x.includes('Importer des photos'))
  v('vide → appareils configurés', x.includes('APPAREILS CONFIGURÉS') || x.includes('Canon'))
  v('vide → actions Choisir/Capturer', x.includes('Choisir') && x.includes('Capturer'))
  await pg.screenshot({ path: 'shots/tip-depart-vide.png' })

  // cliquer une ligne du catalogue → source posée + modal config
  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(800)
  await pg.locator('[aria-label="Application mobile"]').first().click(); await pg.waitForTimeout(1000)
  x = await t()
  v('clic ligne → modal config ouvert', x.includes('Application mobile') && (x.includes('QR') || x.includes('Scanner')))
  // fermer le modal mobile
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500)
  await pg.evaluate(() => { const m = document.querySelector('[role=dialog]'); const x2 = m && [...m.querySelectorAll('button')].find((bb) => !bb.innerText.trim()); x2 && x2.click() })
  await pg.waitForTimeout(500)

  // ---- ÉTAT VIDE : survol ARRIVÉE sans dossier ----
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1000)
  x = await t()
  v('vide → dossiers récents listés', x.includes('TESTCASE') || x.includes('dossier(s)'))
  v('vide → actions Parcourir/Capturer', x.includes('Parcourir') && x.includes('Capturer'))
  await pg.screenshot({ path: 'shots/tip-arrivee-vide.png' })

  // cliquer un dossier dans la bulle → destination posée SANS ouvrir le modal
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(800)
  const dsBtn = pg.locator('[aria-label*="TESTCASE"]').first()
  if (await dsBtn.count()) {
    await dsBtn.click(); await pg.waitForTimeout(1000)
    x = await t()
    v('clic dossier → destination posée', x.includes('Destination sélectionnée'))
  } else v('clic dossier → destination posée', false)

  // re-survol : bulle ARRIVÉE remplie (régime riche)
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1000)
  x = await t()
  v('remplie → métadonnées + actions', (x.includes('Destination') || x.includes('photo(s)')) && x.includes('Ouvrir'))
  await pg.screenshot({ path: 'shots/tip-arrivee-remplie.png' })

  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
