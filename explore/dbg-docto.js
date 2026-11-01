const { createClient } = require('@supabase/supabase-js')
const { chromium } = require('playwright')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const ws = '9d943a17-ea75-4636-a3af-1c63d477f161'
  const { error } = await sb.from('social_accounts').insert({
    workspace_id: ws, provider: 'doctolib', handle: 'dbg',
    access_token: 'pending:' + crypto.randomUUID(), meta: { pending_oauth: true },
  })
  console.log('insert doctolib direct:', error ? error.message : 'OK')
  await sb.from('social_accounts').delete().eq('handle', 'dbg')

  // UI debug : état du modal après clic
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const pg = await (await b.newContext()).newPage()
  pg.on('console', (m) => { if (m.type() === 'error' || m.text().includes('warn')) console.log('[console]', m.text().slice(0, 200)) })
  await pg.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  if (await pg.locator('input[type="email"]').count()) {
    await pg.fill('input[type="email"]', process.env.DP_USER)
    await pg.fill('input[type="password"]', process.env.DP_PASS)
    await pg.click('button[type="submit"]'); await pg.waitForTimeout(4000)
  }
  await pg.goto('http://localhost:5175/reglage/reseaux', { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2500)
  await pg.click('button:has-text("Connecter un réseau")'); await pg.waitForTimeout(600)
  await pg.click('[aria-label="Choisir Doctolib"]')
  await pg.fill('input[placeholder="@votre.cabinet"]', 'cabinet-docto-e2e')
  const btns = await pg.locator('button:has-text("Connecter")').all()
  console.log('nb boutons Connecter:', btns.length)
  for (let i = 0; i < btns.length; i++) {
    console.log(' btn', i, 'disabled:', await btns[i].isDisabled(), 'text:', (await btns[i].innerText()).trim())
  }
  await btns[btns.length - 1].click(); await pg.waitForTimeout(2500)
  const x = await pg.evaluate(() => document.body.innerText)
  console.log('modal encore ouvert?', x.includes('Connecter un réseau social'))
  console.log('compte visible?', x.includes('@cabinet-docto-e2e'))
  await pg.screenshot({ path: 'shots/dbg-docto.png' })
  await b.close()
})()
