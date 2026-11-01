const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const ws = '9d943a17-ea75-4636-a3af-1c63d477f161'
  const { error } = await sb.from('social_accounts').insert({
    workspace_id: ws, provider: 'youtube', handle: '__test',
    access_token: 'pending:' + crypto.randomUUID(), meta: { pending_oauth: true },
  })
  console.log('insert youtube:', error ? error.message : 'OK')
  await sb.from('social_accounts').delete().eq('handle', '__test')
})()
