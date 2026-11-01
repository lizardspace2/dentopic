const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const { data: p } = await sb.from('protocols').select('id').limit(1)
  for (const cls of ['extraoral','closeup','shade','video','document','model','stl','scan','bwx','photo']) {
    const { error } = await sb.from('protocol_steps').insert({ protocol_id: p[0].id, position: 99, name: '__t', expected_photo_class: cls })
    console.log(cls.padEnd(10), error ? 'REFUSÉ' : 'ok')
    await sb.from('protocol_steps').delete().eq('name', '__t').eq('position', 99)
  }
})()
