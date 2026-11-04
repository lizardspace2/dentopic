// Vérifie que les menus déroulants sont opaques en mode clair ET sombre.
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

  const menuBg = async () => {
    await p.click('text=Calque')
    await sleep(300)
    return p.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find((d) =>
        d.textContent.trim().startsWith('Nouveau calque') && getComputedStyle(d).position === 'absolute')
      return el ? getComputedStyle(el).backgroundColor : null
    })
  }

  // mode clair
  out.lightMenu = await menuBg()
  await p.screenshot({ path: 'menu-light.png' })
  await p.keyboard.press('Escape').catch(() => {})
  await p.click('text=Calque').catch(() => {}) // referme si besoin
  await sleep(200)

  // mode sombre
  await p.evaluate(() => { localStorage.setItem('dentopic.theme', 'dark'); document.documentElement.dataset.theme = 'dark' })
  await sleep(200)
  out.darkMenu = await menuBg()
  await p.screenshot({ path: 'menu-dark.png' })

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs)
  const ok = out.lightMenu?.includes('255, 255, 255') && out.darkMenu && !out.darkMenu.includes('0, 0, 0, 0')
  console.log(ok ? 'ALL PASS' : 'FAIL')
  await b.close()
})()
