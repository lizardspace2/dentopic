const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/acquisition', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(3000)
  await pg.screenshot({ path: 'shots/dbg-acq.png' })
  const over = await pg.evaluate(() => {
    const el = document.elementFromPoint(400, 300)
    return el ? el.outerHTML.slice(0, 300) : 'none'
  })
  console.log('overlay:', over)
  const btns = await pg.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText).slice(0, 20))
  console.log('buttons:', JSON.stringify(btns))
  await b.close()
})()
