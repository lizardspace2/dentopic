const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  pg.on('pageerror', (e) => errs.push(e.message))
  const log = (k, v) => console.log(k + ':', v)
  await pg.goto(`${U}/login`, { waitUntil: 'domcontentloaded' })
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3500)
  await pg.goto(`${U}/studio`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)

  // Export As modal
  await pg.keyboard.down('Control'); await pg.keyboard.press('s'); await pg.keyboard.up('Control')
  await pg.waitForTimeout(900)
  // scope = le modal (boîte contenant le titre)
  const modal = pg.locator('div', { has: pg.getByText('Exporter sous…', { exact: true }) }).last()
  const scaleInp = modal.locator('input[type="number"]').last()
  await scaleInp.fill('50'); await pg.waitForTimeout(600)
  let mt = await modal.innerText()
  const m = mt.match(/(\d+) × (\d+) px/)
  const doc = await pg.evaluate(() => [window.__editor.w, window.__editor.h])
  log('SCALE50', `doc=${doc[0]}x${doc[1]} out=${m ? m[1] + 'x' + m[2] : '?'} attendu=${Math.round(doc[0]/2)}x${Math.round(doc[1]/2)}`)
  const fmtSel = modal.locator('select').first()
  await fmtSel.selectOption('png'); await pg.waitForTimeout(600)
  mt = await modal.innerText()
  log('PNG_EST', /PNG ≈/.test(mt))
  await fmtSel.selectOption('jpeg'); await pg.waitForTimeout(600)
  mt = await modal.innerText()
  log('JPG_EST', /JPG ≈ \d/.test(mt))
  // qualité 10 → taille doit baisser
  const est1 = mt.match(/JPG ≈ ([\d.,]+ [KM])/)?.[1]
  await modal.locator('input[type="range"]').first().fill('10'); await pg.waitForTimeout(600)
  mt = await modal.innerText()
  const est2 = mt.match(/JPG ≈ ([\d.,]+ [KM])/)?.[1]
  log('QUALITY', `q92=${est1} q10=${est2}`)
  await pg.screenshot({ path: 'shots/export-as.png' })
  await pg.getByText('Annuler', { exact: true }).click(); await pg.waitForTimeout(400)

  // Nuancier
  await pg.getByText('Nuancier', { exact: true }).click(); await pg.waitForTimeout(400)
  const sw1 = pg.locator('[title^="#e2574c"]').first()
  log('SWATCH_TILES', await sw1.count())
  await sw1.click(); await pg.waitForTimeout(300)
  const sw2 = pg.locator('[title^="#3a9bd9"]').first()
  await sw2.click({ button: 'right' }); await pg.waitForTimeout(300)
  // vérifie via les carrés fg/bg du Nuancier
  const colors = await pg.evaluate(() => {
    const tip = [...document.querySelectorAll('div')].find((d) => d.title?.includes('Premier plan'))
    const tip2 = [...document.querySelectorAll('div')].find((d) => d.title?.includes('Arrière-plan'))
    return { fg: tip ? getComputedStyle(tip).backgroundColor : 'n/a', bg: tip2 ? getComputedStyle(tip2).backgroundColor : 'n/a' }
  })
  log('COLORS', JSON.stringify(colors), 'attendu fg=rgb(226,87,76) bg=rgb(58,155,217)')

  // StatusBar
  const txt = await pg.locator('body').innerText()
  log('STATUS', `${txt.includes('RVB · 8 bit')} / ${txt.includes('calque(s)')} / ${txt.includes('Ouvert :')}`)
  log('ERRS', JSON.stringify(errs.slice(0, 6)))
  await b.close()
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1) })
