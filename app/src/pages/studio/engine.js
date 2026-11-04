// Moteur du Studio — édition bitmap façon Photoshop, en Canvas 2D pur.
// Un document = pile de calques ({name, canvas, visible, opacity, dx, dy})
// + un calque de réglage global (filtres) + historique annuler/rétablir.
// Aucun état React ici : la page pilote le moteur et force un re-render.

export const DEFAULT_ADJUST = {
  brightness: 100, contrast: 100, saturate: 100,
  hue: 0, blur: 0, grayscale: 0, sepia: 0, invert: 0,
  // Niveaux : in-black 0..254, gamma x100 (100=1.0), in-white 1..255
  inBlack: 0, gamma: 100, inWhite: 255,
  // Niveaux de sortie : plancher/plafond de la sortie (0..255)
  outBlack: 0, outWhite: 255,
  // Exposition en EV (-3..+3) et balance des blancs (temp/teinte -100..+100)
  exposure: 0, temp: 0, tint: 0,
  // Netteté (unsharp 0..100)
  sharp: 0,
}

// Styles de calque (fx) — copie du dialogue « Style de calque » de Photoshop.
// Chaque effet : on + paramètres ; rendu non destructif au composite.
export const DEFAULT_FX = {
  shadow: { on: false, blend: 'multiply', color: '#000000', opacity: 65, angle: 120, dist: 8, spread: 0, size: 10 },
  innerShadow: { on: false, blend: 'multiply', color: '#000000', opacity: 60, angle: 120, dist: 6, spread: 0, size: 12 },
  glow: { on: false, blend: 'screen', color: '#4f8fe8', opacity: 80, spread: 0, size: 18, range: 60 },
  innerGlow: { on: false, blend: 'screen', color: '#ffffff', opacity: 60, spread: 0, size: 16, range: 60 },
  bevel: { on: false, size: 6, opacity: 60 },
  satin: { on: false, opacity: 40, size: 14 },
  colorOverlay: { on: false, blend: 'source-over', color: '#dc2626', opacity: 60 },
  gradientOverlay: { on: false, blend: 'source-over', from: '#111827', to: '#ffffff', angle: 90, opacity: 60 },
  stroke: { on: false, blend: 'source-over', color: '#4f8fe8', size: 4, opacity: 100 },
}

// ---- Calques de réglage (non destructifs, façon photocraft/Photoshop) -----------
// Un calque {type:'adjust', adj:{kind, params}} transforme le composite des
// calques situés SOUS lui ; les calques au-dessus ne sont pas affectés.
export const ADJUST_KINDS = [
  { key: 'bc', label: 'Luminosité / Contraste' },
  { key: 'hsl', label: 'Teinte / Saturation' },
  { key: 'levels', label: 'Niveaux' },
  { key: 'curves', label: 'Courbes' },
  { key: 'invert', label: 'Négatif' },
  { key: 'bw', label: 'Noir & blanc' },
  { key: 'threshold', label: 'Seuil' },
  { key: 'photoFilter', label: 'Filtre photo' },
  { key: 'vibrance', label: 'Vibrance' },
  { key: 'posterize', label: 'Postérisation' },
]

export const ADJUST_PARAMS = {
  bc: {
    brightness: 0, contrast: 0, // -100..100
  },
  hsl: { hue: 0, sat: 0, light: 0, colorize: false }, // -180..180 / -100..100 (hue/sat absolus si colorize)
  levels: { inBlack: 0, inWhite: 255, gamma: 100, outBlack: 0, outWhite: 255, ch: 'rgb' },
  curves: { rgb: null, r: null, g: null, b: null },
  invert: {},
  bw: { r: 40, g: 60, b: 20 },                     // poids relatifs des canaux
  threshold: { level: 128 },
  photoFilter: { color: '#c8872a', density: 25 },
  vibrance: { amount: 40, sat: 0 },                // vibrance + saturation globale
  posterize: { levels: 4 },
}

/** Applique un calque de réglage à un canvas (en place). */
export function applyAdjust(cv, adj) {
  if (!adj?.kind) return cv
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const p = adj.params || {}
  switch (adj.kind) {
    case 'bc': {
      const b = (p.brightness || 0) * 2.55
      const c = Math.max(-100, Math.min(100, p.contrast || 0))
      const f = (259 * (c + 255)) / (255 * (259 - c))
      applyLUTs(cv, { rgb: chanLUT(f, 128 * (1 - f) + b) })
      break
    }
    case 'hsl': {
      const d = ctx.getImageData(0, 0, W, H), px = d.data
      const dl = (p.light || 0) / 100
      if (p.colorize) {
        // Colorier : teinte 0-360 et saturation 0-100 imposées, luminance conservée
        const hue = ((p.hue || 0) % 360 + 360) % 360, sat = Math.max(0, Math.min(1, (p.sat ?? 25) / 100))
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 4) continue
          let v = Math.max(px[i], px[i + 1], px[i + 2]) / 255
          v = Math.max(0, Math.min(1, dl > 0 ? v + (1 - v) * dl : v * (1 + dl)))
          const [r, g, bb] = hsvToRgb(hue, sat, v)
          px[i] = r; px[i + 1] = g; px[i + 2] = bb
        }
      } else {
        const dh = (p.hue || 0) / 360, ds = (p.sat || 0) / 100
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 4) continue
          let { h, s, v } = rgbToHsv(px[i], px[i + 1], px[i + 2])
          h = (h / 360 + dh + 1) % 1 * 360
          s = Math.max(0, Math.min(1, s * (1 + ds)))
          v = Math.max(0, Math.min(1, dl > 0 ? v + (1 - v) * dl : v * (1 + dl)))
          const [r, g, bb] = hsvToRgb(h, s, v)
          px[i] = r; px[i + 1] = g; px[i + 2] = bb
        }
      }
      ctx.putImageData(d, 0, 0)
      break
    }
    case 'levels': {
      const lut = levelsLUT(p.inBlack ?? 0, p.inWhite ?? 255, p.gamma ?? 100, p.outBlack ?? 0, p.outWhite ?? 255)
      const ch = ['r', 'g', 'b'].includes(p.ch) ? p.ch : 'rgb'
      applyLUTs(cv, { [ch]: lut })
      break
    }
    case 'curves':
      applyLUTs(cv, { rgb: p.rgb ? curveLUT(p.rgb) : null, r: p.r ? curveLUT(p.r) : null, g: p.g ? curveLUT(p.g) : null, b: p.b ? curveLUT(p.b) : null })
      break
    case 'invert': {
      const inv = new Uint8ClampedArray(256)
      for (let i = 0; i < 256; i++) inv[i] = 255 - i
      applyLUTs(cv, { rgb: inv })
      break
    }
    case 'bw': {
      const d = ctx.getImageData(0, 0, W, H), px = d.data
      const wr = Math.max(0, p.r ?? 40), wg = Math.max(0, p.g ?? 60), wb = Math.max(0, p.b ?? 20)
      const tot = (wr + wg + wb) || 1
      for (let i = 0; i < px.length; i += 4) {
        const v = Math.min(255, (px[i] * wr + px[i + 1] * wg + px[i + 2] * wb) / tot)
        px[i] = px[i + 1] = px[i + 2] = v
      }
      ctx.putImageData(d, 0, 0)
      break
    }
    case 'threshold': {
      const d = ctx.getImageData(0, 0, W, H), px = d.data
      const t = p.level ?? 128
      for (let i = 0; i < px.length; i += 4) {
        const v = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) >= t ? 255 : 0
        px[i] = px[i + 1] = px[i + 2] = v
      }
      ctx.putImageData(d, 0, 0)
      break
    }
    case 'photoFilter': {
      const [fr, fg2, fb] = hexToRgb(p.color || '#c8872a')
      const den = Math.max(0, Math.min(100, p.density ?? 25)) / 100
      const d = ctx.getImageData(0, 0, W, H), px = d.data
      for (let i = 0; i < px.length; i += 4) {
        px[i] = px[i] * (1 - den) + (px[i] * fr / 255) * den * 1.15
        px[i + 1] = px[i + 1] * (1 - den) + (px[i + 1] * fg2 / 255) * den * 1.15
        px[i + 2] = px[i + 2] * (1 - den) + (px[i + 2] * fb / 255) * den * 1.15
      }
      ctx.putImageData(d, 0, 0)
      break
    }
    case 'vibrance': {
      const d = ctx.getImageData(0, 0, W, H), px = d.data
      const a = (p.amount ?? 0) / 100, sg = (p.sat ?? 0) / 100
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 4) continue
        let { h, s, v } = rgbToHsv(px[i], px[i + 1], px[i + 2])
        s = Math.max(0, Math.min(1, s + a * (1 - s) * s * 2 + sg * (s < 0.5 ? s : 0)))
        const [r, g, bb] = hsvToRgb(h, s, v)
        px[i] = r; px[i + 1] = g; px[i + 2] = bb
      }
      ctx.putImageData(d, 0, 0)
      break
    }
    case 'posterize': {
      const n = Math.max(2, Math.min(32, p.levels ?? 4))
      const lut = new Uint8ClampedArray(256)
      for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.round(i / 255 * (n - 1)) * 255 / (n - 1))
      applyLUTs(cv, { rgb: lut })
      break
    }
  }
  return cv
}

export const filterString = (a) =>
  `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) ` +
  `hue-rotate(${a.hue}deg) blur(${a.blur}px) grayscale(${a.grayscale}%) ` +
  `sepia(${a.sepia}%) invert(${a.invert}%)`

// ---- Courbes : points de contrôle -> LUT 256 par interpolation monotone ----------
// curve = [{x, y}, …] trié par x ; y ∈ [0,255]. Lut identity = i.
export function curveLUT(points) {
  const lut = new Uint8ClampedArray(256)
  if (!points || points.length < 2) { for (let i = 0; i < 256; i++) lut[i] = i; return lut }
  const pts = [...points].sort((p, q) => p.x - q.x)
  // interpolation Catmull-Rom simplifiée -> monotone approximative
  const interp = (x) => {
    if (x <= pts[0].x) return pts[0].y
    if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y
    let i = 0
    while (i < pts.length - 2 && pts[i + 1].x < x) i++
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const t = (x - p1.x) / (p2.x - p1.x || 1)
    const t2 = t * t, t3 = t2 * t
    return 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  }
  for (let i = 0; i < 256; i++) lut[i] = interp(i)
  return lut
}

// Applique les LUT {r,g,b,rgb} aux pixels d'un canvas (en place)
export function applyLUTs(cv, luts) {
  const ctx = cv.getContext('2d')
  const d = ctx.getImageData(0, 0, cv.width, cv.height)
  const px = d.data
  const m = luts.rgb
  for (let i = 0; i < px.length; i += 4) {
    if (luts.r) px[i] = luts.r[px[i]]
    if (luts.g) px[i + 1] = luts.g[px[i + 1]]
    if (luts.b) px[i + 2] = luts.b[px[i + 2]]
    if (m) {
      px[i] = m[px[i]]; px[i + 1] = m[px[i + 1]]; px[i + 2] = m[px[i + 2]]
    }
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

// Histogramme de luminance (256 cases) + stats du composite —
// panneau Histogramme façon Photoshop (moyenne, écart-type, médiane, pixels).
export function histogram(cv, step = 8, ch = 'lum') {
  const ctx = cv.getContext('2d')
  const { width, height } = cv
  const sx = Math.max(1, Math.round(width / 400)) // échantillonnage si grand doc
  const d = ctx.getImageData(0, 0, width, height, { willReadFrequently: true })
  const h = new Float32Array(256)
  const px = d.data
  const ci = { r: 0, g: 1, b: 2 }[ch]
  let sum = 0, sum2 = 0, n = 0
  for (let i = 0; i < px.length; i += 4 * sx) {
    const v = ci == null ? Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) : px[i + ci]
    h[v]++; sum += v; sum2 += v * v; n++
  }
  const max = Math.max(...h)
  const mean = n ? sum / n : 0
  const stdDev = n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0
  let acc = 0, median = 0
  for (let i = 0; i < 256; i++) { acc += h[i]; if (acc >= n / 2) { median = i; break } }
  return { h, max, mean, stdDev, median, pixels: width * height }
}

// ---- Niveaux / exposition / balance des blancs : LUTs par canal -----------------
const IDENTITY = (() => { const l = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) l[i] = i; return l })()

const composeLUT = (l1, l2) => { // applique l1 puis l2
  const o = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) o[i] = l2[l1[i]]
  return o
}

/** Auto-niveaux : points noir/blanc aux percentiles 0,5 % / 99,5 % du canal. */
export function autoLevels(cv, ch = 'rgb') {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  const hist = new Uint32Array(256)
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 4) continue
    hist[ch === 'rgb' ? Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) : d[i + { r: 0, g: 1, b: 2 }[ch]]]++
    n++
  }
  const lo = n * 0.005, hi = n * 0.995
  let inBlack = 0, inWhite = 255, acc = 0
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= lo) { inBlack = i; break } }
  acc = 0
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= hi) { inWhite = i; break } }
  if (inWhite <= inBlack) inWhite = inBlack + 1
  return { inBlack, inWhite }
}

/** LUT « niveaux » : remap in-black/in-white, gamma, puis niveaux de sortie. */
export function levelsLUT(inBlack, inWhite, gamma100, outBlack = 0, outWhite = 255) {
  const lut = new Uint8ClampedArray(256)
  const g = Math.max(10, gamma100) / 100
  const span = Math.max(1, inWhite - inBlack)
  const oSpan = Math.max(1, outWhite - outBlack)
  for (let i = 0; i < 256; i++) {
    const v = Math.min(1, Math.max(0, (i - inBlack) / span))
    lut[i] = outBlack + Math.pow(v, 1 / g) * oSpan
  }
  return lut
}

/** LUT linéaire par canal : out = in * mul + add (balance des blancs). */
const chanLUT = (mul, add = 0) => {
  const o = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) o[i] = Math.min(255, Math.max(0, i * mul + add))
  return o
}

/** Netteté : convolution 3x3 (unsharp) sur le canvas en place. amount 0..1. */
export function unsharp(cv, amount) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const d = ctx.getImageData(0, 0, W, H)
  const px = d.data, src = new Uint8ClampedArray(px)
  const a = amount
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4
      for (let c = 0; c < 3; c++) {
        px[i + c] = src[i + c] * (1 + 4 * a)
          - a * (src[i - 4 + c] + src[i + 4 + c] + src[i - W * 4 + c] + src[i + W * 4 + c])
      }
    }
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

const mkCanvas = (w, h) => {
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(w))
  cv.height = Math.max(1, Math.round(h))
  return cv
}

/** Rend la zone (sx,sy,sw,sh) de `src` dans le quadrilatère `quad` du contexte
 *  `ctx` — quad = [TL, TR, BR, BL] dans les coordonnées de ctx. La surface est
 *  subdivisée en n×n cellules bilinéaires, chacune dessinée en 2 triangles
 *  affines : donne une perspective/Déformation convaincante avec canvas 2D. */
export function warpQuad(ctx, src, sx, sy, sw, sh, quad, n = 24) {
  const [p00, p10, p11, p01] = quad
  const lerp = (a, b, t) => a + (b - a) * t
  const at = (u, v) => [
    lerp(lerp(p00[0], p10[0], u), lerp(p01[0], p11[0], u), v),
    lerp(lerp(p00[1], p10[1], u), lerp(p01[1], p11[1], u), v),
  ]
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n
      for (const tri of [[[u0, v0], [u1, v0], [u1, v1]], [[u0, v0], [u1, v1], [u0, v1]]]) {
        const s0 = [sx + tri[0][0] * sw, sy + tri[0][1] * sh]
        const s1 = [sx + tri[1][0] * sw, sy + tri[1][1] * sh]
        const s2 = [sx + tri[2][0] * sw, sy + tri[2][1] * sh]
        const d0 = at(...tri[0]), d1 = at(...tri[1]), d2 = at(...tri[2])
        // matrice affine source→dest : M·(s1−s0)=d1−d0, M·(s2−s0)=d2−d0
        const v1x = s1[0] - s0[0], v1y = s1[1] - s0[1]
        const v2x = s2[0] - s0[0], v2y = s2[1] - s0[1]
        const w1x = d1[0] - d0[0], w1y = d1[1] - d0[1]
        const w2x = d2[0] - d0[0], w2y = d2[1] - d0[1]
        const det = v1x * v2y - v2x * v1y
        if (Math.abs(det) < 1e-9) continue
        const a = (w1x * v2y - w2x * v1y) / det
        const b = (w1y * v2y - w2y * v1y) / det
        const c = (w2x * v1x - w1x * v2x) / det
        const d = (w2y * v1x - w1y * v2x) / det
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d2[0], d2[1])
        ctx.closePath(); ctx.clip()
        ctx.transform(a, b, c, d, d0[0] - a * s0[0] - c * s0[1], d0[1] - b * s0[0] - d * s0[1])
        ctx.drawImage(src, 0, 0)
        ctx.restore()
      }
    }
  }
  ctx.restore()
}

