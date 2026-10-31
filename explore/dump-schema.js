const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const cfg = require('./supabase-config.json');

const sb = createClient(cfg.url, cfg.anonKey);

const TABLES = [
  'profiles','workspaces','workspace_members','tags','patient_photos','capture_sessions',
  'dossiers','patients','capture_devices','audit_logs','social_posts','entity_comments',
  'notification_reads','montages','video_projects','presentations','presentation_slides',
  'saved_searches','collections','ai_predictions',
];

(async () => {
  const { data: auth, error } = await sb.auth.signInWithPassword({
    email: '' + (process.env.DP_USER||'') + '',
    password: '' + (process.env.DP_PASS||'') + '',
  });
  if (error) { console.log('AUTH FAIL', error.message); return; }
  console.log('AUTH OK', auth.user.id, auth.user.email);

  const schema = {};
  for (const t of TABLES) {
    const { data, error } = await sb.from(t).select('*').limit(2);
    if (error) { schema[t] = { error: error.message }; continue; }
    schema[t] = {
      columns: data && data.length ? Object.keys(data[0]) : [],
      count: data ? data.length : 0,
      sample: data && data[0] ? data[0] : null,
    };
    console.log(`${t}: ${schema[t].columns.length} cols`);
  }
  fs.writeFileSync('schema.json', JSON.stringify(schema, null, 1));
  console.log('written schema.json');
})();
