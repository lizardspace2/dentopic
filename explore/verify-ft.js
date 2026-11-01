const { chromium } = require('playwright')
const BASE = process.env.DP_BASE || 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  const shot = (n) => pg.screenshot({ path: `shots/ft-${n}.png` })
  const px = (x, y) => pg.evaluate(([x, y]) => {
    const cv = document.querySelector('canvas')
    const d = cv.getContext('2d').getImageData(x | 0, y | 0, 1, 1).data
    return [d[0], d[1], d[2], d[3]]
  }, [x, y])
  const ft = (f) => pg.locator(`input[data-ft="${f}"]`)

  await pg.goto(`${BASE}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER || '')
  await pg.fill('input[type="password"]', process.env.DP_PASS || '')
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3500)
  await pg.goto(`${BASE}/studio`); await pg.waitForTimeout(1200)
  // ouvrir un document : montage avant/après
  await pg.click('text=Fichier'); await pg.waitForTimeout(250)
  await pg.click('text=Montage avant / après'); await pg.waitForTimeout(1500)
  const thumbs = pg.locator('img')
  await thumbs.nth(0).waitFor({ timeout: 8000 })
  await thumbs.nth(0).click(); await pg.waitForTimeout(300)
  await thumbs.nth(2).click(); await pg.waitForTimeout(300)
  await pg.click('text=Créer le montage'); await pg.waitForTimeout(2500)
  const box = await pg.locator('canvas').first().boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2

  // Ctrl+T sur calque de fond verrouillé → refus (comme Photoshop)
  await pg.keyboard.press('Control+t'); await pg.waitForTimeout(300)
  console.log('FT_LOCKED refusé:', !(await ft('L').count()))

  // dupliquer le calque (Ctrl+J) → calque éditable
  await pg.keyboard.press('Control+j'); await pg.waitForTimeout(400)

  // ---- 1. Ctrl+T → cadre + barre d'options Transformation ----
  await pg.keyboard.press('Control+t'); await pg.waitForTimeout(400)
  console.log('FT_UI X/Y/L/H/∠:', await ft('X').count(), await ft('Y').count(), await ft('L').count(), await ft('H').count(), await ft('∠').count())
  console.log('FT_UI Interp:', await pg.locator('select >> nth=-1').count() >= 1, '| titre:', (await pg.evaluate(() => document.body.innerText)).includes('Transformation'))
  await shot('01-cadre')

  // ---- 2. champ L = 150 % (lié → H suit) ----
  await ft('L').fill('150'); await ft('L').blur(); await pg.waitForTimeout(300)
  console.log('FT_L150:', await ft('L').inputValue(), '| H lié:', await ft('H').inputValue())
  await shot('02-150pct')

  // ---- 3. déplacement par drag dans le cadre ----
  const x0 = +(await ft('X').inputValue()), y0 = +(await ft('Y').inputValue())
  await pg.mouse.move(cx, cy); await pg.mouse.down()
  await pg.mouse.move(cx + 60, cy + 30, { steps: 6 }); await pg.mouse.up()
  await pg.waitForTimeout(200)
  const x1 = +(await ft('X').inputValue()), y1 = +(await ft('Y').inputValue())
  console.log('FT_MOVE Δ:', Math.round(x1 - x0), Math.round(y1 - y0))

  // ---- 4. annulation Échap → pixels restaurés ----
  const before = await px(box.width / 2, box.height / 2)
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300)
  const after = await px(box.width / 2, box.height / 2)
  console.log('FT_CANCEL identique:', JSON.stringify(before) === JSON.stringify(after))

  // ---- 5. rotation 25° + Enter → historique 'Free Transform' ----
  await pg.keyboard.press('Control+t'); await pg.waitForTimeout(300)
  await ft('∠').fill('25'); await ft('∠').blur(); await pg.waitForTimeout(300)
  await shot('03-rot25')
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500)
  await pg.click('text=Hist.'); await pg.waitForTimeout(400)
  const bar2 = await pg.evaluate(() => document.body.innerText)
  console.log('FT_APPLY barre normale:', !(await ft('L').count()), '| historique:', bar2.includes('Free Transform'))
  const rot = await px(box.width / 2 + 100, box.height / 2)
  console.log('FT_ROT pixel après rotation:', rot, '| différent:', JSON.stringify(rot) !== JSON.stringify(after))
  await shot('04-applied')

  // ---- 6. Ctrl+Z → restaure ----
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(500)
  const undo = await px(box.width / 2, box.height / 2)
  console.log('FT_UNDO restauré:', JSON.stringify(undo) === JSON.stringify(after))
  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
