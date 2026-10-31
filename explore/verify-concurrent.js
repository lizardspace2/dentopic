const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto('http://127.0.0.1:5431/login')
  await pg.fill('input[type="email"]', process.env.DP_USER || '')
  await pg.fill('input[type="password"]', process.env.DP_PASS || '')
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3500)

  // ===== STUDIO : réglages groupés + comparaison + pipette BB =====
  await pg.goto('http://127.0.0.1:5431/studio'); await pg.waitForTimeout(1200)
  await pg.click('text=Choisir une photo'); await pg.waitForTimeout(1500)
  await pg.fill('input[placeholder*="Rechercher"]', '1793333215997_0000_0002')
  await pg.waitForTimeout(1800)
  await pg.locator('img').first().click()
  await pg.waitForTimeout(2500)
  // onglet Réglages
  await pg.click('text=Réglages'); await pg.waitForTimeout(600)
  const txt = await pg.evaluate(() => document.body.innerText)
  console.log('sections réglages:', ['Exposition', 'Balance des blancs', 'Niveaux', 'Détails', 'Préréglages']
    .map((s) => `${s}:${txt.includes(s) ? 'ok' : 'ABSENT'}`).join(' '))
  // exposition +1
  const sliders = pg.locator('input[type=range]')
  const n = await sliders.count()
  console.log('sliders:', n)
  if (n > 1) {
    await sliders.nth(0).fill('1.5') // exposition
    await pg.waitForTimeout(900)
  }
  // auto niveaux
  await pg.click('text=Auto'); await pg.waitForTimeout(1200)
  // comparaison
  await pg.click('text=Comparer AVANT'); await pg.waitForTimeout(800)
  const main = await pg.locator('canvas').first().boundingBox()
  await pg.mouse.move(main.x + main.width * 0.7, main.y + main.height / 2)
  await pg.mouse.down()
  await pg.mouse.move(main.x + main.width * 0.4, main.y + main.height / 2, { steps: 5 })
  await pg.mouse.up()
  await pg.waitForTimeout(600)
  await pg.screenshot({ path: 'shots/cc-compare.png' })
  console.log('compare shot ok')
  // quitter compare + pipette BB
  await pg.keyboard.press('q'); await pg.waitForTimeout(400)
  await pg.click('text=Pipette balance'); await pg.waitForTimeout(300)
  await pg.mouse.click(main.x + main.width / 2, main.y + main.height / 2)
  await pg.waitForTimeout(1200)
  await pg.screenshot({ path: 'shots/cc-wb.png' })
  console.log('wb pipette ok')
  console.log('STUDIO ERRORS:', errs.filter((e) => !e.includes('favicon')))

  // ===== DOSSIER PATIENT : nouveau patient + chips =====
  await pg.goto('http://127.0.0.1:5431/dossier-patient'); await pg.waitForTimeout(2000)
  const hasChips = await pg.locator('text=Toutes spécialités').count()
  console.log('chips spécialité:', hasChips)
  await pg.click('text=Nouveau patient'); await pg.waitForTimeout(800)
  await pg.screenshot({ path: 'shots/cc-newpatient.png' })
  await pg.fill('input[placeholder="DOE"]', 'TESTCASE')
  await pg.fill('input[placeholder="John"]', 'Jean')
  await pg.click('text=Orthodontie'); await pg.waitForTimeout(300)
  await pg.click('text=Créer'); await pg.waitForTimeout(3000)
  console.log('patient créé, url:', pg.url())
  await pg.screenshot({ path: 'shots/cc-detail.png' })

  // ===== ACQUISITION : protocole + marques =====
  await pg.goto('http://127.0.0.1:5431/acquisition'); await pg.waitForTimeout(2000)
  // fermer guide éventuel
  if (await pg.locator('text=Étape 1 / 5').count()) {
    await pg.evaluate(() => localStorage.setItem('dentopic.acq.guide', '1'))
    await pg.reload(); await pg.waitForTimeout(2000)
  }
  // destination -> dossier
  await pg.click('text=ARRIVÉE >> nth=-1').catch(() => {})
  await pg.click('div:has-text("ARRIVÉE")').catch(() => {})
  await pg.click('text=Sélectionner un dossier patient').catch(() => {})
  await pg.waitForTimeout(1000)
  const doss = pg.locator('text=TESTCASE Jean')
  if (await doss.count()) { await doss.first().click(); await pg.waitForTimeout(1000) }
  const proto = await pg.locator('text=Protocole de prise de vues').count()
  console.log('protocole visible:', proto)
  await pg.screenshot({ path: 'shots/cc-protocol.png' })
  // marques rapides dans modal caméra
  await pg.click('text=DÉPART >> nth=-1').catch(() => {})
  await pg.click('text=Choisir la source').catch(() => {})
  await pg.waitForTimeout(800)
  await pg.click('text=Appareil photo'); await pg.waitForTimeout(800)
  await pg.click('text=Ajouter un appareil'); await pg.waitForTimeout(500)
  await pg.click('text=Nikon WiFi'); await pg.waitForTimeout(300)
  await pg.screenshot({ path: 'shots/cc-camera.png' })
  const camForm = await pg.evaluate(() => document.body.innerText)
  console.log('ptp option:', camForm.includes('PTP') ? 'ok' : 'ABSENT')

  console.log('ALL ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
