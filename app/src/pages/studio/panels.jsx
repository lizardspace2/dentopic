// Chrome du Studio : barre de menus, toolbar vertical, barre d'options,
// panneaux droits (Calques / Réglages / Infos), barre de statut.
// Thème sombre fixe (comme Photoshop) via C.dark* — indépendant du mode clair/sombre global.
import { useEffect, useRef, useState } from 'react'
import { Box, Center, Flex, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiArrowDown, FiArrowUp, FiCopy, FiEye, FiEyeOff, FiLayers, FiPlus,
  FiRefreshCw, FiTrash2,
} from 'react-icons/fi'
import { LuContrast, LuHistory, LuRedo2, LuUndo2 } from 'react-icons/lu'
import { TbMask } from 'react-icons/tb'
import { Tip } from '../../components/ui'
import { C } from '../../theme'
import { ADJUST_GROUPS, BLEND_MODES, CURVE_CHANNELS, PRESETS, SWATCHES, TOOLS, VITA_SHADES } from './constants'
import { curveLUT, histogram } from './engine'

const D = C // alias lisibilité
const panelBg = D.darkCard
const panelBorder = D.darkBorder
const fg = D.darkFg
const muted = D.darkMuted

// Familles de police de l'outil Texte (panneau Caractère)
const TEXT_FONTS = ['Inter Tight', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']

// Noms lisibles des effets fx (liste dépliable sous le calque)
const FX_NAMES = {
  shadow: 'Ombre portée', innerShadow: 'Ombre interne', glow: 'Lueur externe',
  innerGlow: 'Lueur interne', bevel: 'Biseautage', satin: 'Satin',
  colorOverlay: 'Incrustation couleur', gradientOverlay: 'Incrustation dégradé',
  stroke: 'Contour',
}

// ---- Barre de menus (Fichier / Édition / Image / Calque / Affichage) -----------

export function MenuBar({ menus, docName, zoom }) {
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
          <Tip label={m.tip || `Menu ${m.label}`}>
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
          </Tip>
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
      <Tip label="Document ouvert — nom @ zoom">
        <Text fontSize="2xs" color={muted} isTruncated maxW="300px">
          {docName}{docName && zoom != null ? ` @ ${Math.round(zoom * 1000) / 10} %` : ''}
        </Text>
      </Tip>
    </HStack>
  )
}

// ---- Barre d'outils verticale -------------------------------------------------

export function ToolBar({ tool, setTool, fgColor, bgColor, onSwap, onPickColor }) {
  return (
    <Flex w="78px" direction="column" py="2" px="1" gap="1"
      bg={panelBg} borderRight="1px solid" borderColor={panelBorder} flexShrink={0} overflowY="auto">
      {/* 2 colonnes façon Photoshop — toutes les icônes tiennent sans scroll */}
      <SimpleGrid columns={2} gap="1" justifyItems="center">
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
      </SimpleGrid>
      <Box flex="1" />
      {/* Premier plan / arrière-plan + swap — clic = sélecteur détaillé */}
      <HStack justify="center" gap="2">
        <Tip label="Premier plan — clic : sélecteur de couleurs détaillé · X permute">
          <Box position="relative" w="26px" h="26px">
            <Box
              w="20px" h="20px" borderRadius="sm" border="1.5px solid" borderColor="white"
              bg={fgColor} position="absolute" top="0" left="0" zIndex="2" cursor="pointer"
              onClick={() => onPickColor?.('fg')}
            />
            <Box w="20px" h="20px" borderRadius="sm" border="1.5px solid" borderColor="gray.500"
              bg={bgColor} position="absolute" bottom="0" right="0" cursor="pointer"
              onClick={() => onPickColor?.('bg')} />
          </Box>
        </Tip>
        <Tip label="Permuter premier plan / arrière-plan — X">
          <Center w="22px" h="20px" cursor="pointer" color={muted} fontSize="12px"
            _hover={{ color: '#ffffff' }} onClick={onSwap}>
            <Box as={FiRefreshCw} />
          </Center>
        </Tip>
      </HStack>
      <Box h="1" />
    </Flex>
  )
}

// ---- Barre d'options (options de l'outil courant) -------------------------------

