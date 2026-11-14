// Chrome du Studio : barre de menus, toolbar vertical, barre d'options,
// panneaux droits (Calques / Réglages / Infos), barre de statut.
// Palette Studio via S.* (vars --s-*) — suit le mode clair/sombre global.
import { useEffect, useRef, useState } from 'react'
import { Box, Center, Flex, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiArrowDown, FiArrowUp, FiCopy, FiEye, FiEyeOff, FiGrid, FiImage, FiLayers, FiLock,
  FiMove, FiPlus, FiRefreshCw, FiTrash2, FiEdit2, FiType, FiZap, FiShare2,
  FiAlignLeft, FiAlignCenter, FiAlignRight,
  FiFolder, FiFolderPlus, FiChevronDown, FiChevronRight,
} from 'react-icons/fi'
import { LuContrast, LuHistory, LuPaintBucket, LuRedo2, LuUndo2 } from 'react-icons/lu'
import { TbMask } from 'react-icons/tb'
import { PromptModal, Tip } from '../../components/ui'
import { C, S, svar, getMode } from '../../theme'
import { ADJUST_GROUPS, BLEND_MODES, CURVE_CHANNELS, FDI_TEETH, PRESETS, SWATCHES, TOOLS, VITA_SHADES } from './constants'
import { ADJUST_KINDS, ADJUST_PARAMS, DEFAULT_ADJUST, autoLevels, curveLUT, histogram } from './engine'

const panelBg = S.card
const panelBorder = S.border
const fg = S.fg
const muted = S.muted

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
              color={open === m.label ? fg : muted}
              bg={open === m.label ? 'var(--s-a100)' : 'transparent'}
              _hover={{ bg: 'var(--s-a100)', color: fg }}
              onClick={() => setOpen(open === m.label ? null : m.label)}
              onMouseEnter={() => open && setOpen(m.label)}
            >
              {m.label}
            </Box>
          </Tip>
          {open === m.label && (
            <VStack
              position="absolute" top="100%" left="0" mt="1" align="stretch" gap="0"
              bg={S.input} border="1px solid" borderColor={panelBorder} borderRadius="md"
              minW="200px" py="1" boxShadow="lg" zIndex="40"
            >
              {m.items.filter(Boolean).map((it, i) => it === '-' ? (
                <Box key={i} h="1px" bg={panelBorder} my="1" />
              ) : (
                <HStack key={i} px="3" py="1.5" gap="2" fontSize="xs" userSelect="none"
                  cursor={it.disabled ? 'not-allowed' : 'pointer'}
                  color={fg} opacity={it.disabled ? 0.38 : 1}
                  _hover={{ bg: it.disabled ? 'transparent' : 'var(--s-a100)' }}
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
              _hover={{ color: tool === t.key ? '#ffffff' : fg, bg: tool === t.key ? C.primary : 'var(--s-a100)' }}
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
            _hover={{ color: fg }} onClick={onSwap}>
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
  hasSel, onFill, onDelete, onDeselect, onSelMask, canUndo, canRedo, onUndo, onRedo, onPickColor,
  freeTransform, onFtChange, onFtApply, onFtCancel, onFtMode, measure,
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
      bg={primary ? C.primary : 'var(--s-a100)'} color={primary ? '#ffffff' : fg} onClick={onClick}>
      {label}
    </Box>
  )
  return (
    <HStack h="34px" px="3" gap="4" bg={panelBg} borderBottom="1px solid" borderColor={panelBorder} flexShrink={0}>
      <Text fontSize="xs" color={fg} fontWeight="600">
        {freeTransform ? 'Transformation' : TOOLS.find((t) => t.key === tool)?.label}
      </Text>
      {freeTransform && (() => {
        const f = freeTransform
        const num = (label, val, cb, step = 1, suffix = 'px') => (
          <HStack key={label} gap="1">
            <Text {...row}>{label}</Text>
            <Input type="number" w="62px" h="20px" fontSize="2xs" px="1" step={step} data-ft={label}
              value={Math.round(val * 10) / 10}
              onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) cb(v) }} />
            <Text {...row}>{suffix}</Text>
          </HStack>
        )
        return (
          <>
            {/* mode de transformation — façon Édition > Transformer de Photoshop */}
            <HStack gap="0.5">
              {[['free', 'Libre'], ['distort', 'Distorsion'], ['warp', 'Déformation']].map(([m, label]) => (
                <Tip key={m} label={m === 'free' ? 'Déplacer, redimensionner, tourner' : m === 'distort' ? 'Tirer chaque coin librement (perspective)' : 'Treillis 3×3 : déformer localement'}>
                  <Box as="button" px="2" h="18px" fontSize="2xs" borderRadius="sm" cursor="pointer"
                    bg={f.mode === m ? C.primary : 'var(--s-a100)'} color={f.mode === m ? '#ffffff' : fg}
                    onClick={() => onFtMode?.(m)}>{label}</Box>
                </Tip>
              ))}
            </HStack>
            {f.mode === 'free' && (
              <>
                {num('X', f.cx, (v) => onFtChange({ cx: v }))}
                {num('Y', f.cy, (v) => onFtChange({ cy: v }))}
                {num('L', f.sx * 100, (v) => onFtChange({ sx: v / 100, sy: f.link ? v / 100 : f.sy }), 1, '%')}
                <Tip label="Conserver les proportions — L et H liés">
                  <Box as="button" w="18px" h="18px" fontSize="2xs" borderRadius="sm" cursor="pointer"
                    bg={f.link ? C.primary : 'var(--s-a100)'} color={f.link ? '#ffffff' : fg}
                    onClick={() => onFtChange({ link: !f.link })}>⛓</Box>
                </Tip>
                {num('H', f.sy * 100, (v) => onFtChange({ sy: v / 100, sx: f.link ? v / 100 : f.sx }), 1, '%')}
                {num('∠', f.angle * 180 / Math.PI, (v) => onFtChange({ angle: v * Math.PI / 180 }), 1, '°')}
              </>
            )}
            <Tip label="Méthode de rééchantillonnage des pixels">
              <HStack gap="1">
                <Text {...row}>Interpolation :</Text>
                <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
                  border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
                  value={f.interp} onChange={(e) => onFtChange({ interp: e.target.value })}>
                  <option value="nearest">Au plus proche</option>
                  <option value="bilinear">Bilinéaire</option>
                  <option value="bicubic">Bicubique</option>
                  <option value="smoother">Bicubique plus lisse</option>
                </Box>
              </HStack>
            </Tip>
            <Tip label="Valider la transformation — Entrée">
              <Box as="button" w="20px" h="20px" fontSize="xs" borderRadius="sm" cursor="pointer"
                bg="#2f855a" color="#ffffff" onClick={onFtApply}>✓</Box>
            </Tip>
            <Tip label="Annuler la transformation — Échap">
              <Box as="button" w="20px" h="20px" fontSize="xs" borderRadius="sm" cursor="pointer"
                bg="#c53030" color="#ffffff" onClick={onFtCancel}>✕</Box>
            </Tip>
          </>
        )
      })()}
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
            <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
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
      {tool === 'pen' && (
        <>
          <Tip label="Contour du tracé (couleur d'arrière-plan)">
            <HStack gap="1">
              <Box w="12px" h="12px" borderRadius="sm" border="1px solid" cursor="pointer"
                borderColor={opts.shapeStrokeOn ? '#4f8fe8' : 'gray.500'}
                bg={opts.shapeStrokeOn ? '#4f8fe8' : 'transparent'} color={opts.shapeStrokeOn ? '#ffffff' : fg}
                fontSize="2xs" lineHeight="12px" textAlign="center"
                onClick={() => setOpts({ ...opts, shapeStrokeOn: !opts.shapeStrokeOn })}>
                {opts.shapeStrokeOn ? '✓' : ''}
              </Box>
              <Text {...row}>Contour</Text>
            </HStack>
          </Tip>
          {opts.shapeStrokeOn && <>{slider('shapeStroke', 1, 60)}</>}
          <Text {...row}>Clic = ancre · glisser = courbe · clic sur le 1ᵉʳ point = fermer · Entrée = terminer</Text>
        </>
      )}
      {tool === 'pathsel' && (
        <Text {...row}>Glissez pour déplacer le tracé de la forme active ou les ancres/poignées du tracé</Text>
      )}
      {tool === 'shape' && (
        <>
          <Tip label="Forme à tracer">
            <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.shapeKind} onChange={(e) => setOpts({ ...opts, shapeKind: e.target.value })}>
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="triangle">Triangle</option>
              <option value="line">Ligne</option>
              <option value="poly">Polygone</option>
              <option value="star">Étoile</option>
            </Box>
          </Tip>
          <Tip label="Contour (couleur d'arrière-plan)">
            <HStack gap="1">
              <Box w="12px" h="12px" borderRadius="sm" border="1px solid" cursor="pointer"
                borderColor={opts.shapeStrokeOn ? '#4f8fe8' : 'gray.500'}
                bg={opts.shapeStrokeOn ? '#4f8fe8' : 'transparent'} color={opts.shapeStrokeOn ? '#ffffff' : fg}
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
            <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.textFont} onChange={(e) => setOpts({ ...opts, textFont: e.target.value })}>
              {TEXT_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Box>
          </Tip>
          <Tip label="Graisse / style de la fonte">
            <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={`${opts.textBold ? 'B' : ''}${opts.textItalic ? 'I' : ''}` || 'R'}
              onChange={(e) => { const v = e.target.value; setOpts({ ...opts, textBold: v.includes('B'), textItalic: v.includes('I') }) }}>
              <option value="R">Normal</option>
              <option value="B">Gras</option>
              <option value="I">Italique</option>
              <option value="BI">Gras italique</option>
            </Box>
          </Tip>
          <Tip label="Corps du texte"><Text {...row}>Taille</Text></Tip>
          <Input type="number" w="52px" h="20px" fontSize="2xs" value={opts.textSize}
            onChange={(e) => setOpts({ ...opts, textSize: +e.target.value || 24 })} />
          <Tip label="Lissage (anti-crénelage) du texte">
            <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.textSmooth || 'lisse'}
              onChange={(e) => setOpts({ ...opts, textSmooth: e.target.value })}>
              <option value="sans">Sans</option>
              <option value="net">Net</option>
              <option value="incisif">Incisif</option>
              <option value="lisse">Lisse</option>
              <option value="accentue">Accentué</option>
            </Box>
          </Tip>
          <Tip label="Alignement du paragraphe">
            <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.textAlign || 'left'}
              onChange={(e) => setOpts({ ...opts, textAlign: e.target.value })}>
              <option value="left">Gauche</option>
              <option value="center">Centré</option>
              <option value="right">Droite</option>
            </Box>
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
      {/* avertissement : la sélection borne les retouches (comportement Photoshop) */}
      {hasSel && !['rect', 'lasso', 'plasso', 'wand', 'crop', 'move', 'hand', 'zoom'].includes(tool) && (
        <Tip label="La sélection active limite vos retouches à sa zone — comme dans Photoshop. Ctrl+D pour tout libérer.">
          <HStack gap="1" px="1.5" h="20px" borderRadius="sm" bg="#7c2d12" color="#fdba74" fontSize="2xs" flexShrink={0}>
            <Text fontWeight="700">⚠ Retouche limitée à la sélection</Text>
          </HStack>
        </Tip>
      )}
      {tool === 'rotate' && (
        <Tip label="Rotation d'un quart de tour du document">{btn('Pivoter 90°', onRotate, true)}</Tip>
      )}
      {tool === 'ruler' && (() => {
        const len = measure ? Math.hypot(measure[2] - measure[0], measure[3] - measure[1]) : 0
        const mm = opts.pxPerMm ? len / opts.pxPerMm : null
        return (
          <>
            <Tip label="Glissez une ligne sur l'image — la longueur s'affiche ici">
              <Text {...row}>
                {measure ? `L : ${len.toFixed(1)} px` : 'Glissez une ligne à mesurer'}
              </Text>
            </Tip>
            {measure && mm != null && (
              <Tip label="Longueur réelle selon l'étalonnage courant">
                <Text {...row} color="#4f8fe8" fontWeight="700">≈ {mm.toFixed(2)} mm</Text>
              </Tip>
            )}
            {measure && (
              <Tip label="Étalonnage : saisissez la longueur réelle de la ligne tracée (ex. largeur d'une dent connue, règle dans le champ)">
                <HStack gap="1">
                  <Text {...row}>=</Text>
                  <Input type="number" w="52px" h="20px" fontSize="2xs" px="1" step="0.1" min="0.1"
                    placeholder="mm" onKeyDown={(e) => {
                      if (e.key === 'Enter' && +e.target.value > 0 && len > 0) {
                        setOpts({ ...opts, pxPerMm: len / +e.target.value })
                        e.target.value = ''
                      }
                    }} />
                  <Text {...row}>mm</Text>
                </HStack>
              </Tip>
            )}
            {opts.pxPerMm && (
              <Tip label="Étalonnage courant — cliquez pour réinitialiser">
                <Box as="button" px="1.5" h="20px" fontSize="2xs" borderRadius="sm" cursor="pointer"
                  bg="var(--s-a100)" color={fg} onClick={() => setOpts({ ...opts, pxPerMm: null })}>
                  {opts.pxPerMm.toFixed(2)} px/mm ✕
                </Box>
              </Tip>
            )}
          </>
        )
      })()}
      {tool === 'move' && (
        <>
          {/* Sélection auto + portée — comme « Auto-Select: Layer » de Photoshop */}
          <Tip label="Cliquer sur le document sélectionne directement le calque sous le curseur">
            <HStack gap="1.5" cursor="pointer" onClick={() => setOpts({ ...opts, autoSelect: !opts.autoSelect })}>
              <Box w="12px" h="12px" borderRadius="sm" border="1px solid"
                borderColor={opts.autoSelect ? '#4f8fe8' : 'gray.500'}
                bg={opts.autoSelect ? '#4f8fe8' : 'transparent'}
                color="#ffffff" fontSize="2xs" lineHeight="12px" textAlign="center">
                {opts.autoSelect ? '✓' : ''}
              </Box>
              <Text {...row}>Sélection auto :</Text>
            </HStack>
          </Tip>
          <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
            border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
            disabled={!opts.autoSelect} opacity={opts.autoSelect ? 1 : 0.5}
            value={opts.autoScope || 'layer'}
            onChange={(e) => setOpts({ ...opts, autoScope: e.target.value })}>
            <option value="layer">Calque</option>
            <option value="group">Groupe</option>
          </Box>
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
      {tool === 'rect' && (
        <>
          <Tip label="Forme du cadre de sélection">
            <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
              border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
              value={opts.selShape} onChange={(e) => setOpts({ ...opts, selShape: e.target.value })}>
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
            </Box>
          </Tip>
          <Tip label="Contour progressif — adoucit le bord des remplissages/suppressions">
            <HStack gap="1">
              <Text {...row}>Plume</Text>
              <Input type="number" w="46px" h="18px" fontSize="2xs" px="1" min="0" max="250"
                value={opts.selFeather || 0}
                onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setOpts({ ...opts, selFeather: Math.max(0, Math.min(250, v)) }) }} />
              <Text {...row}>px</Text>
            </HStack>
          </Tip>
          <Tip label="Lisse le bord de la sélection (déconseillé pour les angles francs)">
            <HStack gap="1" cursor="pointer" onClick={() => setOpts({ ...opts, selAA: !opts.selAA })}>
              <Box w="12px" h="12px" borderRadius="sm" border="1px solid"
                borderColor={opts.selAA ? '#4f8fe8' : 'gray.500'} bg={opts.selAA ? '#4f8fe8' : 'transparent'}
                color="#ffffff" fontSize="2xs" lineHeight="12px" textAlign="center">
                {opts.selAA ? '✓' : ''}
              </Box>
              <Text {...row}>Anti-crénelage</Text>
            </HStack>
          </Tip>
          <Tip label="Style : libre, proportions fixe ou taille fixe (comme Photoshop)">
            <HStack gap="1">
              <Text {...row}>Style</Text>
              <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
                border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
                value={opts.selStyle || 'normal'}
                onChange={(e) => setOpts({ ...opts, selStyle: e.target.value })}>
                <option value="normal">Normal</option>
                <option value="ratio">Proportions fixe</option>
                <option value="fixed">Taille fixe</option>
              </Box>
            </HStack>
          </Tip>
          {opts.selStyle === 'ratio' && (
            <HStack gap="0.5">
              <Text {...row}>L</Text>
              <Input type="number" w="42px" h="18px" fontSize="2xs" px="1" min="1" value={opts.selRatioW || 1}
                onChange={(e) => { const v = +e.target.value; if (v > 0) setOpts({ ...opts, selRatioW: v }) }} />
              <Text {...row}>H</Text>
              <Input type="number" w="42px" h="18px" fontSize="2xs" px="1" min="1" value={opts.selRatioH || 1}
                onChange={(e) => { const v = +e.target.value; if (v > 0) setOpts({ ...opts, selRatioH: v }) }} />
            </HStack>
          )}
          {opts.selStyle === 'fixed' && (
            <HStack gap="0.5">
              <Text {...row}>L</Text>
              <Input type="number" w="48px" h="18px" fontSize="2xs" px="1" min="1" value={opts.selFixW || 200}
                onChange={(e) => { const v = +e.target.value; if (v > 0) setOpts({ ...opts, selFixW: v }) }} />
              <Text {...row}>H</Text>
              <Input type="number" w="48px" h="18px" fontSize="2xs" px="1" min="1" value={opts.selFixH || 200}
                onChange={(e) => { const v = +e.target.value; if (v > 0) setOpts({ ...opts, selFixH: v }) }} />
            </HStack>
          )}
          {hasSel && <Tip label="Affiner le bord : contour progressif, lissage, déplacement — Ctrl+Alt+R">
            {btn('Sélection et masque…', onSelMask)}</Tip>}
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
          color={canUndo ? fg : 'var(--s-a200)'} fontSize="14px"
          _hover={canUndo ? { bg: 'var(--s-a100)' } : undefined} onClick={canUndo ? onUndo : undefined}>
          <Box as={LuUndo2} />
        </Center>
      </Tip>
      <Tip label="Rétablir — Ctrl+Y">
        <Center w="24px" h="24px" borderRadius="sm" cursor={canRedo ? 'pointer' : 'default'}
          color={canRedo ? fg : 'var(--s-a200)'} fontSize="14px"
          _hover={canRedo ? { bg: 'var(--s-a100)' } : undefined} onClick={canRedo ? onRedo : undefined}>
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
          border="1.5px solid" borderColor={value === c ? fg : 'transparent'}
          onClick={() => onChange(c)} />
      ))}
      {/* couleur personnalisée : la puce « + » ouvre le sélecteur détaillé ;
          si la couleur courante est hors palette, elle s'affiche à sa place */}
      <Box
        w="14px" h="14px" borderRadius="sm" cursor="pointer"
        bg={custom ? value : 'transparent'} color={custom ? 'transparent' : fg}
        border="1.5px solid" borderColor={custom ? fg : 'gray.500'}
        fontSize="11px" lineHeight="12px" textAlign="center" fontWeight="700"
        onClick={onCustom}>
        {custom ? '' : '+'}
      </Box>
    </HStack>
  )
}

