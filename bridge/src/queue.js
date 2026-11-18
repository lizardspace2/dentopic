// File d'attente sur disque : chaque photo reçue est rangée dans le spool
// jusqu'à ce que l'application web la récupère puis l'acquitte.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const DEFAULT_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tif', 'tiff', 'mp4', 'mov']

export const extOf = (name) => path.extname(name || '').slice(1).toLowerCase()
export const accepts = (name, exts) => (exts?.length ? exts : DEFAULT_EXTS).includes(extOf(name))

export class Queue {
  constructor(dir) {
    this.dir = dir
    fs.mkdirSync(dir, { recursive: true })
    this.index = path.join(dir, 'index.json')
    this.items = new Map()
    try {
      for (const it of JSON.parse(fs.readFileSync(this.index, 'utf8'))) {
        if (fs.existsSync(this.filePath(it.id))) this.items.set(it.id, it)
      }
    } catch { /* premier démarrage */ }
    // transferts interrompus d'une exécution précédente
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.part')) fs.rmSync(path.join(dir, f), { force: true })
  }

  save() {
    fs.writeFileSync(this.index, JSON.stringify([...this.items.values()]))
  }

  filePath(id) { return path.join(this.dir, `${id}.bin`) }
  tempPath() { return path.join(this.dir, `${crypto.randomUUID()}.part`) }

  /** Fichier temporaire complet -> entrée de file. Renvoie null si vide. */
  commit(tmp, { sourceId, name }) {
    const size = fs.statSync(tmp).size
    if (!size) { fs.rmSync(tmp, { force: true }); return null }
    const id = crypto.randomUUID()
    fs.renameSync(tmp, this.filePath(id))
    const item = { id, sourceId, name: path.basename(name), size, at: new Date().toISOString() }
    this.items.set(id, item)
    this.save()
    return item
  }

  add(buffer, meta) {
    const tmp = this.tempPath()
    fs.writeFileSync(tmp, buffer)
    return this.commit(tmp, meta)
  }

  rename(id, name) {
    const it = this.items.get(id)
    if (it) { it.name = path.basename(name); this.save() }
  }

  list() { return [...this.items.values()] }
  get(id) { return this.items.get(id) }

  remove(id) {
    if (!this.items.delete(id)) return false
    fs.rmSync(this.filePath(id), { force: true })
    this.save()
    return true
  }
}