export function OptionsBar({
  tool, opts, setOpts, cropRect, onApplyCrop, onCancelCrop, onRotate,
  hasSel, onFill, onDelete, onDeselect, canUndo, canRedo, onUndo, onRedo, onPickColor,
}) {
  const row = { fontSize: '2xs', color: muted }
  // slider + saisie numérique exacte (comme les champs de valeur de Photoshop)
  const clampN = (v, min, max) => Math.min(max, Math.max(min, v))
  // scale=100 : le champ affiche des pourcentages (0-100) comme Photoshop, opts stocke 0-1
  const slider = (key, min, max, step = 1, scale = 1) => (
    <HStack gap="1">
      <Input type="range" min={min} max={max} step={step} w="100px" h="18px"
        value={opts[key]} onChange={(e) => setOpts({ ...opts, [key]: +e.target.value })} />
      <Input type="number" min={min * scale} max={max * scale} step={step * scale || 1} w="50px" h="18px" fontSize="2xs" px="1"
        value={Math.round(opts[key] * scale * 100) / 100}
        onChange={(e) => { const v = +e.target.value / scale; if (!isNaN(v)) setOpts({ ...opts, [key]: clampN(v, min, max) }) }} />
    </HStack>
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
          <Tip label="Diamètre du pinceau (px) — saisie libre"><Text {...row}>Taille {opts.brushSize}px</Text></Tip>{slider('brushSize', 1, 400)}
          <Tip label="Dureté du bord — 100 % = net, 0 % = très diffus"><Text {...row}>Dureté {Math.round((opts.brushHard ?? 1) * 100)}%</Text></Tip>{slider('brushHard', 0, 1, 0.05, 100)}
          <Tip label="Transparence du trait"><Text {...row}>Opacité {Math.round(opts.brushOpacity * 100)}%</Text></Tip>{slider('brushOpacity', 0.05, 1, 0.05, 100)}
          <Tip label="Couleur du trait — « + » : sélecteur détaillé"><SwatchPicker value={opts.fg} onChange={(v) => setOpts({ ...opts, fg: v })} onCustom={() => onPickColor?.('fg')} /></Tip>
        </>
      )}
      {tool === 'pencil' && (
        <>
          <Tip label="Diamètre du crayon (px) — trait à bord franc"><Text {...row}>Taille {opts.pencilSize}px</Text></Tip>{slider('pencilSize', 1, 200)}
          <Tip label="Transparence du trait"><Text {...row}>Opacité {Math.round((opts.pencilOpacity ?? 1) * 100)}%</Text></Tip>{slider('pencilOpacity', 0.05, 1, 0.05, 100)}
          <Tip label="Couleur du trait — « + » : sélecteur détaillé"><SwatchPicker value={opts.fg} onChange={(v) => setOpts({ ...opts, fg: v })} onCustom={() => onPickColor?.('fg')} /></Tip>
        </>
      )}
      {tool === 'heal' && (
        <>
          <Tip label="Diamètre du correcteur"><Text {...row}>Taille {opts.healSize}px</Text></Tip>{slider('healSize', 8, 300)}
          <Tip label="Rayon d'estompage — plus grand = fondu plus large"><Text {...row}>Fondu {opts.healRadius}px</Text></Tip>{slider('healRadius', 1, 60)}
          <Text {...row}>Peignez sur les défauts — la zone est estompée</Text>
        </>
      )}
      {tool === 'tone' && (
        <>
          <Tip label="Mode : éclaircit, assombrit ou (dés)sature sous le pinceau">
            <Box as="select" fontSize="2xs" bg="#1c2433" color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.toneMode} onChange={(e) => setOpts({ ...opts, toneMode: e.target.value })}>
              <option value="dodge">Éclaircir</option>
              <option value="burn">Assombrir</option>
              <option value="desat">Désaturer</option>
              <option value="sat">Saturer</option>
            </Box>
          </Tip>
          <Tip label="Diamètre"><Text {...row}>Taille {opts.toneSize}px</Text></Tip>{slider('toneSize', 4, 300)}
          <Tip label="Force de l'effet"><Text {...row}>Force {Math.round((opts.toneStrength ?? 0.3) * 100)}%</Text></Tip>{slider('toneStrength', 0.05, 1, 0.05, 100)}
        </>
      )}
      {tool === 'blurTool' && (
        <>
          <Tip label="Diamètre du pinceau flou"><Text {...row}>Taille {opts.blurSize}px</Text></Tip>{slider('blurSize', 8, 300)}
          <Tip label="Rayon du flou appliqué"><Text {...row}>Rayon {opts.blurRadius}px</Text></Tip>{slider('blurRadius', 1, 40)}
        </>
      )}
      {tool === 'sharpenTool' && (
        <>
          <Tip label="Diamètre"><Text {...row}>Taille {opts.sharpenSize}px</Text></Tip>{slider('sharpenSize', 8, 300)}
          <Tip label="Gain d'accentuation"><Text {...row}>Gain {opts.sharpenAmount}%</Text></Tip>{slider('sharpenAmount', 10, 200, 5)}
        </>
      )}
      {tool === 'smudge' && (
        <>
          <Tip label="Diamètre du doigt"><Text {...row}>Taille {opts.smudgeSize}px</Text></Tip>{slider('smudgeSize', 4, 300)}
          <Tip label="Force de l'étalement"><Text {...row}>Force {Math.round((opts.smudgeStrength ?? 0.85) * 100)}%</Text></Tip>{slider('smudgeStrength', 0.3, 1, 0.05, 100)}
        </>
      )}
      {tool === 'redeye' && (
        <>
          <Tip label="Diamètre de correction"><Text {...row}>Taille {opts.redeyeSize}px</Text></Tip>{slider('redeyeSize', 6, 200)}
          <Text {...row}>Peignez sur la pupille — le rouge est neutralisé</Text>
        </>
      )}
      {tool === 'shape' && (
        <>
          <Tip label="Forme à tracer">
            <Box as="select" fontSize="2xs" bg="#1c2433" color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.shapeKind} onChange={(e) => setOpts({ ...opts, shapeKind: e.target.value })}>
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="triangle">Triangle</option>
              <option value="line">Ligne</option>
            </Box>
          </Tip>
          <Tip label="Contour (couleur d'arrière-plan)">
            <HStack gap="1">
              <Box w="12px" h="12px" borderRadius="sm" border="1px solid" cursor="pointer"
                borderColor={opts.shapeStrokeOn ? '#4f8fe8' : 'gray.500'}
                bg={opts.shapeStrokeOn ? '#4f8fe8' : 'transparent'} color="#ffffff"
                fontSize="2xs" lineHeight="12px" textAlign="center"
                onClick={() => setOpts({ ...opts, shapeStrokeOn: !opts.shapeStrokeOn })}>
                {opts.shapeStrokeOn ? '✓' : ''}
              </Box>
              <Text {...row}>Contour</Text>
            </HStack>
          </Tip>
          {opts.shapeStrokeOn && <>{slider('shapeStroke', 1, 60)}</>}
          <Text {...row}>Remplissage = 1er plan · glisser trace la forme</Text>
        </>
      )}
      {tool === 'eraser' && (
        <>
          <Tip label="Diamètre de la gomme (px) — saisie libre"><Text {...row}>Taille {opts.eraserSize}px</Text></Tip>{slider('eraserSize', 2, 500)}
          <Tip label="Dureté du bord de la gomme"><Text {...row}>Dureté {Math.round((opts.eraserHard ?? 1) * 100)}%</Text></Tip>{slider('eraserHard', 0, 1, 0.05, 100)}
          <Tip label="Opacité de gommage"><Text {...row}>Opacité {Math.round((opts.eraserOpacity ?? 1) * 100)}%</Text></Tip>{slider('eraserOpacity', 0.05, 1, 0.05, 100)}
        </>
      )}
      {tool === 'clone' && (
        <>
          <Tip label="Alt+clic sur la zone à dupliquer, puis peignez"><Text {...row}>Taille {opts.cloneSize}px</Text></Tip>{slider('cloneSize', 8, 500)}
          <Tip label="Transparence de la copie"><Text {...row}>Opacité {Math.round((opts.cloneOpacity ?? 1) * 100)}%</Text></Tip>{slider('cloneOpacity', 0.1, 1, 0.05, 100)}
          <Text {...row}>Alt+clic = source · glisser = dupliquer</Text>
        </>
      )}
      {tool === 'bucket' && (
        <>
          <Tip label="Écart de couleur accepté"><Text {...row}>Tolérance {opts.tol}</Text></Tip>{slider('tol', 4, 120)}
          <Text {...row}>Cliquer → remplit la zone avec le premier plan</Text>
        </>
      )}
      {tool === 'text' && (
        <>
          <Tip label="Police du calque texte">
            <Box as="select" fontSize="2xs" bg="#1c2433" color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.textFont} onChange={(e) => setOpts({ ...opts, textFont: e.target.value })}>
              {TEXT_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Box>
          </Tip>
          <Tip label="Corps du texte"><Text {...row}>Taille</Text></Tip>
          <Input type="number" w="52px" h="20px" fontSize="2xs" value={opts.textSize}
            onChange={(e) => setOpts({ ...opts, textSize: +e.target.value || 24 })} />
          <Tip label="Gras">
            <Box as="button" px="1.5" h="20px" fontSize="2xs" fontWeight="800" borderRadius="sm" cursor="pointer"
              bg={opts.textBold ? C.primary : 'whiteAlpha.100'} color="#ffffff"
              onClick={() => setOpts({ ...opts, textBold: !opts.textBold })}>B</Box>
          </Tip>
          <Tip label="Italique">
            <Box as="button" px="1.5" h="20px" fontSize="2xs" fontStyle="italic" borderRadius="sm" cursor="pointer"
              bg={opts.textItalic ? C.primary : 'whiteAlpha.100'} color="#ffffff"
              onClick={() => setOpts({ ...opts, textItalic: !opts.textItalic })}>I</Box>
          </Tip>
          <Tip label="Interlettrage (px entre caractères)"><Text {...row}>Crénage</Text></Tip>
          <Input type="number" w="46px" h="20px" fontSize="2xs" value={opts.textTracking}
            onChange={(e) => setOpts({ ...opts, textTracking: +e.target.value || 0 })} />
          <Tip label="Couleur du texte — « + » : sélecteur détaillé"><SwatchPicker value={opts.fg} onChange={(v) => setOpts({ ...opts, fg: v })} onCustom={() => onPickColor?.('fg')} /></Tip>
        </>
      )}
      {tool === 'crop' && cropRect && (
        <>
          <Tip label="Appliquer le recadrage — Entrée">{btn('Valider le recadrage', onApplyCrop, true)}</Tip>
          <Tip label="Abandonner — Échap">{btn('Annuler', onCancelCrop)}</Tip>
        </>
      )}
      {hasSel && (
        <>
          <Tip label="Remplit la sélection avec la couleur de premier plan">{btn('Remplir', onFill)}</Tip>
          <Tip label="Vide le contenu de la sélection — Suppr">{btn('Effacer', onDelete)}</Tip>
          <Tip label="Désélectionner — Ctrl+D">{btn('Désélectionner', onDeselect, true)}</Tip>
        </>
      )}
      {tool === 'rotate' && (
        <Tip label="Rotation d'un quart de tour du document">{btn('Pivoter 90°', onRotate, true)}</Tip>
      )}
      {tool === 'move' && (
        <>
          <Tip label="Affiche les poignées pour redimensionner le calque">
            <HStack gap="1.5" cursor="pointer" onClick={() => setOpts({ ...opts, transform: !opts.transform })}>
              <Box w="12px" h="12px" borderRadius="sm" border="1px solid"
                borderColor={opts.transform ? '#4f8fe8' : 'gray.500'}
                bg={opts.transform ? '#4f8fe8' : 'transparent'}
                color="#ffffff" fontSize="2xs" lineHeight="12px" textAlign="center">
                {opts.transform ? '✓' : ''}
              </Box>
              <Text {...row}>Poignées de transformation</Text>
            </HStack>
          </Tip>
          <Text {...row}>Glisser déplace le calque · coin = redimensionner</Text>
        </>
      )}
      {tool === 'wand' && (
        <>
          <Tip label="Écart de couleur accepté — plus grand = zone plus large"><Text {...row}>Tolérance {opts.tol}</Text></Tip>{slider('tol', 4, 120)}
          <Text {...row}>Cliquer une couleur → sélection de la zone</Text>
        </>
      )}
      {tool === 'rect' && !hasSel && (
        <>
          <Tip label="Forme du cadre de sélection">
            <Box as="select" fontSize="2xs" bg="#1c2433" color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.selShape} onChange={(e) => setOpts({ ...opts, selShape: e.target.value })}>
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
            </Box>
          </Tip>
          <Text {...row}>Trace une zone de sélection</Text>
        </>
      )}
      {['hand', 'zoom', 'picker', 'lasso', 'plasso', 'gradient'].includes(tool) && !hasSel && (
        <Text {...row}>
          {{ hand: 'Glisser déplace la vue',
            zoom: 'Cliquer pour zoomer (Alt = dézoomer)', picker: 'Cliquer pour prélever la couleur',
            lasso: 'Trace une sélection à main levée — relâcher ferme la forme',
            plasso: 'Clic = sommet · double-clic ou Entrée = fermer la sélection',
            gradient: 'Glissez pour tirer un dégradé 1er plan → arrière-plan' }[tool]}
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

function SwatchPicker({ value, onChange, onCustom }) {
  const custom = !SWATCHES.includes(value)
  return (
    <HStack gap="1">
      {SWATCHES.map((c) => (
        <Box key={c} w="14px" h="14px" borderRadius="sm" cursor="pointer" bg={c}
          border="1.5px solid" borderColor={value === c ? '#ffffff' : 'transparent'}
          onClick={() => onChange(c)} />
      ))}
      {/* couleur personnalisée : la puce « + » ouvre le sélecteur détaillé ;
          si la couleur courante est hors palette, elle s'affiche à sa place */}
      <Box
        w="14px" h="14px" borderRadius="sm" cursor="pointer"
        bg={custom ? value : 'transparent'} color={custom ? 'transparent' : '#ffffff'}
        border="1.5px solid" borderColor={custom ? '#ffffff' : 'gray.500'}
        fontSize="11px" lineHeight="12px" textAlign="center" fontWeight="700"
        onClick={onCustom}>
        {custom ? '' : '+'}
      </Box>
    </HStack>
  )
}

// ---- Panneau droit : Calques ----------------------------------------------------

export function LayersPanel({ editor, version, onChange, onFx, onAdjust }) {
  const layers = [...editor.layers].reverse()
  const fxList = (l) => l.fx ? Object.entries(l.fx).filter(([, f]) => f?.on).map(([k]) => FX_NAMES[k] || k) : []
  return (
    <VStack align="stretch" gap="0" flex="1" overflowY="auto">
      {/* Calque de réglage global */}
      <HStack px="2.5" py="1.5" gap="2" fontSize="xs" color={fg}
        borderBottom="1px solid" borderColor={panelBorder}>
        <Tip label="Afficher / masquer les réglages globaux">
          <Box as={editor.adjustVisible ? FiEye : FiEyeOff} color={muted} cursor="pointer" fontSize="13px"
            onClick={() => { editor.adjustVisible = !editor.adjustVisible; onChange() }} />
        </Tip>
        <Box as={FiLayers} color={C.primary} fontSize="13px" />
        <Tip label="Réglages, courbes et balance des blancs appliqués à l'image" flex="1">
          <Text flex="1" fontSize="xs">Réglages (filtres)</Text>
        </Tip>
      </HStack>
      {layers.map((l) => {
        const fxs = fxList(l)
        const isAdjust = l.type === 'adjust'
        return (
          <Box key={l.id}>
            <HStack
              px="2" py="1.5" gap="2" fontSize="xs" cursor="pointer"
              bg={editor.activeId === l.id ? 'whiteAlpha.100' : 'transparent'}
              color={l.visible ? fg : muted}
              onClick={() => {
                editor.setActive(l.id)
                onChange()
                if (isAdjust) onAdjust?.(l)
              }}
            >
              <Tip label={l.visible ? 'Masquer le calque' : 'Afficher le calque'}>
                <Box as={l.visible ? FiEye : FiEyeOff} color={muted} fontSize="13px" flexShrink={0}
                  onClick={(e) => { e.stopPropagation(); editor.toggleVisible(l.id); onChange() }} />
              </Tip>
              <Tip label={isAdjust ? 'Calque de réglage — clic pour éditer les paramètres' : l.locked ? 'Arrière-plan verrouillé — dupliquez-le pour retoucher' : `Calque actif : ${l.name}`}>
                {isAdjust ? (
                  <Center w="42px" h="30px" flexShrink={0} borderRadius="sm" bg="#2a3140"
                    border="1px solid" borderColor="#7c3aed" color="#c4b5fd" fontSize="15px">
                    <Box as={LuContrast} />
                  </Center>
                ) : (
                  <Box w="42px" h="30px" flexShrink={0} borderRadius="sm" overflow="hidden"
                    bg="#2a3140" border="1px solid" borderColor="whiteAlpha.100">
                    <img src={editor.layerThumb(l)} alt="" style={{ width: '100%', height: '100%' }} />
                  </Box>
                )}
              </Tip>
              {l.mask && (
                <Tip label={l.maskActive ? 'Masque actif — le pinceau édite le masque (noir masque, blanc révèle)' : 'Masque de fusion — clic pour éditer'}>
                  <Box w="30px" h="22px" flexShrink={0} borderRadius="sm" overflow="hidden"
                    border="2px solid" borderColor={l.maskActive ? '#22d3ee' : 'whiteAlpha.200'}
                    cursor="pointer"
                    onClick={(e) => { e.stopPropagation(); editor.snapshot('Masque'); l.maskActive = !l.maskActive; onChange() }}>
                    <img src={editor.maskThumb(l)} alt="" style={{ width: '100%', height: '100%' }} />
                  </Box>
                </Tip>
              )}
              <Text flex="1" isTruncated>{l.name}{l.locked ? ' 🔒' : ''}</Text>
              {fxs.length > 0 && (
                <Tip label="Styles de calque actifs — double-clic pour éditer">
                  <Text fontSize="2xs" color={C.primary} fontWeight="700" flexShrink={0}
                    onClick={(e) => { e.stopPropagation(); editor.setActive(l.id); onFx?.() }}>fx</Text>
                </Tip>
              )}
              {editor.activeId === l.id && !l.locked && (
                <HStack gap="0.5" flexShrink={0}>
                  <Tip label="Monter le calque">
                    <Box as={FiArrowUp} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: fg }}
                      onClick={(e) => { e.stopPropagation(); editor.moveLayer(l.id, 1); onChange() }} />
                  </Tip>
                  <Tip label="Descendre le calque">
                    <Box as={FiArrowDown} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: fg }}
                      onClick={(e) => { e.stopPropagation(); editor.moveLayer(l.id, -1); onChange() }} />
                  </Tip>
                  <Tip label="Dupliquer le calque">
                    <Box as={FiCopy} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: fg }}
                      onClick={(e) => { e.stopPropagation(); editor.snapshot(); editor.duplicateLayer(l.id); onChange() }} />
                  </Tip>
                  <Tip label="Supprimer le calque">
                    <Box as={FiTrash2} fontSize="11px" color={muted} cursor="pointer" _hover={{ color: '#f87171' }}
                      onClick={(e) => { e.stopPropagation(); editor.snapshot(); editor.removeLayer(l.id); onChange() }} />
                  </Tip>
                </HStack>
              )}
            </HStack>
            {fxs.length > 0 && (
              <VStack align="stretch" gap="0" pl="14" pb="1">
                {fxs.map((n) => (
                  <Tip key={n} label={`Effet « ${n} » — clic pour éditer`}>
                    <Text fontSize="2xs" color={muted} cursor="pointer" _hover={{ color: fg }}
                      onClick={() => { editor.setActive(l.id); onFx?.() }}>{n}</Text>
                  </Tip>
                ))}
              </VStack>
            )}
            <Box h="1px" bg="whiteAlpha.50" />
          </Box>
        )
      })}
      {editor.active && (
        <HStack px="2.5" py="1.5" gap="2" borderTop="1px solid" borderColor={panelBorder}>
          <Tip label="Mode de fusion du calque avec ceux du dessous">
            <Text fontSize="2xs" color={muted} flexShrink="0">Fusion</Text>
          </Tip>
          <Box as="select" flex="1" fontSize="2xs" bg="#1c2433" color={fg} borderRadius="sm"
            border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
            value={editor.active.blend || 'source-over'}
            onChange={(e) => { editor.snapshot(); editor.active.blend = e.target.value; onChange() }}>
            {BLEND_MODES.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
          </Box>
          <Tip label="Style de calque — ombres, lueurs, contour, incrustations…">
            <Box as="button" px="1.5" h="20px" fontSize="2xs" borderRadius="sm" cursor="pointer"
              bg={fxList(editor.active).length ? C.primary : 'whiteAlpha.100'} color="#ffffff"
              onClick={onFx}>fx</Box>
          </Tip>
        </HStack>
      )}
      <HStack px="2.5" py="2" gap="2" mt="auto" borderTop="1px solid" borderColor={panelBorder}>
        <Tip label="Calque transparent au-dessus — pour dessiner ou annoter sans toucher l'image" flex="1">
          <HStack flex="1" gap="1.5" cursor="pointer" color={C.primary} fontSize="xs"
            onClick={() => { editor.snapshot('Nouveau calque'); editor.addLayer(); onChange() }}>
            <FiPlus /> <Text>Nouveau calque</Text>
          </HStack>
        </Tip>
        <Tip label="Calque de réglage non destructif (teinte, niveaux, N&B…)">
          <Box as={LuContrast} fontSize="14px" color={muted} cursor="pointer" _hover={{ color: fg }}
            onClick={() => { editor.snapshot('Calque de réglage'); const l = editor.addAdjustLayer('bc'); onChange(); onAdjust?.(l) }} />
        </Tip>
        {editor.active && !editor.active.locked && editor.active.type !== 'adjust' && (
          <Tip label={editor.active.mask ? 'Supprimer le masque de fusion' : 'Ajouter un masque de fusion (depuis la sélection si elle existe)'}>
            <Box as={TbMask} fontSize="15px" color={editor.active?.mask ? C.primary : muted}
              cursor="pointer" _hover={{ color: fg }}
              onClick={() => {
                const l = editor.active
                if (!l) return
                editor.snapshot('Masque de fusion')
                if (l.mask) editor.removeMask(l)
                else editor.addMask(l, !!(editor.sel || editor.selPoly))
                onChange()
              }} />
          </Tip>
        )}
        {editor.active && (
          <>
            <Tip label="Opacité — affecte le calque ET ses effets" flex="1">
              <HStack gap="1" flex="1">
                <Text fontSize="2xs" color={muted}>Opacité</Text>
                <Input type="range" min="0" max="1" step="0.05" h="16px" flex="1"
                  value={editor.active.opacity}
                  onPointerDown={() => editor.snapshot()}
                  onChange={(e) => { editor.active.opacity = +e.target.value; onChange() }} />
              </HStack>
            </Tip>
            <Tip label="Remplissage — affecte les pixels seuls (les effets fx restent visibles)" flex="1">
              <HStack gap="1" flex="1">
                <Text fontSize="2xs" color={muted}>Rempl.</Text>
                <Input type="range" min="0" max="1" step="0.05" h="16px" flex="1"
                  value={editor.active.fill ?? 1}
                  onPointerDown={() => editor.snapshot()}
                  onChange={(e) => { editor.active.fill = +e.target.value; onChange() }} />
              </HStack>
            </Tip>
          </>
        )}
      </HStack>
    </VStack>
  )
}

