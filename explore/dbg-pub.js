const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  await pg.goto('http://localhost:5175/publication'); await pg.waitForTimeout(2500)
  const t = () => pg.evaluate(() => document.body.innerText)
  const inModal = (fn) => pg.evaluate(`(() => {
    const m = [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).position === 'fixed').pop()
    if (!m) return false
    return (${fn})(m)
  })()`)

  // --- Connecter un réseau ---
  await pg.click('button:has-text("Connecter un réseau")'); await pg.waitForTimeout(700)
  console.log('modal connect?', (await t()).includes('Connecter un réseau social'))
  await inModal(`m => [...m.querySelectorAll('[as=button],button')].find(x => x.textContent.trim()==='Instagram')?.click() || true`)
  await pg.fill('input[placeholder*="cabinet"]', 'cabinet.test').catch(async () => {
    await pg.locator('div').locator('input').last().fill('cabinet.test')
  })
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Connecter')?.click()`)
  await pg.waitForTimeout(2000)
  console.log('compte ajouté?', (await t()).includes('cabinet.test'))
  console.log('badge pending?', (await t()).includes('En attente OAuth'))
  await pg.screenshot({ path: 'shots/pub-connect.png' })
  // fermer modal
  await pg.evaluate(() => [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).position === 'fixed').pop()?.click())
  await pg.waitForTimeout(800)
  console.log('étape 1 cochée?', /Connectez un réseau/.test(await t()))

  // --- Préparer un brouillon ---
  await pg.click('button:has-text("Préparer un brouillon")'); await pg.waitForTimeout(2500)
  console.log('modal draft?', (await t()).includes('Préparer un brouillon'))
  console.log('pick photo?', await inModal(`m => { const i = m.querySelector('img'); i?.closest('div').click(); return !!i }`))
  await pg.waitForTimeout(300)
  await inModal(`m => { const ta = m.querySelector('textarea'); const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; s.call(ta,'Légende de test E2E #dentaire'); ta.dispatchEvent(new Event('input',{bubbles:true})); return true }`)
  await pg.waitForTimeout(200)
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Créer le brouillon')?.click()`)
  await pg.waitForTimeout(2500)
  console.log('brouillon créé?', (await t()).includes('(1)') || (await t()).includes('Légende de test'))

  // onglet Brouillons
  await pg.click('text=Brouillons'); await pg.waitForTimeout(800)
  const tb = await t()
  console.log('draft listé?', tb.includes('Légende de test E2E'))
  await pg.screenshot({ path: 'shots/pub-drafts.png' })

  // modifier le brouillon → programmer
  await pg.locator('text=Légende de test E2E').first().click(); await pg.waitForTimeout(800)
  console.log('modal édition?', (await t()).includes('Modifier le brouillon'))
  const dt = new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  await inModal(`m => { const i = m.querySelector('input[type=datetime-local]'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,'${dt}'); i.dispatchEvent(new Event('input',{bubbles:true})); return true }`)
  await inModal(`m => [...m.querySelectorAll('button')].find(b => b.textContent.trim()==='Enregistrer')?.click()`)
  await pg.waitForTimeout(2000)
  console.log('programmé?', (await t()).includes('Programmé'))

  // supprimer le brouillon
  await pg.locator('[aria-label="Supprimer le brouillon"]').first().click(); await pg.waitForTimeout(1500)
  console.log('supprimé?', !(await t()).includes('Légende de test E2E'))

  // déconnecter le compte
  await pg.click('button:has-text("Connecter un réseau")'); await pg.waitForTimeout(700)
  await inModal(`m => m.querySelector('[aria-label="Déconnecter le compte"]')?.click()`)
  await pg.waitForTimeout(1500)
  console.log('compte déconnecté?', !(await t()).includes('cabinet.test'))
  console.log('errors:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})()
