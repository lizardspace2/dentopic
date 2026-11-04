// Vérifie le rendu de la page Publication (hors auth — wsId null → état vide,
// mais calendrier/filtre/événements/navigation doivent fonctionner).
const { chromium } = require('playwright-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const out = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto('http://localhost:5431/test-pub.html')
  await sleep(1000)

  // 1) semaine réelle : le titre affiche « Semaine du … » avec le mois courant
  out.title = await p.locator('text=/Semaine du/').textContent().catch(() => null)

  // 2) 7 en-têtes de jour + colonne FILE
  out.dayHeaders = await p.locator('text=/^(LUN|MAR|MER|JEU|VEN|SAM|DIM) \\d+$/').count()
  out.fileCol = await p.locator('text=FILE').count()

  // 3) navigation : clic → → le titre change ; Aujourd'hui revient
  const t0 = await p.locator('text=/Semaine du/').textContent()
  await p.click('[aria-label="Période suivante"]')
  await sleep(200)
  const t1 = await p.locator('text=/Semaine du/').textContent()
  out.navChangesTitle = t0 !== t1
  await p.click('text=Aujourd\'hui')
  await sleep(200)
  const t2 = await p.locator('text=/Semaine du/').textContent()
  out.todayBack = t0 === t2

  // 4) filtre par type
  await p.selectOption('select[aria-label="Filtrer par type de contenu"]', 'story')
  out.filterSet = true

  // 5) événements réels calculés
  out.events = await p.locator('text=/Journée mondiale|Journée internationale/').count()

  // 6) vue mois
  await p.click('text=Calendrier')
  await sleep(300)
  out.monthTitle = await p.locator('text=/\\d{4}/').first().textContent().catch(() => null)
  await p.screenshot({ path: 'pub-month.png' })
  await p.click('text=Semaine')
  await sleep(300)
  await p.screenshot({ path: 'pub-week.png' })

  // 7) clic « + » sur un jour → modal brouillon avec date pré-remplie
  await p.click('[aria-label^="Créer le"] >> nth=3')
  await sleep(400)
  out.draftModal = await p.locator('text=Préparer un brouillon').count()
  out.prefilled = await p.locator('input[type="datetime-local"]').inputValue().catch(() => '')

  console.log(JSON.stringify(out, null, 1))
  console.log('errors:', errs)
  const pass = out.title?.startsWith('Semaine du') && out.dayHeaders === 7 && out.fileCol && out.navChangesTitle && out.todayBack && out.events >= 3 && out.monthTitle && out.draftModal >= 1 && /^\d{4}-\d{2}-\d{2}T09:00$/.test(out.prefilled)
  console.log(pass && !errs.length ? 'ALL PASS' : 'FAIL')
  await b.close()
})()
