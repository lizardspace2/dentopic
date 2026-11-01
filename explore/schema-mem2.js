const url = 'https://rgpoojpvhbxlabzdxfff.supabase.co'
const key = process.env.SUPA_KEY
const WS = '9d943a17-ea75-4636-a3af-1c63d477f161'
;(async () => {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email: process.env.DP_USER, password: process.env.DP_PASS }),
  })
  const { access_token } = await r.json()
  const h = { apikey: key, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  // join profiles ?
  const res = await fetch(`${url}/rest/v1/workspace_members?select=*,profile:profiles(id,full_name,profession,avatar_url)&limit=5`, { headers: h })
  console.log('join:', JSON.stringify(await res.json()).slice(0, 900))
  // RLS : insérer un membre avec un autre user_id ?
  const res2 = await fetch(`${url}/rest/v1/workspace_members`, { method: 'POST', headers: h, body: JSON.stringify({ workspace_id: WS, user_id: '11111111-1111-1111-1111-111111111111', role: 'member' }) })
  console.log('insert fake:', res2.status, (await res2.text()).slice(0, 300))
})()
