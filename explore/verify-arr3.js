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
  const has = (s) => pg.locator(s).count()
  const rehover = async (sel) => {
    await pg.mouse.move(700, 700); await pg.waitForTimeout(400)
    await pg.locator(sel).first().hover({ force: true }); await pg.waitForTimeout(1100)
  }

  // 1. choisir le dossier via la bulle vide
  await rehover('text=ARRIVÉE')
  await pg.locator('[aria-label*="TESTCASE"]').first().click(); await pg.waitForTimeout(1200)
  v('clic dossier → destination posée', (await t()).includes('Destination sélectionnée'))

  // 2. souris ailleurs → re-survol → bulle remplie
  await rehover('text=ARRIVÉE')
  let x = await t()
  v('remplie → badge + métadonnées', x.includes('Destination') && x.includes('TESTCASE'))
  v('remplie → Ouvrir/Changer/Capturer', (await has('[aria-label="Ouvrir"]')) > 0 && (await has('[aria-label="Changer"]')) > 0)
  await pg.screenshot({ path: 'shots/tip-arrivee-remplie.png' })
  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
