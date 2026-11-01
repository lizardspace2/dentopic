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
  const h = { apikey: key, Authorization: `Bearer ${access_token}` }
  const res = await fetch(`${url}/rest/v1/presentations?select=*&workspace_id=eq.${WS}&limit=2`, { headers: h })
  console.log('presentations:', JSON.stringify(await res.json()).slice(0, 1500))
  const r2 = await fetch(`${url}/rest/v1/presentation_slides?select=*&limit=2`, { headers: h })
  console.log('slides:', JSON.stringify(await r2.json()).slice(0, 1500))
})()
