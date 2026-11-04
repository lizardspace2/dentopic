// Test headless de warpQuad / applyWarp (distorsion + déformation).
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto('http://localhost:5431/')
  const r = await p.evaluate(async () => {
    const { Editor, warpQuad } = await import('/src/pages/studio/engine.js')
    const e = new Editor()
    const mk = (w = 64, h = 64) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    e.open(mk(), 'test')
    const out = {}
    const px = (cv, x, y) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data]
    const l = e.active
    // carré rouge plein 0..40 × 0..40 (zone 40-64 transparente)
    l.ctx.fillStyle = '#ff0000'; l.ctx.fillRect(0, 0, 40, 40)

    // --- warpQuad : quadrilatère identité → contenu inchangé
    const t1 = mk()
    warpQuad(t1.getContext('2d'), l.cv, 0, 0, 40, 40, [[0, 0], [40, 0], [40, 40], [0, 40]], 8)
    out.identitySame = px(t1, 20, 20)[0] > 200 && px(t1, 50, 50)[3] < 10

    // --- warpQuad : coin haut-droit tiré vers le centre → pixels convergent
    const t2 = mk()
    warpQuad(t2.getContext('2d'), l.cv, 0, 0, 40, 40, [[0, 0], [30, 10], [40, 40], [0, 40]], 8)
    out.perspective = px(t2, 30, 10)[0] > 200 && px(t2, 39, 1)[3] < 10

    // --- applyWarp distorsion : 1 cellule sur le calque
    e.snapshot()
    const quad = [[0, 0], [30, 10], [40, 40], [0, 40]]
    e.applyWarp(l, [{ sx: 0, sy: 0, sw: 40, sh: 40, quad }])
    out.warpApplied = px(l.cv, 30, 10)[0] > 200
    out.warpType = l.type // calque pixel inchangé

    // --- undo restaure (les objets calques sont recréés par _restore)
    await e.undo()
    const lAfter = e._find(l.id)?.l
    out.undoRestores = px(lAfter.cv, 39, 1)[0] > 200

    // --- applyWarp déformation : 4 cellules treillis, centre poussé
    const t3 = mk()
    const tctx = t3.getContext('2d')
    const src = mk(); src.getContext('2d').fillStyle = '#00ff00'; src.getContext('2d').fillRect(0, 0, 40, 40)
    // treillis identité sauf centre (index 4) déplacé de +10,+10
    const wp = []
    for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) wp.push([cc * 20, rr * 20])
    wp[4] = [30, 30]
    for (let rr = 0; rr < 2; rr++) for (let cc = 0; cc < 2; cc++) {
      warpQuad(tctx, src, cc * 20, rr * 20, 20, 20,
        [wp[rr * 3 + cc], wp[rr * 3 + cc + 1], wp[(rr + 1) * 3 + cc + 1], wp[(rr + 1) * 3 + cc]], 8)
    }
    // le centre du treillis est poussé → les pixels s'éloignent du centre d'origine
    out.warpMesh = px(t3, 30, 30)[1] > 200 && px(t3, 10, 10)[1] > 200

    // --- dégrade le texte en pixel
    const tl = e.addTextLayer('11')
    e.applyWarp(tl, [{ sx: 0, sy: 0, sw: 40, sh: 40, quad }])
    out.textDegraded = tl.type === 'pixel' && !tl.text
    return out
  })
  console.log(JSON.stringify(r, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(r).filter(([, v]) => v !== true && v !== 'pixel').map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
