// Client PTP/IP (ISO 15740 sur TCP, port 15740) : le Bridge se connecte au
// boîtier (Nikon Z, Canon en mode « EOS Utility »…) et rapatrie chaque
// nouvelle photo. Générique : aucune opération propriétaire.
import net from 'node:net'
import { accepts } from './queue.js'

const T = { INIT_CMD: 1, INIT_CMD_ACK: 2, INIT_EVT: 3, INIT_EVT_ACK: 4, INIT_FAIL: 5, OP_REQ: 6, OP_RES: 7, EVENT: 8, START_DATA: 9, DATA: 10, END_DATA: 12, PROBE_REQ: 13, PROBE_RES: 14 }
const OP = { OpenSession: 0x1002, CloseSession: 0x1003, GetObjectHandles: 0x1007, GetObjectInfo: 0x1008, GetObject: 0x1009 }
const RC_OK = 0x2001, RC_SESSION_OPEN = 0x201e
const EV_OBJECT_ADDED = 0x4002
const FMT_FOLDER = 0x3001

export const packet = (type, payload = Buffer.alloc(0)) => {
  const head = Buffer.alloc(8)
  head.writeUInt32LE(8 + payload.length, 0)
  head.writeUInt32LE(type, 4)
  return Buffer.concat([head, payload])
}

/** Découpe un flux TCP en paquets PTP/IP { type, payload } lisibles un par un. */
export class PacketStream {
  constructor(sock) {
    this.sock = sock
    this.buf = Buffer.alloc(0)
    this.ready = []
    this.waiters = []
    this.err = null
    sock.on('data', (c) => {
      this.buf = Buffer.concat([this.buf, c])
      while (this.buf.length >= 8) {
        const len = this.buf.readUInt32LE(0)
        if (len < 8) return sock.destroy(new Error('paquet PTP/IP invalide'))
        if (this.buf.length < len) break
        const p = { type: this.buf.readUInt32LE(4), payload: this.buf.subarray(8, len) }
        this.buf = this.buf.subarray(len)
        const w = this.waiters.shift()
        if (w) w.res(p); else this.ready.push(p)
      }
    })
    const fail = (e) => {
      this.err = e || new Error('connexion fermée')
      this.waiters.splice(0).forEach((w) => w.rej(this.err))
    }
    sock.on('error', fail)
    sock.on('close', () => fail())
  }

  read() {
    if (this.ready.length) return Promise.resolve(this.ready.shift())
    if (this.err) return Promise.reject(this.err)
    return new Promise((res, rej) => this.waiters.push({ res, rej }))
  }
}

const connect = (host, port) => new Promise((res, rej) => {
  const s = net.connect({ host, port })
  s.setTimeout(8000, () => s.destroy(new Error('délai dépassé')))
  s.once('connect', () => { s.setTimeout(0); s.setNoDelay(true); res(s) })
  s.once('error', rej)
})

/** Nom de fichier d'un jeu ObjectInfo (chaîne PTP à l'offset 52). */
export function parseObjectInfo(d) {
  const n = d.length > 52 ? d.readUInt8(52) : 0
  const name = n ? d.subarray(53, 53 + n * 2).toString('utf16le').replace(/\0+$/, '') : ''
  return { format: d.readUInt16LE(4), size: d.readUInt32LE(8), name }
}

