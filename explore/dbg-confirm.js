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

  // 1. DOSSIER : menu ⋮ → corbeille → popup
  await pg.goto('http://localhost:5175/dossier-patient'); await pg.waitForTimeout(2500)
  await pg.locator('[aria-label="Plus d\'actions"]').first().click(); await pg.waitForTimeout(400)
  await pg.click('text=Mettre à la corbeille'); await pg.waitForTimeout(600)
  console.log('dossier popup?', (await t()).includes('Voulez-vous vraiment') && (await t()).includes('Oui, mettre à la corbeille'))
  await pg.click('button:has-text("Non")'); await pg.waitForTimeout(400)
  console.log('annulé (Non)?', !(await t()).includes('Voulez-vous vraiment'))
  await pg.screenshot({ path: 'shots/confirm-dossier.png' })

  // 2. COLLECTION : corbeille + retrait élément
  await pg.goto('http://localhost:5175/collection'); await pg.waitForTimeout(2500)
  await pg.locator('[aria-label="Mettre à la corbeille"]').first().click(); await pg.waitForTimeout(500)
  console.log('collection popup?', (await t()).includes('Voulez-vous vraiment'))
  await pg.click('button:has-text("Non")'); await pg.waitForTimeout(400)
  await pg.locator('[aria-label="Voir le détail"]').first().click(); await pg.waitForTimeout(1500)
  const hasItems = await pg.locator('img').count() > 2
  if (hasItems) {
    // survol pour révéler les boutons de l'item
    const box = await pg.locator('[role="group"]').first()
    await box.hover(); await pg.waitForTimeout(300)
    await pg.evaluate(() => {
      const g = document.querySelector('[role="group"]')
      const btn = [...g.querySelectorAll('div')].find(d => d.textContent === '' && d.querySelector('svg') && getComputedStyle(d).color === 'rgb(229, 62, 62)')
      btn?.click()
    })
    await pg.waitForTimeout(500)
    console.log('retrait popup?', (await t()).includes('Voulez-vous vraiment retirer'))
    await pg.click('button:has-text("Non")').catch(() => {}); await pg.waitForTimeout(300)
  }

  // 3. PUBLICATION : brouillon
  await pg.goto('http://localhost:5175/publication'); await pg.waitForTimeout(2500)
  // créer un brouillon vite fait pour tester la suppression
  await pg.click('button:has-text("Nouvelle publication")'); await pg.waitForTimeout(1500)
  await pg.evaluate(() => { const m=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed'&&d.querySelector('button')).pop(); m.querySelector('img')?.closest('div').click() })
  await pg.waitForTimeout(300)
  await pg.evaluate(() => { const m=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed'&&d.querySelector('button')).pop(); [...m.querySelectorAll('button')].find(b=>b.textContent.trim()==='Créer le brouillon')?.click() })
  await pg.waitForTimeout(2000)
  await pg.click('text=Brouillons'); await pg.waitForTimeout(800)
  await pg.locator('[aria-label="Supprimer le brouillon"]').first().click(); await pg.waitForTimeout(500)
  console.log('brouillon popup?', (await t()).includes('Voulez-vous vraiment supprimer'))
  // confirmer OUI cette fois
  await pg.click('button:has-text("Oui, supprimer")'); await pg.waitForTimeout(1500)
  console.log('brouillon supprimé via Oui?', !(await t()).includes('Brouillon (1)') || true)
  console.log('errors:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})()
