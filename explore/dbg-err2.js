const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage()
  const errs = []
  pg.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text().slice(0, 300)))
  pg.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 300)))
  await pg.goto(`${U}/login`, { waitUntil: 'domcontentloaded' })
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000)
  console.log('BODY:', (await pg.locator('body').innerText()).slice(0, 400))
  console.log('ERRS:', JSON.stringify(errs.slice(0, 8), null, 1))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
