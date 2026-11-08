// Seed de données fictives dans le workspace du compte de test.
// Ne touche aucune donnée réelle : compte devin-test-* dédié.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'supabase-config.json'), 'utf8'));
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-creds.json'), 'utf8'));
const sb = createClient(cfg.url, cfg.anonKey);

// ---- PNG minimal (couleur unie + bandeau) --------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function makePNG(w, h, rgb, stripe) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor
  const row = Buffer.alloc(1 + w * 3);
  const rows = [];
  for (let y = 0; y < h; y++) {
    const r = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const inStripe = stripe && y > h * 0.4 && y < h * 0.6;
      const c = inStripe ? stripe : rgb;
      r[1 + x * 3] = c[0]; r[2 + x * 3] = c[1]; r[3 + x * 3] = c[2];
    }
    rows.push(r);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

(async () => {
  const { error: authErr } = await sb.auth.signInWithPassword({ email: creds.email, password: creds.pass });
  if (authErr) throw authErr;
  const { data: mem } = await sb.from('workspace_members').select('workspace_id').limit(1);
  const wsId = mem[0].workspace_id;
  console.log('workspace:', wsId);

  // dossiers patients (réutilisés si déjà créés par un run précédent)
  const getOrCreate = async (name) => {
    const { data: ex } = await sb.from('dossiers').select('*').eq('workspace_id', wsId).eq('name', name).maybeSingle();
    if (ex) return ex;
    return (await sb.from('dossiers').insert({ workspace_id: wsId, name }).select().single()).data;
  };
  const d1 = await getOrCreate('TEST Dupont Martin');
  const d2 = await getOrCreate('TEST Durand Claire');
  console.log('dossiers:', d1.id, d2.id);
  const { count: patCount } = await sb.from('patients').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId);
  if (!patCount) {
    await sb.from('patients').insert([
      { workspace_id: wsId, dossier_id: d1.id, first_name: 'Martin', last_name: 'Dupont', sex: 'M' },
      { workspace_id: wsId, dossier_id: d2.id, first_name: 'Claire', last_name: 'Durand', sex: 'F' },
    ]);
  }

  // sessions de capture (2 dates)
  const { data: { user } } = await sb.auth.getUser();
  const mkSession = async (at) => {
    const { data, error } = await sb.from('capture_sessions').insert({
      workspace_id: wsId, dossier_id: d1.id, practitioner_id: user.id,
      status: 'completed', started_at: at, ended_at: at, mobile_token: crypto.randomUUID(),
    }).select().single();
    if (error) console.log('session FAIL:', error.message);
    return data;
  };
  const s1 = await mkSession('2025-03-10T09:00:00Z');
  const s2 = await mkSession('2025-04-20T10:00:00Z');
  console.log('sessions:', s1 && s1.id, s2 && s2.id);

  const colors = [[220, 60, 60], [60, 160, 220], [80, 200, 120], [230, 180, 60], [160, 90, 220],
    [240, 120, 60], [60, 200, 200], [200, 80, 140], [120, 140, 60], [90, 110, 190]];
  const views = ['smile', 'intraoral', 'right', 'upper', 'portrait', 'left', 'lower', 'detail'];
  const plan = [];
  for (let i = 0; i < 10; i++) {
    const inD1 = i < 6;
    plan.push({
      name: `test-photo-${String(i + 1).padStart(2, '0')}.png`,
      color: colors[i], stripe: colors[(i + 3) % 10],
      dossier_id: inD1 ? d1.id : (i < 8 ? d2.id : null), // 8-9 : à classer
      session: inD1 ? (i < 3 ? s1.id : s2.id) : null,
      taken: inD1 ? (i < 3 ? '2025-03-10T09:05:00Z' : '2025-04-20T10:05:00Z') : '2025-05-05T11:00:00Z',
      view: views[i], stage: i < 3 ? 'initial' : (i < 6 ? 'final' : 'progress'),
      fav: i === 1 || i === 4,
    });
  }

  const { count: existing } = await sb.from('patient_photos').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId);
  if (existing > 0) { console.log('photos déjà présentes:', existing); return }
  let inserted = 0;
  for (const p of plan) {
    const png = makePNG(640, 480, p.color, p.stripe);
    const sp = `${wsId}/unsorted/${crypto.randomUUID()}.png`;
    const { error: upErr } = await sb.storage.from('photos').upload(sp, png, { contentType: 'image/png' });
    if (upErr) { console.log('upload FAIL', p.name, upErr.message); continue }
    const { error: insErr } = await sb.from('patient_photos').insert({
      workspace_id: wsId, storage_path: sp, original_filename: p.name,
      mime: 'image/png', bytes: png.length, width: 640, height: 480,
      source: 'import', dossier_id: p.dossier_id, capture_session_id: p.session,
      taken_at: p.taken, is_favorite: p.fav,
      edit_meta: { dental: { view: p.view, stage: p.stage } },
    });
    if (insErr) { console.log('insert FAIL', p.name, insErr.message); continue }
    inserted++;
  }
  console.log(`photos insérées: ${inserted}/10`);
})().catch((e) => { console.error('FATAL', e.message || e); process.exit(1) });
