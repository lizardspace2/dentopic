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
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  const px = () => pg.evaluate(() => {
    const cv = document.querySelector('canvas')
    const d = cv.getContext('2d').getImageData(cv.width * 0.35, cv.height * 0.4, 1, 1).data
    return [d[0], d[1], d[2], d[3]]
  })

  // sélection elliptique (outil M + Ellipse)
  await pg.keyboard.press('m'); await pg.waitForTimeout(200)
  await pg.selectOption('select', 'ellipse').catch(() => {})
  await pg.mouse.move(cx - 150, cy - 120); await pg.mouse.down()
  await pg.mouse.move(cx + 100, cy + 90, { steps: 5 }); await pg.mouse.up()
  await pg.waitForTimeout(300)

  // Filtre → Tourbillon
  const base = await px()
  await pg.click('text=Filtre'); await pg.waitForTimeout(250)
  await pg.click('text=Tourbillon…'); await pg.waitForTimeout(800)
  console.log('DLG Tourbillon:', (await pg.evaluate(() => document.body.innerText)).includes('Tourbillon'))
  console.log('DLG Aperçu checkbox:', (await pg.evaluate(() => document.body.innerText)).includes('Aperçu'))
  await pg.screenshot({ path: 'shots/twirl-01-dlg.png' })

  // angle élevé → aperçu modifié
  const ang = pg.locator('input[type="number"]').last()
  await ang.fill('400'); await pg.waitForTimeout(700)
  const twirled = await px()
  console.log('PREVIEW pixel modifié:', JSON.stringify(twirled) !== JSON.stringify(base), base, '→', twirled)
  await pg.screenshot({ path: 'shots/twirl-02-preview.png' })

  // décocher Aperçu → image d'origine
  await pg.click('text=Aperçu'); await pg.waitForTimeout(600)
  const off = await px()
  console.log('PREVIEW_OFF restauré:', JSON.stringify(off) === JSON.stringify(base))

  // recocher → ré-appliqué
  await pg.click('text=Aperçu'); await pg.waitForTimeout(700)
  const on = await px()
  console.log('PREVIEW_ON ré-appliqué:', JSON.stringify(on) === JSON.stringify(twirled))

  // Appliquer → le filtre reste après fermeture
  await pg.click('text=Appliquer'); await pg.waitForTimeout(500)
  const applied = await px()
  console.log('APPLY persiste:', JSON.stringify(applied) === JSON.stringify(twirled))
  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
