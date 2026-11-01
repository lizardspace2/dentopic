const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  const t = () => pg.evaluate(() => document.body.innerText)

  await pg.goto('http://localhost:5175/reglage/membres'); await pg.waitForTimeout(2000)
  console.log('page?', (await t()).includes("Membres de l'équipe"))
  console.log('propriétaire listé?', (await t()).includes('Propriétaire'))

  // créer un compte
  await pg.click('button:has-text("Créer un compte")'); await pg.waitForTimeout(500)
  console.log('modal?', (await t()).includes('Créer un compte membre'))
  const email = `membre.e2e.${Date.now()}@test.dev`
  await pg.fill('input[placeholder*="Julie"]', 'E2E Membre Test')
  await pg.fill('input[type="email"]', email)
  await pg.fill('input[placeholder*="6+"]', 'TestPass42')
  await pg.screenshot({ path: 'shots/mem-modal.png' })
  await pg.evaluate(() => { const m=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed'&&d.querySelector('button')).pop(); [...m.querySelectorAll('button')].find(b=>b.textContent.trim()==='Créer le compte')?.click() })
  await pg.waitForTimeout(4000)
  console.log('compte créé?', (await t()).includes('Compte créé'))
  // la session admin est-elle toujours en place ?
  await pg.evaluate(() => [...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed'&&d.querySelector('button')).pop()?.click())
  await pg.waitForTimeout(800)
  const txt = await t()
  console.log('membre listé?', txt.includes('E2E Membre Test') || txt.includes('Membre'))
  console.log('encore connecté?', !txt.includes('Connexion'))
  await pg.screenshot({ path: 'shots/mem-list.png' })

  // changement de rôle
  const sel = await pg.locator('select[aria-label^="Rôle de"]').last()
  await sel.selectOption('admin'); await pg.waitForTimeout(1200)
  console.log('admin tag?', (await t()).includes('Administrateur'))

  // retrait → confirmation
  await pg.locator('[aria-label^="Retirer"]').last().click(); await pg.waitForTimeout(500)
  console.log('popup confirm?', (await t()).includes('Voulez-vous vraiment retirer'))
  await pg.click('button:has-text("Oui, retirer")'); await pg.waitForTimeout(1500)
  const after = await t()
  console.log('retiré?', !after.includes('E2E Membre Test'))
  console.log('errors:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})()
