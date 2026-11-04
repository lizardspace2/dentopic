// Test headless du moteur Studio via le serveur Vite (sans login).
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto('http://localhost:5431/')
  await pg.waitForTimeout(1500)
  const res = await pg.evaluate(async () => {
    const out = []
    const t = (name, fn) => { try { out.push([name, fn() ? 'OK' : 'FAIL']) } catch (e) { out.push([name, 'ERR ' + e.message]) } }
    const E = await import('/src/pages/studio/engine.js')
    const ed = new E.Editor()
    // document 400×300 : fond rouge + calque
    const c = document.createElement('canvas'); c.width = 400; c.height = 300
    c.getContext('2d').fillStyle = '#ff0000'; c.getContext('2d').fillRect(0, 0, 400, 300)
    ed.open(c, 'test')
    t('open', () => ed.w === 400 && ed.h === 300 && ed.layers.length === 2)

    // mergeDown : pose un calque bleu opaque par-dessus
    const l2 = ed.addLayer('haut')
    l2.ctx.fillStyle = '#0000ff'; l2.ctx.fillRect(0, 0, 100, 100)
    t('mergeDown', () => {
      const n0 = ed.layers.length
      ed.mergeDown()
      return ed.layers.length === n0 - 1 && ed.layers[ed.layers.length - 1] === ed.active
    })

    // resizeCanvas : +100 px à droite (ancre gauche)
    t('resizeCanvas grow-right', () => {
      const r = ed.resizeCanvas(500, 300, 0, 0.5)
      return ed.w === 500 && r.ox === 0
    })
    t('resizeCanvas grow-left', () => {
      const l = ed.active
      l.ctx.fillStyle = '#00ff00'; l.ctx.fillRect(400, 0, 100, 300) // zone ajoutée
      const r = ed.resizeCanvas(600, 300, 1, 0.5)
      // le contenu doit être décalé de +100 dans le calque
      const px = l.ctx.getImageData(500, 150, 1, 1).data
      return ed.w === 600 && r.ox === 100 && px[1] > 200 // vert déplacé à x=500
    })

    // selection + fill + stroke
    t('stroke inside', () => {
      ed.selectAll()
      const l = ed.addLayer('t')
      ed.strokeSel('#000000', 10, 'inside')
      const p = l.ctx.getImageData(5, 5, 1, 1).data // dans l'anneau
      const p2 = l.ctx.getImageData(300, 150, 1, 1).data // centre vide
      return p[3] === 255 && p2[3] === 0
    })
    t('fill opacity', () => {
      ed.deselect()
      const l = ed.addLayer('f')
      ed.fill('#ffffff', 0, { opacity: 0.5 })
      const p = l.ctx.getImageData(10, 10, 1, 1).data
      return Math.abs(p[3] - 128) < 4
    })

    // color range : doc rouge + carré bleu
    t('colorRange', () => {
      const l = ed.addLayer('cr')
      l.ctx.fillStyle = '#0000ff'; l.ctx.fillRect(200, 100, 60, 60)
      ed.sel = null; ed.selPoly = null
      ed.colorRangeSelect([255, 0, 0], 40) // le fond rouge = + grande composante
      const bb = ed.sel
      if (!bb || bb[0] > 20 || bb[1] > 20) return false
      // le carré bleu ne doit PAS être dans la sélection (composante rouge seule)
      return ed.selPoly && ed.selPoly.length >= 3
    })
    return out
  })
  for (const [n, r] of res) console.log(r.padEnd(5), n)
  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon') && !e.includes('supabase')))
  await b.close()
})().catch((e) => console.log('FAIL', e.message))
