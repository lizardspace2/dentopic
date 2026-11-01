const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const { data } = await sb.from('workspaces').select('plan').eq('id', '9d943a17-ea75-4636-a3af-1c63d477f161').single()
  console.log('plan actuel en DB:', data.plan)
})()
