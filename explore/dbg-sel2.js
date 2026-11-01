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
  const box = await pg.locator('canvas').first().boundingBox()
  const drag = async (x1, y1, x2, y2) => { await pg.mouse.move(x1, y1); await pg.mouse.down(); await pg.mouse.move(x2, y2, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300) }
  // 1) rectangle de sélection sur un quart de l'image (m)
  await pg.keyboard.press('m'); await pg.waitForTimeout(200)
  await drag(box.x + 50, box.y + 50, box.x + 250, box.y + 200)
  await pg.waitForTimeout(600) // fourmis animées
  await pg.screenshot({ path: 'shots/sel-ants.png' })
  // 2) pinceau hors sélection → rien ne doit se peindre dehors
  await pg.keyboard.press('b'); await pg.waitForTimeout(200)
  await drag(box.x + box.width - 250, box.y + box.height - 200, box.x + box.width - 100, box.y + box.height - 100)
  const n = await pg.evaluate(() => {
    const l = window.__editor.active
    const d = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data
    let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) c++
    return c
  })
  console.log('peinture hors sélection →', n === 0 ? '0 px (borné — comportement PS ✓)' : `${n} px (fuite !)`)
  // 3) Ctrl+D désélectionne → le même geste peint
  await pg.keyboard.press('Escape')
  await pg.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true })))
  await pg.waitForTimeout(300)
  console.log('sel après Ctrl+D:', await pg.evaluate(() => JSON.stringify(window.__editor.sel)))
  await drag(box.x + box.width - 250, box.y + box.height - 200, box.x + box.width - 100, box.y + box.height - 100)
  const n2 = await pg.evaluate(() => {
    const l = window.__editor.active
    const d = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data
    let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) c++
    return c
  })
  console.log('peinture après désélection →', n2, n2 > 0 ? 'px OK' : 'KO')
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
