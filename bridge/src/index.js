#!/usr/bin/env node
// DentoPic Bridge — petit programme à lancer sur le poste de la salle de soins.
// Il parle aux boîtiers sur le réseau local (aucun Internet requis) et expose
// une API sur 127.0.0.1 que l'application web interroge pour récupérer les photos.
import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Queue } from './queue.js'
import { startFtp } from './ftp.js'
import { startWatch } from './watch.js'
import { startPtpip } from './ptpip.js'
import { startCcapi, startFlashair } from './httpcams.js'

export const VERSION = '0.1.0'
const DRIVERS = { ftp: startFtp, watch: startWatch, ptpip: startPtpip, ccapi: startCcapi, sdcard: startFlashair }
const DEFAULT_ORIGINS = ['https://frontend-for-you.vercel.app']
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const PRIVATE_V4 = /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)\d{1,3}(\.\d{1,3}){1,2}$/

const lanAddresses = () => Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
  (list || []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, address: a.address })))

const tcpOpen = (host, port) => new Promise((res) => {
  const s = net.connect({ host, port })
  const done = (v) => { s.destroy(); res(v) }
  s.setTimeout(1500, () => done(false))
  s.once('connect', () => done(true))
  s.once('error', () => done(false))
})
const httpOk = (url) => fetch(url, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false)

/** Quels protocoles répondent à cette adresse ? (aide au choix de la méthode) */
async function probe(host) {
  const [ptpip, ccapi, sdcard, ftp] = await Promise.all([
    tcpOpen(host, 15740),
    httpOk(`http://${host}:8080/ccapi`),
    httpOk(`http://${host}/command.cgi?op=108`),
    tcpOpen(host, 21),
  ])
  return { host, reachable: ptpip || ccapi || sdcard || ftp, ptpip, ccapi, sdcard, ftpServer: ftp }
}

