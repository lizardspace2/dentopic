const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext()).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto('http://localhost:5175/collection'); await pg.waitForTimeout(2500)
  const t = () => pg.evaluate(() => document.body.innerText)
  // Nouvelle collection
  await pg.click('text=Nouvelle collection'); await pg.waitForTimeout(600)
  console.log('modal création?', (await t()).includes('Nouvelle collection'))
  await pg.fill('input[placeholder*="esthétique"]', 'Collection test nouvelle')
  await pg.fill('input[placeholder*="Thème"]', 'Description de test')
  await pg.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'fixed').pop()
    ;[...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Créer')?.click()
  })
  await pg.waitForTimeout(2000)
  console.log('créée?', (await t()).includes('Collection test nouvelle'))
  // recherche filtre
  await pg.fill('input[placeholder*="Filtrer"]', 'Collection test nouvelle'); await pg.waitForTimeout(500)
  console.log('filtre 1 résultat?', !(await t()).includes('Collection_E2E'))
  // retrait d'un élément via détail — non nécessaire, vérifier Nettoyer existe
  console.log('errors:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})()
