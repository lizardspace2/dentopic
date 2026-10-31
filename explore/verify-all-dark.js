const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext()).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto('http://127.0.0.1:5431/login')
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme','dark'); localStorage.setItem('dentopic.acq.guide','1') })
  await pg.reload(); await pg.waitForTimeout(800)
  await pg.screenshot({ path: 'shots/d-dark-login.png' })
  await pg.fill('input[type="email"]', '' + (process.env.DP_USER||'') + '')
  await pg.fill('input[type="password"]', '' + (process.env.DP_PASS||'') + '')
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3200)
  const routes = [['','accueil'],['recherche','recherche'],['acquisition','acquisition'],['dossier-patient','dossier'],['collection','collection'],['publication','publication'],['presentations','presentations'],['reglage','reglage'],['reglage/profil','profil'],['reglage/appareils','appareils']]
  for (const [r, n] of routes) {
    await pg.goto('http://127.0.0.1:5431/' + r); await pg.waitForTimeout(1400)
    await pg.screenshot({ path: `shots/d-dark-${n}.png` })
  }
  console.log('ERRORS:', errs.filter(e => !e.includes('favicon')))
  await b.close()
})().catch(e => console.log('FAIL', e.message))
