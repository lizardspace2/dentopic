const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const { data: ws, error } = await sb.from('workspaces').select('*')
  console.log('workspaces:', error?.message || JSON.stringify(ws, null, 1).slice(0, 1500))
  // tentative d'insert metadata pour tester la colonne
  if (ws?.[0]) {
    const { error: e2 } = await sb.from('workspaces').update({ brand: { test: 1 } }).eq('id', ws[0].id)
    console.log('update brand col:', e2 ? e2.message : 'OK')
    const { error: e3 } = await sb.from('workspaces').update({ metadata: { test: 1 } }).eq('id', ws[0].id)
    console.log('update metadata col:', e3 ? e3.message : 'OK')
  }
})()
