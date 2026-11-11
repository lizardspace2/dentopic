// Export d'une présentation vers PDF / PowerPoint / Word / PNG / JPG / WebP.
// Les diapos sont rasterisées sur un canvas 2D hors-écran en reproduisant le
// rendu du canevas (SlideElements) : fond, images, formes, textes, repères.
// Les librairies lourdes (jspdf, pptxgenjs, docx, jszip) sont importées à la
// demande pour ne pas alourdir le bundle principal.
import { photoUrl } from './media'
import { slideElements, slideBg } from './components/SlideElements'

export const EXPORT_W = 1920
export const EXPORT_H = 1080

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

// Polygones des formes — mêmes sommets que les clip-path CSS de SlideElements.
const SHAPE_PTS = {
  triangle: [[50, 0], [100, 100], [0, 100]],
  diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
  arrow: [[0, 28], [60, 28], [60, 0], [100, 50], [60, 100], [60, 72], [0, 72]],
  star: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]],
  hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
}

// ---- chargement des médias ---------------------------------------------------

// Résout un storage_path (signed URL) ou une URL directe, puis charge l'image
// via un blob — évite tout problème de « canvas souillé » lié au CORS.
const imgCache = new Map()
async function loadImage(path) {
  try {
    if (imgCache.has(path)) return imgCache.get(path)
    const url = /^https?:\/\//.test(path) ? path : await photoUrl(path)
    if (!url) return null
    const res = await fetch(url)
    if (!res.ok) return null
    const obj = URL.createObjectURL(await res.blob())
    const img = new Image()
    const p = new Promise((resolve) => {
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
    }).finally(() => URL.revokeObjectURL(obj))
    img.src = obj
    imgCache.set(path, p)
    return p
  } catch { return null }
}

// Première frame d'une vidéo (poster). Null si illisible → placeholder dessiné.
async function videoFrame(url, timeout = 5000) {
  try {
    const src = /^https?:\/\//.test(url) ? url : await photoUrl(url)
    if (!src) return null
    return await new Promise((resolve) => {
      const v = document.createElement('video')
      v.crossOrigin = 'anonymous'
      v.muted = true
      v.preload = 'auto'
      const to = setTimeout(() => resolve(null), timeout)
      v.addEventListener('loadeddata', () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 4) })
      v.addEventListener('seeked', () => { clearTimeout(to); resolve(v) })
      v.addEventListener('error', () => { clearTimeout(to); resolve(null) })
      v.src = src
    })
  } catch { return null }
}

// ---- primitives de dessin ----------------------------------------------------

function drawFit(ctx, img, x, y, w, h, fit = 'contain') {
  const iw = img.videoWidth || img.naturalWidth || img.width
  const ih = img.videoHeight || img.naturalHeight || img.height
  if (!iw || !ih) return
  const s = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
  const dw = iw * s
  const dh = ih * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function wrapLines(ctx, text, maxW) {
  const lines = []
  for (const raw of String(text || '').split('\n')) {
    const words = raw.split(/\s+/).filter(Boolean)
    if (!words.length) { lines.push(''); continue }
    let line = ''
    for (const word of words) {
      const t = line ? `${line} ${word}` : word
      if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = word }
      else line = t
    }
    lines.push(line)
  }
  return lines
}

function shapePath(ctx, kind, w, h, radius) {
  ctx.beginPath()
  if (kind === 'pill' || (kind === 'rect' && radius)) {
    const r = kind === 'pill' ? h / 2 : Math.min(h * 0.12, w * 0.12, 14)
    ctx.roundRect(0, 0, w, h, r)
  } else if (kind === 'ellipse') {
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  } else if (SHAPE_PTS[kind]) {
    SHAPE_PTS[kind].forEach(([px, py], i) =>
      i ? ctx.lineTo((px / 100) * w, (py / 100) * h) : ctx.moveTo((px / 100) * w, (py / 100) * h))
    ctx.closePath()
  } else {
    ctx.rect(0, 0, w, h) // rect, ligne
  }
}

// ---- rendu d'un élément ------------------------------------------------------

