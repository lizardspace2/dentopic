const { chromium } = require('playwright')
const BASE = process.env.DP_BASE || 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
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
  // zone diff : nb de pixels modifiés dans un rectangle autour du centre
  const diffCount = () => pg.evaluate(() => {
    const cv = document.querySelector('canvas')
    const x0 = cv.width * 0.35 | 0, y0 = cv.height * 0.35 | 0, w = cv.width * 0.3 | 0, h = cv.height * 0.3 | 0
    const d = cv.getContext('2d').getImageData(x0, y0, w, h).data
    let sig = 0
    for (let i = 0; i < d.length; i += 401 * 4) sig += d[i] * 7 + d[i + 1] * 13 + d[i + 2] * 3
    return sig
  })

  // ellipse sur une zone détaillée (panneaux AVANT)
  await pg.keyboard.press('m'); await pg.waitForTimeout(200)
  await pg.selectOption('select', 'ellipse').catch(() => {})
  const x0 = box.x + box.width * 0.38, y0 = box.y + box.height * 0.4
  await pg.mouse.move(x0, y0); await pg.mouse.down()
  await pg.mouse.move(x0 + 260, y0 + 220, { steps: 5 }); await pg.mouse.up()
  await pg.waitForTimeout(300)

  const s0 = await diffCount()
  await pg.click('text=Filtre'); await pg.waitForTimeout(250)
  await pg.click('text=Tourbillon…'); await pg.waitForTimeout(600)
  // forcer un changement de paramètre pour déclencher l'aperçu
  await pg.locator('input[type="range"]').last().fill('600')
  await pg.waitForTimeout(1500)
  const s1 = await diffCount()
  console.log('TWIRL preview modifie (def 240°):', s0 !== s1, s0, '→', s1)
  await pg.screenshot({ path: 'shots/twirl-03-detail.png' })
  await pg.click('[data-preview-toggle]'); await pg.waitForTimeout(1500)
  const s2 = await diffCount()
  console.log('TWIRL off = base:', s2 === s0)
  await pg.click('[data-preview-toggle]'); await pg.waitForTimeout(1500)
  const s3 = await diffCount()
  console.log('TWIRL on = preview:', s3 === s1)
  await pg.click('text=Appliquer'); await pg.waitForTimeout(500)
  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