// ---- Panneau droit : Réglages (groupés façon Lightroom) ----------------------------

function Section({ title, right, children }) {
  return (
    <Box borderBottom="1px solid" borderColor="whiteAlpha.50" pb="2.5">
      <HStack justify="space-between" mb="1.5">
        <Text fontSize="2xs" fontWeight="700" color={fg} textTransform="uppercase" letterSpacing="wider">{title}</Text>
        {right}
      </HStack>
      <VStack align="stretch" gap="1.5">{children}</VStack>
    </Box>
  )
}

function Slider({ d, value, onChange, onStart }) {
  const disp = d.fmt ? d.fmt(value) : `${value}${d.unit || ''}`
  return (
    <Tip label={d.tip || d.label} display="block">
      <HStack justify="space-between" mb="0.5">
        <Text fontSize="2xs" color={muted}>{d.label}</Text>
        <Text fontSize="2xs" color={fg} w="52px" textAlign="right">{disp}</Text>
      </HStack>
      <Input type="range" min={d.min} max={d.max} step={d.step || 1} h="16px"
        value={value} onPointerDown={onStart}
        onChange={(e) => onChange(+e.target.value)} />
    </Tip>
  )
}

const LS_PRESETS = 'dp_studio_presets'
const loadUserPresets = () => { try { return JSON.parse(localStorage.getItem(LS_PRESETS) || '[]') } catch { return [] } }

