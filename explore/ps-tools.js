// Ouvre un document vide dans Photopea puis inventorie la barre d'outils
// (survol de chaque icône pour capturer le tooltip) et les panneaux.
const { chromium } = require('playwright')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto('https://www.photopea.com/', { waitUntil: 'load' })
  await page.waitForTimeout(6000)
  const btn = page.locator('#ccont > button')
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(15000) }
  await page.screenshot({ path: 'ps-state.png' })

  // debug : quels boutons existent ?
  const btns = await page.locator('button').allTextContents()
  console.log('BOUTONS:', JSON.stringify(btns.filter((t) => t.trim()).slice(0, 40)))

  // Nouveau projet → dialog → créer
  const np = page.locator('button').filter({ hasText: /Nouveau projet|New Project/i }).first()
  if (await np.count()) {
    await np.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'ps-new-dlg.png' })
    const ok = page.locator('button').filter({ hasText: /Créer|Create/i }).last()
    if (await ok.count()) await ok.click()
    await page.waitForTimeout(4000)
  }
  await page.screenshot({ path: 'ps-editor.png' })

  // barre d'outils : chaque .gsicon
  const tools = []
  const icons = await page.locator('.gsicon').all()
  console.log('icons trouvées:', icons.length)
  for (const ic of icons) {
    try {
      await ic.hover({ timeout: 3000 })
      await page.waitForTimeout(1100)
      const tip = await page.evaluate(() => {
        for (const d of document.querySelectorAll('div')) {
          const r = d.getBoundingClientRect()
          const cs = getComputedStyle(d)
          if (r.width > 20 && r.width < 500 && r.height < 80 && d.children.length <= 3 &&
              (cs.position === 'fixed' || cs.position === 'absolute') && d.textContent.trim().length > 2 &&
              d.textContent.trim().length < 200 && parseFloat(cs.zIndex || 0) > 500)
            return d.textContent.trim()
        }
        return null
      })
      tools.push(tip)
    } catch { tools.push(null) }
  }
  fs.writeFileSync('ps-tools.json', JSON.stringify(tools))
  console.log(JSON.stringify(tools))

  const panels = await page.evaluate(() =>
    [...document.querySelectorAll('.panelhead, .phead, .paneltitle')].map((e) => e.textContent.trim()))
  console.log('PANNEAUX:', panels.join(' | '))

  await browser.close()
})()