// ---- Panneau droit : Calques ----------------------------------------------------

export function LayersPanel({ editor, onChange, onFx, onAdjust }) {
  const [kind, setKind] = useState('all') // filtre « Genre » façon Photoshop
  const [dropHint, setDropHint] = useState(null) // {id, pos:'up'|'down'|'in'} — ligne cible du drag & drop
  const dragIdRef = useRef(null)
  // effets listés sous le calque : activés ou masqués par l'œil (_listed)
  const fxKeys = (l) => l.fx ? Object.keys(l.fx).filter((k) => l.fx[k]?.on || l.fx[k]?._listed) : []
  const match = (l) =>
    kind === 'all' ? true
      : kind === 'text' ? l.type === 'text'
        : kind === 'adjust' ? l.type === 'adjust'
          : kind === 'shape' ? l.type === 'shape'
            : kind === 'fx' ? fxKeys(l).some((k) => l.fx[k]?.on)
              : (l.type || 'pixel') === 'pixel' || l.type === 'fill'
  const layers = [...editor.layers].reverse().filter(match)
  const act = editor.active

  const num = (value, title, cb) => (
    <Tip label={title}>
      <Input type="number" w="42px" h="18px" fontSize="2xs" px="1" bg={S.input} color={fg}
        border="1px solid" borderColor={panelBorder} min="0" max="100"
        value={Math.round(value * 100)}
        onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) cb(Math.min(1, Math.max(0, v / 100))) }} />
    </Tip>
  )
  const kindBtn = (k, icon, label) => (
    <Tip key={k} label={label}>
      <Center w="20px" h="20px" borderRadius="sm" cursor="pointer" fontSize="11px"
        color={kind === k ? '#ffffff' : muted} bg={kind === k ? C.primary : 'transparent'}
        _hover={{ color: fg }} onClick={() => setKind(k)}>
        <Box as={icon} />
      </Center>
    </Tip>
  )
  const lockBtn = (key, icon, label) => (
    <Tip key={key} label={label}>
      <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="12px"
        color={act?.[key] ? '#f2c200' : muted} bg={act?.[key] ? 'var(--s-a100)' : 'transparent'}
        _hover={{ color: fg }}
        onClick={() => { if (!act) return; editor.snapshot('Verrou'); act[key] = !act[key]; onChange() }}>
        <Box as={icon} />
      </Center>
    </Tip>
  )
  return (
    <VStack align="stretch" gap="0" flex="1" overflowY="auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // dépôt dans le vide = bas de pile racine (sortir un calque d'un groupe)
        e.preventDefault()
        const did = dragIdRef.current
        dragIdRef.current = null
        setDropHint(null)
        const f = did != null && editor._find(did)
        if (!f || f.l.locked) return
        editor.snapshot('Déplacer')
        if (editor.moveToRoot(did, false)) { editor.setActive(did); onChange() }
      }}>
      {/* Genre — filtres de calques (Tous / pixels / texte / réglage / effets) */}
      <HStack px="2.5" py="1" gap="1" borderBottom="1px solid" borderColor={panelBorder}>
        <Text fontSize="2xs" color={muted} flexShrink={0}>Genre :</Text>
        {kindBtn('all', FiLayers, 'Tous les calques')}
        {kindBtn('pixel', FiImage, 'Calques de pixels')}
        {kindBtn('shape', FiShare2, 'Calques de forme vectoriels')}
        {kindBtn('text', FiType, 'Calques de texte')}
        {kindBtn('adjust', LuContrast, 'Calques de réglage')}
        {kindBtn('fx', FiZap, 'Calques avec des styles (effets)')}
      </HStack>
      {/* Fusion + Opacité — en haut comme Photoshop */}
      <HStack px="2.5" py="1" gap="2" borderBottom="1px solid" borderColor={panelBorder}>
        <Box as="select" flex="1" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
          border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
          value={act?.blend || 'source-over'} disabled={!act}
          onChange={(e) => { editor.snapshot(); act.blend = e.target.value; onChange() }}>
          {BLEND_MODES.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
        </Box>
        <Text fontSize="2xs" color={muted} flexShrink={0}>Opacité :</Text>
        {act ? num(act.opacity, 'Opacité — affecte le calque ET ses effets', (v) => { editor.snapshot(); act.opacity = v; onChange() })
          : <Input w="42px" h="18px" fontSize="2xs" px="1" bg={S.input} border="1px solid" borderColor={panelBorder} disabled />}
        <Text fontSize="2xs" color={muted}>%</Text>
      </HStack>
      {/* Verrou + Remplissage */}
      <HStack px="2.5" py="1" gap="1" borderBottom="1px solid" borderColor={panelBorder}>
        <Text fontSize="2xs" color={muted} flexShrink={0}>Verrou :</Text>
        {lockBtn('lockAlpha', FiGrid, 'Verrouiller les pixels transparents — le pinceau ne peint que sur l\'existant')}
        {lockBtn('lockPx', FiEdit2, 'Verrouiller les pixels — bloque pinceau, gomme, filtres')}
        {lockBtn('lockPos', FiMove, 'Verrouiller la position — l\'outil Déplacement est inactif')}
        {lockBtn('locked', FiLock, 'Tout verrouiller')}
        {act?.locked && <Text fontSize="2xs" color="#f2c200" ml="1">calque verrouillé</Text>}
        <Box flex="1" />
        <Text fontSize="2xs" color={muted} flexShrink={0}>Rempl. :</Text>
        {act ? num(act.fill ?? 1, 'Remplissage — affecte les pixels seuls (les effets fx restent visibles)', (v) => { editor.snapshot(); act.fill = v; onChange() })
          : <Input w="42px" h="18px" fontSize="2xs" px="1" bg={S.input} border="1px solid" borderColor={panelBorder} disabled />}
        <Text fontSize="2xs" color={muted}>%</Text>
      </HStack>
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
      {(() => {
        const renderRow = (l, depth) => {
          const fxs = fxKeys(l)
          const isAdjust = l.type === 'adjust'
          const isGroup = l.type === 'group'
          return (
            <Box key={l.id}>
              <HStack
                pr="2" py="1.5" gap="2" fontSize="xs" cursor="pointer"
                pl={`${8 + depth * 14}px`}
                draggable={!l.locked}
                onDragStart={(e) => { dragIdRef.current = l.id; e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { dragIdRef.current = null; setDropHint(null) }}
                onDragOver={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  if (dragIdRef.current == null || dragIdRef.current === l.id) return
                  const r = e.currentTarget.getBoundingClientRect()
                  const q = (e.clientY - r.top) / r.height
                  const pos = isGroup ? (q < 0.3 ? 'up' : q > 0.7 ? 'down' : 'in') : (q < 0.5 ? 'up' : 'down')
                  // refus visuel : déplacement illégal (descendant de soi, cible non-groupe…)
                  const where = pos === 'in' ? 'inside' : pos === 'up' ? 'after' : 'before'
                  if (!editor.canMove(dragIdRef.current, l.id, where)) {
                    e.dataTransfer.dropEffect = 'none'
                    if (dropHint?.id !== l.id || dropHint.pos !== 'no') setDropHint({ id: l.id, pos: 'no' })
                    return
                  }
                  e.dataTransfer.dropEffect = 'move'
                  if (dropHint?.id !== l.id || dropHint.pos !== pos) setDropHint({ id: l.id, pos })
                }}
                onDragLeave={() => { if (dropHint?.id === l.id) setDropHint(null) }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  setDropHint(null)
                  const did = dragIdRef.current
                  dragIdRef.current = null
                  if (did == null || did === l.id) return
                  // position recalculée depuis l'événement (le state dropHint peut être en retard)
                  const r = e.currentTarget.getBoundingClientRect()
                  const q = (e.clientY - r.top) / r.height
                  const pos = isGroup ? (q < 0.3 ? 'up' : q > 0.7 ? 'down' : 'in') : (q < 0.5 ? 'up' : 'down')
                  // affichage haut→bas = pile du haut vers le bas : 'up' visuel = 'after' dans le tableau
                  const where = pos === 'in' ? 'inside' : pos === 'up' ? 'after' : 'before'
                  if (!editor.canMove(did, l.id, where)) return
                  editor.snapshot('Déplacer')
                  if (editor.moveInto(did, l.id, where)) { editor.setActive(did); onChange() }
                }}
                bg={dropHint?.id === l.id && dropHint.pos === 'no' ? 'rgba(248,113,113,0.18)'
                  : dropHint?.id === l.id && dropHint.pos === 'in' ? 'rgba(79,143,232,0.25)'
                  : editor.activeId === l.id ? 'var(--s-a100)' : editor.selLayerIds?.has(l.id) ? 'var(--s-a50)' : 'transparent'}
                borderTop={dropHint?.id === l.id && dropHint.pos === 'up' ? '2px solid #4f8fe8' : '2px solid transparent'}
                borderBottom={dropHint?.id === l.id && dropHint.pos === 'down' ? '2px solid #4f8fe8' : '2px solid transparent'}
                color={l.visible ? fg : muted}
                onClick={(e) => {
                  // Ctrl+clic = multi-sélection (pour « Grouper les calques » Ctrl+G)
                  if (e.ctrlKey || e.metaKey) {
                    const s = editor.selLayerIds || (editor.selLayerIds = new Set())
                    if (s.has(l.id)) s.delete(l.id); else s.add(l.id)
                    onChange()
                    return
                  }
                  editor.selLayerIds?.clear()
                  editor.setActive(l.id)
                  onChange()
                  if (isAdjust) onAdjust?.(l)
                }}
              >
                {isGroup ? (
                  <Tip label={l.collapsed ? 'Déplier le groupe' : 'Plier le groupe'}>
                    <Box as={l.collapsed ? FiChevronRight : FiChevronDown} color={muted} fontSize="12px" flexShrink={0}
                      onClick={(e) => { e.stopPropagation(); l.collapsed = !l.collapsed; onChange() }} />
                  </Tip>
                ) : <Box w="12px" flexShrink={0} />}
                <Tip label={l.visible ? 'Masquer le calque' : 'Afficher le calque'}>
                <Box as={l.visible ? FiEye : FiEyeOff} color={muted} fontSize="13px" flexShrink={0}
                  onClick={(e) => { e.stopPropagation(); editor.toggleVisible(l.id); onChange() }} />
              </Tip>
              {l.clip && (
                <Tip label="Écrêté sur le calque inférieur">
                  <Text fontSize="xs" color="#4f8fe8" flexShrink="0" fontWeight="700">↳</Text>
                </Tip>
              )}
              <Tip label={isGroup ? 'Groupe de calques — contient les calques imbriqués' : isAdjust ? 'Calque de réglage — clic pour éditer les paramètres' : l.type === 'text' ? 'Calque de texte — éditable dans Propriétés' : l.type === 'shape' ? 'Calque de forme vectoriel — éditable dans Propriétés' : l.locked ? 'Arrière-plan verrouillé — dupliquez-le pour retoucher' : `Calque actif : ${l.name}`}>
                {isGroup ? (
                  <Center w="42px" h="30px" flexShrink={0} borderRadius="sm" bg={S.tile}
                    border="1px solid" borderColor="#6b7280" color="#e5e7eb" fontSize="15px">
                    <Box as={FiFolder} />
                  </Center>
                ) : isAdjust ? (
                  <Center w="42px" h="30px" flexShrink={0} borderRadius="sm" bg={S.tile}
                    border="1px solid" borderColor="#7c3aed" color="#c4b5fd" fontSize="15px">
                    <Box as={LuContrast} />
                  </Center>
                ) : l.type === 'text' ? (
                  <Center w="42px" h="30px" flexShrink={0} borderRadius="sm" bg={S.tile}
                    border="1px solid" borderColor="#b45309" color="#fcd34d" fontSize="15px" fontWeight="700">
                    T
                  </Center>
                ) : (
                  <Box w="42px" h="30px" flexShrink={0} borderRadius="sm" overflow="hidden"
                    bg={S.tile} border="1px solid" borderColor="var(--s-a100)">
                    <img src={editor.layerThumb(l)} alt="" style={{ width: '100%', height: '100%' }} />
                  </Box>
                )}
              </Tip>
              {l.mask && (
                <Tip label={l.maskActive ? 'Masque actif — le pinceau édite le masque (noir masque, blanc révèle)' : 'Masque de fusion — clic pour éditer'}>
                  <Box w="30px" h="22px" flexShrink={0} borderRadius="sm" overflow="hidden"
                    border="2px solid" borderColor={l.maskActive ? '#22d3ee' : 'var(--s-a200)'}
                    cursor="pointer"
                    onClick={(e) => { e.stopPropagation(); editor.snapshot('Masque'); l.maskActive = !l.maskActive; onChange() }}>
                    <img src={editor.maskThumb(l)} alt="" style={{ width: '100%', height: '100%' }} />
                  </Box>
                </Tip>
              )}
              <Text flex="1" isTruncated>{l.name}{l.locked ? ' 🔒' : ''}</Text>
              {fxs.length > 0 && (
                <Tip label="Style de calque — clic pour éditer">
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
            {/* Sous-liste des effets — façon Photoshop : groupe « Effets » + œil par effet */}
            {fxs.length > 0 && (
              <VStack align="stretch" gap="0" pl="8" pb="1">
                <HStack gap="1.5" py="0.5">
                  <Tip label={l.fxOff ? 'Afficher tous les effets' : 'Masquer tous les effets'}>
                    <Box as={l.fxOff ? FiEyeOff : FiEye} color={l.fxOff ? 'var(--s-a300)' : muted}
                      fontSize="11px" cursor="pointer" flexShrink={0}
                      onClick={() => { editor.snapshot('Effets'); l.fxOff = !l.fxOff; onChange() }} />
                  </Tip>
                  <Text fontSize="2xs" color={l.fxOff ? 'var(--s-a300)' : fg} fontStyle="italic">Effets</Text>
                </HStack>
                {fxs.map((k) => {
                  const f = l.fx[k]
                  return (
                    <HStack key={k} gap="1.5" pl="4" py="0.5">
                      <Tip label={f.on ? `Masquer « ${FX_NAMES[k] || k} »` : `Afficher « ${FX_NAMES[k] || k} »`}>
                        <Box as={f.on ? FiEye : FiEyeOff} color={f.on ? muted : 'var(--s-a300)'}
                          fontSize="11px" cursor="pointer" flexShrink={0}
                          onClick={() => { editor.snapshot('Effet'); f.on = !f.on; f._listed = true; onChange() }} />
                      </Tip>
                      <Tip label="Modifier cet effet">
                        <Text fontSize="2xs" color={f.on ? fg : 'var(--s-a300)'} cursor="pointer"
                          _hover={{ color: fg }} isTruncated
                          onClick={() => { editor.setActive(l.id); onFx?.(k) }}>{FX_NAMES[k] || k}</Text>
                      </Tip>
                    </HStack>
                  )
                })}
              </VStack>
            )}
            <Box h="1px" bg="var(--s-a50)" />
            {isGroup && !l.collapsed &&
              (l.children || []).slice().reverse().filter(match).map((c) => renderRow(c, depth + 1))}
          </Box>
          )
        }
        return layers.map((l) => renderRow(l, 0))
      })()}
      {/* Barre d'icônes en bas — façon Photoshop */}
      <HStack px="2.5" py="1.5" gap="1" mt="auto" borderTop="1px solid" borderColor={panelBorder} justify="flex-end">
        <Tip label="Style de calque — ombres, lueurs, contour, incrustations…">
          <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="11px" fontWeight="700"
            color={fxKeys(act || {}).some((k) => act?.fx?.[k]?.on) ? C.primary : muted}
            _hover={{ color: fg }} onClick={() => act && onFx?.()}>fx</Center>
        </Tip>
        {act && !act.locked && act.type !== 'adjust' && (
          <Tip label={act.mask ? 'Supprimer le masque de fusion' : 'Ajouter un masque de fusion (depuis la sélection si elle existe)'}>
            <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="14px"
              color={act.mask ? C.primary : muted} _hover={{ color: fg }}
              onClick={() => {
                editor.snapshot('Masque de fusion')
                if (act.mask) editor.removeMask(act)
                else editor.addMask(act, !!(editor.sel || editor.selPoly))
                onChange()
              }}>
              <Box as={TbMask} />
            </Center>
          </Tip>
        )}
        <Tip label="Calque de réglage non destructif (teinte, niveaux, N&B…)">
          <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="14px" color={muted} _hover={{ color: fg }}
            onClick={() => { editor.snapshot('Calque de réglage'); const l = editor.addAdjustLayer('bc'); onChange(); onAdjust?.(l) }}>
            <Box as={LuContrast} />
          </Center>
        </Tip>
        <Tip label="Nouveau groupe de calques (dossier)">
          <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="14px" color={muted} _hover={{ color: fg }}
            onClick={() => { editor.snapshot('Groupe'); editor.addGroup(); onChange() }}>
            <Box as={FiFolderPlus} />
          </Center>
        </Tip>
        <Tip label="Calque de remplissage uni (blanc — couleur rééditable dans Propriétés)">
          <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="14px" color={muted} _hover={{ color: fg }}
            onClick={() => { editor.snapshot('Remplissage'); editor.addFillLayer({ kind: 'solid', color: '#ffffff' }); onChange() }}>
            <Box as={LuPaintBucket} />
          </Center>
        </Tip>
        <Tip label="Nouveau calque transparent au-dessus">
          <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="14px" color={muted} _hover={{ color: fg }}
            onClick={() => { editor.snapshot('Nouveau calque'); editor.addLayer(); onChange() }}>
            <Box as={FiPlus} />
          </Center>
        </Tip>
        {act && !act.locked && (
          <Tip label="Supprimer le calque">
            <Center w="22px" h="22px" borderRadius="sm" cursor="pointer" fontSize="13px" color={muted} _hover={{ color: '#f87171' }}
              onClick={() => { editor.snapshot('Supprimer'); editor.removeLayer(act.id); onChange() }}>
              <Box as={FiTrash2} />
            </Center>
          </Tip>
        )}
      </HStack>
    </VStack>
  )
}

