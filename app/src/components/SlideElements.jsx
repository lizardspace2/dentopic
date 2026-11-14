// Éléments libres posés sur une diapositive — façon PowerPoint/Canva.
// Le canevas d'une diapo contient des éléments positionnés en % : images,
// vidéos, zones de texte, formes. Le modèle est persisté en JSON dans la
// colonne `notes` de presentation_slides (aucune migration nécessaire) :
//   { v: 1, els: [ { id, t, x, y, w, h, z, ... } ] }
// Une diapo sans layout JSON dérive des éléments à partir de ses champs
// legacy (photo plein cadre + titre, ou titre + texte centrés) — elle se
// convertit automatiquement dès qu'on la modifie.
//
// Rendu identique partout : tailles de texte en `cqh` (% de la hauteur du
// canevas via container queries) → la vignette du filmstrip affiche la même
// diapo en miniature que le plein écran.
import { useRef, useState } from 'react'
import { Box, Center, Text } from '@chakra-ui/react'
import { FiImage, FiRotateCw, FiType } from 'react-icons/fi'
import { usePhotoUrl } from '../media'

export const LAYOUT_VERSION = 1

export function layoutNotes(els, bg = null) {
  return JSON.stringify(bg ? { v: LAYOUT_VERSION, els, bg } : { v: LAYOUT_VERSION, els })
}

// Fond personnalisé de la diapo : { c: '#hex' } | { g: 'linear-gradient(...)' }
// | { path: 'storage/path' } — null → fond par défaut selon le type de diapo.
export function slideBg(s) {
  try {
    const j = JSON.parse(s?.notes || '')
    if (j?.bg && typeof j.bg === 'object') return j.bg
  } catch { /* pas de layout */ }
  return null
}

// Éléments affichés d'une diapo : layout persisté, ou dérivation legacy.
export function slideElements(s) {
  try {
    const j = JSON.parse(s?.notes || '')
    if (Array.isArray(j?.els)) return j.els
  } catch { /* pas de layout */ }
  return deriveElements(s)
}

// Convertit une diapo legacy en éléments éditables (ids stables d*).
function deriveElements(s) {
  const els = []
  if (!s) return els
  if (s.type === 'text') {
    if (s.title) els.push({ id: 'd1', t: 'text', x: 8, y: 30, w: 84, h: 20, text: s.title, size: 9, color: '#f1f5f9', align: 'center', bold: true, z: 1 })
    if (s.text_content) els.push({ id: 'd2', t: 'text', x: 14, y: 55, w: 72, h: 32, text: s.text_content, size: 4.2, color: '#94a3b8', align: 'center', z: 2 })
    return els
  }
  const path = s.photo?.storage_path || s.montage?.export_url
  if (path) els.push({ id: 'd0', t: 'img', x: 0, y: 0, w: 100, h: 100, path, fit: 'contain', z: 0 })
  else if (s.media_url && s.type === 'video') els.push({ id: 'd0', t: 'video', x: 0, y: 0, w: 100, h: 100, url: s.media_url, z: 0 })
  else if (s.media_url) els.push({ id: 'd0', t: 'img', x: 0, y: 0, w: 100, h: 100, path: s.media_url, fit: 'contain', z: 0 })
  if (s.title) els.push({ id: 'd1', t: 'text', x: 3, y: 86, w: 94, h: 10, text: s.title, size: 5, color: '#ffffff', align: 'left', bold: true, shadow: true, z: 2 })
  return els
}

let seq = 0
export function newEl(fields) {
  return { id: `e${Date.now().toString(36)}${seq++}`, x: 15, y: 15, w: 70, h: 70, z: 99, ...fields }
}

