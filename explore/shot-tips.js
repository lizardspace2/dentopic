const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/acquisition`); await pg.waitForTimeout(2500)
  // fermer le guide si ouvert
  await pg.locator('text=C\'est parti').click().catch(() => {})
  await pg.locator('button:has-text("×"), [aria-label="Close"]').first().click().catch(() => {})
  await pg.waitForTimeout(300)
  await pg.locator('.dentip, .modal, [role="dialog"]').count() // noop
  // survol de la carte DÉPART
  const dep = await pg.locator('text=DÉPART').boundingBox()
  await pg.mouse.move(dep.x + dep.width / 2, dep.y + dep.height / 2 + 30)
  await pg.waitForTimeout(700)
  await pg.screenshot({ path: 'shots/tip-depart.png' })
  const tipText = await pg.locator('.dentip').innerText().catch(() => '')
  console.log('DÉPART tip:', JSON.stringify(tipText.slice(0, 300)))
  // survol de la carte ARRIVÉE
  const arr = await pg.locator('text=ARRIVÉE').boundingBox()
  await pg.mouse.move(arr.x + arr.width / 2, arr.y + arr.height / 2 + 30)
  await pg.waitForTimeout(700)
  await pg.screenshot({ path: 'shots/tip-arrivee.png' })
  const tipText2 = await pg.locator('.dentip').innerText().catch(() => '')
  console.log('ARRIVÉE tip:', JSON.stringify(tipText2.slice(0, 300)))
  console.log('ERRS:', JSON.stringify(errs.slice(0, 4)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
