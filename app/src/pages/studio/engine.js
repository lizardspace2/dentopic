// Moteur du Studio — édition bitmap façon Photoshop, en Canvas 2D pur.
// Un document = pile de calques ({name, canvas, visible, opacity, dx, dy})
// + un calque de réglage global (filtres) + historique annuler/rétablir.
// Aucun état React ici : la page pilote le moteur et force un re-render.

export const DEFAULT_ADJUST = {
  brightness: 100, contrast: 100, saturate: 100,
  hue: 0, blur: 0, grayscale: 0, sepia: 0, invert: 0,
}

export const filterString = (a) =>
  `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) ` +
  `hue-rotate(${a.hue}deg) blur(${a.blur}px) grayscale(${a.grayscale}%) ` +
  `sepia(${a.sepia}%) invert(${a.invert}%)`

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

    const base = this._mkLayer('Arrière-plan')
    base.ctx.drawImage(img, 0, 0)
    base.locked = true
    this.layers.push(base)
    this.addLayer('Calque 1')
    this.setActive(base.id)
  }

  _mkLayer(name) {
    const cv = mkCanvas(this.w, this.h)
    return { id: uid++, name, cv, ctx: cv.getContext('2d'), visible: true, opacity: 1, dx: 0, dy: 0 }
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
      ctx.drawImage(l.cv, l.dx, l.dy)
    }
    ctx.globalAlpha = 1
    return cv
  }

  /** Composite avec filtres appliqués (export / écran) */
  compositeFiltered() {
    const src = this.composite()
    if (!this.adjustVisible) return src
    const cv = mkCanvas(this.w, this.h)
    const ctx = cv.getContext('2d')
    ctx.filter = filterString(this.adjust)
    ctx.drawImage(src, 0, 0)
    return cv
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
   */
  render(target, view, { showOriginal = false, cropRect = null } = {}) {
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
