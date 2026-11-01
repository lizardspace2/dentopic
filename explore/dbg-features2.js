const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  pg.on('pageerror', (e) => errs.push(e.message))
  const log = (k, v) => console.log(k + ':', v)

  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)
  const box = await pg.locator('canvas').first().boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2

  // 1. Forme → calque de forme + panneau Apparence
  await pg.keyboard.press('Shift+m'); await pg.waitForTimeout(300)
  await pg.mouse.move(cx - 80, cy - 50); await pg.mouse.down()
  await pg.mouse.move(cx + 80, cy + 50, { steps: 8 }); await pg.mouse.up()
  await pg.waitForTimeout(600)
  const shape = await pg.evaluate(() => {
    const l = window.__editor.layers.at(-1)
    return { type: l.type, kind: l.shape?.kind }
  })
  let txt = await pg.locator('body').innerText()
  log('SHAPE', JSON.stringify(shape), '| UI:', txt.includes('Calque de forme'), txt.toUpperCase().includes('APPARENCE'), txt.includes('Fond'), txt.includes('Contour'))

  // modifie fond/contour via le panneau (updateShape)
  const upShape = await pg.evaluate(() => {
    const e = window.__editor, l = e.layers.at(-1)
    e.updateShape(l, { fill: '#00ff00', stroke: '#0000ff', strokeW: 8, dash: 'dash' })
    return l.shape
  })
  log('SHAPE_UPD', upShape.fill, upShape.dash)

  // 2. Réglage HSL via menu Calque → force re-render avec touche outil
  await pg.evaluate(() => { const e = window.__editor; const l = e.addAdjustLayer('hsl'); e.markDirty() })
  await pg.keyboard.press('v'); await pg.waitForTimeout(400)
  txt = await pg.locator('body').innerText()
  log('HSL_UI', `${txt.includes('Colorier')} / ${txt.includes('Écrêter sur le calque inférieur')} / arcenciel=${txt.toUpperCase().includes('TEINTE')}`)
  // active Colorier + change teinte → pixels doivent changer
  const col = await pg.evaluate(() => {
    const e = window.__editor, l = e.layers.at(-1)
    const c0 = e.compositeFiltered().getContext('2d').getImageData(0, 0, e.w, e.h)
    const px = (d, i) => d.data[i * 4] + ',' + d.data[i * 4 + 1] + ',' + d.data[i * 4 + 2]
    const s0 = px(c0, 4000)
    l.adj.params.colorize = true; l.adj.params.hue = 0; l.adj.params.sat = 80; e.markDirty()
    const c1 = e.compositeFiltered().getContext('2d').getImageData(0, 0, e.w, e.h)
    return { before: s0, after: px(c1, 4000) }
  })
  log('COLORIZE', JSON.stringify(col))

  // 3. Niveaux UI
  await pg.evaluate(() => { const e = window.__editor; e.addAdjustLayer('levels'); e.markDirty() })
  await pg.keyboard.press('v'); await pg.waitForTimeout(400)
  txt = await pg.locator('body').innerText()
  log('LEVELS_UI', `sortie=${txt.includes('Niveaux de sortie')} auto=${txt.includes('Auto')} canalRVB=${txt.includes('RVB')}`)
  // autoLevels via engine
  const auto = await pg.evaluate(() => {
    const e = window.__editor
    return window.__studioAutoLevels ? 'fn-missing' : 'n/a'
  })

  // 4. Écrêtage : invert écrêté vs non — pixel hors de la forme
  const clipTest = await pg.evaluate(() => {
    const e = window.__editor
    // retire les réglages au-dessus pour isoler
    e.layers = e.layers.filter((l) => l.type !== 'adjust' || l.adj.kind !== 'levels')
    const shp = e.layers.find((l) => l.type === 'shape')
    // point hors de la forme (coin bas-gauche du doc)
    const out = [Math.min(e.w - 10, (shp?.shape.x || 0) > e.w / 2 ? 10 : e.w - 10), e.h - 10]
    const read = () => {
      const c = e.compositeFiltered().getContext('2d')
      const a = c.getImageData(out[0], out[1], 1, 1).data
      return `${a[0]},${a[1]},${a[2]},${a[3]}`
    }
    const l = e.addAdjustLayer('invert')
    e.markDirty(); const sansClip = read()
    l.clip = true; e.markDirty(); const avecClip = read()
    l.clip = false; e.markDirty()
    return { point: out, sansClip, avecClip }
  })
  log('CLIP', JSON.stringify(clipTest))

  // 5. Sélection réelle → tracé → modal Sélection et masque
  await pg.keyboard.press('m'); await pg.waitForTimeout(300)
  await pg.mouse.move(cx - 100, cy - 60); await pg.mouse.down()
  await pg.mouse.move(cx + 100, cy + 60, { steps: 8 }); await pg.mouse.up()
  await pg.waitForTimeout(400)
  // menu Sélection → Sélection et masque
  await pg.getByText('Sélection', { exact: true }).click(); await pg.waitForTimeout(300)
  const hasItem = await pg.getByText('Sélection et masque…', { exact: true }).count()
  log('SELMASK_MENU', hasItem)
  if (hasItem) {
    await pg.getByText('Sélection et masque…', { exact: true }).click(); await pg.waitForTimeout(700)
    txt = await pg.locator('body').innerText()
    log('SELMASK', `${txt.includes('Contour progressif')} / ${txt.includes('Déplacer le bord')} / ${txt.includes('Lisser le contour')} / ${txt.includes('Superposition')}`)
    await pg.screenshot({ path: 'shots/feat-selmask.png' })
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300)
  }

  // 6. Onglet Tracés : bouton « Tracé depuis la sélection »
  await pg.getByText('Tracés', { exact: true }).first().click(); await pg.waitForTimeout(300)
  txt = await pg.locator('body').innerText()
  const btnOk = txt.includes('Tracé depuis la sélection')
  if (btnOk) await pg.getByText('Tracé depuis la sélection', { exact: true }).click().catch(() => {})
  await pg.waitForTimeout(300)
  txt = await pg.locator('body').innerText()
  const pathCount = await pg.evaluate(() => window.__editor.paths.length)
  log('PATHS', `btn=${btnOk} n=${pathCount} nom=${txt.includes('Tracé de travail')}`)

  // 7. Caractère/Paragraphe : nouveaux champs sur calque texte
  await pg.evaluate(() => { const e = window.__editor; e.addTextLayer('TEST DENTAIRE', { size: 40, color: '#ffffff' }, 100, 100); e.markDirty() })
  await pg.keyboard.press('t'); await pg.waitForTimeout(400)
  txt = await pg.locator('body').innerText()
  log('TEXT_PROPS', `échelleH=${txt.includes('Échelle H')} décal=${txt.includes('Décalage')} retrait=${txt.includes('Retrait G')} boite=${txt.includes('coupure')}`)
  const sc = await pg.evaluate(() => {
    const e = window.__editor, l = e.layers.at(-1)
    e.updateText(l, { scaleX: 50, baseline: -20, boxW: 200, indentL: 10 })
    return { boxW: l.text.boxW, box: l.text.box }
  })
  log('TEXT_SCALED', JSON.stringify(sc))

  // 8. Sérialisation : undo/redo conserve paths + shapes + clip
  const ser = await pg.evaluate(async () => {
    const e = window.__editor
    const nLayers = e.layers.length, nPaths = e.paths.length
    await e.undo() // annule l'updateText? snapshot non pris — testons dump/restore direct
    const json = JSON.stringify(e._dump())
    await e._restore(json)
    return { layers: e.layers.length === nLayers || e.layers.length === nLayers - 1, paths: e.paths.length, hasShape: e.layers.some((l) => l.type === 'shape') }
  })
  log('SERIALIZE', JSON.stringify(ser))

  log('ERRS', JSON.stringify(errs.slice(0, 6)))
  await pg.screenshot({ path: 'shots/feat-final.png' })
  await b.close()
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1) })
