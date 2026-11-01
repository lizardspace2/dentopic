const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto('http://localhost:5175/publication'); await pg.waitForTimeout(2500)
  await pg.click('text=Brouillons'); await pg.waitForTimeout(1000)
  const n = await pg.locator('[aria-label="Supprimer le brouillon"]').count()
  console.log('drafts restants:', n)
  for (let i = 0; i < n; i++) {
    await pg.locator('[aria-label="Supprimer le brouillon"]').first().click()
    await pg.waitForTimeout(1200)
  }
  console.log('vidé?', !(await pg.evaluate(() => document.body.innerText)).includes('Légende de test'))
  await pg.screenshot({ path: 'shots/pub-drafts.png' })
  await b.close()
})()
