const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const ws = '9d943a17-ea75-4636-a3af-1c63d477f161'
  for (const [t, sel] of [['workspace_members','id'],['workspace_members','*'],['social_accounts','id'],['dossiers','id']]) {
    const { count, error } = await sb.from(t).select(sel, { count: 'exact', head: true }).eq('workspace_id', ws)
    console.log(t, sel, '→', count, error?.message || '')
  }
})()
