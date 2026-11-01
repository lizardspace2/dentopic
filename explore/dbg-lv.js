const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto(`${U}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto(`${U}/studio`); await pg.waitForTimeout(1500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)
  await pg.evaluate(() => { const e = window.__editor; e.addAdjustLayer('levels'); e.markDirty() })
  await pg.keyboard.press('v'); await pg.waitForTimeout(500)
  const info = await pg.evaluate(() => {
    const e = window.__editor
    return { activeType: e.active?.type, kind: e.active?.adj?.kind, lastType: e.layers.at(-1).type }
  })
  console.log('ACTIVE:', JSON.stringify(info))
  const txt = await pg.locator('body').innerText()
  const i = txt.indexOf('Propriétés')
  console.log('---PROPS SLICE---')
  console.log(txt.slice(i, i + 1200))
  console.log('ERRS:', JSON.stringify(errs.slice(0, 5)))
  await pg.screenshot({ path: 'shots/lv.png' })
  await b.close()
})().catch((e) => console.log('FAIL', e.message.split('\n')[0]))