// ---- Panneau droit : Réglages (groupés façon Lightroom) ----------------------------

function Section({ title, right, children, collapsible = false }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <Box borderBottom="1px solid" borderColor="var(--s-a50)" pb="2.5">
      <HStack justify="space-between" mb="1.5">
        {collapsible ? (
          <Box as="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} color={fg}>
            <HStack gap="1"><Box as={expanded ? FiChevronDown : FiChevronRight} /><Text fontSize="2xs" fontWeight="700">{title}</Text></HStack>
          </Box>
        ) : <Text fontSize="2xs" fontWeight="700" color={fg} textTransform="uppercase" letterSpacing="wider">{title}</Text>}
        {right}
      </HStack>
      {(!collapsible || expanded) && <VStack align="stretch" gap="1.5">{children}</VStack>}
    </Box>
  )
}

function Slider({ d, value, onChange, onStart, disabled = false }) {
  const disp = d.fmt ? d.fmt(value) : `${value}${d.unit || ''}`
  return (
    <Tip label={d.tip || d.label} display="block">
      <HStack justify="space-between" mb="0.5">
        <Text fontSize="2xs" color={muted}>{d.label}</Text>
        <Text fontSize="2xs" color={fg} w="52px" textAlign="right">{disp}</Text>
      </HStack>
      <Input type="range" min={d.min} max={d.max} step={d.step || 1} h="16px"
        value={value} disabled={disabled} aria-label={d.label} onPointerDown={onStart}
        onKeyDown={(e) => { if (!e.repeat && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) onStart?.() }}
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
  const groupKeys = (group) => [...group.defs.map((d) => d.key), ...(group.wb ? ['wb'] : [])]
  const hidden = (group) => groupKeys(group).some((key) => editor.adjustBypass[key])
  const toggleGroup = (group) => {
    editor.snapshot(`Visibilité ${group.title}`)
    const value = !hidden(group)
    for (const key of groupKeys(group)) editor.adjustBypass[key] = value
    onChange()
  }
  const resetGroup = (group) => {
    editor.snapshot(`Réinitialiser ${group.title}`)
    for (const key of groupKeys(group)) {
      delete editor.adjustBypass[key]
      if (key === 'wb') editor.wb = null
      else editor.adjust[key] = DEFAULT_ADJUST[key]
    }
    onChange()
  }

  const applyPreset = (p) => {
    editor.snapshot()
    editor.adjust = { ...DEFAULT_ADJUST, ...p.adjust }
    editor.adjustBypass = {}
    editor.adjustVisible = true
    onChange()
  }
  const [presetOpen, setPresetOpen] = useState(false)
  const savePreset = () => setPresetOpen(true)
  const doSavePreset = (name) => {
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
      {/* Calques de réglage — créés masqués sur la sélection active s'il y en a une */}
      <Section title="Nouveau calque de réglage"
        right={editor.sel || editor.selPoly ? <Text fontSize="2xs" color={C.primary}>masqué sur la sélection</Text> : null}>
        <SimpleGrid columns={2} gap="1.5">
          {ADJUST_KINDS.map((k) => (
            <Tip key={k.key} label={`Nouveau calque de réglage « ${k.label} » — non destructif`}>
              <Box as="button" px="2" py="1" fontSize="2xs" borderRadius="sm" cursor="pointer"
                bg="var(--s-a100)" color={fg} _hover={{ bg: 'var(--s-a200)' }} textAlign="left"
                onClick={() => { editor.snapshot('Calque de réglage'); editor.addAdjustLayer(k.key); onChange() }}>
                {k.label}
              </Box>
            </Tip>
          ))}
        </SimpleGrid>
      </Section>

      {/* Comparaison avant/après sur le canevas */}
      <Section title="Comparaison">
        <Tip label="Original à gauche du séparateur jaune, retouche à droite — Q" display="block">
          <Box as="button" px="2" py="1" fontSize="2xs" borderRadius="sm" cursor="pointer"
            bg={comparing ? '#f2c200' : 'var(--s-a100)'} color={comparing ? '#111827' : fg}
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
                bg="var(--s-a100)" color={fg} cursor="pointer" _hover={{ bg: 'var(--s-a200)' }}
                onClick={() => applyPreset(p)}>
                {p.name}
              </Box>
            </Tip>
          ))}
        </HStack>
      </Section>

      {ADJUST_GROUPS.map((g) => (
        <Section key={g.title} title={g.title} collapsible
          right={<HStack gap="2">
            {g.levels && <Tip label="Niveaux automatiques — noirs/blancs calés sur l'histogramme">
              <Box as="button" disabled={hidden(g)} fontSize="2xs" color={C.primary} cursor="pointer" onClick={autoLevels}>Auto</Box>
            </Tip>}
            <Tip label={`Afficher / masquer ${g.title}`}>
              <Box as="button" aria-label={`Visibilité ${g.title}`} aria-pressed={!hidden(g)} color={hidden(g) ? muted : C.primary}
                onClick={() => toggleGroup(g)}><Box as={hidden(g) ? FiEyeOff : FiEye} /></Box>
            </Tip>
            <Tip label={`Réinitialiser ${g.title} uniquement`}>
              <Box as="button" aria-label={`Réinitialiser ${g.title}`} color={muted} onClick={() => resetGroup(g)}><FiRefreshCw /></Box>
            </Tip>
          </HStack>}>
          {hidden(g) && <Text fontSize="2xs" color={muted}>Effet masqué — valeurs conservées</Text>}
          {g.wb && (
            <HStack gap="2">
              <Tip label="Cliquez une zone neutre (grise) de la photo — corrige la dominante couleur">
                <Box as="button" px="2" py="0.5" fontSize="2xs" borderRadius="sm" cursor="pointer"
                  bg={wbPick ? '#f2c200' : 'var(--s-a100)'} color={wbPick ? '#111827' : fg}
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
              onChange={set(d.key)} onStart={snap} disabled={hidden(g)} />
          ))}
        </Section>
      ))}

      <Tip label="Remettre tous les réglages, courbes et balance des blancs à zéro" display="block">
        <Box as="button" px="2" py="1" fontSize="2xs" borderRadius="sm"
          bg="var(--s-a100)" color={muted} cursor="pointer" _hover={{ bg: 'var(--s-a200)' }}
          onClick={() => {
          editor.snapshot()
          editor.adjust = { ...DEFAULT_ADJUST }
          editor.adjustBypass = {}
          editor.adjustVisible = true
          editor.curves = { rgb: null, r: null, g: null, b: null }
          editor.wb = null
          onChange()
        }}>
          Réinitialiser tous les réglages
        </Box>
      </Tip>
      <PromptModal open={presetOpen} onClose={() => setPresetOpen(false)}
        title="Enregistrer le préréglage" subtitle="Réglages actuels du panneau Ajustements"
        label="Nom" defaultValue="Mon réglage" confirmLabel="Enregistrer"
        onSubmit={doSavePreset} />
    </VStack>
  )
}

