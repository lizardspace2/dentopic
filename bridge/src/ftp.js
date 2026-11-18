// Serveur FTP minimal, en réception seule : le boîtier (Sony, Canon, Nikon,
// Fujifilm…) est le client et pousse chaque photo. Rien n'est lisible ni
// listable depuis le réseau ; les fichiers vont directement dans la file.
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { accepts } from './queue.js'

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
const v4 = (addr) => (addr || '').replace(/^::ffff:/, '')

export function startFtp(cfg, ctx) {
  const port = Number(cfg.port) || 2121
  const pasvMin = Number(cfg.pasvMin) || 50000
  const pasvMax = Number(cfg.pasvMax) || 50100
  const clients = new Set()
  const report = () => ctx.state(
    clients.size ? 'connected' : 'listening',
    clients.size ? `Boîtier connecté (${[...clients].map((s) => v4(s.remoteAddress)).join(', ')})` : `En écoute sur le port ${port}`,
  )

  const server = net.createServer((sock) => {
    clients.add(sock); report()
    const st = { user: null, authed: false, fails: 0, cwd: '/', pasv: null, active: null, renameFrom: null }
    const committed = new Map() // chemin virtuel -> id de file (pour RNFR/RNTO)
    const held = new Map()      // chemin virtuel -> fichier temporaire (extension refusée, en attente de renommage)
    const reply = (line) => { if (!sock.destroyed) sock.write(line + '\r\n') }
    const resolve = (p) => path.posix.resolve(st.cwd, (p || '').replace(/\\/g, '/'))

    const closePasv = () => { st.pasv?.server.close(); st.pasv?.socket?.destroy(); st.pasv = null }
    const openPasv = () => new Promise((res, rej) => {
      closePasv()
      const srv = net.createServer()
      const entry = { server: srv, socket: null, waiters: [] }
      srv.on('connection', (d) => {
        // seule l'adresse du canal de commande peut ouvrir le canal de données
        if (v4(d.remoteAddress) !== v4(sock.remoteAddress) || entry.socket) return d.destroy()
        d.pause()
        entry.socket = d
        entry.waiters.splice(0).forEach((w) => w(d))
      })
      let tries = 0
      const span = pasvMax - pasvMin + 1
      const start = crypto.randomInt(span)
      const attempt = () => {
        srv.once('error', (e) => (e.code === 'EADDRINUSE' && ++tries < span ? attempt() : rej(e)))
        srv.listen(pasvMin + ((start + tries) % span), () => { srv.removeAllListeners('error'); st.pasv = entry; res(srv.address().port) })
      }
      attempt()
    })
    const dataSocket = () => new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('data timeout')), 15000)
      const ok = (d) => { clearTimeout(timer); res(d) }
      if (st.pasv) {
        if (st.pasv.socket) ok(st.pasv.socket)
        else st.pasv.waiters.push(ok)
      } else if (st.active) {
        const d = net.connect(st.active.port, st.active.host, () => ok(d))
        d.on('error', (e) => { clearTimeout(timer); rej(e) })
      } else { clearTimeout(timer); rej(new Error('no data connection')) }
    })
    const endData = () => { closePasv(); st.active = null }

    const store = async (arg) => {
      const vpath = resolve(arg)
      let d
      reply('150 Ouverture du canal de données')
      try { d = await dataSocket() } catch { endData(); return reply('425 Canal de données indisponible') }
      const tmp = ctx.queue.tempPath()
      const ws = fs.createWriteStream(tmp)
      const ok = await new Promise((res) => {
        d.on('error', () => res(false))
        ws.on('error', () => res(false))
        ws.on('finish', () => res(true))
        d.pipe(ws)
        d.resume()
      })
      endData()
      if (!ok) { fs.rmSync(tmp, { force: true }); return reply('426 Transfert interrompu') }
      if (accepts(vpath, ctx.exts)) {
        const item = ctx.queue.commit(tmp, { sourceId: ctx.sourceId, name: vpath })
        if (item) { committed.set(vpath, item.id); ctx.file(item) }
      } else {
        held.set(vpath, tmp)
      }
      reply('226 Transfert terminé')
    }

    const emptyList = async () => {
      reply('150 Liste')
      try { (await dataSocket()).end() } catch { endData(); return reply('425 Canal de données indisponible') }
      endData()
      reply('226 Liste terminée')
    }

    const handle = async (line) => {
      const sp = line.indexOf(' ')
      const cmd = (sp < 0 ? line : line.slice(0, sp)).toUpperCase()
      const arg = sp < 0 ? '' : line.slice(sp + 1)
      if (!st.authed && !['USER', 'PASS', 'QUIT', 'FEAT', 'SYST', 'AUTH', 'OPTS', 'NOOP'].includes(cmd)) {
        return reply('530 Identification requise')
      }
      switch (cmd) {
        case 'USER': st.user = arg; st.authed = false; return reply('331 Mot de passe requis')
        case 'PASS':
          if (st.user !== null && same(st.user, cfg.user) && same(arg, cfg.pass)) { st.authed = true; return reply('230 Connecté') }
          reply('530 Identifiants incorrects')
          if (++st.fails >= 3) sock.end()
          return
        case 'QUIT': reply('221 Au revoir'); return sock.end()
        case 'SYST': return reply('215 UNIX Type: L8')
        case 'FEAT': return reply('211-Extensions\r\n EPSV\r\n UTF8\r\n211 Fin')
        case 'OPTS': case 'TYPE': case 'MODE': case 'STRU': case 'NOOP': case 'SITE': return reply('200 OK')
        case 'ALLO': return reply('202 Inutile')
        case 'PWD': case 'XPWD': return reply(`257 "${st.cwd}"`)
        case 'CWD': case 'XCWD': st.cwd = resolve(arg); return reply('250 OK')
        case 'CDUP': case 'XCUP': st.cwd = resolve('..'); return reply('250 OK')
        case 'MKD': case 'XMKD': return reply(`257 "${resolve(arg)}" créé`)
        case 'RMD': case 'XRMD': case 'DELE': return reply('250 OK')
        case 'REST': return reply(arg.trim() === '0' ? '350 OK' : '502 Reprise non prise en charge')
        case 'ABOR': endData(); return reply('226 Annulé')
        case 'PASV': {
          const p = await openPasv().catch(() => null)
          if (!p) return reply('425 Aucun port passif disponible')
          st.active = null
          return reply(`227 Entering Passive Mode (${v4(sock.localAddress).split('.').join(',')},${p >> 8},${p & 255})`)
        }
        case 'EPSV': {
          const p = await openPasv().catch(() => null)
          if (!p) return reply('425 Aucun port passif disponible')
          st.active = null
          return reply(`229 Entering Extended Passive Mode (|||${p}|)`)
        }
        case 'PORT': {
          const n = arg.split(',').map(Number)
          const host = n.slice(0, 4).join('.')
          // anti « FTP bounce » : le canal actif ne vise que le boîtier lui-même
          if (n.length !== 6 || n.some((x) => !(x >= 0 && x <= 255)) || host !== v4(sock.remoteAddress)) return reply('501 Adresse refusée')
          closePasv()
          st.active = { host, port: n[4] * 256 + n[5] }
          return reply('200 OK')
        }
        case 'STOR': return store(arg)
        case 'LIST': case 'NLST': case 'MLSD': return emptyList()
        case 'RNFR': st.renameFrom = resolve(arg); return reply('350 En attente de RNTO')
        case 'RNTO': {
          const from = st.renameFrom, to = resolve(arg)
          st.renameFrom = null
          if (committed.has(from)) {
            ctx.queue.rename(committed.get(from), to)
            committed.set(to, committed.get(from)); committed.delete(from)
          } else if (held.has(from)) {
            const tmp = held.get(from)
            held.delete(from)
            if (accepts(to, ctx.exts)) {
              const item = ctx.queue.commit(tmp, { sourceId: ctx.sourceId, name: to })
              if (item) { committed.set(to, item.id); ctx.file(item) }
            } else held.set(to, tmp)
          } else return reply('550 Fichier inconnu')
          return reply('250 Renommé')
        }
        case 'SIZE': case 'MDTM': case 'RETR': return reply('550 Indisponible')
        default: return reply('502 Commande non prise en charge')
      }
    }

    let buf = ''
    let chain = Promise.resolve()
    sock.setEncoding('utf8')
    sock.on('data', (chunk) => {
      buf += chunk
      if (buf.length > 8192) return sock.destroy()
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '')
        buf = buf.slice(i + 1)
        if (line) chain = chain.then(() => handle(line)).catch(() => reply('451 Erreur interne'))
      }
    })
    sock.on('error', () => {})
    sock.on('close', () => {
      closePasv()
      for (const tmp of held.values()) fs.rmSync(tmp, { force: true })
      clients.delete(sock); report()
    })
    reply('220 DentoPic Bridge')
  })

  server.on('error', (e) => ctx.state('error', e.code === 'EADDRINUSE' ? `Port ${port} déjà utilisé par un autre programme` : e.message))
  server.listen(port, '0.0.0.0', report)

  return {
    stop: () => new Promise((res) => {
      for (const s of clients) s.destroy()
      if (server.listening) server.close(() => res())
      else res()
    }),
  }
}
