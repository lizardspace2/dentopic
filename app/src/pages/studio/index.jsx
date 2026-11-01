// Route /studio — éditeur bitmap façon Photoshop (inspiré de photocraft / openphoto).
// Barre de menus + barre d'outils + canevas + panneaux Calques/Réglages/Infos.
// Le moteur canvas (calques, filtres, historique) vit dans ./engine.js —
// ce fichier ne fait que relier événements, menus et rendu.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Flex, HStack, Input, Text } from '@chakra-ui/react'
import { useSearchParams } from 'react-router-dom'
import { C, S, getMode } from '../../theme'
import { useApp } from '../../context/AppContext'
import {
  createMontage, getPhoto, listDossiers, listProtocolSteps, saveEditedPhoto,
  updatePatientPhoto,
} from '../../api'
import { photoUrl } from '../../media'
import {
  Editor, buildMontage, buildProtocolSheet, fetchImg, loadImg, rgbToHex,
  DEFAULT_ADJUST, applyFilterRegion, conv3x3, equalize, gaussianBlur, medianFilter,
  motionBlur, pixelate, twirl, unsharp, vignette, wave, applyLUTs, curveLUT,
} from './engine'
import { FILTER_DEFS } from './constants'
import {
  MenuBar, ToolBar, OptionsBar, RightPanel, StatusBar, EmptyCanvas,
} from './panels'
import { OpenPhotoModal, ExportModal, MontageModal, SheetModal, LayerStyleModal, ColorPickerModal, FilterModal, SelectMaskModal } from './modals'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const cssVar = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb

const RULER_W = 22 // largeur des règles (px écran)

