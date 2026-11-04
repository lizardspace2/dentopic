// Test : export PDF planche clinique — téléchargement + structure valide.
const { chromium } = require('playwright-core')
const fs = require('fs')
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

  await p.click('text=Nouveau document…')
  await sleep(300)
  await p.locator('select').nth(1).selectOption('#ffffff')
  await p.click('button:has-text("Créer")')
  await sleep(400)
  await p.evaluate(() => {
    const l = window.__editor.active
    l.ctx.fillStyle = '#ff0000'
    l.ctx.fillRect(400, 300, 500, 300)
    window.__editor.markDirty()
  })

  // Fichier → Exporter / Enregistrer… → bouton PDF
  const dl = p.waitForEvent('download', { timeout: 15000 })
  await p.click('text=Fichier')
  await sleep(250)
  await p.click('text=Exporter / Enregistrer…')
  await sleep(500)
  await p.click('button:has-text("PDF")')
  const download = await dl
  const path = await download.path()
  const buf = fs.readFileSync(path)
  fs.writeFileSync('planche-test.pdf', buf)
  const head = buf.slice(0, 8).toString()
  const tail = buf.slice(-40).toString()
  const str = buf.toString('latin1')
  out.magic = head.startsWith('%PDF-1.4')
  out.hasFonts = str.includes('/BaseFont /Helvetica-Bold') && str.includes('/Font')
  out.hasImage = str.includes('/DCTDecode')
  out.hasText = str.includes('DentoPic')
  out.eof = tail.includes('%%EOF')
  out.xref = str.includes('startxref')
  out.sizeKb = Math.round(buf.length / 1024)

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs)
  const fails = Object.entries(out).filter(([k, v]) => k !== 'sizeKb' && !v).map(([k]) => k)
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
