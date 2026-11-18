// Dossier surveillé : toute nouvelle photo déposée par un logiciel constructeur
// (EOS Utility, NX Tether, Imaging Edge, X Acquire, LUMIX Tether, OM Capture…),
// un câble USB ou un lecteur de carte part dans la file.
import fs from 'node:fs'
import path from 'node:path'
import { accepts } from './queue.js'

function scan(dir, recursive, out = new Map()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (recursive) try { scan(p, recursive, out) } catch { /* sous-dossier illisible */ }
    } else if (e.isFile()) {
      try { const s = fs.statSync(p); out.set(p, `${s.size}:${s.mtimeMs}`) } catch { /* disparu entre-temps */ }
    }
  }
  return out
}

export function startWatch(cfg, ctx) {
  const dir = cfg.path
  const recursive = cfg.recursive !== false
  let seen = null         // chemin -> signature déjà traitée (ou présente au démarrage)
  let pending = new Map() // chemin -> signature au tour précédent (attente de fin d'écriture)

  const tick = () => {
    let now
    try {
      if (!dir) throw new Error('Aucun dossier indiqué')
      now = scan(dir, recursive)
    } catch (e) {
      return ctx.state('error', e.code === 'ENOENT' ? `Dossier introuvable : ${dir}` : e.message)
    }
    ctx.state('listening', `Surveillance de ${dir}`)
    if (!seen) { seen = now; return } // les fichiers déjà présents ne sont pas réimportés
    const next = new Map()
    for (const [p, sig] of now) {
      if (seen.get(p) === sig || !accepts(p, ctx.exts)) continue
      if (pending.get(p) !== sig || sig.startsWith('0:')) { next.set(p, sig); continue } // taille pas encore stable
      try {
        const tmp = ctx.queue.tempPath()
        fs.copyFileSync(p, tmp)
        const item = ctx.queue.commit(tmp, { sourceId: ctx.sourceId, name: p })
        seen.set(p, sig)
        if (item) ctx.file(item)
      } catch { next.set(p, sig) } // fichier encore verrouillé : nouvel essai au prochain tour
    }
    pending = next
  }

  tick()
  const timer = setInterval(tick, Number(cfg.interval) || 1000)
  return { stop: async () => clearInterval(timer) }
}
