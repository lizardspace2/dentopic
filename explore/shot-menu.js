const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 850 } })).newPage()
  pg.setDefaultTimeout(15000)
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(2500)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'light'); document.documentElement.dataset.theme = 'light' })
  await pg.waitForTimeout(300)
  await pg.locator('text=Image').first().click(); await pg.waitForTimeout(600)
  await pg.screenshot({ path: 'shots/menu-light.png' })
  // mesurer le fond du dropdown
  const info = await pg.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter((d) => d.textContent?.includes('Miroir horizontal') && d.children.length > 2)
    const el = els[els.length - 1]
    if (!el) return 'not found'
    const cs = getComputedStyle(el)
    return { bg: cs.background, sInput: getComputedStyle(document.documentElement).getPropertyValue('--s-input') }
  })
  console.log('DROPDOWN:', JSON.stringify(info))
  console.log('ERRS:', JSON.stringify(errs.slice(0, 3)))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
