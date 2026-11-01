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
  console.log('imgs:', await pg.locator('img').count())
  await pg.locator('img').first().click(); await pg.waitForTimeout(2500)
  // texte
  await pg.keyboard.press('t'); await pg.waitForTimeout(300)
  const box = await pg.locator('canvas').first().boundingBox()
  await pg.mouse.click(box.x + 300, box.y + 300)
  await pg.waitForTimeout(400)
  await pg.locator('input[placeholder="Texte…"]').fill('TEST')
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500)
  // layerAtPoint directement — pas besoin de souris
  const r = await pg.evaluate(() => {
    const ed = window.__editor
    const l = ed.layers.find((x) => x.type === 'text')
    const d = l.cv.getContext('2d').getImageData(0, 0, ed.w, ed.h).data
    let px = -1, py = -1
    outer: for (let y = 0; y < ed.h; y++) for (let x = 0; x < ed.w; x++)
      if (d[(y * ed.w + x) * 4 + 3] > 100) { px = x; py = y; break outer }
    return { hitText: ed.layerAtPoint(px + l.dx, py + l.dy)?.type, hitBg: ed.layerAtPoint(10, 10)?.type, px, py }
  })
  console.log('layerAtPoint:', JSON.stringify(r),
    r.hitText === 'text' && r.hitBg === 'pixel' ? 'OK' : 'KO')
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