export function startPtpip(cfg, ctx) {
  const host = cfg.host
  const port = Number(cfg.port) || 15740
  let stopped = false
  let cmdSock = null, evtSock = null
  let wake = () => {}
  const sleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r() } })

  async function session() {
    ctx.state('connecting', `Connexion à ${host}:${port}…`)
    cmdSock = await connect(host, port)
    const cmd = new PacketStream(cmdSock)
    const name = Buffer.from('DentoPic Bridge\0', 'utf16le')
    const ver = Buffer.alloc(4); ver.writeUInt32LE(0x00010000)
    cmdSock.write(packet(T.INIT_CMD, Buffer.concat([ctx.guid, name, ver])))
    const ack = await cmd.read()
    if (ack.type === T.INIT_FAIL) throw new Error('Connexion refusée par le boîtier — validez l’appairage sur son écran')
    if (ack.type !== T.INIT_CMD_ACK) throw new Error('Réponse PTP/IP inattendue')

    evtSock = await connect(host, port)
    const evt = new PacketStream(evtSock)
    evtSock.write(packet(T.INIT_EVT, ack.payload.subarray(0, 4)))
    if ((await evt.read()).type !== T.INIT_EVT_ACK) throw new Error('Canal d’événements refusé')

    const added = new Set()
    ;(async () => {
      for (;;) {
        const p = await evt.read()
        if (p.type === T.PROBE_REQ) evtSock.write(packet(T.PROBE_RES))
        else if (p.type === T.EVENT && p.payload.readUInt16LE(0) === EV_OBJECT_ADDED && p.payload.length >= 10) {
          added.add(p.payload.readUInt32LE(6)); wake()
        }
      }
    })().catch(() => cmdSock.destroy())

    let tid = 0
    const op = async (code, params = []) => {
      const b = Buffer.alloc(10 + 4 * params.length)
      b.writeUInt32LE(1, 0); b.writeUInt16LE(code, 4); b.writeUInt32LE(tid++, 6)
      params.forEach((v, i) => b.writeUInt32LE(v >>> 0, 10 + 4 * i))
      cmdSock.write(packet(T.OP_REQ, b))
      const chunks = []
      for (;;) {
        const p = await cmd.read()
        if (p.type === T.DATA || p.type === T.END_DATA) chunks.push(p.payload.subarray(4))
        else if (p.type === T.OP_RES) return { code: p.payload.readUInt16LE(0), data: Buffer.concat(chunks) }
      }
    }
    const handles = async () => {
      const r = await op(OP.GetObjectHandles, [0xffffffff, 0, 0])
      if (r.code !== RC_OK || r.data.length < 4) return null
      const out = []
      for (let i = 0, n = r.data.readUInt32LE(0); i < n && 8 + i * 4 <= r.data.length; i++) out.push(r.data.readUInt32LE(4 + i * 4))
      return out
    }

    const open = await op(OP.OpenSession, [1])
    if (open.code !== RC_OK && open.code !== RC_SESSION_OPEN) throw new Error(`Ouverture de session refusée (0x${open.code.toString(16)})`)
    ctx.state('connected', `Connecté à ${host}`)

    let known = null // photos déjà sur la carte à la connexion : ignorées
    while (!stopped) {
      const list = await handles()
      if (list && !known) known = new Set(list)
      else if (list) list.forEach((h) => { if (!known.has(h)) added.add(h) })
      for (const h of [...added]) {
        added.delete(h)
        if (!known || known.has(h)) continue
        known.add(h)
        const info = await op(OP.GetObjectInfo, [h])
        if (info.code !== RC_OK || info.data.length < 53) continue
        const { format, name } = parseObjectInfo(info.data)
        if (format === FMT_FOLDER || !accepts(name, ctx.exts)) continue
        const obj = await op(OP.GetObject, [h])
        if (obj.code !== RC_OK) { known.delete(h); continue }
        const item = ctx.queue.add(obj.data, { sourceId: ctx.sourceId, name })
        if (item) ctx.file(item)
      }
      await sleep(Number(cfg.interval) || 2000)
    }
  }

  ;(async () => {
    while (!stopped) {
      try {
        if (!host) throw new Error('Adresse IP du boîtier manquante')
        await session()
      } catch (e) {
        if (!stopped) ctx.state('error', e.code === 'ECONNREFUSED' || e.code === 'EHOSTUNREACH' || e.code === 'ETIMEDOUT' || e.message === 'délai dépassé'
          ? `Boîtier injoignable à ${host}:${port} — vérifiez le Wi-Fi et le mode « connexion au PC »`
          : e.message)
      }
      cmdSock?.destroy(); evtSock?.destroy()
      if (!stopped) await sleep(5000)
    }
  })()

  return {
    stop: async () => { stopped = true; wake(); cmdSock?.destroy(); evtSock?.destroy() },
  }
}
