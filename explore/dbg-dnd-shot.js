const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
  await p.goto('http://localhost:5431/test-studio.html')
  await p.waitForTimeout(1200)
  await p.locator('text=Fichier').first().click()
  await p.waitForTimeout(300)
  await p.locator('text=Nouveau document').first().click()
  await p.waitForTimeout(400)
  await p.locator('button:has-text("Créer")').last().click()
  await p.waitForTimeout(600)
  await p.evaluate(() => {
    const e = window.__editor
    e.addLayer('Calque A')
    e.addLayer('Calque B')
    e.addGroup()
  })
  await p.locator('div[draggable="true"]').first().click()
  await p.waitForTimeout(300)
  // dragstart + dragover centre du groupe → hint 'in' (surbrillance bleue)
  await p.evaluate(() => {
    const rows = [...document.querySelectorAll('div[draggable="true"]')]
    const src = rows.find((r) => r.textContent.includes('Calque B'))
    const dst = rows.find((r) => r.textContent.includes('Groupe 1'))
    const dt = new DataTransfer()
    const r = dst.getBoundingClientRect()
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY: r.top + r.height / 2, clientX: r.left + 10 }))
    window.__dt = dt
  })
  await p.waitForTimeout(300)
  await p.screenshot({ path: 'dnd-hint-in.png' })
  // dragover bord haut de Calque 1 → ligne de dépôt
  await p.evaluate(() => {
    const rows = [...document.querySelectorAll('div[draggable="true"]')]
    const dst = rows.find((r) => r.textContent.includes('Calque 1'))
    const r = dst.getBoundingClientRect()
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: window.__dt, clientY: r.top + 2, clientX: r.left + 10 }))
  })
  await p.waitForTimeout(300)
  await p.screenshot({ path: 'dnd-hint-line.png' })
  await b.close()
})()