// ---- Panneau droit : Courbes (histogramme + courbe par canal) ----------------------
//
// Zone carrée 216px = [0..255]². Clic près de la courbe : nouveau point.
// Drag d'un point : déplace. Sortir un point du cadre : supprime.

export function CurvesPanel({ editor, onChange, target }) {
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
    ctx.fillStyle = svar('--s-deep', '#0d1117'); ctx.fillRect(0, 0, W, H)
    // histogramme de luminance
    try {
      const { h, max } = histogram(editor.compositeFiltered())
      ctx.fillStyle = svar('--s-a300', 'rgba(255,255,255,0.16)')
      for (let i = 0; i < 256; i += 2) {
        const hh = (h[i] / max) * H * 0.85
        ctx.fillRect(v2px(i), H - hh, Math.max(1, W / 128), hh)
      }
    } catch { /* doc pas prêt */ }
    // grille 4×4 + diagonale
    ctx.strokeStyle = svar('--s-a100', 'rgba(255,255,255,0.08)')
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo((W / 4) * i, 0); ctx.lineTo((W / 4) * i, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke()
    }
    ctx.strokeStyle = svar('--s-a200', 'rgba(255,255,255,0.15)')
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
        <Box as="select" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
          border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
          value={ch} onChange={(e) => setCh(e.target.value)}>
          {CURVE_CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Box>
        <Box flex="1" />
        <Tip label="Réinitialiser la courbe de ce canal">
          <Box as="button" fontSize="2xs" px="2" h="20px" borderRadius="sm"
            bg="var(--s-a100)" color={muted} cursor="pointer"
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
      bg={active ? C.greenText : C.greenBg} color={active ? C.greenBg : C.greenText}
      border="1px solid" borderColor={active ? C.greenText : C.greenBorder}
      fontWeight={active ? '700' : '600'} opacity={disabled ? 0.45 : 1}
      _hover={disabled ? {} : { borderColor: C.greenText }}
      onClick={disabled ? undefined : onClick}>
      {children}
    </Box>
  </Tip>
)

export function DentalPanel({ editor, onChange, dental }) {
  const {
    comparing, onCompare, onMontage,
    straighten, setStraighten, onApplyStraighten,
    wbPick, onWbPick, onCalRef,
    shade, onShade, srcPhoto,
    shadePick, onShadePick, shadeGuess, onApplyGuess, onDismissGuess, onAnalyzeSel, hasSel,
    steps, refStep, onRefStep, refImg, refOverlay, onToggleOverlay, onPickRef, onProtocolGuide,
    onSheet,
    fdiArm, onFdiArm, smileGuide, onToggleSmileGuide,
    measureLog, onClearMeasureLog, onRemoveMeasure,
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
        {/* Analyse assistée : pipette sur la dent ou moyenne de la sélection → VITA le plus proche */}
        <VStack align="stretch" gap="1.5">
          <DBtn tip="Cliquez ensuite sur la dent dans l'image — la couleur moyenne est convertie en teinte VITA"
            active={shadePick} disabled={!editor.w} onClick={onShadePick}>
            {shadePick ? '🎯 Cliquez sur la dent…' : 'Analyser la teinte (pipette)'}
          </DBtn>
          <DBtn tip="Teinte VITA déduite de la couleur moyenne de la sélection courante"
            disabled={!hasSel} onClick={onAnalyzeSel}>
            Analyser la sélection
          </DBtn>
          {shadeGuess && (
            <HStack bg="var(--s-a50)" border="1px solid" borderColor={panelBorder}
              borderRadius="md" px="2" py="1.5" gap="2">
              <Box w="22px" h="22px" borderRadius="sm" flexShrink="0" border="1px solid" borderColor={panelBorder}
                bg={shadeGuess.rgb ? `rgb(${shadeGuess.rgb.join(',')})` : 'transparent'} />
              <VStack align="stretch" gap="0" flex="1" minW="0">
                <Text fontSize="2xs" color={fg} fontWeight="700">
                  Teinte détectée : <Box as="span" color="#f2c200">{shadeGuess.code}</Box>
                </Text>
                <Text fontSize="2xs" color={muted}>
                  ΔE {shadeGuess.de.toFixed(1)} {shadeGuess.de < 5 ? '— excellente correspondance' : shadeGuess.de < 10 ? '— correspondance correcte' : '— approximative'}
                </Text>
              </VStack>
              <Box as="button" px="2" py="1" fontSize="2xs" borderRadius="sm" cursor="pointer"
                bg={C.primary} color="#ffffff" onClick={onApplyGuess}>Appliquer</Box>
              <Box as="button" px="1.5" py="1" fontSize="2xs" borderRadius="sm" cursor="pointer"
                color={muted} onClick={onDismissGuess}>✕</Box>
            </HStack>
          )}
        </VStack>
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
          <DBtn tip="Modèles de cadrage, protocoles du cabinet et références personnelles" onClick={onProtocolGuide}>
            Protocoles & références…
          </DBtn>
          {(steps || []).length > 0 && (
            <Tip label="Vue de référence du protocole DentoPic">
              <Box as="select" w="100%" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
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

      {/* Numérotation FDI */}
      <Section title="Numérotation FDI">
        <Text fontSize="2xs" color={muted}>
          Cliquez une dent puis cliquez sur l'image — le numéro est posé en calque texte.
        </Text>
        {[1, 2, 3, 4].map((q) => (
          <HStack key={q} gap="1">
            {FDI_TEETH.filter((t) => t.quadrant === q).map((t) => (
              <Tip key={t.code} label={`Dent ${t.code} — ${fdiArm === t.code ? 'cliquez sur l\'image' : 'armer la pose'}`}>
                <Box as="button" flex="1" h="22px" fontSize="2xs" fontWeight="700" borderRadius="sm"
                  cursor="pointer" border="1px solid"
                  borderColor={fdiArm === t.code ? '#f2c200' : panelBorder}
                  bg={fdiArm === t.code ? '#f2c200' : 'var(--s-a100)'}
                  color={fdiArm === t.code ? '#111827' : fg}
                  onClick={() => onFdiArm(fdiArm === t.code ? null : t.code)}>
                  {t.code}
                </Box>
              </Tip>
            ))}
          </HStack>
        ))}
        {fdiArm && (
          <Text fontSize="2xs" color="#f2c200" fontWeight="700">
            Pose armée : {fdiArm} — cliquez sur l'image
          </Text>
        )}
      </Section>

      {/* Repères esthétiques */}
      <Section title="Repères esthétiques">
        <DBtn tip="Ligne médiane + tiers verticaux du sourire + proportions dorées — superposition non destructive"
          active={smileGuide} onClick={onToggleSmileGuide}>
          {smileGuide ? 'Guides du sourire ✓' : 'Guides du sourire'}
        </DBtn>
      </Section>

      {/* Journal des mesures */}
      <Section title="Journal des mesures">
        {(measureLog || []).length === 0 ? (
          <Text fontSize="2xs" color={muted}>
            Outil Règle : chaque ligne tracée est consignée ici (px, et mm après étalonnage).
          </Text>
        ) : (
          <VStack align="stretch" gap="1" maxH="180px" overflowY="auto">
            {measureLog.map((m, i) => (
              <HStack key={m.id} gap="2" px="2" py="1" borderRadius="sm" bg="var(--s-a100)" fontSize="2xs">
                <Text color={muted} w="34px">#{i + 1} {m.t}</Text>
                <Text flex="1" color={fg}>{m.len.toFixed(1)} px{m.mm != null ? ` · ${m.mm.toFixed(2)} mm` : ''}</Text>
                <Box as="button" color={muted} cursor="pointer" _hover={{ color: '#f87171' }}
                  onClick={() => onRemoveMeasure?.(m.id)}>✕</Box>
              </HStack>
            ))}
            <DBtn tip="Vider le journal" onClick={onClearMeasureLog}>Effacer le journal</DBtn>
          </VStack>
        )}
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
  const [ch, setCh] = useState('rgb') // RVB superposé ou canal isolé, comme Photoshop
  const W = 216, H = 120
  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !editor.w) return
    const ctx = cv.getContext('2d')
    ctx.fillStyle = svar('--s-deep', '#0d1117'); ctx.fillRect(0, 0, W, H)
    try {
      const comp = editor.compositeFiltered()
      const draw = (h, color, a = 0.8) => {
        const mx = Math.max(...h) || 1
        ctx.fillStyle = color
        ctx.globalAlpha = a
        for (let i = 0; i < 256; i += 2) {
          const hh = (h[i] / mx) * H * 0.9
          ctx.fillRect((i / 255) * W, H - hh, Math.max(1, W / 128), hh)
        }
        ctx.globalAlpha = 1
      }
      if (ch === 'rgb') {
        // RVB : les trois canaux superposés + stats de luminance (comme Photoshop)
        const stR = histogram(comp, 8, 'r'), stG = histogram(comp, 8, 'g'), stB = histogram(comp, 8, 'b')
        const stL = histogram(comp, 8, 'lum')
        draw(stR.h, '#e05d5d', 0.55); draw(stG.h, '#5dc46a', 0.55); draw(stB.h, '#5d8de0', 0.55)
        setStats(stL)
      } else {
        const st = histogram(comp, 8, ch)
        draw(st.h, { r: '#e05d5d', g: '#5dc46a', b: '#5d8de0' }[ch] || svar('--s-a400', 'rgba(255,255,255,0.75)'))
        setStats(st)
      }
    } catch { /* doc pas prêt */ }
  }, [version, ch, getMode()]) // eslint-disable-line
  return (
    <VStack align="stretch" gap="2" px="3" py="3" flex="1" overflowY="auto">
      <Box as="select" w="100%" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
        border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
        title="Canal affiché dans l'histogramme"
        value={ch} onChange={(e) => setCh(e.target.value)}>
        <option value="rgb">RVB</option>
        <option value="lum">Luminosité</option>
        <option value="r">Rouge</option>
        <option value="g">Vert</option>
        <option value="b">Bleu</option>
      </Box>
      <Tip label="Distribution tonale du composite édité (canaux superposés en RVB)" display="block">
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
    ctx.fillStyle = svar('--s-deep', '#0d1117'); ctx.fillRect(0, 0, W, navH)
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
  useEffect(draw, [version, view, stageSize, getMode()]) // eslint-disable-line
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

// ---- Petit histogramme (panneau Propriétés, façon Photoshop) -----------------------

function MiniHist({ editor, version, w = 150, h = 56 }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || !editor.w) return
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    const { h: hist, max } = histogram(editor.compositeFiltered())
    ctx.fillStyle = svar('--s-muted', '#cfd8e3')
    for (let i = 0; i < 256; i++) {
      const v = Math.min(1, hist[i] / (max || 1))
      const y = h - v * (h - 2)
      ctx.fillRect(i * w / 256, y, Math.max(1, w / 256), h - y)
    }
  }, [version, editor, w, h, getMode()])
  return <canvas ref={ref} width={w} height={h} style={{ display: 'block' }} />
}

