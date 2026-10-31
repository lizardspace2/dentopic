// Chrome du Studio : barre de menus, toolbar vertical, barre d'options,
// panneaux droits (Calques / Réglages / Infos), barre de statut.
// Thème sombre fixe (comme Photoshop) via C.dark* — indépendant du mode clair/sombre global.
import { useEffect, useRef, useState } from 'react'
import { Box, Center, Flex, HStack, Input, Text, VStack } from '@chakra-ui/react'
import {
  FiArrowDown, FiArrowUp, FiCopy, FiEye, FiEyeOff, FiLayers, FiPlus,
  FiRefreshCw, FiTrash2,
} from 'react-icons/fi'
import { LuRedo2, LuUndo2 } from 'react-icons/lu'
import { Tip } from '../../components/ui'
import { C } from '../../theme'
import { ADJUST_DEFS, PRESETS, SWATCHES, TOOLS } from './constants'

const D = C // alias lisibilité
const panelBg = D.darkCard
const panelBorder = D.darkBorder
const fg = D.darkFg
const muted = D.darkMuted

// ---- Barre de menus (Fichier / Édition / Image / Calque / Affichage) -----------

export function MenuBar({ menus, docName }) {
  const [open, setOpen] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null) }
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [])
  return (
    <HStack h="34px" px="3" gap="1" bg={panelBg} borderBottom="1px solid" borderColor={panelBorder}
      flexShrink={0} ref={ref} position="relative" zIndex="30">
      <Text fontSize="xs" fontWeight="700" color={fg} mr="2">DentoPic Studio</Text>
      {menus.map((m) => (
        <Box key={m.label} position="relative">
          <Box
            px="2.5" py="1" fontSize="xs" borderRadius="md" cursor="pointer"
            color={open === m.label ? '#ffffff' : muted}
            bg={open === m.label ? 'whiteAlpha.100' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.100', color: '#ffffff' }}
            onClick={() => setOpen(open === m.label ? null : m.label)}
            onMouseEnter={() => open && setOpen(m.label)}
          >
            {m.label}
          </Box>
          {open === m.label && (
            <VStack
              position="absolute" top="100%" left="0" mt="1" align="stretch" gap="0"
              bg="#1c2433" border="1px solid" borderColor={panelBorder} borderRadius="md"
              minW="200px" py="1" boxShadow="lg" zIndex="40"
            >
              {m.items.filter(Boolean).map((it, i) => it === '-' ? (
                <Box key={i} h="1px" bg={panelBorder} my="1" />
              ) : (
                <HStack key={i} px="3" py="1.5" gap="2" fontSize="xs" cursor="pointer"
                  color={it.disabled ? muted : fg}
                  _hover={{ bg: it.disabled ? 'transparent' : 'whiteAlpha.100' }}
                  onClick={() => { if (!it.disabled) { it.onClick?.(); setOpen(null) } }}>
                  <Box flex="1">{it.label}</Box>
                  {it.shortcut && <Text fontSize="2xs" color={muted}>{it.shortcut}</Text>}
                </HStack>
              ))}
            </VStack>
          )}
        </Box>
      ))}
      <Box flex="1" />
      <Text fontSize="2xs" color={muted} isTruncated maxW="260px">{docName}</Text>
    </HStack>
  )
}

// ---- Barre d'outils verticale -------------------------------------------------

export function ToolBar({ tool, setTool, fgColor, setFgColor, bgColor, setBgColor, onSwap }) {
  return (
    <VStack w="44px" py="2" gap="1" bg={panelBg} borderRight="1px solid" borderColor={panelBorder} flexShrink={0}>
      {TOOLS.map((t) => (
        <Tip key={t.key} label={`${t.label} — ${t.hint}`}>
          <Center
            w="32px" h="32px" borderRadius="md" cursor="pointer" fontSize="15px"
            color={tool === t.key ? '#ffffff' : muted}
            bg={tool === t.key ? C.primary : 'transparent'}
            _hover={{ color: '#ffffff', bg: tool === t.key ? C.primary : 'whiteAlpha.100' }}
            onClick={() => setTool(t.key)}
          >
            <Box as={t.icon} />
          </Center>
        </Tip>
      ))}
      <Box flex="1" />
      {/* Premier plan / arrière-plan + swap (comme Photoshop) */}
      <Tip label="Premier plan — clic pour changer · X permute">
        <Box position="relative" w="26px" h="26px">
          <Box
            w="20px" h="20px" borderRadius="sm" border="1.5px solid" borderColor="white"
            bg={fgColor} position="absolute" top="0" left="0" zIndex="2"
          />
          <Box w="20px" h="20px" borderRadius="sm" border="1.5px solid" borderColor="gray.500"
            bg={bgColor} position="absolute" bottom="0" right="0" />
          <Input
            type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)}
            position="absolute" top="0" left="0" opacity="0" cursor="pointer" w="20px" h="20px" zIndex="3"
          />
          <Input
            type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
            position="absolute" bottom="0" right="0" opacity="0" cursor="pointer" w="20px" h="20px" zIndex="3"
          />
        </Box>
      </Tip>
      <Tip label="Permuter premier plan / arrière-plan — X">
        <Center w="26px" h="20px" cursor="pointer" color={muted} fontSize="12px"
          _hover={{ color: '#ffffff' }} onClick={onSwap}>
          <Box as={FiRefreshCw} />
        </Center>
      </Tip>
      <Box h="1" />
    </VStack>
  )
}

