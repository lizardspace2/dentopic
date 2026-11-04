// Test headless : editor.warpField (Fluidité) — déplacement, identité, masque, undo.
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto('http://localhost:5431/')
  const r = await p.evaluate(async () => {
    const { Editor } = await import('/src/pages/studio/engine.js')
    const e = new Editor()
    const mk = (w = 100, h = 80) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    e.open(mk(), 'liq')
    const out = {}
    const px = (cv, x, y) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data]

    // Calque : carré rouge centré 40..60 × 30..50
    const l = e.active
    l.ctx.fillStyle = '#ff0000'
    l.ctx.fillRect(40, 30, 20, 20)
    l.ctx.clearRect(0, 0, 10, 80) // repère hors zone

    // Champ : déplace tout de +15px en x (translation uniforme)
    const cell = 8, gw = Math.ceil(100 / cell) + 1, gh = Math.ceil(80 / cell) + 1
    const field = { data: new Float32Array(gw * gh * 2), gw, gh, cell }
    for (let i = 0; i < gw * gh; i++) field.data[i * 2] = 15
    e.warpField(l, field, 2)
    out.moved = px(l.cv, 60, 40)[0] > 200 && px(l.cv, 45, 40)[3] < 10
    out.edgeIntact = px(l.cv, 5, 40)[3] < 10

    // Champ nul = identité (pas de dégradation)
    e.snapshot()
    const zero = { data: new Float32Array(gw * gh * 2), gw, gh, cell }
    const before = px(l.cv, 60, 40)
    e.warpField(l, zero, 2)
    const after = px(l.cv, 60, 40)
    out.identity = Math.abs(before[0] - after[0]) < 20 && after[0] > 200

    // Déformation locale : sommet central tiré vers le bas
    const l2 = e.addLayer('local')
    l2.ctx.fillStyle = '#0000ff'
    l2.ctx.fillRect(30, 20, 40, 30)
    const f2 = { data: new Float32Array(gw * gh * 2), gw, gh, cell }
    const ci = Math.round(50 / cell), cj = Math.round(35 / cell)
    f2.data[(cj * gw + ci) * 2 + 1] = 25 // sommet (50,35) → +25px y
    e.warpField(l2, f2, 2)
    let found = false
    for (let x = 42; x <= 52 && !found; x++)
      for (let y = 51; y < 80 && !found; y++) { const c = px(l2.cv, x, y); if (c[2] > 150 && c[3] > 150) found = true }
    out.localDeform = found
    const above = px(l2.cv, 50, 10)
    out.unaffectedFar = above[3] < 60

    // Masque déformé avec le calque
    e.addMask(l2, false)
    const mBefore = px(l2.mask, 50, 35)
    e.warpField(l2, f2, 2)
    out.maskWarped = px(l2.mask, 50, 60)[3] > 150 || px(l2.mask, 50, 58)[3] > 150

    // Texte → pixellisé par warpField
    const t = e.addTextLayer('LIQ', 10, 10, {})
    out.textRasterized = e.warpField(t, zero, 2) === undefined && t.type === 'pixel' && !t.text

    // Undo restaure
    e.snapshot('liq')
    await e.undo()
    out.undoOk = !!e.layers.find((x) => x.id === l2.id)
    return out
  })
  console.log(JSON.stringify(r, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(r).filter(([, v]) => !v).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
