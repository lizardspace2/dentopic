const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  for (const t of ['protocol_steps', 'protocols', 'capture_protocols']) {
    const { data, error } = await sb.from(t).select('*').limit(5)
    console.log(t, '→', error ? error.message : `${data.length} lignes : ` + JSON.stringify(data, null, 1).slice(0, 1200))
  }
})()
