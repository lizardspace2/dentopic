const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  pg.setDefaultTimeout(15000)
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(2500)

  // Ouvrir une photo dans le Studio (mode clair)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.keyboard.press('Escape')
  // forcer light
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'light'); document.documentElement.dataset.theme = 'light' })
  // ouvrir une photo via le modal
  const openBtn = pg.locator('text=/Ouvrir|ouvrir une photo/i').first()
  if (await openBtn.count()) { await openBtn.click().catch(() => {}) ; await pg.waitForTimeout(800) }
  // cliquer la 1re photo du modal si présent
  const ph = pg.locator('img').first()
  if (await ph.count()) { await ph.click().catch(() => {}); await pg.waitForTimeout(1500) }
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500)
  await pg.screenshot({ path: 'shots/st-light.png' })
  console.log('LIGHT ok')

  // Mode sombre
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'dark'); document.documentElement.dataset.theme = 'dark' })
  await pg.waitForTimeout(800)
  await pg.screenshot({ path: 'shots/st-dark.png' })
  console.log('DARK ok')
  console.log('ERRS:', JSON.stringify(errs.slice(0, 4)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
