// Tests headless des nouvelles méthodes moteur (nouveau lot Photoshop)
const { chromium } = require('playwright-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const main = async () => {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('http://localhost:5431', { waitUntil: 'domcontentloaded' })

  const res = await page.evaluate(async () => {
    const { Editor } = await import('/src/pages/studio/engine.js')
    const mk = (w, h, fill) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      if (fill) { c.getContext('2d').fillStyle = fill; c.getContext('2d').fillRect(0, 0, w, h) }
      return c
    }
    const out = {}
    const e = new Editor()
    e.open(mk(200, 150, '#888888'), 't')
    const l = e.layers[0]; l.locked = false

    // -- transformSel : translation pure garde le rect -------------------------
    e.sel = [10, 10, 50, 40]; e.selPoly = null
    e.transformSel({ dx: 5, dy: 7 })
    out.tselTranslate = e.sel && e.sel[0] === 15 && e.sel[1] === 17 && e.sel[2] === 50
    // rotation → poly
    e.transformSel({ angle: Math.PI / 6 })
    out.tselRotate = Array.isArray(e.selPoly) && e.selPoly.length === 4
    // échelle sur poly
    const cx = e.selPoly.reduce((a, p) => a + p[0], 0) / e.selPoly.length
    e.transformSel({ sx: 2, sy: 2 })
    const bb = e.sel // cadre englobant recalculé
    out.tselScale = bb && bb[2] > 80 // 50 px × 2 ≈ 100

    // -- growSel : zone contiguë autour de la sélection -------------------------
    const e2 = new Editor()
    const c2 = mk(120, 120, '#334455')
    const x2 = c2.getContext('2d')
    x2.fillStyle = '#ee2222'; x2.fillRect(30, 30, 40, 40) // carré rouge au centre
    e2.open(c2, 't2'); e2.layers[0].locked = false
    e2.sel = [40, 40, 20, 20]; e2.selPoly = null
    const ok = e2.growSel(40, false)
    const bb2 = e2.sel
    out.grow = ok && bb2 && bb2[0] < 40 && bb2[2] > 20 // le lasso englobe plus que la sélection

    // -- saveSel / loadSel -------------------------------------------------------
    e2.sel = [5, 5, 30, 30]; e2.selPoly = null
    e2.saveSel('zone A')
    out.saveSel = e2.savedSels.length === 1 && e2.savedSels[0].name === 'zone A'
    e2.deselect()
    out.loadSel = e2.loadSel(e2.savedSels[0].id) && !!e2.sel

    // -- masque rapide ------------------------------------------------------------
    e2.enterQuickMask()
    out.qmEntered = !!e2.qm && !e2.sel
    e2.qmPaint(80, 80, 95, 95, 20, false) // masque (retire la sélection)
    e2.qmPaint(10, 10, 10, 10, 16, true) // révèle (ajoute)
    const hasSel = e2.exitQuickMask()
    out.qmExit = hasSel === true || e2.sel === null // contour trouvé ou sélection vide
    out.qmCleared = !e2.qm

    // -- revealAll -----------------------------------------------------------------
    const e3 = new Editor()
    e3.open(mk(100, 80, '#123456'), 't3'); e3.layers[0].locked = false
    const l2 = e3.addLayer('hors-cadre')
    l2.ctx.fillStyle = '#ff0000'; l2.ctx.fillRect(0, 0, 20, 20)
    l2.dx = 120; l2.dy = 40 // calque partiellement hors du canevas 100x80
    const rv = e3.revealAll()
    out.reveal = rv && e3.w >= 140 && e3.h >= 80

    // -- rasterizeLayer -------------------------------------------------------------
    e3.addTextLayer('21', { size: 40, color: '#ffffff' }, 10, 10)
    const tl = e3.layers[e3.layers.length - 1]
    out.rasterize = e3.rasterizeLayer(tl.id) && tl.type === 'pixel' && !tl.text
    out.rasterizeGuard = e3.rasterizeLayer(e3.layers[0].id) === false

    // -- clip + locked dans le dump (undo) ------------------------------------------
    e3.layers[0].clip = true
    const dump = e3._dump()
    out.dumpClip = dump.layers[0].clip === true

    return out
  })

  console.log(JSON.stringify(res, null, 1))
  if (errors.length) console.log('ERRORS:', errors.slice(0, 5))
  await browser.close()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
