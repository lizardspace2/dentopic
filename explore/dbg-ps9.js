// Test headless des groupes de calques — engine.js via le serveur Vite.
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
    const mk = (w = 64, h = 64) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    e.open(mk(), 'test')
    const out = {}
    const red = e.active // Arrière-plan
    red.ctx.fillStyle = '#ff0000'; red.ctx.fillRect(0, 0, 64, 64)
    const lay = (e.addLayer('A'), e.active)
    lay.ctx.fillStyle = '#00ff00'; lay.ctx.fillRect(0, 0, 20, 20)
    const lb = e.addLayer('B')
    lb.ctx.fillStyle = '#0000ff'; lb.ctx.fillRect(30, 30, 20, 20)

    // grouper A + B
    const g = e.groupLayers([lay.id, lb.id])
    out.groupOk = g?.type === 'group' && g.children.length === 2 && g.children[0].id === lay.id
    out.groupPos = e.layers[1].id === g.id // à la place du calque sélectionné le plus haut
    out.activeIsGroup = e.active === g

    // composite : rouge de base + vert + bleu visibles à travers le groupe
    const px = (cv, x, y) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data]
    let comp = e.composite()
    out.compositeGreen = px(comp, 5, 5)[1] > 200
    out.compositeBlue = px(comp, 35, 35)[2] > 200

    // groupe masqué → enfants invisibles
    g.visible = false
    comp = e.composite()
    out.hiddenGroup = px(comp, 5, 5)[0] > 200 && px(comp, 5, 5)[1] < 30
    g.visible = true

    // opacité du groupe
    g.opacity = 0.5
    comp = e.composite()
    const gp = px(comp, 5, 5)
    out.groupOpacity = gp[1] > 60 && gp[1] < 180 // vert atténué sur rouge
    g.opacity = 1

    // écrêtage à l'intérieur du groupe : B écrêté sur A (A ne couvre que 0-20)
    lb.clip = true
    comp = e.composite()
    // B écrêté : zone 30-50,30-50 ∩ A (0-20) = rien → le bleu a disparu (rouge de base en dessous)
    out.clipInside = px(comp, 35, 35)[2] < 30 && px(comp, 35, 35)[0] > 200
    lb.clip = false

    // nouveau calque depuis un enfant actif → rejoint le groupe
    e.setActive(lay.id)
    const inside = e.addLayer('C')
    out.joinGroup = g.children.some((c) => c.id === inside.id) && g.children.indexOf(inside) === 1

    // moveLayer dans le groupe
    e.moveLayer(inside.id, 1)
    out.moveInside = g.children.indexOf(inside) === 2

    // removeLayer sur le groupe : sous-arbre supprimé + activeId retombe
    e.setActive(g.id)
    // dissocier d'abord pour garder les calques
    const g2id = g.id
    out.ungroupBefore = e.ungroup(g2id)
    out.ungrouped = e.layers.filter((x) => [lay.id, lb.id, inside.id].includes(x.id)).length === 3 && !e._find(g2id)

    // regrouper puis supprimer le groupe → tout part
    const g3 = e.groupLayers([lay.id, inside.id])
    e.removeLayer(g3.id)
    out.removeGroup = !e._find(g3.id) && !e._find(lay.id) && !e._find(inside.id)

    // dump/restore : la structure est conservée
    const g4 = e.groupLayers([lb.id])
    g4.collapsed = true
    const json = JSON.stringify(e._dump())
    await e._restore(json)
    const g4r = e._find(g4.id)
    out.dumpGroup = g4r?.l?.type === 'group' && g4r.l.children.length === 1 && g4r.l.collapsed === true
    out.activeAfter = e.active?.id === g4.id

    // hit-test à travers le groupe
    out.layerAtPoint = e.layerAtPoint(35, 35)?.id === lb.id

    // erreurs ?
    out.errors = null
    return out
  })
  console.log(JSON.stringify(r, null, 1))
  if (errs.length) console.log('PAGEERRS', errs.slice(0, 5))
  await b.close()
})().catch((e) => { console.error('FATAL', String(e).slice(0, 500)); process.exit(1) })
