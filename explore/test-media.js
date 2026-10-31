const { createClient } = require('@supabase/supabase-js');
const cfg = require('./supabase-config.json');
const sb = createClient(cfg.url, cfg.anonKey);

(async () => {
  const { data: auth } = await sb.auth.signInWithPassword({
    email: '' + (process.env.DP_USER||'') + '', password: '' + (process.env.DP_PASS||'') + '',
  });
  const token = auth.session.access_token;

  // 1) get media token
  const r = await fetch(cfg.url + '/functions/v1/media-proxy/token', {
    headers: { Authorization: 'Bearer ' + token, apikey: cfg.anonKey },
  });
  console.log('token status', r.status);
  const body = await r.text();
  console.log('token body', body.slice(0, 300));

  let mt;
  try { mt = JSON.parse(body).token || JSON.parse(body).mt || JSON.parse(body); } catch { mt = body; }

  // 2) try media-proxy fetch
  const sp = '9d943a17-ea75-4636-a3af-1c63d477f161/unsorted/272ce8bf-4acc-4564-94f5-0207a1e1e7ea.jpeg';
  const r2 = await fetch(cfg.url + '/functions/v1/media-proxy/photos/' + sp + '?mt=' + encodeURIComponent(mt));
  console.log('media status', r2.status, r2.headers.get('content-type'), r2.headers.get('content-length'));

  // 3) also try authenticated storage download
  const { data: dl, error } = await sb.storage.from('photos').download(sp);
  console.log('storage.download:', error ? error.message : (dl && dl.size + ' bytes OK'));

  // 4) signed URL
  const { data: su, error: e4 } = await sb.storage.from('photos').createSignedUrl(sp, 3600);
  console.log('signedUrl:', e4 ? e4.message : su.signedUrl.slice(0, 120));
})();
