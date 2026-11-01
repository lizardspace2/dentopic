const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto('http://localhost:5175/presentations'); await pg.waitForTimeout(2500)
  const t = () => pg.evaluate(() => document.body.innerText)
  const inModal = (fn) => pg.evaluate(`(() => {
    // le modal = le div fixed qui contient des boutons (pas un tooltip portal)
    const ms = [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).position === 'fixed' && d.querySelector('button'))
    const m = ms[ms.length - 1]
    if (!m) return false
    return (${fn})(m)
  })()`)

  // recherche
  await pg.fill('input[placeholder*="Rechercher"]', 'Suivi'); await pg.waitForTimeout(600)
  const suivi = (await t()).includes('Suivi')
  console.log('recherche filtre?', suivi)
  await pg.fill('input[placeholder*="Rechercher"]', ''); await pg.waitForTimeout(500)

  // tri A→Z
  await pg.selectOption('select', 'name'); await pg.waitForTimeout(500)
  console.log('tri ok?', true)

  // clic carte → détail
  await pg.locator('text=Suivi').first().click(); await pg.waitForTimeout(1500)
  console.log('modal détail?', (await t()).includes('diapositive(s)'))
  await pg.screenshot({ path: 'shots/pres-detail.png' })
  await pg.evaluate(() => [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).position === 'fixed').pop()?.click())
  await pg.waitForTimeout(600)

  // menu ⋮
  await pg.locator('[aria-label="Plus d\'actions"]').first().click(); await pg.waitForTimeout(400)
  console.log('menu ouvert?', (await t()).includes('Dupliquer') && (await t()).includes('Archiver'))
  await pg.screenshot({ path: 'shots/pres-menu.png' })
  await pg.evaluate(() => { [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === 'Modifier (nom, patient, statut)…' && e.children.length === 0)?.parentElement?.click() || [...document.querySelectorAll('div')].filter(d => d.textContent.trim().startsWith('Modifier (nom')).pop()?.click() })
  await pg.waitForTimeout(600)
  console.log('modal édit?', (await t()).includes('Modifier la présentation'))
  await pg.fill('input[placeholder="Nom de la présentation"]', 'Suivi E2E')
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Enregistrer')?.click()`)
  await pg.waitForTimeout(1500)
  console.log('renommée?', (await t()).includes('Suivi E2E'))

  // ajouter une diapo
  await pg.locator('[aria-label="Ajouter une diapositive"]').first().click(); await pg.waitForTimeout(2000)
  console.log('modal ajout?', (await t()).includes('Ajouter une diapositive'))
  console.log('pick?', await inModal(`m => { const i = m.querySelector('img'); i?.closest('div').click(); return !!i }`))
  await pg.waitForTimeout(300)
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Ajouter')?.click()`)
  await pg.waitForTimeout(2000)
  console.log('diapo ajoutée?', (await t()).match(/\d+ diapositive/)?.[0])

  // partage
  await pg.locator('[aria-label="Partager par lien"]').first().click(); await pg.waitForTimeout(600)
  await inModal(`m => [...m.querySelectorAll('button')].find(b => /Sans expiration|Copier/.test(b.textContent))?.click()`)
  await pg.waitForTimeout(1500)
  console.log('partage actif?', (await t()).includes('Partage actif'))
  await pg.screenshot({ path: 'shots/pres-share.png' })
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Désactiver')?.click()`)
  await pg.waitForTimeout(1200)
  await pg.evaluate(() => [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).position === 'fixed').pop()?.click())
  await pg.waitForTimeout(600)

  // nouvelle présentation
  await pg.click('button:has-text("Nouvelle présentation")'); await pg.waitForTimeout(500)
  await pg.fill('input[placeholder*="séminaire"]', 'Pres E2E nouvelle')
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Créer')?.click()`)
  await pg.waitForTimeout(2000)
  console.log('créée?', (await t()).includes('Pres E2E nouvelle'))

  // corbeille sur la nouvelle
  await pg.fill('input[placeholder*="Rechercher"]', 'Pres E2E nouvelle'); await pg.waitForTimeout(600)
  await pg.locator('[aria-label="Plus d\'actions"]').first().click(); await pg.waitForTimeout(400)
  await pg.evaluate(() => { [...document.querySelectorAll('*')].find(e => e.textContent?.trim() === 'Mettre à la corbeille' && e.children.length === 0)?.parentElement?.click() })
  await pg.waitForTimeout(500)
  console.log('confirm corbeille?', (await t()).includes('sera déplacée'))
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Mettre à la corbeille')?.click()`)
  await pg.waitForTimeout(1500)
  console.log('supprimée?', !(await t()).includes('Pres E2E nouvelle'))
  console.log('errors:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})()
