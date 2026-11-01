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
    const row = (l, y) => { const a = l.ctx.getImageData(85, y, 40, 1).data; let s = ''; for (let i = 3; i < a.length; i += 4) s += a[i] > 128 ? '#' : '.'; return s }
    const l = e.addShapeLayer('rect', { x: 100, y: 100, w: 100, h: 100 },
      { fill: null, stroke: '#000000', strokeW: 10, strokeAlign: 'outside' })
    const out = { outside: row(l, 150) }
    e.updateShape(l, { strokeAlign: 'inside' }); out.inside = row(l, 150)
    e.updateShape(l, { strokeAlign: 'center' }); out.center = row(l, 150)
    return out // x=85..124, bord à x=100 (pos 15)
  })
  console.log('x=85..124, edge=pos15')
  for (const k in r) console.log(k.padEnd(8), r[k])
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
