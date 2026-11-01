const { chromium } = require('playwright')
const BASE = process.env.DP_BASE || 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  const shot = (n) => pg.screenshot({ path: `shots/pen-${n}.png` })

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
  const P = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy]

  // ---- 1. outil plume : triangle avec un côté courbé ----
  await pg.keyboard.press('p'); await pg.waitForTimeout(200)
  const bar = await pg.evaluate(() => document.body.innerText)
  console.log('PEN_UI:', bar.includes('ancre') && bar.includes('Entrée'))
  let [x, y] = P(0.35, 0.55); await pg.mouse.click(x, y)          // ancre 1
  await pg.waitForTimeout(150)
  ;[x, y] = P(0.65, 0.55)
  await pg.mouse.move(x, y); await pg.mouse.down()                // ancre 2 + drag = Bézier
  await pg.mouse.move(x + 40, y - 60, { steps: 8 }); await pg.mouse.up()
  await pg.waitForTimeout(150)
  ;[x, y] = P(0.5, 0.8); await pg.mouse.click(x, y)               // ancre 3
  await pg.waitForTimeout(150)
  await shot('01-tracé')
  // fermer en cliquant sur le 1er point
  ;[x, y] = P(0.35, 0.55); await pg.mouse.click(x, y)
  await pg.waitForTimeout(400)
  const layers1 = await pg.evaluate(() => document.body.innerText)
  console.log('PEN_SHAPE calque Tracé:', layers1.includes('Tracé'))
  await shot('02-forme')
  const px = await pg.evaluate(() => {
    const cv = document.querySelector('canvas')
    const d = cv.getContext('2d').getImageData(cv.width * 0.5, cv.height * 0.65, 1, 1).data
    return [d[0], d[1], d[2], d[3]]
  })
  console.log('PEN_FILL pixel rempli:', px)

  // ---- 2. sélection de tracé : déplacer une ancre ----
  await pg.keyboard.press('a'); await pg.waitForTimeout(200)
  const bar2 = await pg.evaluate(() => document.body.innerText)
  console.log('SEL_UI hint:', bar2.includes('déplacer le tracé'))
  ;[x, y] = P(0.65, 0.55) // près de l'ancre 2
  await pg.mouse.move(x, y); await pg.mouse.down()
  await pg.mouse.move(x + 80, y - 40, { steps: 8 }); await pg.mouse.up()
  await pg.waitForTimeout(300)
  await shot('03-ancre')
  console.log('SEL_MOVE ok (pas d erreur)')

  // ---- 3. déplacer tout le tracé ----
  ;[x, y] = P(0.5, 0.68)
  await pg.mouse.move(x, y); await pg.mouse.down()
  await pg.mouse.move(x + 50, y + 40, { steps: 6 }); await pg.mouse.up()
  await pg.waitForTimeout(300)
  await shot('04-deplace')

  // ---- 4. plume ouverte + Entrée ----
  await pg.keyboard.press('p'); await pg.waitForTimeout(150)
  ;[x, y] = P(0.3, 0.3); await pg.mouse.click(x, y)
  ;[x, y] = P(0.4, 0.25); await pg.mouse.click(x, y)
  ;[x, y] = P(0.5, 0.3); await pg.mouse.click(x, y)
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(300)
  const layers2 = await pg.evaluate(() => (document.body.innerText.match(/Tracé/g) || []).length)
  console.log('PEN_OPEN 2e calque Tracé:', layers2)

  // ---- 5. Échap abandonne ----
  await pg.keyboard.press('p'); await pg.waitForTimeout(150)
  ;[x, y] = P(0.7, 0.3); await pg.mouse.click(x, y)
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200)
  const layers3 = await pg.evaluate(() => (document.body.innerText.match(/Tracé/g) || []).length)
  console.log('PEN_ESC pas de 3e tracé:', layers3 === layers2)

  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
