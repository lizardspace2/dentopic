// Moteur du Studio — édition bitmap façon Photoshop, en Canvas 2D pur.
// Un document = pile de calques ({name, canvas, visible, opacity, dx, dy})
// + un calque de réglage global (filtres) + historique annuler/rétablir.
// Aucun état React ici : la page pilote le moteur et force un re-render.

export const DEFAULT_ADJUST = {
  brightness: 100, contrast: 100, saturate: 100,
  hue: 0, blur: 0, grayscale: 0, sepia: 0, invert: 0,
  // Niveaux : in-black 0..254, gamma x100 (100=1.0), in-white 1..255
  inBlack: 0, gamma: 100, inWhite: 255,
  // Exposition en EV (-3..+3) et balance des blancs (temp/teinte -100..+100)
  exposure: 0, temp: 0, tint: 0,
  // Netteté (unsharp 0..100)
  sharp: 0,
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

// Histogramme de luminance (256 cases) du composite, pour le panneau Courbes
export function histogram(cv, step = 8) {
  const ctx = cv.getContext('2d')
  const { width, height } = cv
  const sx = Math.max(1, Math.round(width / 400)) // échantillonnage si grand doc
  const d = ctx.getImageData(0, 0, width, height, { willReadFrequently: true })
  const h = new Float32Array(256)
  const px = d.data
  for (let i = 0; i < px.length; i += 4 * sx) {
    h[Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])]++
  }
  const max = Math.max(...h)
  return { h, max }
}

// ---- Niveaux / exposition / balance des blancs : LUTs par canal -----------------
const IDENTITY = (() => { const l = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) l[i] = i; return l })()

const composeLUT = (l1, l2) => { // applique l1 puis l2
  const o = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) o[i] = l2[l1[i]]
  return o
}