export function AdjustPanel({ editor, onChange, wbPick, onWbPick, comparing, onCompare }) {
  const [userPresets, setUserPresets] = useState(loadUserPresets)
  const set = (k) => (v) => { editor.adjust[k] = v; onChange() }
  const snap = () => editor.snapshot()

  const applyPreset = (p) => {
    editor.snapshot()
    editor.adjust = { ...editor.adjust, ...p.adjust }
    onChange()
  }
  const savePreset = () => {
    const name = window.prompt('Nom du préréglage ?', 'Mon réglage')
    if (!name) return
    const a = editor.adjust
    const keep = ['exposure', 'brightness', 'contrast', 'saturate', 'temp', 'tint',
      'inBlack', 'gamma', 'inWhite', 'outBlack', 'outWhite', 'sharp', 'hue', 'grayscale', 'sepia']
    const adjust = {}
    for (const k of keep) adjust[k] = a[k]
    const next = [...userPresets, { name, adjust }]
    setUserPresets(next)
    localStorage.setItem(LS_PRESETS, JSON.stringify(next))
  }
  // Niveaux auto : quantiles 1% / 99% de l'histogramme de luminance
  const autoLevels = () => {
    try {
      const { h } = histogram(editor.compositeFiltered())
      const total = h.reduce((s, v) => s + v, 0)
      let lo = 0, hi = 255, acc = 0
      for (let i = 0; i < 256; i++) { acc += h[i]; if (acc >= total * 0.01) { lo = i; break } }
      acc = 0
      for (let i = 255; i >= 0; i--) { acc += h[i]; if (acc >= total * 0.01) { hi = i; break } }
      editor.snapshot()
      editor.adjust.inBlack = lo
      editor.adjust.inWhite = Math.max(lo + 1, hi)
      onChange()
    } catch { /* doc pas prêt */ }
  }

  return (
    <VStack align="stretch" gap="2.5" px="3" py="3" flex="1" overflowY="auto">
      {/* Comparaison avant/après sur le canevas */}
      <Section title="Comparaison">
        <Tip label="Original à gauche du séparateur jaune, retouche à droite — Q" display="block">
          <Box as="button" px="2" py="1" fontSize="2xs" borderRadius="sm" cursor="pointer"
            bg={comparing ? '#f2c200' : 'whiteAlpha.100'} color={comparing ? '#111827' : fg}
            fontWeight={comparing ? '700' : '400'} onClick={onCompare}>
            {comparing ? '⬅ AVANT | APRÈS ➡ (glisser le séparateur)' : 'Comparer AVANT / APRÈS'}
          </Box>
        </Tip>
      </Section>

      {/* Préréglages */}
      <Section title="Préréglages"
        right={
          <Tip label="Enregistrer les réglages courants comme préréglage réutilisable">
            <Box as="button" fontSize="2xs" color={C.primary} cursor="pointer" onClick={savePreset}>+ Sauver</Box>
          </Tip>
        }>
        <HStack gap="1.5" flexWrap="wrap">
          {[...PRESETS, ...userPresets].map((p) => (
            <Tip key={p.name} label={`Appliquer « ${p.name} » à tous les réglages`}>
              <Box as="button" px="2" py="0.5" fontSize="2xs" borderRadius="sm"
                bg="whiteAlpha.100" color={fg} cursor="pointer" _hover={{ bg: 'whiteAlpha.200' }}
                onClick={() => applyPreset(p)}>
                {p.name}
              </Box>
            </Tip>
          ))}
        </HStack>
      </Section>

      {ADJUST_GROUPS.map((g) => (
        <Section key={g.title} title={g.title}
          right={g.levels && (
            <Tip label="Niveaux automatiques — noirs/blancs calés sur l'histogramme">
              <Box as="button" fontSize="2xs" color={C.primary} cursor="pointer" onClick={autoLevels}>Auto</Box>
            </Tip>
          )}>
          {g.wb && (
            <HStack gap="2">
              <Tip label="Cliquez une zone neutre (grise) de la photo — corrige la dominante couleur">
                <Box as="button" px="2" py="0.5" fontSize="2xs" borderRadius="sm" cursor="pointer"
                  bg={wbPick ? '#f2c200' : 'whiteAlpha.100'} color={wbPick ? '#111827' : fg}
                  onClick={onWbPick}>
                  {wbPick ? '🎯 Cliquez une zone neutre' : 'Pipette balance des blancs'}
                </Box>
              </Tip>
              {editor.wb && (
                <Tip label="Annuler la balance des blancs mesurée à la pipette">
                  <Box as="button" fontSize="2xs" color={muted} cursor="pointer"
                    onClick={() => { editor.snapshot(); editor.wb = null; onChange() }}>
                    Reset BB
                  </Box>
                </Tip>
              )}
            </HStack>
          )}
          {g.defs.map((d) => (
            <Slider key={d.key} d={d} value={editor.adjust[d.key]}
              onChange={set(d.key)} onStart={snap} />
          ))}
        </Section>
      ))}

      <Tip label="Remettre tous les réglages, courbes et balance des blancs à zéro" display="block">
        <Box as="button" px="2" py="1" fontSize="2xs" borderRadius="sm"
          bg="whiteAlpha.100" color={muted} cursor="pointer" _hover={{ bg: 'whiteAlpha.200' }}
          onClick={() => {
          editor.snapshot()
          editor.adjust = { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0,
            grayscale: 0, sepia: 0, invert: 0, inBlack: 0, gamma: 100, inWhite: 255,
            outBlack: 0, outWhite: 255,
            exposure: 0, temp: 0, tint: 0, sharp: 0 }
          editor.wb = null
          onChange()
        }}>
          Réinitialiser tous les réglages
        </Box>
      </Tip>
    </VStack>
  )
}

