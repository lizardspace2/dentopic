// Helpers partagés — infrastructure de publication sociale DentoPic.
// Deux adaptateurs derrière la même interface :
//   - 'meta'       : OAuth natif (1 app Meta) — secrets META_APP_ID/SECRET/REDIRECT_URI
//   - 'aggregator' : API type Ayrshare/Zernio — secrets AGGREGATOR_API_KEY[/BASE_URL]
// Le serveur choisit selon les secrets configurés ; le frontend n'a rien à changer.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---- HTTP / CORS --------------------------------------------------------------

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** Répond à la préflight OPTIONS ; retourne null si ce n'en est pas une. */
export const preflight = (req: Request) =>
  req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null

export const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

/** Vérifie le JWT utilisateur et son appartenance au workspace. */
export async function requireMember(req: Request, wsId: string) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = admin()
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return null
  const { data: m } = await sb
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', wsId)
    .eq('user_id', user.id)
    .maybeSingle()
  return m ? user : null
}

/** Le déclencheur cron (pg_cron / scheduler externe) envoie x-cron-secret. */
export const cronOk = (req: Request) =>
  !!Deno.env.get('CRON_SECRET') &&
  req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')

// ---- state OAuth signé (HMAC-SHA256, sans serveur d'état) ---------------------

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const hmacKey = (secret: string, usage: KeyUsage) =>
  crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, [usage])

export async function signState(payload: Record<string, unknown>, secret: string) {
  const body = b64(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = b64(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'),
    new TextEncoder().encode(body)))
  return `${body}.${sig}`
}

export async function verifyState(state: string, secret: string) {
  const [body, sig] = state.split('.')
  if (!body || !sig) return null
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'),
    unb64(sig), new TextEncoder().encode(body))
  if (!ok) return null
  try { return JSON.parse(new TextDecoder().decode(unb64(body))) } catch { return null }
}

// ---- Adaptateur META (Graph API v21) ------------------------------------------

const GRAPH = 'https://graph.facebook.com/v21.0'

export const META_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',')

export const metaConfigured = () =>
  !!Deno.env.get('META_APP_ID') && !!Deno.env.get('META_APP_SECRET')

export const metaOAuthUrl = (state: string) =>
  `https://www.facebook.com/v21.0/dialog/oauth` +
  `?client_id=${Deno.env.get('META_APP_ID')}` +
  `&redirect_uri=${encodeURIComponent(Deno.env.get('META_REDIRECT_URI')!)}` +
  `&state=${encodeURIComponent(state)}&scope=${META_SCOPES}&response_type=code`

/** code → user access token, échangé en token longue durée (60 j). */
export async function metaExchangeCode(code: string) {
  const p = new URLSearchParams({
    client_id: Deno.env.get('META_APP_ID')!,
    client_secret: Deno.env.get('META_APP_SECRET')!,
    redirect_uri: Deno.env.get('META_REDIRECT_URI')!,
    code,
  })
  const t = await (await fetch(`${GRAPH}/oauth/access_token?${p}`)).json()
  if (!t.access_token) throw new Error(`token: ${t.error?.message || 'échec'}`)
  // longue durée
  const l = await (await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: Deno.env.get('META_APP_ID')!,
    client_secret: Deno.env.get('META_APP_SECRET')!,
    fb_exchange_token: t.access_token,
  }))).json()
  return {
    token: l.access_token || t.access_token,
    expiresIn: l.expires_in || t.expires_in || null,
  }
}

/** Pages du cabinet + compte Instagram Pro associé le cas échéant. */
export async function metaPages(userToken: string) {
  const u = `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`
  const d = await (await fetch(u)).json()
  return d.data || []
}