// Au moins un effet interne actif → la silhouette du calque est nécessaire
const sil0Needed = (fx) =>
  fx.innerShadow?.on || fx.innerGlow?.on || fx.bevel?.on || fx.satin?.on

let uid = 1

export class Editor {
  layers = []
  activeId = null
  selLayerIds = new Set() // multi-sélection du panneau Calques (Ctrl+clic)
  adjustVisible = true
  adjust = { ...DEFAULT_ADJUST }
  w = 0
  h = 0
  undoStack = []
  redoStack = []
  sourceUrl = null
  docName = 'document'
  sel = null          // [x, y, w, h] en coordonnées image, ou null
  isMontage = false   // vrai si le doc vient du montage avant/après
  curves = { rgb: null, r: null, g: null, b: null } // points de contrôle par canal
  wb = null           // gains {r,g,b} posés par la pipette balance des blancs
  _cf = null          // cache du composite filtré
  savedSels = []      // canaux alpha mémorisés (Sélection → Mémoriser)
  _chSeq = 0
  qm = null           // canvas du masque rapide (alpha > 0 = sélection)
  _qmOvl = null       // cache de l'aperçu rouge

  // ---- Document ---------------------------------------------------------------

  open(img, name = 'document') {
    this.w = img.naturalWidth || img.width
    this.h = img.naturalHeight || img.height
    this.docName = name
    this.layers = []
    this.undoStack = []
    this.redoStack = []
    this.adjust = { ...DEFAULT_ADJUST }
    this.adjustVisible = true
    this.sel = null
    this.curves = { rgb: null, r: null, g: null, b: null }
    this.wb = null

    const base = this._mkLayer('Arrière-plan')
    base.ctx.drawImage(img, 0, 0)
    base.locked = true
    this.layers.push(base)
    this.addLayer('Calque 1')
    this.setActive(base.id)
  }

  _mkLayer(name) {
    const cv = mkCanvas(this.w, this.h)
    return { id: uid++, name, cv, ctx: cv.getContext('2d'), visible: true, opacity: 1, fill: 1, dx: 0, dy: 0, blend: 'source-over', fx: null, type: 'pixel', mask: null, maskActive: false,
      // verrous fins façon Photoshop : pixels transparents / pixels / position / tout
      lockAlpha: false, lockPx: false, lockPos: false }
  }

  /** Miniature d'un canal du composite (gris) — panneau Canaux. ch : 'rgb'|'r'|'g'|'b' */
  channelCanvas(ch = 'rgb', w = 42, h = 30) {
    const comp = this.compositeFiltered()
    const t = mkCanvas(w, h)
    const s = mkCanvas(w, h)
    s.getContext('2d').drawImage(comp, 0, 0, w, h)
    const d = s.getContext('2d').getImageData(0, 0, w, h)
    const o = t.getContext('2d').createImageData(w, h)
    for (let i = 0; i < d.data.length; i += 4) {
      const ci = ch === 'r' ? 0 : ch === 'g' ? 1 : ch === 'b' ? 2 : -1
      const v = ci < 0 ? (d.data[i] * 0.299 + d.data[i + 1] * 0.587 + d.data[i + 2] * 0.114) : d.data[i + ci]
      o.data[i] = o.data[i + 1] = o.data[i + 2] = v
      o.data[i + 3] = d.data[i + 3] > 8 ? 255 : 0
    }
    t.getContext('2d').putImageData(o, 0, 0)
    return t
  }

  /** Calque de réglage non destructif — transforme le composite des calques du dessous. */
  addAdjustLayer(kind) {
    const def = ADJUST_KINDS.find((k) => k.key === kind) || ADJUST_KINDS[0]
    const l = this._mkLayer(def.label)
    l.type = 'adjust'
    l.adj = { kind: def.key, params: JSON.parse(JSON.stringify(ADJUST_PARAMS[def.key] || {})) }
    this._insertAboveActive(l)
    this.activeId = l.id
    // sélection active → le réglage arrive masqué dessus (comme Photoshop)
    if (this.sel || this.selPoly) this.addMask(l, true)
    return l
  }

  /** Calque de remplissage non destructif : couleur unie ou dégradé,
   *  rééditable via `fillDef` (Propriétés) — sélection → arrive masqué dessus. */
  addFillLayer(def = { kind: 'solid', color: '#ffffff' }) {
    const l = this._mkLayer(def.kind === 'gradient' ? 'Dégradé' : 'Remplissage uni')
    l.type = 'fill'
    l.fillDef = { ...def }
    this.drawFillLayer(l)
    this._insertAboveActive(l)
    this.activeId = l.id
    if (this.sel || this.selPoly) this.addMask(l, true)
    return l
  }

