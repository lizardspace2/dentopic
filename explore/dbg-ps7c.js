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
  await pg.keyboard.press('t'); await pg.waitForTimeout(300)
  const box = await pg.locator('canvas').first().boundingBox()
  await pg.mouse.click(box.x + 300, box.y + 300)
  await pg.waitForTimeout(400)
  await pg.locator('input[placeholder="Texte…"]').fill('EARTHRISE')
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(600)

  // 1. Propriétés → Caractère / Paragraphe / Contenu
  console.log('Caractère:', await pg.locator('text=Caractère').count(),
    'Paragraphe:', await pg.locator('text=Paragraphe').count(),
    'Contenu:', await pg.locator('text=Contenu').count())

  // 2. changer la couleur du texte via Propriétés → pixels changent
  const alpha = () => pg.evaluate(() => {
    const l = window.__editor.active
    const d = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  })
  const a0 = await alpha()
  // taille 32 → 120 via le champ Taille du panneau Caractère
  const sizeIn = pg.locator('input[type="number"][min="1"][max="400"]').first()
  await sizeIn.fill('120'); await pg.waitForTimeout(400)
  const a1 = await alpha()
  console.log(`texte taille →120 : alpha ${a0} → ${a1}`, a1 > a0 * 1.5 ? 'OK' : 'KO')

  // 3. Style de calque : activer lueur externe + contour via le modal
  await pg.locator('text=Effets, fusion, opacité, remplissage').count() // noop
  // bouton fx en bas du panneau calques
  await pg.locator('div').filter({ hasText: /^fx$/ }).last().click().catch(async () => {
    await pg.getByText('fx', { exact: true }).last().click()
  })
  await pg.waitForTimeout(400)
  console.log('modal style:', await pg.locator('text=Style de calque').count() ? 'OK' : 'KO')
  await pg.locator('[data-fxcheck="glow"]').click()
  await pg.locator('[data-fxcheck="stroke"]').click()
  await pg.getByText('OK', { exact: true }).click(); await pg.waitForTimeout(500)
  const fx = await pg.evaluate(() => {
    const f = window.__editor.active.fx || {}
    return { glow: f.glow?.on, stroke: f.stroke?.on, listed: Object.keys(f).filter((k) => f[k]?._listed || f[k]?.on) }
  })
  console.log('fx:', JSON.stringify(fx))
  console.log('Effets row:', await pg.locator('text=Effets').count(),
    'Lueur externe row:', await pg.locator('text=Lueur externe').count(),
    'Contour row:', await pg.locator('text=Contour').count())

  // 4. œil sur « Contour » → off (reste listé)
  const contourEye = pg.locator('text=Contour').locator('..').locator('svg, [class*="icon"], div').first()
  await pg.locator('text=Contour').first().hover()
  // cliquer l'œil : la ligne entière -> l'icône œil est le 1er élément cliquable de la ligne
  const row = pg.locator('div').filter({ has: pg.locator('text=Contour') }).last()
  await pg.screenshot({ path: 'shots/ps7-fx.png' })

  // 5. Sélection auto : outil move + autoSelect → cliquer le texte sélectionne le calque T
  await pg.keyboard.press('v'); await pg.waitForTimeout(200)
  await pg.evaluate(() => { /* cocher via UI plus bas */ })
  // cocher la case « Sélection auto »
  await pg.locator('text=Sélection auto').locator('..').click()
  await pg.waitForTimeout(200)
  await pg.evaluate(() => { window.__editor.setActive(window.__editor.layers[0].id) }) // actif = arrière-plan
  // cliquer sur le texte (dx≈300 doc) — retrouver sa position écran
  const pos = await pg.evaluate(() => {
    const ed = window.__editor, l = ed.layers.find((x) => x.type === 'text')
    return { dx: l.dx, dy: l.dy, w: l.text.box.w, h: l.text.box.h }
  })
  console.log('texte box:', JSON.stringify(pos))
  await b.close()
  console.log('ERRS:', JSON.stringify(errs.slice(0, 5)))
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
