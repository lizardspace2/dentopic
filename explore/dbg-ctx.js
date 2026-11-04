// Test UI : barre contextuelle — 3 états (défaut / sélection / transformation) + toggle.
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const out = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto('http://localhost:5431/test-studio.html')
  await sleep(900)

  // Doc blanc
  await p.click('text=Nouveau document…')
  await sleep(300)
  await p.locator('select').nth(1).selectOption('#ffffff')
  await p.click('button:has-text("Créer")')
  await sleep(500)

  // État défaut : « Tout », « Plage de couleurs », « Teinte » visibles
  out.defaultBar = (await p.locator('text=Plage de couleurs').count()) > 0
    && (await p.locator('text=Teinte').count()) > 0
  await p.screenshot({ path: 'ctx-default.png' })

  // « Tout » → sélection totale + la barre bascule en mode sélection
  await p.locator('[data-ctxbar] button:has-text("Tout")').click()
  await sleep(300)
  out.selMade = await p.evaluate(() => !!window.__editor.sel)
  out.selBar = (await p.locator('[data-ctxbar] button:has-text("Transformer")').count()) > 0
    && (await p.locator('[data-ctxbar] button:has-text("Remplir")').count()) > 0
  await p.screenshot({ path: 'ctx-sel.png' })

  // « Remplir » ouvre le modal Remplir
  await p.locator('[data-ctxbar] button:has-text("Remplir")').click()
  await sleep(400)
  out.fillOpened = (await p.locator('text=Premier plan').count()) > 0
  await p.locator('button:has-text("Annuler")').first().click().catch(() => {})
  await sleep(300)

  // Désélection via la barre (icône ✕ = dernier bouton de la pilule)
  await p.evaluate(() => {
    const bar = document.querySelector('[data-ctxbar]')
    const btns = bar?.querySelectorAll('button')
    btns?.[btns.length - 1]?.click()
  })
  await sleep(200)
  out.deselected = await p.evaluate(() => !window.__editor.sel)

  // État transformation : du contenu sur « Calque 1 » puis Ctrl+T → Appliquer/Annuler
  await p.locator('text=Calque 1').click()
  await sleep(200)
  await p.evaluate(() => {
    const l = window.__editor.active
    l.ctx.fillStyle = '#ff0000'
    l.ctx.fillRect(700, 400, 300, 200)
    window.__editor.markDirty()
  })
  await p.keyboard.down('Control'); await p.keyboard.press('t'); await p.keyboard.up('Control')
  await sleep(300)
  out.ftBar = (await p.locator('[data-ctxbar] button:has-text("Appliquer")').count()) > 0
  await p.screenshot({ path: 'ctx-ft.png' })
  await p.locator('[data-ctxbar] button:has-text("Annuler")').click()
  await sleep(300)
  // après annulation, la barre repasse au contexte par défaut
  out.ftCancelled = (await p.locator('[data-ctxbar] button:has-text("Tout")').count()) > 0

  // Toggle Affichage → Barre contextuelle
  await p.click('text=Affichage')
  await sleep(250)
  await p.click('text=Barre contextuelle')
  await sleep(300)
  out.hidden = (await p.locator('[data-ctxbar]').count()) === 0

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(out).filter(([, v]) => !v).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
