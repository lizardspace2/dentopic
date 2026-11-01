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
  let res = await fetch(`${url}/rest/v1/social_accounts`, { method: 'POST', headers: h, body: JSON.stringify({ workspace_id: WS, provider: 'instagram', access_token: 'probe-token' }) })
  let body = await res.json()
  console.log('account insert:', res.status, JSON.stringify(body).slice(0, 1500))
  const accId = Array.isArray(body) ? body[0]?.id : body?.id
  if (accId) await fetch(`${url}/rest/v1/social_accounts?id=eq.${accId}`, { method: 'DELETE', headers: h })
})().catch((e) => console.log('ERR', e.message))