// ---- Barre d'options (options de l'outil courant) -------------------------------

export function OptionsBar({
  tool, opts, setOpts, cropRect, onApplyCrop, onCancelCrop, onRotate,
  hasSel, onFill, onDelete, onDeselect, canUndo, canRedo, onUndo, onRedo,
}) {
  const row = { fontSize: '2xs', color: muted }
  const slider = (key, min, max, step = 1) => (
    <Input type="range" min={min} max={max} step={step} w="110px" h="18px"
      value={opts[key]} onChange={(e) => setOpts({ ...opts, [key]: +e.target.value })} />
  )
  const btn = (label, onClick, primary) => (
    <Box as="button" px="2" py="0.5" fontSize="2xs" borderRadius="sm" cursor="pointer"
      bg={primary ? C.primary : 'whiteAlpha.100'} color="#ffffff" onClick={onClick}>
      {label}
    </Box>
  )
  return (
    <HStack h="34px" px="3" gap="4" bg={panelBg} borderBottom="1px solid" borderColor={panelBorder} flexShrink={0}>
      <Text fontSize="xs" color={fg} fontWeight="600">
        {TOOLS.find((t) => t.key === tool)?.label}
      </Text>
      {tool === 'brush' && (
        <>
          <Text {...row}>Taille {opts.brushSize}px</Text>{slider('brushSize', 1, 80)}
          <Text {...row}>Opacité {Math.round(opts.brushOpacity * 100)}%</Text>{slider('brushOpacity', 0.05, 1, 0.05)}
          <SwatchPicker value={opts.fg} onChange={(v) => setOpts({ ...opts, fg: v })} />
        </>
      )}
      {tool === 'eraser' && (
        <>
          <Text {...row}>Taille {opts.eraserSize}px</Text>{slider('eraserSize', 2, 120)}
        </>
      )}
      {tool === 'text' && (
        <>
          <Text {...row}>Taille</Text>
          <Input type="number" w="60px" h="20px" fontSize="2xs" value={opts.textSize}
            onChange={(e) => setOpts({ ...opts, textSize: +e.target.value || 24 })} />
          <SwatchPicker value={opts.fg} onChange={(v) => setOpts({ ...opts, fg: v })} />
        </>
      )}
      {tool === 'crop' && cropRect && (
        <>{btn('Valider le recadrage', onApplyCrop, true)}{btn('Annuler', onCancelCrop)}</>
      )}
      {tool === 'rect' && hasSel && (
        <>{btn('Remplir', onFill)}{btn('Effacer', onDelete)}{btn('Désélectionner', onDeselect, true)}</>
      )}
      {tool === 'rotate' && <>{btn('Pivoter 90°', onRotate, true)}</>}
      {['move', 'hand', 'zoom', 'picker', 'rect'].includes(tool) && !(tool === 'rect' && hasSel) && (
        <Text {...row}>
          {{ move: 'Glisser déplace le calque actif', hand: 'Glisser déplace la vue',
            zoom: 'Cliquer pour zoomer (Alt = dézoomer)', picker: 'Cliquer pour prélever la couleur',
            rect: 'Trace une zone de sélection' }[tool]}
        </Text>
      )}
      <Box flex="1" />
      <Tip label="Annuler — Ctrl+Z">
        <Center w="24px" h="24px" borderRadius="sm" cursor={canUndo ? 'pointer' : 'default'}
          color={canUndo ? fg : 'whiteAlpha.200'} fontSize="14px"
          _hover={canUndo ? { bg: 'whiteAlpha.100' } : undefined} onClick={canUndo ? onUndo : undefined}>
          <Box as={LuUndo2} />
        </Center>
      </Tip>
      <Tip label="Rétablir — Ctrl+Y">
        <Center w="24px" h="24px" borderRadius="sm" cursor={canRedo ? 'pointer' : 'default'}
          color={canRedo ? fg : 'whiteAlpha.200'} fontSize="14px"
          _hover={canRedo ? { bg: 'whiteAlpha.100' } : undefined} onClick={canRedo ? onRedo : undefined}>
          <Box as={LuRedo2} />
        </Center>
      </Tip>
    </HStack>
  )
}

