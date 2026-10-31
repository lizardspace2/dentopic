const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await pg.goto('http://127.0.0.1:5431/login')
  await pg.fill('input[type="email"]', '' + (process.env.DP_USER||'') + '')
  await pg.fill('input[type="password"]', '' + (process.env.DP_PASS||'') + '')
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3500)
  await pg.goto('http://127.0.0.1:5431/studio'); await pg.waitForTimeout(1200)
  await pg.click('text=Choisir une photo'); await pg.waitForTimeout(1500)
  await pg.fill('input[placeholder*="Rechercher"]', '1793333215997_0000_0002')
  await pg.waitForTimeout(1800); await pg.locator('img').first().click(); await pg.waitForTimeout(2500)
  // baguette
  await pg.keyboard.press('w'); await pg.waitForTimeout(300)
  const main = await pg.locator('canvas').first().boundingBox()
  await pg.mouse.click(main.x + 40, main.y + 40)
  await pg.waitForTimeout(2500)
  console.log('wand sel:', await pg.evaluate(() => {
    const s = window.__dbg || null
    return 'voire screenshot'
  }))
  await pg.screenshot({ path: 'shots/ps-wand.png' })
  // courbe drag fonctionne déjà ; test handles
  await pg.keyboard.press('v')
  await pg.click('text=Poignées de transformation'); await pg.waitForTimeout(400)
  await pg.screenshot({ path: 'shots/ps-handles.png' })
  // fx ombre portée sur calque
  await pg.keyboard.press('b')
  await pg.mouse.move(main.x + 300, main.y + 300); await pg.mouse.down()
  await pg.mouse.move(main.x + 380, main.y + 360, {steps:5}); await pg.mouse.up()
  await pg.evaluate(() => [...document.querySelectorAll('div')].find(d=>d.textContent.trim()==='Calques' && d.children.length===0)?.click())
  await pg.waitForTimeout(400)
  await pg.click('text=fx').catch(async () => { await pg.locator('button, div[role], div').filter({hasText:'fx'}).last().click() }).catch(()=>{})
  await pg.waitForTimeout(600)
  await pg.screenshot({ path: 'shots/ps-fx.png' })
  console.log('ERRORS:', errs.filter(e => !e.includes('favicon')))
  await b.close()
})().catch(e => console.log('FAIL', e.message))
