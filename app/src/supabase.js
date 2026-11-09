import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

// Après une longue inactivité, le jeton d'accès peut expirer avant que le
// rafraîchissement automatique n'ait eu lieu : PostgREST renvoie alors des
// 401 en boucle. On force un refresh puis on rejoue la requête une fois ;
// si le refresh token est mort, on déconnecte pour revenir au login.
let refreshing = null
const refresh = () => {
  refreshing = refreshing || supabase.auth.refreshSession().finally(() => { refreshing = null })
  return refreshing
}

const RETRYABLE = /\/(rest|storage|functions)\//

async function fetchWithAuthRetry(input, init = {}) {
  const res = await fetch(input, init)
  const url = typeof input === 'string' ? input : input.url
  if (res.status !== 401 || !RETRYABLE.test(url)) return res
  const { data, error } = await refresh()
  if (error || !data.session) {
    supabase.auth.signOut().catch(() => {})
    return res
  }
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchWithAuthRetry },
})
