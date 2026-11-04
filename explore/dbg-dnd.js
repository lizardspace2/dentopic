// Test headless du drag & drop de calques — moveInto / moveToRoot / canMove.
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
    const mk = (w = 32, h = 32) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    e.open(mk(), 'test')
    const out = {}
    const a = e.addLayer('A')
    const bLayer = e.addLayer('B')
    const g = e.addGroup() // 'Groupe 1'
    const top = e.addLayer('Top')
    // pile : [Arrière-plan, A, B, G1[], Top, Calque 1]
    const names = () => e.layers.map((l) => l.name).join(',')

    // --- réordonnancement même niveau : Top 'after' A
    out.reorder = e.moveInto(top.id, a.id, 'after')
      && names() === 'Arrière-plan,A,Top,B,Groupe 1,Calque 1'

    // --- déposer dans un groupe : Top 'inside' G1
    out.intoGroup = e.moveInto(top.id, g.id, 'inside')
      && g.children.some((c) => c.id === top.id)
      && !e.layers.some((l) => l.id === top.id)
      && e.layers.length === 5

    // --- 'inside' sur un non-groupe refusé
    out.insideDenied = !e.moveInto(a.id, bLayer.id, 'inside')

    // --- groupe dans son propre descendant refusé
    const g2 = e.addGroup() // 'Groupe 2'
    out.nestGroup = e.moveInto(g2.id, g.id, 'inside')
    out.selfNestDenied = !e.moveInto(g.id, g2.id, 'inside')
      && !e.canMove(g.id, g2.id, 'inside')

    // --- sortir du groupe : Top 'before' A (au niveau racine)
    out.outOfGroup = e.moveInto(top.id, a.id, 'before')
      && e.layers[1].id === top.id
      && !g.children.some((c) => c.id === top.id)

    // --- moveToRoot : G2 (enfant de G1) → bas de la pile racine
    out.toRoot = e.moveToRoot(g2.id, false)
      && e.layers[0].id === g2.id
      && !g.children.some((c) => c.id === g2.id)

    // --- verrou : déplacer un calque verrouillé refusé
    a.locked = true
    out.lockedDenied = !e.moveInto(a.id, bLayer.id, 'after') && !e.canMove(a.id, bLayer.id, 'after')
    a.locked = false

    // --- undo restaure la structure
    e.snapshot()
    e.moveInto(top.id, g.id, 'inside')
    await e.undo()
    const gAfter = e._find(g.id)?.l // les objets sont recréés par _restore
    out.undoRestores = e.layers.some((l) => l.id === top.id)
      && !!gAfter && !(gAfter.children || []).some((c) => c.id === top.id)

    // --- composite toujours valide après les déplacements
    const comp = e.composite()
    out.compositeOk = comp.width === 32 && comp.height === 32
    return out
  })
  console.log(JSON.stringify(r, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(r).filter(([, v]) => !v).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
