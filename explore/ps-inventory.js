// Inventaire de l'UI de Photopea (référence Photoshop dans le navigateur).
// Ouvre l'app, puis chaque menu, et dump le texte des items visibles.
const { chromium } = require('playwright')

const OUT = require('fs')

async function visibleTexts(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('body > *')]
    const seen = new Set(), out = []
    const walk = (el) => {
      if (!(el instanceof Element)) return
      const r = el.getBoundingClientRect()
      if (r.width && r.height && r.top < innerHeight) {
        const kids = el.childNodes
        if (el.children.length === 0) {
          const t = (el.textContent || '').trim()
          if (t && t.length < 80 && !seen.has(t)) { seen.add(t); out.push(t) }
        } else kids.forEach(walk)
      }
    }
    // les menus Photopea sont des divs positionnés absolument contenant des items
    document.querySelectorAll('div').forEach((d) => {
      const r = d.getBoundingClientRect()
      if (r.width > 100 && r.height > 50 && r.width < 500 && d.children.length > 1) {
        const texts = [...d.children].map((c) => (c.textContent || '').trim()).filter((t) => t && t.length < 60)
        if (texts.length > 2) out.push('MENU> ' + texts.join(' | '))
      }
    })
    return out
  })
}

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto('https://www.photopea.com/', { waitUntil: 'load' })
  await page.waitForTimeout(6000)
  const btn = page.locator('#ccont > button')
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(15000) }

  await page.screenshot({ path: 'ps-app.png' })

  // noms des menus du topbar
  const menus = await page.locator('.topbar span:nth-of-type(1) button').allTextContents()
  console.log('MENUS:', menus.join(', '))

  const report = {}
  for (const name of menus) {
    try {
      await page.locator(`.topbar span:nth-of-type(1) button:has-text("${name}")`).first().click()
      await page.waitForTimeout(600)
      report[name] = await visibleTexts(page)
      await page.screenshot({ path: `ps-menu-${name.toLowerCase()}.png` })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    } catch (e) { report[name] = ['ERR ' + e.message] }
  }

  // barre d'outils : survol de chaque outil pour le tooltip
  const tools = []
  const icons = await page.locator('.toolbar .gsicon, .tools .gsicon').all()
  for (const ic of icons.slice(0, 60)) {
    try {
      await ic.hover()
      await page.waitForTimeout(350)
      const tip = await page.evaluate(() => {
        const t = [...document.querySelectorAll('div')].find((d) => {
          const r = d.getBoundingClientRect()
          return r.width < 400 && d.textContent && d.children.length <= 2 && /[\w]/.test(d.textContent) && getComputedStyle(d).position !== 'static' && getComputedStyle(d).zIndex > 100
        })
        return t ? t.textContent.trim() : null
      })
      tools.push(tip)
    } catch { tools.push(null) }
  }
  console.log('TOOLS:', tools.join(', '))

  OUT.writeFileSync('ps-report.json', JSON.stringify({ menus, report, tools }, null, 2))
  console.log('done')
  await browser.close()
})()
