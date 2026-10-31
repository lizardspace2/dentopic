// Route /studio — éditeur bitmap façon Photoshop (inspiré de photocraft / openphoto).
// Barre de menus + barre d'outils + canevas + panneaux Calques/Réglages/Infos.
// Le moteur canvas (calques, filtres, historique) vit dans ./engine.js —
// ce fichier ne fait que relier événements, menus et rendu.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Flex, Input } from '@chakra-ui/react'
import { useSearchParams } from 'react-router-dom'
import { C } from '../../theme'
import { useApp } from '../../context/AppContext'
import { createMontage, getPhoto, listDossiers, saveEditedPhoto } from '../../api'
import { photoUrl } from '../../media'
import { Editor, buildMontage, fetchImg, loadImg, rgbToHex, DEFAULT_ADJUST } from './engine'
import {
  MenuBar, ToolBar, OptionsBar, RightPanel, StatusBar, EmptyCanvas,
} from './panels'
import { OpenPhotoModal, ExportModal, MontageModal } from './modals'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function Studio() {
  const { workspace } = useApp()
  const wsId = workspace?.id

  const editor = useMemo(() => {
    const e = new Editor()
    e.resetAdjust = () => { e.adjust = { ...DEFAULT_ADJUST } }
    return e
  }, [])

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const fileInput = useRef(null)
  const stroke = useRef(null) // état du drag en cours
  const lastSample = useRef(0) // throttle pipette (panneau Infos)

  const [tool, setTool] = useState('move')
  const [opts, setOpts] = useState({ fg: '#dc2626', bg: '#ffffff', brushSize: 12, brushOpacity: 1, eraserSize: 30, textSize: 32, tol: 32, transform: false })
  const [view, setView] = useState({ scale: 1, ox: 40, oy: 40 })
  const [version, setVersion] = useState(0) // bump → re-render canvas + panneaux
  const [docOpen, setDocOpen] = useState(false)
  const [srcPhoto, setSrcPhoto] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [modal, setModal] = useState(null) // 'open' | 'export'
  const [cropRect, setCropRect] = useState(null)
  const [textInput, setTextInput] = useState(null) // {sx, sy, ix, iy}
  const [cursor, setCursor] = useState(null)
  const [showOriginal, setShowOriginal] = useState(false)

  const bump = useCallback(() => { editor.markDirty(); setVersion((v) => v + 1) }, [editor])
  const toImg = useCallback(
    (sx, sy) => [(sx - view.ox) / view.scale, (sy - view.oy) / view.scale],
    [view]
  )

  // ---- Ouvrir / importer ---------------------------------------------------------

  const openPhoto = async (p) => {
    const url = await photoUrl(p.storage_path)
    if (!url) return
    const img = await fetchImg(url)
    editor.open(img, p.original_filename || 'photo')
    editor.isMontage = false
    setSrcPhoto(p)
    setDocOpen(true)
    setModal(null)
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

  // ---- Rendu ----------------------------------------------------------------------

  const render = useCallback(() => {
    const cv = canvasRef.current
    if (cv) editor.render(cv, view, {
      showOriginal, cropRect,
      handles: tool === 'move' && opts.transform ? editor.active : null,
    })
  }, [editor, view, showOriginal, cropRect, tool, opts.transform, version])

  useEffect(render, [render, version])

  // Taille du canevas = taille du conteneur
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const c = containerRef.current, cv = canvasRef.current
      if (!c || !cv) return
      cv.width = c.clientWidth
      cv.height = c.clientHeight
      render()
    })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [render])

  useEffect(() => { if (wsId) listDossiers(wsId, { limit: 100 }).then(setDossiers) }, [wsId])

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
    fitView()
    bump()
  }

  // ---- Outils : pointer events ------------------------------------------------------

  const onPointerDown = (e) => {
    if (!docOpen) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const [ix, iy] = toImg(e.nativeEvent.offsetX, e.nativeEvent.offsetY)

    switch (tool) {
      case 'move': {
        const l = editor.active
        if (!l) break
        // poignées de transformation : coin proche -> redimensionnement
        if (opts.transform && !l.locked) {
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
        editor.snapshot()
        stroke.current = { kind: 'move', ox: ix, oy: iy, dx: l.dx, dy: l.dy }
        break
      }
      case 'wand':
        editor.snapshot()
        editor.wandSelect(ix, iy, opts.tol)
        bump()
        break
      case 'hand':
        stroke.current = { kind: 'pan', sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY, ox: view.ox, oy: view.oy }
        break
      case 'brush':
      case 'eraser': {
        const l = editor.active?.locked ? editor.addLayer() : editor.active || editor.addLayer()
        editor.snapshot()
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
      case 'crop':
        setCropRect([ix, iy, 0, 0])
        stroke.current = { kind: 'crop', x0: ix, y0: iy }
        break
      case 'rect':
        editor.sel = [ix, iy, 0, 0]
        stroke.current = { kind: 'sel', x0: ix, y0: iy }
        break
      case 'zoom':
        zoomAt(e.altKey ? 0.7 : 1.4, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        break
      case 'rotate':
        editor.snapshot(); editor.rotate90(); bump()
        break
      case 'text':
        setTextInput({ sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY, ix, iy })
        break
    }
  }

  const paint = (ix, iy, l) => {
    const s = stroke.current
    if (!s) return
    const ctx = l.ctx
    ctx.save()
    if (editor.sel) {
      const [sx, sy, sw, sh] = editor.sel
      ctx.beginPath()
      ctx.rect(sx - l.dx, sy - l.dy, sw, sh)
      ctx.clip()
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = opts.eraserSize
    } else {
      ctx.strokeStyle = opts.fg
      ctx.globalAlpha = opts.brushOpacity
      ctx.lineWidth = opts.brushSize
    }
    ctx.beginPath()
    ctx.moveTo(s.last[0] - l.dx, s.last[1] - l.dy)
    ctx.lineTo(ix - l.dx, iy - l.dy)
    ctx.stroke()
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
    const s = stroke.current
    if (!s) return
    if (s.kind === 'stroke') paint(ix, iy, s.l)
    else if (s.kind === 'move') {
      editor.active.dx = s.dx + (ix - s.ox)
      editor.active.dy = s.dy + (iy - s.oy)
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
      setCropRect([Math.min(s.x0, ix), Math.min(s.y0, iy), Math.abs(ix - s.x0), Math.abs(iy - s.y0)])
    } else if (s.kind === 'sel') {
      editor.sel = [Math.min(s.x0, ix), Math.min(s.y0, iy), Math.abs(ix - s.x0), Math.abs(iy - s.y0)]
      bump()
    }
  }

  const onPointerUp = () => {
    const s = stroke.current
    if (s?.kind === 'sel' && editor.sel && (editor.sel[2] < 3 || editor.sel[3] < 3)) editor.sel = null
    stroke.current = null
    bump()
  }

  // ---- Texte ------------------------------------------------------------------------

  const commitText = (value) => {
    if (!textInput || !value.trim()) { setTextInput(null); return }
    const l = editor.active?.locked ? editor.addLayer() : editor.active || editor.addLayer()
    editor.snapshot()
    l.ctx.font = `600 ${opts.textSize}px 'Inter Tight', sans-serif`
    l.ctx.fillStyle = opts.fg
    l.ctx.fillText(value, textInput.ix - l.dx, textInput.iy - l.dy)
    setTextInput(null)
    bump()
  }

  // ---- Menus --------------------------------------------------------------------------

  const applyCrop = () => { editor.snapshot(); editor.crop(cropRect); setCropRect(null); bump() }

  const doExport = async (format) => {
    const cv = editor.compositeFiltered()
    const blob = await new Promise((r) => cv.toBlob(r, `image/${format}`, 0.92))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${editor.docName.replace(/\.\w+$/, '')}-edit.${format === 'jpeg' ? 'jpg' : 'png'}`
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

  const menus = [
    { label: 'Fichier', items: [
      { label: 'Ouvrir une photo…', onClick: () => setModal('open') },
      { label: 'Importer un fichier…', onClick: () => fileInput.current?.click() },
      { label: 'Montage avant / après…', onClick: () => setModal('montage') },
      '-',
      { label: 'Exporter / Enregistrer…', shortcut: 'Ctrl+S', disabled: !docOpen, onClick: () => setModal('export') },
      '-',
      { label: 'Fermer le document', disabled: !docOpen, onClick: () => setDocOpen(false) },
    ]},
    { label: 'Édition', items: [
      { label: 'Annuler', shortcut: 'Ctrl+Z', disabled: !docOpen, onClick: async () => { await editor.undo(); bump() } },
      { label: 'Rétablir', shortcut: 'Ctrl+Y', disabled: !docOpen, onClick: async () => { await editor.redo(); bump() } },
      '-',
      { label: 'Remplir (premier plan)', shortcut: 'Alt+Suppr', disabled: !docOpen, onClick: () => {
        if (editor.active?.locked) editor.addLayer()
        editor.snapshot(); editor.fill(opts.fg); bump()
      } },
      { label: 'Effacer le contenu', shortcut: 'Suppr', disabled: !docOpen, onClick: () => {
        if (editor.active?.locked) editor.addLayer()
        editor.snapshot(); editor.deleteContent(); bump()
      } },
    ]},
    { label: 'Sélection', items: [
      { label: 'Tout sélectionner', shortcut: 'Ctrl+A', disabled: !docOpen, onClick: () => { editor.selectAll(); bump() } },
      { label: 'Désélectionner', shortcut: 'Ctrl+D', disabled: !docOpen || !editor.sel, onClick: () => { editor.deselect(); bump() } },
    ]},
    { label: 'Image', items: [
      { label: 'Pivoter 90°', disabled: !docOpen, onClick: () => { editor.snapshot(); editor.rotate90(); bump() } },
      { label: 'Miroir horizontal', disabled: !docOpen, onClick: () => { editor.snapshot(); editor.flipH(); bump() } },
      { label: 'Miroir vertical', disabled: !docOpen, onClick: () => { editor.snapshot(); editor.flipV(); bump() } },
      '-',
      { label: 'Aplatir l\'image', disabled: !docOpen, onClick: () => { editor.snapshot(); editor.flatten(); bump() } },
    ]},
    { label: 'Calque', items: [
      { label: 'Nouveau calque', disabled: !docOpen, onClick: () => { editor.addLayer(); editor.snapshot(); bump() } },
      { label: 'Dupliquer le calque', disabled: !docOpen, onClick: () => { editor.snapshot(); editor.duplicateLayer(editor.activeId); bump() } },
      { label: 'Supprimer le calque', disabled: !docOpen, onClick: () => { editor.snapshot(); editor.removeLayer(editor.activeId); bump() } },
    ]},
    { label: 'Affichage', items: [
      { label: 'Zoom +', shortcut: '+', onClick: () => zoomAt(1.25) },
      { label: 'Zoom −', shortcut: '−', onClick: () => zoomAt(0.8) },
      { label: 'Ajuster à l\'écran', shortcut: '0', disabled: !docOpen, onClick: fitView },
      { label: 'Taille réelle (100 %)', shortcut: '1', disabled: !docOpen, onClick: () => setView({ scale: 1, ox: 60, oy: 60 }) },
    ]},
  ]

  // ---- Raccourcis clavier -----------------------------------------------------------------

  useEffect(() => {
    const h = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && e.shiftKey) { await editor.redo(); bump() }
        else if (k === 'z') { await editor.undo(); bump() }
        else if (k === 'y') { await editor.redo(); bump() }
        else if (k === 's') { e.preventDefault(); setModal('export') }
        else if (k === 'a') { e.preventDefault(); editor.selectAll(); bump() }
        else if (k === 'd') { e.preventDefault(); editor.deselect(); bump() }
        return
      }
      const map = { v: 'move', c: 'crop', m: 'rect', w: 'wand', b: 'brush', e: 'eraser', t: 'text', i: 'picker', h: 'hand', z: 'zoom', r: 'rotate' }
      if (map[k]) setTool(map[k])
      else if (k === '+') zoomAt(1.25)
      else if (k === '-') zoomAt(0.8)
      else if (k === '0') fitView()
      else if (k === 'x') setOpts((o) => ({ ...o, fg: o.bg, bg: o.fg }))
      else if (k === 'delete' || k === 'backspace') { if (docOpen) { if (editor.active?.locked) editor.addLayer(); editor.snapshot(); editor.deleteContent(); bump() } }
      else if (k === 'escape') { editor.deselect(); setCropRect(null); bump() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [editor, bump])

  // ---- Rendu --------------------------------------------------------------------------------

  return (
    <Flex h="100%" direction="column" bg={C.darkBg} color={C.darkFg} overflow="hidden">
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={openFile} />
      <MenuBar menus={menus} docName={docOpen ? editor.docName : ''} zoom={docOpen ? view.scale : null} />
      {docOpen && (
        <OptionsBar tool={tool} opts={opts} setOpts={setOpts}
          cropRect={cropRect} onApplyCrop={applyCrop} onCancelCrop={() => setCropRect(null)}
          onRotate={() => { editor.snapshot(); editor.rotate90(); bump() }}
          hasSel={!!editor.sel}
          onFill={() => {
            if (editor.active?.locked) editor.addLayer()
            editor.snapshot(); editor.fill(opts.fg); bump()
          }}
          onDelete={() => {
            if (editor.active?.locked) editor.addLayer()
            editor.snapshot(); editor.deleteContent(); bump()
          }}
          onDeselect={() => { editor.deselect(); bump() }}
          canUndo={editor.undoStack.length > 0} canRedo={editor.redoStack.length > 0}
          onUndo={async () => { await editor.undo(); bump() }}
          onRedo={async () => { await editor.redo(); bump() }} />
      )}
      <Flex flex="1" minH="0">
        <ToolBar tool={tool} setTool={setTool}
          fgColor={opts.fg} setFgColor={(c) => setOpts((o) => ({ ...o, fg: c }))}
          bgColor={opts.bg} setBgColor={(c) => setOpts((o) => ({ ...o, bg: c }))}
          onSwap={() => setOpts((o) => ({ ...o, fg: o.bg, bg: o.fg }))} />
        <Box
          ref={containerRef} flex="1" position="relative" bg="#14181f" overflow="hidden"
          cursor={tool === 'hand' ? 'grab' : tool === 'text' ? 'text' : 'crosshair'}
        >
          <canvas
            ref={canvasRef} style={{ position: 'absolute', inset: 0 }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onWheel={(e) => zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
          />
          {!docOpen && (
            <Box position="absolute" inset="0" zIndex="10" display="flex">
              <EmptyCanvas onPick={() => setModal('open')} onOpen={() => fileInput.current?.click()} />
            </Box>
          )}
          {docOpen && (
            <Box
              as="button" position="absolute" top="3" right="3" px="3" py="1.5" fontSize="xs"
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
              fontSize="sm" bg="#1c2433" color="#ffffff" border="1px solid" borderColor={C.primary}
              autoFocus placeholder="Texte…" zIndex="6"
              onKeyDown={(e) => { if (e.key === 'Enter') commitText(e.target.value); if (e.key === 'Escape') setTextInput(null) }}
              onBlur={(e) => commitText(e.target.value)}
            />
          )}
        </Box>
        {docOpen && <RightPanel editor={editor} version={version} zoom={view.scale} cursor={cursor} onChange={bump} />}
      </Flex>
      <StatusBar editor={editor} zoom={view.scale} tool={tool} onZoom={(f) => zoomAt(f)} />

      <OpenPhotoModal open={modal === 'open'} onClose={() => setModal(null)} wsId={wsId} onPick={openPhoto} />
      <MontageModal open={modal === 'montage'} onClose={() => setModal(null)} wsId={wsId} onCreate={openMontage} />
      <ExportModal open={modal === 'export'} onClose={() => setModal(null)}
        docName={editor.docName} dossiers={dossiers} onExport={doExport} onSave={doSave} />
    </Flex>
  )
}