// ---- Propriétés du calque de réglage sélectionné — façon Photoshop -----------------
// (le panneau « Propriétés » de Ps affiche les paramètres du réglage + l'histogramme)

// ---- Propriétés d'un calque de texte (Caractère + Paragraphe, façon Photoshop) ------

function NumXY({ label, value, onChange, min = -9999, max = 9999 }) {
  return (
    <VStack align="stretch" gap="0" flex="1">
      <Text fontSize="2xs" color={muted}>{label}</Text>
      <Input type="number" h="20px" fontSize="2xs" px="1" bg={S.input} color={fg}
        border="1px solid" borderColor={panelBorder} min={min} max={max}
        value={Math.round(value)} onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) onChange(v) }} />
    </VStack>
  )
}

/** Champs X / Y / L / H + Opacité / Remplissage communs (haut du panneau Propriétés). */
function LayerBox({ editor, layer, onChange, w, h }) {
  return (
    <VStack align="stretch" gap="2">
      <HStack gap="1.5">
        <NumXY label="X" value={layer.dx || 0} onChange={(v) => { editor.snapshot('Déplacer'); layer.dx = v; onChange() }} />
        <NumXY label="Y" value={layer.dy || 0} onChange={(v) => { editor.snapshot('Déplacer'); layer.dy = v; onChange() }} />
      </HStack>
      <HStack gap="1.5">
        <VStack align="stretch" gap="0" flex="1"><Text fontSize="2xs" color={muted}>L</Text>
          <Input h="20px" fontSize="2xs" px="1" bg={S.input} color={muted} border="1px solid" borderColor={panelBorder} value={`${Math.round(w)} px`} readOnly /></VStack>
        <VStack align="stretch" gap="0" flex="1"><Text fontSize="2xs" color={muted}>H</Text>
          <Input h="20px" fontSize="2xs" px="1" bg={S.input} color={muted} border="1px solid" borderColor={panelBorder} value={`${Math.round(h)} px`} readOnly /></VStack>
      </HStack>
      {[{ l: 'Opacité', k: 'opacity' }, { l: 'Remplissage', k: 'fill' }].map(({ l: lb, k }) => (
        <VStack key={k} align="stretch" gap="0.5">
          <HStack justify="space-between">
            <Text fontSize="2xs" color={muted}>{lb}</Text>
            <Text fontSize="2xs" color={fg}>{Math.round((layer[k] ?? 1) * 100)} %</Text>
          </HStack>
          <Input type="range" min="0" max="1" step="0.01" h="16px" value={layer[k] ?? 1}
            onPointerDown={() => editor.snapshot(lb)}
            onChange={(e) => { layer[k] = +e.target.value; onChange() }} />
        </VStack>
      ))}
    </VStack>
  )
}

/** Calque de texte : Caractère (police, style, taille, crénage, couleur) + Paragraphe. */
function TextLayerProps({ editor, layer, onChange }) {
  const t = layer.text || {}
  const up = (patch) => { editor.updateText(layer, patch); onChange() }
  const snap = () => editor.snapshot('Texte')
  const tgl = (k) => { snap(); up({ [k]: !t[k] }) }
  const alignBtn = (a, label) => (
    <Tip key={a} label={label}>
      <Center w="24px" h="20px" borderRadius="sm" cursor="pointer" fontSize="12px"
        bg={(t.align || 'left') === a ? C.primary : 'var(--s-a100)'} color={(t.align || 'left') === a ? '#ffffff' : fg}
        onClick={() => { snap(); up({ align: a }) }}>
        <Box as={a === 'center' ? FiAlignCenter : a === 'right' ? FiAlignRight : FiAlignLeft} />
      </Center>
    </Tip>
  )
  const tNum = (label, key, val, min, max, step) => (
    <VStack align="stretch" gap="0" flex="1"><Text fontSize="2xs" color={muted}>{label}</Text>
      <Input type="number" h="20px" fontSize="2xs" px="1" bg={S.input} color={fg} step={step}
        border="1px solid" borderColor={panelBorder} min={min} max={max} value={val}
        onFocus={snap}
        onChange={(e) => { const v = +e.target.value; if (!isNaN(v) && v >= min) up({ [key]: Math.min(max, v) }) }} /></VStack>
  )
  return (
    <VStack align="stretch" gap="2" px="3" py="3" overflowY="auto" flex="1">
      <Text fontSize="2xs" color={muted}>Calque de texte</Text>
      <LayerBox editor={editor} layer={layer} onChange={onChange}
        w={t.box?.w || 0} h={t.box?.h || 0} />
      <Box h="1px" bg="var(--s-a50)" />
      <Text fontSize="2xs" fontWeight="700" color={fg} textTransform="uppercase" letterSpacing="wider">Caractère</Text>
      <Box as="select" w="100%" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
        border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
        value={t.font || 'Arial'}
        onChange={(e) => { snap(); up({ font: e.target.value }) }}>
        {TEXT_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </Box>
      <HStack gap="1.5" align="end">
        {tNum('Taille', 'size', t.size || 48, 1, 400, 1)}
        {tNum('Crénage', 'tracking', t.tracking || 0, -20, 100, 1)}
        <HStack gap="1">
          <Box as="button" w="20px" h="20px" fontSize="xs" fontWeight="700" borderRadius="sm" cursor="pointer"
            bg={t.bold ? C.primary : 'var(--s-a100)'} color={t.bold ? '#ffffff' : fg} onClick={() => tgl('bold')}>B</Box>
          <Box as="button" w="20px" h="20px" fontSize="xs" fontStyle="italic" borderRadius="sm" cursor="pointer"
            bg={t.italic ? C.primary : 'var(--s-a100)'} color={t.italic ? '#ffffff' : fg} onClick={() => tgl('italic')}>I</Box>
        </HStack>
      </HStack>
      <HStack gap="1.5" align="end">
        {tNum('Interligne ×', 'leading', t.leading || 1.2, 0.5, 4, 0.1)}
        <VStack align="stretch" gap="0"><Text fontSize="2xs" color={muted}>Couleur</Text>
          <Input type="color" w="44px" h="22px" p="0" value={t.color || '#ffffff'}
            onPointerDown={snap}
            onChange={(e) => up({ color: e.target.value })} /></VStack>
      </HStack>
      <HStack gap="1.5" align="end">
        {tNum('Échelle H %', 'scaleX', t.scaleX ?? 100, 10, 400, 5)}
        {tNum('Échelle V %', 'scaleY', t.scaleY ?? 100, 10, 400, 5)}
        {tNum('Décalage', 'baseline', t.baseline || 0, -200, 200, 1)}
      </HStack>
      <Box h="1px" bg="var(--s-a50)" />
      <Text fontSize="2xs" fontWeight="700" color={fg} textTransform="uppercase" letterSpacing="wider">Paragraphe</Text>
      <HStack gap="1">
        {alignBtn('left', 'Aligner à gauche')}
        {alignBtn('center', 'Centrer')}
        {alignBtn('right', 'Aligner à droite')}
      </HStack>
      <HStack gap="1.5" align="end">
        {tNum('Retrait G', 'indentL', t.indentL || 0, 0, 1000, 1)}
        {tNum('Retrait D', 'indentR', t.indentR || 0, 0, 1000, 1)}
      </HStack>
      <HStack gap="1.5" align="end">
        {tNum('Espace avant', 'spaceBefore', t.spaceBefore || 0, 0, 400, 1)}
        {tNum('Espace après', 'spaceAfter', t.spaceAfter || 0, 0, 400, 1)}
      </HStack>
      <VStack align="stretch" gap="0">
        <Text fontSize="2xs" color={muted}>Largeur de boîte — 0 = pas de coupure</Text>
        <Input type="number" h="20px" fontSize="2xs" px="1" bg={S.input} color={fg}
          border="1px solid" borderColor={panelBorder} min="0" max="8000" value={t.boxW || 0}
          onFocus={snap}
          onChange={(e) => { const v = +e.target.value; if (!isNaN(v) && v >= 0) up({ boxW: v || 0 }) }} />
      </VStack>
      <Box h="1px" bg="var(--s-a50)" />
      <Text fontSize="2xs" fontWeight="700" color={fg} textTransform="uppercase" letterSpacing="wider">Contenu</Text>
      <Box as="textarea" rows="3" fontSize="xs" bg={S.input} color={fg} borderRadius="sm"
        border="1px solid" borderColor={panelBorder} px="2" py="1.5" resize="vertical"
        value={t.value || ''} onFocus={snap}
        onChange={(e) => up({ value: e.target.value })} />
      <Text fontSize="2xs" color={muted}>
        Texte pleinement éditable — comme un calque « T » de Photoshop.
      </Text>
    </VStack>
  )
}

/** Calque de pixels : position, taille du document, opacité/remplissage, hint fx. */
// ---- Calque de forme : position/taille + Apparence (Fond / Contour) -----------

function ShapeLayerProps({ editor, layer, onChange }) {
  const s = layer.shape || {}
  const up = (patch) => { editor.updateShape(layer, patch); onChange() }
  const snap = () => editor.snapshot('Forme')
  const shNum = (label, key, val, min, max, step = 1) => (
    <VStack align="stretch" gap="0" flex="1"><Text fontSize="2xs" color={muted}>{label}</Text>
      <Input type="number" h="20px" fontSize="2xs" px="1" bg={S.input} color={fg} step={step}
        border="1px solid" borderColor={panelBorder} min={min} max={max} value={val}
        onFocus={snap}
        onChange={(e) => { const v = +e.target.value; if (!isNaN(v) && v >= min) up({ [key]: Math.min(max, v) }) }} /></VStack>
  )
  const sw = (label, key, val, noneLabel) => (
    <HStack gap="1.5" flex="1">
      <Text fontSize="2xs" color={muted} w="44px">{label}</Text>
      <Box w="20px" h="20px" borderRadius="sm" border="1px solid" borderColor={panelBorder}
        bg={val || 'transparent'} position="relative">
        <Input type="color" w="100%" h="100%" opacity="0" cursor="pointer" value={val || '#000000'}
          onFocus={snap}
          onChange={(e) => up({ [key]: e.target.value })} />
        {!val && <Text position="absolute" inset="0" fontSize="xs" color={muted} textAlign="center" lineHeight="18px" pointerEvents="none">∅</Text>}
      </Box>
      {val != null && noneLabel && (
        <Text fontSize="2xs" color={muted} cursor="pointer" textDecoration="underline"
          onClick={() => { snap(); up({ [key]: null }) }}>aucun</Text>
      )}
      {val == null && (
        <Text fontSize="2xs" color={muted} cursor="pointer" textDecoration="underline"
          onClick={() => { snap(); up({ [key]: '#ffffff' }) }}>définir</Text>
      )}
    </HStack>
  )
  return (
    <VStack align="stretch" gap="2" px="3" py="3" overflowY="auto" flex="1">
      <Text fontSize="2xs" color={muted}>Calque de forme</Text>
      <LayerBox editor={editor} layer={layer} onChange={onChange}
        w={s.w || 0} h={s.h || 0} />
      <Box h="1px" bg="var(--s-a50)" />
      <Text fontSize="2xs" fontWeight="700" color={fg} textTransform="uppercase" letterSpacing="wider">Apparence</Text>
      <HStack gap="3" align="center">
        {sw('Fond', 'fill', s.fill, true)}
        {sw('Contour', 'stroke', s.stroke, true)}
      </HStack>
      <HStack gap="1.5" align="end">
        {shNum('Épaisseur', 'strokeW', s.strokeW || 0, 0, 200)}
        <VStack align="stretch" gap="0" flex="1">
          <Text fontSize="2xs" color={muted}>Alignement</Text>
          <Box as="select" w="100%" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
            border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
            value={s.strokeAlign || 'center'}
            onChange={(e) => { snap(); up({ strokeAlign: e.target.value }) }}>
            <option value="inside">Intérieur</option>
            <option value="center">Centré</option>
            <option value="outside">Extérieur</option>
          </Box>
        </VStack>
        <VStack align="stretch" gap="0" flex="1">
          <Text fontSize="2xs" color={muted}>Style</Text>
          <Box as="select" w="100%" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
            border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
            value={s.dash || 'solid'}
            onChange={(e) => { snap(); up({ dash: e.target.value }) }}>
            <option value="solid">Plein</option>
            <option value="dash">Tirets</option>
            <option value="dot">Pointillés</option>
          </Box>
        </VStack>
      </HStack>
      {(s.kind === 'poly' || s.kind === 'star') && shNum('Sommets', 'points', s.points || 5, 3, 24)}
      {s.kind === 'rect' && shNum('Rayon des coins', 'corner', s.corner || 0, 0, 400)}
      <Text fontSize="2xs" color={muted}>
        Forme vectorielle — redimensionnable sans perte, contour et fond rééditables.
      </Text>
    </VStack>
  )
}

/** Mini-histogramme façon « Niveaux » de Photoshop, avec marqueurs d'entrée. */
function LevelsHistCanvas({ editor, ch, inBlack, inWhite, gamma }) {
  const cvRef = useRef(null)
  const W = 224, H = 90
  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !editor.w) return
    const ctx = cv.getContext('2d')
    ctx.fillStyle = svar('--s-deep', '#0d1117'); ctx.fillRect(0, 0, W, H)
    try {
      const st = histogram(editor.compositeFiltered(), 8, ch === 'rgb' ? 'lum' : ch)
      const mx = st.max || 1
      ctx.fillStyle = svar('--s-a400', 'rgba(255,255,255,0.75)')
      for (let i = 0; i < 256; i += 2) {
        const hh = (st.h[i] / mx) * H * 0.9
        ctx.fillRect((i / 255) * W, H - hh, Math.max(1, W / 128), hh)
      }
      // zones grisées hors plage d'entrée + poignées
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, (inBlack / 255) * W, H)
      ctx.fillRect((inWhite / 255) * W, 0, W, H)
      ctx.fillStyle = '#4f8fe8'
      const gx = W / 2 + (Math.log(gamma / 100) / Math.log(4)) * (W / 4) // repère gamma approx.
      ctx.fillRect(Math.max(0, Math.min(W - 2, gx)), H - 6, 2, 6)
    } catch { /* doc pas prêt */ }
  }, [editor.w, editor.layers?.length, ch, inBlack, inWhite, gamma, getMode()]) // eslint-disable-line
  return (
    <Box as="canvas" ref={cvRef} width={W} height={H} borderRadius="sm" w="100%"
      border="1px solid" borderColor={panelBorder} />
  )
}

