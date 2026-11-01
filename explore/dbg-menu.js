const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 840 } })).newPage()
  pg.on('pageerror', (e) => console.log('PE', e.message))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto('http://localhost:5175/studio'); await pg.waitForTimeout(1200)
  // sans doc : items grisés + not-allowed
  await pg.click('text=Édition'); await pg.waitForTimeout(300)
  const st = await pg.evaluate(() => {
    const it = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Annuler')
    const cs = it && getComputedStyle(it)
    return it ? { cursor: cs.cursor, opacity: cs.opacity } : null
  })
  console.log('sans doc — Annuler:', JSON.stringify(st))
  await pg.screenshot({ path: 'shots/menu-disabled.png' })
  await pg.keyboard.press('Escape'); await pg.mouse.click(700, 400); await pg.waitForTimeout(300)
  // avec doc
  await pg.click('text=Fichier'); await pg.waitForTimeout(300)
  await pg.click('text=Montage avant / après'); await pg.waitForTimeout(1200)
  const th = pg.locator('img'); await th.nth(0).waitFor({ timeout: 8000 })
  await th.nth(0).click(); await th.nth(2).click()
  await pg.click('text=Créer le montage'); await pg.waitForTimeout(2500)
  await pg.click('text=Édition'); await pg.waitForTimeout(300)
  const st2 = await pg.evaluate(() => {
    const it = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Annuler')
    const cs = it && getComputedStyle(it)
    return it ? { cursor: cs.cursor, opacity: cs.opacity } : null
  })
  console.log('avec doc — Annuler:', JSON.stringify(st2))
  await pg.click('text=Dupliquer le calque'); await pg.waitForTimeout(500)
  const t = await pg.evaluate(() => document.body.innerText)
  console.log('menu clic → copie?', t.includes('copie'))
  await pg.screenshot({ path: 'shots/menu-enabled.png' })
  await b.close()
})()
