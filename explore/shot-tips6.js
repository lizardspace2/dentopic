const { chromium } = require('playwright')
const U = 'http://localhost:5175'
const step = (s) => console.log('STEP', s)
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  pg.setDefaultTimeout(10000)
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.addInitScript(() => localStorage.setItem('dentopic.acq.guide', '1'))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/acquisition`); await pg.waitForTimeout(2500)

  // Source : FTP
  await pg.locator('text=DÉPART').click(); await pg.waitForTimeout(600)
  await pg.locator('text=/^FTP$/').first().click(); await pg.waitForTimeout(700)
  await pg.locator('text=/FTP —/').first().click(); await pg.waitForTimeout(500)
  await pg.mouse.click(200, 850); await pg.waitForTimeout(600)
  step('src done')

  // Arrivée : TESTCASE2 Marie (cliqué dans le modal, pas la page derrière)
  await pg.locator('text=ARRIVÉE').click(); await pg.waitForTimeout(700)
  await pg.locator('text=TESTCASE2 Marie').last().click(); await pg.waitForTimeout(600)
  await pg.mouse.click(200, 850); await pg.waitForTimeout(600)
  step('arr done')
  await pg.screenshot({ path: 'shots/t6-arr.png' })

  // Survol DÉPART
  await pg.locator('text=DÉPART').hover(); await pg.waitForTimeout(900)
  await pg.screenshot({ path: 'shots/t6-dep.png' })
  const dep = await pg.evaluate(() => [...document.body.children]
    .filter((n) => n.tagName === 'DIV' && getComputedStyle(n).position === 'fixed' && n.textContent)
    .map((n) => n.textContent.slice(0, 700)))
  console.log('DEP:', JSON.stringify(dep))
  await pg.mouse.move(760, 700); await pg.waitForTimeout(500)

  // Survol ARRIVÉE
  await pg.locator('text=ARRIVÉE').hover(); await pg.waitForTimeout(900)
  await pg.screenshot({ path: 'shots/t6-arr2.png' })
  const arr = await pg.evaluate(() => [...document.body.children]
    .filter((n) => n.tagName === 'DIV' && getComputedStyle(n).position === 'fixed' && n.textContent)
    .map((n) => n.textContent.slice(0, 700)))
  console.log('ARR:', JSON.stringify(arr))
  console.log('ERRS:', JSON.stringify(errs.slice(0, 4)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