  /** Re-rend le contenu d'un calque de remplissage depuis `fillDef`. */
  drawFillLayer(l) {
    if (l?.type !== 'fill' || !l.fillDef) return
    const d = l.fillDef
    l.ctx.clearRect(0, 0, this.w, this.h)
    if (d.kind === 'solid') {
      l.ctx.fillStyle = d.color || '#ffffff'
      l.ctx.fillRect(0, 0, this.w, this.h)
    } else {
      const a = ((d.angle || 0) * Math.PI) / 180
      const cx = this.w / 2, cy = this.h / 2, len = Math.hypot(this.w, this.h) / 2
      const g = d.style === 'radial'
        ? l.ctx.createRadialGradient(cx, cy, 0, cx, cy, len)
        : l.ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len)
      g.addColorStop(0, d.from || '#ffffff')
      g.addColorStop(1, d.to || '#000000')
      l.ctx.fillStyle = g
      l.ctx.fillRect(0, 0, this.w, this.h)
    }
    this.markDirty()
  }

  /** Masque de fusion : blanc = visible. `fromSel` révèle seulement la sélection. */
  addMask(l, fromSel = false) {
    const m = mkCanvas(this.w, this.h)
    const ctx = m.getContext('2d')
    if (fromSel && (this.sel || this.selPoly)) {
      ctx.drawImage(this.selMaskCanvas(0), 0, 0)
    } else {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, this.w, this.h)
    }
    l.mask = m
    l.maskCtx = m.getContext('2d')
    l.maskActive = true
    return m
  }

  removeMask(l) { l.mask = null; l.maskCtx = null; l.maskActive = false }

  /** Miniature du masque en niveaux de gris (alpha → luminance). */
  maskThumb(l, w = 42, h = 30) {
    const t = mkCanvas(w, h)
    const ctx = t.getContext('2d')
    const s = mkCanvas(w, h)
    s.getContext('2d').drawImage(l.mask, 0, 0, w, h)
    const d = s.getContext('2d').getImageData(0, 0, w, h)
    const o = ctx.createImageData(w, h)
    for (let i = 0; i < d.data.length; i += 4) {
      const a = d.data[i + 3]
      o.data[i] = o.data[i + 1] = o.data[i + 2] = a
      o.data[i + 3] = 255
    }
    ctx.putImageData(o, 0, 0)
    return t.toDataURL('image/png')
  }

  /** Invalide le composite caché — à appeler après toute mutation (la page le fait via bump). */
  markDirty() { this._cf = null }

  /** Miniature d'un calque (dataURL, pour le panneau Calques). */
  layerThumb(l, w = 44, h = 32) {
    const t = mkCanvas(w, h)
    const ctx = t.getContext('2d')
    const s = Math.min(w / l.cv.width, h / l.cv.height)
    ctx.drawImage(l.cv, (w - l.cv.width * s) / 2, (h - l.cv.height * s) / 2, l.cv.width * s, l.cv.height * s)
    return t.toDataURL('image/png')
  }

  /** Redimensionne le calque actif par un facteur autour d'un point d'ancrage. */
  scaleLayer(l, sx, sy, ax = 0, ay = 0) {
    if (!l || l.locked) return
    const next = mkCanvas(this.w, this.h)
    const ctx = next.getContext('2d')
    ctx.translate(ax, ay)
    ctx.scale(sx, sy)
    ctx.drawImage(l.cv, -ax, -ay)
    l.cv = next
    l.ctx = ctx
  }

  addLayer(name = `Calque ${this.layers.length}`) {
    const l = this._mkLayer(name)
    this._insertAboveActive(l)
    this.activeId = l.id
    return l
  }

  /** Recherche récursive dans la pile de calques (descend dans les groupes) :
   *  retourne {l, arr, i} — `arr` est le tableau parent contenant le calque. */
  _find(id, arr = this.layers) {
    for (let i = 0; i < arr.length; i++) {
      const l = arr[i]
      if (l.id === id) return { l, arr, i }
      if (l.type === 'group' && l.children) {
        const r = this._find(id, l.children)
        if (r) return r
      }
    }
    return null
  }

  /** Itère tous les calques, y compris ceux contenus dans les groupes. */
  walk(fn, arr = this.layers) {
    for (const l of arr) {
      fn(l)
      if (l.type === 'group' && l.children) this.walk(fn, l.children)
    }
  }

  /** Insère un calque juste au-dessus du calque actif, dans son propre niveau
   *  (un calque créé depuis l'intérieur d'un groupe rejoint ce groupe). */
  _insertAboveActive(l) {
    const f = this.activeId != null ? this._find(this.activeId) : null
    if (f) f.arr.splice(f.i + 1, 0, l)
    else this.layers.push(l)
  }

  get active() {
    return this.activeId != null ? this._find(this.activeId)?.l || null : null
  }

  setActive(id) { this.activeId = id }
  toggleVisible(id) { const l = this._find(id)?.l; if (l) l.visible = !l.visible }
  removeLayer(id) {
    const f = this._find(id)
    if (!f || f.l.locked) return
    f.arr.splice(f.i, 1) // un groupe emporte tout son contenu
    if (!this._find(this.activeId)) this.activeId = this.layers[this.layers.length - 1]?.id
  }
  moveLayer(id, dir) { // dir = +1 (monter) / -1 (descendre) — dans son niveau
    const f = this._find(id)
    if (!f) return
    const j = f.i + dir
    if (j < 0 || j >= f.arr.length || f.l.locked) return
    ;[f.arr[f.i], f.arr[j]] = [f.arr[j], f.arr[f.i]]
  }

  /** true si `moveInto(id, targetId, where)` peut s'appliquer (drag & drop). */
  canMove(id, targetId, where = 'after') {
    const f = this._find(id), t = this._find(targetId)
    if (!f || !t || f.l === t.l || f.l.locked) return false
    // interdit : glisser un groupe dans lui-même ou dans un de ses descendants
    if (f.l.type === 'group' && this._find(targetId, f.l.children || [])) return false
    if (where === 'inside' && t.l.type !== 'group') return false
    return true
  }

  /** Déplace un calque vers `targetId` (drag & drop du panneau Calques).
   *  where : 'before' | 'after' — dans le même tableau que la cible ;
   *          'inside' — dans les enfants d'un groupe. */
  moveInto(id, targetId, where = 'after') {
    if (!this.canMove(id, targetId, where)) return false
    const f = this._find(id), t = this._find(targetId)
    f.arr.splice(f.i, 1)
    if (where === 'inside') {
      (t.l.children ||= []).push(f.l) // haut de pile du groupe
    } else {
      const ti = t.arr.indexOf(t.l) // recalculé après le retrait
      t.arr.splice(where === 'after' ? ti + 1 : ti, 0, f.l)
    }
    this.markDirty()
    return true
  }

  /** Dépose en fin de liste du panneau = bas de la pile racine. */
  moveToRoot(id, top = false) {
    const f = this._find(id)
    if (!f || f.l.locked || f.arr === this.layers && !top && f.i === 0) return false
    f.arr.splice(f.i, 1)
    if (top) this.layers.push(f.l)
    else this.layers.unshift(f.l)
    this.markDirty()
    return true
  }
  /** Clone profond d'un calque (les groupes sont clonés récursivement). */
  _dupNode(src, suffix = ' copie') {
    const copy = this._mkLayer(`${src.name}${suffix}`)
    copy.type = src.type || 'pixel'
    copy.adj = src.adj ? JSON.parse(JSON.stringify(src.adj)) : null
    copy.ctx.drawImage(src.cv, 0, 0)
    copy.dx = src.dx; copy.dy = src.dy; copy.opacity = src.opacity; copy.fill = src.fill ?? 1
    copy.blend = src.blend
    copy.fx = src.fx ? JSON.parse(JSON.stringify(src.fx)) : null
    copy.fxOff = !!src.fxOff
    copy.text = src.text ? JSON.parse(JSON.stringify(src.text)) : null
    copy.shape = src.shape ? JSON.parse(JSON.stringify(src.shape)) : null
    copy.clip = !!src.clip
    if (src.mask) {
      copy.mask = mkCanvas(this.w, this.h)
      copy.maskCtx = copy.mask.getContext('2d')
      copy.maskCtx.drawImage(src.mask, 0, 0)
    }
    if (src.type === 'group') {
      copy.children = (src.children || []).map((c) => this._dupNode(c, ''))
      copy.collapsed = !!src.collapsed
    }
    return copy
  }

  duplicateLayer(id) {
    const f = this._find(id)
    if (!f) return
    const copy = this._dupNode(f.l)
    f.arr.splice(f.i + 1, 0, copy)
    this.activeId = copy.id
  }

  // ---- Groupes de calques (dossiers façon Photoshop) --------------------------

  /** Nouveau groupe vide, inséré au-dessus du calque actif. */
  addGroup() {
    let n = 0
    this.walk((l) => { if (l.type === 'group') n++ })
    const g = this._mkLayer(`Groupe ${n + 1}`)
    g.type = 'group'; g.children = []; g.collapsed = false
    this._insertAboveActive(g)
    this.activeId = g.id
    return g
  }

  /** Regroupe les calques `ids` dans un groupe (Photoshop Ctrl+G) — le groupe
   *  prend la place du calque sélectionné le plus haut dans la pile. */
  groupLayers(ids) {
    const picks = []
    const collect = (arr) => arr.forEach((l, i) => {
      if (ids.includes(l.id)) picks.push({ l, arr, i })
      if (l.type === 'group' && l.children) collect(l.children)
    })
    collect(this.layers)
    if (!picks.length) return null
    const top = picks[picks.length - 1] // le plus haut en ordre de rendu
    const before = picks.filter((p) => p.arr === top.arr && p.i < top.i).length
    for (const arr of new Set(picks.map((p) => p.arr))) {
      for (let i = arr.length - 1; i >= 0; i--) if (ids.includes(arr[i].id)) arr.splice(i, 1)
    }
    let n = 0
    this.walk((l) => { if (l.type === 'group') n++ })
    const g = this._mkLayer(`Groupe ${n + 1}`)
    g.type = 'group'; g.collapsed = false
    g.children = picks.map((p) => p.l)
    top.arr.splice(top.i - before, 0, g)
    this.activeId = g.id
    this.markDirty()
    return g
  }

  /** Éclate le groupe : ses calques remontent à son niveau (Ctrl+Maj+G). */
  ungroup(id) {
    const f = this._find(id)
    if (!f || f.l.type !== 'group') return false
    const kids = f.l.children || []
    f.arr.splice(f.i, 1, ...kids)
    this.activeId = kids[kids.length - 1]?.id || f.arr[f.i]?.id || null
    this.markDirty()
    return true
  }

  /** Calque le plus haut dont les pixels recouvrent le point image (Sélection auto). */
  layerAtPoint(ix, iy) {
    const hit = (arr) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const l = arr[i]
        if (!l.visible) continue
        if (l.type === 'group') { const r = hit(l.children || []); if (r) return r; continue }
        if (l.type === 'adjust' || !l.cv) continue
        const x = ix - l.dx, y = iy - l.dy
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue
        if (l.cv.getContext('2d').getImageData(x | 0, y | 0, 1, 1).data[3] > 12) return l
      }
      return null
    }
    return hit(this.layers)
  }

  // ---- Calques de texte (éditables, façon Photoshop) ------------------------------

  /** Crée un calque de texte à la position image (ix, iy). */
  addTextLayer(value, meta = {}, ix = 0, iy = 0) {
    const l = this._mkLayer(`T — ${String(value).split('\n')[0].slice(0, 24)}`)
    l.type = 'text'
    l.text = {
      value: String(value),
      font: meta.font || 'Arial',
      size: meta.size || 48,
      bold: !!meta.bold,
      italic: !!meta.italic,
      tracking: meta.tracking || 0,
      color: meta.color || '#ffffff',
      align: meta.align || 'left',
      leading: meta.leading || 1.2,
    }
    l.dx = Math.round(ix)
    l.dy = Math.round(iy) - l.text.size // le clic vise la ligne de base
    this.drawTextLayer(l)
    this._insertAboveActive(l)
    this.activeId = l.id
    return l
  }

  /** (Re)dessine le calque de texte avec ses paramètres courants.
   *  Prend en charge : échelle H/V, décalage de ligne de base, retraits,
   *  espacements de paragraphe et coupure en boîte (boxW) — façon Photoshop. */
  drawTextLayer(l) {
    const t = l.text
    if (!t) return
    const x = l.ctx
    x.save()
    x.clearRect(0, 0, this.w, this.h)
    x.font = `${t.italic ? 'italic ' : ''}${t.bold ? '700' : '400'} ${t.size}px '${t.font}', sans-serif`
    try { x.letterSpacing = `${t.tracking || 0}px` } catch { /* navigateur sans support */ }
    x.fillStyle = t.color
    x.textBaseline = 'alphabetic'
    x.textAlign = 'left'
    const indL = t.indentL || 0, indR = t.indentR || 0
    const wrapW = t.boxW ? Math.max(20, t.boxW - indL - indR) : Infinity // zone de coupure
    const spB = t.spaceBefore || 0, spA = t.spaceAfter || 0
    // coupure : découpe chaque paragraphe en lignes tenant dans wrapW
    const lines = [] // {t, newPara}
    String(t.value).split('\n').forEach((para) => {
      if (!isFinite(wrapW)) { lines.push({ t: para, np: true }); return }
      let cur = '', first = true
      para.split(' ').forEach((w) => {
        const test = cur ? `${cur} ${w}` : w
        if (x.measureText(test).width > wrapW && cur) { lines.push({ t: cur, np: first }); cur = w; first = false }
        else cur = test
      })
      lines.push({ t: cur, np: first })
    })
    const maxW = isFinite(wrapW)
      ? t.boxW
      : Math.max(...lines.map((ln) => x.measureText(ln.t).width + indL + indR), 1)
    // échelle horizontale/verticale : le texte est dessiné dans un espace transformé
    const scX = (t.scaleX ?? 100) / 100, scY = (t.scaleY ?? 100) / 100
    x.scale(scX, scY)
    const base = (t.baseline || 0) / scY // décalage de ligne de base (px)
    const lh = t.size * (t.leading || 1.2)
    const ax = t.align === 'center' ? maxW / 2 : t.align === 'right' ? maxW - indR : indL
    let y = t.size - base
    x.textAlign = t.align || 'left'
    lines.forEach((ln, i) => {
      if (i && ln.np) y += spB          // espacement avant le paragraphe
      x.fillText(ln.t, ax, y)
      y += lh
      if (ln.np === false && lines[i + 1]?.np) y += spA // espacement après
    })
    x.restore()
    const h = y - (t.size - base) + t.size * 1.3
    t.box = { w: Math.ceil(maxW * scX), h: Math.ceil(h * scY) }
  }

  /** Met à jour les paramètres du texte et redessine. */
  updateText(l, patch) {
    if (!l?.text) return
    Object.assign(l.text, patch)
    if ('value' in patch) l.name = `T — ${String(l.text.value).split('\n')[0].slice(0, 24)}`
    this.drawTextLayer(l)
  }

  // ---- Calques de forme (vectoriels, éditables comme dans Photoshop) -----------

  /** kind : rect | ellipse | triangle | line | poly (n côtés) | star (n branches) */
  addShapeLayer(kind, rect, params = {}) {
    const names = { rect: 'Rectangle', ellipse: 'Ellipse', triangle: 'Triangle', line: 'Ligne', poly: 'Polygone', star: 'Étoile' }
    const l = this._mkLayer(names[kind] || 'Forme')
    l.type = 'shape'
    l.shape = {
      kind, x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      fill: 'fill' in params ? params.fill : '#dc2626',   // null explicite = sans fond
      stroke: 'stroke' in params ? params.stroke : null,
      strokeW: params.strokeW ?? 4,
      strokeAlign: params.strokeAlign || 'center', // inside | center | outside
      dash: params.dash || 'solid',                // solid | dash | dot
      points: params.points || 5,                  // poly / star
      corner: params.corner || 0,                  // rayon des coins (rect)
    }
    this.drawShapeLayer(l)
    this._insertAboveActive(l)
    this.activeId = l.id
    return l
  }

  /** Trace le chemin de la forme (déjà contracté/dilaté selon l'alignement du contour). */
  _shapePath(ctx, s, inset = 0) {
    const k = s.kind
    ctx.beginPath()
    if (k === 'path') { // tracé libre (plume) : ancres + poignées Bézier optionnelles
      const pts = s.pts || []
      if (!pts.length) return
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i]
        if (p0.c2 || p1.c1) {
          const c2 = p0.c2 || [p0.x, p0.y], c1 = p1.c1 || [p1.x, p1.y]
          ctx.bezierCurveTo(c2[0], c2[1], c1[0], c1[1], p1.x, p1.y)
        } else ctx.lineTo(p1.x, p1.y)
      }
      if (s.closed && pts.length > 2) {
        const p0 = pts[pts.length - 1], p1 = pts[0]
        if (p0.c2 || p1.c1) {
          const c2 = p0.c2 || [p0.x, p0.y], c1 = p1.c1 || [p1.x, p1.y]
          ctx.bezierCurveTo(c2[0], c2[1], c1[0], c1[1], p1.x, p1.y)
        }
        ctx.closePath()
      }
      return
    }
    const x = s.x + inset, y = s.y + inset, w = Math.max(0.01, s.w - inset * 2), h = Math.max(0.01, s.h - inset * 2)
    if (k === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    if (k === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    else if (k === 'triangle') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath() }
    else if (k === 'line') { ctx.moveTo(x, y); ctx.lineTo(x + w, y + h) }
    else if (k === 'poly' || k === 'star') {
      const n = Math.max(3, s.points || 5), cx = x + w / 2, cy = y + h / 2
      const verts = k === 'star' ? n * 2 : n
      for (let i = 0; i < verts; i++) {
        const a = -Math.PI / 2 + (i / verts) * Math.PI * 2
        const k2 = k === 'star' && i % 2 ? 0.42 : 1
        const px = cx + Math.cos(a) * (w / 2) * k2
        const py = cy + Math.sin(a) * (h / 2) * k2
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py)
      }
      ctx.closePath()
    } else {
      const r = Math.min(s.corner || 0, w / 2, h / 2)
      if (r > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, r)
      else ctx.rect(x, y, w, h)
    }
  }

  /** (Re)dessine le calque de forme avec ses paramètres courants. */
  drawShapeLayer(l) {
    const s = l.shape
    if (!s) return
    const x = l.ctx
    x.save()
    x.clearRect(0, 0, this.w, this.h)
    // alignement du contour : inside = chemin contracté de w/2, outside = dilaté
    const inset = s.stroke && s.strokeAlign === 'inside' ? (s.strokeW || 0) / 2
      : s.stroke && s.strokeAlign === 'outside' ? -(s.strokeW || 0) / 2 : 0
    if (s.dash === 'dash') x.setLineDash([(s.strokeW || 4) * 3, (s.strokeW || 4) * 1.5])
    else if (s.dash === 'dot') { x.setLineDash([0.5, (s.strokeW || 4) * 1.8]); x.lineCap = 'round' }
    // fond : géométrie de base
    if (s.fill && s.kind !== 'line') {
      this._shapePath(x, s, 0)
      x.fillStyle = s.fill; x.fill()
    }
    // contour : chemin contracté/dilaté selon l'alignement (inside/center/outside)
    if (s.stroke) {
      this._shapePath(x, s, inset)
      x.strokeStyle = s.stroke; x.lineWidth = s.strokeW || 1; x.stroke()
    }
    x.restore()
  }

  /** Calque de forme depuis un tracé plume : pts [{x,y,c1:[x,y]|null,c2:[x,y]|null}]. */
  addPathShape(pts, closed, params = {}) {
    const l = this._mkLayer('Tracé')
    l.type = 'shape'
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    l.shape = {
      kind: 'path', pts: pts.map((p) => ({ x: p.x, y: p.y, c1: p.c1 ? [...p.c1] : null, c2: p.c2 ? [...p.c2] : null })),
      closed: !!closed,
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
      fill: 'fill' in params ? params.fill : '#dc2626',
      stroke: 'stroke' in params ? params.stroke : null,
      strokeW: params.strokeW ?? 4,
      strokeAlign: params.strokeAlign || 'center',
      dash: params.dash || 'solid',
    }
    this.drawShapeLayer(l)
    this._insertAboveActive(l)
    this.activeId = l.id
    return l
  }

  /** Resynchronise s.x/y/w/h avec la boîte des points après édition directe. */
  _pathBounds(s) {
    const all = s.pts.flatMap((p) => [[p.x, p.y], p.c1 || [], p.c2 || []]).filter((q) => q.length)
    const xs = all.map((q) => q[0]), ys = all.map((q) => q[1])
    s.x = Math.min(...xs); s.y = Math.min(...ys)
    s.w = Math.max(...xs) - s.x; s.h = Math.max(...ys) - s.y
  }

  updateShape(l, patch) {
    if (!l?.shape) return
    Object.assign(l.shape, patch)
    if (l.shape.kind === 'path' && l.shape.pts?.length) this._pathBounds(l.shape)
    this.drawShapeLayer(l)
  }

  // ---- Tracés (panneau Tracés) -------------------------------------------------

  /** Enregistre la sélection courante comme tracé de travail (comme Photoshop). */
  saveWorkPath() {
    const p = this.selPoly?.length
      ? { kind: 'poly', pts: this.selPoly.map((q) => [...q]) }
      : this.selEllipse && this.sel
        ? { kind: 'ellipse', rect: [...this.sel] }
        : this.sel ? { kind: 'rect', rect: [...this.sel] } : null
    if (!p) return null
    this.paths = this.paths || []
    const wk = { name: this.paths.length ? `Tracé ${this.paths.length + 1}` : 'Tracé de travail', ...p }
    this.paths.push(wk)
    return wk
  }

  /** Recharge un tracé en sélection. */
  loadPath(p) {
    if (!p) return
    if (p.kind === 'poly') { this.selPoly = p.pts.map((q) => [...q]); this.sel = null; this.selEllipse = false }
    else { this.sel = [...p.rect]; this.selPoly = null; this.selEllipse = p.kind === 'ellipse' }
    this.selInverted = false
  }

  /** Boîte englobante du contenu non transparent du calque (coords locales cv). */
  contentBBox(l, step = 4) {
    if (!l?.cv) return null
    const d = l.ctx.getImageData(0, 0, this.w, this.h).data
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1
    for (let y = 0; y < this.h; y += step) {
      for (let x = 0; x < this.w; x += step) {
        if (d[(y * this.w + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + step, h: y1 - y0 + step }
  }

  /** Transformation manuelle (Ctrl+T) : applique la matrice doc→doc au calque.
   *  [a,b,c,d,e,f] en coordonnées document ; rasterise cv + masque + convertit
   *  les calques texte/forme en pixels (comme la pixellisation Photoshop). */
  applyTransform(l, m, interp = 'bicubic') {
    if (!l?.cv) return
    const smooth = interp !== 'nearest'
    const q = interp === 'bicubic' || interp === 'smoother' ? 'high' : interp === 'bilinear' ? 'medium' : 'low'
    // matrice doc→doc traduite en coords locales : M_loc = T(-d) · M · T(d)
    const [a, b, c, d, e, f] = m
    const eL = a * l.dx + c * l.dy + e - l.dx
    const fL = b * l.dx + d * l.dy + f - l.dy
    for (const [cv, ctx] of [[l.cv, l.ctx], ...(l.mask ? [[l.mask, l.maskCtx]] : [])]) {
      const src = mkCanvas(this.w, this.h)
      src.getContext('2d').drawImage(cv, 0, 0)
      ctx.save()
      ctx.clearRect(0, 0, this.w, this.h)
      ctx.setTransform(a, b, c, d, eL, fL)
      ctx.imageSmoothingEnabled = smooth
      ctx.imageSmoothingQuality = q
      ctx.drawImage(src, 0, 0)
      ctx.restore()
    }
    // la forme/le texte sont maintenant des pixels : dégrade en calque de pixels
    if (l.type === 'shape') { l.type = 'pixel'; l.shape = null }
    if (l.type === 'text') { l.type = 'pixel'; l.text = null }
    this.markDirty()
  }

  /** Distorsion / Déformation : `cells` = [{sx,sy,sw,sh, quad:[TL,TR,BR,BL]}]
   *  en coordonnées locales du calque ; cuit cv + masque cellule par cellule. */
  applyWarp(l, cells) {
    if (!l?.cv) return
    for (const [cv, ctx] of [[l.cv, l.ctx], ...(l.mask ? [[l.mask, l.maskCtx]] : [])]) {
      const src = mkCanvas(this.w, this.h)
      src.getContext('2d').drawImage(cv, 0, 0)
      ctx.clearRect(0, 0, this.w, this.h)
      for (const cell of cells) warpQuad(ctx, src, cell.sx, cell.sy, cell.sw, cell.sh, cell.quad, 24)
    }
    if (l.type === 'shape') { l.type = 'pixel'; l.shape = null }
    if (l.type === 'text') { l.type = 'pixel'; l.text = null }
    this.markDirty()
  }

  /** Champ de déplacement (Fluidité) : `field` = { data: Float32Array (dx,dy par
   *  sommet), gw, gh, cell } en coords du calque. Chaque cellule source est
   *  dessinée dans le quad « coins + déplacement » via warpQuad — déformation
   *  douce cuite dans le calque et son masque. */
  warpField(l, field, sub = 2) {
    if (!l?.cv || !field?.data) return
    const { data, gw, gh, cell } = field
    const F = (i, j) => [i * cell + data[(j * gw + i) * 2], j * cell + data[(j * gw + i) * 2 + 1]]
    for (const [cv, ctx] of [[l.cv, l.ctx], ...(l.mask ? [[l.mask, l.maskCtx]] : [])]) {
      const src = mkCanvas(this.w, this.h)
      src.getContext('2d').drawImage(cv, 0, 0)
      ctx.clearRect(0, 0, this.w, this.h)
      for (let j = 0; j < gh - 1; j++) {
        for (let i = 0; i < gw - 1; i++) {
          const sw = Math.min(cell, this.w - i * cell), sh = Math.min(cell, this.h - j * cell)
          if (sw <= 0 || sh <= 0) continue
          warpQuad(ctx, src, i * cell, j * cell, sw, sh,
            [F(i, j), F(i + 1, j), F(i + 1, j + 1), F(i, j + 1)], sub)
        }
      }
    }
    if (l.type === 'shape') { l.type = 'pixel'; l.shape = null }
    if (l.type === 'text') { l.type = 'pixel'; l.text = null }
    if (l.type === 'fill') { l.type = 'pixel'; l.fillDef = null }
    this.markDirty()
  }

  flatten() {
    const flat = this._mkLayer('Arrière-plan')
    flat.locked = true
    flat.ctx.drawImage(this.composite(), 0, 0)
    this.layers = [flat]
    this.activeId = flat.id
  }

  /** Nouveau calque via copier : la sélection (ou tout le calque) copiée — Ctrl+J. */
  layerViaCopy() {
    const l = this.active
    if (!l || l.type === 'adjust') return null
    const n = this._mkLayer(`${l.name} copie`)
    n.ctx.save()
    this._clipSel(n.ctx)
    n.ctx.drawImage(l.cv, 0, 0)
    n.ctx.restore()
    n.dx = l.dx; n.dy = l.dy
    const f = this._find(l.id)
    if (f) f.arr.splice(f.i + 1, 0, n)
    else this.layers.push(n)
    this.activeId = n.id
    this.deselect()
    return n
  }

  /** Nouveau calque via couper : copie puis vide la zone d'origine. */
  layerViaCut() {
    const l = this.active
    if (!l || l.type === 'adjust') return null
    const n = this.layerViaCopy()
    if (!n) return null
    if (!l.locked) { l.ctx.save(); this._clipSel(l.ctx); l.ctx.clearRect(-l.dx, -l.dy, this.w, this.h); l.ctx.restore() }
    return n
  }

  /** Fusion des calques visibles dans un nouveau calque — Ctrl+Maj+Alt+E. */
  mergeVisible() {
    const n = this._mkLayer('Fusion visible')
    n.ctx.drawImage(this.composite(), 0, 0)
    this._insertAboveActive(n)
    this.activeId = n.id
    return n
  }

  /** Fusionne le calque actif dans celui directement dessous — Ctrl+E.
   *  Opacité, mode de fusion et masque sont cuits dans le résultat. */
  mergeDown() {
    const f = this._find(this.activeId)
    const i = f ? f.i : -1
    const l = f?.l, below = f ? f.arr[i - 1] : null
    if (!l || !below || l.locked || below.locked) return false
    if (l.type === 'adjust' || below.type === 'adjust') return false
    // pixels effectifs du calque du dessus (composite pour un groupe, masque appliqué)
    const src = mkCanvas(this.w, this.h)
    const sx = src.getContext('2d')
    sx.drawImage(l.type === 'group' ? this._composite(l.children || []) : l.cv, 0, 0)
    if (l.mask) { sx.globalCompositeOperation = 'destination-in'; sx.drawImage(l.mask, 0, 0) }
    below.ctx.save()
    below.ctx.globalAlpha = l.opacity ?? 1
    below.ctx.globalCompositeOperation = l.blend || 'source-over'
    below.ctx.drawImage(src, l.dx - below.dx, l.dy - below.dy)
    below.ctx.restore()
    f.arr.splice(i, 1)
    this.activeId = below.id
    this.markDirty()
    return true
  }

  /** Rogne le document au rectangle des pixels non transparents du composite. */
  trim() {
    const comp = this.composite()
    const d = comp.getContext('2d').getImageData(0, 0, this.w, this.h).data
    let minX = this.w, minY = this.h, maxX = -1, maxY = -1
    for (let y = 0; y < this.h; y += 2) {
      for (let x = 0; x < this.w; x += 2) {
        if (d[(y * this.w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return false
    this.crop([minX, minY, maxX - minX + 2, maxY - minY + 2])
    return true
  }

  /** Recadre le document sur la sélection courante. */
  cropToSelection() {
    if (!this.sel) return false
    this.crop(this.sel)
    return true
  }

  /** Redimensionne document + tous les calques par un facteur. */
  resizeDoc(fx2, fy2 = fx2) {
    const nw = Math.max(1, Math.round(this.w * fx2)), nh = Math.max(1, Math.round(this.h * fy2))
    this.walk((l) => {
      const next = mkCanvas(nw, nh)
      next.getContext('2d').drawImage(l.cv, 0, 0, nw, nh)
      l.cv = next; l.ctx = next.getContext('2d')
      l.dx *= fx2; l.dy *= fy2
      if (l.mask) {
        const m2 = mkCanvas(nw, nh)
        m2.getContext('2d').drawImage(l.mask, 0, 0, nw, nh)
        l.mask = m2; l.maskCtx = m2.getContext('2d')
      }
    })
    this.w = nw; this.h = nh; this.sel = null; this.selPoly = null
    this.markDirty()
  }

  /** Taille de la zone de travail (Photoshop « Canvas Size ») : agrandit ou
   *  rogne le canevas sans mise à l'échelle. ax/ay ∈ [0,1] = ancre
   *  (0 = bord haut/gauche fixe, 0.5 = centré, 1 = bord bas/droit fixe). */
  resizeCanvas(nw, nh, ax = 0.5, ay = 0.5) {
    nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh))
    if (nw === this.w && nh === this.h) return false
    const ox = Math.round(ax * (nw - this.w)), oy = Math.round(ay * (nh - this.h))
    this.walk((l) => {
      const next = mkCanvas(nw, nh)
      next.getContext('2d').drawImage(l.cv, ox, oy)
      l.cv = next; l.ctx = next.getContext('2d')
      if (l.mask) {
        const m2 = mkCanvas(nw, nh)
        m2.getContext('2d').drawImage(l.mask, ox, oy)
        l.mask = m2; l.maskCtx = m2.getContext('2d')
      }
      // les formes vectorielles stockent leurs coords en espace calque (= doc)
      if (l.shape) {
        l.shape.x += ox; l.shape.y += oy
        if (l.shape.pts) for (const p of l.shape.pts) {
          p.x += ox; p.y += oy
          if (p.c1) { p.c1[0] += ox; p.c1[1] += oy }
          if (p.c2) { p.c2[0] += ox; p.c2[1] += oy }
        }
      }
    })
    this.w = nw; this.h = nh
    if (this.sel) this.sel = [this.sel[0] + ox, this.sel[1] + oy, this.sel[2], this.sel[3]]
    if (this.selPoly) this.selPoly = this.selPoly.map(([x, y]) => [x + ox, y + oy])
    this.markDirty()
    return { ox, oy }
  }

  // ---- Sélection (rectangle, ellipse ou lasso polygonal) ------------------------

  selectAll() { this.sel = [0, 0, this.w, this.h]; this.selPoly = null; this.selEllipse = false; this.selInverted = false }
  deselect() {
    if (this.sel || this.selPoly) {
      this.lastSel = { sel: this.sel, selPoly: this.selPoly, selEllipse: this.selEllipse, selInverted: this.selInverted }
    }
    this.sel = null; this.selPoly = null; this.selInverted = false
  }

  reselect() {
    if (!this.lastSel) return
    const s = this.lastSel
    this.sel = s.sel; this.selPoly = s.selPoly
    this.selEllipse = s.selEllipse; this.selInverted = s.selInverted
  }

  invertSelection() {
    if (!this.sel && !this.selPoly) return
    this.selInverted = !this.selInverted
  }

  /** Étend (+n) ou contracte (−n) la sélection (rect, ellipse ou polygone). */
  resizeSelection(n) {
    if (this.selPoly) {
      // homothétie depuis le centroïde
      const p = this.selPoly
      let cx = 0, cy = 0
      for (const [x, y] of p) { cx += x; cy += y }
      cx /= p.length; cy /= p.length
      this.selPoly = p.map(([x, y]) => {
        const dx = x - cx, dy = y - cy
        const d = Math.hypot(dx, dy) || 1
        const k = Math.max(0, (d + n) / d)
        return [cx + dx * k, cy + dy * k]
      })
      const bb = this.selPoly.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [1e9, 1e9, -1e9, -1e9])
      this.sel = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
    } else if (this.sel) {
      const [x, y, w, h] = this.sel
      const nw = Math.max(1, w + 2 * n), nh = Math.max(1, h + 2 * n)
      this.sel = [x - n, y - n, nw, nh]
    }
  }

  /** Lisse un tracé de sélection polygonal (moyenne des voisins, n itérations). */
  smoothSelection(iter = 1) {
    const p = this.selPoly
    if (!p || p.length < 4) return
    let q = p
    for (let it = 0; it < iter; it++) {
      q = q.map(([x, y], i) => {
        if (i === 0 || i === q.length - 1) return [x, y]
        const [ax, ay] = q[i - 1], [bx, by] = q[i + 1]
        return [(ax + 2 * x + bx) / 4, (ay + 2 * y + by) / 4]
      })
    }
    this.selPoly = q
    const bb = q.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [1e9, 1e9, -1e9, -1e9])
    this.sel = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
  }

  /** Trace le chemin de la sélection dans ctx (coords calque = doc - l.dx/l.dy). */
  _selPath(ctx, dx = 0, dy = 0, append = false) {
    if (!append) ctx.beginPath()
    if (this.selPoly) {
      this.selPoly.forEach(([x, y], i) => (i ? ctx.lineTo(x - dx, y - dy) : ctx.moveTo(x - dx, y - dy)))
      ctx.closePath()
    } else if (this.sel) {
      const [x, y, w, h] = this.sel
      if (this.selEllipse) {
        ctx.ellipse(x - dx + w / 2, y - dy + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2)
      } else ctx.rect(x - dx, y - dy, w, h)
    } else ctx.rect(-dx, -dy, this.w, this.h)
  }

  /** Masque blanc=sélectionné (avec plume optionnelle), noir=hors sélection. */
  selMaskCanvas(feather = 0) {
    const m = mkCanvas(this.w, this.h)
    const ctx = m.getContext('2d')
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, this.w, this.h)
    ctx.fillStyle = '#ffffff'
    if (this.selInverted) {
      // sélection inversée : blanc = extérieur de la forme (règle pair-impair)
      ctx.beginPath(); ctx.rect(0, 0, this.w, this.h)
      this._selPath(ctx, 0, 0, true)
      ctx.fill('evenodd')
    } else {
      this._selPath(ctx)
      ctx.fill()
    }
    if (feather > 0) {
      const m2 = mkCanvas(this.w, this.h)
      const x2 = m2.getContext('2d')
      x2.filter = `blur(${feather}px)`
      x2.drawImage(m, 0, 0)
      return m2
    }
    return m
  }

  /** Sélection lasso : liste de points image — la bbox met à jour `sel`. */
  lassoSelect(pts) {
    if (!pts || pts.length < 3) { this.selPoly = null; this.sel = null; return }
    this.selPoly = pts
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
    for (const [x, y] of pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    this.sel = [minX, minY, maxX - minX, maxY - minY]
  }

  /** Clip la zone de dessin à la sélection (polygone, rect, ellipse — inversable). */
  _clipSel(ctx, dx = 0, dy = 0) {
    if (this.selInverted) {
      ctx.beginPath()
      ctx.rect(-dx, -dy, this.w, this.h)
      this._selPath(ctx, dx, dy, true)
      ctx.clip('evenodd')
      return
    }
    this._selPath(ctx, dx, dy)
    ctx.clip()
  }

  /** Remplit la sélection (ou le calque entier) avec `color` — plume, opacité
   *  et mode de fusion optionnels (dialogue « Remplir » de Photoshop). */
  fill(color, feather = 0, opts = {}) {
    const l = this.active
    if (!l || l.locked || l.type === 'group') return false
    if (feather > 0 && (this.sel || this.selPoly)) {
      const m = this.selMaskCanvas(feather)
      const t = mkCanvas(this.w, this.h)
      const x = t.getContext('2d')
      x.fillStyle = color; x.fillRect(0, 0, this.w, this.h)
      x.globalCompositeOperation = 'destination-in'
      x.drawImage(m, 0, 0)
      l.ctx.save()
      if (opts.blend) l.ctx.globalCompositeOperation = opts.blend
      if (opts.opacity != null) l.ctx.globalAlpha = opts.opacity
      l.ctx.translate(-l.dx, -l.dy)
      l.ctx.drawImage(t, 0, 0)
      l.ctx.restore()
      return true
    }
    l.ctx.save()
    this._clipSel(l.ctx, l.dx, l.dy)
    if (opts.blend) l.ctx.globalCompositeOperation = opts.blend
    if (opts.opacity != null) l.ctx.globalAlpha = opts.opacity
    l.ctx.fillStyle = color
    l.ctx.fillRect(0, 0, this.w, this.h)
    l.ctx.restore()
    return true
  }

  /** Trace un contour le long de la sélection courante — `pos` : inside |
   *  center | outside (Photoshop « Contour »). Sans sélection : tout le calque. */
  strokeSel(color, widthPx = 4, pos = 'center', feather = 0) {
    const l = this.active
    if (!l || l.locked || l.type === 'group') return false
    const m = this.selMaskCanvas(feather) // blanc = dedans (doc-space)
    // dilatation (union des translations) / érosion (intersection) du masque
    const N = (r) => Math.max(10, Math.round(r * 2.5))
    const dilate = (r) => {
      const c = mkCanvas(this.w, this.h); const x = c.getContext('2d')
      x.drawImage(m, 0, 0)
      for (let i = 0; i < N(r); i++) {
        const a = (i / N(r)) * Math.PI * 2
        x.drawImage(m, Math.cos(a) * r, Math.sin(a) * r)
      }
      return c
    }
    const erode = (r) => {
      const c = mkCanvas(this.w, this.h); const x = c.getContext('2d')
      x.drawImage(m, 0, 0)
      x.globalCompositeOperation = 'destination-in'
      for (let i = 0; i < N(r); i++) {
        const a = (i / N(r)) * Math.PI * 2
        x.drawImage(m, Math.cos(a) * r, Math.sin(a) * r)
      }
      return c
    }
    // anneau = bord extérieur moins bord intérieur selon la position
    const outer = pos === 'inside' ? m : dilate(pos === 'center' ? widthPx / 2 : widthPx)
    const inner = pos === 'outside' ? m : erode(pos === 'center' ? widthPx / 2 : widthPx)
    const ring = mkCanvas(this.w, this.h)
    const rx = ring.getContext('2d')
    rx.drawImage(outer, 0, 0)
    rx.globalCompositeOperation = 'destination-out'
    rx.drawImage(inner, 0, 0)
    rx.globalCompositeOperation = 'source-over'
    const t = mkCanvas(this.w, this.h)
    const x = t.getContext('2d')
    x.fillStyle = color; x.fillRect(0, 0, this.w, this.h)
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(ring, 0, 0)
    l.ctx.save()
    l.ctx.translate(-l.dx, -l.dy)
    l.ctx.drawImage(t, 0, 0)
    l.ctx.restore()
    return true
  }

  /** Efface le contenu du calque actif dans la sélection — plume optionnelle. */
  deleteContent(feather = 0) {
    const l = this.active
    if (!l || l.locked || l.type === 'group') return false
    if (feather > 0 && (this.sel || this.selPoly)) {
      const m = this.selMaskCanvas(feather)
      l.ctx.save()
      l.ctx.globalCompositeOperation = 'destination-out'
      l.ctx.drawImage(m, l.dx, l.dy)
      l.ctx.restore()
      return true
    }
    l.ctx.save()
    this._clipSel(l.ctx, l.dx, l.dy)
    l.ctx.clearRect(-l.dx, -l.dy, this.w, this.h)
    l.ctx.restore()
    return true
  }

  // ---- Styles de calque (fx) ----------------------------------------------------
  //
  // Pipeline par calque : effets externes (contour, lueur, ombre) dessinés sous
  // les pixels (alpha = Opacité), pixels teintés éventuels par incrustation
  // (alpha = Remplissage), puis effets internes (ombre interne, lueur interne,
  // biseautage, satin) écrêtés à la forme du calque.

  /** Silhouette opaque du calque (alpha → blanc) — base de tous les effets.
      `src` = pixels effectifs (calque × masque éventuel). */
  _sil(l, src = null) {
    const c = mkCanvas(this.w, this.h)
    const x = c.getContext('2d')
    x.drawImage(src || l.cv, 0, 0)
    x.globalCompositeOperation = 'source-in'
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, this.w, this.h)
    return c
  }

  /** Copie teintée d'une silhouette (alpha conservé, couleur remplacée). */
  _tint(src, color) {
    const c = mkCanvas(this.w, this.h)
    const x = c.getContext('2d')
    x.drawImage(src, 0, 0)
    x.globalCompositeOperation = 'source-in'
    x.fillStyle = color
    x.fillRect(0, 0, this.w, this.h)
    return c
  }

  /** Croissant interne = silhouette moins silhouette décalée, écrêté au calque. */
  _innerRing(sil, ox, oy) {
    const c = mkCanvas(this.w, this.h)
    const x = c.getContext('2d')
    x.drawImage(sil, 0, 0)
    x.globalCompositeOperation = 'destination-out'
    x.drawImage(sil, ox, oy)
    return c
  }

  /** Composite pleine résolution (tous calques visibles, sans filtres) */
  composite() { return this._composite(this.layers) }

  /** Rend une pile de calques (niveau racine ou enfants d'un groupe) sur un
   *  canevas W×H — récursif : un groupe = composite de ses enfants. */
  _composite(layers) {
    const cv = mkCanvas(this.w, this.h)
    const ctx = cv.getContext('2d')
    const { w: W, h: H } = this
    this._silCache = {}
    let belowEff = null // pixels du calque directement inférieur (écrêtage)

    for (const l of layers) {
      if (!l.visible) continue
      // --- Groupe : rendu récursif de ses enfants, puis fusionné comme un calque ---
      if (l.type === 'group') {
        let eff = this._composite(l.children || [])
        if (l.mask || (l.clip && belowEff)) {
          const cl = mkCanvas(W, H)
          const ex = cl.getContext('2d')
          ex.drawImage(eff, 0, 0)
          ex.globalCompositeOperation = 'destination-in'
          if (l.mask) ex.drawImage(l.mask, 0, 0)
          if (l.clip && belowEff) ex.drawImage(belowEff, 0, 0)
          eff = cl
        }
        if (!l.clip) belowEff = eff // base d'écrêtage pour les suivants
        ctx.save()
        ctx.globalAlpha = (l.opacity ?? 1) * (l.fill ?? 1)
        ctx.globalCompositeOperation = l.blend || 'source-over'
        ctx.drawImage(eff, 0, 0)
        ctx.restore()
        ctx.globalAlpha = 1
        continue
      }
      // --- Calque de réglage : transforme tout ce qui est déjà composé ---
      if (l.type === 'adjust') {
        if (!l.adj?.kind) continue
        const t = mkCanvas(W, H)
        t.getContext('2d').drawImage(cv, 0, 0)
        applyAdjust(t, l.adj)
        if (l.mask) {
          const tx = t.getContext('2d')
          tx.globalCompositeOperation = 'destination-in'
          tx.drawImage(l.mask, 0, 0)
        }
        if (l.clip && belowEff) { // écrêter sur le calque inférieur
          const tx = t.getContext('2d')
          tx.globalCompositeOperation = 'destination-in'
          tx.drawImage(belowEff, 0, 0)
        }
        ctx.save()
        ctx.globalAlpha = l.opacity ?? 1
        ctx.globalCompositeOperation = l.blend || 'source-over'
        ctx.drawImage(t, 0, 0)
        ctx.restore()
        ctx.globalAlpha = 1
        continue
      }
      const fx = l.fx || {}
      const hasFx = !l.fxOff && Object.values(fx).some((f) => f?.on)
      const fill = l.fill ?? 1
      // pixels effectifs = calque × masque de fusion (× écrêtage sur calque inférieur)
      let eff = l.cv
      if (l.mask || (l.clip && belowEff)) {
        const cl = mkCanvas(W, H)
        const ex = cl.getContext('2d')
        ex.drawImage(l.cv, 0, 0)
        ex.globalCompositeOperation = 'destination-in'
        if (l.mask) ex.drawImage(l.mask, 0, 0)
        // belowEff est en coords doc : ramené en coords locales du calque
        if (l.clip && belowEff) ex.drawImage(belowEff, -l.dx, -l.dy)
        eff = cl
      }
      // le calque devient la base d'écrêtage des suivants — sauf s'il est lui-même
      // écrêté (Photoshop : plusieurs calques peuvent s'écrêter sur la même base)
      if (!l.clip) {
        if (l.dx || l.dy) {
          const b = mkCanvas(W, H)
          b.getContext('2d').drawImage(eff, l.dx, l.dy)
          belowEff = b
        } else belowEff = eff
      }
      const off = (e) => {
        const a = ((e.angle ?? 120) * Math.PI) / 180
        const d = e.dist ?? 0
        return [Math.cos(a) * d, Math.sin(a) * d]
      }

      ctx.save()
      ctx.globalCompositeOperation = l.blend || 'source-over'

      // --- Effets externes (sous les pixels) : alpha = opacité calque ---
      if (hasFx) {
        const sil = this._silCache[l.id] || (this._silCache[l.id] = this._sil(l, eff))
        ctx.globalAlpha = l.opacity
        // dessine la silhouette teintée dilatée de `r` px autour de (ox, oy)
        const ring = (t, r, ox, oy) => {
          if (r <= 0) { ctx.drawImage(t, l.dx + ox, l.dy + oy); return }
          const n = r > 6 ? 20 : 12
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2
            ctx.drawImage(t, l.dx + ox + Math.cos(a) * r, l.dy + oy + Math.sin(a) * r)
          }
        }
        if (fx.stroke?.on && fx.stroke.size > 0) {
          const t = this._tint(sil, fx.stroke.color)
          const s = Math.max(1, fx.stroke.size)
          ctx.globalCompositeOperation = fx.stroke.blend || 'source-over'
          ctx.globalAlpha = l.opacity * (fx.stroke.opacity / 100)
          ring(t, s, 0, 0)
          ctx.globalCompositeOperation = l.blend || 'source-over'
          ctx.globalAlpha = l.opacity
        }
        if (fx.glow?.on && fx.glow.size > 0) {
          const g = fx.glow
          const t = this._tint(sil, g.color)
          ctx.globalCompositeOperation = g.blend || 'screen'
          const dil = Math.round((g.size * (g.spread || 0)) / 100)  // partie dure (étendue)
          if (dil > 0) { ctx.globalAlpha = l.opacity * (g.opacity / 100); ring(t, dil, 0, 0) }
          ctx.filter = `blur(${Math.max(1, g.size - dil)}px)`
          ctx.globalAlpha = l.opacity * (g.opacity / 100) * ((g.range ?? 100) / 100)
          ctx.drawImage(t, l.dx, l.dy)
          ctx.filter = 'none'
          ctx.globalCompositeOperation = l.blend || 'source-over'
          ctx.globalAlpha = l.opacity
        }
        if (fx.shadow?.on) {
          const s = fx.shadow
          const t = this._tint(sil, s.color)
          const [ox, oy] = off(s)
          ctx.globalCompositeOperation = s.blend || 'multiply'
          const dil = Math.round((s.size * (s.spread || 0)) / 100)
          ctx.globalAlpha = l.opacity * (s.opacity / 100)
          if (dil > 0) ring(t, dil, ox, oy)
          ctx.filter = `blur(${Math.max(1, s.size - dil) / 2}px)`
          ctx.drawImage(t, l.dx + ox, l.dy + oy)
          ctx.filter = 'none'
          ctx.globalCompositeOperation = l.blend || 'source-over'
          ctx.globalAlpha = l.opacity
        }
      }

      // --- Pixels du calque : alpha = remplissage (+ incrustations) ---
      let drawn = eff
      if (hasFx && (fx.colorOverlay?.on || fx.gradientOverlay?.on)) {
        const ov = mkCanvas(W, H)
        const x = ov.getContext('2d')
        x.drawImage(eff, 0, 0)
        // applique un remplissage écrêté à la forme, avec le mode de fusion de l'effet
        const lay = (fill, blend, alpha) => {
          const c = mkCanvas(W, H)
          const cx = c.getContext('2d')
          cx.fillStyle = fill
          cx.fillRect(0, 0, W, H)
          cx.globalCompositeOperation = 'destination-in'
          cx.drawImage(eff, 0, 0)
          x.globalCompositeOperation = blend || 'source-over'
          x.globalAlpha = alpha
          x.drawImage(c, 0, 0)
          x.globalCompositeOperation = 'source-over'
          x.globalAlpha = 1
        }
        if (fx.colorOverlay?.on) lay(fx.colorOverlay.color, fx.colorOverlay.blend, fx.colorOverlay.opacity / 100)
        if (fx.gradientOverlay?.on) {
          const g = fx.gradientOverlay
          const a = ((g.angle ?? 90) * Math.PI) / 180
          const cx = W / 2, cy = H / 2, r = Math.max(W, H) / 2
          const lg = x.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r)
          lg.addColorStop(0, g.from)
          lg.addColorStop(1, g.to)
          lay(lg, g.blend, g.opacity / 100)
        }
        drawn = ov
      }
      // Pixels : alpha = Opacité × Remplissage (Photoshop : l'opacité agit
      // aussi sur les effets, le remplissage seulement sur les pixels)
      ctx.globalAlpha = l.opacity * fill
      ctx.drawImage(drawn, l.dx, l.dy)

      // --- Effets internes (au-dessus) : alpha = opacité calque ---
      if (hasFx && sil0Needed(fx)) {
        const sil = this._silCache[l.id]
        ctx.globalAlpha = l.opacity
        if (fx.innerShadow?.on) {
          const [ox, oy] = off(fx.innerShadow)
          const m = this._tint(this._innerRing(sil, ox, oy), fx.innerShadow.color)
          ctx.globalCompositeOperation = fx.innerShadow.blend || 'multiply'
          ctx.filter = `blur(${Math.max(1, fx.innerShadow.size / 2)}px)`
          ctx.globalAlpha = l.opacity * (fx.innerShadow.opacity / 100)
          ctx.drawImage(m, l.dx, l.dy)
          ctx.filter = 'none'
          ctx.globalCompositeOperation = l.blend || 'source-over'
        }
        if (fx.innerGlow?.on && fx.innerGlow.size > 0) {
          // silhouette floutée écrêtée à l'intérieur = halo interne
          const m = mkCanvas(W, H)
          const x = m.getContext('2d')
          x.filter = `blur(${fx.innerGlow.size}px)`
          x.drawImage(sil, 0, 0)
          x.filter = 'none'
          x.globalCompositeOperation = 'destination-in'
          x.drawImage(eff, 0, 0)
          const t = this._tint(m, fx.innerGlow.color)
          ctx.globalCompositeOperation = fx.innerGlow.blend || 'screen'
          ctx.globalAlpha = l.opacity * (fx.innerGlow.opacity / 100) * ((fx.innerGlow.range ?? 100) / 100)
          ctx.drawImage(t, l.dx, l.dy)
          ctx.globalCompositeOperation = l.blend || 'source-over'
        }
        if (fx.bevel?.on && fx.bevel.size > 0) {
          const s = Math.max(1, fx.bevel.size / 2)
          const hi = this._tint(this._innerRing(sil, s, s), '#ffffff')
          const lo = this._tint(this._innerRing(sil, -s, -s), '#000000')
          ctx.globalCompositeOperation = 'screen'
          ctx.globalAlpha = l.opacity * (fx.bevel.opacity / 100)
          ctx.drawImage(hi, l.dx, l.dy)
          ctx.globalCompositeOperation = 'multiply'
          ctx.drawImage(lo, l.dx, l.dy)
          ctx.globalCompositeOperation = l.blend || 'source-over'
        }
        if (fx.satin?.on && fx.satin.size > 0) {
          const s = fx.satin.size / 2
          const m1 = this._tint(this._innerRing(sil, s, s), '#000000')
          const m2 = this._tint(this._innerRing(sil, -s, -s), '#000000')
          ctx.globalCompositeOperation = 'overlay'
          ctx.globalAlpha = l.opacity * (fx.satin.opacity / 100)
          ctx.drawImage(m1, l.dx, l.dy)
          ctx.drawImage(m2, l.dx, l.dy)
          ctx.globalCompositeOperation = l.blend || 'source-over'
        }
        ctx.globalAlpha = l.opacity
      }

      ctx.restore()
      ctx.globalAlpha = 1
    }
    ctx.globalCompositeOperation = 'source-over'
    this._silCache = null
    return cv
  }

  /** Composite avec filtres + niveaux + exposition + BB + courbes + netteté (caché). */
  compositeFiltered() {
    if (this._cf) return this._cf
    const src = this.composite()
    const a = this.adjust, cv0 = this.curves
    const hasCurves = cv0.rgb || cv0.r || cv0.g || cv0.b
    const hasLevels = a.inBlack > 0 || a.inWhite < 255 || a.gamma !== 100 || a.outBlack > 0 || a.outWhite < 255
    const hasExp = a.exposure !== 0
    const hasWB = a.temp !== 0 || a.tint !== 0 || (this.wb && (this.wb.r !== 1 || this.wb.g !== 1 || this.wb.b !== 1))
    const hasPx = hasCurves || hasLevels || hasExp || hasWB
    if (!this.adjustVisible && !hasPx && !a.sharp) { this._cf = src; return src }

    const cv = mkCanvas(this.w, this.h)
    const ctx = cv.getContext('2d')
    if (this.adjustVisible) ctx.filter = filterString(a)
    ctx.drawImage(src, 0, 0)

    if (hasPx) {
      // LUT RGB : niveaux -> exposition -> courbe RGB
      let rgb = null
      if (hasLevels) rgb = levelsLUT(a.inBlack, a.inWhite, a.gamma, a.outBlack ?? 0, a.outWhite ?? 255)
      if (hasExp) {
        const m = Math.pow(2, a.exposure)
        const base = rgb || IDENTITY
        const lut = new Uint8ClampedArray(256)
        for (let i = 0; i < 256; i++) lut[i] = Math.min(255, base[i] * m)
        rgb = lut
      }
      if (cv0.rgb) rgb = rgb ? composeLUT(rgb, curveLUT(cv0.rgb)) : curveLUT(cv0.rgb)
      // LUTs par canal : temp/teinte -> gains pipette BB -> courbe de canal
      const t = a.temp * 0.4, ti = a.tint * 0.4
      const chan = (key, add) => {
        const mul = this.wb ? this.wb[key] : 1
        let l = null
        if (add || mul !== 1) l = chanLUT(mul, add)
        if (cv0[key]) l = l ? composeLUT(l, curveLUT(cv0[key])) : curveLUT(cv0[key])
        return l
      }
      applyLUTs(cv, { rgb, r: chan('r', t), g: chan('g', ti), b: chan('b', -t) })
    }
    if (a.sharp > 0) unsharp(cv, Math.min(1, a.sharp / 100) * 0.6)
    this._cf = cv
    return cv
  }

  /** Pipette balance des blancs : fixe les gains pour que le pixel cliqué devienne neutre. */
  whiteBalanceAt(ix, iy) {
    const src = this.compositeFiltered()
    const W = src.width, H = src.height
    ix = Math.max(0, Math.min(W - 1, Math.floor(ix))); iy = Math.max(0, Math.min(H - 1, Math.floor(iy)))
    // moyenne 5x5 pour limiter le bruit
    const d = src.getContext('2d').getImageData(Math.max(0, ix - 2), Math.max(0, iy - 2), Math.min(5, W), Math.min(5, H)).data
    let r = 0, g = 0, b = 0, n = d.length / 4
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
    r /= n; g /= n; b /= n
    const m = (r + g + b) / 3
    const clamp = (v) => Math.min(2.5, Math.max(0.4, v))
    this.wb = { r: clamp(m / (r || 1)), g: clamp(m / (g || 1)), b: clamp(m / (b || 1)) }
    this.markDirty()
    return this.wb
  }

  /** Sélection « baguette magique » : bbox de la région contiguë de couleur proche. */
  wandSelect(ix, iy, tolerance = 32) {
    const src = this.compositeFiltered()
    const ctx = src.getContext('2d')
    const W = src.width, H = src.height
    ix = Math.floor(ix); iy = Math.floor(iy)
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return null
    const d = ctx.getImageData(0, 0, W, H).data
    const idx = (x, y) => (y * W + x) * 4
    const t0 = [d[idx(ix, iy)], d[idx(ix, iy) + 1], d[idx(ix, iy) + 2]]
    const seen = new Uint8Array(W * H)
    const stack = [[ix, iy]]
    let minX = ix, maxX = ix, minY = iy, maxY = iy, n = 0
    const match = (o) => Math.abs(d[o] - t0[0]) + Math.abs(d[o + 1] - t0[1]) + Math.abs(d[o + 2] - t0[2]) <= tolerance * 3
    while (stack.length && n < W * H) {
      const [x, y] = stack.pop()
      const k = y * W + x
      if (seen[k]) continue
      seen[k] = 1
      if (!match(k * 4)) continue
      n++
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (x > 0) stack.push([x - 1, y]); if (x < W - 1) stack.push([x + 1, y])
      if (y > 0) stack.push([x, y - 1]); if (y < H - 1) stack.push([x, y + 1])
    }
    if (n < 10) return null
    this.selPoly = null
    this.sel = [minX, minY, maxX - minX + 1, maxY - minY + 1]
    return this.sel
  }

  /** Plage de couleurs (Photoshop « Sélection par couleur ») : sélectionne la
   *  composante connexe la plus grande dont les pixels sont proches de `rgb`
   *  (écart absolu par canal ≤ tol). Le contour réel devient un lasso. */
  colorRangeSelect(rgb, tol = 60) {
    if (!this.w) return false
    // sous-échantillonnage pour rester fluide (~0,8 Mpx de travail)
    const f = Math.max(1, Math.round(Math.sqrt((this.w * this.h) / 8e5)))
    const cw = Math.max(8, Math.round(this.w / f)), ch = Math.max(8, Math.round(this.h / f))
    const c = mkCanvas(cw, ch)
    c.getContext('2d').drawImage(this.compositeFiltered(), 0, 0, cw, ch)
    const mask = colorMask(c, rgb, tol)
    const poly = largestComponentBoundary(mask, cw, ch)
    if (!poly || poly.length < 3) return false
    this.lassoSelect(poly.map(([x, y]) => [x * f, y * f]))
    this.selEllipse = false; this.selInverted = false
    return true
  }

  /** Étendre (contigu) / Généraliser (tout le doc) — Photoshop « Sélection →
   *  Étendre / Généraliser ». Couleur de référence = moyenne de la sélection
   *  courante sur le composite ; le résultat devient un lasso. */
  growSel(tol = 32, similar = false) {
    if (!this.w || (!this.sel && !this.selPoly)) return false
    const f = Math.max(1, Math.round(Math.sqrt((this.w * this.h) / 8e5)))
    const cw = Math.max(8, Math.round(this.w / f)), ch = Math.max(8, Math.round(this.h / f))
    const comp = mkCanvas(cw, ch)
    comp.getContext('2d').drawImage(this.compositeFiltered(), 0, 0, cw, ch)
    const sm = mkCanvas(cw, ch)
    sm.getContext('2d').drawImage(this.selMaskCanvas(0), 0, 0, cw, ch)
    const cd = comp.getContext('2d').getImageData(0, 0, cw, ch).data
    const md = sm.getContext('2d').getImageData(0, 0, cw, ch).data
    // couleur moyenne dans la sélection
    let r = 0, g = 0, b = 0, n = 0
    const inside = new Uint8Array(cw * ch)
    for (let i = 0; i < cw * ch; i++) {
      if (md[i * 4 + 3] > 64 && cd[i * 4 + 3] > 16) {
        inside[i] = 1; n++
        r += cd[i * 4]; g += cd[i * 4 + 1]; b += cd[i * 4 + 2]
      }
    }
    if (n < 4) return false
    const mean = [r / n, g / n, b / n]
    let mask = colorMask(comp, mean, tol)
    if (!similar) {
      // restreint aux composantes connexes qui touchent la sélection courante
      const lab = new Int32Array(cw * ch).fill(-1)
      const stack = [], keep = []
      let cur = 0
      for (let s0 = 0; s0 < cw * ch; s0++) {
        if (!mask[s0] || lab[s0] >= 0) continue
        const members = []
        stack.push(s0); lab[s0] = cur
        while (stack.length) {
          const k = stack.pop(), x = k % cw, y = (k / cw) | 0
          members.push(k)
          if (x > 0 && mask[k - 1] && lab[k - 1] < 0) { lab[k - 1] = cur; stack.push(k - 1) }
          if (x < cw - 1 && mask[k + 1] && lab[k + 1] < 0) { lab[k + 1] = cur; stack.push(k + 1) }
          if (y > 0 && mask[k - cw] && lab[k - cw] < 0) { lab[k - cw] = cur; stack.push(k - cw) }
          if (y < ch - 1 && mask[k + cw] && lab[k + cw] < 0) { lab[k + cw] = cur; stack.push(k + cw) }
        }
        if (members.some((k) => inside[k])) keep.push(...members)
        cur++
      }
      if (!keep.length) return false
      mask = new Uint8Array(cw * ch)
      for (const k of keep) mask[k] = 1
      // inclut la sélection d'origine dans le résultat
      for (let i = 0; i < cw * ch; i++) if (inside[i]) mask[i] = 1
    }
    const poly = largestComponentBoundary(mask, cw, ch)
    if (!poly || poly.length < 3) return false
    this.lassoSelect(poly.map(([x, y]) => [x * f, y * f]))
    this.selEllipse = false; this.selInverted = false
    return true
  }

  /** Transformation de la sélection (translation px, échelle, rotation autour
   *  de son centre). Convertit rectangle/ellipse en lasso si nécessaire. */
  transformSel({ dx = 0, dy = 0, sx = 1, sy = 1, angle = 0 } = {}) {
    if (!this.sel && !this.selPoly) return false
    if (!this.selPoly) {
      // translation pure : le rectangle/ellipse reste éditable
      if (sx === 1 && sy === 1 && angle === 0) {
        this.sel = [this.sel[0] + dx, this.sel[1] + dy, this.sel[2], this.sel[3]]
        return true
      }
      const [x, y, w, h] = this.sel
      const pts = []
      if (this.selEllipse) {
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2
          pts.push([x + w / 2 + Math.cos(a) * w / 2, y + h / 2 + Math.sin(a) * h / 2])
        }
      } else pts.push([x, y], [x + w, y], [x + w, y + h], [x, y + h])
      this.selPoly = pts; this.sel = null; this.selEllipse = false
    }
    const bb = this.selPoly.reduce((a, [px, py]) => [Math.min(a[0], px), Math.min(a[1], py), Math.max(a[2], px), Math.max(a[3], py)], [1e9, 1e9, -1e9, -1e9])
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2
    const co = Math.cos(angle), si = Math.sin(angle)
    this.selPoly = this.selPoly.map(([px, py]) => {
      const ux = px - cx, uy = py - cy
      return [cx + sx * co * ux - sy * si * uy + dx, cy + sx * si * ux + sy * co * uy + dy]
    })
    this.lassoSelect(this.selPoly) // recalcule le cadre englobant
    return true
  }

  /** Mémorise la sélection courante comme canal alpha nommé. */
  saveSel(name) {
    if (!this.sel && !this.selPoly) return false
    this.savedSels.push({ id: `ch${++this._chSeq}`, name: name || `Alpha ${this.savedSels.length + 1}`, cv: this.selMaskCanvas(0) })
    return true
  }

  /** Recharge un canal mémorisé : son contour devient un lasso. */
  loadSel(id) {
    const s = this.savedSels.find((x) => x.id === id)
    if (!s) return false
    const { width: W, height: H } = s.cv
    const d = s.cv.getContext('2d').getImageData(0, 0, W, H).data
    const mask = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 64) mask[i] = 1
    const poly = largestComponentBoundary(mask, W, H)
    if (!poly || poly.length < 3) return false
    this.lassoSelect(poly)
    this.selEllipse = false; this.selInverted = false
    return true
  }

  deleteSel(id) {
    this.savedSels = this.savedSels.filter((x) => x.id !== id)
  }

  // ---- Masque rapide (Photoshop « Mode Masque ») ------------------------------
  // this.qm : canvas dont l'alpha > 0 = zone sélectionnée. Peinture noire =
  // masque (rouge à l'écran), blanche = sélection.

  enterQuickMask() {
    this.qm = this.selMaskCanvas(0)
    this.deselect()
    this._qmOvl = null
  }

  /** Peint sur le masque rapide : sel=true ajoute à la sélection, sinon masque. */
  qmPaint(x0, y0, x1, y1, size, sel = false, soft = 0, opacity = 1) {
    if (!this.qm) return
    const c = this.qm.getContext('2d')
    c.save()
    c.lineCap = 'round'; c.lineJoin = 'round'
    c.globalCompositeOperation = sel ? 'source-over' : 'destination-out'
    c.strokeStyle = `rgba(255,255,255,${sel ? opacity : 1})`
    c.lineWidth = size
    if (soft > 0.5) { c.shadowColor = '#ffffff'; c.shadowBlur = soft }
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke()
    c.restore()
    this._qmOvl = null
  }

  /** Sortie du masque rapide : le contour du masque devient la sélection. */
  exitQuickMask() {
    if (!this.qm) return false
    const { width: W, height: H } = this.qm
    const d = this.qm.getContext('2d').getImageData(0, 0, W, H).data
    const mask = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 64) mask[i] = 1
    const poly = largestComponentBoundary(mask, W, H)
    this.qm = null
    this._qmOvl = null
    if (!poly || poly.length < 3) { this.sel = null; this.selPoly = null; return false }
    this.lassoSelect(poly)
    this.selEllipse = false; this.selInverted = false
    return true
  }

  /** Aperçu rouge translucide du masque rapide (zone NON sélectionnée). */
  _qmOverlay() {
    if (!this._qmOvl) {
      const { width: W, height: H } = this.qm
      const o = mkCanvas(W, H)
      const x = o.getContext('2d')
      const d = x.createImageData(W, H)
      const src = this.qm.getContext('2d').getImageData(0, 0, W, H).data
      for (let i = 0; i < W * H; i++) {
        const a = src[i * 4 + 3]
        d[i * 4] = 235; d[i * 4 + 1] = 30; d[i * 4 + 2] = 30
        d[i * 4 + 3] = Math.round(128 * (1 - a / 255))
      }
      x.putImageData(d, 0, 0)
      this._qmOvl = o
    }
    return this._qmOvl
  }

  /** Tout faire apparaître (Photoshop « Image → Tout faire apparaître ») :
   *  étend le canevas au rectangle englobant de tout le contenu des calques. */
  revealAll() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    this.walk((l) => {
      if (!l.visible || l.type === 'adjust' || l.type === 'group' || !l.cv) return
      const b = this.contentBBox(l)
      if (!b) return
      x0 = Math.min(x0, b.x + l.dx); y0 = Math.min(y0, b.y + l.dy)
      x1 = Math.max(x1, b.x + b.w + l.dx); y1 = Math.max(y1, b.y + b.h + l.dy)
    })
    if (x1 <= x0 || y1 <= y0) return false
    const nw = Math.ceil(x1 - x0), nh = Math.ceil(y1 - y0)
    const ox = -Math.floor(x0), oy = -Math.floor(y0)
    if (nw === this.w && nh === this.h && ox === 0 && oy === 0) return false
    this.walk((l) => {
      const next = mkCanvas(nw, nh)
      next.getContext('2d').drawImage(l.cv, ox, oy)
      l.cv = next; l.ctx = next.getContext('2d')
      if (l.mask) {
        const m2 = mkCanvas(nw, nh)
        m2.getContext('2d').drawImage(l.mask, ox, oy)
        l.mask = m2; l.maskCtx = m2.getContext('2d')
      }
      if (l.shape) {
        l.shape.x += ox; l.shape.y += oy
        if (l.shape.pts) for (const p of l.shape.pts) {
          p.x += ox; p.y += oy
          if (p.c1) { p.c1[0] += ox; p.c1[1] += oy }
          if (p.c2) { p.c2[0] += ox; p.c2[1] += oy }
        }
      }
    })
    this.w = nw; this.h = nh; this.sel = null; this.selPoly = null
    this.markDirty()
    return true
  }

  /** Pixellise un calque de texte, de forme ou de remplissage
   *  (Photoshop « Pixeliser le calque »). */
  rasterizeLayer(id) {
    const l = this._find(id)?.l
    if (!l || (l.type !== 'text' && l.type !== 'shape' && l.type !== 'fill')) return false
    l.type = 'pixel'; l.text = null; l.shape = null; l.fillDef = null
    l.name = l.name.replace(/^(T|F)\s—\s/, '')
    this.markDirty()
    return true
  }

  /** Pot de peinture : remplit la région contiguë de couleur proche du calque actif. */
  bucketFill(ix, iy, color, tolerance = 32) {
    const l = this.active
    if (!l || l.locked || l.type === 'group') return false
    const W = this.w, H = this.h
    ix = Math.floor(ix - l.dx); iy = Math.floor(iy - l.dy)
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return false
    const d = l.ctx.getImageData(0, 0, W, H).data
    const o0 = (iy * W + ix) * 4
    const t0 = [d[o0], d[o0 + 1], d[o0 + 2], d[o0 + 3]]
    const seen = new Uint8Array(W * H)
    const stack = [[ix, iy]]
    const region = []
    const match = (o) =>
      Math.abs(d[o] - t0[0]) + Math.abs(d[o + 1] - t0[1]) + Math.abs(d[o + 2] - t0[2]) + Math.abs(d[o + 3] - t0[3]) <= tolerance * 4
    while (stack.length) {
      const [x, y] = stack.pop()
      const k = y * W + x
      if (seen[k]) continue
      seen[k] = 1
      if (!match(k * 4)) continue
      region.push(x, y)
      if (x > 0) stack.push([x - 1, y]); if (x < W - 1) stack.push([x + 1, y])
      if (y > 0) stack.push([x, y - 1]); if (y < H - 1) stack.push([x, y + 1])
    }
    if (region.length < 20) return false
    // masque de la région → remplissage couleur à travers ce masque
    const m = mkCanvas(W, H)
    const mx = m.getContext('2d')
    const md = mx.createImageData(W, H)
    for (let i = 0; i < region.length; i += 2) md.data[(region[i + 1] * W + region[i]) * 4 + 3] = 255
    mx.putImageData(md, 0, 0)
    const fill = mkCanvas(W, H)
    const fx2 = fill.getContext('2d')
    fx2.fillStyle = color
    fx2.fillRect(0, 0, W, H)
    fx2.globalCompositeOperation = 'destination-in'
    fx2.drawImage(m, 0, 0)
    l.ctx.drawImage(fill, 0, 0)
    return true
  }

  /** Dégradé : remplit le calque actif (ou la sélection) d'un dégradé fg→bg. */
  gradientFill(x1, y1, x2, y2, c1, c2) {
    const l = (this.active?.locked || this.active?.type === 'group') ? this.addLayer() : this.active || this.addLayer()
    l.ctx.save()
    this._clipSel(l.ctx, l.dx, l.dy)
    const g = l.ctx.createLinearGradient(x1 - l.dx, y1 - l.dy, x2 - l.dx, y2 - l.dy)
    g.addColorStop(0, c1)
    g.addColorStop(1, c2)
    l.ctx.fillStyle = g
    l.ctx.fillRect(0, 0, this.w, this.h)
    l.ctx.restore()
    return true
  }

  /** Image d'origine (calque 0, sans filtres ni calques) — mode « Avant » */
  original() {
    return this.layers[0]?.cv || null
  }

  // ---- Rendu écran --------------------------------------------------------------

  /**
   * Dessine le document dans `target` (canvas visible) avec la vue {scale, ox, oy}.
   * showOriginal : n'affiche que l'image de base sans calques/filtres (comparer).
   * cropRect : rectangle de recadrage en cours (coordonnées image).
   * handles : calque dont on affiche les poignées de transformation.
   * compare : fraction 0..1 — écran partagé original (gauche) / édité (droite).
   */
  render(target, view, { showOriginal = false, cropRect = null, handles = null, compare = null, previewRotate = 0, overlay = null, line = null, hideExtras = false } = {}) {
    const ctx = target.getContext('2d')
    ctx.clearRect(0, 0, target.width, target.height)
    if (!this.w) return

    const src = showOriginal ? this.original() : this.compositeFiltered()
    ctx.save()
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy)
    ctx.imageSmoothingEnabled = view.scale < 1
    // aperçu de redressage : le document pivote avant application
    if (previewRotate) {
      ctx.translate(this.w / 2, this.h / 2)
      ctx.rotate((previewRotate * Math.PI) / 180)
      ctx.translate(-this.w / 2, -this.h / 2)
    }
    // damier de transparence sous le document
    if (!this._checker) {
      const p = mkCanvas(12, 12)
      const c = p.getContext('2d')
      c.fillStyle = '#333a45'; c.fillRect(0, 0, 12, 12)
      c.fillStyle = '#454d5a'; c.fillRect(0, 0, 6, 6); c.fillRect(6, 6, 6, 6)
      this._checker = ctx.createPattern(p, 'repeat')
    }
    ctx.fillStyle = this._checker
    ctx.fillRect(0, 0, this.w, this.h)
    ctx.drawImage(src, 0, 0)
    // masque rapide : voile rouge sur la zone non sélectionnée
    if (this.qm) ctx.drawImage(this._qmOverlay(), 0, 0)
    // comparaison écran partagé : original à gauche du séparateur
    if (compare != null && !showOriginal) {
      const sx = Math.max(0.02, Math.min(0.98, compare)) * this.w
      const orig = this.original()
      if (orig) {
        ctx.save()
        ctx.beginPath(); ctx.rect(0, 0, sx, this.h); ctx.clip()
        ctx.drawImage(orig, 0, 0)
        ctx.restore()
        // séparateur jaune + poignée + étiquettes AVANT/APRÈS
        ctx.strokeStyle = '#f2c200'
        ctx.lineWidth = 2 / view.scale
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, this.h); ctx.stroke()
        const kr = 11 / view.scale, ky = this.h / 2
        ctx.fillStyle = '#f2c200'
        ctx.beginPath(); ctx.arc(sx, ky, kr, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5 / view.scale
        ctx.beginPath()
        ctx.moveTo(sx - kr * 0.45, ky - kr * 0.4); ctx.lineTo(sx - kr * 0.85, ky); ctx.lineTo(sx - kr * 0.45, ky + kr * 0.4)
        ctx.moveTo(sx + kr * 0.45, ky - kr * 0.4); ctx.lineTo(sx + kr * 0.85, ky); ctx.lineTo(sx + kr * 0.45, ky + kr * 0.4)
        ctx.stroke()
        const tag = (txt, x, anchor) => {
          ctx.font = `700 ${Math.max(13, 15 / view.scale)}px 'Inter Tight', sans-serif`
          const tw = ctx.measureText(txt).width, pad = 8 / view.scale, bh = 24 / view.scale, by = this.h - bh - 8 / view.scale
          const bx = anchor === 'l' ? x + 8 / view.scale : x - tw - pad * 2 - 8 / view.scale
          ctx.fillStyle = 'rgba(17,24,39,0.8)'
          ctx.beginPath(); ctx.roundRect(bx, by, tw + pad * 2, bh, 4 / view.scale); ctx.fill()
          ctx.fillStyle = txt === 'AVANT' ? '#f2c200' : '#ffffff'
          ctx.textBaseline = 'middle'
          ctx.fillText(txt, bx + pad, by + bh / 2)
        }
        tag('AVANT', 0, 'l')
        tag('APRÈS', this.w, 'r')
      }
    }
    // cadre du document
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1 / view.scale
    ctx.strokeRect(0, 0, this.w, this.h)
    // sélection en cours (marching ants — rectangle, ellipse ou lasso)
    if ((this.selPoly || this.sel) && !hideExtras) {
      const path = () => this._selPath(ctx)
      ctx.lineWidth = 1 / view.scale
      ctx.setLineDash([6 / view.scale, 4 / view.scale])
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      path(); ctx.stroke()
      ctx.lineDashOffset = 10 / view.scale
      ctx.strokeStyle = 'rgba(20,24,31,0.9)'
      path(); ctx.stroke()
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
    }
    // rectangle de recadrage
    if (cropRect) {
      const [x, y, w, h] = cropRect
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, this.w, this.h)
      ctx.clearRect(x, y, w, h)
      ctx.drawImage(src, x, y, w, h, x, y, w, h)
      ctx.strokeStyle = '#4f8fe8'
      ctx.lineWidth = 1.5 / view.scale
      ctx.setLineDash([6 / view.scale, 4 / view.scale])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }
    // photo de référence incrustée (guide de prise de vue) — coin bas-droit
    if (overlay?.img) {
      const oi = overlay.img
      const iw = oi.naturalWidth || oi.width, ih = oi.naturalHeight || oi.height
      const ow = this.w * 0.26, oh = ow * (ih / iw)
      const m = this.w * 0.015, ox = this.w - ow - m, oy = this.h - oh - m
      ctx.globalAlpha = overlay.alpha ?? 0.92
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(ox - 3 / view.scale, oy - 3 / view.scale, ow + 6 / view.scale, oh + 6 / view.scale)
      ctx.drawImage(oi, ox, oy, ow, oh)
      ctx.globalAlpha = 1
    }
    // droite de référence du redressage (tracer le plan occlusal / l'horizon)
    if (line) {
      const [x1, y1, x2, y2] = line
      ctx.strokeStyle = '#4f8fe8'
      ctx.lineWidth = 2 / view.scale
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#4f8fe8'
      for (const [cx, cy] of [[x1, y1], [x2, y2]]) {
        ctx.beginPath(); ctx.arc(cx, cy, 4 / view.scale, 0, 7); ctx.fill(); ctx.stroke()
      }
    }
    // poignées de transformation du calque actif (outil Déplacement)
    if (handles && !handles.locked) {
      const hs = 8 / view.scale
      ctx.strokeStyle = '#4f8fe8'
      ctx.lineWidth = 1.5 / view.scale
      ctx.strokeRect(handles.dx, handles.dy, this.w, this.h)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 1 / view.scale
      for (const [cx, cy] of [
        [handles.dx, handles.dy], [handles.dx + this.w, handles.dy],
        [handles.dx, handles.dy + this.h], [handles.dx + this.w, handles.dy + this.h],
      ]) {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs)
        ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs)
      }
    }
    ctx.restore()
  }

  // ---- Transformations (appliquées à chaque calque) ------------------------------

  _eachLayer(fn) {
    const w = this.w, h = this.h
    this.walk((l) => {
      const next = mkCanvas(w, h)
      fn(next.getContext('2d'), l)
      l.cv = next
      l.ctx = next.getContext('2d')
    })
  }

  rotate90() {
    const { w, h } = this
    const nw = h, nh = w
    this.walk((l) => {
      const next = mkCanvas(nw, nh)
      const ctx = next.getContext('2d')
      ctx.translate(nw / 2, nh / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(l.cv, -w / 2, -h / 2)
      l.cv = next
      l.ctx = ctx
      l.dx = 0; l.dy = 0
    })
    this.w = nw; this.h = nh
    this.sel = null
  }

  flipH() {
    this._eachLayer((ctx, l) => {
      ctx.translate(this.w, 0); ctx.scale(-1, 1)
      ctx.drawImage(l.cv, 0, 0)
    })
    this.sel = null
  }

  flipV() {
    this._eachLayer((ctx, l) => {
      ctx.translate(0, this.h); ctx.scale(1, -1)
      ctx.drawImage(l.cv, 0, 0)
    })
    this.sel = null
  }

  crop([x, y, w, h]) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y))
    w = Math.min(this.w - x, Math.round(w)); h = Math.min(this.h - y, Math.round(h))
    if (w < 2 || h < 2) return
    this._eachLayer((ctx, l) => ctx.drawImage(l.cv, x, y, w, h, 0, 0, w, h))
    this.walk((l) => { l.dx = Math.max(0, l.dx - x); l.dy = Math.max(0, l.dy - y) })
    this.w = w; this.h = h
    this.sel = null
  }

  /** Rotation arbitraire autour du centre (redressage plan occlusal, horizon…). */
  rotateAngle(deg) {
    const rad = (deg * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad))
    const { w, h } = this
    const nw = Math.round(w * cos + h * sin), nh = Math.round(w * sin + h * cos)
    this.walk((l) => {
      const next = mkCanvas(nw, nh)
      const ctx = next.getContext('2d')
      ctx.translate(nw / 2, nh / 2)
      ctx.rotate(rad)
      ctx.drawImage(l.cv, -w / 2, -h / 2)
      l.cv = next; l.ctx = ctx; l.dx = 0; l.dy = 0
    })
    this.w = nw; this.h = nh; this.sel = null
    this.markDirty()
  }

  /** Moyennes RVB + luminance du composite brut (calibrage). */
  meanRGB() { return meanRGBOf(this.composite()) }

  /** Balance des blancs « gris moyen » : les dominantes sont neutralisées. */
  autoWB() {
    const m = this.meanRGB()
    const avg = (m.r + m.g + m.b) / 3
    const cl = (v) => Math.min(2.5, Math.max(0.4, v))
    this.wb = { r: cl(avg / (m.r || 1)), g: cl(avg / (m.g || 1)), b: cl(avg / (m.b || 1)) }
    this.markDirty()
    return this.wb
  }

  /** Étalonnage sur une photo de référence : BB (dominante) + exposition assorties. */
  calibrateTo(ref) {
    const a = this.meanRGB(), b = meanRGBOf(ref)
    const cl = (v) => Math.min(2.5, Math.max(0.4, v))
    this.wb = { r: cl(b.r / (a.r || 1)), g: cl(b.g / (a.g || 1)), b: cl(b.b / (a.b || 1)) }
    this.adjust.exposure = Math.min(3, Math.max(-3, Math.log2((b.lum || 1) / (a.lum || 1))))
    this.markDirty()
  }

  // ---- Historique (libellé par action → panneau Histoire) ---------------------------

  snapshot(label = 'Édition') {
    this.undoStack.push({ label, json: JSON.stringify(this._dump()) })
    if (this.undoStack.length > 40) this.undoStack.shift()
    this.redoStack = []
  }

  _dumpLayer(l) {
    return {
      id: l.id, name: l.name, visible: l.visible, opacity: l.opacity,
      dx: l.dx, dy: l.dy, locked: l.locked,
      png: l.type === 'group' ? null : l.cv.toDataURL('image/png'),
      fill: l.fill ?? 1, blend: l.blend || 'source-over', fx: l.fx || null,
      type: l.type || 'pixel', adj: l.adj || null,
      mask: l.mask ? l.mask.toDataURL('image/png') : null,
      maskActive: l.mask ? !!l.maskActive : false,
      lockAlpha: !!l.lockAlpha, lockPx: !!l.lockPx, lockPos: !!l.lockPos,
      fxOff: !!l.fxOff, text: l.text || null,
      shape: l.shape || null, fillDef: l.fillDef || null, clip: !!l.clip,
      collapsed: !!l.collapsed,
      children: l.type === 'group' ? (l.children || []).map((c) => this._dumpLayer(c)) : null,
    }
  }

  _dump() {
    return {
      w: this.w, h: this.h, adjust: this.adjust,
      adjustVisible: this.adjustVisible, activeId: this.activeId,
      wb: this.wb, curves: this.curves,
      layers: this.layers.map((l) => this._dumpLayer(l)),
      paths: this.paths || [],
    }
  }

  async _restoreLayer(l) {
    const cv = mkCanvas(this.w, this.h)
    if (l.png) {
      const img = await loadImg(l.png)
      cv.getContext('2d').drawImage(img, 0, 0)
    }
    const out = { ...l, cv, ctx: cv.getContext('2d') }
    if (l.mask) {
      const mask = mkCanvas(this.w, this.h)
      const mi = await loadImg(l.mask)
      mask.getContext('2d').drawImage(mi, 0, 0)
      out.mask = mask
      out.maskCtx = mask.getContext('2d')
    } else { out.mask = null; out.maskCtx = null }
    if (l.type === 'group') out.children = await Promise.all((l.children || []).map((c) => this._restoreLayer(c)))
    else out.children = null
    return out
  }

  async _restore(json) {
    const d = JSON.parse(json)
    this.w = d.w; this.h = d.h
    this.adjust = d.adjust; this.adjustVisible = d.adjustVisible
    this.activeId = d.activeId
    this.wb = d.wb || null
    this.curves = d.curves || { rgb: null, r: null, g: null, b: null }
    this.paths = d.paths || []
    this._cf = null
    this.layers = await Promise.all(d.layers.map((l) => this._restoreLayer(l)))
  }

  async undo() {
    if (!this.undoStack.length) return
    this.redoStack.push({ label: 'Avant annulation', json: JSON.stringify(this._dump()) })
    await this._restore(this.undoStack.pop().json)
  }

  async redo() {
    if (!this.redoStack.length) return
    this.undoStack.push({ label: 'Avant rétablissement', json: JSON.stringify(this._dump()) })
    await this._restore(this.redoStack.pop().json)
  }

  /** Saut dans l'historique : i = index dans undoStack (états passés). */
  async historyJump(i) {
    while (this.undoStack.length > i) await this.undo()
  }

  /** Refait n états depuis le bas de la pile redo. */
  async historyJumpForward(n) {
    while (n-- > 0 && this.redoStack.length) await this.redo()
  }
}

