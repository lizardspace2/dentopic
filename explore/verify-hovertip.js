const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/acquisition', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(3000)
  const t = () => pg.evaluate(() => document.body.innerText)
  const v = (n, x) => console.log(n.padEnd(32), x ? '✓' : '✗')
  const dialogs = () => pg.evaluate(() => document.querySelectorAll('[role="dialog"]').length)
  const killGuide = () => pg.evaluate(() => {
    const m = [...document.querySelectorAll('div')].find((d) => d.innerText.includes("Comprendre l'acquisition"))
    const xb = m && [...m.querySelectorAll('button')].find((bb) => !bb.innerText.trim())
    xb && xb.click()
  })
  // clique le DERNIER élément correspondant (le modal est un portal en fin de DOM)
  const clickLast = (txt) => pg.evaluate((s) => {
    const els = [...document.querySelectorAll('p,span,div')].filter((e) => e.innerText.trim().startsWith(s))
    const el = els[els.length - 1]
    el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return !!el
  }, txt)
  if ((await t()).includes("Comprendre l'acquisition")) { await killGuide(); await pg.waitForTimeout(600) }
  v('guide fermé', !(await t()).includes("Comprendre l'acquisition"))

  await pg.locator('text=ARRIVÉE').first().dispatchEvent('click'); await pg.waitForTimeout(900)
  v('modal dossier ouvert', (await dialogs()) > 0)
  await clickLast('TESTCASE2 Marie'); await pg.waitForTimeout(1200)
  v('modal dossier refermé', (await dialogs()) === 0)

  // survol ARRIVÉE → bulle riche
  await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1000)
  let x = await t()
  v('bulle arrivée : contenu', /photo\(s\)|Contient|Photos r|Dernières/.test(x))
  v('bulle arrivée : actions', x.includes('Ouvrir') && x.includes('Changer'))
  await pg.screenshot({ path: 'shots/hover-arrivee.png' })

  // clic « Ouvrir » (la bulle reste ouverte → bouton réellement cliquable)
  await pg.locator('[aria-label="Ouvrir"]').first().click(); await pg.waitForTimeout(2000)
  v('clic Ouvrir → dossier patient', pg.url().includes('/dossier-patient/dossier/'))

  // retour, choisir la source « Importer des photos »
  await pg.goto('http://localhost:5175/acquisition', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if ((await t()).includes("Comprendre l'acquisition")) { await killGuide(); await pg.waitForTimeout(600) }
  await pg.locator('text=DÉPART').first().dispatchEvent('click'); await pg.waitForTimeout(900)
  await clickLast('Importer des photos'); await pg.waitForTimeout(1000)
  v('modal source refermé', (await dialogs()) === 0)

  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(1000)
  x = await t()
  v('bulle départ riche', x.includes('Type de source') || x.includes('Import'))
  v('bulle départ : actions', x.includes('Changer'))
  await pg.screenshot({ path: 'shots/hover-depart.png' })

  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(800)
  await pg.locator('[aria-label="Changer"]').first().click(); await pg.waitForTimeout(900)
  v('clic Changer → modal source', (await dialogs()) > 0)

  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