async function drawElement(ctx, el, W, H) {
  const x = (el.x / 100) * W
  const y = (el.y / 100) * H
  const w = (el.w / 100) * W
  const h = (el.h / 100) * H
  ctx.save()
  if (el.rot) {
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate((el.rot * Math.PI) / 180)
    ctx.translate(-x - w / 2, -y - h / 2)
  }
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  if (el.t === 'img') {
    const img = el.path && (await loadImage(el.path))
    if (img) {
      ctx.translate(x, y)
      if (el.radius) { ctx.save(); shapePath(ctx, 'rect', w, h, true); ctx.clip() }
      drawFit(ctx, img, 0, 0, w, h, el.fit)
      if (el.radius) ctx.restore()
      ctx.translate(-x, -y)
    } else {
      ctx.fillStyle = '#1e293b'; ctx.fillRect(x, y, w, h)
    }
  } else if (el.t === 'video') {
    const v = el.url && (await videoFrame(el.url))
    if (v) {
      ctx.translate(x, y)
      drawFit(ctx, v, 0, 0, w, h, 'contain')
      ctx.translate(-x, -y)
    } else {
      ctx.fillStyle = '#0f172a'; ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#64748b'
      ctx.font = `400 ${Math.round(h * 0.09)}px ${FONT}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('▶ Vidéo', x + w / 2, y + h / 2)
    }
  } else if (el.t === 'marker') {
    const d = h // pastille : aspect-ratio 1 ancré sur la hauteur, centré
    const cx = x + w / 2
    const cy = y + d / 2
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6
    ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
    ctx.fillStyle = el.fill || '#ef4444'; ctx.fill()
    ctx.shadowBlur = 0
    ctx.lineWidth = Math.max(2, d * 0.03); ctx.strokeStyle = '#fff'; ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(d * 0.42)}px ${FONT}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(el.label || '?'), cx, cy + d * 0.02)
  } else if (el.t === 'shape') {
    ctx.translate(x, y)
    ctx.globalAlpha = el.opacity ?? 1
    ctx.fillStyle = el.fill || '#0d9488'
    shapePath(ctx, el.shape || 'rect', w, h, el.radius)
    ctx.fill()
  } else { // texte
    const px = Math.max(6, ((el.size || 5) / 100) * H)
    ctx.font = `${el.bold ? '700' : '400'} ${px}px ${FONT}`
    ctx.textBaseline = 'top'
    const lines = wrapLines(ctx, el.text, w)
    const lh = px * 1.25
    ctx.fillStyle = el.color || '#f1f5f9'
    if (el.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6 }
    const maxLines = Math.max(1, Math.floor(h / lh))
    lines.slice(0, maxLines).forEach((ln, i) => {
      ctx.textAlign = el.align === 'center' ? 'center' : el.align === 'right' ? 'right' : 'left'
      const tx = el.align === 'center' ? x + w / 2 : el.align === 'right' ? x + w : x
      ctx.fillText(ln, tx, y + i * lh)
    })
  }
  ctx.restore()
}

// ---- rasterisation d'une diapo ------------------------------------------------

export async function renderSlide(s, W = EXPORT_W, H = EXPORT_H) {
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')
  ctx.fillStyle = s.type === 'text' ? '#1e3a5f' : '#0b1120'
  ctx.fillRect(0, 0, W, H)
  const bg = slideBg(s)
  if (bg?.c) { ctx.fillStyle = bg.c; ctx.fillRect(0, 0, W, H) }
  if (bg?.g) {
    const cols = bg.g.match(/#[0-9a-f]{3,8}/gi) || []
    const gr = ctx.createLinearGradient(0, 0, W, H) // dégradés de l'app = 135deg
    cols.forEach((c, i) => gr.addColorStop(cols.length > 1 ? i / (cols.length - 1) : 0, c))
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
  }
  if (bg?.path) {
    const img = await loadImage(bg.path)
    if (img) drawFit(ctx, img, 0, 0, W, H, 'cover')
  }
  for (const el of [...slideElements(s)].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))) {
    await drawElement(ctx, el, W, H)
  }
  return cv
}

// ---- téléchargement / sérialisation -------------------------------------------

function slug(name) {
  return (name || 'presentation').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'presentation'
}

function download(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

const toBlob = (cv, mime, q) => new Promise((res) => cv.toBlob(res, mime, q))

function dataUrlBytes(d) {
  const bin = atob(d.split(',')[1])
  const a = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i)
  return a
}

// ---- export multi-formats -----------------------------------------------------
// fmt : 'pdf' | 'pptx' | 'docx' | 'png' | 'jpg' | 'webp'
export async function exportPresentation(pres, slides, fmt, onProgress) {
  const name = slug(pres?.name)
  const cvs = []
  for (const [i, s] of slides.entries()) {
    cvs.push(await renderSlide(s))
    onProgress?.(i + 1, slides.length)
  }
  imgCache.clear()

  if (MIME[fmt]) {
    const ext = fmt === 'jpg' ? 'jpg' : fmt
    const blobs = []
    for (const cv of cvs) blobs.push(await toBlob(cv, MIME[fmt], 0.92))
    if (blobs.length === 1) {
      download(blobs[0], `${name}.${ext}`)
    } else {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      blobs.forEach((b, i) => zip.file(`${name}-diapo-${String(i + 1).padStart(2, '0')}.${ext}`, b))
      download(await zip.generateAsync({ type: 'blob' }), `${name}.zip`)
    }
    return
  }

  if (fmt === 'pdf') {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [320, 180] })
    cvs.forEach((cv, i) => {
      if (i) doc.addPage([320, 180], 'landscape')
      doc.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 320, 180)
    })
    doc.save(`${name}.pdf`)
    return
  }

  if (fmt === 'pptx') {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'W16x9', width: 13.333, height: 7.5 })
    pptx.layout = 'W16x9'
    for (const cv of cvs) {
      pptx.addSlide().addImage({ data: cv.toDataURL('image/png'), x: 0, y: 0, w: 13.333, h: 7.5 })
    }
    await pptx.writeFile({ fileName: `${name}.pptx` })
    return
  }

  if (fmt === 'docx') {
    const { Document, Packer, Paragraph, ImageRun } = await import('docx')
    const doc = new Document({
      sections: [{
        children: cvs.map((cv, i) => new Paragraph({
          pageBreakBefore: i > 0,
          children: [new ImageRun({
            type: 'png',
            data: dataUrlBytes(cv.toDataURL('image/png')),
            transformation: { width: 640, height: 360 },
          })],
        })),
      }],
    })
    download(await Packer.toBlob(doc), `${name}.docx`)
  }
}
