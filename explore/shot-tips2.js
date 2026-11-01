const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.addInitScript(() => localStorage.setItem('dentopic.acq.guide', '1'))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/acquisition`); await pg.waitForTimeout(2500)
  // DÉPART → source FTP → choisir l'appareil FTP existant
  await pg.locator('text=DÉPART').click(); await pg.waitForTimeout(500)
  await pg.locator('text=FTP').first().click(); await pg.waitForTimeout(600)
  // FtpModal : cliquer la ligne du device FTP s'il existe
  const devRow = pg.locator('text=FTP —').first()
  if (await devRow.count()) { await devRow.click(); await pg.waitForTimeout(400) }
  // valider éventuelle sélection / fermer modal
  await pg.locator('button:has-text("Choisir"), button:has-text("Sélectionner")').first().click().catch(() => {})
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400)
  console.log('source:', await pg.locator('text=DÉPART').locator('..').locator('..').innerText().catch(() => '?'))
  // ARRIVÉE → choisir « Suivi 6 mois »
  await pg.locator('text=ARRIVÉE').click(); await pg.waitForTimeout(600)
  await pg.getByText('Suivi', { exact: false }).first().click(); await pg.waitForTimeout(500)
  // survol DÉPART
  const dep = await pg.locator('text=DÉPART').boundingBox()
  await pg.mouse.move(dep.x + dep.width / 2, dep.y + dep.height / 2 + 40)
  await pg.waitForTimeout(800)
  await pg.screenshot({ path: 'shots/tip-depart2.png' })
  console.log('DÉPART tip:', JSON.stringify((await pg.locator('.dentip').innerText().catch(() => '')).slice(0, 400)))
  // survol ARRIVÉE
  const arr = await pg.locator('text=ARRIVÉE').boundingBox()
  await pg.mouse.move(arr.x + arr.width / 2, arr.y + arr.height / 2 + 40)
  await pg.waitForTimeout(800)
  await pg.screenshot({ path: 'shots/tip-arrivee2.png' })
  console.log('ARRIVÉE tip:', JSON.stringify((await pg.locator('.dentip').innerText().catch(() => '')).slice(0, 400)))
  console.log('ERRS:', JSON.stringify(errs.slice(0, 4)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
