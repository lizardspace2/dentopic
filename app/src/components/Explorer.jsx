// Explorateur façon gestionnaire de fichiers (Windows) :
// arborescence de dossiers, fil d'Ariane, tuiles de dossier et
// glisser-déposer de photos vers un dossier.
import { Fragment, useEffect, useState } from 'react'
import { Box, HStack, Text } from '@chakra-ui/react'
import { FiChevronDown, FiChevronRight, FiFolder } from 'react-icons/fi'
import { Card } from './ui'
import { C } from '../theme'

// ---- Glisser-déposer --------------------------------------------------------

export const PHOTO_DRAG_MIME = 'application/x-dentopic-photo-ids'

export function startPhotoDrag(e, ids) {
  e.dataTransfer.setData(PHOTO_DRAG_MIME, JSON.stringify(ids))
  e.dataTransfer.effectAllowed = 'move'
}

function readPhotoDrag(e) {
  try {
    const ids = JSON.parse(e.dataTransfer.getData(PHOTO_DRAG_MIME) || '[]')
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []
  } catch { return [] }
}

// Hook : transforme un élément en zone de dépôt de photos.
// `onMove(ids)` reçoit les ids déposés. `over` = survol de dépôt (style).
export function usePhotoDrop(onMove) {
  const [over, setOver] = useState(false)
  return {
    over,
    handlers: {
      onDragOver: (e) => {
        if (!e.dataTransfer.types.includes(PHOTO_DRAG_MIME)) return
        e.preventDefault(); e.stopPropagation(); setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        if (!e.dataTransfer.types.includes(PHOTO_DRAG_MIME)) return
        e.preventDefault(); e.stopPropagation(); setOver(false)
        const ids = readPhotoDrag(e)
        if (ids.length) onMove?.(ids)
      },
    },
  }
}

// Hook : transforme un élément en zone de dépôt de FICHIERS venant de
// l'ordinateur (glisser depuis l'explorateur Windows / le bureau).
// `onFiles(files)` reçoit les fichiers image déposés.
export function useFileDrop(onFiles) {
  const [over, setOver] = useState(false)
  const hasFiles = (e) => e.dataTransfer.types.includes('Files')
  return {
    over,
    handlers: {
      onDragOver: (e) => {
        if (!hasFiles(e)) return
        e.preventDefault(); e.stopPropagation(); setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        if (!hasFiles(e)) return
        e.preventDefault(); e.stopPropagation(); setOver(false)
        const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'))
        if (files.length) onFiles?.(files)
      },
    },
  }
}

// Combine les deux types de dépôt (photos internes + fichiers OS) sur une cible.
function useCombinedDrop(onMove, onFiles) {
  const photo = usePhotoDrop(onMove)
  const file = useFileDrop(onFiles)
  const active = !!(onMove || onFiles)
  return {
    over: photo.over || file.over,
    handlers: active ? {
      onDragOver: (e) => { photo.handlers.onDragOver(e); file.handlers.onDragOver(e) },
      onDragLeave: (e) => { photo.handlers.onDragLeave(e); file.handlers.onDragLeave(e) },
      onDrop: (e) => { photo.handlers.onDrop(e); file.handlers.onDrop(e) },
    } : {},
  }
}

// ---- Helpers hiérarchie -----------------------------------------------------

export function dossierChildren(dossiers, parentId) {
  return (dossiers || []).filter((d) => (d.parent_id || null) === (parentId || null))
}

export function dossierPath(dossiers, id) {
  const path = []
  let cur = (dossiers || []).find((d) => d.id === id)
  while (cur) {
    path.unshift(cur)
    cur = (dossiers || []).find((d) => d.id === cur.parent_id)
  }
  return path
}

// ---- Arborescence latérale --------------------------------------------------

function TreeNode({ ds, dossiers, depth, currentId, onNavigate, onMove, onFileDrop, pathIds }) {
  const kids = dossierChildren(dossiers, ds.id)
  const [open, setOpen] = useState(pathIds?.includes(ds.id) ?? depth === 0)
  const { over, handlers } = useCombinedDrop(
    onMove ? (ids) => onMove(ids, ds.id) : null,
    onFileDrop ? (files) => onFileDrop(files, ds.id) : null)
  const active = currentId === ds.id
  return (
    <Box>
      <HStack gap="0" pl={`${6 + depth * 14}px`} pr="2" py="1" cursor="pointer"
        bg={active ? C.softBlue : 'transparent'}
        boxShadow={over ? `inset 0 0 0 1.5px ${C.primary}` : 'none'}
        borderRadius="md"
        _hover={{ bg: C.softBlue }}
        onClick={() => onNavigate(ds.id)}
        {...handlers}
      >
        <Box as="button" w="14px" flexShrink={0} color="gray.400" fontSize="xs"
          visibility={kids.length ? 'visible' : 'hidden'}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}>
          {open ? <FiChevronDown /> : <FiChevronRight />}
        </Box>
        <Box as={FiFolder} flexShrink={0} fontSize="sm" mr="1.5"
          color={active ? C.primary : 'gray.400'} />
        <Text fontSize="xs" isTruncated fontWeight={active ? '700' : '400'}
          color={active ? C.primary : C.body}>{ds.name}</Text>
        {over && <Text ml="auto" fontSize="2xs" color={C.primary} flexShrink={0}>→ ici</Text>}
      </HStack>
      {open && kids.map((k) => (
        <TreeNode key={k.id} ds={k} dossiers={dossiers} depth={depth + 1}
          currentId={currentId} onNavigate={onNavigate} onMove={onMove}
          onFileDrop={onFileDrop} pathIds={pathIds} />
      ))}
    </Box>
  )
}

