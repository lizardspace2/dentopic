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

  // œil de la lueur : activer fx d'abord via API (glow+stroke)
  await pg.evaluate(() => {
    const ed = window.__editor, l = ed.active
    l.fx = { glow: { on: true, _listed: true, blend: 'screen', color: '#4f8fe8', opacity: 80, spread: 0, size: 18, range: 60 } }
    ed.markDirty()
  })
  await pg.waitForTimeout(300)
  const glowOn = await pg.evaluate(() => window.__editor.active.fx.glow.on)
  // cliquer l'œil à gauche de « Lueur externe »
  const eyeRow = pg.locator('text=Lueur externe').locator('xpath=..').locator('svg').first()
  await eyeRow.click(); await pg.waitForTimeout(300)
  const glowOff = await pg.evaluate(() => ({ on: window.__editor.active.fx.glow.on, listed: window.__editor.active.fx.glow._listed }))
  console.log(`œil lueur : on=${glowOn} → on=${glowOff.on} (listed=${glowOff.listed})`, !glowOff.on && glowOff.listed ? 'OK' : 'KO')
  const stillListed = await pg.locator('text=Lueur externe').count()
  console.log('lueur toujours listée après œil off:', stillListed ? 'OK' : 'KO')

  // Sélection auto : cocher, activer arrière-plan, cliquer sur le texte
  await pg.keyboard.press('v'); await pg.waitForTimeout(200)
  await pg.locator('text=Sélection auto').locator('xpath=..').click(); await pg.waitForTimeout(200)
  const ck = await pg.evaluate(() => document.querySelectorAll('input,select').length)
  const textPos = await pg.evaluate(() => {
    const ed = window.__editor, l = ed.layers.find((x) => x.type === 'text')
    return { dx: l.dx, dy: l.dy, w: l.text.box.w }
  })
  await pg.evaluate(() => { window.__editor.setActive(window.__editor.layers[0].id) }) // active = arrière-plan
  // coordonnées doc → écran : via la vue exposée ? on calcule via le canvas bbox + scale 0.35
  const scr = await pg.evaluate(() => {
    const ed = window.__editor
    const cvs = document.querySelectorAll('canvas')
    const main = [...cvs].find((c) => c.width > 500 && c.height > 300)
    const r = main.getBoundingClientRect()
    return { left: r.left, top: r.top, w: r.width, scale: r.width / ed.w }
  })
  // position doc approx : texte dx,dy + milieu de la première ligne
  const px = scr.left + (textPos.dx + textPos.w / 2) * scr.scale
  const py = scr.top + (textPos.dy + 20) * scr.scale
  await pg.mouse.click(px, py); await pg.waitForTimeout(300)
  const actAfter = await pg.evaluate(() => window.__editor.active?.type)
  console.log('sélection auto → calque sous curseur :', actAfter, actAfter === 'text' ? 'OK' : 'KO')
  await b.close()
  console.log('ERRS:', JSON.stringify(errs.slice(0, 5)))
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
