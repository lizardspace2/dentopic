// Test UI : modes Distorsion + Déformation de la transformation manuelle.
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto('http://localhost:5431/test-studio.html')
  await p.waitForTimeout(1200)

  const out = {}
  await p.locator('text=Fichier').first().click()
  await p.waitForTimeout(300)
  await p.locator('text=Nouveau document').first().click()
  await p.waitForTimeout(400)
  await p.locator('button:has-text("Créer")').last().click()
  await p.waitForTimeout(600)

  // calque avec un carré rouge 20..80
  await p.evaluate(() => {
    const e = window.__editor
    const l = e.addLayer('Test')
    l.ctx.fillStyle = '#ff0000'; l.ctx.fillRect(20, 20, 60, 60)
    e.setActive(l.id)
  })

  const toScreen = (dx, dy) => p.evaluate(([dx, dy]) => {
    const v = window.__view
    const el = document.querySelector('canvas')
    const r = el.getBoundingClientRect()
    return { x: r.left + dx * v.scale + v.ox, y: r.top + dy * v.scale + v.oy }
  }, [dx, dy])

  // ---- Distorsion : Ctrl+T → bouton Distorsion → tirer le coin haut-droit ----
  await p.keyboard.down('Control'); await p.keyboard.press('t'); await p.keyboard.up('Control')
  await p.waitForTimeout(400)
  out.modeBtns = await p.locator('button:has-text("Distorsion")').count()
  await p.locator('button:has-text("Distorsion")').first().click()
  await p.waitForTimeout(300)
  // coin TR du cadre = doc (80,20) — le tirer de (+60px, +30px) écran
  const tr = await toScreen(80, 20)
  await p.mouse.move(tr.x, tr.y); await p.mouse.down()
  await p.mouse.move(tr.x + 60, tr.y + 30, { steps: 8 })
  await p.mouse.up()
  await p.waitForTimeout(300)
  await p.screenshot({ path: 'warp-distort.png' })
  await p.keyboard.press('Enter')
  await p.waitForTimeout(400)
  const res1 = await p.evaluate(() => {
    const e = window.__editor
    const l = e.layers.find((x) => x.name === 'Test')
    const a = (x, y) => l.ctx.getImageData(x, y, 1, 1).data[3]
    const v = window.__view
    return { at100_50: a(100, 50), at25_25: a(25, 25), scale: v.scale }
  })
  out.distortApplied = res1.at100_50 > 10 && res1.at25_25 > 200
  out.res1 = res1

  // ---- Déformation : Ctrl+T → Déformation → tirer le point central ----
  await p.evaluate(() => {
    const e = window.__editor
    const l = e.addLayer('Test2')
    l.ctx.fillStyle = '#00ff00'; l.ctx.fillRect(30, 30, 20, 20)
    e.setActive(l.id)
  })
  await p.keyboard.down('Control'); await p.keyboard.press('t'); await p.keyboard.up('Control')
  await p.waitForTimeout(400)
  await p.locator('button:has-text("Déformation")').first().click()
  await p.waitForTimeout(300)
  // point central du treillis = centre du bbox = doc (40,40)
  const ctr = await toScreen(40, 40)
  await p.mouse.move(ctr.x, ctr.y); await p.mouse.down()
  await p.mouse.move(ctr.x + 25, ctr.y + 25, { steps: 8 })
  await p.mouse.up()
  await p.waitForTimeout(300)
  await p.screenshot({ path: 'warp-mesh.png' })
  await p.keyboard.press('Enter')
  await p.waitForTimeout(400)
  const res2 = await p.evaluate(() => {
    const e = window.__editor
    const l = e.layers.find((x) => x.name === 'Test2')
    const a = (x, y) => l.ctx.getImageData(x, y, 1, 1).data[3]
    return { at54_54: a(54, 54), at31_31: a(31, 31) }
  })
  out.warpApplied = res2.at54_54 > 10
  out.res2 = res2

  // ---- undo global
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control')
  await p.waitForTimeout(400)
  out.undoOk = await p.evaluate(() => {
    const e = window.__editor
    const l = e.layers.find((x) => x.name === 'Test2')
    return l.ctx.getImageData(54, 54, 1, 1).data[3] < 10
  })

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs.slice(0, 6))
  const fails = ['modeBtns', 'distortApplied', 'warpApplied', 'undoOk'].filter((k) => !out[k])
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
