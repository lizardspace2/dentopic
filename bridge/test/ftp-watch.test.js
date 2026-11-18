import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { bridgeFor, tmpDir, until, JPEG, sleep } from './helpers.js'

const run = promisify(execFile)
const FTP_PORT = 2990 + Math.floor(Math.random() * 500)
const ftpSource = { id: 'ftp1', name: 'FTP test', driver: 'ftp', config: { port: FTP_PORT, user: 'dentopic', pass: 's3cret', pasvMin: 50200, pasvMax: 50220 } }

test('FTP : un vrai client (curl) dépose une photo, récupérée puis acquittée par l’API', async (t) => {
  const { api, dir } = await bridgeFor(t)
  const st = await (await api('/sources', { method: 'PUT', body: JSON.stringify({ sources: [ftpSource] }) })).json()
  assert.equal(st.sources[0].driver, 'ftp')
  await until(async () => (await (await api('/status')).json()).sources[0].state === 'listening')

  const src = path.join(dir, 'IMG_0001.JPG')
  fs.writeFileSync(src, JPEG)
  await run('curl', ['-sS', '--ftp-create-dirs', '-T', src, `ftp://dentopic:s3cret@127.0.0.1:${FTP_PORT}/DCIM/100CANON/IMG_0001.JPG`])
  // mode étendu désactivé -> PASV classique, comme la plupart des boîtiers
  await run('curl', ['-sS', '--disable-epsv', '-T', src, `ftp://dentopic:s3cret@127.0.0.1:${FTP_PORT}/IMG_0002.JPG`])
  // extension non photo : acceptée par le protocole mais jamais mise en file
  await run('curl', ['-sS', '-T', src, `ftp://dentopic:s3cret@127.0.0.1:${FTP_PORT}/notes.txt`])

  const q = await (await api('/queue')).json()
  assert.deepEqual(q.map((i) => i.name).sort(), ['IMG_0001.JPG', 'IMG_0002.JPG'])
  assert.equal(q[0].sourceId, 'ftp1')
  const bytes = Buffer.from(await (await api(`/files/${q[0].id}`)).arrayBuffer())
  assert.ok(bytes.equals(JPEG))
  assert.equal((await api(`/files/${q[0].id}`, { method: 'DELETE' })).status, 200)
  assert.equal((await (await api('/queue')).json()).length, 1)
  assert.equal((await (await api('/status')).json()).sources[0].received, 2)
})

test('FTP : mauvais mot de passe refusé, rien n’entre dans la file', async (t) => {
  const { api, dir } = await bridgeFor(t)
  await api('/sources', { method: 'PUT', body: JSON.stringify({ sources: [{ ...ftpSource, config: { ...ftpSource.config, port: FTP_PORT + 1 } }] }) })
  await sleep(200)
  const src = path.join(dir, 'x.jpg')
  fs.writeFileSync(src, JPEG)
  await assert.rejects(run('curl', ['-sS', '-T', src, `ftp://dentopic:faux@127.0.0.1:${FTP_PORT + 1}/x.jpg`]))
  assert.equal((await (await api('/queue')).json()).length, 0)
})

test('Dossier surveillé : seules les nouvelles photos sont importées', async (t) => {
  const { api } = await bridgeFor(t)
  const watched = tmpDir()
  t.after(() => fs.rmSync(watched, { recursive: true, force: true }))
  fs.writeFileSync(path.join(watched, 'ancienne.jpg'), JPEG)
  await api('/sources', { method: 'PUT', body: JSON.stringify({ sources: [{ id: 'w1', driver: 'watch', config: { path: watched, interval: 80 } }] }) })
  await until(async () => (await (await api('/status')).json()).sources[0].state === 'listening')
  await sleep(200)
  fs.mkdirSync(path.join(watched, '2026-11-17'))
  fs.writeFileSync(path.join(watched, '2026-11-17', 'DSC_0042.JPG'), JPEG)
  fs.writeFileSync(path.join(watched, 'DSC_0042.NEF'), JPEG)
  const q = await until(async () => { const l = await (await api('/queue')).json(); return l.length ? l : null })
  await sleep(400)
  assert.deepEqual((await (await api('/queue')).json()).map((i) => i.name), ['DSC_0042.JPG'])
  assert.equal(q[0].size, JPEG.length)
})

test('Dossier surveillé : dossier absent -> erreur lisible', async (t) => {
  const { api } = await bridgeFor(t)
  await api('/sources', { method: 'PUT', body: JSON.stringify({ sources: [{ id: 'w2', driver: 'watch', config: { path: path.join(tmpDir(), 'absent'), interval: 80 } }] }) })
  const s = await until(async () => { const x = (await (await api('/status')).json()).sources[0]; return x.state === 'error' ? x : null })
  assert.match(s.detail, /introuvable/)
})

test('API : origine inconnue, hôte non local et écriture sans origine sont refusés', async (t) => {
  const { api, port } = await bridgeFor(t)
  assert.equal((await api('/status', { headers: { Origin: 'https://evil.example' } })).status, 403)
  assert.equal((await fetch(`http://127.0.0.1:${port}/sources`, { method: 'PUT', body: '{"sources":[]}' })).status, 403)
  assert.equal((await api('/probe', { method: 'POST', body: JSON.stringify({ host: '8.8.8.8' }) })).status, 400)
  const pre = await api('/sources', { method: 'OPTIONS' })
  assert.equal(pre.headers.get('access-control-allow-private-network'), 'true')
})
