const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const { data, error } = await sb.from('social_posts').select('*').limit(1)
  console.log('cols:', data?.[0] ? Object.keys(data[0]) : 'aucune ligne', error?.message || '')
  const { data: a } = await sb.from('social_accounts').select('*').limit(1)
  console.log('account cols:', a?.[0] ? Object.keys(a[0]) : 'aucun')
})()
