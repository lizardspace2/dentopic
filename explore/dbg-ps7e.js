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
  await pg.evaluate(() => {
    const ed = window.__editor, l = ed.active
    l.fx = { glow: { on: true, _listed: true, blend: 'screen', color: '#4f8fe8', opacity: 80, spread: 0, size: 18, range: 60 } }
    ed.markDirty()
  })
  await pg.waitForTimeout(300)
  // œil : clic à la position gauche de la ligne « Lueur externe »
  const lbl = await pg.locator('text=Lueur externe').boundingBox()
  console.log('label box:', JSON.stringify(lbl))
  if (lbl) {
    await pg.mouse.click(lbl.x - 14, lbl.y + lbl.height / 2); await pg.waitForTimeout(300)
  }
  console.log('glow après œil:', await pg.evaluate(() => {
    const g = window.__editor.active.fx.glow
    return JSON.stringify({ on: g.on, listed: g._listed })
  }))
  // Sélection auto
  await pg.keyboard.press('v'); await pg.waitForTimeout(200)
  const sa = await pg.locator('text=Sélection auto').boundingBox()
  console.log('sa box:', JSON.stringify(sa))
  await pg.mouse.click(sa.x - 8, sa.y + sa.height / 2); await pg.waitForTimeout(200)
  await pg.evaluate(() => { window.__editor.setActive(window.__editor.layers[0].id) })
  const scr = await pg.evaluate(() => {
    const ed = window.__editor
    const main = [...document.querySelectorAll('canvas')].find((c) => c.width > 500 && c.height > 300)
    const r = main.getBoundingClientRect()
    return { left: r.left, top: r.top, scale: r.width / ed.w }
  })
  const tp = await pg.evaluate(() => {
    const l = window.__editor.layers.find((x) => x.type === 'text')
    return { dx: l.dx, dy: l.dy, w: l.text.box.w }
  })
  await pg.mouse.click(scr.left + (tp.dx + tp.w / 2) * scr.scale, scr.top + (tp.dy + 20) * scr.scale)
  await pg.waitForTimeout(300)
  console.log('sélection auto →', await pg.evaluate(() => window.__editor.active?.type))
  await b.close()
  console.log('ERRS:', JSON.stringify(errs.slice(0, 5)))
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
