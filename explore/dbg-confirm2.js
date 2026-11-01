const { chromium } = require('playwright')
const url = 'https://rgpoojpvhbxlabzdxfff.supabase.co'
const key = process.env.SUPA_KEY
const WS = '9d943a17-ea75-4636-a3af-1c63d477f161'
;(async () => {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email: process.env.DP_USER, password: process.env.DP_PASS }),
  })
  const { access_token } = await r.json()
  const h = { apikey: key, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  const photos = await (await fetch(`${url}/rest/v1/patient_photos?select=id&workspace_id=eq.${WS}&limit=1`, { headers: h })).json()
  const post = await (await fetch(`${url}/rest/v1/social_posts`, { method: 'POST', headers: h, body: JSON.stringify({ workspace_id: WS, photo_id: photos[0].id, caption: 'Brouillon confirm-test', kind: 'publication' }) })).json()
  console.log('post créé:', post[0]?.id)

  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errs = []
  pg.on('pageerror', (e) => errs.push(e.message))
  await pg.goto('http://localhost:5175/login')
  await pg.fill('input[type="email"]', process.env.DP_USER); await pg.fill('input[type="password"]', process.env.DP_PASS)
  await pg.click('button[type="submit"]'); await pg.waitForTimeout(3000)
  const t = () => pg.evaluate(() => document.body.innerText)
  await pg.goto('http://localhost:5175/publication'); await pg.waitForTimeout(2500)
  await pg.click('text=Brouillons'); await pg.waitForTimeout(800)
  console.log('brouillon listé?', (await t()).includes('confirm-test'))
  await pg.locator('[aria-label="Supprimer le brouillon"]').first().click(); await pg.waitForTimeout(500)
  console.log('popup Non/Oui?', (await t()).includes('Voulez-vous vraiment supprimer'))
  await pg.screenshot({ path: 'shots/confirm-post.png' })
  await pg.click('button:has-text("Non")'); await pg.waitForTimeout(400)
  console.log('toujours là après Non?', (await t()).includes('confirm-test'))
  await pg.locator('[aria-label="Supprimer le brouillon"]').first().click(); await pg.waitForTimeout(500)
  await pg.click('button:has-text("Oui, supprimer")'); await pg.waitForTimeout(1500)
  console.log('supprimé après Oui?', !(await t()).includes('confirm-test'))
  console.log('errors:', errs.filter((e) => !e.includes('favicon')))
  await b.close()
})()
