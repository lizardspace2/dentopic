// PTP/IP, CCAPI et FlashAir sont vérifiés contre des SIMULATEURS écrits d'après
// les spécifications publiques — pas contre de vrais boîtiers.
import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import http from 'node:http'
import { bridgeFor, until, JPEG } from './helpers.js'
import { PacketStream, packet } from '../src/ptpip.js'

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)))
const put = (api, sources) => api('/sources', { method: 'PUT', body: JSON.stringify({ sources }) })
const names = async (api) => (await (await api('/queue')).json()).map((i) => i.name)

function fakePtpCamera() {
  const objects = new Map([[1, { name: 'DCIM', folder: true }], [2, { name: 'DSC_0001.JPG', data: JPEG }]])
  let evtSock = null
  const u32 = (...v) => { const b = Buffer.alloc(4 * v.length); v.forEach((x, i) => b.writeUInt32LE(x, 4 * i)); return b }
  const srv = net.createServer(async (sock) => {
    const ps = new PacketStream(sock)
    const first = await ps.read().catch(() => null)
    if (!first) return
    if (first.type === 3) { evtSock = sock; return sock.write(packet(4)) }
    sock.write(packet(2, Buffer.concat([u32(1), Buffer.alloc(16, 9), Buffer.from('Z 6II\0', 'utf16le'), u32(0x10000)])))
    for (;;) {
      const p = await ps.read().catch(() => null)
      if (!p) return
      const code = p.payload.readUInt16LE(4), tid = p.payload.readUInt32LE(6)
      const param = p.payload.length >= 14 ? p.payload.readUInt32LE(10) : 0
      const res = (rc) => { const b = Buffer.alloc(6); b.writeUInt16LE(rc, 0); b.writeUInt32LE(tid, 2); sock.write(packet(7, b)) }
      const data = (d) => {
        const len = Buffer.alloc(8); len.writeBigUInt64LE(BigInt(d.length))
        sock.write(packet(9, Buffer.concat([u32(tid), len])))
        const half = Math.floor(d.length / 2) // deux paquets, comme un vrai transfert fragmenté
        sock.write(packet(10, Buffer.concat([u32(tid), d.subarray(0, half)])))
        sock.write(packet(12, Buffer.concat([u32(tid), d.subarray(half)])))
      }
      const o = objects.get(param)
      if (code === 0x1002) res(0x2001)
      else if (code === 0x1007) { data(u32(objects.size, ...objects.keys())); res(0x2001) }
      else if (code === 0x1008 && o) {
        const info = Buffer.alloc(52)
        info.writeUInt16LE(o.folder ? 0x3001 : 0x3801, 4)
        info.writeUInt32LE(o.data?.length || 0, 8)
        const s = Buffer.from(o.name + '\0', 'utf16le')
        data(Buffer.concat([info, Buffer.from([s.length / 2]), s, Buffer.from([0, 0, 0])])); res(0x2001)
      } else if (code === 0x1009 && o?.data) { data(o.data); res(0x2001) }
      else res(0x2009)
    }
  })
  return {
    srv,
    shoot(handle, name, announce) {
      objects.set(handle, { name, data: JPEG })
      if (announce) { const b = Buffer.alloc(10); b.writeUInt16LE(0x4002, 0); b.writeUInt32LE(handle, 6); evtSock.write(packet(8, b)) }
    },
  }
}

test('PTP/IP (simulateur) : nouvelles photos rapatriées par événement et par relevé', async (t) => {
  const { api } = await bridgeFor(t)
  const cam = fakePtpCamera()
  const port = await listen(cam.srv)
  t.after(() => cam.srv.close())
  await put(api, [{ id: 'p1', driver: 'ptpip', config: { host: '127.0.0.1', port, interval: 100 } }])
  await until(async () => (await (await api('/status')).json()).sources[0].state === 'connected')
  await new Promise((r) => setTimeout(r, 300))
  assert.deepEqual(await names(api), []) // la photo déjà présente sur la carte n'est pas réimportée
  cam.shoot(3, 'DSC_0002.JPG', true)   // annoncée par événement ObjectAdded
  cam.shoot(4, 'DSC_0003.JPG', false)  // découverte par relevé périodique
  cam.shoot(5, 'DSC_0003.NEF', false)  // RAW : ignoré
  await until(async () => (await names(api)).length >= 2)
  assert.deepEqual((await names(api)).sort(), ['DSC_0002.JPG', 'DSC_0003.JPG'])
  const q = await (await api('/queue')).json()
  assert.ok(Buffer.from(await (await api(`/files/${q[0].id}`)).arrayBuffer()).equals(JPEG))
})

test('PTP/IP : boîtier éteint -> erreur lisible, pas de plantage', async (t) => {
  const { api } = await bridgeFor(t)
  await put(api, [{ id: 'p2', driver: 'ptpip', config: { host: '127.0.0.1', port: 1 } }])
  const s = await until(async () => { const x = (await (await api('/status')).json()).sources[0]; return x.state === 'error' ? x : null })
  assert.match(s.detail, /injoignable/)
})

test('Canon CCAPI (simulateur) : addedcontents téléchargés', async (t) => {
  const { api } = await bridgeFor(t)
  let pending = ['/ccapi/ver100/contents/sd/100CANON/IMG_0001.JPG'] // état initial : ignoré
  const srv = http.createServer((req, res) => {
    if (req.url === '/ccapi/ver100/event/polling') { res.end(JSON.stringify({ addedcontents: pending })); pending = [] }
    else if (req.url.startsWith('/ccapi/ver100/contents/')) res.end(JPEG)
    else { res.statusCode = 404; res.end() }
  })
  const port = await listen(srv)
  t.after(() => srv.close())
  await put(api, [{ id: 'c1', driver: 'ccapi', config: { host: '127.0.0.1', port, interval: 80 } }])
  await until(async () => (await (await api('/status')).json()).sources[0].state === 'connected')
  pending = ['/ccapi/ver100/contents/sd/100CANON/IMG_0002.JPG', '/ccapi/ver100/contents/sd/100CANON/IMG_0002.CR3']
  await until(async () => (await names(api)).length)
  assert.deepEqual(await names(api), ['IMG_0002.JPG'])
})

test('Carte SD Wi-Fi FlashAir (simulateur) : nouvelles photos relevées', async (t) => {
  const { api } = await bridgeFor(t)
  const files = ['IMG_0001.JPG']
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    const dir = u.searchParams.get('DIR')
    if (u.pathname === '/command.cgi' && dir === '/DCIM') res.end('WLANSD_FILELIST\r\n/DCIM,100__TSB,0,16,19000,30000\r\n')
    else if (u.pathname === '/command.cgi') res.end('WLANSD_FILELIST\r\n' + files.map((f) => `${dir},${f},${JPEG.length},32,19000,30000\r\n`).join(''))
    else res.end(JPEG)
  })
  const port = await listen(srv)
  t.after(() => srv.close())
  await put(api, [{ id: 's1', driver: 'sdcard', config: { host: `127.0.0.1:${port}`, interval: 80 } }])
  await until(async () => (await (await api('/status')).json()).sources[0].state === 'connected')
  files.push('IMG_0002.JPG')
  await until(async () => (await names(api)).length)
  assert.deepEqual(await names(api), ['IMG_0002.JPG'])
})