// ---- Panneau droit : Courbes (histogramme + courbe par canal) ----------------------
//
// Zone carrée 216px = [0..255]². Clic près de la courbe : nouveau point.
// Drag d'un point : déplace. Sortir un point du cadre : supprime.

export function CurvesPanel({ editor, version, onChange, target }) {
  const curves = target || editor.curves
  const [ch, setCh] = useState('rgb')
  const cvRef = useRef(null)
  const drag = useRef(-1)
  const W = 216, H = 164
  const px2v = (x) => Math.round((x / W) * 255)
  const v2px = (v) => (v / 255) * W
  const pts = () => curves[ch] || [{ x: 0, y: 0 }, { x: 255, y: 255 }]

  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !editor.w) return
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H)
    // histogramme de luminance
    try {
      const { h, max } = histogram(editor.compositeFiltered())
      ctx.fillStyle = 'rgba(255,255,255,0.16)'
      for (let i = 0; i < 256; i += 2) {
        const hh = (h[i] / max) * H * 0.85
        ctx.fillRect(v2px(i), H - hh, Math.max(1, W / 128), hh)
      }
    } catch { /* doc pas prêt */ }
    // grille 4×4 + diagonale
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo((W / 4) * i, 0); ctx.lineTo((W / 4) * i, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke()
    // courbe LUT
    const lut = curveLUT(curves[ch])
    ctx.strokeStyle = { rgb: '#4f8fe8', r: '#f87171', g: '#4ade80', b: '#60a5fa' }[ch]
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < 256; i++) {
      const x = v2px(i), y = H - (lut[i] / 255) * H
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()
    // points
    for (const p of pts()) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111827'
      ctx.beginPath(); ctx.arc(v2px(p.x), H - v2px(p.y), 4.5, 0, 7); ctx.fill(); ctx.stroke()
    }
  })

  const hit = (mx, my) => pts().findIndex((p) =>
    Math.hypot(v2px(p.x) - mx, H - v2px(p.y) - my) < 8)

  const onDown = (e) => {
    const r = cvRef.current.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const i = hit(mx, my)
    editor.snapshot()
    if (i >= 0) { drag.current = i }
    else {
      const p = pts()
      const np = [...p, { x: px2v(mx), y: px2v(H - my) }].sort((a, b) => a.x - b.x)
      curves[ch] = np
      drag.current = np.findIndex((q) => q.x === px2v(mx) && q.y === px2v(H - my))
      onChange()
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e) => {
    if (drag.current < 0) return
    const r = cvRef.current.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const p = [...pts()]
    // sorti du cadre -> suppression (sauf points extrêmes)
    if ((my < -20 || my > H + 20) && p.length > 2 && drag.current > 0 && drag.current < p.length - 1) {
      p.splice(drag.current, 1)
      curves[ch] = p.length > 2 ? p : null
      drag.current = -1
      onChange()
      return
    }
    const moved = {
      x: Math.max(0, Math.min(255, px2v(mx))),
      y: Math.max(0, Math.min(255, px2v(H - my))),
    }
    p[drag.current] = moved
    curves[ch] = p.sort((a, b) => a.x - b.x)
    drag.current = curves[ch].indexOf(moved)
    onChange()
  }

  return (
    <VStack align="stretch" gap="2" px="3" py="3" flex="1" overflowY="auto">
      <HStack>
        <Tip label="Canal à éditer — RGB agit sur les trois canaux">
          <Text fontSize="2xs" color={muted}>Canal</Text>
        </Tip>
        <Box as="select" fontSize="2xs" bg="#1c2433" color={fg} borderRadius="sm"
          border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
          value={ch} onChange={(e) => setCh(e.target.value)}>
          {CURVE_CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Box>
        <Box flex="1" />
        <Tip label="Réinitialiser la courbe de ce canal">
          <Box as="button" fontSize="2xs" px="2" h="20px" borderRadius="sm"
            bg="whiteAlpha.100" color={muted} cursor="pointer"
            onClick={() => { editor.snapshot(); curves[ch] = null; onChange() }}>
            Reset
          </Box>
        </Tip>
      </HStack>
      <Tip label="Clic = ajouter un point · glisser = déplacer · sortir du cadre = supprimer" display="block">
        <Box as="canvas" ref={cvRef} width={W} height={H} borderRadius="sm"
          border="1px solid" borderColor={panelBorder} cursor="crosshair" style={{ touchAction: 'none' }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = -1 }} />
      </Tip>
      <HStack justify="space-between">
        <Tip label="Activer / désactiver l'effet des réglages et courbes">
          <HStack gap="1.5" cursor="pointer"
            onClick={() => { editor.adjustVisible = !editor.adjustVisible; onChange() }}>
            <Box w="12px" h="12px" borderRadius="sm" border="1px solid"
              borderColor={editor.adjustVisible ? '#4f8fe8' : 'gray.500'}
              bg={editor.adjustVisible ? '#4f8fe8' : 'transparent'}
              color="#ffffff" fontSize="2xs" lineHeight="12px" textAlign="center">
              {editor.adjustVisible ? '✓' : ''}
            </Box>
            <Text fontSize="2xs" color={muted}>Réglages visibles</Text>
          </HStack>
        </Tip>
        <Tip label="Axe horizontal = niveaux d'entrée · vertical = niveaux de sortie">
          <Text fontSize="2xs" color={muted}>Entrée → Sortie</Text>
        </Tip>
      </HStack>
    </VStack>
  )
}