// ---- Sélection par plage de couleurs (helpers) -----------------------------------

/** Masque binaire (Uint8Array, 1 = pixel proche de rgb à ±tol par canal). */
export function colorMask(cv, rgb, tol = 60) {
  const { width: W, height: H } = cv
  const d = cv.getContext('2d').getImageData(0, 0, W, H).data
  const out = new Uint8Array(W * H)
  const t3 = tol * 3
  for (let i = 0; i < W * H; i++) {
    const o = i * 4
    if (d[o + 3] > 16 && Math.abs(d[o] - rgb[0]) + Math.abs(d[o + 1] - rgb[1]) + Math.abs(d[o + 2] - rgb[2]) <= t3) out[i] = 1
  }
  return out
}

/** Plus grande composante 4-connexe du masque → contour tracé (Moore) simplifié. */
function largestComponentBoundary(mask, W, H) {
  const lab = new Int32Array(W * H).fill(-1)
  let best = -1, bestSize = 0, cur = 0
  const stack = []
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s] >= 0) continue
    let size = 0
    stack.push(s); lab[s] = cur
    while (stack.length) {
      const k = stack.pop()
      const x = k % W, y = (k / W) | 0
      size++
      if (x > 0 && mask[k - 1] && lab[k - 1] < 0) { lab[k - 1] = cur; stack.push(k - 1) }
      if (x < W - 1 && mask[k + 1] && lab[k + 1] < 0) { lab[k + 1] = cur; stack.push(k + 1) }
      if (y > 0 && mask[k - W] && lab[k - W] < 0) { lab[k - W] = cur; stack.push(k - W) }
      if (y < H - 1 && mask[k + W] && lab[k + W] < 0) { lab[k + W] = cur; stack.push(k + W) }
    }
    if (size > bestSize) { bestSize = size; best = cur }
    cur++
  }
  if (best < 0) return null
  // départ : premier pixel de la composante en haut à gauche
  let start = null
  for (let i = 0; i < W * H && start === null; i++) if (lab[i] === best) start = [i % W, (i / W) | 0]
  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H && lab[y * W + x] === best
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
  const poly = []
  let c = start, b = [start[0] - 1, start[1]]
  let guard = W * H * 4
  do {
    poly.push([c[0] + 0.5, c[1] + 0.5])
    const di = DIRS.findIndex(([dx, dy]) => dx === b[0] - c[0] && dy === b[1] - c[1])
    let found = false
    for (let k = 1; k <= 8; k++) {
      const j = (di + k) % 8
      const n = [c[0] + DIRS[j][0], c[1] + DIRS[j][1]]
      if (inside(n[0], n[1])) {
        const pj = (j + 7) % 8 // pixel juste avant = fond → nouveau backtrack
        b = [c[0] + DIRS[pj][0], c[1] + DIRS[pj][1]]
        c = n; found = true; break
      }
    }
    if (!found) break // pixel isolé
  } while ((c[0] !== start[0] || c[1] !== start[1]) && guard-- > 0)
  return simplifyPolyline(poly, 1.4)
}

