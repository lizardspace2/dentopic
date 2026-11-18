// Client du « DentoPic Bridge » : programme local (dossier bridge/ du dépôt) qui
// reçoit les photos des boîtiers sur le réseau du cabinet, sans Internet.
// Un navigateur ne peut ni héberger un serveur FTP ni parler PTP/IP : le Bridge
// le fait et expose une API sur 127.0.0.1 que ces fonctions interrogent.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://127.0.0.1:47600'
export const BRIDGE_START_CMD = () => `node bridge/src/index.js --origin ${window.location.origin}`

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
  heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', mp4: 'video/mp4', mov: 'video/quicktime',
}

async function call(path, init = {}) {
  const res = await fetch(BRIDGE_URL + path, {
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    signal: AbortSignal.timeout(init.timeout || 4000),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error || `Bridge : ${res.status}`), { status: res.status })
  return body
}

export const bridgeStatus = () => call('/status')
export const bridgeQueue = () => call('/queue')
export const bridgeSync = (sources) => call('/sources', { method: 'PUT', body: JSON.stringify({ sources }) })
export const bridgeAck = (id) => call(`/files/${id}`, { method: 'DELETE' })
export const bridgeProbe = (host) => call('/probe', { method: 'POST', body: JSON.stringify({ host }), timeout: 8000 })

/** Photo en attente dans le Bridge -> File prêt pour importPhotos() */
export async function bridgeFile(item) {
  const res = await fetch(`${BRIDGE_URL}/files/${item.id}`, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`Bridge : ${res.status}`)
  const ext = (item.name.split('.').pop() || '').toLowerCase()
  return new File([await res.blob()], item.name, { type: MIME[ext] || 'application/octet-stream' })
}

// ---- Liaison d'un appareil (capture_devices.metadata.link) ----------------------

/** Liaison Bridge d'un appareil, y compris les fiches créées avant metadata.link. */
export function deviceLink(dev) {
  const m = dev?.metadata || {}
  if (m.link?.method) return m.link
  if (m.kind === 'ftp' || m.liaison === 'ftp') return { method: 'ftp', port: '2121', user: m.ftp?.user || 'dentopic', pass: '' }
  if (m.kind === 'watch' || m.liaison === 'watch') return { method: 'watch', path: m.watch?.path || '', exts: m.watch?.exts || '' }
  if (m.liaison === 'sdcard' || m.conn === 'sd') return { method: 'sdcard', host: '' }
  if (m.conn === 'ptp') return { method: 'ptpip', host: '' }
  return { method: 'none' }
}

/** Appareil -> source pilotée par le Bridge (null si l'appareil n'en a pas besoin) */
export function toBridgeSource(dev) {
  const l = deviceLink(dev)
  const base = { id: dev.id, name: dev.name, driver: l.method }
  const exts = l.exts || undefined
  switch (l.method) {
    case 'ftp': return l.pass ? { ...base, config: { port: Number(l.port) || 2121, user: l.user || 'dentopic', pass: l.pass, exts } } : null
    case 'watch': return l.path ? { ...base, config: { path: l.path, exts } } : null
    case 'ptpip': return l.host ? { ...base, config: { host: l.host, port: Number(l.port) || 15740, exts } } : null
    case 'ccapi': return l.host ? { ...base, config: { host: l.host, port: Number(l.port) || 8080, exts } } : null
    case 'sdcard': return l.host ? { ...base, config: { host: l.host, exts } } : null
    default: return null
  }
}

export const isBridgeDevice = (dev) => !!toBridgeSource(dev)

/**
 * État du Bridge + synchronisation des appareils du cabinet.
 * `devices` : liste capture_devices (null tant qu'elle n'est pas chargée).
 * Renvoie { up, status, live: { [deviceId]: { state, detail, received } }, refresh }.
 */
export function useBridge(devices) {
  const [status, setStatus] = useState(null) // null = inconnu · false = absent · objet = actif
  const [error, setError] = useState(null)
  const wanted = useMemo(() => (devices ? devices.map(toBridgeSource).filter(Boolean) : null), [devices])
  const wantedKey = wanted ? JSON.stringify(wanted) : null
  const sent = useRef(null)

  const refresh = useCallback(async () => {
    try { setStatus(await bridgeStatus()); setError(null) }
    catch (e) { setStatus(false); setError(e.status === 403 ? 'origin' : 'down'); sent.current = null }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  // Le Bridge applique exactement la liste des appareils du cabinet
  useEffect(() => {
    if (!status || !wanted || sent.current === wantedKey) return
    sent.current = wantedKey
    bridgeSync(wanted).then(setStatus).catch(() => { sent.current = null })
  }, [status, wantedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(
    () => Object.fromEntries((status?.sources || []).map((s) => [s.id, s])),
    [status],
  )
  return { up: !!status, status, error, live, refresh }
}

/** Statut affiché d'un appareil : l'état réel du Bridge prime sur la valeur en base. */
export function withLiveStatus(devices, bridge) {
  return devices.map((d) => {
    if (!isBridgeDevice(d)) return d
    const s = bridge.live[d.id]?.state
    return { ...d, status: bridge.up && (s === 'listening' || s === 'connected') ? 'online' : 'offline' }
  })
}