/** LUT « niveaux » : remap in-black/in-white puis courbe gamma. */
export function levelsLUT(inBlack, inWhite, gamma100) {
  const lut = new Uint8ClampedArray(256)
  const g = Math.max(10, gamma100) / 100
  const span = Math.max(1, inWhite - inBlack)
  for (let i = 0; i < 256; i++) {
    let v = Math.min(1, Math.max(0, (i - inBlack) / span))
    lut[i] = Math.pow(v, 1 / g) * 255
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

let uid = 1

export class Editor {
  layers = []
  activeId = null
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
    return { id: uid++, name, cv, ctx: cv.getContext('2d'), visible: true, opacity: 1, dx: 0, dy: 0, blend: 'source-over' }
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
    this.layers.push(l)
    this.activeId = l.id
    return l
  }

  get active() {
    return this.layers.find((l) => l.id === this.activeId) || null
  }

  setActive(id) { this.activeId = id }
  toggleVisible(id) { const l = this.layers.find((x) => x.id === id); if (l) l.visible = !l.visible }
  removeLayer(id) {
    const l = this.layers.find((x) => x.id === id)
    if (!l || l.locked) return
    this.layers = this.layers.filter((x) => x.id !== id)
    if (this.activeId === id) this.activeId = this.layers[this.layers.length - 1]?.id
  }
  moveLayer(id, dir) { // dir = +1 (monter) / -1 (descendre)
    const i = this.layers.findIndex((x) => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= this.layers.length || this.layers[i].locked) return
    ;[this.layers[i], this.layers[j]] = [this.layers[j], this.layers[i]]
  }
  duplicateLayer(id) {
    const l = this.layers.find((x) => x.id === id)
    if (!l) return
    const copy = this._mkLayer(`${l.name} copie`)
    copy.ctx.drawImage(l.cv, 0, 0)
    copy.dx = l.dx; copy.dy = l.dy; copy.opacity = l.opacity
    this.layers.splice(this.layers.indexOf(l) + 1, 0, copy)
    this.activeId = copy.id
  }

  flatten() {
    const base = this.layers[0]
    const flat = this._mkLayer('Arrière-plan')
    flat.locked = true
    for (const l of this.layers) if (l.visible) {
      flat.ctx.globalAlpha = l.opacity
      flat.ctx.drawImage(l.cv, l.dx, l.dy)
    }
    flat.ctx.globalAlpha = 1
    this.layers = [flat]
    this.activeId = flat.id
  }

  // ---- Sélection rectangulaire ---------------------------------------------------

  selectAll() { this.sel = [0, 0, this.w, this.h] }
  deselect() { this.sel = null }

  /** Clip la zone de dessin à la sélection (ou tout le doc si aucune). */
  _clipSel(ctx) {
    ctx.beginPath()
    if (this.sel) ctx.rect(this.sel[0], this.sel[1], this.sel[2], this.sel[3])
    else ctx.rect(0, 0, this.w, this.h)
    ctx.clip()
  }

  /** Remplit la sélection (ou le calque entier) avec `color` sur le calque actif. */
  fill(color) {
    const l = this.active
    if (!l || l.locked) return false
    l.ctx.save()
    this._clipSel(l.ctx)
    l.ctx.fillStyle = color
    l.ctx.fillRect(0, 0, this.w, this.h)
    l.ctx.restore()
    return true
  }

  /** Efface le contenu du calque actif dans la sélection (ou tout le calque). */
  deleteContent() {
    const l = this.active
    if (!l || l.locked) return false
    l.ctx.save()
    this._clipSel(l.ctx)
    l.ctx.clearRect(0, 0, this.w, this.h)
    l.ctx.restore()
    return true
  }

  // ---- Composite --------------------------------------------------------------

  /** Composite pleine résolution (tous calques visibles, sans filtres) */
  composite() {
    const cv = mkCanvas(this.w, this.h)
    const ctx = cv.getContext('2d')
    for (const l of this.layers) {
      if (!l.visible) continue
      ctx.globalAlpha = l.opacity
      ctx.globalCompositeOperation = l.blend || 'source-over'
      if (l.fx?.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = Math.round(this.w / 80)
        ctx.shadowOffsetX = Math.round(this.w / 150)
        ctx.shadowOffsetY = Math.round(this.w / 120)
      }
      ctx.drawImage(l.cv, l.dx, l.dy)
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = 0
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return cv
  }

  /** Composite avec filtres + niveaux + exposition + BB + courbes + netteté (caché). */
  compositeFiltered() {
    if (this._cf) return this._cf
    const src = this.composite()
    const a = this.adjust, cv0 = this.curves
    const hasCurves = cv0.rgb || cv0.r || cv0.g || cv0.b
    const hasLevels = a.inBlack > 0 || a.inWhite < 255 || a.gamma !== 100
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
      if (hasLevels) rgb = levelsLUT(a.inBlack, a.inWhite, a.gamma)
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
    this.sel = [minX, minY, maxX - minX + 1, maxY - minY + 1]
    return this.sel
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
  render(target, view, { showOriginal = false, cropRect = null, handles = null, compare = null } = {}) {
    const ctx = target.getContext('2d')
    ctx.clearRect(0, 0, target.width, target.height)
    if (!this.w) return

    const src = showOriginal ? this.original() : this.compositeFiltered()
    ctx.save()
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy)
    ctx.imageSmoothingEnabled = view.scale < 1
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
    // sélection en cours (marching ants)
    if (this.sel) {
      ctx.lineWidth = 1 / view.scale
      ctx.setLineDash([6 / view.scale, 4 / view.scale])
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.strokeRect(this.sel[0], this.sel[1], this.sel[2], this.sel[3])
      ctx.lineDashOffset = 10 / view.scale
      ctx.strokeStyle = 'rgba(20,24,31,0.9)'
      ctx.strokeRect(this.sel[0], this.sel[1], this.sel[2], this.sel[3])
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
    for (const l of this.layers) {
      const next = mkCanvas(w, h)
      fn(next.getContext('2d'), l)
      l.cv = next
      l.ctx = next.getContext('2d')
    }
  }

  rotate90() {
    const { w, h } = this
    const nw = h, nh = w
    for (const l of this.layers) {
      const next = mkCanvas(nw, nh)
      const ctx = next.getContext('2d')
      ctx.translate(nw / 2, nh / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(l.cv, -w / 2, -h / 2)
      l.cv = next
      l.ctx = ctx
      l.dx = 0; l.dy = 0
    }
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
    for (const l of this.layers) { l.dx = Math.max(0, l.dx - x); l.dy = Math.max(0, l.dy - y) }
    this.w = w; this.h = h
    this.sel = null
  }

  // ---- Historique ----------------------------------------------------------------

  snapshot() {
    this.undoStack.push(JSON.stringify(this._dump()))
    if (this.undoStack.length > 40) this.undoStack.shift()
    this.redoStack = []
  }

  _dump() {
    return {
      w: this.w, h: this.h, adjust: this.adjust,
      adjustVisible: this.adjustVisible, activeId: this.activeId,
      wb: this.wb, curves: this.curves,
      layers: this.layers.map((l) => ({
        id: l.id, name: l.name, visible: l.visible, opacity: l.opacity,
        dx: l.dx, dy: l.dy, locked: l.locked, png: l.cv.toDataURL('image/png'),
      })),
    }
  }

  async _restore(json) {
    const d = JSON.parse(json)
    this.w = d.w; this.h = d.h
    this.adjust = d.adjust; this.adjustVisible = d.adjustVisible
    this.activeId = d.activeId
    this.wb = d.wb || null
    this.curves = d.curves || { rgb: null, r: null, g: null, b: null }
    this._cf = null
    this.layers = await Promise.all(d.layers.map(async (l) => {
      const cv = mkCanvas(this.w, this.h)
      const img = await loadImg(l.png)
      cv.getContext('2d').drawImage(img, 0, 0)
      return { ...l, cv, ctx: cv.getContext('2d') }
    }))
  }

  async undo() {
    if (!this.undoStack.length) return
    this.redoStack.push(JSON.stringify(this._dump()))
    await this._restore(this.undoStack.pop())
  }

  async redo() {
    if (!this.redoStack.length) return
    this.undoStack.push(JSON.stringify(this._dump()))
    await this._restore(this.redoStack.pop())
  }
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
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
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
