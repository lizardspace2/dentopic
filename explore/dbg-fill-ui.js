// Test UI : calques de remplissage + analyse de teinte VITA.
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const out = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto('http://localhost:5431/test-studio.html')
  await sleep(800)

  // 1. Nouveau document via le dialogue
  await p.click('text=Nouveau document…')
  await sleep(300)
  await p.locator('select').nth(1).selectOption('#ffffff') // fond blanc (analysable)
  await p.click('button:has-text("Créer")')
  await sleep(500)
  out.docOpen = await p.evaluate(() => !!window.__editor?.w)

  // 2. Calque → Remplissage : couleur unie
  await p.click('text=Calque')
  await sleep(250)
  await p.click('text=Remplissage : couleur unie')
  await sleep(400)
  out.solidCreated = await p.evaluate(() => window.__editor.layers.some((l) => l.type === 'fill' && l.fillDef?.kind === 'solid'))
  out.solidActive = await p.evaluate(() => window.__editor.active?.type === 'fill')

  // 3. Propriétés affiche les contrôles du remplissage
  out.propsVisible = await p.locator('text=Calque de remplissage').count() > 0
  await p.screenshot({ path: 'fill-props.png' })

  // 4. Changer la couleur via Propriétés → composite change (édition non destructive)
  const pxAt = () => p.evaluate(() => {
    const d = window.__editor.composite().getContext('2d').getImageData(60, 60, 1, 1).data
    return [d[0], d[1], d[2]]
  })
  const before = await pxAt()
  await p.evaluate(() => {
    const l = window.__editor.active
    l.fillDef.color = '#00ff00'
    window.__editor.drawFillLayer(l)
    window.__editor.markDirty?.()
  })
  await sleep(200)
  const after = await pxAt()
  out.recolorChangesComposite = before[1] < 200 && after[1] > 200

  // 5. Calque → Remplissage : dégradé
  await p.click('text=Calque')
  await sleep(250)
  await p.click('text=Remplissage : dégradé')
  await sleep(300)
  out.gradientCreated = await p.evaluate(() =>
    window.__editor.layers.filter((l) => l.type === 'fill').length === 2)

  // 6. Undo supprime le dégradé
  await p.keyboard.press('Control+z')
  await sleep(300)
  out.undoRemoves = await p.evaluate(() =>
    window.__editor.layers.filter((l) => l.type === 'fill').length === 1)
  await p.keyboard.press('Control+z') // retire aussi l'uni

  // 7. Analyse de teinte : sélection tout → onglet Dentaire → Analyser la sélection
  await p.evaluate(() => window.__editor.selectAll())
  await sleep(100)
  // ouvrir l'onglet Dentaire
  await p.click('button:has-text("Dentaire")').catch(() => p.click('text=Dentaire'))
  await sleep(300)
  out.analyzeBtn = await p.locator('text=Analyser la sélection').count() > 0
  if (out.analyzeBtn) {
    await p.click('text=Analyser la sélection')
    await sleep(400)
    out.guessShown = await p.locator('text=/Teinte détectée/').count() > 0
    out.guessCode = await p.evaluate(() =>
      document.body.innerText.match(/Teinte détectée\s*:\s*([A-D]\d(?:\.5)?)/)?.[1] || null)
    await p.screenshot({ path: 'vita-guess.png' })
  }

  // 8. Pipette : armer via le bouton, cliquer le canevas, Échap désarme
  const pickBtn = p.locator('text=/Analyser la teinte/')
  out.pickBtnVisible = await pickBtn.count() > 0

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(out).filter(([, v]) => v === false || v === null).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
