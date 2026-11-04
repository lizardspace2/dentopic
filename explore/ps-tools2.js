const { chromium } = require('playwright')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto('https://www.photopea.com/', { waitUntil: 'load' })
  await page.waitForTimeout(6000)
  const btn = page.locator('#ccont > button')
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(15000) }

  // Nouveau projet → Créer
  const np = page.locator('text=/Nouveau projet|New Project/i').first()
  console.log('np count:', await np.count())
  await np.click()
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'ps-new-dlg.png' })
  const ok = page.locator('text=/^Créer$|^Create$/').last()
  console.log('ok count:', await ok.count())
  if (await ok.count()) await ok.click()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'ps-editor.png' })

  // survol des icônes → dump tous les divs récemment apparus (tooltip)
  const tools = []
  const icons = await page.locator('.gsicon').all()
  console.log('icons:', icons.length)
  for (const ic of icons) {
    try {
      const before = await page.evaluate(() => document.body.innerHTML.length)
      await ic.hover({ timeout: 3000 })
      await page.waitForTimeout(1400)
      const tip = await page.evaluate((len0) => {
        // cherche un élément avec un fond/color distinct contenant un court texte
        const cands = []
        for (const d of document.querySelectorAll('div,span')) {
          const r = d.getBoundingClientRect()
          const cs = getComputedStyle(d)
          const t = (d.textContent || '').trim()
          if (!t || t.length < 3 || t.length > 120) continue
          if (r.width < 15 || r.height < 10) continue
          if (d.children.length > 2) continue
          if (cs.position === 'fixed' || cs.position === 'absolute' || cs.pointerEvents === 'none')
            cands.push({ t, zi: +cs.zIndex || 0, x: r.x, y: r.y, op: +cs.opacity })
        }
        return cands
      })
      tools.push(tip.map((c) => c.t))
    } catch { tools.push(['ERR']) }
  }
  fs.writeFileSync('ps-tools.json', JSON.stringify(tools, null, 1))
  console.log(JSON.stringify(tools))
  await browser.close()
})()
