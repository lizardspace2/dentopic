const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const ws = '9d943a17-ea75-4636-a3af-1c63d477f161'
  for (const p of ['telegram','vimeo','twitch','reddit','discord','tumblr','wechat','line','vk','whatsapp_channel']) {
    const { error } = await sb.from('social_accounts').insert({
      workspace_id: ws, provider: p, handle: '__t',
      access_token: 'pending:' + crypto.randomUUID(), meta: { pending_oauth: true },
    })
    console.log(p.padEnd(18), error ? 'REFUSÉ' : 'ok')
    await sb.from('social_accounts').delete().eq('handle', '__t')
  }
})()
