const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  pg.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(2500)
  console.log('sel au départ:', await pg.evaluate(() => JSON.stringify({ sel: window.__editor.sel, poly: !!window.__editor.selPoly })))
  // 1er geste : pinceau (b) — stroke en haut à gauche de l'image
  await pg.keyboard.press('b'); await pg.waitForTimeout(200)
  const box = await pg.locator('canvas').first().boundingBox()
  const drag = async (x1, y1, x2, y2) => { await pg.mouse.move(x1, y1); await pg.mouse.down(); await pg.mouse.move(x2, y2, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(300) }
  await drag(box.x + 100, box.y + 100, box.x + 200, box.y + 100)
  console.log('sel après pinceau:', await pg.evaluate(() => JSON.stringify({ sel: window.__editor.sel, poly: !!window.__editor.selPoly })))
  // pixels peints en zone 1 ?
  const p1 = await pg.evaluate(() => {
    const l = window.__editor.active
    const d = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  })
  // 2e geste : pinceau en bas à droite (loin) — mesure de NOUVEAUX pixels
  const p2before = p1
  await drag(box.x + box.width - 250, box.y + box.height - 200, box.x + box.width - 100, box.y + box.height - 100)
  const p2 = await pg.evaluate(() => {
    const l = window.__editor.active
    const d = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  })
  console.log(`pixels peints: après stroke1=${p1}, après stroke2=${p2}`, p2 > p2before ? 'OK — toute la zone est éditable' : 'KO — 2e zone bloquée')
  console.log('état:', await pg.evaluate(() => JSON.stringify({
    sel: window.__editor.sel, layers: window.__editor.layers.map((l) => l.name),
    lockAlpha: window.__editor.active?.lockAlpha, maskActive: window.__editor.active?.maskActive,
  })))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