export async function metaPublishPage(
  page: { id: string; access_token: string },
  mediaUrl: string | null, caption: string,
) {
  // Photo si média image, sinon simple post texte/lien sur le feed.
  const [path, body] = mediaUrl
    ? [`/${page.id}/photos`, { url: mediaUrl, caption, access_token: page.access_token }]
    : [`/${page.id}/feed`, { message: caption || '', access_token: page.access_token }]
  const r = await (await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })).json()
  if (r.error) throw new Error(r.error.message)
  return r.post_id || r.id
}

/** Publication Instagram : conteneur média puis publish (2 appels). */
export async function metaPublishIG(
  igUserId: string, pageToken: string,
  mediaUrl: string, caption: string,
) {
  const c = await (await fetch(`${GRAPH}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: mediaUrl, caption, access_token: pageToken }),
  })).json()
  if (c.error) throw new Error(c.error.message)
  const pub = await (await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: c.id, access_token: pageToken }),
  })).json()
  if (pub.error) throw new Error(pub.error.message)
  return pub.id
}

// ---- Adaptateur AGGREGATEUR — Upload-Post (api.upload-post.com) ----------------
// Multi-tenant natif : 1 « profile » (username) par workspace, page de connexion
// hébergée via JWT, publish photo/texte en multipart. photos[] accepte des URLs
// publiques → on passe directement la signed URL Supabase.
//
// Clés (pool, dans l'ordre) :
//   1. BYOK — workspaces.settings.social_agg_key (le cabinet apporte sa clé)
//   2. AGGREGATOR_API_KEY puis AGGREGATOR_API_KEYS (séparées par virgules)
// Le profil Upload-Post est lié à la clé qui l'a créé (fingerprint stocké dans
// settings.social_agg_profile = {u, k}) → publication toujours sous la bonne clé.

const AGG_BASE = () => Deno.env.get('AGGREGATOR_BASE_URL') || 'https://api.upload-post.com/api'
export const aggConfigured = () =>
  !!Deno.env.get('AGGREGATOR_API_KEY') || !!Deno.env.get('AGGREGATOR_API_KEYS')
const AGG_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x', 'threads', 'pinterest', 'google_business']
const fp = (k: string) => k.slice(0, 16) // fingerprint de clé (stocké, jamais la clé entière)

const aggJson = async (path: string, key: string, init: RequestInit = {}) =>
  (await fetch(`${AGG_BASE()}${path}`, {
    ...init,
    headers: {
      Authorization: `Apikey ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })).json()

/** Pool ordonné : BYOK workspace d'abord, puis clés plateforme. */
async function aggPool(sb: SupabaseClient, wsId: string) {
  const { data: ws } = await sb.from('workspaces').select('settings').eq('id', wsId).single()
  const wsKey = ws?.settings?.social_agg_key || null
  const envKeys = [
    Deno.env.get('AGGREGATOR_API_KEY'),
    ...(Deno.env.get('AGGREGATOR_API_KEYS') || '').split(','),
  ].map((k) => k?.trim()).filter(Boolean) as string[]
  return { ws, keys: [...(wsKey ? [wsKey] : []), ...envKeys] }
}

/** Résout le profil Upload-Post du workspace + la clé qui le détient. */
export async function aggProfile(sb: SupabaseClient, wsId: string) {
  const { ws, keys } = await aggPool(sb, wsId)
  if (!keys.length) throw new Error('aucune clé agrégateur configurée')
  const bound = ws?.settings?.social_agg_profile
  let key = bound?.k ? keys.find((k) => fp(k) === bound.k) : null
  let username = bound?.u
  if (!key || !username) {
    // Première utilisation (ou clé liée disparue) : nouvelle liaison sur la 1re clé du pool.
    key = keys[0]
    username = bound?.u || `dp-${wsId.replace(/-/g, '').slice(0, 12)}`
    await aggJson('/uploadposts/users', key, {
      method: 'POST', body: JSON.stringify({ username }),
    }).catch(() => {})
    await sb.from('workspaces').update({
      settings: { ...ws?.settings, social_agg_profile: { u: username, k: fp(key) } },
    }).eq('id', wsId)
  }
  return { username, key }
}

