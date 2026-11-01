const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(1200)
  await pg.locator('img').first().click(); await pg.waitForTimeout(2000)

  const cv = await pg.locator('canvas').nth(1).boundingBox() // canvas principal (1er = ?)
  const box = await pg.locator('canvas').last().boundingBox()
  const BB = box || cv
  const cx = BB.x + BB.width / 2, cy = BB.y + BB.height / 2
  const px = (x, y) => pg.evaluate(async ({ x, y }) => {
    const ed = window.__editor; ed.render()
    await new Promise((r) => setTimeout(r, 30))
    const c = ed.compositeFiltered()
    return Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data)
  }, { x, y })

  // 1. outil Texte : cliquer, taper, valider → calque « T »
  await pg.click('[title*="Texte"], [data-tip*="Texte"]').catch(() => {})
  await pg.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' })) })
  await pg.waitForTimeout(200)
  await pg.mouse.click(cx - 200, cy)
  await pg.waitForTimeout(300)
  const ti = pg.locator('input[type="text"], input:not([type])').last()
  await ti.fill('EARTHRISE')
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500)
  const tl = await pg.evaluate(() => {
    const l = window.__editor.active
    return { type: l?.type, name: l?.name, text: l?.text?.value }
  })
  console.log('text layer:', JSON.stringify(tl), tl.type === 'text' ? 'OK' : 'KO')

  // 2. panneau Propriétés : Caractère + Paragraphe visibles
  const props = await pg.locator('text=Caractère').count() + await pg.locator('text=Paragraphe').count()
  console.log('Caractère+Paragraphe:', props, props === 2 ? 'OK' : 'KO')

  // 3. changer la taille via Propriétés → re-rendu mesurable
  const before = tl.type === 'text' ? await pg.evaluate(() => {
    const l = window.__editor.active; const d = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  }) : 0
  const sizeInput = await pg.locator('text=Taille').locator('..').locator('input').first()
  await sizeInput.fill('120')
  await pg.waitForTimeout(400)
  const after = await pg.evaluate(() => {
    const l = window.__editor.active; const d = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  })
  console.log(`texte taille 32→120 : alpha ${before} → ${after}`, after > before * 2 ? 'OK' : 'KO')

  // 4. ouvrir Style de calque via le bouton fx, activer Lueur externe + Contour
  await pg.locator('text=fx').first().click().catch(() => {})
  await pg.waitForTimeout(400)
  const modal = await pg.locator('text=Style de calque').count()
  console.log('modal style:', modal ? 'OK' : 'KO')
  await pg.locator('[data-fxcheck="glow"]').click()
  await pg.locator('[data-fxrow="stroke"]').click()
  await pg.locator('[data-fxcheck="stroke"]').click()
  await pg.getByText('OK', { exact: true }).click(); await pg.waitForTimeout(400)
  const fxstate = await pg.evaluate(() => {
    const f = window.__editor.active.fx || {}
    return { glow: !!f.glow?.on, stroke: !!f.stroke?.on, blend: f.glow?.blend }
  })
  console.log('fx:', JSON.stringify(fxstate), fxstate.glow && fxstate.stroke ? 'OK' : 'KO')

  // 5. sous-liste « Effets » + yeux
  const effRow = await pg.locator('text=Effets').count()
  const glowRow = await pg.locator('text=Lueur externe').count()
  console.log(`sous-liste Effets (${effRow}) + Lueur externe (${glowRow})`, effRow && glowRow ? 'OK' : 'KO')

  // 6. œil de la lueur → composite perd du rouge bleu (glow bleu sur texte rouge)
  await pg.screenshot({ path: 'shots/ps7-fx.png' })
  await b.close()
  console.log('ERRS:', JSON.stringify(errs.slice(0, 5)))
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
