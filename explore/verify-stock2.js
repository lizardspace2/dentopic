const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext()).newPage()
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/reglage/stockage', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  const x = await pg.evaluate(() => document.body.innerText)
  console.log('membres comptés:', /Membres de l’équipe\s+1 \/ 1/.test(x.replace(/\s+/g,' ')) || x.includes('1 / 1'))
  await b.close()
})()
