const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  await sb.auth.signInWithPassword({ email: process.env.DP_USER, password: process.env.DP_PASS })
  const { data: ws } = await sb.from('workspaces').select('id,name,plan,storage_limit_bytes,subscription_status,plan_period_end,plan_interval').limit(1)
  console.log('workspace:', JSON.stringify(ws))
  for (const t of ['workspace_plans', 'plans']) {
    const { data, error } = await sb.from(t).select('*').limit(10)
    console.log(t, '→', error ? error.message : JSON.stringify(data).slice(0, 1200))
  }
  // usage réel
  const { data: photos } = await sb.from('patient_photos').select('bytes,mime,source').eq('workspace_id', ws[0].id)
  console.log('photos:', photos.length, 'total bytes:', photos.reduce((a, p) => a + (p.bytes || 0), 0))
  console.log('par mime:', JSON.stringify(photos.reduce((m, p) => { const k = p.mime || '?'; m[k] = (m[k] || 0) + (p.bytes || 0); return m }, {})))
  const { data: vids } = await sb.from('video_projects').select('*').eq('workspace_id', ws[0].id).limit(3)
  console.log('video_projects cols:', vids?.[0] ? Object.keys(vids[0]) : 'aucune')
})()