export function createBridge({ dir = path.join(os.homedir(), '.dentopic-bridge'), port = 47600, origins = [] } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  const queue = new Queue(path.join(dir, 'spool'))
  const allowed = new Set([...DEFAULT_ORIGINS, ...origins])
  const sourcesFile = path.join(dir, 'sources.json')
  const guidFile = path.join(dir, 'guid')
  // identité stable : un boîtier appairé en PTP/IP reconnaît le poste d'une fois sur l'autre
  if (!fs.existsSync(guidFile)) fs.writeFileSync(guidFile, crypto.randomBytes(16))
  const guid = fs.readFileSync(guidFile)

  const sources = new Map() // id -> { def, key, handle, state, detail, received, lastAt }

  const start = (def) => {
    const entry = { def, key: JSON.stringify(def), handle: null, state: 'connecting', detail: '', received: 0, lastAt: null }
    sources.set(def.id, entry)
    const driver = DRIVERS[def.driver]
    if (!driver) { entry.state = 'error'; entry.detail = `Méthode inconnue : ${def.driver}`; return }
    const exts = String(def.config?.exts || '').split(/[\s,;]+/).map((e) => e.replace(/^\./, '').toLowerCase()).filter(Boolean)
    entry.handle = driver(def.config || {}, {
      queue, guid, exts, sourceId: def.id,
      state: (s, detail = '') => {
        if (entry.state !== s || entry.detail !== detail) console.log(`[${def.name || def.id}] ${s} — ${detail}`)
        entry.state = s; entry.detail = detail
      },
      file: (item) => {
        entry.received++; entry.lastAt = item.at
        console.log(`[${def.name || def.id}] reçu ${item.name} (${item.size} octets)`)
      },
    })
  }

  async function sync(list) {
    const wanted = new Map(list.filter((d) => d && typeof d.id === 'string').map((d) => [d.id, d]))
    for (const [id, e] of sources) {
      if (wanted.has(id) && JSON.stringify(wanted.get(id)) === e.key) continue
      await e.handle?.stop()
      sources.delete(id)
    }
    for (const [id, def] of wanted) if (!sources.has(id)) start(def)
    fs.writeFileSync(sourcesFile, JSON.stringify([...wanted.values()]))
  }

  const status = () => ({
    ok: true, version: VERSION, hostname: os.hostname(), addresses: lanAddresses(),
    queue: queue.list().length,
    sources: [...sources.values()].map((e) => ({
      id: e.def.id, driver: e.def.driver, state: e.state, detail: e.detail, received: e.received, lastAt: e.lastAt,
    })),
  })

  const readJson = (req) => new Promise((res, rej) => {
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', () => { try { res(JSON.parse(body || '{}')) } catch (e) { rej(e) } })
    req.on('error', rej)
  })

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    // Garde-fous : hôte local uniquement (anti DNS-rebinding) + origine web autorisée
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(403, { error: 'host' })
    const originOk = origin && (LOCAL_ORIGIN.test(origin) || allowed.has(origin))
    if (origin && !originOk) return send(403, { error: 'origin', hint: `Relancez le Bridge avec --origin ${origin}` })
    if (!origin && req.method !== 'GET') return send(403, { error: 'origin' })
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
      res.setHeader('Access-Control-Max-Age', '600')
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

    const url = new URL(req.url, 'http://127.0.0.1')
    const file = url.pathname.match(/^\/files\/([0-9a-f-]{36})$/)
    try {
      if (req.method === 'GET' && url.pathname === '/status') return send(200, status())
      if (req.method === 'GET' && url.pathname === '/queue') return send(200, queue.list())
      if (req.method === 'PUT' && url.pathname === '/sources') {
        const body = await readJson(req)
        if (!Array.isArray(body.sources)) return send(400, { error: 'sources' })
        await sync(body.sources)
        return send(200, status())
      }
      if (req.method === 'POST' && url.pathname === '/probe') {
        const { host } = await readJson(req)
        if (!PRIVATE_V4.test(host || '') || !net.isIPv4(host)) return send(400, { error: 'Adresse IP locale attendue (ex. 192.168.1.20)' })
        return send(200, await probe(host))
      }
      if (file && req.method === 'GET') {
        const item = queue.get(file[1])
        if (!item) return send(404, { error: 'not found' })
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': item.size, 'Cache-Control': 'no-store' })
        return fs.createReadStream(queue.filePath(item.id)).pipe(res)
      }
      if (file && req.method === 'DELETE') return send(queue.remove(file[1]) ? 200 : 404, { ok: true })
      send(404, { error: 'not found' })
    } catch (e) {
      send(400, { error: e.message })
    }
  })

  const ready = new Promise((res, rej) => {
    server.once('error', rej)
    // 127.0.0.1 uniquement : l'API de pilotage n'est jamais exposée au réseau
    server.listen(port, '127.0.0.1', async () => {
      try { await sync(JSON.parse(fs.readFileSync(sourcesFile, 'utf8'))) } catch { /* pas encore de sources */ }
      res(server.address().port)
    })
  })

  return {
    ready, queue, sync, status,
    close: async () => {
      for (const e of sources.values()) await e.handle?.stop()
      sources.clear()
      await new Promise((r) => server.close(r))
    },
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const opt = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []))
  const bridge = createBridge({
    dir: opt('dir')[0] || process.env.DENTOPIC_BRIDGE_DIR || undefined,
    port: Number(opt('port')[0] || process.env.DENTOPIC_BRIDGE_PORT) || 47600,
    origins: [...opt('origin'), ...(process.env.DENTOPIC_BRIDGE_ORIGINS || '').split(',').filter(Boolean)],
  })
  bridge.ready.then((p) => {
    console.log(`DentoPic Bridge ${VERSION} — prêt sur http://127.0.0.1:${p}`)
    for (const a of lanAddresses()) console.log(`  adresse de ce poste (${a.name}) : ${a.address}`)
    console.log('Laissez cette fenêtre ouverte pendant les prises de vues.')
  }, (e) => {
    console.error(e.code === 'EADDRINUSE' ? 'Le Bridge est déjà lancé sur ce poste.' : e.message)
    process.exit(1)
  })
}
