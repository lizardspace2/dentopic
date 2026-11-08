// Remet le workspace de test dans l'état attendu par test-library.js :
// - supprime les photos résiduelles des autres runs (fixture.png, planche-*.jpg)
//   ainsi que leurs objets storage ;
// - restaure les étiquettes Vue/Étape des 10 photos seed (photo-04 = 'smile'
//   pour que les deux séances de Dupont partagent une vue comparable).
// N'agit que dans le compte de test dédié (devin-test-*).
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'supabase-config.json'), 'utf8'));
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));
const sb = createClient(cfg.url, cfg.anonKey);

const LABELS = {
  'test-photo-01.png': { view: 'smile', stage: 'initial' },
  'test-photo-02.png': { view: 'intraoral', stage: 'initial' },
  'test-photo-03.png': { view: 'right', stage: 'initial' },
  'test-photo-04.png': { view: 'smile', stage: 'final' },   // vue commune s1/s2
  'test-photo-05.png': { view: 'portrait', stage: 'final' },
  'test-photo-06.png': { view: 'left', stage: 'final' },
  'test-photo-07.png': { view: 'lower', stage: 'progress' },
  'test-photo-08.png': { view: 'detail', stage: 'progress' },
  // 09 / 10 : « à classer » — pas d'étiquette
};

(async () => {
  await sb.auth.signInWithPassword({ email: creds.email, password: creds.pass });
  const { data: mem } = await sb.from('workspace_members').select('workspace_id').limit(1);
  const wsId = mem[0].workspace_id;

  const { data: photos } = await sb.from('patient_photos')
    .select('id,original_filename,storage_path').eq('workspace_id', wsId);
  const residue = photos.filter((p) => !/^test-photo-\d+\.png$/.test(p.original_filename || ''));
  console.log(`photos: ${photos.length} — résidus à supprimer: ${residue.length}`);

  if (residue.length) {
    const paths = residue.map((p) => p.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: rmErr } = await sb.storage.from('photos').remove(paths);
      if (rmErr) console.log('storage remove:', rmErr.message);
    }
    const { error: delErr } = await sb.from('patient_photos')
      .delete().in('id', residue.map((p) => p.id));
    console.log('delete rows:', delErr ? delErr.message : 'ok');
  }

  for (const p of photos.filter((x) => LABELS[x.original_filename])) {
    const { error } = await sb.from('patient_photos')
      .update({ edit_meta: { dental: LABELS[p.original_filename] } }).eq('id', p.id);
    if (error) console.log('label FAIL', p.original_filename, error.message);
  }
  // s'assurer que 09/10 n'ont plus d'étiquette ni dossier (« à classer »)
  for (const p of photos.filter((x) => ['test-photo-09.png', 'test-photo-10.png'].includes(x.original_filename))) {
    await sb.from('patient_photos').update({ edit_meta: {}, dossier_id: null }).eq('id', p.id);
  }

  const { count } = await sb.from('patient_photos').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId);
  console.log('total final:', count);
})().catch((e) => { console.error('FATAL', e.message || e); process.exit(1) });