export default function Studio() {
  const { workspace } = useApp()
  const wsId = workspace?.id

  const editor = useMemo(() => {
    const e = new Editor()
    e.resetAdjust = () => { e.adjust = { ...DEFAULT_ADJUST } }
    return e
  }, [])
  // référence pour le debug/tests (dans un effet = la vraie instance StrictMode)
  useEffect(() => { window.__editor = editor }, [editor])

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const fileInput = useRef(null)
  const stroke = useRef(null) // état du drag en cours
  const cloneSrc = useRef(null) // source du tampon de duplication [x, y] (Alt+clic)
  const [gradLine, setGradLine] = useState(null) // aperçu du dégradé pendant le drag
  const lastSample = useRef(0) // throttle pipette (panneau Infos)

  const [tool, setTool] = useState('move')
  const [opts, setOpts] = useState({
    fg: '#dc2626', bg: '#ffffff', brushSize: 12, brushOpacity: 1, brushHard: 0.9, eraserSize: 30, eraserHard: 0.85, eraserOpacity: 1,
    textSize: 32, textFont: 'Inter Tight', textBold: true, textItalic: false, textTracking: 0,
    textAlign: 'left', textSmooth: 'lisse',
    tol: 32, transform: false, autoSelect: false, autoScope: 'layer', cloneSize: 48, cloneOpacity: 1,
    // photocraft : nouveaux outils
    pencilSize: 3, pencilOpacity: 1, selShape: 'rect', selFeather: 0,
    selAA: true, selStyle: 'normal', selRatioW: 1, selRatioH: 1, selFixW: 200, selFixH: 200,
    toneMode: 'dodge', toneSize: 48, toneStrength: 0.3,
    healSize: 40, healRadius: 8, blurSize: 48, blurRadius: 6,
    sharpenSize: 48, sharpenAmount: 60, smudgeSize: 36, smudgeStrength: 0.85,
    redeyeSize: 24, shapeKind: 'rect', shapeStrokeOn: false, shapeStroke: 4,
  })
  const [view, setView] = useState({ scale: 1, ox: 40, oy: 40 })
  useEffect(() => { window.__view = view }, [view]) // exposé pour les tests
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [version, setVersion] = useState(0) // bump → re-render canvas + panneaux
  const [docOpen, setDocOpen] = useState(false)
  const [srcPhoto, setSrcPhoto] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [modal, setModal] = useState(null) // 'open' | 'export' | ...
  const [pickColor, setPickColor] = useState(null) // 'fg' | 'bg' | null — sélecteur détaillé
  const [fxKey, setFxKey] = useState(null) // effet présélectionné dans Style de calque
  const [cropRect, setCropRect] = useState(null)
  const [textInput, setTextInput] = useState(null) // {sx, sy, ix, iy, t, edit?: calque texte à rééditer}
  const [cursor, setCursor] = useState(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [compare, setCompare] = useState(null) // fraction 0..1 du séparateur avant/après
  const [wbPick, setWbPick] = useState(false)  // pipette balance des blancs armée
  // -- Dentaire ----------------------------------------------------------------------
  const [straighten, setStraighten] = useState(null) // {angle, ruler, line}
  const [steps, setSteps] = useState([])             // protocole (référence)
  const [refStep, setRefStep] = useState(null)       // étape choisie
  const [refImg, setRefImg] = useState(null)         // photo de référence (img)
  const [refOverlay, setRefOverlay] = useState(false)// incrustation sur le canevas
  const [shade, setShade] = useState(null)           // teinte VITA de la photo
  // -- Affichage : règles, grille, guides, magnétisme -------------------------------
  const [rulers, setRulers] = useState(false)
  const [gridOn, setGridOn] = useState(false)
  const [guidesOn, setGuidesOn] = useState(true)
  const [guides, setGuides] = useState({ v: [], h: [] }) // positions en coords doc
  const [snapOn, setSnapOn] = useState(false)
  const [filterKey, setFilterKey] = useState(null)   // clé FILTER_DEFS ouverte
  const [shapePrev, setShapePrev] = useState(null)    // aperçu de forme en cours
  const [ft, setFt] = useState(null)                  // transformation manuelle (Ctrl+T)
  const plassoRef = useRef(null)                      // sommets du lasso polygonal
  const [penPath, setPenPath] = useState(null)        // tracé plume en cours {pts, hover}
  const [pathEdit, setPathEdit] = useState(null)      // calque de forme édité (sélection de tracé)
  const filterBase = useRef(null)                     // dump avant ouverture du filtre (aperçu live)
  const ovlRef = useRef(null)
  const ruleTopRef = useRef(null)
  const ruleLeftRef = useRef(null)

  const bump = useCallback(() => { editor.markDirty(); setVersion((v) => v + 1) }, [editor])
  const toImg = useCallback(
    (sx, sy) => [(sx - view.ox) / view.scale, (sy - view.oy) / view.scale],
    [view]
  )
  // position souris en coords conteneur — fiable même pendant setPointerCapture
  // (offsetX devient viewport-relatif quand le pointeur est capturé)
  const evPt = (e) => {
    const r = containerRef.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  // ---- Transformation manuelle (Ctrl+T) ---------------------------------------------
  // Matrice doc→doc : p' = C + R(angle)·S(sx,sy)·(p − C0)
  const ftMatrix = (f) => {
    const co = Math.cos(f.angle), si = Math.sin(f.angle)
    const a = f.sx * co, b = f.sx * si, c = -f.sy * si, d = f.sy * co
    return [a, b, c, d, f.cx - (a * f.cx0 + c * f.cy0), f.cy - (b * f.cx0 + d * f.cy0)]
  }
  // coins (cs) + milieux d'arêtes (ms) du cadre transformé, en coords doc
  const ftPts = (f) => {
    const [a, b, c, d, e2, f2] = ftMatrix(f)
    const x0 = f.l.dx + f.bx, y0 = f.l.dy + f.by, x1 = x0 + f.w, y1 = y0 + f.h
    const cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([px, py]) => [a * px + c * py + e2, b * px + d * py + f2])
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    return { cs, ms: [mid(cs[0], cs[1]), mid(cs[1], cs[2]), mid(cs[2], cs[3]), mid(cs[3], cs[0])] }
  }
  const startFt = () => {
    if (ft) return
    const l = editor.active
    if (!l || l.locked || !l.visible || !l.cv || l.type === 'adjust') return
    const bb = editor.contentBBox(l)
    if (!bb) return
    const src = document.createElement('canvas')
    src.width = editor.w; src.height = editor.h
    src.getContext('2d').drawImage(l.cv, 0, 0)
    l.visible = false // le calque est prévisualisé par l'overlay pendant la transformation
    editor.markDirty()
    setFt({
      l, src, bx: bb.x, by: bb.y, w: bb.w, h: bb.h,
      cx0: l.dx + bb.x + bb.w / 2, cy0: l.dy + bb.y + bb.h / 2,
      cx: l.dx + bb.x + bb.w / 2, cy: l.dy + bb.y + bb.h / 2,
      sx: 1, sy: 1, angle: 0, link: true, interp: 'bicubic',
    })
    bump()
  }
  const applyFt = () => {
    const f = ft; if (!f) return
    f.l.visible = true // restaurer AVANT le snapshot : l'annulation doit rendre un calque visible
    // identité → pas d'entrée d'historique (comme Photoshop)
    const identity = f.sx === 1 && f.sy === 1 && f.angle === 0 && f.cx === f.cx0 && f.cy === f.cy0
    if (!identity) {
      editor.snapshot('Free Transform')
      editor.applyTransform(f.l, ftMatrix(f), f.interp)
    } else editor.markDirty()
    setFt(null); bump()
  }
  const cancelFt = () => {
    if (!ft) return
    ft.l.visible = true
    editor.markDirty()
    setFt(null); bump()
  }

  // ---- Ouvrir / importer ---------------------------------------------------------

  const openPhoto = async (p) => {
    const url = await photoUrl(p.storage_path)
    if (!url) return
    const img = await fetchImg(url)
    editor.open(img, p.original_filename || 'photo')
    editor.isMontage = false
    setSrcPhoto(p)
    setShade(p.tooth_shade || null)
    setDocOpen(true)
    setModal(null)
    setCompare(null); setWbPick(false)
    fitView()
    bump()
  }

  const openFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const img = await loadImg(URL.createObjectURL(f))
    editor.open(img, f.name)
    editor.isMontage = false
    setSrcPhoto(null)
    setDocOpen(true)
    setModal(null)
    setCompare(null); setWbPick(false)
    fitView()
    bump()
    e.target.value = ''
  }

  const fitView = () => {
    const c = containerRef.current
    if (!c || !editor.w) return
    const s = Math.min((c.clientWidth - 60) / editor.w, (c.clientHeight - 60) / editor.h)
    const scale = clamp(s, 0.05, 4)
    setView({ scale, ox: (c.clientWidth - editor.w * scale) / 2, oy: (c.clientHeight - editor.h * scale) / 2 })
  }

  const zoomAt = (factor, sx, sy) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, 0.05, 8)
      const k = scale / v.scale
      const cx = sx ?? containerRef.current.clientWidth / 2
      const cy = sy ?? containerRef.current.clientHeight / 2
      return { scale, ox: cx - (cx - v.ox) * k, oy: cy - (cy - v.oy) * k }
    })
  }

  const setZoom = (z) => {
    const c = containerRef.current
    if (!c || !editor.w) return
    setView({ scale: z, ox: (c.clientWidth - editor.w * z) / 2, oy: (c.clientHeight - editor.h * z) / 2 })
  }

  // ---- Règles / grille / guides / magnétisme ----------------------------------------

  // pas de la grille : plus petite graduation "ronde" lisible à l'écran
  const gridStep = () => {
    const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
    return steps.find((s) => s * view.scale >= 40) || 5000
  }

  // magnétisme : accroche un point doc aux guides / bords / grille (rayon 8 px écran)
  const snapPair = (x, y) => {
    if (!snapOn) return [x, y]
    const th = 8 / view.scale
    const xs = [0, editor.w, ...(guidesOn ? guides.v : [])]
    const ys = [0, editor.h, ...(guidesOn ? guides.h : [])]
    if (gridOn) {
      const st = gridStep()
      for (let g = st; g < editor.w; g += st) xs.push(g)
      for (let g = st; g < editor.h; g += st) ys.push(g)
    }
    let bx = x, by = y, dx = th, dy = th
    for (const g of xs) { const d = Math.abs(x - g); if (d < dx) { dx = d; bx = g } }
    for (const g of ys) { const d = Math.abs(y - g); if (d < dy) { dy = d; by = g } }
    return [bx, by]
  }

  // drag depuis une règle -> nouveau guide (supprimé si relâché hors du document)
  const ruleDown = (axis) => (e) => {
    if (!guidesOn) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const [cx, cy] = evPt(e)
    const doc = ((axis === 'v' ? cx : cy) - (axis === 'v' ? view.ox : view.oy)) / view.scale
    const ref = { idx: -1 }
    setGuides((g) => { const a = [...g[axis]]; a.push(doc); ref.idx = a.length - 1; return { ...g, [axis]: a } })
    stroke.current = { kind: 'guideNew', axis, ref }
  }
  const ruleMove = (axis) => (e) => {
    const s = stroke.current
    if (!s || s.kind !== 'guideNew' || s.axis !== axis) return
    const [cx, cy] = evPt(e)
    const doc = ((axis === 'v' ? cx : cy) - (axis === 'v' ? view.ox : view.oy)) / view.scale
    setGuides((g) => { const a = [...g[axis]]; a[s.ref.idx] = doc; return { ...g, [axis]: a } })
  }
  const ruleUp = (axis) => (e) => {
    const s = stroke.current
    if (!s || s.kind !== 'guideNew' || s.axis !== axis) return
    const [cx, cy] = evPt(e)
    const doc = ((axis === 'v' ? cx : cy) - (axis === 'v' ? view.ox : view.oy)) / view.scale
    const lim = axis === 'v' ? editor.w : editor.h
    setGuides((g) => {
      const a = [...g[axis]]
      if (doc < -5 || doc > lim + 5) a.splice(s.ref.idx, 1)
      else a[s.ref.idx] = clamp(doc, 0, lim)
      return { ...g, [axis]: a }
    })
    stroke.current = null
  }

  // Lasso polygonal : double-clic ou Entrée ferme la sélection
  const commitPlasso = () => {
    const p = plassoRef.current
    if (!p) return
    plassoRef.current = null
    if (p.pts.length >= 3) editor.lassoSelect(p.pts)
    else editor.deselect()
    bump()
  }
  const cancelPlasso = () => {
    if (!plassoRef.current) return
    plassoRef.current = null
    editor.deselect()
    bump()
  }

  // ---- Plume : Entrée termine le tracé (ouvert), clic sur le 1ᵉʳ point le ferme ----
  const commitPen = (closed) => {
    const p = penPath
    setPenPath(null)
    if (!p || p.pts.length < 2) { bump(); return }
    editor.snapshot('Forme')
    editor.addPathShape(p.pts, closed, {
      fill: closed ? opts.fg : null,
      stroke: (opts.shapeStrokeOn || !closed) ? opts.bg : null,
      strokeW: opts.shapeStroke,
    })
    bump()
  }
  // changer d'outil abandonne le tracé plume / l'édition de tracé
  useEffect(() => { setPenPath(null); setPathEdit(null) }, [tool])

  // ---- Rendu ----------------------------------------------------------------------

  const render = useCallback(() => {
    const cv = canvasRef.current
    if (cv) editor.render(cv, view, {
      showOriginal, cropRect, compare,
      handles: tool === 'move' && opts.transform ? editor.active : null,
      previewRotate: straighten?.angle || 0,
      line: straighten?.line || gradLine || null,
      overlay: refOverlay && refImg ? { img: refImg } : null,
    })
  }, [editor, view, showOriginal, cropRect, compare, tool, opts.transform, version,
    straighten, refOverlay, refImg, gradLine])

  useEffect(render, [render, version])

  // Overlay (canvas au-dessus) : grille + guides
  useEffect(() => {
    const cv = ovlRef.current, c = containerRef.current
    if (!cv || !c) return
    cv.width = c.clientWidth; cv.height = c.clientHeight
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    if (!docOpen || !editor.w) return
    const { scale, ox, oy } = view
    const docL = ox, docT = oy, docR = ox + editor.w * scale, docB = oy + editor.h * scale
    if (gridOn) {
      const st = gridStep()
      ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1; ctx.beginPath()
      for (let x = Math.ceil(-ox / scale / st) * st; x <= editor.w; x += st) {
        const sx = Math.round(x * scale + ox) + .5
        ctx.moveTo(sx, Math.max(0, docT)); ctx.lineTo(sx, Math.min(cv.height, docB))
      }
      for (let y = Math.ceil(-oy / scale / st) * st; y <= editor.h; y += st) {
        const sy = Math.round(y * scale + oy) + .5
        ctx.moveTo(Math.max(0, docL), sy); ctx.lineTo(Math.min(cv.width, docR), sy)
      }
      ctx.stroke()
    }
    if (guidesOn) {
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1
      for (const g of guides.v) {
        const sx = Math.round(g * scale + ox) + .5
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, cv.height); ctx.stroke()
      }
      for (const g of guides.h) {
        const sy = Math.round(g * scale + oy) + .5
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(cv.width, sy); ctx.stroke()
      }
    }
    // aperçu de la forme en cours de tracé (outil Forme)
    if (shapePrev) {
      const [x1, y1, x2, y2] = shapePrev
      const toS = (x, y) => [x * scale + ox, y * scale + oy]
      const [sx1, sy1] = toS(x1, y1), [sx2, sy2] = toS(x2, y2)
      ctx.strokeStyle = '#4f8fe8'; ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4]); ctx.beginPath()
      const w = sx2 - sx1, h = sy2 - sy1
      if (opts.shapeKind === 'rect') ctx.rect(sx1, sy1, w, h)
      else if (opts.shapeKind === 'ellipse') ctx.ellipse(sx1 + w / 2, sy1 + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
      else if (opts.shapeKind === 'triangle') { ctx.moveTo(sx1 + w / 2, sy1); ctx.lineTo(sx2, sy2); ctx.lineTo(sx1, sy2); ctx.closePath() }
      else { ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2) }
      ctx.stroke(); ctx.setLineDash([])
    }
    // ---- Transformation manuelle : calque prévisualisé transformé + cadre ----
    if (ft) {
      const [a, b, c, d, e2, f2] = ftMatrix(ft)
      ctx.save()
      ctx.translate(ox, oy); ctx.scale(scale, scale)
      ctx.transform(a, b, c, d, e2, f2)
      ctx.imageSmoothingEnabled = ft.interp !== 'nearest'
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(ft.src, ft.l.dx, ft.l.dy)
      ctx.restore()
      const { cs, ms } = ftPts(ft)
      const toS = (p) => [p[0] * scale + ox, p[1] * scale + oy]
      ctx.strokeStyle = '#4f8fe8'; ctx.lineWidth = 1.5; ctx.beginPath()
      cs.forEach((p, i) => { const [x, y] = toS(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) })
      ctx.closePath(); ctx.stroke()
      // 8 poignées carrées + repère de centre
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
      for (const p of [...cs, ...ms]) {
        const [x, y] = toS(p)
        ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeRect(x - 4, y - 4, 8, 8)
      }
      ctx.fillStyle = '#4f8fe8'; ctx.beginPath()
      const [ccx, ccy] = toS([ft.cx, ft.cy])
      ctx.arc(ccx, ccy, 3.5, 0, Math.PI * 2); ctx.fill()
    }
    // ---- Plume : aperçu du tracé en cours + élastique vers le curseur ----
    const tracePath = (pts, hover) => {
      const toS = (x, y) => [x * scale + ox, y * scale + oy]
      ctx.beginPath()
      pts.forEach((p, i) => {
        if (!i) { ctx.moveTo(...toS(p.x, p.y)); return }
        const p0 = pts[i - 1]
        if (p0.c2 || p.c1) {
          const c2 = p0.c2 || [p0.x, p0.y], c1 = p.c1 || [p.x, p.y]
          ctx.bezierCurveTo(...toS(c2[0], c2[1]), ...toS(c1[0], c1[1]), ...toS(p.x, p.y))
        } else ctx.lineTo(...toS(p.x, p.y))
      })
      if (hover && pts.length) { const q = pts[pts.length - 1]; ctx.lineTo(...toS(hover[0], hover[1])) }
      ctx.stroke()
    }
    if (penPath) {
      ctx.strokeStyle = '#4f8fe8'; ctx.lineWidth = 1.5
      tracePath(penPath.pts, penPath.hover)
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
      penPath.pts.forEach((p, i) => {
        const [x, y] = [p.x * scale + ox, p.y * scale + oy]
        ctx.fillRect(x - 3.5, y - 3.5, 7, 7); ctx.strokeRect(x - 3.5, y - 3.5, 7, 7)
        if (i === 0) { ctx.strokeStyle = '#4f8fe8'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#1a1a1a' }
      })
    }
    // ---- Sélection de tracé : ancres + poignées Bézier de la forme éditée ----
    if (pathEdit?.l?.shape) {
      const s = pathEdit.l.shape, dx = pathEdit.l.dx, dy = pathEdit.l.dy
      const toS = (x, y) => [(x + dx) * scale + ox, (y + dy) * scale + oy]
      if (s.kind === 'path') {
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1
        tracePath(s.pts.map((p) => ({ x: p.x + dx, y: p.y + dy, c1: p.c1 ? [p.c1[0] + dx, p.c1[1] + dy] : null, c2: p.c2 ? [p.c2[0] + dx, p.c2[1] + dy] : null })), null)
        ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(120,160,220,.9)'
        ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#1a1a1a'
        s.pts.forEach((p) => {
          for (const w of ['c1', 'c2']) {
            if (!p[w]) continue
            const [ax, ay] = toS(p.x, p.y), [hx, hy] = toS(p[w][0], p[w][1])
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke()
            ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          }
        })
        ctx.setLineDash([])
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'
        s.pts.forEach((p) => {
          const [x, y] = toS(p.x, p.y)
          ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeRect(x - 4, y - 4, 8, 8)
        })
      } else {
        const [x0, y0] = toS(s.x, s.y), [x1, y1] = toS(s.x + s.w, s.y + s.h)
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([])
      }
    }
  }, [view, gridOn, guidesOn, guides, stageSize, docOpen, version, editor, shapePrev, opts.shapeKind, ft, penPath, pathEdit])

  // Règles : graduations en px document + repère de curseur
  useEffect(() => {
    if (!rulers) return
    const c = containerRef.current, t = ruleTopRef.current, l = ruleLeftRef.current
    if (!c || !t || !l) return
    t.width = c.clientWidth - RULER_W; t.height = RULER_W
    l.width = RULER_W; l.height = c.clientHeight - RULER_W
    const { scale, ox, oy } = view
    const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
    const st = steps.find((s) => s * scale >= 55) || 5000
    const draw = (ctx, horiz) => {
      ctx.fillStyle = cssVar('--s-input', '#1c2433'); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.strokeStyle = cssVar('--s-a300', 'rgba(255,255,255,.28)'); ctx.fillStyle = cssVar('--s-a400', 'rgba(255,255,255,.62)')
      ctx.font = '9px monospace'; ctx.lineWidth = 1; ctx.beginPath()
      const off = horiz ? ox : oy
      const lim = horiz ? t.width : l.height
      const dim = horiz ? (editor.w || 0) : (editor.h || 0)
      for (let p = Math.ceil(-off / scale / st) * st; ; p += st) {
        const s = p * scale + off - (horiz ? 0 : 0)
        if (s > lim) break
        if (s < 0) continue
        if (horiz) { ctx.moveTo(s + .5, RULER_W); ctx.lineTo(s + .5, RULER_W - 8); ctx.fillText(String(p), s + 3, 9) }
        else {
          ctx.moveTo(RULER_W, s + .5); ctx.lineTo(RULER_W - 8, s + .5)
          ctx.save(); ctx.translate(9, s - 2); ctx.rotate(-Math.PI / 2); ctx.fillText(String(p), -ctx.measureText(String(p)).width, 3); ctx.restore()
        }
        if (p >= dim + st * 4) break
      }
      ctx.stroke()
      if (cursor) {
        ctx.strokeStyle = '#22d3ee'; ctx.beginPath()
        const s = (horiz ? cursor.x * scale + ox : cursor.y * scale + oy)
        if (s >= 0 && s <= lim) { horiz ? (ctx.moveTo(s + .5, 0), ctx.lineTo(s + .5, RULER_W)) : (ctx.moveTo(0, s + .5), ctx.lineTo(RULER_W, s + .5)) }
        ctx.stroke()
      }
    }
    draw(t.getContext('2d'), true)
    draw(l.getContext('2d'), false)
  }, [rulers, view, cursor, stageSize, docOpen, version, editor, getMode()])

  // Taille du canevas = taille du conteneur
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const c = containerRef.current, cv = canvasRef.current
      if (!c || !cv) return
      cv.width = c.clientWidth
      cv.height = c.clientHeight
      setStageSize({ w: c.clientWidth, h: c.clientHeight })
      render()
    })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [render])

  useEffect(() => { if (wsId) listDossiers(wsId, { limit: 100 }).then(setDossiers) }, [wsId])
  useEffect(() => { listProtocolSteps().then(setSteps) }, [])

  // Photo de référence : étape du protocole -> charge son image de référence
  const pickRefStep = async (id) => {
    setRefStep(id)
    const st = steps.find((s) => s.id === id)
    if (st?.reference_path) {
      const url = await photoUrl(st.reference_path)
      if (url) { setRefImg(await fetchImg(url)); setRefOverlay(true) }
    }
  }
  const pickRefPhoto = async (p) => {
    const url = await photoUrl(p.storage_path)
    if (url) { setRefImg(await fetchImg(url)); setRefOverlay(true) }
    setModal(null)
  }

  // Teinte VITA — enregistrée sur la fiche photo (patient_photos.tooth_shade)
  const onShade = async (code) => {
    if (!srcPhoto) return
    const next = shade === code ? null : code
    setShade(next)
    await updatePatientPhoto(srcPhoto.id, { tooth_shade: next })
  }

  // Étalonner sur une photo de référence (BB + exposition assorties)
  const calibrateToRef = async (p) => {
    const url = await photoUrl(p.storage_path)
    if (!url) return
    const img = await fetchImg(url)
    editor.snapshot()
    editor.calibrateTo(img)
    setModal(null)
    bump()
  }

  // Planche du référentiel : compose les 8 vues sur une image éditable
  const composeSheet = async (slots) => {
    const cells = await Promise.all(slots.map(async (s) => ({
      label: s.label,
      img: s.photo ? await fetchImg(await photoUrl(s.photo.storage_path)) : null,
    })))
    const { canvas, placements } = buildProtocolSheet(cells, { title: editor.docName.replace(/\.\w+$/, '') })
    editor.open(canvas, 'planche-referentiel.png')
    // chaque vue devient un calque nommé — déplaçable, masquable, supprimable
    const empty = editor.layers.find((l) => !l.locked && l.name === 'Calque 1')
    if (empty) editor.removeLayer(empty.id)
    for (const p of placements) {
      const l = editor.addLayer(p.label)
      l.ctx.drawImage(p.cv, p.dx, p.dy)
    }
    editor.setActive(editor.layers[editor.layers.length - 1].id)
    editor.isMontage = true
    setSrcPhoto(null)
    setShade(null)
    setDocOpen(true)
    setModal(null)
    fitView()
    bump()
  }

  // /studio?edit=<photoId> — ouverture directe depuis un dossier patient
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const pid = searchParams.get('edit')
    if (pid && !docOpen) getPhoto(pid).then((p) => p && openPhoto(p))
  }, [searchParams])

  // ---- Montage avant / après ---------------------------------------------------------

  const openMontage = async (pA, pB, { layout, labels }) => {
    const [urlA, urlB] = await Promise.all([photoUrl(pA.storage_path), photoUrl(pB.storage_path)])
    if (!urlA || !urlB) return
    const [imgA, imgB] = await Promise.all([fetchImg(urlA), fetchImg(urlB)])
    const cv = buildMontage(imgA, imgB, { layout, labels })
    editor.open(cv, 'montage-avant-apres.png')
    editor.isMontage = true
    setSrcPhoto(null)
    setDocOpen(true)
    setModal(null)
    setCompare(null); setWbPick(false)
    fitView()
    bump()
  }

  // ---- Outils : pointer events ------------------------------------------------------

  const onPointerDown = (e) => {
    if (!docOpen) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const [ix, iy] = toImg(e.nativeEvent.offsetX, e.nativeEvent.offsetY)

    // pipette balance des blancs : le clic suivant pose les gains
    if (wbPick) {
      editor.snapshot()
      editor.whiteBalanceAt(ix, iy)
      setWbPick(false)
      bump()
      return
    }
    // comparaison : tout drag déplace le séparateur
    if (compare != null) {
      stroke.current = { kind: 'divider' }
      setCompare(clamp(ix / editor.w, 0.02, 0.98))
      return
    }
    // redressage : tracer la droite qui doit devenir horizontale
    if (straighten?.ruler) {
      stroke.current = { kind: 'ruler', x0: ix, y0: iy }
      setStraighten((s) => ({ ...s, line: [ix, iy, ix, iy] }))
      return
    }

    // ---- Transformation manuelle active : les poignées pilotent l'interaction ----
    if (ft) {
      const { cs, ms } = ftPts(ft)
      const R = 12 / view.scale
      // point dans un polygone (ray casting)
      const inBox = ((x, y, poly) => {
        let inside = false
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j]
          if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
        }
        return inside
      })(ix, iy, cs)
      // distance point→segment (zone de rotation hors du cadre)
      const dSeg = (x, y, p, q) => {
        const vx = q[0] - p[0], vy = q[1] - p[1], L2 = vx * vx + vy * vy || 1
        const t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (y - p[1]) * vy) / L2))
        return Math.hypot(x - (p[0] + t * vx), y - (p[1] + t * vy))
      }
      const handle = [...cs.map((p, i) => ({ p, kind: 'ftScale', i })), ...ms.map((p, i) => ({ p, kind: 'ftEdge', i }))]
        .find((h) => Math.hypot(ix - h.p[0], iy - h.p[1]) < R)
      if (handle) {
        // point fixe : coin/milieu opposé, à la fois position transformée ET locale d'origine
        const co = Math.cos(-ft.angle), si = Math.sin(-ft.angle)
        const loc = { x0: ft.l.dx + ft.bx, y0: ft.l.dy + ft.by, x1: ft.l.dx + ft.bx + ft.w, y1: ft.l.dy + ft.by + ft.h }
        const locals = [[loc.x0, loc.y0], [loc.x1, loc.y0], [loc.x1, loc.y1], [loc.x0, loc.y1]]
        const midL = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
        const alOrig = handle.kind === 'ftScale'
          ? locals[(handle.i + 2) % 4]
          : midL(locals[(handle.i + 2) % 4], locals[(handle.i + 3) % 4])
        const anchor = handle.kind === 'ftScale' ? cs[(handle.i + 2) % 4] : ms[(handle.i + 2) % 4]
        const hPt = handle.p
        const rel = [(hPt[0] - anchor[0]) * co - (hPt[1] - anchor[1]) * si,
                     (hPt[0] - anchor[0]) * si + (hPt[1] - anchor[1]) * co]
        stroke.current = {
          kind: handle.kind, axis: handle.kind === 'ftEdge' ? (handle.i % 2 === 0 ? 'y' : 'x') : null,
          anchor, alOrig, rel, sx0: ft.sx, sy0: ft.sy,
        }
      } else if (inBox) {
        stroke.current = { kind: 'ftMove', ox: ix, oy: iy, cx0: ft.cx, cy0: ft.cy }
      } else if (cs.some((p, i) => dSeg(ix, iy, p, cs[(i + 1) % 4]) < 30 / view.scale)) {
        stroke.current = { kind: 'ftRotate', a0: ft.angle, grab: Math.atan2(iy - ft.cy, ix - ft.cx) }
      }
      return // en mode transformation, aucun autre outil ne répond
    }

    switch (tool) {
      case 'move': {
        // Sélection auto (Photoshop) : cliquer prend le calque sous le curseur
        if (opts.autoSelect) {
          const hit = editor.layerAtPoint(ix, iy)
          if (hit && hit.id !== editor.activeId) { editor.setActive(hit.id); bump() }
        }
        const l = editor.active
        if (!l) break
        // poignées de transformation : coin proche -> redimensionnement
        if (opts.transform && !l.locked && !l.lockPos) {
          const corner = [[l.dx, l.dy], [l.dx + editor.w, l.dy], [l.dx, l.dy + editor.h], [l.dx + editor.w, l.dy + editor.h]]
            .findIndex(([cx, cy]) => Math.hypot(ix - cx, iy - cy) < 14 / view.scale)
          if (corner >= 0) {
            editor.snapshot()
            // ancre = coin opposé ; hx/hy = poignée saisie (coords doc)
            const hx = [l.dx, l.dx + editor.w, l.dx, l.dx + editor.w][corner]
            const hy = [l.dy, l.dy, l.dy + editor.h, l.dy + editor.h][corner]
            stroke.current = { kind: 'scale', l, hx, hy, ax: l.dx + editor.w - hx + l.dx, ay: l.dy + editor.h - hy + l.dy, src: l.cv }
            break
          }
        }
        // saisir un guide (comme Photoshop avec l'outil Déplacement) —
        // capture du pointeur : le pointerup sur la règle doit aussi le recevoir
        if (guidesOn) {
          const gv = guides.v.findIndex((g) => Math.abs(ix - g) < 6 / view.scale)
          const gh = guides.h.findIndex((g) => Math.abs(iy - g) < 6 / view.scale)
          if (gv >= 0 || gh >= 0) {
            e.currentTarget.setPointerCapture?.(e.pointerId)
            stroke.current = gv >= 0 ? { kind: 'guide', axis: 'v', idx: gv } : { kind: 'guide', axis: 'h', idx: gh }
            break
          }
        }
        if (l.lockPos) break // verrou « position » : le déplacement est bloqué
        editor.snapshot()
        stroke.current = { kind: 'move', ox: ix, oy: iy, dx: l.dx, dy: l.dy }
        break
      }
      case 'wand':
        editor.snapshot('Baguette')
        editor.selEllipse = false; editor.selInverted = false
        editor.wandSelect(ix, iy, opts.tol)
        bump()
        break
      case 'lasso':
        stroke.current = { kind: 'lasso', pts: [[ix, iy]] }
        editor.selEllipse = false; editor.selInverted = false
        editor.lassoSelect([[ix, iy], [ix, iy], [ix, iy]])
        bump()
        break
      case 'plasso': {
        // lasso polygonal : chaque clic ajoute un sommet, double-clic / Entrée ferme
        if (!plassoRef.current) {
          plassoRef.current = { pts: [[ix, iy]], hover: [ix, iy] }
          editor.selEllipse = false; editor.selInverted = false
        } else {
          const p = plassoRef.current
          const last = p.pts[p.pts.length - 1]
          if (Math.hypot(ix - last[0], iy - last[1]) > 2 / view.scale) p.pts.push([ix, iy])
        }
        editor.lassoSelect([...plassoRef.current.pts, plassoRef.current.hover || plassoRef.current.pts[0]])
        bump()
        break
      }
      case 'bucket':
        editor.snapshot()
        editor.bucketFill(ix, iy, opts.fg, opts.tol)
        bump()
        break
      case 'clone': {
        // Alt+clic = point de source ; sinon premier clic fixe la source
        if (e.altKey || !cloneSrc.current) {
          cloneSrc.current = [ix, iy]
          break
        }
        const l = editor.active?.locked ? editor.addLayer() : editor.active || editor.addLayer()
        editor.snapshot()
        // copie figée du COMPOSITE (tous les calques) — Photoshop échantillonne
        // l'image visible, pas le calque cible (souvent vide)
        const snap = editor.composite()
        stroke.current = { kind: 'stroke', l, last: [ix, iy], srcSnap: snap, so: cloneSrc.current, st: [ix, iy] }
        paint(ix, iy, l)
        break
      }
      case 'gradient': {
        const [sx, sy] = snapPair(ix, iy)
        stroke.current = { kind: 'gradient', x0: sx, y0: sy }
        setGradLine([sx, sy, sx, sy])
        break
      }
      case 'hand':
        stroke.current = { kind: 'pan', sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY, ox: view.ox, oy: view.oy }
        break
      case 'brush':
      case 'pencil':
      case 'tone': {
        const l = editor.active?.locked ? editor.addLayer() : editor.active || editor.addLayer()
        editor.snapshot({ brush: 'Pinceau', pencil: 'Crayon', tone: 'Éclaircir/Assombrir' }[tool])
        stroke.current = { kind: 'stroke', l, last: [ix, iy] }
        paint(ix, iy, l)
        break
      }
      case 'heal':
      case 'blurTool':
      case 'sharpenTool': {
        // tampon filtré : copie floutée/accentuée du calque, peinte par touches
        const l = editor.active?.locked ? editor.addLayer() : editor.active || editor.addLayer()
        editor.snapshot({ heal: 'Correcteur', blurTool: 'Flou', sharpenTool: 'Accentuation' }[tool])
        const s = { kind: 'stroke', l, last: [ix, iy] }
        if (tool === 'blurTool') { s.stamp = editor._mkLayer().cv; s.stamp.getContext('2d').drawImage(l.cv, 0, 0); gaussianBlur(s.stamp, opts.blurRadius) }
        if (tool === 'sharpenTool') { s.stamp = editor._mkLayer().cv; s.stamp.getContext('2d').drawImage(l.cv, 0, 0); unsharp(s.stamp, Math.min(1, opts.sharpenAmount / 100) * 0.8) }
        if (tool === 'heal') { s.stamp = editor._mkLayer().cv; s.stamp.getContext('2d').drawImage(l.cv, 0, 0); gaussianBlur(s.stamp, opts.healRadius) }
        stroke.current = s
        paint(ix, iy, l)
        break
      }
      case 'smudge': {
        const l = editor.active || editor.addLayer()
        editor.snapshot('Doigt')
        if (l.locked) l.locked = false
        stroke.current = { kind: 'stroke', l, last: [ix, iy] }
        break
      }
      case 'redeye': {
        const l = editor.active || editor.addLayer()
        editor.snapshot('Yeux rouges')
        if (l.locked) l.locked = false
        stroke.current = { kind: 'stroke', l, last: [ix, iy] }
        paint(ix, iy, l)
        break
      }
      case 'shape': {
        stroke.current = { kind: 'shapeDrag', x0: ix, y0: iy }
        break
      }
      case 'pen': {
        // clic = ancre · glisser = poignées Bézier symétriques · clic sur le 1er point = fermer
        if (!penPath) {
          setPenPath({ pts: [{ x: ix, y: iy, c1: null, c2: null }], closed: false, hover: [ix, iy] })
          stroke.current = { kind: 'penAnchor', i: 0 }
        } else {
          const first = penPath.pts[0]
          if (penPath.pts.length > 2 && Math.hypot(ix - first.x, iy - first.y) < 10 / view.scale) {
            commitPen(true)
          } else {
            setPenPath((p) => ({ ...p, pts: [...p.pts, { x: ix, y: iy, c1: null, c2: null }] }))
            stroke.current = { kind: 'penAnchor', i: penPath.pts.length }
          }
        }
        break
      }
      case 'pathsel': {
        // sélection directe : déplace le tracé ou édite ancres/poignées du calque de forme
        let l = editor.active?.type === 'shape' ? editor.active : null
        if (!l) { const h = editor.layerAtPoint(ix, iy); if (h?.type === 'shape') l = h }
        if (!l) { setPathEdit(null); break }
        if (l.id !== editor.activeId) { editor.setActive(l.id); bump() }
        setPathEdit({ l })
        const s = l.shape, R = 10 / view.scale
        if (s.kind === 'path') {
          for (let i = 0; i < s.pts.length && !stroke.current; i++) {
            const p = s.pts[i]
            for (const w of ['c1', 'c2']) {
              if (p[w] && Math.hypot(ix - (p[w][0] + l.dx), iy - (p[w][1] + l.dy)) < R) {
                stroke.current = { kind: 'pathPt', l, i, w, px: ix, py: iy }; break
              }
            }
            if (!stroke.current && Math.hypot(ix - (p.x + l.dx), iy - (p.y + l.dy)) < R) {
              stroke.current = { kind: 'pathPt', l, i, w: null, px: ix, py: iy }
            }
          }
        }
        if (!stroke.current) {
          const inside = ix >= s.x + l.dx && ix <= s.x + s.w + l.dx && iy >= s.y + l.dy && iy <= s.y + s.h + l.dy
          if (inside) stroke.current = { kind: 'pathAll', l, ox: ix, oy: iy, x0: s.x, y0: s.y }
        }
        if (stroke.current) editor.snapshot('Déplacer tracé')
        break
      }
      case 'eraser': {
        // gommer un calque verrouillé = le « convertir en calque » (Photoshop) :
        // sinon on créait un calque vide et on n'effaçait rien
        const l = editor.active || editor.addLayer()
        editor.snapshot()
        if (l.locked) l.locked = false
        stroke.current = { kind: 'stroke', l, last: [ix, iy] }
        paint(ix, iy, l)
        break
      }
      case 'picker': {
        const comp = editor.composite()
        const px = comp.getContext('2d').getImageData(clamp(ix | 0, 0, comp.width - 1), clamp(iy | 0, 0, comp.height - 1), 1, 1).data
        setOpts((o) => ({ ...o, fg: rgbToHex(px[0], px[1], px[2]) }))
        break
      }
      case 'crop': {
        const [sx, sy] = snapPair(ix, iy)
        setCropRect([sx, sy, 0, 0])
        stroke.current = { kind: 'crop', x0: sx, y0: sy }
        break
      }
      case 'rect': {
        editor.selPoly = null
        editor.selEllipse = opts.selShape === 'ellipse'
        editor.selInverted = false
        const [sx, sy] = snapPair(ix, iy)
        if (opts.selStyle === 'fixed') {
          // « Taille fixe » : un clic crée directement le cadre dimensionné (Photoshop)
          editor.sel = [sx, sy, opts.selFixW || 200, opts.selFixH || 200]
          stroke.current = { kind: 'selMove', x0: sx, y0: sy }
          bump()
          break
        }
        editor.sel = [sx, sy, 0, 0]
        stroke.current = { kind: 'sel', x0: sx, y0: sy }
        break
      }
      case 'zoom':
        zoomAt(e.altKey ? 0.7 : 1.4, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        break
      case 'rotate':
        editor.snapshot(); editor.rotate90(); bump()
        break
      case 'text': {
        // clic sur un calque de texte existant → ré-édition du contenu (comme Photoshop)
        const hitT = textLayerAt(ix, iy)
        if (hitT) {
          const t = hitT.text
          editor.setActive(hitT.id)
          setTextInput({ sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY, ix, iy, t: Date.now(), edit: hitT, value: t?.value || '' })
          bump()
          break
        }
        setTextInput({ sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY, ix, iy, t: Date.now() })
        break
      }
    }
  }

  const paint = (ix, iy, l) => {
    const s = stroke.current
    if (!s) return
    // verrou « pixels » (rangée Lock façon Photoshop) : rien ne peint ce calque
    if (l.lockPx && tool !== 'redeye') return
    // Édition du masque de fusion : le pinceau écrit l'alpha du masque
    // (blanc révèle, noir masque, gris = partiel) — mode 'copy' = valeur exacte.
    if (l.mask && l.maskActive && (tool === 'brush' || tool === 'pencil' || tool === 'eraser')) {
      const mc = l.maskCtx
      const [r, g, b] = [parseInt(opts.fg.slice(1, 3), 16), parseInt(opts.fg.slice(3, 5), 16), parseInt(opts.fg.slice(5, 7), 16)]
      const lum = tool === 'eraser' ? 1 : (0.299 * r + 0.587 * g + 0.114 * b) / 255
      mc.save()
      mc.lineCap = 'round'; mc.lineJoin = 'round'
      mc.globalCompositeOperation = 'copy'
      mc.strokeStyle = `rgba(255,255,255,${lum * (opts.brushOpacity ?? 1)})`
      mc.lineWidth = tool === 'pencil' ? opts.pencilSize : opts.brushSize
      const soft = (1 - (opts.brushHard ?? 1)) * mc.lineWidth * 0.6
      if (soft > 0.5) { mc.shadowColor = mc.strokeStyle; mc.shadowBlur = soft }
      mc.beginPath()
      mc.moveTo(s.last[0] - l.dx, s.last[1] - l.dy)
      mc.lineTo(ix - l.dx, iy - l.dy)
      mc.stroke()
      mc.restore()
      s.last = [ix, iy]
      bump()
      return
    }
    const ctx = l.ctx
    ctx.save()
    // clip à la sélection (rectangle, ellipse ou lasso — inversable)
    if (editor.selInverted && (editor.sel || editor.selPoly)) {
      ctx.beginPath(); ctx.rect(0, 0, editor.w, editor.h)
      editor._selPath(ctx, l.dx, l.dy, true)
      ctx.clip('evenodd')
    } else {
      editor._selPath(ctx, l.dx, l.dy)
      ctx.clip()
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // verrou « pixels transparents » : on ne peint que sur l'existant (Photoshop)
    if (l.lockAlpha && tool !== 'eraser') ctx.globalCompositeOperation = 'source-atop'
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = opts.eraserOpacity ?? 1
      ctx.lineWidth = opts.eraserSize
      const esoft = (1 - (opts.eraserHard ?? 1)) * opts.eraserSize * 0.6
      if (esoft > 0.5) { ctx.shadowColor = '#000000'; ctx.shadowBlur = esoft }
      ctx.beginPath()
      ctx.moveTo(s.last[0] - l.dx, s.last[1] - l.dy)
      ctx.lineTo(ix - l.dx, iy - l.dy)
      ctx.stroke()
    } else if (tool === 'clone' && s.srcSnap) {
      // tampon : la source suit le geste avec le décalage source→départ
      const r = opts.cloneSize / 2
      const cx = ix - l.dx, cy = iy - l.dy
      const dvx = (s.so[0] - s.st[0]), dvy = (s.so[1] - s.st[1])
      const sx = cx + dvx, sy = cy + dvy
      ctx.globalAlpha = opts.cloneOpacity ?? 1
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(s.srcSnap, sx - r, sy - r, opts.cloneSize, opts.cloneSize, cx - r, cy - r, opts.cloneSize, opts.cloneSize)
    } else if (tool === 'tone') {
      // éclaircir / assombrir / (dés)saturer — modes de fusion Photoshop
      const cfg = {
        dodge: ['screen', 'rgba(255,255,255,1)'],
        burn: ['multiply', 'rgba(80,80,80,1)'],
        desat: ['saturation', 'rgb(128,128,128)'],
        sat: ['saturation', 'rgb(255,0,0)'],
      }[opts.toneMode] || ['screen', 'rgba(255,255,255,1)']
      ctx.globalCompositeOperation = cfg[0]
      ctx.strokeStyle = cfg[1]
      ctx.globalAlpha = opts.toneStrength ?? 0.3
      ctx.lineWidth = opts.toneSize
      ctx.beginPath()
      ctx.moveTo(s.last[0] - l.dx, s.last[1] - l.dy)
      ctx.lineTo(ix - l.dx, iy - l.dy)
      ctx.stroke()
    } else if ((tool === 'blurTool' || tool === 'sharpenTool' || tool === 'heal') && s.stamp) {
      // tampon filtré : la copie floutée/accentuée est peinte par touches rondes
      const r = (tool === 'blurTool' ? opts.blurSize : tool === 'sharpenTool' ? opts.sharpenSize : opts.healSize) / 2
      const cx = ix - l.dx, cy = iy - l.dy
      ctx.globalAlpha = tool === 'heal' ? 0.75 : 1
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(s.stamp, 0, 0)
    } else if (tool === 'smudge') {
      // doigt : la matière sous le curseur est déplacée avec le geste
      const r = opts.smudgeSize / 2
      const px = s.last[0] - l.dx, py = s.last[1] - l.dy
      const dx = ix - s.last[0], dy = iy - s.last[1]
      ctx.globalAlpha = opts.smudgeStrength ?? 0.85
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(l.cv, dx, dy)
    } else if (tool === 'redeye') {
      // neutralise les pixels à dominante rouge dans le disque du pinceau
      const r = opts.redeyeSize / 2
      const cx = Math.round(ix - l.dx), cy = Math.round(iy - l.dy)
      const bx = Math.max(0, cx - r), by = Math.max(0, cy - r)
      const bw = Math.min(editor.w - bx, r * 2), bh = Math.min(editor.h - by, r * 2)
      if (bw > 0 && bh > 0) {
        const d = ctx.getImageData(bx, by, bw, bh)
        const px = d.data
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const ox = bx + x - cx, oy = by + y - cy
            if (ox * ox + oy * oy > r * r) continue
            const i = (y * bw + x) * 4
            if (px[i] > px[i + 1] * 1.25 && px[i] > px[i + 2] * 1.25 && px[i] > 60) {
              const m = Math.max(px[i + 1], px[i + 2])
              px[i] = m * 1.1
            }
          }
        }
        ctx.putImageData(d, bx, by)
      }
    } else if (tool === 'pencil') {
      ctx.strokeStyle = opts.fg
      ctx.globalAlpha = opts.pencilOpacity ?? 1
      ctx.lineWidth = opts.pencilSize
      ctx.beginPath()
      ctx.moveTo(s.last[0] - l.dx, s.last[1] - l.dy)
      ctx.lineTo(ix - l.dx, iy - l.dy)
      ctx.stroke()
    } else {
      ctx.strokeStyle = opts.fg
      ctx.globalAlpha = opts.brushOpacity
      ctx.lineWidth = opts.brushSize
      // dureté : bord adouci par un flou d'ombre proportionnel au diamètre
      const soft = (1 - (opts.brushHard ?? 1)) * opts.brushSize * 0.6
      if (soft > 0.5) { ctx.shadowColor = opts.fg; ctx.shadowBlur = soft }
      ctx.beginPath()
      ctx.moveTo(s.last[0] - l.dx, s.last[1] - l.dy)
      ctx.lineTo(ix - l.dx, iy - l.dy)
      ctx.stroke()
    }
    ctx.restore()
    s.last = [ix, iy]
    bump()
  }

  const onPointerMove = (e) => {
    if (!docOpen) return
    const [ix, iy] = toImg(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    // pipette live pour le panneau Infos
    if (Date.now() - lastSample.current > 90) {
      lastSample.current = Date.now()
      const comp = editor.composite()
      if (ix >= 0 && iy >= 0 && ix < comp.width && iy < comp.height) {
        const px = comp.getContext('2d').getImageData(ix | 0, iy | 0, 1, 1).data
        setCursor({ x: ix | 0, y: iy | 0, color: rgbToHex(px[0], px[1], px[2]) })
      }
    }
    // lasso polygonal : le point flottant suit le curseur entre les sommets
    if (plassoRef.current && tool === 'plasso') {
      plassoRef.current.hover = [ix, iy]
      editor.lassoSelect([...plassoRef.current.pts, plassoRef.current.hover])
      bump()
    }
    // plume : élastique vers le curseur entre deux ancres
    if (penPath && tool === 'pen' && stroke.current?.kind !== 'penAnchor') {
      setPenPath((p) => p && ({ ...p, hover: [ix, iy] }))
    }
    const s = stroke.current
    if (!s) return
    // plume : le drag tire les deux poignées Bézier de la nouvelle ancre
    if (s.kind === 'penAnchor') {
      setPenPath((p) => p && ({
        ...p,
        pts: p.pts.map((q, j) => j === s.i
          ? { ...q, c2: [q.x + (ix - q.x), q.y + (iy - q.y)], c1: [q.x - (ix - q.x), q.y - (iy - q.y)] }
          : q),
      }))
      return
    }
    // sélection de tracé : déplacer une ancre (avec ses poignées) ou une poignée seule
    if (s.kind === 'pathPt') {
      const p = s.l.shape.pts[s.i], dx = ix - s.px, dy = iy - s.py
      s.px = ix; s.py = iy
      if (s.w) p[s.w] = [p[s.w][0] + dx, p[s.w][1] + dy]
      else {
        p.x += dx; p.y += dy
        if (p.c1) p.c1 = [p.c1[0] + dx, p.c1[1] + dy]
        if (p.c2) p.c2 = [p.c2[0] + dx, p.c2[1] + dy]
      }
      editor._pathBounds(s.l.shape)
      editor.drawShapeLayer(s.l)
      bump()
      return
    }
    // sélection de tracé : déplacer tout le tracé (ou la géométrie de la forme)
    if (s.kind === 'pathAll') {
      const sh = s.l.shape
      if (sh.kind === 'path') {
        const dx = ix - s.ox, dy = iy - s.oy
        sh.pts.forEach((p) => {
          p.x += dx; p.y += dy
          if (p.c1) p.c1 = [p.c1[0] + dx, p.c1[1] + dy]
          if (p.c2) p.c2 = [p.c2[0] + dx, p.c2[1] + dy]
        })
        editor._pathBounds(sh); s.ox = ix; s.oy = iy
      } else { sh.x = s.x0 + (ix - s.ox); sh.y = s.y0 + (iy - s.oy) }
      editor.drawShapeLayer(s.l)
      bump()
      return
    }
    // ---- Transformation manuelle : mise à jour de l'état ft pendant le drag ----
    if (s.kind === 'ftMove') {
      setFt((f) => f && ({ ...f, cx: s.cx0 + ix - s.ox, cy: s.cy0 + iy - s.oy }))
      return
    }
    if (s.kind === 'ftRotate') {
      setFt((f) => {
        if (!f) return f
        let a = s.a0 + Math.atan2(iy - f.cy, ix - f.cx) - s.grab
        if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12) // pas de 15°
        return { ...f, angle: a }
      })
      return
    }
    if (s.kind === 'ftScale' || s.kind === 'ftEdge') {
      setFt((f) => {
        if (!f) return f
        const co = Math.cos(-f.angle), si = Math.sin(-f.angle)
        const v = [(ix - s.anchor[0]) * co - (iy - s.anchor[1]) * si,
                   (ix - s.anchor[0]) * si + (iy - s.anchor[1]) * co]
        let nsx = s.sx0, nsy = s.sy0
        if (s.kind === 'ftScale' && (f.link || e.shiftKey)) {
          const k = Math.hypot(v[0], v[1]) / (Math.hypot(s.rel[0], s.rel[1]) || 1e-6)
          nsx = s.sx0 * k; nsy = s.sy0 * k
        } else {
          if (s.kind !== 'ftEdge' || s.axis === 'x') nsx = Math.abs(s.rel[0]) > 0.5 ? s.sx0 * v[0] / s.rel[0] : s.sx0
          if (s.kind !== 'ftEdge' || s.axis === 'y') nsy = Math.abs(s.rel[1]) > 0.5 ? s.sy0 * v[1] / s.rel[1] : s.sy0
        }
        const clampS = (x) => clamp(Math.abs(x) > 0.01 ? x : 0.01 * Math.sign(x || 1), -64, 64)
        nsx = clampS(nsx); nsy = clampS(nsy)
        // conserve le point fixe : C = anchor − R·S·(AL_orig − C0)
        const co2 = Math.cos(f.angle), si2 = Math.sin(f.angle)
        const ux = s.alOrig[0] - f.cx0, uy = s.alOrig[1] - f.cy0
        const ncx = s.anchor[0] - (nsx * co2 * ux - nsy * si2 * uy)
        const ncy = s.anchor[1] - (nsx * si2 * ux + nsy * co2 * uy)
        return { ...f, sx: nsx, sy: nsy, cx: ncx, cy: ncy }
      })
      return
    }
    if (s.kind === 'stroke') paint(ix, iy, s.l)
    else if (s.kind === 'shapeDrag') setShapePrev([s.x0, s.y0, ix, iy])
    else if (s.kind === 'lasso') {
      s.pts.push([ix, iy])
      editor.lassoSelect(s.pts)
      bump()
    }
    else if (s.kind === 'gradient') { const [sx, sy] = snapPair(ix, iy); setGradLine([s.x0, s.y0, sx, sy]) }
    else if (s.kind === 'divider') setCompare(clamp(ix / editor.w, 0.02, 0.98))
    else if (s.kind === 'ruler') setStraighten((st) => ({ ...st, line: [s.x0, s.y0, ix, iy] }))
    else if (s.kind === 'guide') {
      const [gx, gy] = toImg(...evPt(e))
      const lim = s.axis === 'v' ? editor.w : editor.h
      const pos = s.axis === 'v' ? gx : gy
      setGuides((g) => { const a = [...g[s.axis]]; a[s.idx] = clamp(pos, 0, lim); return { ...g, [s.axis]: a } })
    }
    else if (s.kind === 'move') {
      const [sx, sy] = snapPair(ix, iy)
      editor.active.dx = s.dx + (sx - s.ox)
      editor.active.dy = s.dy + (sy - s.oy)
      bump()
    } else if (s.kind === 'pan') {
      setView((v) => ({ ...v, ox: s.ox + e.nativeEvent.offsetX - s.sx, oy: s.oy + e.nativeEvent.offsetY - s.sy }))
    } else if (s.kind === 'scale') {
      const sx = clamp((ix - s.ax) / (s.hx - s.ax || 1), -8, 8)
      const sy = clamp((iy - s.ay) / (s.hy - s.ay || 1), -8, 8)
      // redessine la source d'origine mise à l'échelle autour du coin opposé
      const ctx = s.l.ctx
      ctx.clearRect(0, 0, editor.w, editor.h)
      ctx.save()
      ctx.translate(s.ax, s.ay)
      ctx.scale(sx, sy)
      ctx.drawImage(s.src, -s.ax, -s.ay)
      ctx.restore()
      bump()
    } else if (s.kind === 'crop') {
      const [sx, sy] = snapPair(ix, iy)
      setCropRect([Math.min(s.x0, sx), Math.min(s.y0, sy), Math.abs(sx - s.x0), Math.abs(sy - s.y0)])
    } else if (s.kind === 'sel') {
      const [sx, sy] = snapPair(ix, iy)
      let w = Math.abs(sx - s.x0), h = Math.abs(sy - s.y0)
      // « Proportions fixe » : h déduit de w (comme Photoshop)
      if (opts.selStyle === 'ratio' && (opts.selRatioH || 1) > 0) {
        h = w * (opts.selRatioH || 1) / Math.max(1, opts.selRatioW || 1)
      }
      editor.sel = [Math.min(s.x0, sx), Math.min(s.y0, sy), w, h]
      bump()
    } else if (s.kind === 'selMove') {
      // repositionne le cadre à taille fixe en glissant
      const [sx, sy] = snapPair(ix, iy)
      if (editor.sel) { editor.sel = [sx, sy, editor.sel[2], editor.sel[3]]; bump() }
    }
  }

  const onPointerUp = (e) => {
    const s = stroke.current
    // guide relâché sur la règle ou hors du document -> supprimé (Photoshop)
    if (s?.kind === 'guide') {
      const [mx, my] = evPt(e)
      const [ix, iy] = toImg(mx, my)
      const pos = s.axis === 'v' ? ix : iy
      const lim = s.axis === 'v' ? editor.w : editor.h
      const onRuler = (s.axis === 'v' && my < RULER_W) || (s.axis === 'h' && mx < RULER_W)
      if (onRuler || pos < -5 || pos > lim + 5) {
        setGuides((g) => ({ ...g, [s.axis]: g[s.axis].filter((_, i) => i !== s.idx) }))
      }
    }
    if (s?.kind === 'sel' && editor.sel && (editor.sel[2] < 3 || editor.sel[3] < 3)) editor.sel = null
    if (s?.kind === 'lasso') {
      if (!s.pts || s.pts.length < 3) editor.deselect()
      bump()
    }
    if (s?.kind === 'gradient') {
      setGradLine(null)
      if (gradLine && Math.hypot(gradLine[2] - gradLine[0], gradLine[3] - gradLine[1]) > 4) {
        editor.snapshot()
        editor.gradientFill(gradLine[0], gradLine[1], gradLine[2], gradLine[3], opts.fg, opts.bg)
      }
      bump()
    }
    if (s?.kind === 'shapeDrag' && shapePrev) {
      // crée un CALQUE DE FORME vectoriel (rééditable dans Propriétés) — comme Photoshop
      const [x1, y1, x2, y2] = shapePrev
      if (Math.hypot(x2 - x1, y2 - y1) > 3) {
        editor.snapshot('Forme')
        const isLine = opts.shapeKind === 'line'
        editor.addShapeLayer(opts.shapeKind, {
          x: isLine ? x1 : Math.min(x1, x2), y: isLine ? y1 : Math.min(y1, y2),
          w: isLine ? x2 - x1 : Math.abs(x2 - x1), h: isLine ? y2 - y1 : Math.abs(y2 - y1),
        }, {
          fill: isLine ? null : opts.fg,
          stroke: (opts.shapeStrokeOn || isLine) ? (isLine ? opts.fg : opts.bg) : null,
          strokeW: opts.shapeStroke,
        })
        bump()
      }
      setShapePrev(null)
    }
    if (s?.kind === 'ruler' && straighten?.line) {
      const [x1, y1, x2, y2] = straighten.line
      const dx = x2 - x1, dy = y2 - y1
      const deg = Math.hypot(dx, dy) > editor.w * 0.05 ? -Math.atan2(dy, dx) * 180 / Math.PI : 0
      setStraighten((st) => ({ ...st, angle: clamp(deg, -45, 45), ruler: false, line: null }))
    }
    stroke.current = null
    bump()
  }

  // ---- Texte ------------------------------------------------------------------------

  // calque de texte sous le point : pixel exact, sinon boîte du calque actif
  // (tolérance ~14 px écran — comme la zone de clic des poignées)
  const textLayerAt = (ix, iy) => {
    const hit = editor.layerAtPoint(ix, iy)
    if (hit?.type === 'text') return hit
    const l = editor.active
    if (l?.type === 'text' && l.text?.box) {
      const b = l.text.box, M = 14 / view.scale
      if (ix >= l.dx - M && ix <= l.dx + b.w + M && iy >= l.dy - M && iy <= l.dy + b.h + M) return l
    }
    return null
  }

  const commitText = (value) => {
    if (!textInput) return
    const edit = textInput.edit
    setTextInput(null)
    if (edit) { // ré-édition : met à jour le contenu du calque existant
      if (value !== (edit.text?.value || '')) {
        editor.snapshot('Texte')
        editor.updateText(edit, { value })
      }
      bump()
      return
    }
    if (!value.trim()) return
    editor.snapshot('Texte')
    editor.addTextLayer(value, {
      font: opts.textFont, size: opts.textSize, bold: opts.textBold,
      italic: opts.textItalic, tracking: opts.textTracking, color: opts.fg,
      align: opts.textAlign, smooth: opts.textSmooth,
    }, textInput.ix, textInput.iy)
    bump()
  }

  // ---- Menus --------------------------------------------------------------------------

  const applyCrop = () => { editor.snapshot(); editor.crop(cropRect); setCropRect(null); bump() }

  // Redressage : applique l'angle (slider ou droite tracée) au document
  const onApplyStraighten = () => {
    if (!straighten) return
    editor.snapshot()
    editor.rotateAngle(straighten.angle)
    setStraighten(null)
    fitView()
    bump()
  }

  const doExport = async (formatOrOpts) => {
    const o = typeof formatOrOpts === 'string' ? { format: formatOrOpts } : formatOrOpts
    const { format = 'png', quality = 92, scale = 100 } = o || {}
    const src = editor.compositeFiltered()
    const w = Math.max(1, Math.round(src.width * scale / 100))
    const h = Math.max(1, Math.round(src.height * scale / 100))
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    const cx = cv.getContext('2d')
    if (format === 'jpeg') { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h) }
    cx.drawImage(src, 0, 0, w, h)
    const blob = await new Promise((r) => cv.toBlob(r, `image/${format}`, format === 'png' ? undefined : quality / 100))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${editor.docName.replace(/\.\w+$/, '')}-edit.${format === 'jpeg' ? 'jpg' : format}`
    a.click()
  }

  const doSave = async (dossierId) => {
    const blob = await new Promise((r) => editor.compositeFiltered().toBlob(r, 'image/png'))
    const dId = dossierId || srcPhoto?.dossier_id || null
    const res = await saveEditedPhoto(wsId, blob, `${editor.docName}-edit.png`, dId)
    if (res && editor.isMontage) {
      await createMontage(wsId, {
        name: editor.docName.replace(/\.\w+$/, ''),
        dossier_id: dId,
        image_count: 2,
        ratio: '1:1',
        export_url: res.storage_path,
      })
    }
    return !!res
  }

  // ---- Filtres : aperçu live (restauration de la base + ré-application) ----------

  const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const cssFiltered = (cv, f) => { const t = mkCv(cv.width, cv.height); const x = t.getContext('2d'); x.filter = f; x.drawImage(cv, 0, 0); cv.getContext('2d').drawImage(t, 0, 0); return cv }
  const lutRgb = (lut) => (cv) => applyLUTs(cv, { rgb: lut })
  const FILTER_FNS = {
    gaussian: (cv, p) => gaussianBlur(cv, p.radius),
    motion: (cv, p) => motionBlur(cv, p.angle, p.dist),
    sharpen: (cv, p) => unsharp(cv, Math.min(2, p.amount / 100) * 0.6),
    denoise: (cv) => medianFilter(cv),
    pixelate: (cv, p) => pixelate(cv, p.size),
    twirl: (cv, p) => twirl(cv, p.angle),
    wave: (cv, p) => wave(cv, p.amp, p.len),
    vignette: (cv, p) => vignette(cv, p.strength / 100),
    sepia: (cv, p) => cssFiltered(cv, `sepia(${p.amount}%)`),
    solarize: (cv, p) => { const l = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) l[i] = i > p.threshold ? 255 - i : i; applyLUTs(cv, { rgb: l }) },
    posterize: (cv, p) => { const n = Math.max(2, p.levels); const l = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) l[i] = Math.round(Math.round(i / 255 * (n - 1)) * 255 / (n - 1)); applyLUTs(cv, { rgb: l }) },
    edge: (cv) => conv3x3(cv, [-1, -1, -1, -1, 8, -1, -1, -1, -1]),
    emboss: (cv, p) => { const a = p.amount / 100; conv3x3(cv, [-2 * a, -a, 0, -a, a, a, 0, a, 2 * a], 1, 128) },
    invert: (cv) => { const l = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) l[i] = 255 - i; applyLUTs(cv, { rgb: l }) },
    desaturate: (cv) => cssFiltered(cv, 'grayscale(100%)'),
    equalize: (cv) => equalize(cv),
  }

  const runFilter = (key, params) => {
    const l = editor.active
    if (!l || l.type === 'adjust') return
    if (l.locked) l.locked = false
    applyFilterRegion(editor, l, (cv) => FILTER_FNS[key]?.(cv, params))
  }
  const openFilter = (key) => {
    if (!editor.active || editor.active.type === 'adjust') return
    filterBase.current = JSON.stringify(editor._dump())
    setFilterKey(key)
  }
  // chaque changement de paramètre : restaure la base puis ré-applique → aperçu réversible
  const previewT = useRef(null)
  const previewFilter = (params) => {
    clearTimeout(previewT.current)
    previewT.current = setTimeout(async () => {
      if (!filterBase.current) return
      await editor._restore(filterBase.current)
      runFilter(filterKey, params)
      bump()
    }, 120)
  }
  const applyFilter = async (params) => {
    if (!filterBase.current) return
    await editor._restore(filterBase.current)
    editor.snapshot(FILTER_DEFS[filterKey]?.label || 'Filtre')
    runFilter(filterKey, params)
    filterBase.current = null
    setFilterKey(null)
    bump()
  }
  const cancelFilter = async () => {
    if (filterBase.current) { await editor._restore(filterBase.current); filterBase.current = null }
    setFilterKey(null)
    bump()
  }

  // ---- Copier / coller (presse-papiers OS + presse-papiers interne en repli) ----------

  const clipRef = useRef(null) // copie interne (canvas) — le clipboard OS peut être refusé

  const copySelection = async () => {
    const comp = editor.compositeFiltered()
    const t = mkCv(editor.w, editor.h)
    const x = t.getContext('2d')
    x.drawImage(comp, 0, 0)
    // limite à la sélection : efface le reste via le masque
    if (editor.sel || editor.selPoly) {
      x.globalCompositeOperation = 'destination-in'
      x.drawImage(editor.selMaskCanvas(0), 0, 0)
    }
    clipRef.current = t // toujours disponible en interne
    try {
      const blob = await new Promise((r) => t.toBlob(r, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch { /* clipboard OS indisponible — le repli interne suffit */ }
  }
  const pasteClipboard = async () => {
    // 1) clipboard OS (permet de coller une image extérieure)
    try {
      const items = await navigator.clipboard.read()
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'))
        if (!type) continue
        const blob = await it.getType(type)
        const img = await loadImg(URL.createObjectURL(blob))
        editor.snapshot('Coller')
        const l = editor.addLayer('Collé')
        l.ctx.drawImage(img, (editor.w - img.width) / 2, (editor.h - img.height) / 2)
        bump()
        return
      }
    } catch { /* pas d'accès — on tente le repli interne */ }
    // 2) presse-papiers interne (copie faite dans le Studio)
    if (clipRef.current) {
      editor.snapshot('Coller')
      const l = editor.addLayer('Collé')
      l.ctx.drawImage(clipRef.current, 0, 0)
      bump()
    }
  }

  const menus = [
    { label: 'Fichier', tip: 'Document : ouvrir, montage avant/après, exporter', items: [
      { label: 'Ouvrir une photo…', onClick: () => setModal('open') },
      { label: 'Importer un fichier…', onClick: () => fileInput.current?.click() },
      { label: 'Montage avant / après…', onClick: () => setModal('montage') },
      '-',
      { label: 'Exporter / Enregistrer…', shortcut: 'Ctrl+S', disabled: !docOpen, onClick: () => setModal('export') },
      { label: 'Export rapide PNG', disabled: !docOpen, onClick: () => doExport('png') },
      '-',
      { label: 'Fermer le document', disabled: !docOpen, onClick: () => setDocOpen(false) },
    ]},
    { label: 'Édition', tip: 'Historique, presse-papiers et contenu de la sélection', items: [
      { label: 'Annuler', shortcut: 'Ctrl+Z', disabled: !docOpen, onClick: async () => { await editor.undo(); bump() } },
      { label: 'Rétablir', shortcut: 'Ctrl+Y', disabled: !docOpen, onClick: async () => { await editor.redo(); bump() } },
      '-',
      { label: 'Copier', shortcut: 'Ctrl+C', disabled: !docOpen, onClick: copySelection },
      { label: 'Coller en calque', shortcut: 'Ctrl+V', disabled: !docOpen, onClick: pasteClipboard },
      '-',
      { label: 'Remplir (premier plan)', shortcut: 'Alt+Suppr', disabled: !docOpen, onClick: () => {
        if (editor.active?.locked) editor.addLayer()
        editor.snapshot('Remplir'); editor.fill(opts.fg, opts.selFeather); bump()
      } },
      { label: 'Remplir (arrière-plan)', disabled: !docOpen, onClick: () => {
        if (editor.active?.locked) editor.addLayer()
        editor.snapshot('Remplir'); editor.fill(opts.bg, opts.selFeather); bump()
      } },
      { label: 'Effacer le contenu', shortcut: 'Suppr', disabled: !docOpen, onClick: () => {
        if (editor.active?.locked) editor.addLayer()
        editor.snapshot('Effacer'); editor.deleteContent(opts.selFeather); bump()
      } },
      '-',
      { label: 'Transformation manuelle', shortcut: 'Ctrl+T', disabled: !docOpen || !editor.active || editor.active?.locked,
        onClick: startFt },
    ]},
    { label: 'Sélection', tip: 'Zones de travail : créer, modifier, inverser', items: [
      { label: 'Tout sélectionner', shortcut: 'Ctrl+A', disabled: !docOpen, onClick: () => { editor.selectAll(); bump() } },
      { label: 'Désélectionner', shortcut: 'Ctrl+D', disabled: !docOpen || !editor.sel, onClick: () => { editor.deselect(); bump() } },
      { label: 'Resélectionner', disabled: !docOpen || !editor.lastSel, onClick: () => { editor.reselect(); bump() } },
      { label: `${editor.selInverted ? '✓ ' : ''}Inverser`, shortcut: 'Ctrl+Maj+I', disabled: !docOpen || (!editor.sel && !editor.selPoly),
        onClick: () => { editor.invertSelection(); bump() } },
      '-',
      { label: `Plume…${opts.selFeather ? ` (${opts.selFeather} px)` : ''}`, disabled: !docOpen || (!editor.sel && !editor.selPoly), onClick: () => {
        const v = +window.prompt('Rayon de contour progressif (px) :', String(opts.selFeather || 0))
        if (!isNaN(v)) setOpts((o) => ({ ...o, selFeather: Math.max(0, v) }))
      } },
      { label: 'Étendre…', disabled: !docOpen || (!editor.sel && !editor.selPoly), onClick: () => {
        const v = +window.prompt('Étendre de (px) :', '8')
        if (v > 0) { editor.snapshot('Étendre'); editor.resizeSelection(v); bump() }
      } },
      { label: 'Contracter…', disabled: !docOpen || (!editor.sel && !editor.selPoly), onClick: () => {
        const v = +window.prompt('Contracter de (px) :', '8')
        if (v > 0) { editor.snapshot('Contracter'); editor.resizeSelection(-v); bump() }
      } },
      '-',
      { label: 'Sélection et masque…', shortcut: 'Ctrl+Alt+R', disabled: !docOpen || (!editor.sel && !editor.selPoly),
        onClick: () => setModal('selmask') },
    ]},
    { label: 'Image', tip: 'Transformations du document (rotation, miroir, taille, aplatir)', items: [
      { label: 'Pivoter 90°', disabled: !docOpen, onClick: () => { editor.snapshot('Pivoter'); editor.rotate90(); bump() } },
      { label: 'Miroir horizontal', disabled: !docOpen, onClick: () => { editor.snapshot('Miroir H'); editor.flipH(); bump() } },
      { label: 'Miroir vertical', disabled: !docOpen, onClick: () => { editor.snapshot('Miroir V'); editor.flipV(); bump() } },
      '-',
      { label: 'Recadrer sur la sélection', disabled: !docOpen || !editor.sel, onClick: () => { editor.snapshot('Recadrer'); editor.cropToSelection(); bump(); fitView() } },
      { label: 'Rogner les pixels transparents', disabled: !docOpen, onClick: () => { editor.snapshot('Rogner'); editor.trim(); bump(); fitView() } },
      { label: 'Taille de l\'image…', disabled: !docOpen, onClick: () => {
        const v = +window.prompt(`Taille actuelle : ${editor.w} × ${editor.h} px — nouveau pourcentage :`, '50')
        if (v > 0) { editor.snapshot('Redimensionner'); editor.resizeDoc(v / 100); bump(); fitView() }
      } },
      '-',
      { label: 'Aplatir l\'image', disabled: !docOpen, onClick: () => { editor.snapshot('Aplatir'); editor.flatten(); bump() } },
    ]},
    { label: 'Filtre', tip: 'Filtres avec aperçu sur le canevas — écrêtés à la sélection', items: [
      { label: 'Flou gaussien…', disabled: !docOpen, onClick: () => openFilter('gaussian') },
      { label: 'Flou de mouvement…', disabled: !docOpen, onClick: () => openFilter('motion') },
      { label: 'Accentuation…', disabled: !docOpen, onClick: () => openFilter('sharpen') },
      { label: 'Réduire le bruit', disabled: !docOpen, onClick: () => openFilter('denoise') },
      { label: 'Mosaïque…', disabled: !docOpen, onClick: () => openFilter('pixelate') },
      '-',
      { label: 'Tourbillon…', disabled: !docOpen, onClick: () => openFilter('twirl') },
      { label: 'Onde…', disabled: !docOpen, onClick: () => openFilter('wave') },
      '-',
      { label: 'Vignettage…', disabled: !docOpen, onClick: () => openFilter('vignette') },
      { label: 'Sépia…', disabled: !docOpen, onClick: () => openFilter('sepia') },
      { label: 'Solarisation…', disabled: !docOpen, onClick: () => openFilter('solarize') },
      { label: 'Postérisation…', disabled: !docOpen, onClick: () => openFilter('posterize') },
      { label: 'Détection de contours', disabled: !docOpen, onClick: () => openFilter('edge') },
      { label: 'Relief…', disabled: !docOpen, onClick: () => openFilter('emboss') },
      '-',
      { label: 'Négatif', shortcut: 'Ctrl+I', disabled: !docOpen, onClick: () => { editor.snapshot('Négatif'); runFilter('invert', {}); bump() } },
      { label: 'Désaturer', disabled: !docOpen, onClick: () => { editor.snapshot('Désaturer'); runFilter('desaturate', {}); bump() } },
      { label: 'Égaliser', disabled: !docOpen, onClick: () => { editor.snapshot('Égaliser'); runFilter('equalize', {}); bump() } },
    ]},
    { label: 'Calque', tip: 'Pile de calques, réglages non destructifs, masques', items: [
      { label: 'Nouveau calque', disabled: !docOpen, onClick: () => { editor.addLayer(); editor.snapshot('Nouveau calque'); bump() } },
      { label: 'Dupliquer le calque', shortcut: 'Ctrl+J', disabled: !docOpen, onClick: () => { editor.snapshot('Dupliquer'); editor.duplicateLayer(editor.activeId); bump() } },
      { label: 'Supprimer le calque', disabled: !docOpen, onClick: () => { editor.snapshot('Supprimer'); editor.removeLayer(editor.activeId); bump() } },
      '-',
      { label: 'Nouveau via copier', disabled: !docOpen, onClick: () => { editor.snapshot('Via copier'); editor.layerViaCopy(); bump() } },
      { label: 'Nouveau via couper', disabled: !docOpen, onClick: () => { editor.snapshot('Via couper'); editor.layerViaCut(); bump() } },
      { label: 'Fusionner les visibles', shortcut: 'Ctrl+Maj+Alt+E', disabled: !docOpen, onClick: () => { editor.snapshot('Fusion'); editor.mergeVisible(); bump() } },
      '-',
      { label: 'Nouveau calque de réglage…', disabled: !docOpen, onClick: () => {
        editor.snapshot('Calque de réglage')
        editor.addAdjustLayer('bc')
        bump() // les paramètres s'éditent dans l'onglet Propriétés (façon Photoshop)
      } },
      '-',
      { label: 'Ajouter un masque de fusion', disabled: !docOpen || !editor.active || editor.active.locked || editor.active.type === 'adjust' || !!editor.active?.mask,
        onClick: () => { editor.snapshot('Masque'); editor.addMask(editor.active, false); bump() } },
      { label: 'Masque depuis la sélection', disabled: !docOpen || !editor.active || editor.active.locked || editor.active.type === 'adjust' || !!editor.active?.mask || (!editor.sel && !editor.selPoly),
        onClick: () => { editor.snapshot('Masque'); editor.addMask(editor.active, true); bump() } },
      { label: 'Supprimer le masque', disabled: !docOpen || !editor.active?.mask,
        onClick: () => { editor.snapshot('Masque'); editor.removeMask(editor.active); bump() } },
    ]},
    { label: 'Affichage', tip: 'Zoom, règles, guides, grille, magnétisme', items: [
      { label: 'Zoom +', shortcut: '+', onClick: () => zoomAt(1.25) },
      { label: 'Zoom −', shortcut: '−', onClick: () => zoomAt(0.8) },
      { label: 'Ajuster à l\'écran', shortcut: '0', disabled: !docOpen, onClick: fitView },
      { label: 'Taille réelle (100 %)', shortcut: '1', disabled: !docOpen, onClick: () => setZoom(1) },
      { label: '50 %', disabled: !docOpen, onClick: () => setZoom(0.5) },
      { label: '200 %', disabled: !docOpen, onClick: () => setZoom(2) },
      { label: 'Taille d\'impression (300 dpi)', disabled: !docOpen, onClick: () => setZoom(96 / 300) },
      '-',
      { label: `${rulers ? '✓ ' : ''}Règles`, shortcut: 'Ctrl+R', disabled: !docOpen, onClick: () => setRulers((v) => !v) },
      { label: `${guidesOn ? '✓ ' : ''}Guides`, shortcut: 'Ctrl+;', disabled: !docOpen, onClick: () => setGuidesOn((v) => !v) },
      { label: `${gridOn ? '✓ ' : ''}Grille`, shortcut: 'Ctrl+G', disabled: !docOpen, onClick: () => setGridOn((v) => !v) },
      { label: `${snapOn ? '✓ ' : ''}Magnétisme`, disabled: !docOpen, onClick: () => setSnapOn((v) => !v) },
      { label: 'Effacer les guides', disabled: !docOpen || (!guides.v.length && !guides.h.length), onClick: () => setGuides({ v: [], h: [] }) },
      '-',
      { label: 'Plein écran', shortcut: 'F', onClick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()) },
      '-',
      { label: compare != null ? 'Quitter la comparaison' : 'Comparer AVANT / APRÈS', shortcut: 'Q', disabled: !docOpen,
        onClick: () => setCompare(compare != null ? null : 0.5) },
    ]},
  ]

  // ---- Raccourcis clavier -----------------------------------------------------------------

  useEffect(() => {
    const h = async (e) => {
      // on laisse les champs texte gérer leurs touches (Ctrl+A = sélectionner le texte…)
      // mais les range/color/checkbox n'ont pas besoin du clavier → raccourcis actifs
      if (e.target.matches('input:not([type]),input[type=text],input[type=search],input[type=number],textarea,select,[contenteditable]')) return
      const k = e.key.toLowerCase()
      // transformation manuelle active : Entrée valide, Échap annule (avant tout)
      if (ft && !e.ctrlKey && !e.metaKey) {
        if (k === 'enter') { e.preventDefault(); applyFt() }
        else if (k === 'escape') { e.preventDefault(); cancelFt() }
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && e.shiftKey) { await editor.redo(); bump() }
        else if (k === 'z') { await editor.undo(); bump() }
        else if (k === 'y') { await editor.redo(); bump() }
        else if (k === 's') { e.preventDefault(); setModal('export') }
        else if (k === 'a') { e.preventDefault(); editor.selectAll(); bump() }
        else if (k === 'd') { e.preventDefault(); editor.deselect(); bump() }
        else if (k === 'r' && e.altKey && docOpen) { e.preventDefault(); if (editor.sel || editor.selPoly) setModal('selmask') }
        else if (k === 'r') { e.preventDefault(); setRulers((v) => !v) }
        else if (k === 'g') { e.preventDefault(); setGridOn((v) => !v) }
        else if (k === 'c') { copySelection() }
        else if (k === 'v') { pasteClipboard() }
        else if (k === 'j' && e.shiftKey && docOpen) { e.preventDefault(); editor.snapshot('Via couper'); editor.layerViaCut(); bump() }
        else if (k === 'j' && docOpen) { e.preventDefault(); editor.snapshot('Via copier'); editor.layerViaCopy(); bump() }
        else if (k === 'i' && e.shiftKey && docOpen) { e.preventDefault(); editor.invertSelection(); bump() }
        else if (k === 'i' && docOpen) { e.preventDefault(); editor.snapshot('Négatif'); runFilter('invert', {}); bump() }
        else if (k === 't' && docOpen) { e.preventDefault(); startFt() }
        else if (k === 'e' && e.shiftKey && e.altKey && docOpen) { e.preventDefault(); editor.snapshot('Fusion'); editor.mergeVisible(); bump() }
        else if (k === ';' || k === ':') { e.preventDefault(); setGuidesOn((v) => !v) }
        return
      }
      if (k === 'enter' && plassoRef.current) { commitPlasso(); return }
      if (k === 'escape' && plassoRef.current) { cancelPlasso(); return }
      if (k === 'enter' && penPath) { commitPen(false); return }
      if (k === 'escape' && penPath) { setPenPath(null); return }
      const shiftMap = { l: 'plasso', b: 'pencil', u: 'sharpenTool', s: 'smudge', m: 'shape' }
      const map = { v: 'move', a: 'pathsel', c: 'crop', m: 'rect', l: 'lasso', w: 'wand', b: 'brush', s: 'clone', e: 'eraser', g: 'gradient', k: 'bucket', t: 'text', p: 'pen', i: 'picker', h: 'hand', z: 'zoom', r: 'rotate', j: 'heal', o: 'tone', u: 'blurTool', y: 'redeye' }
      if (e.shiftKey && shiftMap[k]) setTool(shiftMap[k])
      else if (map[k]) setTool(map[k])
      else if (k === '+') zoomAt(1.25)
      else if (k === '-') zoomAt(0.8)
      else if (k === '0') fitView()
      else if (k === 'x') setOpts((o) => ({ ...o, fg: o.bg, bg: o.fg }))
      else if (k === 'q' && docOpen) setCompare((c) => (c != null ? null : 0.5))
      else if (k === 'f') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() }
      else if (k === 'delete' || k === 'backspace') { if (docOpen) { if (editor.active?.locked) editor.addLayer(); editor.snapshot(); editor.deleteContent(); bump() } }
      else if (k === 'escape') { editor.deselect(); setCropRect(null); bump() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [editor, bump, docOpen, ft, penPath]) // ft/penPath : Entrée/Échap voient l'état courant

  // ---- Rendu --------------------------------------------------------------------------------

  return (
    <Flex h="100%" direction="column" bg={S.bg} color={S.fg} overflow="hidden">
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={openFile} />
      <MenuBar menus={menus} docName={docOpen ? editor.docName : ''} zoom={docOpen ? view.scale : null} />
      {docOpen && (
        <OptionsBar tool={tool} opts={opts} setOpts={setOpts}
          cropRect={cropRect} onApplyCrop={applyCrop} onCancelCrop={() => setCropRect(null)}
          onRotate={() => { editor.snapshot(); editor.rotate90(); bump() }}
          hasSel={!!(editor.sel || editor.selPoly)}
          onFill={() => {
            if (editor.active?.locked) editor.addLayer()
            editor.snapshot('Remplir'); editor.fill(opts.fg, opts.selFeather); bump()
          }}
          onDelete={() => {
            if (editor.active?.locked) editor.addLayer()
            editor.snapshot('Effacer'); editor.deleteContent(opts.selFeather); bump()
          }}
          onDeselect={() => { editor.deselect(); bump() }}
          onSelMask={() => setModal('selmask')}
          canUndo={editor.undoStack.length > 0} canRedo={editor.redoStack.length > 0}
          onUndo={async () => { await editor.undo(); bump() }}
          onRedo={async () => { await editor.redo(); bump() }}
          onPickColor={setPickColor}
          freeTransform={ft} onFtChange={(p) => setFt((f) => f && ({ ...f, ...p }))}
          onFtApply={applyFt} onFtCancel={cancelFt} />
      )}
      <Flex flex="1" minH="0">
        <ToolBar tool={tool} setTool={setTool}
          fgColor={opts.fg} bgColor={opts.bg}
          onPickColor={setPickColor}
          onSwap={() => setOpts((o) => ({ ...o, fg: o.bg, bg: o.fg }))} />
        <Flex direction="column" flex="1" minW="0">
          {/* Onglet de document façon Photoshop : nom @ zoom (calque actif, mode) */}
          {docOpen && (
            <HStack h="26px" px="2.5" gap="2" bg={S.card} borderBottom="1px solid"
              borderColor={S.border} flexShrink="0" fontSize="2xs" color={S.muted}>
              <Text color={S.fg} isTruncated fontWeight="600">{editor.docName}</Text>
              <Text>@ {Math.round(view.scale * 100)} %</Text>
              <Text isTruncated>({editor.active?.name || '—'}, RVB/8)</Text>
              <Box flex="1" />
              {editor.sel && <Text color="#4f8fe8">sélection active</Text>}
              {editor.active?.type === 'adjust' && <Text color="#c4b5fd">calque de réglage</Text>}
            </HStack>
          )}
          <Box
            ref={containerRef} flex="1" position="relative" bg={S.canvas} overflow="hidden"
            cursor={tool === 'hand' ? 'grab' : tool === 'text' ? 'text' : 'crosshair'}
          >
          <canvas
            ref={canvasRef} style={{ position: 'absolute', inset: 0 }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onDoubleClick={(e) => {
              // double-clic sur un calque de texte → ré-édition du contenu
              if (!docOpen || ft) return
              const [ix, iy] = toImg(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
              const hit = textLayerAt(ix, iy)
              if (hit) {
                editor.setActive(hit.id)
                setTextInput({ sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY, ix, iy, t: Date.now(), edit: hit, value: hit.text?.value || '' })
                bump()
              }
            }}
            onDoubleClick={() => tool === 'plasso' && commitPlasso()}
            onWheel={(e) => zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
          />
          {docOpen && (
            <canvas ref={ovlRef} style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }} />
          )}
          {docOpen && rulers && (
            <>
              <canvas
                ref={ruleTopRef}
                style={{ position: 'absolute', top: 0, left: RULER_W, right: 0, height: RULER_W, zIndex: 6, cursor: 'ew-resize' }}
                onPointerDown={ruleDown('v')} onPointerMove={ruleMove('v')} onPointerUp={ruleUp('v')}
              />
              <canvas
                ref={ruleLeftRef}
                style={{ position: 'absolute', top: RULER_W, left: 0, bottom: 0, width: RULER_W, zIndex: 6, cursor: 'ns-resize' }}
                onPointerDown={ruleDown('h')} onPointerMove={ruleMove('h')} onPointerUp={ruleUp('h')}
              />
              <Box position="absolute" top="0" left="0" w={`${RULER_W}px`} h={`${RULER_W}px`}
                bg={S.input} zIndex="7" borderRight="1px solid" borderBottom="1px solid" borderColor={S.border} />
            </>
          )}
          {!docOpen && (
            <Box position="absolute" inset="0" zIndex="10" display="flex">
              <EmptyCanvas onPick={() => setModal('open')} onOpen={() => fileInput.current?.click()} />
            </Box>
          )}
          {docOpen && (
            <Box
              as="button" position="absolute" top={rulers ? `${RULER_W + 12}px` : '3'} right="3" px="3" py="1.5" fontSize="xs"
              borderRadius="md" bg="blackAlpha.600" color="#ffffff" cursor="pointer" zIndex="5"
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
            >
              Maintenir — Avant
            </Box>
          )}
          {textInput && (
            <Input
              position="absolute" left={textInput.sx} top={textInput.sy - 14} w="240px" h="28px"
              fontSize="sm" bg={S.input} color={S.fg} border="1px solid" borderColor={C.primary}
              autoFocus placeholder="Texte…" zIndex="6" defaultValue={textInput.value || ''}
              onKeyDown={(e) => { if (e.key === 'Enter') commitText(e.target.value); if (e.key === 'Escape') setTextInput(null) }}
              onBlur={(e) => {
                // blur parasite du clic qui a ouvert le champ : on refocus
                if (Date.now() - (textInput.t || 0) < 500) { e.target.focus(); return }
                commitText(e.target.value)
              }}
            />
          )}
          </Box>
        </Flex>
        {docOpen && <RightPanel editor={editor} version={version} zoom={view.scale} cursor={cursor} onChange={bump}
          onFx={(k) => { setFxKey(k || null); setModal('style') }}
          onAdjust={null}
          onJump={async (dir, i) => {
            if (dir === 'undo') await editor.historyJump(i)
            else await editor.historyJumpForward(i)
            bump()
          }}
          curveTarget={editor.active?.type === 'adjust' && editor.active.adj?.kind === 'curves' ? editor.active.adj.params : null}
          view={view} stageSize={stageSize}
          onNav={(ix, iy) => setView((v) => ({
            ...v, ox: stageSize.w / 2 - ix * v.scale, oy: stageSize.h / 2 - iy * v.scale,
          }))}
          fgColor={opts.fg} bgColor={opts.bg}
          onColor={(k, v) => setOpts((o) => ({ ...o, [k]: v }))}
          onPickColor={setPickColor}
          wbPick={wbPick} onWbPick={() => setWbPick((v) => !v)}
          comparing={compare != null} onCompare={() => setCompare((c) => (c != null ? null : 0.5))}
          dental={{
            comparing: compare != null,
            onCompare: () => setCompare((c) => (c != null ? null : 0.5)),
            onMontage: () => setModal('montage'),
            straighten, setStraighten, onApplyStraighten,
            wbPick, onWbPick: () => setWbPick((v) => !v),
            onCalRef: () => setModal('calref'),
            shade, onShade, srcPhoto,
            steps, refStep, onRefStep: pickRefStep,
            refImg, refOverlay,
            onToggleOverlay: () => setRefOverlay((v) => !v),
            onPickRef: () => setModal('refpick'),
            onSheet: () => setModal('sheet'),
          }} />}
      </Flex>
      <StatusBar editor={editor} zoom={view.scale} tool={tool} onZoom={(f) => zoomAt(f)} />

      <OpenPhotoModal open={modal === 'open'} onClose={() => setModal(null)} wsId={wsId} onPick={openPhoto} />
      <OpenPhotoModal open={modal === 'calref'} onClose={() => setModal(null)} wsId={wsId} onPick={calibrateToRef} />
      <OpenPhotoModal open={modal === 'refpick'} onClose={() => setModal(null)} wsId={wsId} onPick={pickRefPhoto} />
      <MontageModal open={modal === 'montage'} onClose={() => setModal(null)} wsId={wsId} onCreate={openMontage} />
      <SheetModal open={modal === 'sheet'} onClose={() => setModal(null)} wsId={wsId} onCompose={composeSheet} />
      <ColorPickerModal open={!!pickColor} onClose={() => setPickColor(null)}
        color={pickColor ? opts[pickColor] : '#000000'}
        title={pickColor === 'bg' ? 'Sélecteur de couleurs (arrière-plan)' : 'Sélecteur de couleurs (premier plan)'}
        onApply={(v) => setOpts((o) => ({ ...o, [pickColor]: v }))} />
      <LayerStyleModal open={modal === 'style'} onClose={() => setModal(null)}
        layer={editor.active} initial={fxKey}
        onApply={(fx, lOpt) => {
          const l = editor.active
          if (!l) return
          editor.snapshot()
          l.fx = fx
          l.opacity = lOpt.opacity; l.fill = lOpt.fill; l.blend = lOpt.blend
          bump()
        }} />
      <ExportModal open={modal === 'export'} onClose={() => setModal(null)}
        editor={editor} docName={editor.docName} dossiers={dossiers} onExport={doExport} onSave={doSave} />
      <FilterModal open={!!filterKey} def={filterKey ? FILTER_DEFS[filterKey] : null}
        onPreview={previewFilter} onApply={applyFilter} onCancel={cancelFilter}
        onPreviewOff={async () => {
          clearTimeout(previewT.current)
          if (filterBase.current) { await editor._restore(filterBase.current); bump() }
        }} />
      <SelectMaskModal open={modal === 'selmask'} onClose={() => setModal(null)}
        editor={editor} onChange={bump}
        onApply={(fe) => { setOpts((o) => ({ ...o, selFeather: fe })); bump() }} />
    </Flex>
  )
}
