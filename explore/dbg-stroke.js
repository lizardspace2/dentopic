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
    c.getContext('2d').fillStyle = '#ff0000'; c.getContext('2d').fillRect(0, 0, 400, 300)
    ed.open(c, 't')
    const out = {}
    const l = ed.addLayer('t')
    ed.selectAll()
    ed.strokeSel('#000000', 10, 'inside')
    const px = (x, y) => l.ctx.getImageData(x, y, 1, 1).data[3]
    out.inside = { edge: px(5, 5), mid: px(200, 150), at11: px(12, 150) }
    l.ctx.clearRect(0, 0, 400, 300)
    ed.strokeSel('#000000', 10, 'center')
    out.center = { edgeIn: px(3, 150), edgeOut: px(8, 150), mid: px(200, 150) }
    l.ctx.clearRect(0, 0, 400, 300)
    ed.strokeSel('#000000', 10, 'outside')
    out.outside = { at0: px(0, 150), in5: px(15, 150) } // dehors = rien (clip au bord)
    return out
  })
  console.log(JSON.stringify(res))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
