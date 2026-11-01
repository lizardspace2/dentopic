const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto('http://localhost:5175/collection'); await pg.waitForTimeout(2500)
  const t = () => pg.evaluate(() => document.body.innerText)
  const clickInModal = (sel) => pg.evaluate((sel) => {
    const modal = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'fixed').pop()
    const el = sel === 'addBtn'
      ? [...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ajouter')
      : modal.querySelector(sel)
    el?.click(); return !!el
  }, sel)

  await pg.locator('[aria-label="Voir le détail"]').first().click(); await pg.waitForTimeout(1500)
  console.log('détail?', /élément\(s\) · modifiée|Aucun élément/.test(await t()))

  await pg.locator('[aria-label="Ajouter des éléments"]').first().click(); await pg.waitForTimeout(2000)
  console.log('modal ajout?', (await t()).includes('sélectionné(s)'))
  console.log('pick photo?', await clickInModal('img'))
  await pg.waitForTimeout(400)
  console.log('pick ok?', (await t()).includes('sélectionné'))
  console.log('btn ajouter?', await clickInModal('addBtn'))
  await pg.waitForTimeout(2500)
  console.log('compteur maj?', /[1-9]\d* élément/.test(await t()))
  await pg.screenshot({ path: 'shots/col-added.png' })

  await pg.locator('[aria-label="Modifier la collection"]').first().click(); await pg.waitForTimeout(600)
  console.log('modal édit?', (await t()).includes('Modifier la collection'))
  await pg.fill('input[placeholder*="esthétique"]', 'Ma collection éditée'); await pg.waitForTimeout(200)
  await pg.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'fixed').pop()
    ;[...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enregistrer')?.click()
  })
  await pg.waitForTimeout(1500)
  console.log('renommée?', (await t()).includes('Ma collection éditée'))

  await pg.locator('[aria-label="Partager par lien"]').first().click(); await pg.waitForTimeout(600)
  console.log('modal partage?', (await t()).includes('Partager la collection'))
  await pg.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'fixed').pop()
    const b = [...modal.querySelectorAll('button')].find((x) => /Sans expiration|Copier/.test(x.textContent))
    b?.click()
  })
  await pg.waitForTimeout(1500)
  console.log('lien généré?', (await t()).includes('Partage actif') || (await t()).includes('/partage/'))
  await pg.screenshot({ path: 'shots/col-share.png' })
  await pg.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'fixed').pop()
    ;[...modal.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Désactiver')?.click()
  })
  await pg.waitForTimeout(1000)
  // fermer le modal partage via l'overlay
  await pg.evaluate(() => {
    [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'fixed' && d.className.includes('css-')).pop()?.click()
  })
  await pg.waitForTimeout(800)
  console.log('modal fermé?', !(await t()).includes('Partager la collection'))

  await pg.locator('[aria-label="Mettre à la corbeille"]').first().click(); await pg.waitForTimeout(500)
  console.log('confirm corbeille?', (await t()).includes('Mettre à la corbeille'))
  await pg.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'fixed').pop()
    ;[...modal.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Mettre à la corbeille')?.click()
  })
  await pg.waitForTimeout(1500)
  console.log('supprimée?', !(await t()).includes('Ma collection éditée'))
  console.log('errors:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})()