/** URL de la page de connexion hébergée Upload-Post (JWT single-use, ~48 h). */
export async function aggConnectUrl(username: string, key: string, redirectUrl: string) {
  const r = await aggJson('/uploadposts/users/generate-jwt', key, {
    method: 'POST',
    body: JSON.stringify({
      username,
      redirect_url: redirectUrl || undefined,
      connect_title: 'Connectez vos réseaux sociaux',
      connect_description: 'Autorisez DentoPic à publier sur vos comptes.',
      platforms: AGG_PLATFORMS,
    }),
  })
  const url = r.access_url || r.url
  if (!url) throw new Error(`generate-jwt: ${JSON.stringify(r)}`)
  return url
}

/** Resynchronise les plateformes liées du profil → lignes social_accounts.
 *  Réponse réelle : { profiles:[{username, social_accounts:{platform: handle}}] } */
export async function aggSyncAccounts(sb: SupabaseClient, wsId: string, username: string, key: string) {
  const r = await aggJson('/uploadposts/users', key)
  const list: Record<string, unknown>[] = Array.isArray(r)
    ? r : (r.profiles || r.users || r.data || [])
  const u = list.find((x) => x.username === username)
  const accs = u?.social_accounts || u?.connected_platforms || {}
  const platforms = (Array.isArray(accs) ? accs : Object.keys(accs as object))
    .map((x) => (typeof x === 'string' ? x : (x as { platform?: string }).platform))
    .filter(Boolean) as string[]
  let n = 0
  for (const pl of platforms) {
    const handle = !Array.isArray(accs)
      ? ((accs as Record<string, string>)[pl] || pl) : pl
    const { error } = await sb.from('social_accounts').insert({
      workspace_id: wsId,
      provider: pl,
      handle,
      access_token: `agg:${username}`,
      meta: { aggregator: true, profile_key: username, platforms: [pl] },
    })
    if (!error) n++
  }
  return n
}

/** Publication réelle : photos[] accepte une URL publique (signed URL Supabase). */
export async function aggPublish(
  username: string, key: string, platforms: string[], mediaUrl: string | null,
  caption: string, isVideo = false,
) {
  const fd = new FormData()
  fd.append('user', username)
  platforms.forEach((p) => fd.append('platform[]', p))
  fd.append('title', caption || ' ')
  const path = mediaUrl ? (isVideo ? '/upload' : '/upload_photos') : '/upload_text'
  if (mediaUrl) fd.append(isVideo ? 'video' : 'photos[]', mediaUrl)
  const r = await (await fetch(`${AGG_BASE()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Apikey ${key}` },
    body: fd,
  })).json()
  if (r.success === false || r.error || r.errors?.length) {
    throw new Error(r.error || r.errors?.[0]?.message || JSON.stringify(r).slice(0, 300))
  }
  return r.job_id || r.request_id || r.id || 'ok'
}

// ---- Utilitaires publication ---------------------------------------------------

/** URL signée 10 min pour le média d'un post (bucket privé photos). */
export async function mediaSignedUrl(sb: SupabaseClient, post: Record<string, unknown>) {
  const path =
    (post.photo as { storage_path?: string } | null)?.storage_path ||
    (post.montage as { export_url?: string } | null)?.export_url ||
    (post.video as { export_url?: string } | null)?.export_url ||
    null
  if (!path) return null
  const { data } = await sb.storage.from('photos').createSignedUrl(path, 600)
  return data?.signedUrl || null
}

/** MAJ statut tolérante : tente meta (post id / erreur), repli sur statut seul. */
export async function markPost(
  sb: SupabaseClient, id: string, status: string, extraMeta?: Record<string, unknown>,
) {
  if (extraMeta) {
    const { error } = await sb.from('social_posts')
      .update({ status, meta: extraMeta, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) return
  }
  await sb.from('social_posts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
}
