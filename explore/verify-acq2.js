const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext()).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto('http://127.0.0.1:5431/login')
  await pg.evaluate(() => { localStorage.setItem('dentopic.acq.guide','1'); localStorage.setItem('dentopic.theme','light') })
  await pg.fill('input[type="email"]', '' + (process.env.DP_USER||'') + '')
  await pg.fill('input[type="password"]', '' + (process.env.DP_PASS||'') + '')
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3500)
  await pg.goto('http://127.0.0.1:5431/acquisition')
  await pg.waitForTimeout(2000)
  await pg.screenshot({ path: 'shots/acq2-page.png' })

  const openAndShoot = async (trigger, expect, name) => {
    await pg.click(trigger); await pg.waitForTimeout(500)
    const ok = await pg.locator(`text=${expect}`).count()
    console.log(`${name}:`, ok ? 'ok' : 'MANQUANT')
    await pg.screenshot({ path: `shots/acq2-${name}.png` })
    await pg.mouse.click(8, 400); await pg.waitForTimeout(350)
  }
  // source → camera
  await openAndShoot('text=DÉPART', "Source d'acquisition", 'source')
  await pg.click('text=DÉPART'); await pg.waitForTimeout(400)
  await pg.click("text=Appareil photo"); await pg.waitForTimeout(500)
  console.log('camera:', await pg.locator('text=Ajouter un appareil').count() ? 'ok' : 'MANQUANT')
  await pg.click('text=Ajouter un appareil'); await pg.waitForTimeout(400)
  await pg.screenshot({ path: 'shots/acq2-camera-form.png' })
  await pg.mouse.click(8, 400); await pg.waitForTimeout(350)
  // ftp
  await pg.click('text=DÉPART'); await pg.waitForTimeout(400)
  await pg.click('text=FTP'); await pg.waitForTimeout(500)
  console.log('ftp:', await pg.locator('text=Chemin surveillé').count() ? 'ok' : 'MANQUANT')
  await pg.screenshot({ path: 'shots/acq2-ftp.png' })
  await pg.mouse.click(8, 400); await pg.waitForTimeout(350)
  // watch
  await pg.click('text=DÉPART'); await pg.waitForTimeout(400)
  await pg.click('text=Dossier surveillé'); await pg.waitForTimeout(500)
  console.log('watch:', await pg.locator('text=Chemin du dossier').count() ? 'ok' : 'MANQUANT')
  await pg.screenshot({ path: 'shots/acq2-watch.png' })
  await pg.mouse.click(8, 400); await pg.waitForTimeout(350)
  // import via source
  await pg.click('text=DÉPART'); await pg.waitForTimeout(400)
  await pg.click('text=Importer des photos'); await pg.waitForTimeout(500)
  console.log('import:', await pg.locator('text=Glissez vos photos ici').count() ? 'ok' : 'MANQUANT')
  await pg.screenshot({ path: 'shots/acq2-import.png' })
  await pg.mouse.click(8, 400); await pg.waitForTimeout(350)
  // dossier
  await openAndShoot('text=ARRIVÉE', 'Dossier de destination', 'dossier')
  // nouvelle acquisition
  await openAndShoot('text=Nouvelle acquisition', "MODE D'ACQUISITION", 'new')
  // tooltip
  await pg.hover('button:has-text("Aide")'); await pg.waitForTimeout(350)
  await pg.screenshot({ path: 'shots/acq2-tooltip.png' })
  console.log('ERRORS:', errs.filter(e => !e.includes('favicon')))
  await b.close()
})().catch(e => console.log('FAIL', e.message))
