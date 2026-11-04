const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const { data } = await sb.from('capture_sessions').select('*').limit(1)
  console.log('capture_sessions cols:', data?.[0] ? Object.keys(data[0]) : 'aucune')
})()
