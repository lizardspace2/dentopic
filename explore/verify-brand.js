const { chromium } = require('playwright')
const fs = require('fs')
// PNG 1x1 rouge minimal
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/reglage/brand', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2000)
  const t = () => pg.evaluate(() => document.body.innerText)
  const v = (name, x) => console.log(name.padEnd(24), x ? '✓' : '✗')
  let x = await t()
  v('page chargee', x.includes('Brand Système'))
  // remplir
  await pg.fill('input[placeholder*="cabinet.fr"], input[placeholder="Mon cabinet"]', '').catch(() => {})
  await pg.fill('input[placeholder*="Imagerie dentaire"]', 'Test & qualité E2E')
  const nameInput = pg.locator('input').nth(1) // après ? utilisons placeholders
  await pg.fill('input[placeholder="Mon cabinet"]', 'Cabinet E2E Brand').catch(() => {})
  // nom du cabinet = input sans placeholder? utiliser label
  const inputs = pg.locator('input[placeholder]')
  await pg.locator('input[placeholder="Mon cabinet"]').count().then(async (n) => {
    if (!n) await pg.locator('input').nth(0).fill('Cabinet E2E Brand')
    else await pg.fill('input[placeholder="Mon cabinet"]', 'Cabinet E2E Brand')
  })
  await pg.fill('input[placeholder*="Dr Guillaume · Cabinet"]', 'Dr Test · Cabinet E2E · Paris')
  // couleur secondaire hex
  const hex = pg.locator('input.font-mono, input[aria-label*="hexadécimal"]')
  await hex.nth(1).fill('#ff8800')
  // palette
  await pg.click('[aria-label*="Palette #0d9488"]')
  // polices
  await pg.selectOption('select[aria-label="Police des titres"]', 'Georgia')
  // sauvegarder
  await pg.click('button:has-text("Enregistrer")'); await pg.waitForTimeout(1500)
  x = await t()
  v('enregistre', x.includes('Identité visuelle enregistrée'))
  v('apercu nom', x.includes('Cabinet E2E Brand') || (await pg.locator('text=Cabinet E2E Brand').count()) > 0)
  // recharger → persistance
  await pg.reload(); await pg.waitForTimeout(2500)
  const tag = await pg.inputValue('input[placeholder*="Imagerie dentaire"]')
  v('persistance tagline', tag === 'Test & qualité E2E')
  const fontT = await pg.locator('select[aria-label="Police des titres"]').inputValue()
  v('persistance police', fontT === 'Georgia')
  // upload logo
  fs.writeFileSync('shots/brand-logo.png', PNG)
  await pg.setInputFiles('input[type="file"]', 'shots/brand-logo.png')
  await pg.waitForTimeout(2500)
  x = await t()
  const hasTrash = await pg.locator('[aria-label="Supprimer le logo"]').count()
  v('logo uploade', hasTrash > 0 || x.includes('Remplacer'))
  await pg.screenshot({ path: 'shots/brand-final.png', fullPage: true })
  // suppression logo → popup confirm
  if (hasTrash) {
    await pg.click('[aria-label="Supprimer le logo"]'); await pg.waitForTimeout(600)
    x = await t()
    v('popup suppression', x.includes('Voulez-vous vraiment supprimer le logo'))
    await pg.click('button:has-text("Oui, supprimer")'); await pg.waitForTimeout(1200)
    x = await t()
    v('logo supprime', x.includes('Aucun logo'))
  }
  console.log('errors:', JSON.stringify(errs))
  await b.close()
})()
