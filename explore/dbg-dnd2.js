const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage()
  await p.goto('http://localhost:5431/')
  const r = await p.evaluate(async () => {
    const { Editor } = await import('/src/pages/studio/engine.js')
    const e = new Editor()
    const mk = (w = 32, h = 32) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    e.open(mk(), 'test')
    const names = () => e.layers.map((l) => l.name + (l.type === 'group' ? '[' + (l.children || []).map((c) => c.name).join('|') + ']' : '')).join(',')
    const a = e.addLayer('A')
    const bL = e.addLayer('B')
    const g = e.addGroup()
    const top = e.addLayer('Top')
    const log = [names()]
    log.push('canMove after: ' + e.canMove(top.id, a.id, 'after'))
    log.push('moveInto: ' + e.moveInto(top.id, a.id, 'after') + ' → ' + names())
    log.push('into g: ' + e.moveInto(top.id, g.id, 'inside') + ' → ' + names())
    return log
  })
  console.log(r.join('\n'))
  await b.close()
})()
