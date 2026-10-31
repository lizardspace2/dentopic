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

  // ===== STUDIO : sections réglages (insensible à la casse) =====
  await pg.goto('http://127.0.0.1:5431/studio'); await pg.waitForTimeout(1200)
  await pg.click('text=Choisir une photo'); await pg.waitForTimeout(1500)
  await pg.fill('input[placeholder*="Rechercher"]', '1793333215997_0000_0002')
  await pg.waitForTimeout(1800)
  await pg.locator('img').first().click()
  await pg.waitForTimeout(2500)
  await pg.click('text=Réglages'); await pg.waitForTimeout(600)
  const txt = (await pg.evaluate(() => document.body.innerText)).toLowerCase()
  console.log('sections:', ['exposition', 'balance des blancs', 'niveaux', 'détails', 'préréglages', 'comparaison']
    .map((s) => `${s}:${txt.includes(s) ? 'ok' : 'ABSENT'}`).join(' '))
  // pipette BB + presets custom présents
  console.log('pipette btn:', await pg.locator('text=Pipette balance').count(),
    '| sauver preset:', await pg.locator('text=+ Sauver').count())

  // ===== DOSSIER PATIENT =====
  await pg.goto('http://127.0.0.1:5431/dossier-patient'); await pg.waitForTimeout(2000)
  await pg.click('text=Nouveau patient'); await pg.waitForTimeout(800)
  await pg.fill('input[placeholder="DOE"]', 'TESTCASE2')
  await pg.fill('input[placeholder="John"]', 'Marie')
  // chip dans le modal = dernier match
  await pg.locator('text=Orthodontie').last().click(); await pg.waitForTimeout(300)
  await pg.screenshot({ path: 'shots/cc2-newpatient.png' })
  await pg.locator('button:has-text("Créer")').last().click(); await pg.waitForTimeout(3500)
  console.log('url après création:', pg.url())
  const det = await pg.evaluate(() => document.body.innerText)
  console.log('détail patient:', det.includes('TESTCASE2') ? 'ok' : 'ABSENT',
    '| spécialité:', det.includes('Orthodontie') ? 'ok' : 'ABSENT')
  await pg.screenshot({ path: 'shots/cc2-detail.png' })

  // ===== ACQUISITION : protocole + marques =====
  await pg.goto('http://127.0.0.1:5431/acquisition'); await pg.waitForTimeout(2000)
  if (await pg.locator('text=Étape 1 / 5').count()) {
    await pg.evaluate(() => localStorage.setItem('dentopic.acq.guide', '1'))
    await pg.reload(); await pg.waitForTimeout(2000)
  }
  await pg.click('text=Sélectionner un dossier patient'); await pg.waitForTimeout(1000)
  const doss = pg.locator('text=TESTCASE2 Marie')
  if (await doss.count()) { await doss.first().click(); await pg.waitForTimeout(1200) }
  else { await pg.locator('text=photos_brutes').first().click().catch(() => {}); await pg.waitForTimeout(1200) }
  console.log('protocole:', await pg.locator('text=Protocole de prise de vues').count())
  const step = pg.locator('text=Portrait de face').first()
  if (await step.count()) { await step.click(); await pg.waitForTimeout(400) }
  await pg.screenshot({ path: 'shots/cc2-protocol.png' })
  // marques rapides
  await pg.click('text=Choisir la source'); await pg.waitForTimeout(800)
  await pg.click('text=Appareil photo'); await pg.waitForTimeout(800)
  await pg.click('text=Ajouter un appareil'); await pg.waitForTimeout(500)
  await pg.click('text=Nikon WiFi'); await pg.waitForTimeout(300)
  const cam = await pg.evaluate(() => document.body.innerText)
  console.log('ptp:', cam.includes('PTP') ? 'ok' : 'ABSENT', '| name prefill:', await pg.locator('input[placeholder*="Salle"]').inputValue().catch(() => '?'))
  await pg.screenshot({ path: 'shots/cc2-camera.png' })

  console.log('ALL ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
