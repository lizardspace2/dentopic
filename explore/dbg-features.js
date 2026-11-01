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

  // 1. Outil forme → calque de forme vectoriel
  await pg.keyboard.press('Shift+m'); await pg.waitForTimeout(300)
  const box = await pg.locator('canvas').first().boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await pg.mouse.move(cx - 80, cy - 50); await pg.mouse.down()
  await pg.mouse.move(cx + 80, cy + 50, { steps: 8 }); await pg.mouse.up()
  await pg.waitForTimeout(600)
  const shape = await pg.evaluate(() => {
    const l = window.__editor.layers.at(-1)
    return { type: l.type, kind: l.shape?.kind, fill: l.shape?.fill, x: l.shape?.x }
  })
  log('SHAPE', JSON.stringify(shape))
  let txt = await pg.locator('body').innerText()
  log('SHAPE_UI', `${txt.includes('Calque de forme')} / ${txt.includes('Apparence')} / ${txt.includes('Alignement')}`)

  // 2. HSL + Colorier + Écrêter
  await pg.evaluate(() => {
    const e = window.__editor
    const l = e.addAdjustLayer('hsl')
    l.adj.params.colorize = true; l.adj.params.hue = 200; l.adj.params.sat = 60
    e.markDirty()
  })
  await pg.waitForTimeout(500)
  txt = await pg.locator('body').innerText()
  log('HSL_UI', `${txt.includes('Colorier')} / ${txt.includes('Écrêter sur le calque inférieur')}`)

  // 3. Niveaux UI (histo + entrées/sortie + Auto + canal)
  await pg.evaluate(() => { const e = window.__editor; e.addAdjustLayer('levels'); e.markDirty() })
  await pg.waitForTimeout(500)
  txt = await pg.locator('body').innerText()
  log('LEVELS_UI', `${txt.includes('Niveaux de sortie')} / Auto=${txt.includes('Auto')}`)

  // 4. Écrêtage : composite sans erreur + pixels changent
  const clip = await pg.evaluate(() => {
    const e = window.__editor; const l = e.layers.at(-1)
    const before = e.compositeFiltered().getContext('2d').getImageData(100, 100, 1, 1).data.join()
    l.clip = true; e.markDirty()
    const after = e.compositeFiltered().getContext('2d').getImageData(100, 100, 1, 1).data.join()
    return { ok: true, changed: before !== after }
  })
  log('CLIP', JSON.stringify(clip))

  // 5. Tracés : save → deselect → reload
  const paths = await pg.evaluate(() => {
    const e = window.__editor
    e.sel = [50, 50, 200, 150]; e.selPoly = null; e.selEllipse = false
    const p = e.saveWorkPath(); e.deselect()
    e.loadPath(p)
    return { n: e.paths.length, name: e.paths[0]?.name, sel: e.sel }
  })
  log('PATHS', JSON.stringify(paths))
  await pg.getByText('Tracés', { exact: true }).first().click().catch(() => {})
  await pg.waitForTimeout(300)
  txt = await pg.locator('body').innerText()
  log('PATHS_TAB', txt.includes('Tracé de travail') || txt.includes('Tracé depuis la sélection'))

  // 6. Histogramme : sélecteur de canal
  await pg.getByText('Histo', { exact: true }).first().click().catch(() => {})
  await pg.waitForTimeout(400)
  txt = await pg.locator('body').innerText()
  log('HISTO_UI', `${txt.includes('RVB')} / ${txt.includes('Écart type')} / ${txt.includes('Niveau de cache')}`)

  // 7. Modal Sélection et masque
  await pg.evaluate(() => { const e = window.__editor; e.sel = [30, 30, 150, 150]; e.selPoly = null; e.selEllipse = false })
  await pg.getByText('Sélection', { exact: true }).click()
  await pg.getByText('Sélection et masque…', { exact: true }).click()
  await pg.waitForTimeout(700)
  txt = await pg.locator('body').innerText()
  log('SELMASK', `${txt.includes('Contour progressif')} / ${txt.includes('Déplacer le bord')} / ${txt.includes('Lisser le contour')}`)
  await pg.screenshot({ path: 'shots/feat-selmask.png' })
  await pg.locator('body').evaluate(() => {})
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300)

  // 8. OptionsBar sélection : Plume / Anti-crénelage / Style
  await pg.keyboard.press('m'); await pg.waitForTimeout(300)
  txt = await pg.locator('body').innerText()
  log('SEL_OPTS', `${txt.includes('Plume')} / ${txt.includes('Anti-crénelage')} / ${txt.includes('Style')}`)

  // 9. Thème clair/sombre
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'light') })
  await pg.reload(); await pg.waitForTimeout(2500)
  const lightBg = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--s-bg').trim())
  const lightMenu = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--s-input').trim())
  log('LIGHT', `${lightBg} / input=${lightMenu}`)
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'dark') })
  await pg.reload(); await pg.waitForTimeout(2500)
  const darkBg = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--s-bg').trim())
  log('DARK', darkBg)

  log('ERRS', JSON.stringify(errs.slice(0, 6)))
  await b.close()
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1) })