// Formes disponibles — rendues en CSS (clip-path / border-radius).
export const SHAPE_DEFS = [
  ['rect', 'Rectangle'], ['pill', 'Pilule'], ['ellipse', 'Ellipse'],
  ['triangle', 'Triangle'], ['diamond', 'Losange'], ['arrow', 'Flèche'],
  ['star', 'Étoile'], ['hexagon', 'Hexagone'], ['line', 'Ligne'],
]
export const SHAPE_CSS = {
  rect: {},
  pill: { borderRadius: '999px' },
  ellipse: { borderRadius: '50%' },
  triangle: { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' },
  diamond: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
  arrow: { clipPath: 'polygon(0% 28%, 60% 28%, 60% 0%, 100% 50%, 60% 100%, 60% 72%, 0% 72%)' },
  star: { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
  hexagon: { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  line: {},
}

// ---- éléments individuels ----------------------------------------------------

function ElemImg({ el }) {
  const url = usePhotoUrl(el.path)
  if (!url) return <Center w="100%" h="100%" color="#475569"><FiImage /></Center>
  return (
    <Box as="img" src={url} w="100%" h="100%" draggable={false}
      objectFit={el.fit || 'contain'} borderRadius={el.radius ? 'md' : 0} />
  )
}

function ElemBody({ el }) {
  if (el.t === 'img') return <ElemImg el={el} />
  if (el.t === 'video') {
    return <Box as="video" src={el.url} w="100%" h="100%" objectFit="contain" controls={false} muted />
  }
  if (el.t === 'marker') {
    // Pastille numérotée (repère FDI) — cercle vrai quel que soit le ratio
    // de la zone : on s'appuie sur la hauteur de l'élément.
    return (
      <Center h="100%" mx="auto" style={{ aspectRatio: '1' }}>
        <Center w="100%" h="100%" borderRadius="full" color="#fff" fontWeight="700"
          bg={el.fill || '#ef4444'} border="2px solid #fff"
          boxShadow="0 1px 6px rgba(0,0,0,0.5)" fontSize={`${(el.h || 16) * 0.42}cqh`}
          userSelect="none">
          {el.label || '?'}
        </Center>
      </Center>
    )
  }
  if (el.t === 'shape') {
    const kind = el.shape || 'rect'
    return (
      <Box w="100%" h="100%" bg={el.fill || '#0d9488'} opacity={el.opacity ?? 1}
        style={SHAPE_CSS[kind] || {}}
        borderRadius={kind === 'rect' && el.radius ? 'md' : undefined} />
    )
  }
  // texte
  return (
    <Text w="100%" h="100%" fontSize={`${el.size || 5}cqh`} lineHeight="1.25"
      color={el.color || '#f1f5f9'} fontWeight={el.bold ? '700' : '400'}
      textAlign={el.align || 'left'} whiteSpace="pre-line" overflow="hidden"
      textShadow={el.shadow ? '0 1px 6px rgba(0,0,0,0.8)' : 'none'}>
      {el.text || ''}
    </Text>
  )
}

// ---- canevas -----------------------------------------------------------------
// editing → sélection au clic + glisser pour déplacer + poignée pour redimensionner.
// onEls(next, commit) : appelé pendant le geste (commit=false) puis au relâchement (true).

export default function SlideElements({ els, editing = false, sel = null, onSelect, onEls, emptyHint, bg = null }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const latest = useRef(els)
  latest.current = els
  const [guides, setGuides] = useState({ v: null, h: null }) // lignes d'alignement (%)
  const ordered = [...els].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

  const patch = (id, p, commit) =>
    onEls?.(els.map((e) => (e.id === id ? { ...e, ...p } : e)), commit)

  const down = (e, el, mode) => {
    if (!editing) return
    e.preventDefault(); e.stopPropagation()
    onSelect?.(el.id)
    const rect = ref.current.getBoundingClientRect()
    drag.current = {
      id: el.id, mode, sx: e.clientX, sy: e.clientY,
      ox: el.x, oy: el.y, ow: el.w, oh: el.h, rw: rect.width, rh: rect.height,
      // centre de l'élément en px — repère du geste de rotation
      cx: rect.left + ((el.x + el.w / 2) / 100) * rect.width,
      cy: rect.top + ((el.y + el.h / 2) / 100) * rect.height,
      // cibles du magnétisme : bords + centres des autres éléments + canevas
      xs: [0, 50, 100, ...els.filter((o) => o.id !== el.id).flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])],
      ys: [0, 50, 100, ...els.filter((o) => o.id !== el.id).flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])],
    }
    const move = (ev) => {
      const d = drag.current
      if (!d) return
      if (d.mode === 'rot') {
        let ang = Math.atan2(ev.clientY - d.cy, ev.clientX - d.cx) * (180 / Math.PI) + 90
        ang = ((ang % 360) + 360) % 360
        const snapped = Math.round(ang / 15) * 15
        patch(d.id, { rot: Math.abs(ang - snapped) <= 4 ? snapped : Math.round(ang) }, false)
        return
      }
      const dx = ((ev.clientX - d.sx) / d.rw) * 100
      const dy = ((ev.clientY - d.sy) / d.rh) * 100
      if (d.mode === 'move') {
        let nx = d.ox + dx
        let ny = d.oy + dy
        // magnétisme : accroche bord/centre de l'élément sur bord/centre des
        // autres ou du canevas (seuil ~8 px), ligne de guide affichée
        const th = (8 / d.rw) * 100
        let gv = null
        let gh = null
        for (const r of [nx, nx + d.ow / 2, nx + d.ow]) {
          const hit = d.xs.find((v) => Math.abs(v - r) <= th)
          if (hit != null) { nx += hit - r; gv = hit; break }
        }
        for (const r of [ny, ny + d.oh / 2, ny + d.oh]) {
          const hit = d.ys.find((v) => Math.abs(v - r) <= th)
          if (hit != null) { ny += hit - r; gh = hit; break }
        }
        setGuides({ v: gv, h: gh })
        patch(d.id, {
          x: Math.max(0, Math.min(100 - d.ow, nx)),
          y: Math.max(0, Math.min(100 - d.oh, ny)),
        }, false)
      } else {
        patch(d.id, {
          w: Math.max(4, Math.min(100 - d.ox, d.ow + dx)),
          h: Math.max(4, Math.min(100 - d.oy, d.oh + dy)),
        }, false)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (drag.current) onEls?.(latest.current, true)
      drag.current = null
      setGuides({ v: null, h: null })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <Box ref={ref} position="relative" w="100%" h="100%" containerType="size"
      onPointerDown={editing ? () => onSelect?.(null) : undefined}>
      {/* fond personnalisé : couleur, dégradé ou photo — sous les éléments */}
      {bg?.c && <Box position="absolute" inset="0" bg={bg.c} pointerEvents="none" />}
      {bg?.g && <Box position="absolute" inset="0" style={{ background: bg.g }} pointerEvents="none" />}
      {bg?.path && (
        <Box position="absolute" inset="0" pointerEvents="none">
          <ElemImg el={{ path: bg.path, fit: 'cover' }} />
        </Box>
      )}
      {ordered.map((el) => (
        <Box key={el.id} position="absolute"
          left={`${el.x}%`} top={`${el.y}%`} w={`${el.w}%`} h={`${el.h}%`}
          style={{ transform: el.rot ? `rotate(${el.rot}deg)` : undefined }}
          cursor={editing ? 'grab' : 'default'}
          outline={editing && sel === el.id ? '2px solid' : 'none'}
          outlineColor="blue.400" outlineOffset="1px" borderRadius="sm"
          onPointerDown={(e) => down(e, el, 'move')}>
          <ElemBody el={el} />
          {editing && sel === el.id && (
            <>
              {/* poignée de rotation au-dessus de l'élément, façon Canva */}
              <Center position="absolute" top="-24px" left="50%" style={{ transform: 'translateX(-50%)' }}
                w="16px" h="16px" bg="blue.400" borderRadius="full" color="#fff"
                fontSize="9px" cursor="grab" zIndex="2" border="1.5px solid #fff"
                onPointerDown={(e) => down(e, el, 'rot')}>
                <FiRotateCw />
              </Center>
              <Box position="absolute" right="-6px" bottom="-6px" w="12px" h="12px"
                bg="blue.400" borderRadius="full" cursor="nwse-resize" zIndex="2"
                border="2px solid #fff"
                onPointerDown={(e) => down(e, el, 'resize')} />
            </>
          )}
        </Box>
      ))}
      {/* lignes de guide magnétiques pendant le déplacement */}
      {guides.v != null && (
        <Box position="absolute" top="0" bottom="0" left={`${guides.v}%`} w="1px"
          bg="#ec4899" zIndex="5" pointerEvents="none" />
      )}
      {guides.h != null && (
        <Box position="absolute" left="0" right="0" top={`${guides.h}%`} h="1px"
          bg="#ec4899" zIndex="5" pointerEvents="none" />
      )}
      {!ordered.length && emptyHint && (
        <Center h="100%" flexDirection="column" gap="2" color="#475569">
          <Box as={emptyHint.icon || FiType} fontSize="3xl" />
          <Text fontSize="xs">{emptyHint.label}</Text>
        </Center>
      )}
    </Box>
  )
}

