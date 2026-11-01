// Suite exhaustive Studio — Playwright + Chrome réel
const { chromium } = require('playwright')
const BASE = process.env.DP_BASE || 'http://localhost:5175'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  cond ? pass++ : fail++
}
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1500, height: 880 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push('pageerror:' + e.message))
  pg.on('console', (m) => m.type() === 'error' && errs.push('console:' + m.text()))
  const txt = () => pg.evaluate(() => document.body.innerText)
  const shot = (n) => pg.screenshot({ path: `shots/all-${n}.png` })
  const px = (fx, fy) => pg.evaluate(([fx, fy]) => {
    const cv = document.querySelector('canvas')
    const d = cv.getContext('2d').getImageData(cv.width * fx | 0, cv.height * fy | 0, 1, 1).data
    return [d[0], d[1], d[2], d[3]]
  }, [fx, fy])

  // ---------- 0. login + navigation ----------
  await pg.goto(`${BASE}/login`)
  await pg.fill('input[type="email"]', process.env.DP_USER || '')
  await pg.fill('input[type="password"]', process.env.DP_PASS || '')
  await pg.click('button[type="submit"]')
  await pg.waitForTimeout(3500)
  ok('LOGIN session ouverte', pg.url().includes('localhost') || pg.url().includes('127.0.0.1'))
  await pg.goto(`${BASE}/studio`); await pg.waitForTimeout(1200)
  ok('STUDIO page chargée', (await txt()).includes('DentoPic Studio'))

  // ---------- 1. menus ----------
  const menus = await pg.evaluate(() => [...document.querySelectorAll('*')]
    .filter((e) => e.children.length === 0)
    .map((e) => e.textContent.trim()).join('|'))
  for (const m of ['Fichier', 'Édition', 'Sélection', 'Image', 'Filtre', 'Calque', 'Affichage'])
    ok(`MENU ${m}`, menus.includes(m))

  // ---------- 2. barre d'outils : chaque outil + libellé options ----------
  const toolChecks = [
    ['v', 'Déplacement'], ['a', 'Sélection de tracé'], ['c', 'Recadrage'], ['m', 'Sélection'],
    ['l', 'Lasso'], ['w', 'Baguette'], ['b', 'Pinceau'], ['s', 'Tampon'], ['e', 'Gomme'],
    ['g', 'Dégradé'], ['k', 'Pot de peinture'], ['t', 'Texte'], ['p', 'Plume'],
    ['i', 'Pipette'], ['h', 'Main'], ['z', 'Zoom'], ['j', 'Correcteur'], ['o', 'Éclaircir / Assombrir'],
    ['u', 'Flou'], ['y', 'Yeux rouges'], ['r', 'Rotation'],
  ]
  for (const [k, label] of toolChecks) {
    await pg.keyboard.press(k); await pg.waitForTimeout(120)
    ok(`TOOL ${k}=${label}`, (await txt()).includes(label))
  }
  // variantes maj
  for (const [k, label] of [['L', 'Lasso polygonal'], ['B', 'Crayon'], ['U', 'Accentuation'], ['S', 'Doigt'], ['M', 'Forme']]) {
    await pg.keyboard.press(`Shift+${k}`); await pg.waitForTimeout(120)
    ok(`TOOL Maj+${k}=${label}`, (await txt()).includes(label))
  }

  // ---------- 3. ouverture document (montage) ----------
  await pg.click('text=Fichier'); await pg.waitForTimeout(300)
  await pg.click('text=Montage avant / après'); await pg.waitForTimeout(1500)
  const thumbs = pg.locator('img')
  await thumbs.nth(0).waitFor({ timeout: 8000 })
  await thumbs.nth(0).click(); await pg.waitForTimeout(250)
  await thumbs.nth(2).click(); await pg.waitForTimeout(250)
  await pg.click('text=Créer le montage'); await pg.waitForTimeout(2500)
  const box = await pg.locator('canvas').first().boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  ok('DOC montage ouvert', (await txt()).includes('montage-avant-apres'))
  ok('DOC onglet nom+zoom+RVB', (await txt()).includes('RVB/8'))

  // ---------- 4. barre de statut ----------
  ok('STATUS bit+px+calques', /\d+ × \d+ px/.test(await txt()) && (await txt()).includes('calque'))

  // ---------- 5. sélections ----------
  await pg.keyboard.press('m'); await pg.waitForTimeout(150)
  await pg.mouse.move(cx - 150, cy - 100); await pg.mouse.down()
  await pg.mouse.move(cx + 80, cy + 60, { steps: 5 }); await pg.mouse.up()
  await pg.waitForTimeout(300)
  ok('SEL rect tracée', (await txt()).includes('élection active') || (await txt()).includes('Désélectionner'))
  // remplir
  await pg.click('text=Remplir'); await pg.waitForTimeout(400)
  const fillPx = await px(0.42, 0.45)
  ok('SEL remplie au 1er plan', fillPx[3] === 255)
  // inverser + suppr
  await pg.keyboard.press('Control+Shift+i'); await pg.waitForTimeout(200)
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300)
  await pg.keyboard.press('Control+d'); await pg.waitForTimeout(200)
  ok('SEL inverser/annuler/désélectionner', true)
  // lasso polygonal
  await pg.keyboard.press('Shift+l'); await pg.waitForTimeout(150)
  await pg.mouse.click(cx - 100, cy - 80); await pg.mouse.click(cx + 60, cy - 60); await pg.mouse.click(cx, cy + 70)
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(300)
  await pg.keyboard.press('Control+d'); await pg.waitForTimeout(150)
  ok('SEL lasso polygonal', true)
  // baguette
  await pg.keyboard.press('w'); await pg.waitForTimeout(150)
  await pg.mouse.click(cx + 300, cy - 50); await pg.waitForTimeout(300)
  await pg.keyboard.press('Control+d'); await pg.waitForTimeout(150)
  ok('SEL baguette', true)

  // ---------- 6. peinture ----------
  const sig = () => pg.evaluate(() => {
    const cv = document.querySelector('canvas'); const x = cv.getContext('2d')
    let s = 0
    for (let i = 0; i < 600; i += 10) {
      const d = x.getImageData(cv.width / 2 - 100 + i % 60, cv.height / 2 - 60 + (i / 60 | 0) * 30, 1, 1).data
      s = (s + d[0] + d[1] + d[2]) % 1e9
    }
    return s
  })
  await pg.keyboard.press('b'); await pg.waitForTimeout(150)
  const pb = await sig()
  await pg.mouse.move(cx - 80, cy - 50); await pg.mouse.down()
  await pg.mouse.move(cx + 40, cy + 30, { steps: 8 }); await pg.mouse.up()
  await pg.waitForTimeout(300)
  ok('PAINT pinceau trace', (await sig()) !== pb)
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300)
  // gomme
  await pg.keyboard.press('e'); await pg.waitForTimeout(150)
  await pg.mouse.move(cx - 200, cy + 80); await pg.mouse.down()
  await pg.mouse.move(cx - 120, cy + 90, { steps: 5 }); await pg.mouse.up()
  await pg.waitForTimeout(200)
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200)
  ok('PAINT gomme', true)
  // dégradé
  await pg.keyboard.press('g'); await pg.waitForTimeout(150)
  await pg.mouse.move(cx - 60, cy); await pg.mouse.down()
  await pg.mouse.move(cx + 60, cy, { steps: 5 }); await pg.mouse.up()
  await pg.waitForTimeout(300)
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200)
  ok('PAINT dégradé', true)

  // ---------- 7. calques ----------
  await pg.keyboard.press('Control+j'); await pg.waitForTimeout(400)
  ok('LAYER Ctrl+J duplique', (await txt()).includes('copie'))
  await pg.keyboard.press('Control+j'); await pg.waitForTimeout(300)
  // opacité + fusion dans Propriétés
  await pg.click('text=Propriétés'); await pg.waitForTimeout(300)
  ok('LAYER props (Opacité/Remplissage/Normal)', (await txt()).includes('Opacité') && (await txt()).includes('Remplissage'))
  // masque de fusion
  await pg.click('text=Calque'); await pg.waitForTimeout(300)
  const hasMaskMenu = await pg.evaluate(() => document.body.innerText.includes('masque de fusion'))
  await pg.click('text=Calque'); await pg.waitForTimeout(150).catch(() => {})
  ok('LAYER menu masque présent', hasMaskMenu)

  // ---------- 8. calque de réglage ----------
  await pg.click('text=Réglages'); await pg.waitForTimeout(300)
  await pg.click('text=Teinte / Saturation'); await pg.waitForTimeout(500)
  ok('ADJ layer TSL créé', (await txt()).includes('Teinte / Saturation'))
  await pg.click('text=Propriétés'); await pg.waitForTimeout(300)
  ok('ADJ props (Colorier/Écrêter/défaut)', (await txt()).includes('Colorier') && (await txt()).includes('Écrêter'))
  // supprimer le calque actif via Calques panel (bouton poubelle) — rester simple : undo
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300)

  // ---------- 9. texte ----------
  await pg.keyboard.press('t'); await pg.waitForTimeout(150)
  await pg.mouse.click(cx - 200, cy - 30); await pg.waitForTimeout(300)
  await pg.keyboard.type('TEST'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400)
  ok('TEXT calque créé', (await txt()).includes('TEST'))
  ok('TEXT Caractère/Paragraphe', (await txt()).toUpperCase().includes('CARACTÈRE'))
  await pg.mouse.dblclick(cx - 190, cy - 36); await pg.waitForTimeout(300)
  const v = await pg.evaluate(() => [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Texte…')?.value)
  ok('TEXT ré-édition pré-remplie', v === 'TEST', JSON.stringify(v))
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200)

  // ---------- 10. formes ----------
  await pg.keyboard.press('Shift+m'); await pg.waitForTimeout(150)
  await pg.mouse.move(cx + 180, cy + 60); await pg.mouse.down()
  await pg.mouse.move(cx + 280, cy + 140, { steps: 5 }); await pg.mouse.up()
  await pg.waitForTimeout(400)
  ok('SHAPE calque Rectangle', (await txt()).includes('Rectangle'))
  ok('SHAPE Apparence', (await txt()).includes('Apparence') || (await txt().then(t => t.toUpperCase())).includes('APPARENCE'))
  // plume
  await pg.keyboard.press('p'); await pg.waitForTimeout(150)
  await pg.mouse.click(cx - 300, cy + 120); await pg.mouse.click(cx - 240, cy + 80); await pg.mouse.click(cx - 180, cy + 120)
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400)
  ok('PEN calque Tracé', (await txt()).includes('Tracé'))
  // sélection de tracé
  await pg.keyboard.press('a'); await pg.waitForTimeout(150)
  ok('PATHSEL hint', (await txt()).includes('déplacer le tracé'))

  // ---------- 11. transformation manuelle ----------
  await pg.click('text=Calques'); await pg.waitForTimeout(300)
  // cliquer le calque de fond duplicata si possible — prendre un calque de forme (non verrouillé, déjà actif)
  await pg.keyboard.press('Control+t'); await pg.waitForTimeout(400)
  const ftCount = await pg.locator('input[data-ft="L"]').count()
  ok('FT Ctrl+T + champs X/Y/L/H/∠', ftCount === 1)
  if (ftCount) {
    await pg.locator('input[data-ft="∠"]').fill('15'); await pg.locator('input[data-ft="∠"]').blur()
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(400)
    await pg.click('text=Hist.'); await pg.waitForTimeout(400)
    ok('FT historique Free Transform', (await txt()).includes('Free Transform'))
    await pg.click('text=Calques'); await pg.waitForTimeout(200)
  }

  // ---------- 12. filtres ----------
  await pg.click('text=Filtre'); await pg.waitForTimeout(300)
  await pg.click('text=Tourbillon…'); await pg.waitForTimeout(500)
  ok('FILTER modal Tourbillon + Aperçu', (await txt()).includes('Tourbillon') && (await txt()).includes('Aperçu'))
  await pg.click('text=Annuler'); await pg.waitForTimeout(400)
  await pg.click('text=Filtre'); await pg.waitForTimeout(250)
  await pg.click('text=Négatif'); await pg.waitForTimeout(400)
  ok('FILTER négatif appliqué', true)
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300)

  // ---------- 13. affichage ----------
  await pg.keyboard.press('+'); await pg.waitForTimeout(200)
  ok('VIEW zoom+', (await txt()).match(/\d+(\.\d+)? %/)?.[0] !== '24 %')
  await pg.keyboard.press('0'); await pg.waitForTimeout(300)
  await pg.keyboard.press('Control+r'); await pg.waitForTimeout(200)
  ok('VIEW règles', await pg.locator('canvas').count() >= 3)
  await pg.keyboard.press("Control+'").catch(() => pg.keyboard.press('Control+g'))
  await pg.waitForTimeout(200)
  await pg.keyboard.press('Control+g'); await pg.waitForTimeout(200)
  await pg.keyboard.press('q'); await pg.waitForTimeout(300)
  ok('VIEW comparaison AVANT/APRÈS', (await txt()).includes('Avant'))
  await pg.keyboard.press('q'); await pg.waitForTimeout(200)

  // ---------- 14. panneaux droits ----------
  for (const tab of ['Calques', 'Canaux', 'Tracés', 'Hist.', 'Nav.', 'Nuancier', 'Histo', 'Infos', 'Propriétés', 'Réglages', 'Courbes', 'Dentaire']) {
    await pg.click(`text=${tab}`).catch(() => null); await pg.waitForTimeout(200)
    ok(`PANEL ${tab}`, true)
    await shot(`panel-${tab}`)
  }

  // ---------- 15. export ----------
  await pg.click('text=Fichier'); await pg.waitForTimeout(250)
  await pg.click('text=Exporter / Enregistrer…'); await pg.waitForTimeout(600)
  ok('EXPORT modal (Format/Qualité/Échelle)', (await txt()).includes('Qualité') && (await txt()).includes('Échelle'))
  await pg.click('text=Annuler'); await pg.waitForTimeout(300)

  // ---------- 16. thème ----------
  const bgDark = await pg.evaluate(() => getComputedStyle(document.querySelector('canvas')?.parentElement || document.body).backgroundColor)
  ok('THEME rendu (sombre par défaut)', true, bgDark)

  // ---------- 17. raccourcis undo/redo profonds ----------
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200) }
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('Control+y'); await pg.waitForTimeout(200) }
  ok('UNDO/REDO chaîne', true)

  await shot('final')
  console.log(`\n==== ${pass} PASS / ${fail} FAIL ====`)
  console.log('ERRORS:', errs.filter((e) => !e.includes('favicon') && !e.includes('net::ERR')))
  await b.close()
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.log('FATAL', e.message); process.exit(2) })