/** Simplification Douglas-Peucker d'une polyligne fermée. */
function simplifyPolyline(pts, eps) {
  if (pts.length <= 4) return pts
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = pts[a], [bx, by] = pts[b]
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1
    let maxD = 0, mi = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len
      if (d > maxD) { maxD = d; mi = i }
    }
    if (maxD > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]) }
  }
  const out = pts.filter((_, i) => keep[i])
  return out.length > 2000 ? out.filter((_, i) => i % 2 === 0) : out
}

// ---- Filtres (menu Filtre — appliqués au calque, écrêtés à la sélection) ---------

/** Convolution 3x3 générique (noyau 9 coefficients). */
export function conv3x3(cv, k, div = 1, offset = 0) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const d = ctx.getImageData(0, 0, W, H)
  const px = d.data, src = new Uint8ClampedArray(px)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4
      for (let c = 0; c < 3; c++) {
        let v = offset
        v += src[i - W * 4 - 4 + c] * k[0] + src[i - W * 4 + c] * k[1] + src[i - W * 4 + 4 + c] * k[2]
          + src[i - 4 + c] * k[3] + src[i + c] * k[4] + src[i + 4 + c] * k[5]
          + src[i + W * 4 - 4 + c] * k[6] + src[i + W * 4 + c] * k[7] + src[i + W * 4 + 4 + c] * k[8]
        px[i + c] = v / div
      }
    }
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