function PixelLayerProps({ editor, layer, onChange }) {
  if (!layer) {
    return (
      <VStack align="stretch" gap="2" px="3" py="3">
        <Text fontSize="2xs" color={muted}>
          Sélectionnez un calque pour voir ses propriétés ici
          (comme le panneau Propriétés de Photoshop).
        </Text>
      </VStack>
    )
  }
  return (
    <VStack align="stretch" gap="2" px="3" py="3" overflowY="auto" flex="1">
      <Text fontSize="2xs" color={muted}>Calque de pixels</Text>
      <LayerBox editor={editor} layer={layer} onChange={onChange} w={editor.w} h={editor.h} />
      <Box h="1px" bg="var(--s-a50)" />
      <Text fontSize="2xs" color={muted}>
        {layer.locked ? 'Arrière-plan verrouillé — dupliquez-le pour retoucher.'
          : 'Double-cliquez sur « fx » dans le panneau Calques pour les styles (ombre, lueur, contour…).'}
      </Text>
    </VStack>
  )
}

/** Calque de remplissage : couleur unie ou dégradé non destructif (éditable). */
function FillLayerProps({ editor, layer, onChange }) {
  const d = layer.fillDef || {}
  const snap = () => editor.snapshot('Remplissage')
  const up = (patch) => { Object.assign(layer.fillDef, patch); editor.drawFillLayer(layer); onChange() }
  const cIn = (label, key, val) => (
    <VStack key={key} align="stretch" gap="0" flex="1">
      <Text fontSize="2xs" color={muted}>{label}</Text>
      <Box as="input" type="color" w="100%" h="22px" p="0" cursor="pointer" borderRadius="sm"
        border="1px solid" borderColor={panelBorder} bg={S.input}
        value={val || '#ffffff'} onFocus={snap}
        onChange={(e) => up({ [key]: e.target.value })} />
    </VStack>
  )
  return (
    <VStack align="stretch" gap="2" px="3" py="3" overflowY="auto" flex="1">
      <Text fontSize="2xs" color={muted}>Calque de remplissage</Text>
      <LayerBox editor={editor} layer={layer} onChange={onChange} w={editor.w} h={editor.h} />
      <Box h="1px" bg="var(--s-a50)" />
      {d.kind === 'solid' ? (
        <>
          {cIn('Couleur', 'color', d.color)}
          <Text fontSize="2xs" color={muted}>
            Couleur unie non destructive — double-cliquez la vignette du calque pour changer, ou « Pixelliser » pour cuire.
          </Text>
        </>
      ) : (
        <>
          <HStack gap="1.5">
            {cIn('De', 'from', d.from)}
            {cIn('À', 'to', d.to)}
          </HStack>
          <HStack gap="1.5" align="end">
            <VStack align="stretch" gap="0" flex="1">
              <Text fontSize="2xs" color={muted}>Angle</Text>
              <Input type="number" h="20px" fontSize="2xs" px="1" bg={S.input} color={fg}
                border="1px solid" borderColor={panelBorder} value={d.angle ?? 90}
                onFocus={snap}
                onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) up({ angle: v }) }} />
            </VStack>
            <VStack align="stretch" gap="0" flex="1">
              <Text fontSize="2xs" color={muted}>Style</Text>
              <Box as="select" w="100%" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
                border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
                value={d.style || 'linear'}
                onChange={(e) => { snap(); up({ style: e.target.value }) }}>
                <option value="linear">Linéaire</option>
                <option value="radial">Radial</option>
              </Box>
            </VStack>
          </HStack>
          <Text fontSize="2xs" color={muted}>
            Dégradé non destructif — les couleurs, l'angle et le style restent rééditables.
          </Text>
        </>
      )}
    </VStack>
  )
}

