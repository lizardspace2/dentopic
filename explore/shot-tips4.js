const { chromium } = require('playwright')
const U = 'http://localhost:5175'
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

  // Source : FTP existant
  await pg.locator('text=DÉPART').click(); await pg.waitForTimeout(600)
  await pg.locator('div').filter({ hasText: /^FTP$/ }).last().click(); await pg.waitForTimeout(600)
  await pg.locator('text=/FTP —/').first().click(); await pg.waitForTimeout(400)
  await pg.keyboard.press('Escape'); await pg.mouse.click(760, 700); await pg.waitForTimeout(600)
  console.log('SRC sel:', await pg.locator('text=Source sélectionnée').count() ? 'ok' : '?')

  // Arrivée : un dossier
  await pg.locator('text=ARRIVÉE').click(); await pg.waitForTimeout(700)
  await pg.screenshot({ path: 'shots/tips-arrmodal.png' })
  const row = pg.locator('div').filter({ hasText: /Suivi 6 mois|TESTCASE|photos_/ }).last()
  await row.click().catch(async () => { await pg.locator('text=Suivi 6 mois').first().click() })
  await pg.waitForTimeout(500)
  await pg.keyboard.press('Escape'); await pg.mouse.click(760, 700); await pg.waitForTimeout(600)

  // Survol DÉPART
  const card = pg.locator('text=DÉPART').locator('xpath=ancestor::div[contains(@class,"css-")][1]')
  await pg.locator('text=DÉPART').hover(); await pg.waitForTimeout(900)
  await pg.screenshot({ path: 'shots/tips-dep.png' })
  const tips = await pg.evaluate(() =>
    [...document.body.children]
      .filter((n) => n.tagName === 'DIV' && /Source|FTP|Appareil|Arrivée|Dossier/i.test(n.textContent || '') && getComputedStyle(n).position === 'fixed')
      .map((n) => n.textContent.slice(0, 500)))
  console.log('DEP TIPS:', JSON.stringify(tips, null, 1))
  await pg.mouse.move(760, 700); await pg.waitForTimeout(500)

  // Survol ARRIVÉE
  await pg.locator('text=ARRIVÉE').hover(); await pg.waitForTimeout(900)
  await pg.screenshot({ path: 'shots/tips-arr.png' })
  const tips2 = await pg.evaluate(() =>
    [...document.body.children]
      .filter((n) => n.tagName === 'DIV' && /Arrivée|Dossier|Patient|Photos/i.test(n.textContent || '') && getComputedStyle(n).position === 'fixed')
      .map((n) => n.textContent.slice(0, 500)))
  console.log('ARR TIPS:', JSON.stringify(tips2, null, 1))
  console.log('ERRS:', JSON.stringify(errs.slice(0, 4)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
