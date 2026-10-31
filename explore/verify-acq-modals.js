const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext()).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto('http://127.0.0.1:5431/login')
  await pg.fill('input[type="email"]', '' + (process.env.DP_USER||'') + '')
  await pg.fill('input[type="password"]', '' + (process.env.DP_PASS||'') + '')
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3500)
  await pg.goto('http://127.0.0.1:5431/acquisition')
  await pg.evaluate(() => localStorage.removeItem('dentopic.acq.guide'))
  await pg.reload(); await pg.waitForTimeout(2500)
  console.log('GUIDE:', await pg.locator('text=Comprendre').count() ? 'ok' : 'non')
  await pg.screenshot({ path: 'shots/acq-guide.png' })
  for (let i = 0; i < 4; i++) { await pg.click('text=Suivant'); await pg.waitForTimeout(300) }
  await pg.screenshot({ path: 'shots/acq-guide5.png' })
  await pg.click("text=C'est parti"); await pg.waitForTimeout(400)

  await pg.click('text=DÉPART'); await pg.waitForTimeout(500)
  console.log('SOURCE:', await pg.locator("text=Source d'acquisition").count() ? 'ok' : 'non')
  await pg.screenshot({ path: 'shots/acq-source.png' })
  await pg.mouse.click(10, 10); await pg.waitForTimeout(400)

  await pg.click('text=ARRIVÉE'); await pg.waitForTimeout(500)
  console.log('DOSSIER:', await pg.locator('text=Dossier de destination').count() ? 'ok' : 'non')
  // sélectionner le premier dossier de la liste du modal
  await pg.locator('div:has(> h2, > div) >> text=E2E').first().click().catch(async () => {
    await pg.locator('div').filter({ hasText: /^n°|E2E|photos/ }).last().click()
  })
  await pg.waitForTimeout(500)
  await pg.screenshot({ path: 'shots/acq-dossier-picked.png' })

  await pg.click('text=Capturer depuis mobile'); await pg.waitForTimeout(500)
  console.log('MOBILE:', await pg.locator('text=Connexion smartphone / tablette').count() ? 'ok' : 'non')
  await pg.screenshot({ path: 'shots/acq-mobile.png' })
  await pg.mouse.click(10, 10); await pg.waitForTimeout(400)

  await pg.click('text=Nouvelle acquisition'); await pg.waitForTimeout(500)
  console.log('NEW:', await pg.locator("text=MODE D'ACQUISITION").count() ? 'ok' : 'non')
  await pg.screenshot({ path: 'shots/acq-new.png' })
  await pg.mouse.click(10, 10); await pg.waitForTimeout(300)

  await pg.hover('button:has-text("Aide")'); await pg.waitForTimeout(350)
  await pg.screenshot({ path: 'shots/acq-tooltip.png' })
  console.log('ERRORS:', errs.filter(e => !e.includes('favicon')))
  await b.close()
})().catch(e => console.log('FAIL', e.message))
