// social-oauth-start — POST { workspace_id, provider, action? }
// Renvoie l'URL d'autorisation à ouvrir (Meta OAuth ou page hébergée agrégateur).
// action:'sync' (provider 'aggregator') → resynchronise les comptes liés.
import {
  preflight, json, requireMember, signState,
  metaConfigured, metaOAuthUrl,
  aggProfile, aggConnectUrl, aggSyncAccounts, admin,
} from '../_shared/social.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  try {
    const { workspace_id, provider, action } = await req.json()
    if (!workspace_id || !provider) return json({ error: 'workspace_id/provider requis' }, 400)

    const user = await requireMember(req, workspace_id)
    if (!user) return json({ error: 'non autorisé' }, 401)

    // Agrégateur : comptes liés via page hébergée + sync des comptes existants.
    // Pool de clés : BYOK workspace (settings.social_agg_key) puis env.
    if (provider === 'aggregator') {
      const sb = admin()
      let prof
      try { prof = await aggProfile(sb, workspace_id) } catch (e) {
        return json({ configured: false, error: String((e as Error).message || e) }, 200)
      }
      if (action === 'sync') {
        return json({ synced: await aggSyncAccounts(sb, workspace_id, prof.username, prof.key) })
      }
      const url = await aggConnectUrl(prof.username, prof.key, Deno.env.get('APP_URL') || '')
      return json({ url })
    }

    // Meta natif — facebook et instagram partagent le même flow OAuth
    // (les pages Facebook remontent les comptes Instagram Pro associés).
    if (provider === 'facebook' || provider === 'instagram') {
      if (!metaConfigured()) {
        return json({ configured: false, error: 'META_APP_ID/META_APP_SECRET non configurés' }, 200)
      }
      const state = await signState(
        { ws: workspace_id, uid: user.id, p: provider, n: crypto.randomUUID() },
        Deno.env.get('META_APP_SECRET')!,
      )
      return json({ url: metaOAuthUrl(state) })
    }

    return json({ error: `provider inconnu: ${provider}` }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