/** Flou gaussien via le pipeline GPU du navigateur. */
export function gaussianBlur(cv, radius) {
  if (radius <= 0) return cv
  const t = mkCanvas(cv.width, cv.height)
  const x = t.getContext('2d')
  x.filter = `blur(${radius}px)`
  x.drawImage(cv, 0, 0)
  cv.getContext('2d').drawImage(t, 0, 0)
  return cv
}

/** Flou de mouvement : moyenne de copies décalées le long d'un angle. */
export function motionBlur(cv, angle, dist) {
  const t = mkCanvas(cv.width, cv.height)
  const x = t.getContext('2d')
  const a = (angle * Math.PI) / 180
  const n = Math.max(2, Math.round(dist / 2))
  x.globalAlpha = 1 / n
  for (let i = 0; i < n; i++) {
    const o = -dist / 2 + (dist * i) / (n - 1)
    x.drawImage(cv, Math.cos(a) * o, Math.sin(a) * o)
  }
  cv.getContext('2d').drawImage(t, 0, 0)
  return cv
}

/** Mosaïque / pixellisation. */
export function pixelate(cv, size) {
  const s = Math.max(2, Math.round(size))
  const { width: W, height: H } = cv
  const small = mkCanvas(Math.max(1, Math.round(W / s)), Math.max(1, Math.round(H / s)))
  small.getContext('2d').drawImage(cv, 0, 0, small.width, small.height)
  const x = cv.getContext('2d')
  x.imageSmoothingEnabled = false
  x.drawImage(small, 0, 0, small.width, small.height, 0, 0, W, H)
  x.imageSmoothingEnabled = true
  return cv
}

