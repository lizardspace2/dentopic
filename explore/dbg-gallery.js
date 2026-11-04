// Test UI : galerie de filtres — vignettes, sélection, appliquer/régler.
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

  // Doc blanc + contenu sur Calque 1
  await p.click('text=Nouveau document…')
  await sleep(300)
  await p.locator('select').nth(1).selectOption('#ffffff')
  await p.click('button:has-text("Créer")')
  await sleep(400)
  await p.evaluate(() => {
    const e = window.__editor
    const l = e.layers.find((x) => !x.locked)
    e.setActive(l.id)
    l.ctx.fillStyle = '#ff0000'
    l.ctx.fillRect(400, 300, 500, 300)
    e.markDirty()
  })

  // Filtre → Galerie de filtres…
  await p.click('text=Filtre')
  await sleep(250)
  await p.click('text=Galerie de filtres…')
  await sleep(1500) // génération des vignettes
  out.modalOpen = (await p.locator('text=Galerie de filtres').count()) > 0
  out.tiles = await p.locator('img').count()
  await p.screenshot({ path: 'gallery.png' })

  // Sélection d'un filtre sans paramètre (Négatif) → bouton « Appliquer »
  await p.locator('img[alt*="Négatif"]').first().click()
  await sleep(300)
  out.applyLabel = (await p.locator('button:has-text("Appliquer")').count()) > 0
  const pxBefore = await p.evaluate(() => {
    const l = window.__editor.active
    return [...l.ctx.getImageData(500, 400, 1, 1).data]
  })
  await p.locator('button:has-text("Appliquer")').click()
  await sleep(600)
  out.inverted = await p.evaluate((b4) => {
    const l = window.__editor.active
    const d = l.ctx.getImageData(500, 400, 1, 1).data
    return b4[0] > 200 && d[0] < 60 && d[2] > 200 // rouge → cyan
  }, pxBefore)

  // Undo puis réouverture → filtre à paramètres → « Régler ce filtre… »
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control')
  await sleep(400)
  await p.click('text=Filtre')
  await sleep(250)
  await p.click('text=Galerie de filtres…')
  await sleep(1200)
  await p.locator('img[alt*="Tourbillon"]').first().click()
  await sleep(400)
  out.paramsLabel = (await p.locator('button:has-text("Régler ce filtre…")').count()) > 0
  await p.locator('button:has-text("Régler ce filtre…")').click()
  await sleep(500)
  out.paramModal = (await p.locator('text=/Aperçu/').count()) > 0 // dialogue de réglage ouvert
  await p.screenshot({ path: 'gallery-params.png' })
  await p.locator('button:has-text("Annuler")').first().click().catch(() => {})

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(out).filter(([k, v]) => k !== 'tiles' && !v).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
