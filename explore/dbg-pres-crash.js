const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext()).newPage()
  pg.on('pageerror', (e) => console.log('[pageerror]', e.message, '\n', (e.stack || '').split('\n').slice(0, 6).join('\n')))
  pg.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)) })
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/presentations', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  // cliquer la première carte présentation
  const card = pg.locator('a[href^="/presentations/"]').first()
  console.log('carte présente?', await card.count())
  if (await card.count()) {
    await card.click(); await pg.waitForTimeout(3000)
    console.log('URL:', pg.url())
    const txt = await pg.evaluate(() => document.body.innerText)
    console.log('écran blanc?', txt.trim().length < 50, '| contenu:', JSON.stringify(txt.slice(0, 200)))
  }
  await b.close()
})()
