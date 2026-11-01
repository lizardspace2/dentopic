const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  }).catch(() => chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }))
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['camera'] })
  const pg = await ctx.newPage()
  pg.on('pageerror', (e) => console.log('PE', e.message))
  pg.on('console', (m) => m.type() === 'error' && console.log('CE', m.text().slice(0, 120)))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.evaluate(() => localStorage.setItem('dentopic.acq.guide', '1'))
  await pg.goto('http://localhost:5175/acquisition'); await pg.waitForTimeout(2500)
  // destination : clic sur la dernière carte dossier (onClick=setTarget, sans modal)
  const cards = await pg.locator('div.chakra-card, [class*=card]').all()
  // plus simple : cliquer le texte d'un dossier dans la liste du bas
  await pg.evaluate(() => {
    const els = [...document.querySelectorAll('p,div')]
    const rows = els.filter((e) => e.children.length === 0 && /photos_brutes|Suivi|TEST/i.test(e.textContent))
    rows[0]?.closest('[class*=css]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await pg.waitForTimeout(600)
  // clic DÉPART
  await pg.click('text=Choisir la source'); await pg.waitForTimeout(600)
  const t = await pg.evaluate(() => document.body.innerText)
  console.log('source listée?', t.includes('Depuis cet appareil'))
  await pg.click('text=Depuis cet appareil'); await pg.waitForTimeout(2500)
  const t2 = await pg.evaluate(() => document.body.innerText)
  console.log('modal ouvert?', t2.includes('Prendre la photo'))
  console.log('flux live?', await pg.evaluate(() => !!document.querySelector('video')?.srcObject))
  await pg.screenshot({ path: 'shots/device-modal.png' })
  await pg.click('text=Prendre la photo').catch((e) => console.log('shot:', e.message.slice(0, 80)))
  await pg.waitForTimeout(3500)
  const t3 = await pg.evaluate(() => document.body.innerText)
  console.log('cliché envoyé?', t3.includes('envoyée'))
  await pg.screenshot({ path: 'shots/device-shot.png' })
  await b.close()
})()
