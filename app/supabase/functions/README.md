# Edge Functions — publication sociale

Deux adaptateurs derrière la même interface ; le serveur choisit selon les secrets configurés.

## Secrets à définir (`supabase secrets set`)

```
# Commun
APP_URL=https://votre-domaine.tld          # retour OAuth → /publication?meta_connected=

# Adaptateur META (natif — 1 app Meta pour tous les cabinets)
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=https://<ref>.supabase.co/functions/v1/social-oauth-callback

# Adaptateur AGGREGATEUR — Upload-Post par défaut (évite l'App Review Meta)
AGGREGATOR_API_KEY=...
AGGREGATOR_BASE_URL=https://api.upload-post.com/api   # optionnel (défaut)

# Cron externe → appels social-publish-due authentifiés
CRON_SECRET=<secret-long>
```

Dans Meta (Facebook Login → Settings), déclarer `META_REDIRECT_URI` comme *Valid OAuth Redirect URI*.

## Déploiement

```
supabase functions deploy social-oauth-start
supabase functions deploy social-oauth-callback
supabase functions deploy social-publish-due
supabase functions deploy social-disconnect
```

## Cron (optionnel — sinon le client déclenche au chargement + 60 s)

```sql
select cron.schedule('social-publish', '* * * * *',
  $$ select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/social-publish-due',
    headers := jsonb_build_object('x-cron-secret','<CRON_SECRET>','Content-Type','application/json'),
    body := jsonb_build_object('workspace_id','<WS_ID>')) $$);
```

## Flux

- `social-oauth-start` : `{provider:'facebook'|'instagram'|'aggregator'}` → `{url}` à ouvrir. `provider:'aggregator', action:'sync'` resynchronise les comptes liés.
- `social-oauth-callback` : échange code → token longue durée → `/me/accounts` → lignes `social_accounts` (facebook + instagram si compte Pro lié) → redirect app.
- `social-publish-due` : posts `scheduled` échus → publish réel (Page FB `/photos`, IG conteneur+publish, ou agrégateur) → `published|failed`.
- `social-disconnect` : révocation best-effort + suppression.

Sans secrets configurés, `social-oauth-start` renvoie `{configured:false}` et l'UI reste en mode manuel « pending OAuth ». Sans functions déployées, `publishDuePosts` retombe sur la simulation client.
