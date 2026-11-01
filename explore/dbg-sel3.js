const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(2500)
  // vue actuelle
  console.log('view:', await pg.evaluate(() => JSON.stringify(window.__view)))
  // drag de sélection au centre du canvas — mesure sel stockée vs attendue
  const box = await pg.locator('canvas').first().boundingBox()
  const x1 = box.x + box.width / 2 - 100, y1 = box.y + box.height / 2 - 60
  const x2 = box.x + box.width / 2 + 100, y2 = box.y + box.height / 2 + 60
  await pg.keyboard.press('m'); await pg.waitForTimeout(200)
  await pg.mouse.move(x1, y1); await pg.mouse.down(); await pg.mouse.move(x2, y2, { steps: 6 }); await pg.mouse.up()
  await pg.waitForTimeout(400)
  const r = await pg.evaluate(() => {
    const ed = window.__editor, v = window.__view
    return { sel: ed.sel, view: { ox: v.ox, oy: v.oy, scale: v.scale }, w: ed.w, h: ed.h }
  })
  console.log('sel stockée:', JSON.stringify(r.sel), 'view:', JSON.stringify(r.view))
  // attendu : ((x1-box.x-ox)/scale, (y1-box.y-oy)/scale, ...)
  const expX = (x1 - box.x - r.view.ox) / r.view.scale
  const expY = (y1 - box.y - r.view.oy) / r.view.scale
  console.log(`attendu ≈ [${expX.toFixed(0)}, ${expY.toFixed(0)}, ${(400/r.view.scale/0.5|0)}x…]`)
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
