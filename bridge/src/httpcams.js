// Boîtiers et cartes interrogés en HTTP sur le réseau local :
//  - Canon CCAPI (API REST des EOS R récents, à activer sur le boîtier)
//  - cartes SD Wi-Fi Toshiba/Kioxia FlashAir
import { accepts } from './queue.js'

const get = (url) => fetch(url, { signal: AbortSignal.timeout(20000) })

// Boucle d'interrogation commune : `step` est rappelé tant que la source vit.
function poll(cfg, ctx, label, step) {
  let stopped = false
  let timer = null
  const run = async () => {
    if (stopped) return
    try {
      if (!cfg.host) throw new Error('Adresse IP manquante')
      await step()
      ctx.state('connected', `Connecté à ${cfg.host}`)
    } catch (e) {
      ctx.state('error', e.status ? `${label} : réponse ${e.status}` : `${label} injoignable à ${cfg.host} — vérifiez le Wi-Fi`)
    }
    if (!stopped) timer = setTimeout(run, Number(cfg.interval) || 2000)
  }
  ctx.state('connecting', `Connexion à ${cfg.host || '…'}`)
  run()
  return { stop: async () => { stopped = true; clearTimeout(timer) } }
}

const okOrThrow = (res) => {
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
  return res
}

async function download(url, name, ctx) {
  const res = okOrThrow(await get(url))
  const item = ctx.queue.add(Buffer.from(await res.arrayBuffer()), { sourceId: ctx.sourceId, name })
  if (item) ctx.file(item)
}

export function startCcapi(cfg, ctx) {
  const base = `http://${cfg.host}:${Number(cfg.port) || 8080}`
  let first = true
  return poll(cfg, ctx, 'Canon CCAPI', async () => {
    const res = okOrThrow(await get(`${base}/ccapi/ver100/event/polling`))
    const body = await res.json().catch(() => ({}))
    // le premier appel décrit l'état courant du boîtier : on ne rapatrie que la suite
    const urls = first ? [] : body.addedcontents || []
    first = false
    for (const u of urls) {
      const name = decodeURIComponent(String(u).split('/').pop() || '')
      if (String(u).startsWith('/ccapi/') && accepts(name, ctx.exts)) await download(base + u, name, ctx)
    }
  })
}

export function startFlashair(cfg, ctx) {
  const base = `http://${cfg.host}`
  let seen = null
  // command.cgi?op=100 -> lignes « dossier,nom,taille,attribut,date,heure »
  const list = async (dir) => {
    const res = okOrThrow(await get(`${base}/command.cgi?op=100&DIR=${encodeURI(dir)}`))
    return (await res.text()).split(/\r?\n/).slice(1).filter(Boolean).map((l) => {
      const f = l.split(',')
      const n = f.length
      return { name: f.slice(1, n - 4).join(','), size: Number(f[n - 4]), isDir: (Number(f[n - 3]) & 16) !== 0 }
    })
  }
  return poll(cfg, ctx, 'Carte SD Wi-Fi', async () => {
    const files = []
    for (const d of (await list('/DCIM')).filter((e) => e.isDir)) {
      for (const f of await list(`/DCIM/${d.name}`)) if (!f.isDir && f.size > 0) files.push(`/DCIM/${d.name}/${f.name}`)
    }
    if (!seen) { seen = new Set(files); return }
    for (const p of files) {
      if (seen.has(p) || !accepts(p, ctx.exts)) continue
      await download(base + encodeURI(p), p.split('/').pop(), ctx)
      seen.add(p)
    }
  })
}
