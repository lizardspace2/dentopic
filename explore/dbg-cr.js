const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage()
  pg.on('pageerror', (e) => console.log('PGERR', e.message))
  await pg.goto('http://localhost:5431/')
  await pg.waitForTimeout(1200)
  const res = await pg.evaluate(async () => {
    const E = await import('/src/pages/studio/engine.js')
    const ed = new E.Editor()
    const c = document.createElement('canvas'); c.width = 400; c.height = 300
    const x = c.getContext('2d')
    x.fillStyle = '#ff0000'; x.fillRect(0, 0, 400, 300)
    x.fillStyle = '#0000ff'; x.fillRect(150, 100, 60, 60)
    ed.open(c, 't')
    const comp = ed.compositeFiltered()
    const mask = E.colorMask(comp, [255, 0, 0], 40)
    const n = mask.reduce((a, v) => a + v, 0)
    const r = ed.colorRangeSelect([255, 0, 0], 40)
    return { pixels: n, total: mask.length, ok: r, sel: ed.sel, poly: ed.selPoly && ed.selPoly.length }
  })
  console.log(JSON.stringify(res))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
