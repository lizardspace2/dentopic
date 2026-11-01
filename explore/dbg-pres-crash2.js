const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext()).newPage()
  pg.on('pageerror', (e) => console.log('[pageerror]', e.message))
  pg.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 400)) })
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/presentations', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  // cliquer le titre d'une carte (déclenche le onClick de la Card)
  const card = pg.locator('[data-pres-card], div').locator('text=/./').first()
  // cible plus précise : la miniature aspect 16/9
  const thumb = pg.locator('div[class*="chakra-"]').locator('xpath=//div[contains(@style,"aspect-ratio") or contains(@class,"css-")]').first()
  const first = pg.locator('text=diapositive').first()
  // Essayons simplement : cliquer sur le nom de la 1ère présentation
  const names = await pg.locator('p.chakra-text, span').allInnerTexts().catch(() => [])
  // stratégie simple : clic sur le premier FiType (vignette)
  const svg = pg.locator('svg').nth(10)
  await pg.locator('div').filter({ hasText: /^diapositive$|diapositives$/ }).first().click({ timeout: 5000 }).catch(async () => {
    // fallback : cliquer au centre de la première carte grid
    const grid = pg.locator('div').filter({ hasText: 'ajoutée|créée' }).first()
    await pg.mouse.click(400, 350)
  })
  await pg.waitForTimeout(2500)
  const txt = await pg.evaluate(() => document.body.innerText)
  console.log('contenu après clic:', JSON.stringify(txt.slice(0, 300)))
  await b.close()
})()
