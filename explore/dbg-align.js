const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage()
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)
  const r = await pg.evaluate(() => {
    const e = window.__editor
    const alpha = (l, x, y) => l.ctx.getImageData(x, y, 1, 1).data[3]
    const l = e.addShapeLayer('rect', { x: 100, y: 100, w: 100, h: 100 },
      { fill: null, stroke: '#000000', strokeW: 10, strokeAlign: 'outside' })
    const outside = alpha(l, 96, 150) // 4px hors du bord gauche → peint si outside ok
    const inEdge = alpha(l, 104, 150) // dedans : outside ne doit pas déborder dedans
    e.updateShape(l, { strokeAlign: 'inside' })
    const inside = alpha(l, 104, 150) // dedans, 4px du bord → peint
    const insideOut = alpha(l, 96, 150) // dehors → vide
    e.updateShape(l, { strokeAlign: 'center' })
    const centerOut = alpha(l, 96, 150), centerIn = alpha(l, 104, 150)
    return { outside, inEdge, inside, insideOut, centerOut, centerIn }
  })
  console.log('ALIGN:', JSON.stringify(r))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