// Panneau latéral : « tous » + arbre des dossiers (dépliants, zones de dépôt).
export function DossierTree({ dossiers, currentId, onNavigate, onMove, onFileDrop, allLabel = 'Tous les dossiers', title = 'Dossiers' }) {
  const roots = dossierChildren(dossiers, null)
  const pathIds = dossierPath(dossiers, currentId).map((d) => d.id)
  const allActive = !currentId
  return (
    <Card p="0" w="230px" flexShrink={0} overflow="hidden" alignSelf="flex-start">
      <Box px="3" py="2" borderBottom="1px solid" borderColor={C.cardBorder}>
        <Text fontSize="2xs" fontWeight="700" color="gray.500" letterSpacing="0.06em">{title.toUpperCase()}</Text>
      </Box>
      <Box py="1" px="1" maxH="70vh" overflowY="auto">
        <HStack gap="0" pl="6px" pr="2" py="1" cursor="pointer" borderRadius="md"
          bg={allActive ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
          onClick={() => onNavigate(null)}>
          <Box w="14px" flexShrink={0} />
          <Box as={FiFolder} flexShrink={0} fontSize="sm" mr="1.5"
            color={allActive ? C.primary : 'gray.400'} />
          <Text fontSize="xs" isTruncated fontWeight={allActive ? '700' : '400'}
            color={allActive ? C.primary : C.body}>{allLabel}</Text>
        </HStack>
        {roots.map((d) => (
          <TreeNode key={d.id} ds={d} dossiers={dossiers} depth={0}
            currentId={currentId} onNavigate={onNavigate} onMove={onMove}
            onFileDrop={onFileDrop} pathIds={pathIds} />
        ))}
        {!roots.length && <Text fontSize="xs" color="gray.400" px="3" py="2">Aucun dossier.</Text>}
      </Box>
    </Card>
  )
}

// ---- Tuile dossier (façon icône de dossier Windows) -------------------------

export function FolderTile({ dossier, onOpen, onMove, onFileDrop }) {
  const { over, handlers } = useCombinedDrop(
    onMove ? (ids) => onMove(ids, dossier.id) : null,
    onFileDrop ? (files) => onFileDrop(files, dossier.id) : null)
  return (
    <Box as="button" textAlign="center" px="3" py="3" borderRadius="lg" w="110px"
      border="1.5px solid" borderColor={over ? C.primary : 'transparent'}
      bg={over ? C.softBlue : 'transparent'}
      _hover={{ bg: C.softBlue, borderColor: C.primary }}
      onClick={() => onOpen(dossier.id)}
      {...handlers}
    >
      <Box as={FiFolder} fontSize="34px" color={C.primary} mx="auto" />
      <Text fontSize="2xs" fontWeight="600" color={C.ink} mt="1" isTruncated>{dossier.name}</Text>
    </Box>
  )
}

// ---- Menu contextuel (clic droit) ------------------------------------------

// menu = { x, y } — items = [{ icon, label, onClick, danger }] ou '-' séparateur.
export function ContextMenu({ menu, onClose, items }) {
  useEffect(() => {
    if (!menu) return
    const close = () => onClose?.()
    const key = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', close)
    }
  }, [menu, onClose])
  if (!menu) return null
  const x = Math.min(menu.x, window.innerWidth - 230)
  const y = Math.min(menu.y, window.innerHeight - items.length * 34 - 16)
  return (
    <Box position="fixed" top={`${Math.max(8, y)}px`} left={`${Math.max(8, x)}px`} zIndex={80}
      bg="white" borderRadius="lg" boxShadow="xl" border="1px solid" borderColor={C.cardBorder}
      py="1" minW="210px" onPointerDown={(e) => e.stopPropagation()}>
      {items.map((item, i) => item === '-' ? (
        <Box key={i} my="1" borderTop="1px solid" borderColor={C.cardBorder} />
      ) : (
        <HStack key={i} as="button" w="100%" px="3" py="1.5" gap="2.5" textAlign="left"
          color={item.danger ? 'red.500' : C.body} _hover={{ bg: C.softBlue }}
          onClick={() => { item.onClick?.(); onClose?.() }}>
          {item.icon && <Box as={item.icon} fontSize="sm" color={item.danger ? 'red.400' : 'gray.500'} />}
          <Text fontSize="xs" fontWeight="500">{item.label}</Text>
        </HStack>
      ))}
    </Box>
  )
}

// ---- Fil d'Ariane -----------------------------------------------------------

export function FolderBreadcrumb({ dossiers, currentId, rootLabel = 'Dossiers', onNavigate }) {
  const path = dossierPath(dossiers, currentId)
  return (
    <HStack gap="1" fontSize="sm" flexWrap="wrap">
      <Box as="button" color={path.length ? C.primary : C.ink} fontWeight="600"
        _hover={{ textDecoration: 'underline' }} onClick={() => onNavigate(null)}>
        {rootLabel}
      </Box>
      {path.map((d, i) => {
        const last = i === path.length - 1
        return (
          <Fragment key={d.id}>
            <Box as={FiChevronRight} color="gray.300" fontSize="xs" />
            <Box as="button" fontWeight={last ? '700' : '500'} isTruncated maxW="200px"
              color={last ? C.ink : C.primary}
              _hover={last ? {} : { textDecoration: 'underline' }}
              onClick={() => !last && onNavigate(d.id)}>
              {d.name}
            </Box>
          </Fragment>
        )
      })}
    </HStack>
  )
}
