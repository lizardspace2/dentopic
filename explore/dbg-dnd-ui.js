// Test UI du drag & drop dans le panneau Calques.
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto('http://localhost:5431/test-studio.html')
  await p.waitForTimeout(1200)

  const out = {}

  // 1) Nouveau document via le dialogue
  await p.locator('text=Fichier').first().click()
  await p.waitForTimeout(300)
  await p.locator('text=Nouveau document').first().click()
  await p.waitForTimeout(400)
  await p.locator('button:has-text("Créer")').last().click()
  await p.waitForTimeout(600)
  out.docOpen = await p.evaluate(() => window.__editor?.docName != null && window.__editor.w > 0)

  // 2) Ajouter 2 calques + 1 groupe via l'engine, puis bump via un clic œil
  await p.evaluate(() => {
    const e = window.__editor
    e.addLayer('Calque A')
    e.addLayer('Calque B')
    e.addGroup() // 'Groupe 1'
  })
  // bump : cliquer l'œil d'une ligne deux fois (masque+réaffiche) pour re-render
  const bump = async () => {
    await p.evaluate(() => { const e = window.__editor; e.setActive(e.activeId); })
    await p.locator('div[draggable="true"]').first().click()
    await p.waitForTimeout(200)
  }
  await bump()
  out.rowsVisible = await p.locator('div[draggable="true"]').count()

  // helper : simule un DnD src → dst à la fraction verticale q
  const drag = (srcName, dstName, q) => p.evaluate(([srcName, dstName, q]) => {
    const rows = [...document.querySelectorAll('div[draggable="true"]')]
    const pick = (name) => rows.find((r) => {
      const t = r.querySelector('p, span, div')?.textContent
      return r.textContent.includes(name)
    })
    const src = pick(srcName), dst = pick(dstName)
    if (!src || !dst) return 'missing:' + srcName + '/' + dstName
    const dt = new DataTransfer()
    const r = dst.getBoundingClientRect()
    const y = r.top + r.height * q
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY: y, clientX: r.left + 10 }))
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientY: y, clientX: r.left + 10 }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
    return 'ok'
  }, [srcName, dstName, q])

  const tree = () => p.evaluate(() => window.__editor.layers.map((l) =>
    l.name + (l.type === 'group' ? '[' + (l.children || []).map((c) => c.name).join('|') + ']' : '')).join(','))

  out.tree0 = await tree()

  // 3) Glisser « Calque B » dans « Groupe 1 » (zone centrale q=0.5 → 'in')
  out.dragIn = await drag('Calque B', 'Groupe 1', 0.5)
  await p.waitForTimeout(300)
  out.treeIn = await tree()
  out.movedIn = /Groupe 1\[Calque B\]/.test(out.treeIn)

  // 4) Réordonner : glisser « Calque A » sous « Calque 1 » (bas de la ligne q=0.9 → 'down' = before)
  await p.waitForTimeout(200)
  out.dragReorder = await drag('Calque A', 'Calque 1', 0.9)
  await p.waitForTimeout(300)
  out.treeReorder = await tree()
  // 'down' visuel = 'before' dans le tableau : A passe sous Calque 1 (juste après le groupe)
  out.reordered = out.treeReorder === 'Arrière-plan,Groupe 1[Calque B],Calque A,Calque 1'

  // 5) Sortir « Calque B » du groupe : dépôt dans le vide (sous les lignes)
  await p.waitForTimeout(200)
  out.dragOut = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('div[draggable="true"]')]
    const src = rows.find((r) => r.textContent.includes('Calque B'))
    const panel = src?.closest('.css-0')?.parentElement
    if (!src) return 'missing-src'
    const dt = new DataTransfer()
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    // déposer directement sur le conteneur du panneau (vide)
    const cont = src.parentElement.parentElement.parentElement
    const rr = cont.getBoundingClientRect()
    cont.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY: rr.bottom - 60, clientX: rr.left + 30 }))
    cont.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientY: rr.bottom - 60, clientX: rr.left + 30 }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
    return 'ok'
  })
  await p.waitForTimeout(300)
  out.treeOut = await tree()
  out.movedOut = !/\[.*Calque B.*\]/.test(out.treeOut) && /Calque B/.test(out.treeOut)

  // 6) Undo restaure (Ctrl+Z)
  await p.keyboard.press('Control+z')
  await p.waitForTimeout(400)
  out.treeUndo = await tree()

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs.slice(0, 6))
  const fails = ['movedIn', 'reordered', 'movedOut'].filter((k) => !out[k])
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'ALL PASS')
  await b.close()
})()
