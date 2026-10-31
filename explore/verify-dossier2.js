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
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3500)
  // détail dossier avec photos
  await pg.goto('http://127.0.0.1:5431/dossier-patient/dossier/037c47d2-8fc4-42ef-b6fc-cd3be3460caf')
  await pg.waitForTimeout(2500)
  await pg.screenshot({ path: 'shots/dossier-detail2.png' })
  // photo -> studio?edit=
  await pg.locator('a[href*="/studio?edit="]').first().click()
  await pg.waitForTimeout(3500)
  console.log('studio:', await pg.evaluate(() => document.body.innerText.match(/\d+ × \d+/)?.[0] || 'fermé'))
  await pg.screenshot({ path: 'shots/dossier-studio.png' })
  // menu ... de la 1re carte dans la grille
  await pg.goto('http://127.0.0.1:5431/dossier-patient'); await pg.waitForTimeout(2000)
  // trouver le bouton "..." : bouton outline sans texte, 3e action de la 1re carte
  const btns = pg.locator('button:has-text("Capturer")').first()
    .locator('xpath=../following-sibling::*[1]//button | xpath=../../following-sibling::button')
  // méthode simple : tous les boutons carrés de la 1re carte = ceux après Capturer
  const card1 = pg.locator('button:has-text("Capturer")').first().locator('xpath=ancestor::div[6]')
  const squareBtns = card1.locator('button:not(:has-text("Capturer"))')
  const n = await squareBtns.count()
  console.log('boutons carte:', n)
  await squareBtns.nth(n - 1).click()   // dernier = ...
  await pg.waitForTimeout(500)
  console.log('menu:', await pg.evaluate(() => document.body.innerText.includes('Renommer') ? 'ok' : 'non'))
  await pg.screenshot({ path: 'shots/dossier-menu.png' })
  // renommer
  await pg.click('text=Renommer…'); await pg.waitForTimeout(400)
  await pg.fill('input[value]', 'Dossier test renommé')
  await pg.click('text=Renommer'); await pg.waitForTimeout(1200)
  console.log('renommé:', await pg.evaluate(() => document.body.innerText.includes('Dossier test renommé') ? 'ok' : 'non'))
  // capturer -> acquisition pré-remplie
  await pg.click('text=Capturer').catch(()=>{})
  await pg.locator('button:has-text("Capturer")').first().click()
  await pg.waitForTimeout(2000)
  console.log('acq modal:', await pg.evaluate(() => document.body.innerText.includes('Nouvelle acquisition') ? 'ok' : document.body.innerText.slice(0,80)))
  await pg.screenshot({ path: 'shots/dossier-capture.png' })
  console.log('ERRORS:', errs.filter(e => !e.includes('favicon')))
  await b.close()
})().catch(e => console.log('FAIL', e.message))
