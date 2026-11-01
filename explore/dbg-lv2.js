const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)
  await pg.evaluate(() => { const e = window.__editor; e.addAdjustLayer('levels'); e.markDirty() })
  await pg.keyboard.press('b'); await pg.waitForTimeout(200)
  await pg.keyboard.press('v'); await pg.waitForTimeout(500)
  let txt = await pg.locator('body').innerText()
  console.log('LEVELS_UI:', `sortie=${txt.includes('Niveaux de sortie')} auto=${txt.includes('Auto')} rvb=${txt.includes('RVB')} histo=${txt.includes('Auto')}`)
  await pg.screenshot({ path: 'shots/lv2.png' })

  // modal Sélection et masque via raccourci Ctrl+Alt+R
  const box = await pg.locator('canvas').first().boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await pg.keyboard.press('m'); await pg.waitForTimeout(300)
  await pg.mouse.move(cx - 100, cy - 60); await pg.mouse.down()
  await pg.mouse.move(cx + 100, cy + 60, { steps: 8 }); await pg.mouse.up()
  await pg.waitForTimeout(400)
  await pg.keyboard.down('Control'); await pg.keyboard.down('Alt'); await pg.keyboard.press('r')
  await pg.keyboard.up('Alt'); await pg.keyboard.up('Control')
  await pg.waitForTimeout(700)
  txt = await pg.locator('body').innerText()
  console.log('SELMASK:', `${txt.includes('Contour progressif')} / ${txt.includes('Déplacer le bord')} / ${txt.includes('Lisser le contour')} / ${txt.includes('Superposition')}`)
  await pg.screenshot({ path: 'shots/selmask2.png' })
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300)

  // panneau texte Caractère complet
  await pg.evaluate(() => { const e = window.__editor; e.addTextLayer('TEST', { size: 40, color: '#fff' }, 100, 100); e.markDirty() })
  await pg.keyboard.press('b'); await pg.waitForTimeout(200)
  await pg.keyboard.press('t'); await pg.waitForTimeout(500)
  txt = await pg.locator('body').innerText()
  console.log('TEXT_PROPS:', `ech=${txt.includes('Échelle H')} dec=${txt.includes('Décalage')} ret=${txt.includes('Retrait G')} boite=${txt.includes('coupure')} espace=${txt.includes('Espace avant')}`)

  console.log('ERRS:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
