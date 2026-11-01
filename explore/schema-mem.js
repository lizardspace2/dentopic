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
  for (const t of ['workspace_members', 'workspace_invites', 'invitations', 'member_invites']) {
    const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=3`, { headers: h })
    console.log('===', t, res.status, (await res.text()).slice(0, 900))
  }
  // insert minimal pour découvrir les colonnes
  let res = await fetch(`${url}/rest/v1/workspace_members`, { method: 'POST', headers: h, body: JSON.stringify({ workspace_id: WS }) })
  console.log('insert vide:', res.status, (await res.text()).slice(0, 400))
})()