export function AdjustLayerProps({ editor, layer, onChange, onFx }) {
  if (layer?.type === 'text') return <TextLayerProps editor={editor} layer={layer} onChange={onChange} />
  if (layer?.type === 'shape') return <ShapeLayerProps editor={editor} layer={layer} onChange={onChange} />
  if (layer?.type === 'fill') return <FillLayerProps editor={editor} layer={layer} onChange={onChange} />
  if (layer?.type !== 'adjust') return <PixelLayerProps editor={editor} layer={layer} onChange={onChange} onFx={onFx} />
  const adj = layer.adj
  const p = adj?.params || {}
  const setP = (k, v) => { p[k] = v; onChange() }
  const setKind = (kind) => {
    layer.adj = { kind, params: JSON.parse(JSON.stringify(ADJUST_PARAMS[kind] || {})) }
    layer.name = ADJUST_KINDS.find((k) => k.key === kind)?.label || layer.name
    onChange()
  }
  const sl = (label, key, min, max, step = 1) => (
    <VStack key={key} align="stretch" gap="0.5">
      <HStack justify="space-between">
        <Text fontSize="2xs" color={muted}>{label}</Text>
        <Input type="number" w="56px" h="18px" fontSize="2xs" px="1" bg={S.input} color={fg}
          border="1px solid" borderColor={panelBorder}
          min={min} max={max} step={step} value={p[key] ?? 0}
          onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setP(key, Math.min(max, Math.max(min, v))) }} />
      </HStack>
      <Input type="range" min={min} max={max} step={step} h="16px"
        value={p[key] ?? 0} onChange={(e) => setP(key, +e.target.value)} />
    </VStack>
  )
  if (!layer || layer.type !== 'adjust') {
    return (
      <VStack align="stretch" gap="2" px="3" py="3">
        <Text fontSize="2xs" color={muted}>
          Sélectionnez un calque de réglage pour éditer ses paramètres ici
          (comme le panneau Propriétés de Photoshop).
        </Text>
      </VStack>
    )
  }
  return (
    <VStack align="stretch" gap="2" px="3" py="3" overflowY="auto" flex="1">
      <HStack gap="2">
        <Text fontSize="2xs" color={muted} w="44px">Type</Text>
        <Box as="select" flex="1" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
          border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
          value={adj?.kind || 'bc'} onChange={(e) => setKind(e.target.value)}>
          {ADJUST_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </Box>
      </HStack>
      <MiniHist editor={editor} version={0} />
      <Box h="1px" bg="var(--s-a50)" />
      {adj?.kind === 'bc' && (<>
        {sl('Luminosité', 'brightness', -100, 100)}
        {sl('Contraste', 'contrast', -100, 100)}
      </>)}
      {adj?.kind === 'hsl' && (<>
        {p.colorize
          ? sl('Teinte', 'hue', 0, 360)
          : (<VStack align="stretch" gap="0.5">
              <HStack justify="space-between">
                <Text fontSize="2xs" color={muted}>Teinte</Text>
                <Input type="number" w="56px" h="18px" fontSize="2xs" px="1" bg={S.input} color={fg}
                  border="1px solid" borderColor={panelBorder} min="-180" max="180" value={p.hue ?? 0}
                  onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setP('hue', Math.min(180, Math.max(-180, v))) }} />
              </HStack>
              {/* curseur arc-en-ciel comme Photoshop */}
              <Box position="relative" h="16px" borderRadius="sm" overflow="hidden"
                bg="linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)">
                <Input type="range" min="-180" max="180" step="1" value={p.hue ?? 0}
                  position="absolute" inset="0" w="100%" h="100%" opacity="0" cursor="pointer"
                  onChange={(e) => setP('hue', +e.target.value)} />
                <Box position="absolute" top="0" bottom="0" w="4px" bg="#ffffff" borderRadius="sm"
                  boxShadow="0 0 0 1px rgba(0,0,0,.5)" pointerEvents="none"
                  left={`${((p.hue ?? 0) + 180) / 360 * 100}%`} transform="translateX(-50%)" />
              </Box>
            </VStack>)}
        {p.colorize ? sl('Saturation', 'sat', 0, 100) : sl('Saturation', 'sat', -100, 100)}
        {sl('Luminosité', 'light', -100, 100)}
        <HStack gap="1.5" cursor="pointer" onClick={() => setP('colorize', !p.colorize)}>
          <Box w="12px" h="12px" borderRadius="sm" border="1px solid"
            borderColor={p.colorize ? '#4f8fe8' : 'gray.500'} bg={p.colorize ? '#4f8fe8' : 'transparent'}
            color="#ffffff" fontSize="2xs" lineHeight="12px" textAlign="center">
            {p.colorize ? '✓' : ''}
          </Box>
          <Text fontSize="2xs" color={fg}>Colorier</Text>
        </HStack>
      </>)}
      {adj?.kind === 'levels' && (<>
        <LevelsHistCanvas editor={editor} ch={p.ch || 'rgb'}
          inBlack={p.inBlack ?? 0} inWhite={p.inWhite ?? 255} gamma={p.gamma ?? 100} />
        <HStack gap="2">
          <Box as="select" flex="1" fontSize="2xs" bg={S.input} color={fg} borderRadius="sm"
            border="1px solid" borderColor={panelBorder} h="20px" px="1" cursor="pointer"
            value={p.ch || 'rgb'} onChange={(e) => setP('ch', e.target.value)}>
            <option value="rgb">RVB</option><option value="r">Rouge</option>
            <option value="g">Vert</option><option value="b">Bleu</option>
          </Box>
          <Box as="button" px="2.5" h="20px" fontSize="2xs" borderRadius="sm" cursor="pointer"
            bg="var(--s-a100)" color={fg} _hover={{ bg: 'var(--s-a200)' }}
            onClick={() => {
              const a = autoLevels(editor.compositeFiltered(), p.ch || 'rgb')
              p.inBlack = a.inBlack; p.inWhite = a.inWhite; onChange()
            }}>Auto</Box>
        </HStack>
        {/* trois champs d'entrée sous l'histogramme, comme Photoshop */}
        <HStack gap="1.5" justify="space-between">
          {[['inBlack', 0, 254, 1], ['gamma', 10, 999, 1], ['inWhite', 1, 255, 1]].map(([k, mn, mx]) => (
            <Input key={k} type="number" w="60px" h="18px" fontSize="2xs" px="1" textAlign="center"
              bg={S.input} color={fg} border="1px solid" borderColor={panelBorder}
              min={mn} max={mx} value={k === 'gamma' ? Math.round(p.gamma ?? 100) : (p[k] ?? (k === 'inWhite' ? 255 : 0))}
              onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setP(k, Math.min(mx, Math.max(mn, v))) }} />
          ))}
        </HStack>
        {/* plage des curseurs d'entrée */}
        <VStack align="stretch" gap="0.5">
          <input type="range" min="0" max="254" value={p.inBlack ?? 0} style={{ height: 12 }}
            onChange={(e) => setP('inBlack', Math.min(+e.target.value, (p.inWhite ?? 255) - 1))} />
          <input type="range" min="10" max="400" value={p.gamma ?? 100} style={{ height: 12 }}
            onChange={(e) => setP('gamma', +e.target.value)} />
          <input type="range" min="1" max="255" value={p.inWhite ?? 255} style={{ height: 12 }}
            onChange={(e) => setP('inWhite', Math.max(+e.target.value, (p.inBlack ?? 0) + 1))} />
        </VStack>
        <Text fontSize="2xs" color={muted}>Niveaux de sortie</Text>
        <HStack gap="1.5" justify="space-between">
          <Input type="number" w="60px" h="18px" fontSize="2xs" px="1" textAlign="center"
            bg={S.input} color={fg} border="1px solid" borderColor={panelBorder}
            min="0" max="254" value={p.outBlack ?? 0}
            onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setP('outBlack', Math.min(254, Math.max(0, v))) }} />
          <Box flex="1" h="10px" borderRadius="sm"
            bg={`linear-gradient(to right, #000, #fff)`} border="1px solid" borderColor={panelBorder} />
          <Input type="number" w="60px" h="18px" fontSize="2xs" px="1" textAlign="center"
            bg={S.input} color={fg} border="1px solid" borderColor={panelBorder}
            min="1" max="255" value={p.outWhite ?? 255}
            onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setP('outWhite', Math.min(255, Math.max(1, v))) }} />
        </HStack>
      </>)}
      {adj?.kind === 'curves' && (
        <Text fontSize="2xs" color={muted}>Éditez la courbe dans l'onglet <b>Courbes</b>.</Text>
      )}
      {adj?.kind === 'invert' && <Text fontSize="2xs" color={muted}>Sans paramètre — inverse tout.</Text>}
      {adj?.kind === 'bw' && (<>
        {sl('Rouge', 'r', 0, 200)}{sl('Vert', 'g', 0, 200)}{sl('Bleu', 'b', 0, 200)}
      </>)}
      {adj?.kind === 'threshold' && sl('Seuil', 'level', 0, 255)}
      {adj?.kind === 'photoFilter' && (<>
        <HStack gap="2">
          <Text fontSize="2xs" color={muted} w="60px">Couleur</Text>
          <Input type="color" w="44px" h="22px" p="0" value={p.color || '#c8872a'}
            onChange={(e) => setP('color', e.target.value)} />
        </HStack>
        {sl('Densité', 'density', 0, 100)}
      </>)}
      {adj?.kind === 'vibrance' && (<>
        {sl('Vibrance', 'amount', -100, 100)}
        {sl('Saturation', 'sat', -100, 100)}
      </>)}
      {adj?.kind === 'posterize' && sl('Niveaux', 'levels', 2, 32)}
      <Box h="1px" bg="var(--s-a50)" />
      <HStack gap="1.5" cursor="pointer" onClick={() => { layer.visible = !layer.visible; onChange() }}>
        <Box w="12px" h="12px" borderRadius="sm" border="1px solid"
          borderColor={layer.visible ? '#4f8fe8' : 'gray.500'} bg={layer.visible ? '#4f8fe8' : 'transparent'}
          color="#ffffff" fontSize="2xs" lineHeight="12px" textAlign="center">
          {layer.visible ? '✓' : ''}
        </Box>
        <Text fontSize="2xs" color={fg}>Réglage visible</Text>
      </HStack>
      <HStack gap="1.5" cursor="pointer" onClick={() => { layer.clip = !layer.clip; onChange() }}>
        <Box w="12px" h="12px" borderRadius="sm" border="1px solid"
          borderColor={layer.clip ? '#4f8fe8' : 'gray.500'} bg={layer.clip ? '#4f8fe8' : 'transparent'}
          color="#ffffff" fontSize="2xs" lineHeight="12px" textAlign="center">
          {layer.clip ? '✓' : ''}
        </Box>
        <Text fontSize="2xs" color={fg}>Écrêter sur le calque inférieur</Text>
      </HStack>
      <Box as="button" fontSize="2xs" py="1" borderRadius="sm" cursor="pointer"
        bg="var(--s-a100)" color={fg} _hover={{ bg: 'var(--s-a200)' }}
        onClick={() => { layer.adj.params = JSON.parse(JSON.stringify(ADJUST_PARAMS[adj.kind] || {})); onChange() }}>
        Rétablir les valeurs par défaut
      </Box>
    </VStack>
  )
}

// ---- Panneau Canaux (miniatures grises R/V/B — façon Photoshop) --------------------

export function ChannelsPanel({ editor }) {
  const chs = [['rgb', 'RVB'], ['r', 'Rouge'], ['g', 'Vert'], ['b', 'Bleu']]
  return (
    <VStack align="stretch" gap="1" px="3" py="2" overflowY="auto" flex="1">
      {chs.map(([k, label]) => (
        <HStack key={k} gap="2" fontSize="2xs" color={k === 'rgb' ? fg : muted}>
          <Box w="42px" h="30px" flexShrink={0} borderRadius="sm" overflow="hidden"
            bg={S.tile} border="1px solid" borderColor="var(--s-a100)">
            <img src={editor.channelCanvas(k).toDataURL('image/png')} alt="" style={{ width: '100%', height: '100%' }} />
          </Box>
          <Text>{label}</Text>
        </HStack>
      ))}
      <Text fontSize="2xs" color={muted} pt="1">Aperçu des canaux du composite.</Text>
    </VStack>
  )
}

// ---- Panneau droit : Histoire (états nommés, clic = saut) — façon Photoshop ------

