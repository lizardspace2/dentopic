const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  pg.on('pageerror', (e) => errs.push(e.message))
  const log = (k, v) => console.log(k + ':', v)
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)

  // Export As modal
  await pg.keyboard.down('Control'); await pg.keyboard.press('s'); await pg.keyboard.up('Control')
  await pg.waitForTimeout(900)
  let txt = await pg.locator('body').innerText()
  log('EXPORT_UI', `titre=${txt.includes('Exporter sous')} qualite=${txt.includes('Qualité')} echelle=${txt.includes('Échelle')} dims=${/\d+ × \d+ px/.test(txt)} est=${/JPG ≈/.test(txt)}`)
  // changer l'échelle → les dimensions se recalculent
  const scaleInp = pg.locator('input[type="number"]').nth(1)
  await scaleInp.fill('50'); await pg.waitForTimeout(500)
  txt = await pg.locator('body').innerText()
  const m = txt.match(/(\d+) × (\d+) px/)
  const doc = await pg.evaluate(() => [window.__editor.w, window.__editor.h])
  log('SCALE50', `doc=${doc[0]}x${doc[1]} out=${m ? m[1] + 'x' + m[2] : '?'} attendu≈${Math.round(doc[0]/2)}x${Math.round(doc[1]/2)}`)
  // PNG → qualité grisée, estimation PNG
  await pg.locator('select').first().selectOption('png').catch(() => {})
  await pg.waitForTimeout(500)
  txt = await pg.locator('body').innerText()
  log('PNG_EST', /PNG ≈/.test(txt))
  await pg.screenshot({ path: 'shots/export-as.png' })
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400)

  // Nuancier
  await pg.getByText('Nuancier', { exact: true }).click(); await pg.waitForTimeout(300)
  txt = await pg.locator('body').innerText()
  log('SWATCH_UI', txt.includes('1er plan') && txt.includes('arrière-plan'))
  // clic sur un échantillon → fg ; clic droit → bg
  const sw = pg.locator('[style*="background-color: rgb(226, 87, 76)"], [title*="#e2574c"]').first()
  const n = await sw.count()
  if (n) { await sw.click(); await pg.waitForTimeout(200) }
  const fg = await pg.evaluate(() => window.__editor && JSON.stringify(document.querySelectorAll('[title]')).length >= 0 ? true : true)
  const colors = await pg.evaluate(() => ({ /* via expose */ }))
  // vérifie via les swatchs affichés : relire opts n'est pas exposé → checker le carré fg du panneau
  const fgBox = await pg.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.title?.includes('Premier plan'))
    return el ? getComputedStyle(el).backgroundColor : 'n/a'
  })
  log('FG_AFTER', fgBox)
  // clic droit sur un autre échantillon → bg
  const sw2 = pg.locator('[title*="#3a9bd9"]').first()
  if (await sw2.count()) { await sw2.click({ button: 'right' }); await pg.waitForTimeout(200) }
  const bgBox = await pg.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.title?.includes('Arrière-plan'))
    return el ? getComputedStyle(el).backgroundColor : 'n/a'
  })
  log('BG_AFTER', bgBox)

  // StatusBar
  txt = await pg.locator('body').innerText()
  log('STATUS', `${txt.includes('RVB · 8 bit')} / ${txt.includes('calque(s)')} / ${txt.includes('Ouvert :')}`)
  log('ERRS', JSON.stringify(errs.slice(0, 6)))
  await b.close()
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1) })
