const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5431/')
  await pg.waitForTimeout(1200)
  const res = await pg.evaluate(async () => {
    const out = []
    const t = (name, fn) => { try { out.push([name, fn() ? 'OK' : 'FAIL']) } catch (e) { out.push([name, 'ERR ' + e.message]) } }
    const E = await import('/src/pages/studio/engine.js')
    const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x); return c }

    // colorRange sur un doc propre
    {
      const ed = new E.Editor()
      ed.open(mk(400, 300, (x) => { x.fillStyle = '#ff0000'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#0000ff'; x.fillRect(150, 100, 60, 60) }), 't')
      t('colorRange', () => { ed.colorRangeSelect([255, 0, 0], 40); return !!(ed.sel && ed.selPoly && ed.selPoly.length >= 3) })
      t('colorRange undo', () => { ed.deselect(); return true })
    }

    const ed = new E.Editor()
    ed.open(mk(400, 300, (x) => { x.fillStyle = '#ff0000'; x.fillRect(0, 0, 400, 300) }), 'test')
    const l2 = ed.addLayer('haut')
    l2.ctx.fillStyle = '#0000ff'; l2.ctx.fillRect(0, 0, 100, 100)
    t('mergeDown', () => { const n0 = ed.layers.length; ed.mergeDown(); return ed.layers.length === n0 - 1 })
    t('resizeCanvas grow', () => { const r = ed.resizeCanvas(500, 300, 0, 0.5); return ed.w === 500 && r.ox === 0 })
    t('stroke inside', () => {
      ed.selectAll()
      const l = ed.addLayer('t')
      ed.strokeSel('#000000', 10, 'inside')
      const a = l.ctx.getImageData(5, 5, 1, 1).data[3], b = l.ctx.getImageData(250, 150, 1, 1).data[3]
      return a === 255 && b === 0
    })
    t('fill opacity', () => {
      ed.deselect()
      const l = ed.addLayer('f')
      ed.fill('#ffffff', 0, { opacity: 0.5 })
      return Math.abs(l.ctx.getImageData(10, 10, 1, 1).data[3] - 128) < 4
    })
    return out
  })
  for (const [n, r] of res) console.log(r.padEnd(5), n)
  console.log('ERRORS:', errs)
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
