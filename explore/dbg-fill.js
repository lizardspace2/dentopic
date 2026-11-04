// Test headless : calques de remplissage + nearestVita.
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto('http://localhost:5431/')
  const r = await p.evaluate(async () => {
    const { Editor, hexToRgb, deltaE } = await import('/src/pages/studio/engine.js')
    const { nearestVita } = await import('/src/pages/studio/constants.js')
    const e = new Editor()
    const mk = (w = 64, h = 64) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    e.open(mk(), 'test')
    const out = {}
    const px = (cv, x, y) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data]

    // --- calque de remplissage uni
    const s = e.addFillLayer({ kind: 'solid', color: '#ff0000' })
    out.solidType = s.type === 'fill' && !!s.fillDef
    out.solidPx = px(s.cv, 30, 30)[0] > 200
    out.active = e.active === s

    // --- réédition : changer la couleur → redrawFillLayer
    s.fillDef.color = '#0000ff'
    e.drawFillLayer(s)
    out.recolor = px(s.cv, 30, 30)[2] > 200 && px(s.cv, 30, 30)[0] < 30

    // --- dégradé linéaire : haut ≈ blanc, bas ≈ noir (angle 90)
    const g = e.addFillLayer({ kind: 'gradient', from: '#ffffff', to: '#000000', angle: 90, style: 'linear' })
    const top = px(g.cv, 32, 4), bot = px(g.cv, 32, 60)
    out.gradient = top[0] > 200 && bot[0] < 60

    // --- composite voit le remplissage (dégradé : clair en haut, sombre en bas)
    const comp = e.composite()
    out.composite = px(comp, 32, 4)[0] > 200 && px(comp, 32, 60)[0] < 60

    // --- dump/restore conserve fillDef
    e.snapshot()
    await e.undo() // revient avant le snapshot — hmm snapshot just push, undo restaure l'état du snapshot
    const gAfter = e._find(g.id)?.l
    out.dumpRestores = gAfter?.type === 'fill' && gAfter.fillDef?.kind === 'gradient'

    // --- pixelliser un remplissage
    e.rasterizeLayer(g.id)
    const gPix = e._find(g.id)?.l
    out.rasterize = gPix?.type === 'pixel' && !gPix.fillDef

    // --- nearestVita : échantillon proche de A2 → 'A2' (ou voisin acceptable)
    const a2 = hexToRgb('#e8d5ac')
    const v1 = nearestVita(...a2)
    out.vitaExact = v1.code === 'A2' && v1.de < 1
    // échantillon dentaire réaliste beige → correspondance raisonnable
    const v2 = nearestVita(215, 195, 160)
    out.vitaRealistic = v2.de < 25
    out.vitaSample = `${v2.code} (ΔE ${v2.de.toFixed(1)})`
    // deltaE : même couleur = 0, noir/blanc = ~100
    out.deltaE = deltaE([255, 0, 0], [255, 0, 0]) === 0 && deltaE([0, 0, 0], [255, 255, 255]) > 90
    return out
  })
  console.log(JSON.stringify(r, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(r).filter(([, v]) => !v).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