/** Médiane 3x3 — réduction du bruit (points isolés supprimés). */
export function medianFilter(cv) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const d = ctx.getImageData(0, 0, W, H)
  const px = d.data, src = new Uint8ClampedArray(px)
  const buf = new Float32Array(9)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4
      for (let c = 0; c < 3; c++) {
        let n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) buf[n++] = src[i + (dy * W + dx) * 4 + c]
        buf.sort()
        px[i + c] = buf[4]
      }
    }
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

/** Tourbillon : rotation proportionnelle à la distance au centre. */
export function twirl(cv, angleDeg) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const d = ctx.getImageData(0, 0, W, H)
  const src = ctx.getImageData(0, 0, W, H)
  const px = d.data, sp = src.data
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2
  const a = (angleDeg * Math.PI) / 180
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy
      const r = Math.hypot(dx, dy)
      const i = (y * W + x) * 4
      if (r >= R) { continue }
      const th = a * (1 - r / R)
      const cs = Math.cos(th), sn = Math.sin(th)
      const sx = Math.round(cx + dx * cs - dy * sn), sy = Math.round(cy + dx * sn + dy * cs)
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue
      const j = (sy * W + sx) * 4
      px[i] = sp[j]; px[i + 1] = sp[j + 1]; px[i + 2] = sp[j + 2]; px[i + 3] = sp[j + 3]
    }
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