// ---- Panneau droit : Dentaire (fonctions métier) ----------------------------------
// Regroupe : avant/après, redressage, calibrage, prise de teinte VITA,
// photo de référence incrustée, planche du référentiel.

const DBtn = ({ children, onClick, active, disabled, tip }) => (
  <Tip label={tip || ''} display="block">
    <Box as="button" px="2" py="1.5" fontSize="2xs" borderRadius="sm" cursor={disabled ? 'default' : 'pointer'}
      bg={active ? '#f2c200' : 'whiteAlpha.100'} color={active ? '#111827' : fg}
      fontWeight={active ? '700' : '400'} opacity={disabled ? 0.45 : 1}
      _hover={disabled ? {} : { bg: active ? '#f2c200' : 'whiteAlpha.200' }}
      onClick={disabled ? undefined : onClick}>
      {children}
    </Box>
  </Tip>
)

export function DentalPanel({ editor, version, onChange, dental }) {
  const {
    comparing, onCompare, onMontage,
    straighten, setStraighten, onApplyStraighten,
    wbPick, onWbPick, onAutoWB, onCalRef,
    shade, onShade, srcPhoto,
    steps, refStep, onRefStep, refImg, refOverlay, onToggleOverlay, onPickRef,
    onSheet,
  } = dental
  const st = straighten // null | {angle, ruler, line}
  return (
    <VStack align="stretch" gap="2.5" px="3" py="3" flex="1" overflowY="auto">

      {/* Avant / après */}
      <Section title="Avant / Après">
        <VStack align="stretch" gap="1.5">
          <DBtn tip="Assembler 2 photos en une image AVANT|APRÈS (montage sauvegardable)" onClick={onMontage}>
            Montage avant / après…
          </DBtn>
          <DBtn tip="Séparateur jaune draggable : original à gauche, retouche à droite — Q"
            active={comparing} onClick={onCompare}>
            {comparing ? '⬅ AVANT | APRÈS ➡' : 'Comparer sur le canevas'}
          </DBtn>
        </VStack>
      </Section>

      {/* Redresser */}
      <Section title="Redresser">
        {!st ? (
          <DBtn tip="Trace une droite sur le plan occlusal (ou règle l'angle) puis applique"
            onClick={() => setStraighten({ angle: 0, ruler: false, line: null })}>
            Redresser l'image…
          </DBtn>
        ) : (
          <VStack align="stretch" gap="1.5">
            <DBtn tip="Tracez la droite qui doit devenir horizontale (plan occlusal, horizon)"
              active={st.ruler}
              onClick={() => setStraighten({ ...st, ruler: !st.ruler })}>
              {st.ruler ? '📏 Tracez la droite sur la photo' : 'Tracer la droite de référence'}
            </DBtn>
            <Tip label={`Angle de rotation : ${st.angle.toFixed(1)}°`} display="block">
              <HStack gap="2">
                <Input type="range" min="-20" max="20" step="0.1" h="16px" flex="1"
                  value={st.angle}
                  onChange={(e) => setStraighten({ ...st, angle: +e.target.value })} />
                <Text fontSize="2xs" color={fg} w="38px" textAlign="right">{st.angle.toFixed(1)}°</Text>
              </HStack>
            </Tip>
            <HStack gap="1.5">
              <DBtn tip="Appliquer la rotation au document" onClick={onApplyStraighten}>Appliquer</DBtn>
              <DBtn tip="Annuler le redressage" onClick={() => setStraighten(null)}>Annuler</DBtn>
            </HStack>
          </VStack>
        )}
      </Section>

      {/* Calibrer */}
      <Section title="Calibrer">
        <VStack align="stretch" gap="1.5">
          <DBtn tip="Balance des blancs automatique — la dominante couleur est neutralisée"
            onClick={() => { editor.snapshot(); editor.autoWB(); onChange() }}>
            BB auto (gris moyen)
          </DBtn>
          <DBtn tip="Cliquez une zone neutre de la photo (carte grise, rétracteur…)"
            active={wbPick} onClick={onWbPick}>
            {wbPick ? '🎯 Cliquez une zone neutre' : 'Pipette balance des blancs'}
          </DBtn>
          <DBtn tip="Assortit BB + exposition à une photo de référence — rendu avant/après homogène"
            onClick={onCalRef}>
            Étalonner sur une référence…
          </DBtn>
        </VStack>
      </Section>

      {/* Prise de teinte */}
      <Section title="Prise de teinte">
        {srcPhoto ? (
          <>
            <HStack justify="space-between">
              <Text fontSize="2xs" color={muted}>Teinte de la photo</Text>
              <Tip label="Teinte VITA enregistrée sur la fiche photo">
                <Text fontSize="xs" fontWeight="700" color={shade ? '#f2c200' : muted}>
                  {shade || '—'}
                </Text>
              </Tip>
            </HStack>
            <HStack gap="1" flexWrap="wrap">
              {VITA_SHADES.map((s) => (
                <Tip key={s.code} label={`Teinte ${s.code} — enregistrée sur la photo`}>
                  <Box as="button" w="26px" h="26px" borderRadius="sm" cursor="pointer"
                    bg={s.color} border="2px solid"
                    borderColor={shade === s.code ? '#f2c200' : 'transparent'}
                    color="#111827" fontSize="2xs" fontWeight="700" lineHeight="22px" textAlign="center"
                    onClick={() => onShade(s.code)}>
                    {s.code}
                  </Box>
                </Tip>
              ))}
            </HStack>
          </>
        ) : (
          <Text fontSize="2xs" color={muted}>
            Ouvrez une photo du dossier pour enregistrer sa teinte VITA.
          </Text>
        )}
      </Section>

      {/* Photo de référence */}
      <Section title="Photo de référence">
        <VStack align="stretch" gap="1.5">
          {(steps || []).length > 0 && (
            <Tip label="Vue de référence du protocole DentoPic">
              <Box as="select" w="100%" fontSize="2xs" bg="#1c2433" color={fg} borderRadius="sm"
                border="1px solid" borderColor={panelBorder} h="24px" px="1" cursor="pointer"
                value={refStep || ''} onChange={(e) => onRefStep(e.target.value || null)}>
                <option value="">Référence du protocole…</option>
                {steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Box>
            </Tip>
          )}
          <HStack gap="1.5">
            <DBtn tip="Utiliser une photo du dossier comme référence" onClick={onPickRef}>
              Choisir une photo…
            </DBtn>
            <DBtn tip="Incruste la référence en bas à droite du canevas (guide de cadrage)"
              active={refOverlay} disabled={!refImg} onClick={onToggleOverlay}>
              {refOverlay ? 'Incrustée ✓' : 'Incruster'}
            </DBtn>
          </HStack>
          {refImg && (
            <Box borderRadius="sm" overflow="hidden" border="1px solid" borderColor={panelBorder} maxH="90px">
              <img src={refImg.src} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover' }} />
            </Box>
          )}
        </VStack>
      </Section>

      {/* Planche du référentiel */}
      <Section title="Planche référentiel">
        <DBtn tip="8 vues du protocole (portraits, sourire, intra-orales, occlusales) composées sur une seule image éditable"
          onClick={onSheet}>
          Composer la planche…
        </DBtn>
      </Section>
    </VStack>
  )
}

// ---- Panneau droit : Histogramme (stats façon Photoshop) -------------------------

export function HistogramPanel({ editor, version }) {
  const cvRef = useRef(null)
  const [stats, setStats] = useState(null)
  const W = 216, H = 120
  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !editor.w) return
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H)
    try {
      const st = histogram(editor.compositeFiltered())
      setStats(st)
      // trois canaux superposés : R / V / B + luminance en blanc
      const draw = (h, color) => {
        const mx = Math.max(...h) || 1
        ctx.fillStyle = color
        for (let i = 0; i < 256; i += 2) {
          const hh = (h[i] / mx) * H * 0.9
          ctx.fillRect((i / 255) * W, H - hh, Math.max(1, W / 128), hh)
        }
      }
      draw(st.h, 'rgba(255,255,255,0.75)')
    } catch { /* doc pas prêt */ }
  }, [version]) // eslint-disable-line
  return (
    <VStack align="stretch" gap="2" px="3" py="3" flex="1" overflowY="auto">
      <Tip label="Distribution des luminances du composite édité" display="block">
        <Box as="canvas" ref={cvRef} width={W} height={H} borderRadius="sm"
          border="1px solid" borderColor={panelBorder} />
      </Tip>
      {stats && (
        <VStack align="stretch" gap="1" fontSize="2xs" color={muted}>
          <InfoRow k="Moyenne" v={stats.mean.toFixed(2)} />
          <InfoRow k="Écart type" v={stats.stdDev.toFixed(2)} />
          <InfoRow k="Médiane" v={stats.median} />
          <InfoRow k="Pixels" v={stats.pixels.toLocaleString('fr-FR')} />
          <InfoRow k="Niveau de cache" v="1" />
        </VStack>
      )}
    </VStack>
  )
}

