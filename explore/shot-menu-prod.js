const { chromium } = require('playwright')
const U = 'https://app-seven-indol-87.vercel.app'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 850 } })).newPage()
  pg.setDefaultTimeout(20000)
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(2000)
  await pg.evaluate(() => { localStorage.setItem('dentopic.theme', 'light'); document.documentElement.dataset.theme = 'light' })
  await pg.waitForTimeout(300)
  await pg.locator('text=Image').first().click(); await pg.waitForTimeout(700)
  await pg.screenshot({ path: 'shots/prod-menu.png' })
  const info = await pg.evaluate(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--s-input')
    const els = [...document.querySelectorAll('div')].filter((d) =>
      getComputedStyle(d).position === 'absolute' && getComputedStyle(d).zIndex === '40')
    return { sInput: v || '(absente)', drops: els.map((e) => getComputedStyle(e).background.slice(0, 80)) }
  })
  console.log('PROD:', JSON.stringify(info))
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