/** Onde sinusoïdale horizontale. */
export function wave(cv, amp, len) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const src = ctx.getImageData(0, 0, W, H)
  const d = ctx.createImageData(W, H)
  const sp = src.data, px = d.data
  const k = (2 * Math.PI) / Math.max(4, len)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.round(x + amp * Math.sin(y * k))
      const i = (y * W + x) * 4
      if (sx < 0 || sx >= W) { px[i + 3] = 0; continue }
      const j = (y * W + sx) * 4
      px[i] = sp[j]; px[i + 1] = sp[j + 1]; px[i + 2] = sp[j + 2]; px[i + 3] = sp[j + 3]
    }
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

/** Vignettage : assombrissement radial des bords. */
export function vignette(cv, strength) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${Math.min(1, strength)})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  return cv
}

/** Égalisation d'histogramme sur la luminance (LUT globale par pixel). */
export function equalize(cv) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const d = ctx.getImageData(0, 0, W, H)
  const px = d.data
  const hist = new Float32Array(256), lum = new Uint8Array(W * H)
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const v = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
    lum[p] = v; hist[v]++
  }
  const cdf = new Float32Array(256)
  let acc = 0, cdfMin = 0
  for (let i = 0; i < 256; i++) { acc += hist[i]; cdf[i] = acc; if (!cdfMin && acc) cdfMin = acc }
  const total = W * H, span = Math.max(1, total - cdfMin)
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const t = (cdf[lum[p]] - cdfMin) / span
    const target = Math.round(t * 255)
    const ratio = lum[p] ? target / lum[p] : 0
    px[i] = Math.min(255, px[i] * ratio)
    px[i + 1] = Math.min(255, px[i + 1] * ratio)
    px[i + 2] = Math.min(255, px[i + 2] * ratio)
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

/** Ajoute du bruit gaussien monochrome (amplitude = écart-type /255). */
export function addNoise(cv, amount) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const d = ctx.getImageData(0, 0, W, H)
  const px = d.data
  const s = amount * 255
  for (let i = 0; i < px.length; i += 4) {
    // bruit gaussien (somme de deux uniformes centrées)
    const n = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * s
    px[i] += n; px[i + 1] += n; px[i + 2] += n
  }
  ctx.putImageData(d, 0, 0)
  return cv
}

/** Passe-haut (Photoshop « High Pass ») : gris 50 % + détails — base du
 *  renforcement de netteté en mode « Incrustation ». */
export function highPass(cv, radius) {
  const ctx = cv.getContext('2d')
  const { width: W, height: H } = cv
  const blur = mkCanvas(W, H)
  const bx = blur.getContext('2d')
  bx.filter = `blur(${Math.max(0.1, radius)}px)`
  bx.drawImage(cv, 0, 0)
  const a = ctx.getImageData(0, 0, W, H).data
  const b = blur.getContext('2d').getImageData(0, 0, W, H).data
  for (let i = 0; i < a.length; i += 4) {
    const l0 = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]
    const l1 = 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2]
    const v = 128 + (l0 - l1)
    a[i] = a[i + 1] = a[i + 2] = v
  }
  ctx.putImageData(new ImageData(a, W, H), 0, 0)
  return cv
}

/** Applique une fonction de filtre au calque, limitée à la sélection. */
export function applyFilterRegion(editor, l, fn) {
  const tmp = mkCanvas(editor.w, editor.h)
  tmp.getContext('2d').drawImage(l.cv, 0, 0)
  fn(tmp)
  l.ctx.save()
  editor._clipSel(l.ctx, l.dx, l.dy)
  l.ctx.drawImage(tmp, 0, 0)
  l.ctx.restore()
}

// ---- Chargement ------------------------------------------------------------------

export function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

/** Signed URL → objectURL (évite le taint canvas CORS) */
export async function fetchImg(url) {
  const blob = await fetch(url).then((r) => r.blob())
  return loadImg(URL.createObjectURL(blob))
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

// ---- Conversions couleur pour le sélecteur Photoshop --------------------------

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (mx === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return { h, s: mx ? d / mx : 0, v: mx }
}

export function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function hexToHsv(hex) { const [r, g, b] = hexToRgb(hex); return rgbToHsv(r, g, b) }
export function hsvToHex(h, s, v) { return rgbToHex(...hsvToRgb(h, s, v)) }

// sRGB → CIE Lab (D65) — distances perceptuelles pour l'analyse de teinte VITA
export function rgbToLab(r, g, b) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const R = lin(r), G = lin(g), B = lin(b)
  let x = R * 0.4124 + G * 0.3576 + B * 0.1805
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722
  let z = R * 0.0193 + G * 0.1192 + B * 0.9505
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
  const fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** ΔE (distance euclidienne Lab) entre deux couleurs [r,g,b] — < 5 ≈ imperceptible. */
export function deltaE(c1, c2) {
  const [L1, a1, b1] = rgbToLab(...c1), [L2, a2, b2] = rgbToLab(...c2)
  return Math.hypot(L1 - L2, a1 - a2, b1 - b2)
}

/** Moyennes RVB + luminance d'un canvas ou d'une image (échantillonnage ~1/8). */
export function meanRGBOf(src, step = 10) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height
  const cv = src.getContext ? src : (() => { const c = mkCanvas(w, h); c.getContext('2d').drawImage(src, 0, 0); return c })()
  const d = cv.getContext('2d').getImageData(0, 0, w, h).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4 * step) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
  r /= n; g /= n; b /= n
  return { r, g, b, lum: 0.299 * r + 0.587 * g + 0.114 * b }
}

// ---- Montage avant / après -------------------------------------------------------
//
// layouts : 'side' (côte à côte, hauteurs égalisées), 'stack' (empilé, largeurs
// égalisées), 'split' (A | B sur un seul cadre à hauteur max).
// labels : étiquettes AVANT / APRÈS collées en haut à gauche de chaque moitié.
// Retourne un canvas prêt pour editor.open().

export function buildMontage(imgA, imgB, { layout = 'side', labels = true, gap = 10, bg = '#ffffff', labelA = 'AVANT', labelB = 'APRÈS' } = {}) {
  const aw = imgA.naturalWidth || imgA.width, ah = imgA.naturalHeight || imgA.height
  const bw = imgB.naturalWidth || imgB.width, bh = imgB.naturalHeight || imgB.height
  let w, h, aRect, bRect

  if (layout === 'stack') { // empilé : largeurs égalisées
    w = Math.max(aw, bw)
    const aH = Math.round(ah * (w / aw)), bH = Math.round(bh * (w / bw))
    h = aH + gap + bH
    aRect = [0, 0, w, aH]
    bRect = [0, aH + gap, w, bH]
  } else { // side | split : hauteurs égalisées
    h = Math.max(ah, bh)
    const aW = Math.round(aw * (h / ah)), bW = Math.round(bw * (h / bh))
    w = aW + gap + bW
    aRect = [0, 0, aW, h]
    bRect = [aW + gap, 0, bW, h]
  }

  const cv = mkCanvas(w, h)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(imgA, ...aRect)
  ctx.drawImage(imgB, ...bRect)

  if (labels) {
    const tag = (txt, x, y) => {
      ctx.font = `700 ${Math.max(18, Math.round(h / 26))}px 'Inter Tight', sans-serif`
      const pad = Math.round(h / 60)
      const bh2 = Math.max(30, h / 16)
      ctx.fillStyle = 'rgba(17,24,39,0.85)'
      ctx.beginPath(); ctx.roundRect(x + 10, y + 10, ctx.measureText(txt).width + pad * 2, bh2, 6); ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.fillText(txt, x + 10 + pad, y + 10 + bh2 / 2)
    }
    tag(labelA, aRect[0], aRect[1])
    tag(labelB, bRect[0], bRect[1])
  }
  return cv
}

// ---- Planche contact -------------------------------------------------------------
//
// Grille de `cols` colonnes : chaque photo recadrée en « cover » dans une cellule
// cellW × cellW/ratio, fond `bg`, espacement `gap`. Retourne un canvas.

export function buildContactSheet(imgs, { cols = 4, cellW = 800, ratio = 4 / 3, gap = 8, bg = '#0b0e14' } = {}) {
  const cellH = Math.round(cellW / ratio)
  const rows = Math.ceil(imgs.length / cols)
  const w = cols * cellW + (cols + 1) * gap
  const h = rows * cellH + (rows + 1) * gap
  const cv = mkCanvas(w, h)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  imgs.forEach((img, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const dx = gap + col * (cellW + gap), dy = gap + row * (cellH + gap)
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height
    const s = Math.max(cellW / iw, cellH / ih) // cover
    const sw = cellW / s, sh = cellH / s
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, cellW, cellH)
  })
  return cv
}

// ---- Planche du référentiel dentaire ------------------------------------------
//
// Grille 3×3 : les 8 vues du protocole (portraits, sourire, intra-orales,
// occlusales) autour d'une cellule centrale de titre. `cells` = 8 objets
// {label, img|null} placés autour du centre ; les cases vides restent des
// emplacements annotés (le gabarit reste utilisable même incomplet).

export function buildProtocolSheet(cells, { cellW = 900, ratio = 4 / 3, gap = 16, bg = '#0b0e14', title = 'DentoPic — Cas clinique' } = {}) {
  const cellH = Math.round(cellW / ratio)
  const cols = 3, rows = 3
  const w = cols * cellW + (cols + 1) * gap
  const h = rows * cellH + (rows + 1) * gap
  const cv = mkCanvas(w, h)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // position de grille de chaque slot : 0..8, le centre (4) est le titre
  const order = [0, 1, 2, 3, 5, 6, 7, 8]
  const placements = []
  cells.forEach((cell, i) => {
    const pos = order[i]
    if (pos == null || !cell) return
    const col = pos % cols, row = Math.floor(pos / cols)
    const dx = gap + col * (cellW + gap), dy = gap + row * (cellH + gap)
    if (cell.img) {
      // la photo devient un calque séparé (planche éditable vue par vue) ;
      // le gabarit garde un cadre discret visible si le calque est masqué
      placements.push({ label: cell.label, dx, dy, w: cellW, h: cellH, cv: sheetCellCanvas(cell.img, cell.label, cellW, cellH) })
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 2
      ctx.strokeRect(dx + 1, dy + 1, cellW - 2, cellH - 2)
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.font = `500 ${Math.round(cellW / 26)}px 'Inter Tight', sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(cell.label, dx + cellW / 2, dy + cellH / 2)
      ctx.textAlign = 'left'
    } else {
      // emplacement vide : gabarit annoté
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.setLineDash([10, 8])
      ctx.lineWidth = 2
      ctx.strokeRect(dx + 4, dy + 4, cellW - 8, cellH - 8)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = `500 ${Math.round(cellW / 26)}px 'Inter Tight', sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(cell.label, dx + cellW / 2, dy + cellH / 2)
      ctx.textAlign = 'left'
    }
  })

  // cellule centrale : titre / marque
  const cx = gap + cellW + gap, cy = gap + cellH + gap
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.beginPath(); ctx.roundRect(cx, cy, cellW, cellH, 10); ctx.fill()
  ctx.fillStyle = '#4f8fe8'
  ctx.font = `700 ${Math.round(cellW / 14)}px 'Inter Tight', sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('DentoPic', cx + cellW / 2, cy + cellH / 2 - cellH / 12)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `400 ${Math.round(cellW / 30)}px 'Inter Tight', sans-serif`
  ctx.fillText(title, cx + cellW / 2, cy + cellH / 2 + cellH / 10)
  ctx.textAlign = 'left'
  return { canvas: cv, placements }
}

// Cellule photo de la planche : cover-crop + étiquette de la vue en bas à gauche.
function sheetCellCanvas(img, label, w, h) {
  const cv = mkCanvas(w, h)
  const ctx = cv.getContext('2d')
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height
  const s = Math.max(w / iw, h / ih)
  const sw = w / s, sh = h / s
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h)
  if (label) {
    ctx.font = `600 ${Math.round(w / 30)}px 'Inter Tight', sans-serif`
    const tw = ctx.measureText(label).width, pad = w / 60, bh = Math.max(28, w / 22)
    ctx.fillStyle = 'rgba(17,24,39,0.75)'
    ctx.beginPath(); ctx.roundRect(8, h - bh - 8, tw + pad * 2, bh, 6); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 8 + pad, h - bh / 2 - 8)
  }
  return cv
}
