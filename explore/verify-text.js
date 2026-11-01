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

  // 1. outil T : clic + saisie → calque texte
  await pg.keyboard.press('t'); await pg.waitForTimeout(150)
  await pg.mouse.click(cx - 150, cy - 60); await pg.waitForTimeout(300)
  await pg.keyboard.type('SIERRA'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400)
  const t1 = await pg.evaluate(() => document.body.innerText)
  console.log('TXT_LAYER T — SIERRA:', t1.includes('SIERRA'))
  await pg.screenshot({ path: 'shots/text-01.png' })

  // 2. double-clic sur le texte → ré-édition pré-remplie (vise le corps des glyphes)
  await pg.mouse.dblclick(cx - 140, cy - 66); await pg.waitForTimeout(300)
  const val = await pg.evaluate(() => {
    const els = [...document.querySelectorAll('input')].filter((i) => i.offsetParent)
    return els.find((i) => i.placeholder === 'Texte…')?.value
  })
  console.log('TXT_EDIT champ pré-rempli:', JSON.stringify(val))
  await pg.locator('input[placeholder="Texte…"]').fill('SIERRA NEVADA')
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400)
  const t2 = await pg.evaluate(() => document.body.innerText)
  console.log('TXT_EDIT nouveau contenu:', t2.includes('SIERRA NEVADA'))
  await pg.screenshot({ path: 'shots/text-02-edit.png' })

  // 3. panneau Caractère visible quand le calque texte est actif
  const t3 = await pg.evaluate(() => document.body.innerText)
  console.log('TXT_PROPS Caractère+Paragraphe:', t3.toUpperCase().includes('CARACTÈRE') && t3.toUpperCase().includes('PARAGRAPHE') && t3.includes('Interligne'))

  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
