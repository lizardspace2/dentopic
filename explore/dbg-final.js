const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  pg.on('pageerror', (e) => errs.push(e.message))
  const log = (k, v) => console.log(k + ':', v)
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)

  // étoile pointillée contour extérieur — rendu sans erreur
  const star = await pg.evaluate(() => {
    const e = window.__editor
    const l = e.addShapeLayer('star', { x: 50, y: 50, w: 300, h: 300 },
      { fill: null, stroke: '#ffdd00', strokeW: 6, dash: 'dot', strokeAlign: 'outside', points: 5 })
    const a = l.ctx.getImageData(50, 50, 300, 300).data
    let painted = 0
    for (let i = 3; i < a.length; i += 4) if (a[i] > 0) painted++
    return { painted, kind: l.shape.kind }
  })
  log('STAR', JSON.stringify(star))

  // alignement inside vs outside : outside doit peindre au-delà de la zone de base
  const align = await pg.evaluate(() => {
    const e = window.__editor
    const l = e.layers.at(-1)
    e.updateShape(l, { dash: 'solid', strokeAlign: 'inside' })
    const inPx = (() => { let n = 0; const a = l.ctx.getImageData(49, 49, 1, 1).data; return a[3] })() // juste hors bord gauche
    e.updateShape(l, { strokeAlign: 'outside' })
    const a2 = l.ctx.getImageData(48, 200, 2, 1).data
    return { insideAt49: inPx, outsideAt48: a2[3] > 0 || a2[7] > 0 }
  })
  log('ALIGN', JSON.stringify(align))

  // dropdown opaque en mode clair : ouvrir un menu et mesurer le fond
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'light') })
  await pg.reload(); await pg.waitForTimeout(3000)
  await pg.getByText('Fichier', { exact: true }).click(); await pg.waitForTimeout(400)
  const menuBg = await pg.evaluate(() => {
    // cherche la boîte du dropdown ouvert
    const els = [...document.querySelectorAll('div')]
    const item = [...document.querySelectorAll('*')].find((e) => e.textContent === 'Ouvrir une photo…')
    let p = item
    while (p && getComputedStyle(p).backgroundColor === 'rgba(0, 0, 0, 0)') p = p.parentElement
    return p ? getComputedStyle(p).backgroundColor : 'n/a'
  })
  log('MENU_BG_LIGHT', menuBg)
  await pg.keyboard.press('Escape')

  // mode sombre
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'dark') })
  await pg.reload(); await pg.waitForTimeout(2500)
  const darkBg = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--s-bg').trim())
  log('DARK', darkBg)
  log('ERRS', JSON.stringify(errs.slice(0, 6)))
  await b.close()
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1) })
