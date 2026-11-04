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
  const killGuide = () => pg.evaluate(() => {
    const m = [...document.querySelectorAll('div')].find((d) => d.innerText.includes("Comprendre l'acquisition"))
    const xb = m && [...m.querySelectorAll('button')].find((bb) => !bb.innerText.trim())
    xb && xb.click()
  })
  const clickLast = (txt) => pg.evaluate((s) => {
    const els = [...document.querySelectorAll('p,span,div')].filter((e) => e.innerText.trim().startsWith(s))
    const el = els[els.length - 1]
    el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return !!el
  }, txt)
  if ((await t()).includes("Comprendre l'acquisition")) { await killGuide(); await pg.waitForTimeout(600) }

  // source = appareil « Canon R6 — Test2 » (pose la source directement)
  await pg.locator('text=DÉPART').first().dispatchEvent('click'); await pg.waitForTimeout(900)
  const ok = await clickLast('Canon R6')
  await pg.waitForTimeout(1000)
  v('source appareil posée', ok)

  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(1200)
  let x = await t()
  v('bulle départ : contenu', x.includes('Type de source') || x.includes('Canon'))
  v('bulle départ : actions', x.includes('Changer'))
  await pg.screenshot({ path: 'shots/hover-depart.png' })

  // clic « Changer » → modal source rouvert
  await pg.locator('text=DÉPART').first().hover({ force: true }); await pg.waitForTimeout(800)
  await pg.locator('[aria-label="Changer"]').first().click(); await pg.waitForTimeout(1000)
  v('clic Changer → modal source', (await t()).includes("Source d'acquisition"))
  await pg.screenshot({ path: 'shots/hover-depart-changer.png' })

  console.log('errors:', JSON.stringify(errs.slice(0, 5)))
  await b.close()
})()
