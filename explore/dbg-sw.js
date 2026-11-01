const { chromium } = require('playwright')
const U = 'http://localhost:5175'
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  const log = (k, v) => console.log(k + ':', v)
  await pg.goto(`${U}/login`, { waitUntil: 'domcontentloaded' })
  await pg.fill('input[type="email"]', process.env.DP_USER)
  await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3500)
  await pg.goto(`${U}/studio`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500)
  await pg.getByText('Fichier', { exact: true }).click()
  await pg.getByText('Ouvrir une photo…', { exact: true }).click()
  await pg.waitForTimeout(2500)
  await pg.locator('img').first().click(); await pg.waitForTimeout(3000)
  await pg.getByText('Nuancier', { exact: true }).click(); await pg.waitForTimeout(400)
  const txt = await pg.locator('body').innerText()
  log('SWATCH_UI', `${txt.includes('1er plan')} / ${txt.includes('arrière-plan')}`)
  // échantillons = petites divs 16x16 cliquables dans la grille
  const pick = async (rgb, btn) => pg.evaluate(({ rgb }) => {
    const el = [...document.querySelectorAll('div')].find((d) => {
      const s = getComputedStyle(d)
      return s.backgroundColor === rgb && s.width === '16px' && s.cursor === 'pointer'
    })
    if (!el) return false
    const r = el.getBoundingClientRect()
    window.__sw = { x: r.x + 8, y: r.y + 8 }
    return true
  }, { rgb })
  const found1 = await pick('rgb(226, 87, 76)')
  const p1 = await pg.evaluate(() => window.__sw)
  await pg.mouse.click(p1.x, p1.y, { button: 'left' }); await pg.waitForTimeout(300)
  const found2 = await pick('rgb(58, 155, 217)')
  const p2 = await pg.evaluate(() => window.__sw)
  await pg.mouse.click(p2.x, p2.y, { button: 'right' }); await pg.waitForTimeout(300)
  log('FOUND', `${found1}/${found2}`)
  // fg/bg dans les carrés du Nuancier : 1er plan = 18px, arrière-plan = 16px bordé
  const colors = await pg.evaluate(() => {
    const sq = (w) => [...document.querySelectorAll('div')].filter((d) => {
      const s = getComputedStyle(d)
      return s.width === w && s.position === 'absolute' && s.cursor === 'pointer'
    }).map((d) => getComputedStyle(d).backgroundColor)
    return { fg: sq('18px'), bg: sq('16px').filter((c) => c && c !== 'rgba(0, 0, 0, 0)') }
  })
  log('COLORS', JSON.stringify(colors))
  const status = await pg.locator('body').innerText()
  log('STATUS', `${status.includes('RVB · 8 bit')} / ${status.includes('calque(s)')} / ${status.includes('Ouvert :')}`)
  await pg.screenshot({ path: 'shots/swatches.png' })
  log('ERRS', JSON.stringify(errs.slice(0, 6)))
  await b.close()
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1) })
