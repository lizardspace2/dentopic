// social-oauth-callback — GET ?code&state (redirect Meta)
// Échange le code, récupère les Pages (+ Instagram Pro associé) et écrit
// les lignes social_accounts pour le workspace, puis redirige vers l'app.
// Configurer META_REDIRECT_URI = <projet>/functions/v1/social-oauth-callback
import {
  json, admin, verifyState,
  metaConfigured, metaExchangeCode, metaPages,
} from '../_shared/social.ts'

const back = (ok: boolean, extra = '') => {
  const base = Deno.env.get('APP_URL')
  if (!base) return json({ meta_connected: ok ? 1 : 0, error: 'APP_URL non configurée' })
  return Response.redirect(`${base}/publication?meta_connected=${ok ? '1' : '0'}${extra}`, 302)
}

Deno.serve(async (req) => {
  try {
    if (!metaConfigured()) return back(false, '&err=config')
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const err = url.searchParams.get('error_description') || url.searchParams.get('error')
    if (err) return back(false)
    if (!code || !state) return back(false)

    const s = await verifyState(state, Deno.env.get('META_APP_SECRET')!)
    if (!s?.ws || !s?.uid) return back(false)

    // 1) code → token utilisateur longue durée
    const { token, expiresIn } = await metaExchangeCode(code)
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

    // 2) pages du cabinet + Instagram Pro associé
    const pages = await metaPages(token)
    const sb = admin()
    let n = 0
    for (const pg of pages) {
      const base = {
        workspace_id: s.ws,
        access_token: pg.access_token, // token de Page (longue durée)
        meta: {
          oauth: 'meta',
          page_id: pg.id,
          page_token: pg.access_token,
          user_token: token,
          token_expires_at: expiresAt,
          ig_user_id: pg.instagram_business_account?.id || null,
        },
      }
      // ligne Facebook (la page)
      const { error: e1 } = await sb.from('social_accounts').insert({
        ...base, provider: 'facebook', handle: pg.name,
      })
      if (!e1) n++
      // ligne Instagram (compte pro lié à la page)
      if (pg.instagram_business_account?.id) {
        const { error: e2 } = await sb.from('social_accounts').insert({
          ...base,
          provider: 'instagram',
          handle: pg.instagram_business_account.username || pg.name,
        })
        if (!e2) n++
      }
    }
    return back(n > 0, `&n=${n}`)
  } catch (e) {
    console.error('oauth-callback:', e)
    return back(false)
  }
})
