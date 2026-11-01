const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(1200)
  await pg.locator('img').first().click(); await pg.waitForTimeout(2000)
  await pg.keyboard.press('t'); await pg.waitForTimeout(300)
  const box = await pg.locator('canvas').first().boundingBox()
  await pg.mouse.click(box.x + 300, box.y + 300)
  await pg.waitForTimeout(400)
  await pg.locator('input[placeholder="Texte…"]').fill('TEST')
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500)
  // Sélection auto
  await pg.keyboard.press('v'); await pg.waitForTimeout(200)
  const sa = await pg.locator('text=Sélection auto').boundingBox()
  if (sa) await pg.mouse.click(sa.x - 8, sa.y + sa.height / 2)
  await pg.waitForTimeout(200)
  // actif = arrière-plan, puis clic pile sur les pixels du texte
  const info = await pg.evaluate(() => {
    const ed = window.__editor, v = window.__view
    ed.setActive(ed.layers[0].id)
    const l = ed.layers.find((x) => x.type === 'text')
    // centre du glyphe : premier pixel opaque dans la box du texte
    const d = l.cv.getContext('2d').getImageData(0, 0, ed.w, ed.h).data
    let px = -1, py = -1
    outer: for (let y = 0; y < ed.h; y += 2) for (let x = 0; x < ed.w; x += 2)
      if (d[(y * ed.w + x) * 4 + 3] > 100) { px = x; py = y; break outer }
    const cvs = [...document.querySelectorAll('canvas')].find((c) => c.width > 500 && c.height > 300)
    const r = cvs.getBoundingClientRect()
    return { px, py, ox: v.ox, oy: v.oy, scale: v.scale, left: r.left, top: r.top }
  })
  console.log('STEP done'); console.log('info:', JSON.stringify(info))
  await pg.mouse.click(info.left + info.ox + info.px * info.scale, info.top + info.oy + info.py * info.scale)
  await pg.waitForTimeout(300)
  console.log('sélection auto →', await pg.evaluate(() => window.__editor.active?.type),
    await pg.evaluate(() => window.__editor.active?.type) === 'text' ? 'OK' : 'KO')
  await b.close()
  console.log('ERRS:', JSON.stringify(errs.slice(0, 5)))
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
