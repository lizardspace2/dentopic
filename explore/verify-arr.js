const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } })
  // désarme le guide avant tout chargement
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
  // texte du tooltip uniquement (portal fixed)
  const tipText = () => pg.evaluate(() => {
    const tips = [...document.querySelectorAll('body > div')].filter((d) => d.style.position === 'fixed' && d.style.zIndex === '9999')
    return tips.map((d2) => d2.innerText).join('\n')
  })

  // survol ARRIVÉE vide
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1000)
  let x = await tipText()
  v('bulle ARRIVÉE visible', x.includes('Choisir la destination'))
  v('vide → dossiers récents listés', x.includes('TESTCASE') || x.includes('dossier(s)'))
  v('vide → actions Parcourir/Capturer', x.includes('Parcourir') && x.includes('Capturer'))
  await pg.screenshot({ path: 'shots/tip-arrivee-vide.png' })

  // clic dossier dans la bulle → destination posée
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(800)
  const dsBtn = pg.locator('[aria-label*="TESTCASE"]').first()
  if (await dsBtn.count()) {
    await dsBtn.click(); await pg.waitForTimeout(1200)
    v('clic dossier → destination posée', (await t()).includes('Destination sélectionnée'))
  } else v('clic dossier → destination posée', false)

  // re-survol → bulle remplie
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1200)
  x = await tipText()
  v('remplie → badge + métadonnées', x.includes('Destination') && x.includes('TESTCASE'))
  v('remplie → actions', x.includes('Ouvrir') && x.includes('Changer') && x.includes('Capturer'))
  await pg.screenshot({ path: 'shots/tip-arrivee-remplie.png' })

  // survol DÉPART vide → catalogue
  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(1000)
  x = await tipText()
  v('bulle DÉPART catalogue', x.includes('Choisir la source') && x.includes('Application mobile'))
  await pg.screenshot({ path: 'shots/tip-depart-vide.png' })
  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
