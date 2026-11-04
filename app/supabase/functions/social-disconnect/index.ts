// social-disconnect — POST { account_id }
// Supprime la connexion d'un compte social (membre du workspace requis).
// La révocation côté Meta est best-effort (les tokens expirent aussi seuls).
import { preflight, json, requireMember, admin } from '../_shared/social.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  try {
    const { account_id } = await req.json()
    if (!account_id) return json({ error: 'account_id requis' }, 400)

    const sb = admin()
    const { data: acc } = await sb
      .from('social_accounts').select('id,workspace_id,meta').eq('id', account_id).maybeSingle()
    if (!acc) return json({ error: 'compte introuvable' }, 404)

    const user = await requireMember(req, acc.workspace_id)
    if (!user) return json({ error: 'non autorisé' }, 401)

    // Best-effort : révoque la permission côté Meta (ne bloque pas la suite).
    const token = acc.meta?.user_token
    if (token) {
      await fetch(`https://graph.facebook.com/v21.0/me/permissions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      }).catch(() => {})
    }

    const { error } = await sb.from('social_accounts').delete().eq('id', account_id)
    return json({ ok: !error })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
