const url = 'https://rgpoojpvhbxlabzdxfff.supabase.co'
const key = process.env.SUPA_KEY
;(async () => {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ email: process.env.DP_USER, password: process.env.DP_PASS }),
  })
  const { access_token } = await r.json()
  const h = { apikey: key, Authorization: `Bearer ${access_token}` }
  const res = await fetch(`${url}/rest/v1/presentations?select=id,name,deleted_at,share_enabled,status&name=ilike.*E2E*`, { headers: h })
  console.log(JSON.stringify(await res.json(), null, 1))
})()