function SwatchPicker({ value, onChange }) {
  return (
    <HStack gap="1">
      {SWATCHES.map((c) => (
        <Box key={c} w="14px" h="14px" borderRadius="sm" cursor="pointer" bg={c}
          border="1.5px solid" borderColor={value === c ? '#ffffff' : 'transparent'}
          onClick={() => onChange(c)} />
      ))}
    </HStack>
  )
}

// ---- Panneau droit : Calques ----------------------------------------------------

export function LayersPanel({ editor, version, onChange }) {
  const layers = [...editor.layers].reverse()
  return (
    <VStack align="stretch" gap="0" flex="1" overflowY="auto">
      {/* Calque de réglage global */}
      <HStack px="2.5" py="1.5" gap="2" fontSize="xs" color={fg}
        borderBottom="1px solid" borderColor={panelBorder}>
        <Box as={editor.adjustVisible ? FiEye : FiEyeOff} color={muted} cursor="pointer" fontSize="13px"
          onClick={() => { editor.adjustVisible = !editor.adjustVisible; onChange() }} />
        <Box as={FiLayers} color={C.primary} fontSize="13px" />
        <Text flex="1" fontSize="xs">Réglages (filtres)</Text>
      </HStack>
      {layers.map((l) => (
        <HStack
          key={l.id} px="2.5" py="1.5" gap="2" fontSize="xs" cursor="pointer"
          bg={editor.activeId === l.id ? 'whiteAlpha.100' : 'transparent'}
          borderBottom="1px solid" borderColor="whiteAlpha.50"
          color={l.visible ? fg : muted}
          onClick={() => { editor.setActive(l.id); onChange() }}
        >
          <Box as={l.visible ? FiEye : FiEyeOff} color={muted} fontSize="13px" flexShrink={0}
            onClick={(e) => { e.stopPropagation(); editor.toggleVisible(l.id); onChange() }} />
          <Text flex="1" isTruncated>{l.name}</Text>
          {editor.activeId === l.id && !l.locked && (
            <HStack gap="0.5" flexShrink={0}>
              <Box as={FiArrowUp} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: fg }}
                onClick={(e) => { e.stopPropagation(); editor.moveLayer(l.id, 1); onChange() }} />
              <Box as={FiArrowDown} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: fg }}
                onClick={(e) => { e.stopPropagation(); editor.moveLayer(l.id, -1); onChange() }} />
              <Box as={FiCopy} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: fg }}
                onClick={(e) => { e.stopPropagation(); editor.snapshot(); editor.duplicateLayer(l.id); onChange() }} />
              <Box as={FiTrash2} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: '#f87171' }}
                onClick={(e) => { e.stopPropagation(); editor.snapshot(); editor.removeLayer(l.id); onChange() }} />
            </HStack>
          )}
        </HStack>
      ))}
      <HStack px="2.5" py="2" gap="2" mt="auto" borderTop="1px solid" borderColor={panelBorder}>
        <HStack flex="1" gap="1.5" cursor="pointer" color={C.primary} fontSize="xs"
          onClick={() => { editor.snapshot(); editor.addLayer(); onChange() }}>
          <FiPlus /> <Text>Nouveau calque</Text>
        </HStack>
        {editor.active && (
          <HStack gap="1.5" flex="1">
            <Text fontSize="2xs" color={muted}>Opacité</Text>
            <Input type="range" min="0" max="1" step="0.05" h="16px" flex="1"
              value={editor.active.opacity}
              onPointerDown={() => editor.snapshot()}
              onChange={(e) => { editor.active.opacity = +e.target.value; onChange() }} />
          </HStack>
        )}
      </HStack>
    </VStack>
  )
}

// ---- Panneau droit : Réglages (sliders → filtres) --------------------------------

export function AdjustPanel({ editor, onChange }) {
  return (
    <VStack align="stretch" gap="3" px="3" py="3" flex="1" overflowY="auto">
      <HStack gap="1.5" flexWrap="wrap">
        {PRESETS.map((p) => (
          <Box key={p.name} as="button" px="2" py="0.5" fontSize="2xs" borderRadius="sm"
            bg="whiteAlpha.100" color={fg} cursor="pointer" _hover={{ bg: 'whiteAlpha.200' }}
            onClick={() => { editor.snapshot(); editor.adjust = { ...editor.adjust, ...p.adjust }; onChange() }}>
            {p.name}
          </Box>
        ))}
        <Box as="button" px="2" py="0.5" fontSize="2xs" borderRadius="sm" ml="auto"
          bg="whiteAlpha.100" color={muted} cursor="pointer" _hover={{ bg: 'whiteAlpha.200' }}
          onClick={() => { editor.snapshot(); editor.resetAdjust?.(); onChange() }}>
          Reset
        </Box>
      </HStack>
      {ADJUST_DEFS.map((d) => (
        <Box key={d.key}>
          <HStack justify="space-between" mb="0.5">
            <Text fontSize="2xs" color={muted}>{d.label}</Text>
            <Text fontSize="2xs" color={fg}>{editor.adjust[d.key]}{d.unit}</Text>
          </HStack>
          <Input type="range" min={d.min} max={d.max} step={d.step || 1} h="18px"
            value={editor.adjust[d.key]}
            onChange={(e) => { editor.adjust[d.key] = +e.target.value; onChange() }}
            onPointerDown={() => editor.snapshot()} />
        </Box>
      ))}
    </VStack>
  )
}

