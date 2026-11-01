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
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'light'); document.documentElement.dataset.theme = 'light' })

  // Ouvrir une photo
  await pg.locator('text=Choisir une photo').click(); await pg.waitForTimeout(1500)
  await pg.screenshot({ path: 'shots/t2-modal.png' })
  const img = pg.locator('img').first()
  await img.click(); await pg.waitForTimeout(2000)
  await pg.screenshot({ path: 'shots/t2-light.png' })
  console.log('LIGHT doc ok')

  // règles + bascule sombre
  await pg.keyboard.press('Control+r'); await pg.waitForTimeout(400)
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'dark'); document.documentElement.dataset.theme = 'dark' })
  await pg.waitForTimeout(800)
  await pg.screenshot({ path: 'shots/t2-dark.png' })
  console.log('DARK doc ok')
  console.log('ERRS:', JSON.stringify(errs.slice(0, 4)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
