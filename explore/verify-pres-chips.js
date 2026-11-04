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
  await pg.goto('http://localhost:5175/presentations', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(3000)
  const t = () => pg.evaluate(() => document.body.innerText)
  const v = (n, x) => console.log(n.padEnd(40), x ? '✓' : '✗')

  // tooltips des puces
  const chipP = pg.locator('span').filter({ hasText: /^\d+ présentation/ }).last()
  await chipP.hover(); await pg.waitForTimeout(700)
  v('tooltip puce présentations', (await t()).includes('tout réafficher'))
  const chipD = pg.locator('span').filter({ hasText: /diapositive\(s\)/ }).first()
  await chipD.hover(); await pg.waitForTimeout(700)
  v('tooltip puce diapositives', (await t()).includes('trier par nombre'))

  // clic puce diapos → tri par nombre de diapos
  await chipD.click(); await pg.waitForTimeout(800)
  const sel = await pg.locator('select').first().inputValue().catch(() => '')
  v('clic diapos → tri "slides"', sel === 'slides')

  // bandeau cliquable → filtre vides
  const banner = pg.locator('text=/sans diapositive/').first()
  if (await banner.count()) {
    await banner.click(); await pg.waitForTimeout(1000)
    v('bandeau → filtre + « Tout afficher »', (await t()).includes('Tout afficher'))
    await pg.screenshot({ path: 'shots/pres-filter-empty.png' })
    await pg.locator('text=Tout afficher').first().click(); await pg.waitForTimeout(800)
    v('reclic → liste complète', !(await t()).includes('Tout afficher'))
  } else v('bandeau présent', false)

  // puce « sans diapo » → même filtre
  const chipEmpty = pg.locator('span').filter({ hasText: /sans diapo/ }).first()
  if (await chipEmpty.count()) {
    await chipEmpty.click(); await pg.waitForTimeout(900)
    v('puce sans diapo → filtre', (await t()).includes('Tout afficher'))
    await chipEmpty.click(); await pg.waitForTimeout(800)
  }

  // puce brouillon → onglet Brouillons
  const chipDraft = pg.locator('span').filter({ hasText: /brouillon\(s\)/ }).first()
  if (await chipDraft.count()) {
    await chipDraft.hover(); await pg.waitForTimeout(600)
    v('tooltip brouillon', (await t()).includes('en brouillon'))
    await chipDraft.click(); await pg.waitForTimeout(900)
    await pg.screenshot({ path: 'shots/pres-filter-drafts.png' })
    // reset via puce présentations
    await chipP.click(); await pg.waitForTimeout(800)
    v('clic présentations → reset onglet', true)
  }
  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