// ---- Panneau droit : Navigateur (vue d'ensemble + cadre viewport) -----------------

export function NavigatorPanel({ editor, version, view, stageSize, onNav }) {
  const cvRef = useRef(null)
  const drag = useRef(false)
  const W = 216
  const navH = editor.w ? Math.min(170, Math.round(W * editor.h / editor.w)) : 120
  const k = () => Math.min(W / editor.w, navH / editor.h) // miniaturisation doc → panneau
  const draw = () => {
    const cv = cvRef.current
    if (!cv || !editor.w) return
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, navH)
    ctx.drawImage(editor.compositeFiltered(), 0, 0, editor.w * k(), editor.h * k())
    // cadre rouge = zone visible dans le canevas principal
    const s = view.scale, [vw, vh] = [stageSize.w, stageSize.h]
    const x0 = Math.max(0, -view.ox / s) * k(), y0 = Math.max(0, -view.oy / s) * k()
    const x1 = Math.min(editor.w, (vw - view.ox) / s) * k(), y1 = Math.min(editor.h, (vh - view.oy) / s) * k()
    if (x1 > x0 && y1 > y0) {
      ctx.strokeStyle = '#f87171'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
    }
  }
  useEffect(draw, [version, view, stageSize]) // eslint-disable-line
  const toDoc = (e) => {
    const r = cvRef.current.getBoundingClientRect()
    return [(e.clientX - r.left) / k(), (e.clientY - r.top) / k()]
  }
  return (
    <VStack align="stretch" gap="2" px="3" py="3">
      <Tip label="Vue d'ensemble — cliquez ou glissez pour déplacer la zone affichée" display="block">
        <Box as="canvas" ref={cvRef} width={W} height={navH} borderRadius="sm"
          border="1px solid" borderColor={panelBorder} cursor="crosshair" style={{ touchAction: 'none' }}
          onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); onNav(...toDoc(e)) }}
          onPointerMove={(e) => drag.current && onNav(...toDoc(e))}
          onPointerUp={() => { drag.current = false }} />
      </Tip>
      <Text fontSize="2xs" color={muted}>
        Le cadre rouge indique la partie du document visible dans le canevas.
      </Text>
    </VStack>
  )
}

