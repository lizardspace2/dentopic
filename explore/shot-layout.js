const { chromium } = require('playwright')
const BASE = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errs.push(m.text()))
  const step = (s) => console.log('STEP', s)
  await pg.goto(`${BASE}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3000)
  await pg.goto(`${BASE}/studio`); await pg.waitForTimeout(1000)
  step('open')
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(1500)
  await pg.locator('img').first().waitFor({ timeout: 10000 })
  await pg.locator('img').first().click(); await pg.waitForTimeout(1800)
  await pg.screenshot({ path: 'shots/layout-1-layers.png' })
  step('adj layer')
  await pg.getByText('Calque', { exact: true }).click(); await pg.waitForTimeout(300)
  await pg.getByText('Nouveau calque de réglage…', { exact: true }).click()
  await pg.waitForTimeout(700)
  await pg.screenshot({ path: 'shots/layout-2-props.png' })
  console.log('Propriétés visible:', await pg.getByText('Rétablir les valeurs par défaut', { exact: true }).isVisible())
  step('canaux')
  await pg.getByText('Canaux', { exact: true }).click(); await pg.waitForTimeout(600)
  await pg.screenshot({ path: 'shots/layout-3-canaux.png' })
  step('locks')
  await pg.getByText('Calques', { exact: true }).click(); await pg.waitForTimeout(300)
  await pg.getByText('Calque 1', { exact: true }).first().click(); await pg.waitForTimeout(250)
  console.log('lock row:', await pg.getByText('Verrou :', { exact: true }).isVisible())
  await pg.evaluate(() => {
    const ed = window.__editor
    ed.layers.find((x) => x.name === 'Calque 1').lockPx = true
  })
  const box = await pg.locator('canvas').first().boundingBox()
  await pg.keyboard.press('b'); await pg.waitForTimeout(150)
  const countPx = () => pg.evaluate(() => {
    const ed = window.__editor
    const l = ed.layers.find((x) => x.name === 'Calque 1')
    const d = l.ctx.getImageData(0, 0, l.cv.width, l.cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  })
  const n0 = await countPx()
  await pg.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2)
  await pg.mouse.down()
  await pg.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 })
  await pg.mouse.up(); await pg.waitForTimeout(300)
  console.log('lockPx:', n0, '→', await countPx(), n0 === await countPx() ? 'BLOQUÉ ✓' : 'NON BLOQUÉ ✗')
  console.log('ERRS:', errs)
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