// ---- Panneau droit : Infos --------------------------------------------------------

export function InfoPanel({ editor, zoom, cursor }) {
  return (
    <VStack align="stretch" gap="2" px="3" py="3" fontSize="2xs" color={muted}>
      <InfoRow k="Document" v={editor.docName} />
      <InfoRow k="Dimensions" v={editor.w ? `${editor.w} × ${editor.h} px` : '—'} />
      <InfoRow k="Zoom" v={`${Math.round(zoom * 100)} %`} />
      <InfoRow k="Calques" v={editor.layers.length} />
      {cursor && (
        <HStack gap="2">
          <Box w="16px" h="16px" borderRadius="sm" bg={cursor.color} border="1px solid" borderColor="gray.500" />
          <Text>{cursor.color}</Text>
          <Text>({cursor.x}, {cursor.y})</Text>
        </HStack>
      )}
    </VStack>
  )
}

function InfoRow({ k, v }) {
  return (
    <HStack justify="space-between">
      <Text>{k}</Text><Text color={fg}>{v}</Text>
    </HStack>
  )
}

// ---- Barre de statut basse ---------------------------------------------------------

export function StatusBar({ editor, zoom, tool }) {
  const t = TOOLS.find((x) => x.key === tool)
  return (
    <HStack h="24px" px="3" gap="4" bg={panelBg} borderTop="1px solid" borderColor={panelBorder}
      fontSize="2xs" color={muted} flexShrink={0}>
      <Text>{Math.round(zoom * 100)} %</Text>
      <Text>{t?.label}</Text>
      <Text>{editor.w ? `${editor.w} × ${editor.h} px` : ''}</Text>
      <Box flex="1" />
      <Text isTruncated maxW="280px">{editor.docName}</Text>
    </HStack>
  )
}

// ---- Panneau latéral à onglets -------------------------------------------------------

export function RightPanel({ editor, version, zoom, cursor, onChange }) {
  const [tab, setTab] = useState('layers')
  const TABS = [['layers', 'Calques'], ['adjust', 'Réglages'], ['info', 'Infos']]
  return (
    <Flex w="248px" direction="column" bg={panelBg} borderLeft="1px solid" borderColor={panelBorder} flexShrink={0}>
      <HStack px="2" pt="2" pb="0" gap="1" borderBottom="1px solid" borderColor={panelBorder}>
        {TABS.map(([k, l]) => (
          <Box key={k} px="2.5" py="1.5" fontSize="xs" cursor="pointer" borderRadius="md md 0 0"
            color={tab === k ? fg : muted} fontWeight={tab === k ? '600' : '400'}
            bg={tab === k ? 'whiteAlpha.100' : 'transparent'}
            onClick={() => setTab(k)}>
            {l}
          </Box>
        ))}
      </HStack>
      <Flex flex="1" direction="column" overflow="hidden">
        {tab === 'layers' && <LayersPanel editor={editor} version={version} onChange={onChange} />}
        {tab === 'adjust' && <AdjustPanel editor={editor} onChange={onChange} />}
        {tab === 'info' && <InfoPanel editor={editor} zoom={zoom} cursor={cursor} />}
      </Flex>
    </Flex>
  )
}

// ---- Zone centrale vide (pas de document ouvert) -------------------------------------

export function EmptyCanvas({ onOpen, onPick }) {
  return (
    <Center flex="1" color={muted}>
      <VStack gap="3">
        <Center w="64px" h="64px" borderRadius="xl" bg={panelBg} border="1px solid" borderColor={panelBorder}
          fontSize="26px" color={muted}>
          <Box as={FiLayers} />
        </Center>
        <Text fontSize="sm" fontWeight="600" color={fg}>Aucun document ouvert</Text>
        <Text fontSize="xs" color={muted}>Ouvrez une photo du workspace ou un fichier local</Text>
        <HStack gap="2" mt="1">
          <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" bg={C.primary} color="#ffffff"
            cursor="pointer" onClick={onPick}>
            Choisir une photo
          </Box>
          <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" bg="whiteAlpha.100" color={fg}
            cursor="pointer" onClick={onOpen}>
            Importer un fichier…
          </Box>
        </HStack>
      </VStack>
    </Center>
  )
}
