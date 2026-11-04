const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const errs = []
  const run = async (mode) => {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } })
    await ctx.addInitScript((m) => {
      localStorage.setItem('dentopic.acq.guide', '1')
      localStorage.setItem('dentopic.theme', m)
    }, mode)
    const pg = await ctx.newPage()
    pg.on('pageerror', (e) => errs.push(mode + ': ' + e.message))
    await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
    await pg.waitForTimeout(2500)
    if (await pg.locator('input[type="email"]').count()) {
      await pg.fill('input[type="email"]', process.env.DP_USER)
      await pg.fill('input[type="password"]', process.env.DP_PASS)
      await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
    }
    await pg.goto('http://localhost:5175/acquisition', { waitUntil: 'domcontentloaded' })
    await pg.waitForTimeout(3000)
    await pg.locator('text=ARRIVÉE').first().hover({ force: true }); await pg.waitForTimeout(1100)
    await pg.screenshot({ path: `shots/tip-${mode}-arrivee.png` })
    await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(1100)
    await pg.screenshot({ path: `shots/tip-${mode}-depart.png` })
    const bg = await pg.evaluate(() => {
      const tip = [...document.querySelectorAll('body > *')].find((d) => d.innerText && d.innerText.includes('Choisir la source'))
      return tip ? getComputedStyle(tip).backgroundColor : 'non trouvé'
    })
    console.log(`${mode}: fond bulle = ${bg}`)
    await ctx.close()
  }
  await run('light')
  await run('dark')
  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