export function HistoryPanel({ editor, onJump }) {
  const past = editor.undoStack // [{label, json}]
  const fut = editor.redoStack
  return (
    <VStack align="stretch" gap="0" flex="1" overflowY="auto" px="1" py="1">
      {past.map((s, i) => (
        <Tip key={i} label={`Revenir à l'état avant « ${s.label} »`} display="block">
          <HStack px="2" py="1" gap="2" fontSize="2xs" cursor="pointer" color={muted}
            _hover={{ bg: 'var(--s-a100)', color: fg }} borderRadius="sm"
            onClick={() => onJump('undo', i)}>
            <Box as={LuHistory} fontSize="11px" flexShrink={0} />
            <Text isTruncated>{s.label}</Text>
          </HStack>
        </Tip>
      ))}
      <HStack px="2" py="1.5" gap="2" fontSize="2xs" color="#f2c200" fontWeight="700"
        bg="var(--s-a100)" borderRadius="sm">
        <Box as={LuHistory} fontSize="11px" />
        <Text>État actuel</Text>
      </HStack>
      {fut.map((s, i) => (
        <Tip key={i} label={`Rétablir (${fut.length - i} étape(s))`} display="block">
          <HStack px="2" py="1" gap="2" fontSize="2xs" cursor="pointer" color="var(--s-a400)"
            _hover={{ bg: 'var(--s-a100)', color: fg }} borderRadius="sm"
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

// ---- Panneau milieu : Nuancier (clic = 1er plan, clic droit = arrière-plan) ---------

// palette fixe façon Photopea : gris / pastel / vif / foncé
const SWATCH_GRID = [
  '#000000', '#2b2b2b', '#4a4a4a', '#6b6b6b', '#8a8a8a', '#a8a8a8', '#c4c4c4', '#dedede', '#efefef', '#ffffff',
  '#f3c0b3', '#f6d59a', '#f0e9a8', '#d6e8b0', '#b7e4c7', '#a8dddb', '#aacdeb', '#c3b8e8', '#deb8e0', '#f0b8cc',
  '#e2574c', '#f29441', '#f2c200', '#c8d92e', '#6fc94a', '#2ebd6e', '#2eb8a8', '#3a9bd9', '#6b6bd9', '#b357c9',
  '#8e2f28', '#9c5a1e', '#9c7c0e', '#6e8318', '#3a7a24', '#187a48', '#177a6e', '#1f6391', '#3a3a8e', '#74308a',
]

export function SwatchesPanel({ fg, bg, onColor, onPickColor }) {
  return (
    <VStack align="stretch" gap="2" px="3" py="2.5" flex="1" overflowY="auto">
      {/* 1er plan / arrière-plan superposés comme Photoshop */}
      <HStack gap="2" align="center">
        <Box position="relative" w="30px" h="26px">
          <Tip label="Arrière-plan — clic droit sur un échantillon pour le changer">
            <Box position="absolute" right="0" bottom="0" w="16px" h="16px" borderRadius="sm"
              bg={bg} border="1.5px solid" borderColor={fg} cursor="pointer"
              onClick={() => onPickColor?.('bg')} />
          </Tip>
          <Tip label="Premier plan — clic gauche sur un échantillon, « + » pour le sélecteur">
            <Box position="absolute" left="0" top="0" w="18px" h="18px" borderRadius="sm"
              bg={fg} border="1.5px solid" borderColor={panelBorder} cursor="pointer"
              onClick={() => onPickColor?.('fg')} />
          </Tip>
        </Box>
        <VStack align="stretch" gap="0" flex="1">
          <Text fontSize="2xs" color={fg}>{fg}</Text>
          <Text fontSize="2xs" color={muted}>{bg}</Text>
        </VStack>
        <Tip label="Permuter 1er plan ↔ arrière-plan (X)">
          <Box as="button" fontSize="2xs" px="1.5" h="18px" borderRadius="sm" cursor="pointer"
            bg="var(--s-a100)" color={fg} onClick={() => { const f = fg; onColor('fg', bg); onColor('bg', f) }}>⇄</Box>
        </Tip>
        <Tip label="Réinitialiser noir/blanc (D)">
          <Box as="button" fontSize="2xs" px="1.5" h="18px" borderRadius="sm" cursor="pointer"
            bg="var(--s-a100)" color={fg} onClick={() => { onColor('fg', '#000000'); onColor('bg', '#ffffff') }}>⭯</Box>
        </Tip>
      </HStack>
      <SimpleGrid columns={10} gap="1">
        {SWATCH_GRID.map((c) => (
          <Tip key={c} label={`${c} — clic : 1er plan · clic droit : arrière-plan`}>
            <Box w="16px" h="16px" borderRadius="sm" cursor="pointer" bg={c}
              border="1px solid" borderColor={fg === c ? '#4f8fe8' : 'var(--s-a200)'}
              onClick={() => onColor('fg', c)}
              onContextMenu={(e) => { e.preventDefault(); onColor('bg', c) }} />
          </Tip>
        ))}
      </SimpleGrid>
      <Text fontSize="2xs" color={muted}>Clic = 1er plan · clic droit = arrière-plan</Text>
    </VStack>
  )
}

// ---- Panneau bas : Tracés (comme l'onglet Tracés de Photoshop) --------------------

export function PathsPanel({ editor, version, onChange }) {
  void version
  const paths = editor.paths || []
  return (
    <VStack align="stretch" gap="0" flex="1" overflowY="auto" px="1" py="1">
      {paths.map((p, i) => (
        <Tip key={i} label={`${p.name} — ${p.kind === 'poly' ? 'tracé libre' : p.kind} · double-clic ou clic pour recharger en sélection`} display="block">
          <HStack px="2" py="1" gap="2" fontSize="2xs" cursor="pointer" color={fg}
            _hover={{ bg: 'var(--s-a100)' }} borderRadius="sm"
            onClick={() => { editor.snapshot('Charger le tracé'); editor.loadPath(p); onChange() }}>
            <Box as={FiShare2} fontSize="11px" flexShrink="0" color={muted} />
            <Text flex="1" isTruncated>{p.name}</Text>
            <Text fontSize="2xs" color={muted}>{p.kind}</Text>
            <Text fontSize="2xs" color={muted} cursor="pointer" _hover={{ color: '#e05d5d' }}
              onClick={(e) => { e.stopPropagation(); editor.snapshot('Supprimer le tracé'); editor.paths.splice(i, 1); onChange() }}>✕</Text>
          </HStack>
        </Tip>
      ))}
      {!paths.length && (
        <Text fontSize="2xs" color={muted} px="2" py="2">
          Aucun tracé — faites une sélection puis « Tracé depuis la sélection ».
        </Text>
      )}
      <Box px="1" py="1" borderTop="1px solid" borderColor={panelBorder} mt="1">
        <Box as="button" w="100%" fontSize="2xs" py="1" borderRadius="sm" cursor="pointer"
          bg="var(--s-a100)" color={fg} _hover={{ bg: 'var(--s-a200)' }}
          title={editor.sel || editor.selPoly?.length ? 'Crée un tracé depuis la sélection active' : 'Aucune sélection active'}
          onClick={() => { if (editor.sel || editor.selPoly?.length) { editor.saveWorkPath(); onChange() } }}>
          Tracé depuis la sélection
        </Box>
      </Box>
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
      {editor.w > 0 && <Tip label="Espace colorimétrique du document"><Text>RVB · 8 bit</Text></Tip>}
      <Tip label="Dimensions du document"><Text>{editor.w ? `${editor.w} × ${editor.h} px` : ''}</Text></Tip>
      {editor.w > 0 && <Tip label="Nombre de calques"><Text>{editor.layers.length} calque(s)</Text></Tip>}
      <Tip label="Outil actif"><Text>{t?.label}</Text></Tip>
      <Box flex="1" />
      {editor.docName && <Text isTruncated maxW="280px">Ouvert : {editor.docName}</Text>}
    </HStack>
  )
}

// ---- Panneau latéral à onglets -------------------------------------------------------

// Rangée d'onglets partagée par les groupes du panneau droit
function TabRow({ tabs, value, onChange }) {
  return (
    <HStack px="2" pt="1.5" pb="0" gap="1" borderBottom="1px solid" borderColor={panelBorder} flexShrink={0}>
      {tabs.map(([k, l, tip]) => (
        <Tip key={k} label={tip}>
          <Box px="2" py="1.5" fontSize="xs" cursor="pointer" borderRadius="md md 0 0"
            color={k === 'dental' ? C.greenText : value === k ? fg : muted} fontWeight={k === 'dental' ? '800' : value === k ? '600' : '400'}
            bg={k === 'dental' ? C.greenBg : value === k ? 'var(--s-a100)' : 'transparent'}
            borderBottom="2px solid" borderColor={k === 'dental' && value === k ? C.greenText : 'transparent'}
            onClick={() => onChange(k)}>
            {l}
          </Box>
        </Tip>
      ))}
    </HStack>
  )
}

// Structure façon Photoshop : Propriétés/Réglages en haut — Nav/Histo/Infos au
// milieu — Calques/Canaux/Histoire en bas.

export function RightPanel({ editor, version, zoom, cursor, onChange, wbPick, onWbPick, comparing, onCompare, dental, onFx, onAdjust, onJump, view, stageSize, onNav, curveTarget, fgColor, bgColor, onColor, onPickColor }) {
  const [topTab, setTopTab] = useState('dental')
  const [midTab, setMidTab] = useState('histo')
  const [botTab, setBotTab] = useState('layers')
  const isAdj = editor.active?.type === 'adjust'
  const isText = editor.active?.type === 'text'
  const isShape = editor.active?.type === 'shape'
  const isFill = editor.active?.type === 'fill'
  const propsTab = (isAdj || isText || isShape || isFill) ? 'props' : topTab // Propriétés suit le calque actif
  return (
    <Flex w="252px" direction="column" bg={panelBg} borderLeft="1px solid" borderColor={panelBorder} flexShrink={0}>
      {/* Groupe haut : Propriétés (réglage du calque actif) / Réglages / Courbes / Dentaire */}
      <Flex direction="column" flex="1.25" minH="0" borderBottom="1px solid" borderColor={panelBorder}>
        <TabRow value={propsTab} onChange={setTopTab} tabs={[
          ['props', 'Propriétés', 'Paramètres du calque de réglage actif — façon Photoshop'],
          ['adjust', 'Réglages', 'Exposition, balance des blancs, niveaux, effets'],
          ['curves', 'Courbes', 'Tonalité par canal RGB/R/V/B'],
          ['dental', 'Dentaire', 'Avant/après, redresser, calibrer, teinte, référence, planche'],
        ]} />
        <Flex flex="1" direction="column" overflow="hidden" overflowY="auto">
          {propsTab === 'props' ? (
            <AdjustLayerProps editor={editor} layer={editor.active} onChange={() => { editor.markDirty(); onChange() }} onFx={onFx} />
          ) : topTab === 'adjust' ? (
            <AdjustPanel editor={editor} onChange={onChange}
              wbPick={wbPick} onWbPick={onWbPick} comparing={comparing} onCompare={onCompare} />
          ) : topTab === 'curves' ? (
            <CurvesPanel editor={editor} version={version} onChange={onChange} target={curveTarget} />
          ) : (
            <DentalPanel editor={editor} version={version} onChange={onChange} dental={dental} />
          )}
        </Flex>
      </Flex>
      {/* Groupe milieu : Nav / Histo / Infos — compact */}
      <Flex direction="column" h="168px" flexShrink={0} borderBottom="1px solid" borderColor={panelBorder}>
        <TabRow value={midTab} onChange={setMidTab} tabs={[
          ['nav', 'Nav.', 'Vue d\'ensemble et déplacement du cadre visible'],
          ['swatch', 'Nuancier', 'Échantillons : clic = 1er plan, clic droit = arrière-plan'],
          ['histo', 'Histo', 'Histogramme et statistiques par canal'],
          ['info', 'Infos', 'Document, dimensions, curseur, couleur'],
        ]} />
        <Flex flex="1" direction="column" overflow="hidden">
          {midTab === 'nav' && <NavigatorPanel editor={editor} version={version} view={view} stageSize={stageSize} onNav={onNav} />}
          {midTab === 'swatch' && <SwatchesPanel fg={fgColor} bg={bgColor} onColor={onColor} onPickColor={onPickColor} />}
          {midTab === 'histo' && <HistogramPanel editor={editor} version={version} />}
          {midTab === 'info' && <InfoPanel editor={editor} zoom={zoom} cursor={cursor} />}
        </Flex>
      </Flex>
      {/* Groupe bas : Calques / Canaux / Histoire */}
      <Flex direction="column" flex="1" minH="0">
        <TabRow value={botTab} onChange={setBotTab} tabs={[
          ['layers', 'Calques', 'Empilement, fusion, opacité, remplissage, effets fx, masques'],
          ['canaux', 'Canaux', 'Aperçu des canaux RVB / R / V / B du composite'],
          ['paths', 'Tracés', 'Tracés enregistrés depuis les sélections — rechargement en sélection'],
          ['hist', 'Hist.', 'États de l\'historique — clic pour sauter'],
        ]} />
        <Flex flex="1" direction="column" overflow="hidden">
          {botTab === 'layers' && <LayersPanel editor={editor} version={version} onChange={onChange} onFx={onFx} onAdjust={onAdjust} />}
          {botTab === 'canaux' && <ChannelsPanel editor={editor} version={version} />}
          {botTab === 'paths' && <PathsPanel editor={editor} version={version} onChange={onChange} />}
          {botTab === 'hist' && <HistoryPanel editor={editor} version={version} onJump={onJump} />}
        </Flex>
      </Flex>
    </Flex>
  )
}

// ---- Zone centrale vide (pas de document ouvert) -------------------------------------

export function EmptyCanvas({ onOpen, onPick, onNew }) {
  return (
    <Center flex="1" color={muted}>
      <VStack gap="3">
        <Center w="64px" h="64px" borderRadius="xl" bg={panelBg} border="1px solid" borderColor={panelBorder}
          fontSize="26px" color={muted}>
          <Box as={FiLayers} />
        </Center>
        <Text fontSize="sm" fontWeight="600" color={fg}>Aucun document ouvert</Text>
        <Text fontSize="xs" color={muted}>Créez un canevas vierge, ouvrez une photo du workspace ou un fichier local</Text>
        <HStack gap="2" mt="1">
          <Tip label="Canevas vierge aux dimensions de votre choix">
            <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" bg={C.primary} color="#ffffff"
              cursor="pointer" onClick={onNew}>
              Nouveau document…
            </Box>
          </Tip>
          <Tip label="Photo déjà rangée dans un dossier du workspace">
            <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" bg="var(--s-a100)" color={fg}
              cursor="pointer" onClick={onPick}>
              Choisir une photo
            </Box>
          </Tip>
          <Tip label="JPG / PNG depuis votre ordinateur">
            <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" bg="var(--s-a100)" color={fg}
              cursor="pointer" onClick={onOpen}>
              Importer un fichier…
            </Box>
          </Tip>
        </HStack>
      </VStack>
    </Center>
  )
}

// ---- Barre contextuelle (façon Photoshop 2026) ---------------------------------
// Pilule flottante bas-centre du canevas : le contenu (items) est fourni par la
// page selon le contexte — sélection active, transformation, ou défaut.

export function ContextBar({ items }) {
  if (!items?.length) return null
  return (
    <HStack data-ctxbar="1" position="absolute" bottom="14px" left="50%" transform="translateX(-50%)"
      zIndex="8" gap="0.5" px="2" py="1" bg={S.input}
      border="1px solid" borderColor={panelBorder} borderRadius="full" boxShadow="lg">
      {items.map((it, i) => it === '-' ? (
        <Box key={i} w="1px" h="16px" bg={panelBorder} mx="0.5" />
      ) : (
        <Tip key={i} label={it.tip || it.label}>
          <Box as="button" display="flex" alignItems="center" gap="1.5" px="2" py="1"
            fontSize="2xs" color={it.active ? '#4f8fe8' : fg} cursor="pointer"
            borderRadius="full" _hover={{ bg: 'var(--s-a100)' }}
            onClick={it.onClick}>
            {it.icon && <Box as={it.icon} fontSize="13px" />}
            {it.label && <Text>{it.label}</Text>}
          </Box>
        </Tip>
      ))}
    </HStack>
  )
}
