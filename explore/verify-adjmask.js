const { chromium } = require('playwright')
const BASE = process.env.DP_BASE || 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto(`${BASE}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER || '')
  await pg.fill('input[type="password"]', process.env.DP_PASS || '')
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3500)
  await pg.goto(`${BASE}/studio`); await pg.waitForTimeout(1200)
  await pg.click('text=Fichier'); await pg.waitForTimeout(250)
  await pg.click('text=Montage avant / après'); await pg.waitForTimeout(1500)
  const thumbs = pg.locator('img')
  await thumbs.nth(0).waitFor({ timeout: 8000 })
  await thumbs.nth(0).click(); await pg.waitForTimeout(300)
  await thumbs.nth(2).click(); await pg.waitForTimeout(300)
  await pg.click('text=Créer le montage'); await pg.waitForTimeout(2500)
  const box = await pg.locator('canvas').first().boundingBox()
  const px = (fx, fy) => pg.evaluate(([fx, fy]) => {
    const cv = document.querySelector('canvas')
    const d = cv.getContext('2d').getImageData(cv.width * fx | 0, cv.height * fy | 0, 1, 1).data
    return [d[0], d[1], d[2]]
  }, [fx, fy])

  // sélection elliptique
  await pg.keyboard.press('m'); await pg.waitForTimeout(150)
  await pg.selectOption('select', 'ellipse').catch(() => {})
  const x0 = box.x + box.width * 0.4, y0 = box.y + box.height * 0.45
  await pg.mouse.move(x0, y0); await pg.mouse.down()
  await pg.mouse.move(x0 + 300, y0 + 240, { steps: 5 }); await pg.mouse.up()
  await pg.waitForTimeout(300)

  // onglet Réglages → Teinte / Saturation (calque masqué sur la sélection)
  await pg.click('text=Réglages'); await pg.waitForTimeout(300)
  const hasHint = await pg.evaluate(() => document.body.innerText.includes('masqué sur la sélection'))
  await pg.click('text=Teinte / Saturation'); await pg.waitForTimeout(500)
  const t1 = await pg.evaluate(() => document.body.innerText)
  console.log('ADJ_HINT:', hasHint, '| calque réglage:', t1.includes('Teinte / Saturation'))
  // miniature de masque dans le panneau Calques ?
  await pg.click('text=Calques'); await pg.waitForTimeout(300)
  await pg.screenshot({ path: 'shots/adjmask-01.png' })

  // saturation -100 via le panneau Propriétés → extérieur désaturé, intérieur intact
  await pg.click('text=Propriétés'); await pg.waitForTimeout(300)
  const in1 = await px(0.55, 0.55), out1 = await px(0.37, 0.85)
  const sliders = pg.locator('input[type="range"]')
  const n = await sliders.count()
  for (let i = 0; i < n; i++) {
    const v = await sliders.nth(i).evaluate((el) => el.closest('div')?.parentElement?.textContent || '')
    if (v.includes('Saturation')) { await sliders.nth(i).fill('-100'); break }
  }
  await pg.waitForTimeout(600)
  const in2 = await px(0.55, 0.55), out2 = await px(0.37, 0.85)
  console.log('MASK dedans désaturé:', JSON.stringify(in1) !== JSON.stringify(in2), in1, '→', in2)
  console.log('MASK dehors inchangé:', JSON.stringify(out1) === JSON.stringify(out2), out1, '→', out2)
  await pg.screenshot({ path: 'shots/adjmask-02.png' })
  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
