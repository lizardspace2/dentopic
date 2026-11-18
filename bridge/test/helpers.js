import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createBridge } from '../src/index.js'

export const ORIGIN = 'http://localhost:5173'
export const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dentopic-bridge-'))
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function bridgeFor(t) {
  const dir = tmpDir()
  const bridge = createBridge({ dir, port: 0 })
  const port = await bridge.ready
  t.after(async () => { await bridge.close(); fs.rmSync(dir, { recursive: true, force: true }) })
  const api = (p, init = {}) => fetch(`http://127.0.0.1:${port}${p}`, {
    ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...init.headers },
  })
  return { bridge, port, api, dir }
}

export async function until(fn, ms = 6000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error('délai dépassé')
    await sleep(50)
  }
}

export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40000, 7), Buffer.from([0xff, 0xd9])])
