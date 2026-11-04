// Test UI : modal Fluidité — ouverture, pousser au pinceau, OK, undo.
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const out = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto('http://localhost:5431/test-studio.html')
  await sleep(900)

  // Doc blanc + carré rouge sur le calque de base (matière à déformer)
  await p.click('text=Nouveau document…')
  await sleep(300)
  await p.locator('select').nth(1).selectOption('#ffffff')
  await p.click('button:has-text("Créer")')
  await sleep(500)
  const layerId = await p.evaluate(() => {
    const e = window.__editor
    const l = e.layers.find((x) => !x.locked) // « Calque 1 » — l'Arrière-plan est verrouillé
    l.ctx.fillStyle = '#ff0000'
    l.ctx.fillRect(700, 400, 300, 200)
    e.markDirty()
    return l.id
  })
  // vrai clic sur la ligne « Calque 1 » → active le calque ET re-rend React
  await p.click('text=Calque 1')
  await sleep(300)

  // Menu Filtre → Fluidité…
  await p.click('text=Filtre')
  await sleep(250)
  await p.click('text=Fluidité…')
  await sleep(600)
  out.modalOpen = await p.locator('text=Pousser').count() > 0
  await p.screenshot({ path: 'liq-open.png' })

  // Drag « Pousser » sur l'aperçu : centre du carré vers la droite
  const cv = p.locator('canvas').last()
  const box = await cv.boundingBox()
  const docAt = (x, y) => p.evaluate(([w, h]) => {
    const e = window.__editor
    const s = Math.min(1, 680 / e.w, 520 / e.h)
    return s
  }, [0, 0])
  const s = await docAt()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await p.mouse.move(cx - 60 * s, cy)
  await p.mouse.down()
  for (let i = 1; i <= 10; i++) { await p.mouse.move(cx - 60 * s + i * 12, cy + i * 2); await sleep(40) }
  await p.mouse.up()
  await sleep(300)
  await p.screenshot({ path: 'liq-drag.png' })

  // OK → cuisson dans le calque
  await p.click('button:has-text("OK")')
  await sleep(1200)
  out.baked = await p.evaluate((id) => {
    const l = window.__editor._find(id)?.l
    const d = l.cv.getContext('2d')
    // le carré d'origine finissait à x=1000 ; après poussée, du rouge > 1000
    const img = d.getImageData(1000, 350, 300, 400).data
    for (let i = 0; i < img.length; i += 4) if (img[i] > 200 && img[i + 3] > 200) return true
    return false
  }, layerId)
  await p.screenshot({ path: 'liq-baked.png' })

  // Ctrl+Z restaure
  await p.keyboard.press('Control+z')
  await sleep(600)
  out.undo = await p.evaluate((id) => {
    const l = window.__editor._find(id)?.l
    const d = l.cv.getContext('2d').getImageData(1000, 350, 300, 400).data
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 3] > 200) return false
    return true
  }, layerId)

  // Ctrl+Maj+X rouvre le modal
  await p.keyboard.press('Control+Shift+x')
  await sleep(500)
  out.shortcut = await p.locator('text=Tout reconstruire').count() > 0
  await p.keyboard.press('Escape')
  await sleep(300)

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(out).filter(([, v]) => !v).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
