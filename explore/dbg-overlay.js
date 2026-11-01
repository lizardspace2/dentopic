const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.evaluate(() => localStorage.setItem('dentopic.acq.guide', '1'))
  await pg.goto('http://localhost:5175/acquisition'); await pg.waitForTimeout(2500)
  const el = await pg.evaluate(() => {
    const t = [...document.querySelectorAll('*')].find((e) => e.textContent === 'Choisir la source')
    const r = t.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const info = (e) => e ? { cls: e.className?.toString?.().slice(0, 60), tag: e.tagName, text: e.textContent?.slice(0, 60), pos: e.getBoundingClientRect() } : null
    let chain = []
    let e = top
    while (e && chain.length < 6) { chain.push(info(e)); e = e.parentElement }
    return { target: info(t), top: info(top), chain }
  })
  console.log(JSON.stringify(el, null, 1))
  await pg.screenshot({ path: 'shots/overlay.png' })
  await b.close()
})()
