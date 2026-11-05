// social-publish-due — POST { workspace_id }
// Moteur réel de publication : posts scheduled échus → appels API réseau.
// Appelé par le client (publishDuePosts, JWT membre) et/ou un cron (x-cron-secret).
import {
  preflight, json, requireMember, cronOk, admin,
  mediaSignedUrl, markPost, metaPublishPage, metaPublishIG, aggPublish, aggProfile,
} from '../_shared/social.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  try {
    const { workspace_id } = await req.json()
    if (!workspace_id) return json({ error: 'workspace_id requis' }, 400)

    // Autorisé : membre du workspace OU appel cron authentifié.
    const member = await requireMember(req, workspace_id)
    if (!member && !cronOk(req)) return json({ error: 'non autorisé' }, 401)

    const sb = admin()
    const { data: due } = await sb
      .from('social_posts')
      .select('*,account:social_accounts(provider,access_token,meta),photo:patient_photos(storage_path),montage:montages(export_url),video:video_projects(export_url)')
      .eq('workspace_id', workspace_id)
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())

    let published = 0, failed = 0
    const errors: { id: string; error: string }[] = []

    for (const p of due || []) {
      const acc = p.account
      try {
        if (!acc) throw new Error('aucun réseau de destination')
        const meta = acc.meta || {}
        const mediaUrl = await mediaSignedUrl(sb, p)
        const caption = p.caption || ''
        let ref: string | null = null

        if (meta.aggregator && meta.profile_key) {
          // Agrégateur : la clé se résout par la liaison profil (BYOK ou plateforme).
          const prof = await aggProfile(sb, workspace_id)
          ref = await aggPublish(meta.profile_key, prof.key,
            meta.platforms || [acc.provider], mediaUrl, caption, !!p.video_id)
        } else if (acc.provider === 'instagram' && meta.ig_user_id && meta.page_token) {
          if (!mediaUrl) throw new Error('Instagram exige une image accessible')
          ref = await metaPublishIG(meta.ig_user_id, meta.page_token, mediaUrl, caption)
        } else if (acc.provider === 'facebook' && meta.page_id && meta.page_token) {
          ref = await metaPublishPage({ id: meta.page_id, access_token: meta.page_token }, mediaUrl, caption)
        } else {
          throw new Error(`compte ${acc.provider} sans credentials de publication`)
        }

        published++
        await markPost(sb, p.id, 'published', { post_ref: ref, published_at: new Date().toISOString() })
      } catch (e) {
        failed++
        errors.push({ id: p.id, error: String((e as Error).message || e) })
        await markPost(sb, p.id, 'failed', { last_error: String((e as Error).message || e) })
      }
    }
    return json({ published, failed, errors })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