// ---- Panneau droit : Histoire (états nommés, clic = saut) — façon Photoshop ------

export function HistoryPanel({ editor, version, onJump }) {
  const past = editor.undoStack // [{label, json}]
  const fut = editor.redoStack
  return (
    <VStack align="stretch" gap="0" flex="1" overflowY="auto" px="1" py="1">
      {past.map((s, i) => (
        <Tip key={i} label={`Revenir à l'état avant « ${s.label} »`} display="block">
          <HStack px="2" py="1" gap="2" fontSize="2xs" cursor="pointer" color={muted}
            _hover={{ bg: 'whiteAlpha.100', color: fg }} borderRadius="sm"
            onClick={() => onJump('undo', i)}>
            <Box as={LuHistory} fontSize="11px" flexShrink={0} />
            <Text isTruncated>{s.label}</Text>
          </HStack>
        </Tip>
      ))}
      <HStack px="2" py="1.5" gap="2" fontSize="2xs" color="#f2c200" fontWeight="700"
        bg="whiteAlpha.100" borderRadius="sm">
        <Box as={LuHistory} fontSize="11px" />
        <Text>État actuel</Text>
      </HStack>
      {fut.map((s, i) => (
        <Tip key={i} label={`Rétablir (${fut.length - i} étape(s))`} display="block">
          <HStack px="2" py="1" gap="2" fontSize="2xs" cursor="pointer" color="whiteAlpha.400"
            _hover={{ bg: 'whiteAlpha.100', color: fg }} borderRadius="sm"
            onClick={() => onJump('redo', fut.length - i)}>
            <Box as={LuHistory} fontSize="11px" flexShrink={0} />
            <Text isTruncated>{s.label}</Text>
          </HStack>
        </Tip>
      ))}
      {!past.length && !fut.length && (
        <Text fontSize="2xs" color={muted} px="2" py="2">Aucune action encore — les étapes apparaîtront ici.</Text>
      )}
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

export function StatusBar({ editor, zoom, tool, onZoom }) {
  const t = TOOLS.find((x) => x.key === tool)
  return (
    <HStack h="24px" px="3" gap="4" bg={panelBg} borderTop="1px solid" borderColor={panelBorder}
      fontSize="2xs" color={muted} flexShrink={0}>
      <Tip label="Saisir un zoom (%) puis Entrée — molette sur le canevas pour zoomer">
        <Input
          w="52px" h="17px" fontSize="2xs" px="1" bg="transparent" border="1px solid"
          borderColor="transparent" _hover={{ borderColor: panelBorder }}
          _focusVisible={{ borderColor: '#4f8fe8', boxShadow: 'none' }}
          defaultValue={Math.round(zoom * 100) + ' %'}
          key={Math.round(zoom * 100)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = parseFloat(e.target.value)
              if (v > 0) onZoom(v / 100 / zoom)
              e.target.blur()
            }
          }}
        />
      </Tip>
      <Tip label="Outil actif"><Text>{t?.label}</Text></Tip>
      <Tip label="Dimensions du document"><Text>{editor.w ? `${editor.w} × ${editor.h} px` : ''}</Text></Tip>
      {editor.w > 0 && <Tip label="Espace colorimétrique et nombre de calques"><Text>RGB • 8 bit • {editor.layers.length} calque(s)</Text></Tip>}
      <Box flex="1" />
      <Text isTruncated maxW="280px">{editor.docName}</Text>
    </HStack>
  )
}

// ---- Panneau latéral à onglets -------------------------------------------------------

export function RightPanel({ editor, version, zoom, cursor, onChange, wbPick, onWbPick, comparing, onCompare, dental, onFx, onAdjust, onJump, view, stageSize, onNav, curveTarget }) {
  const [tab, setTab] = useState('dental')
  const TABS = [
    ['dental', 'Dentaire', 'Avant/après, redresser, calibrer, teinte, référence, planche'],
    ['layers', 'Calques', 'Empilement, fusion, opacité, remplissage, effets fx, masques'],
    ['adjust', 'Réglages', 'Exposition, balance des blancs, niveaux, effets'],
    ['curves', 'Courbes', 'Tonalité par canal RGB/R/V/B'],
    ['hist', 'Hist.', 'États de l\'historique — clic pour sauter'],
    ['nav', 'Nav.', 'Vue d\'ensemble et déplacement du cadre visible'],
    ['histo', 'Histo', 'Histogramme et statistiques de luminance'],
    ['info', 'Infos', 'Document, dimensions, curseur, couleur'],
  ]
  return (
    <Flex w="248px" direction="column" bg={panelBg} borderLeft="1px solid" borderColor={panelBorder} flexShrink={0}>
      <HStack px="2" pt="2" pb="0" gap="1" borderBottom="1px solid" borderColor={panelBorder}>
        {TABS.map(([k, l, tip]) => (
          <Tip key={k} label={tip}>
            <Box px="2.5" py="1.5" fontSize="xs" cursor="pointer" borderRadius="md md 0 0"
              color={tab === k ? fg : muted} fontWeight={tab === k ? '600' : '400'}
              bg={tab === k ? 'whiteAlpha.100' : 'transparent'}
              onClick={() => setTab(k)}>
              {l}
            </Box>
          </Tip>
        ))}
      </HStack>
      <Flex flex="1" direction="column" overflow="hidden">
        {tab === 'dental' && <DentalPanel editor={editor} version={version} onChange={onChange} dental={dental} />}
        {tab === 'layers' && <LayersPanel editor={editor} version={version} onChange={onChange} onFx={onFx} onAdjust={onAdjust} />}
        {tab === 'adjust' && <AdjustPanel editor={editor} onChange={onChange}
          wbPick={wbPick} onWbPick={onWbPick} comparing={comparing} onCompare={onCompare} />}
        {tab === 'curves' && <CurvesPanel editor={editor} version={version} onChange={onChange} target={curveTarget} />}
        {tab === 'hist' && <HistoryPanel editor={editor} version={version} onJump={onJump} />}
        {tab === 'nav' && <NavigatorPanel editor={editor} version={version} view={view} stageSize={stageSize} onNav={onNav} />}
        {tab === 'histo' && <HistogramPanel editor={editor} version={version} />}
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
          <Tip label="Photo déjà rangée dans un dossier du workspace">
            <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" bg={C.primary} color="#ffffff"
              cursor="pointer" onClick={onPick}>
              Choisir une photo
            </Box>
          </Tip>
          <Tip label="JPG / PNG depuis votre ordinateur">
            <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" bg="whiteAlpha.100" color={fg}
              cursor="pointer" onClick={onOpen}>
              Importer un fichier…
            </Box>
          </Tip>
        </HStack>
      </VStack>
    </Center>
  )
}
