const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rgpoojpvhbxlabzdxfff.supabase.co', process.env.SB_ANON)
;(async () => {
  for (const t of ['workspace_brand', 'brand_settings', 'branding', 'workspace_settings', 'workspaces']) {
    const { data, error } = await sb.from(t).select('*').limit(1)
    console.log(t, '→', error ? error.message : JSON.stringify(data))
  }
  // colonnes workspaces
  const { data: ws } = await sb.from('workspaces').select('*').limit(1)
  if (ws) console.log('workspaces cols:', ws[0] ? Object.keys(ws[0]) : 'vide')
})()
