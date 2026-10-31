// Modals du Studio : ouverture d'une photo du workspace, export, sauvegarde.
import { useEffect, useState } from 'react'
import { Box, Button, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { FiDownload, FiFolder, FiSave } from 'react-icons/fi'
import { Card, Modal, SearchInput, Select, Tag, Tip, isTestName } from '../../components/ui'
import { C } from '../../theme'
import PhotoImg from '../../components/PhotoImg'
import { listDossiers, listPhotos } from '../../api'
import { BLEND_MODES, SHEET_SLOTS } from './constants'
import { ADJUST_KINDS, ADJUST_PARAMS, DEFAULT_FX, hexToRgb, hexToHsv, hsvToHex, hsvToRgb, rgbToHex } from './engine'

// ---- Ouvrir : photo du workspace (ou import local géré par la page) -------------

export function OpenPhotoModal({ open, onClose, wsId, onPick }) {
  const [photos, setPhotos] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => {
    if (open && wsId) listPhotos(wsId, { limit: 120 }).then(setPhotos)
  }, [open, wsId])
  const list = photos.filter((p) => !q || (p.original_filename || '').toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open={open} onClose={onClose} title="Ouvrir une photo"
      subtitle="Les photos du workspace (bucket privé, signed URLs)" width="720px">
      <SearchInput placeholder="Rechercher un fichier…" w="100%" mb="3"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <SimpleGrid columns={{ base: 3, md: 5 }} gap="3" maxH="380px" overflowY="auto">
        {list.map((p) => (
          <Box key={p.id} cursor="pointer" onClick={() => onPick(p)} _hover={{ opacity: 0.85 }}>
            <PhotoImg storagePath={p.storage_path} ratio="1/1" />
            <Text fontSize="2xs" color="gray.500" mt="1" isTruncated>
              {p.original_filename || p.storage_path}
            </Text>
          </Box>
        ))}
        {list.length === 0 && (
          <Text fontSize="sm" color="gray.500" gridColumn="1/-1" textAlign="center" py="6">
            Aucune photo.
          </Text>
        )}
      </SimpleGrid>
    </Modal>
  )
}

// ---- Exporter : PNG/JPEG + sauvegarde dans DentoPic ------------------------------

export function ExportModal({ open, onClose, docName, dossiers, onExport, onSave }) {
  const [format, setFormat] = useState('png')
  const [dossierId, setDossierId] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const ok = await onSave(dossierId || null)
    setBusy(false)
    setSaved(ok)
  }
  return (
    <Modal open={open} onClose={() => { setSaved(false); onClose() }}
      title="Exporter le montage" subtitle="Télécharger ou ranger dans DentoPic" width="440px">
      <VStack align="stretch" gap="3">
        <HStack gap="3">
          <Text fontSize="xs" color="gray.500" w="70px">Format</Text>
          <Select flex="1" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="png">PNG (sans perte)</option>
            <option value="jpeg">JPEG (léger)</option>
          </Select>
        </HStack>
        <Button variant="outline" size="sm" onClick={() => onExport(format)}>
          <FiDownload /> Télécharger {format.toUpperCase()}
        </Button>
        <Box h="1px" bg="gray.100" />
        <HStack gap="3">
          <Text fontSize="xs" color="gray.500" w="70px">Dossier</Text>
          <Select flex="1" value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
            <option value="">Non triées</option>
            {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </HStack>
        <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
          loading={busy} onClick={save}>
          <FiSave /> Enregistrer dans DentoPic
        </Button>
        {saved && (
          <HStack bg={C.greenBg} border="1px solid" borderColor={C.greenBorder}
            borderRadius="md" px="3" py="2" gap="2">
            <Box as={FiFolder} color={C.greenText} />
            <Text fontSize="xs" color={C.greenText}>
              Enregistré — visible dans Recherche et Dossier patient.
            </Text>
          </HStack>
        )}
      </VStack>
    </Modal>
  )
}

// ---- Montage avant / après : choisir 2 photos + mise en page ----------------------

const slotBox = {
  w: '120px', h: '96px', borderRadius: 'md', border: '1.5px dashed',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 'xs', color: 'gray.400', overflow: 'hidden', position: 'relative',
}

export function MontageModal({ open, onClose, wsId, onCreate }) {
  const [photos, setPhotos] = useState([])
  const [avant, setAvant] = useState(null)
  const [apres, setApres] = useState(null)
  const [layout, setLayout] = useState('side')
  const [labels, setLabels] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && wsId) listPhotos(wsId, { limit: 60 }).then(setPhotos)
    if (open) { setAvant(null); setApres(null); setLayout('side'); setLabels(true) }
  }, [open, wsId])

  const pick = (p) => {
    if (!avant) setAvant(p)
    else if (!apres && p.id !== avant.id) setApres(p)
    else { setAvant(p); setApres(null) }
  }

  const Slot = ({ label, photo, onClear }) => (
    <VStack gap="1">
      <Box {...slotBox} borderColor={photo ? C.primary : 'gray.300'}>
        {photo ? (
          <>
            <PhotoImg storagePath={photo.storage_path} ratio="5/4" />
            <Box as="button" position="absolute" top="1" right="1" w="16px" h="16px"
              borderRadius="full" bg="blackAlpha.600" color="#ffffff" fontSize="2xs"
              cursor="pointer" onClick={onClear}>×</Box>
          </>
        ) : label}
      </Box>
      <Text fontSize="2xs" fontWeight="700" color="gray.500">{label}</Text>
    </VStack>
  )

  return (
    <Modal open={open} onClose={onClose} title="Montage avant / après"
      subtitle="Cliquez deux photos : la première devient AVANT, la seconde APRÈS" width="680px"
      footer={
        <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
          disabled={!avant || !apres} loading={busy}
          onClick={async () => { setBusy(true); await onCreate(avant, apres, { layout, labels }); setBusy(false) }}>
          Créer le montage
        </Button>
      }>
      <VStack align="stretch" gap="4">
        <HStack gap="4" align="start">
          <Slot label="AVANT" photo={avant} onClear={() => setAvant(null)} />
          <Slot label="APRÈS" photo={apres} onClear={() => setApres(null)} />
          <VStack align="stretch" gap="2" flex="1" pt="5">
            <HStack gap="2">
              <Text fontSize="xs" color="gray.500" w="78px">Mise en page</Text>
              <Select flex="1" value={layout} onChange={(e) => setLayout(e.target.value)}>
                <option value="side">Côte à côte</option>
                <option value="stack">Empilées (haut / bas)</option>
              </Select>
            </HStack>
            <HStack gap="2" cursor="pointer" onClick={() => setLabels(!labels)}>
              <Box w="14px" h="14px" borderRadius="sm" border="1.5px solid"
                borderColor={labels ? C.primary : 'gray.400'} bg={labels ? C.primary : 'transparent'}
                color="#ffffff" fontSize="2xs" textAlign="center" lineHeight="14px">
                {labels ? '✓' : ''}
              </Box>
              <Text fontSize="xs">Étiquettes AVANT / APRÈS</Text>
            </HStack>
          </VStack>
        </HStack>
        <SimpleGrid columns={{ base: 4, md: 6 }} gap="2" maxH="240px" overflowY="auto">
          {photos.map((p) => {
            const sel = p.id === avant?.id ? 'AVANT' : p.id === apres?.id ? 'APRÈS' : null
            return (
              <Box key={p.id} cursor="pointer" position="relative" onClick={() => pick(p)}
                outline={sel ? '2px solid' : 'none'} outlineColor={C.primary} borderRadius="md">
                <PhotoImg storagePath={p.storage_path} ratio="1/1" />
                {sel && (
                  <Box position="absolute" bottom="1" left="1" px="1.5" fontSize="2xs"
                    fontWeight="700" borderRadius="sm" bg={C.primary} color="#ffffff">{sel}</Box>
                )}
              </Box>
            )
          })}
        </SimpleGrid>
      </VStack>
    </Modal>
  )
}

// ---- Planche du référentiel : 8 vues nommées composées sur une image -----------
// Cliquer une photo l'assigne au prochain emplacement vide ; cliquer un
// emplacement occupé le libère. `onCompose(slots)` reçoit [{label, photo}].

export function SheetModal({ open, onClose, wsId, onCompose }) {
  const [photos, setPhotos] = useState([])
  const [slots, setSlots] = useState(SHEET_SLOTS.map((label) => ({ label, photo: null })))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && wsId) {
      listPhotos(wsId, { limit: 120 }).then(setPhotos)
      setSlots(SHEET_SLOTS.map((label) => ({ label, photo: null })))
    }
  }, [open, wsId])

  const filled = slots.filter((s) => s.photo).length
  const assign = (p) => {
    const i = slots.findIndex((s) => !s.photo)
    if (i < 0 || slots.some((s) => s.photo?.id === p.id)) return
    setSlots((sl) => sl.map((s, j) => (j === i ? { ...s, photo: p } : s)))
  }
  const clear = (i) => setSlots((sl) => sl.map((s, j) => (j === i ? { ...s, photo: null } : s)))

  // grille 3×3 : le slot i va en position order[i], centre = titre
  const order = [0, 1, 2, 3, 5, 6, 7, 8]

  return (
    <Modal open={open} onClose={onClose} title="Planche du référentiel"
      subtitle="Les 8 vues du protocole composées sur une seule image — cliquez les photos dans l'ordre" width="760px"
      footer={
        <>
          <Text fontSize="xs" color="gray.500">{filled}/8 vues</Text>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            disabled={!filled} loading={busy}
            onClick={async () => { setBusy(true); await onCompose(slots); setBusy(false) }}>
            Composer la planche
          </Button>
        </>
      }>
      <VStack align="stretch" gap="4">
        {/* aperçu des emplacements 3×3 */}
        <SimpleGrid columns={3} gap="1.5" w="360px" alignSelf="center">
          {Array.from({ length: 9 }, (_, pos) => {
            const i = order.indexOf(pos)
            if (i < 0) return (
              <Box key="c" h="52px" borderRadius="md" bg={C.primary} opacity="0.85"
                display="flex" alignItems="center" justifyContent="center">
                <Text fontSize="2xs" fontWeight="700" color="#ffffff">DentoPic</Text>
              </Box>
            )
            const s = slots[i]
            return (
              <Box key={i} position="relative" cursor={s.photo ? 'pointer' : 'default'}
                onClick={() => s.photo && clear(i)}>
                <PhotoImg storagePath={s.photo?.storage_path} ratio="4/3" />
                {!s.photo && (
                  <Box position="absolute" inset="0" display="flex" alignItems="center"
                    justifyContent="center" bg="gray.50" borderRadius="md"
                    border="1.5px dashed" borderColor="gray.300">
                    <Text fontSize="2xs" color="gray.400" textAlign="center" px="1">{s.label}</Text>
                  </Box>
                )}
                {s.photo && (
                  <Text position="absolute" bottom="0.5" left="1" right="1" fontSize="2xs"
                    color="#ffffff" textShadow="0 1px 3px rgba(0,0,0,0.9)" isTruncated>
                    {s.label}
                  </Text>
                )}
              </Box>
            )
          })}
        </SimpleGrid>
        <Text fontSize="2xs" color="gray.400" textAlign="center">
          Cliquez un emplacement occupé pour le libérer
        </Text>
        <SimpleGrid columns={{ base: 4, md: 6 }} gap="2" maxH="220px" overflowY="auto">
          {photos.map((p) => {
            const used = slots.some((s) => s.photo?.id === p.id)
            return (
              <Box key={p.id} cursor={used ? 'default' : 'pointer'} opacity={used ? 0.35 : 1}
                onClick={() => !used && assign(p)}>
                <PhotoImg storagePath={p.storage_path} ratio="1/1" />
              </Box>
            )
          })}
          {photos.length === 0 && (
            <Text fontSize="sm" color="gray.500" gridColumn="1/-1" textAlign="center" py="6">
              Aucune photo — capturez ou importez d'abord.
            </Text>
          )}
        </SimpleGrid>
      </VStack>
    </Modal>
  )
}

// ---- Style de calque (copie du dialogue Photoshop « Layer Style ») ----------------
// Liste à gauche (cases), paramètres à droite, aperçu en direct (draft appliqué).

const FX_SECTIONS = [
  { key: 'blending', label: 'Options de fusion', fixed: true },
  { key: 'bevel', label: 'Biseautage et estampage' },
  { key: 'stroke', label: 'Contour' },
  { key: 'innerShadow', label: 'Ombre interne' },
  { key: 'innerGlow', label: 'Lueur interne' },
  { key: 'satin', label: 'Satin' },
  { key: 'colorOverlay', label: 'Incrustation en couleur' },
  { key: 'gradientOverlay', label: 'Incrustation en dégradé' },
  { key: 'glow', label: 'Lueur externe' },
  { key: 'shadow', label: 'Ombre portée' },
]

const lbl = { fontSize: '2xs', color: 'gray.500', w: '72px', flexShrink: 0 }

function FxSlider({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <HStack gap="2">
      <Text {...lbl}>{label}</Text>
      <input type="range" min={min} max={max} step={step} value={value}
        style={{ flex: 1 }} onChange={(e) => onChange(+e.target.value)} />
      <Text fontSize="2xs" color="gray.300" w="52px" textAlign="right">{value}{unit}</Text>
    </HStack>
  )
}

function FxColor({ label, value, onChange }) {
  return (
    <HStack gap="2">
      <Text {...lbl}>{label}</Text>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 22, border: 'none', background: 'none', padding: 0 }} />
      <Text fontSize="2xs" color="gray.300">{value}</Text>
    </HStack>
  )
}

function FxParams({ sel, fx, setFx, layer, setLayer }) {
  const set = (k, v) => setFx({ ...fx, [sel]: { ...fx[sel], [k]: v } })
  if (sel === 'blending') {
    return (
      <VStack align="stretch" gap="3">
        <HStack gap="2">
          <Text {...lbl}>Mode de fusion</Text>
          <Box as="select" flex="1" fontSize="xs" bg="#1c2433" color="gray.100" borderRadius="sm"
            border="1px solid" borderColor="whiteAlpha.200" h="24px" px="1"
            value={layer.blend || 'source-over'} onChange={(e) => setLayer({ ...layer, blend: e.target.value })}>
            {BLEND_MODES.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
          </Box>
        </HStack>
        <FxSlider label="Opacité" value={Math.round((layer.opacity ?? 1) * 100)} min={0} max={100} unit=" %"
          onChange={(v) => setLayer({ ...layer, opacity: v / 100 })} />
        <FxSlider label="Remplissage" value={Math.round((layer.fill ?? 1) * 100)} min={0} max={100} unit=" %"
          onChange={(v) => setLayer({ ...layer, fill: v / 100 })} />
        <Text fontSize="2xs" color="gray.500">
          L'opacité agit sur les pixels et les effets ; le remplissage n'agit que sur les pixels.
        </Text>
      </VStack>
    )
  }
  const f = fx[sel] || {}
  return (
    <VStack align="stretch" gap="3">
      {'blend' in f && (
        <HStack gap="2">
          <Text {...lbl}>Mode de fusion</Text>
          <Box as="select" flex="1" fontSize="xs" bg="#1c2433" color="gray.100" borderRadius="sm"
            border="1px solid" borderColor="whiteAlpha.200" h="24px" px="1"
            value={f.blend || 'source-over'} onChange={(e) => set('blend', e.target.value)}>
            {BLEND_MODES.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
          </Box>
        </HStack>
      )}
      {'opacity' in f && <FxSlider label="Opacité" value={f.opacity} min={0} max={100} unit=" %" onChange={(v) => set('opacity', v)} />}
      {'color' in f && <FxColor label="Couleur" value={f.color} onChange={(v) => set('color', v)} />}
      {'from' in f && (
        <>
          <FxColor label="Début" value={f.from} onChange={(v) => set('from', v)} />
          <FxColor label="Fin" value={f.to} onChange={(v) => set('to', v)} />
        </>
      )}
      {'angle' in f && <FxSlider label="Angle" value={f.angle} min={0} max={360} unit="°" onChange={(v) => set('angle', v)} />}
      {'dist' in f && <FxSlider label="Distance" value={f.dist} min={0} max={100} unit=" px" onChange={(v) => set('dist', v)} />}
      {'spread' in f && <FxSlider label="Étendue" value={f.spread} min={0} max={100} unit=" %" onChange={(v) => set('spread', v)} />}
      {'size' in f && <FxSlider label="Taille" value={f.size} min={0} max={120} unit=" px" onChange={(v) => set('size', v)} />}
      {'range' in f && <FxSlider label="Plage" value={f.range} min={1} max={100} unit=" %" onChange={(v) => set('range', v)} />}
    </VStack>
  )
}

export function LayerStyleModal({ open, onClose, layer, onApply, initial }) {
  const [sel, setSel] = useState('shadow')
  const [fx, setFx] = useState(null)       // brouillon des effets
  const [lOpt, setLOpt] = useState(null)   // brouillon opacity/fill/blend

  useEffect(() => {
    if (open && layer) {
      const base = JSON.parse(JSON.stringify(DEFAULT_FX))
      const cur = layer.fx || {}
      for (const k of Object.keys(base)) if (cur[k]) base[k] = { ...base[k], ...cur[k] }
      setFx(base)
      setLOpt({ opacity: layer.opacity ?? 1, fill: layer.fill ?? 1, blend: layer.blend || 'source-over' })
      setSel(initial && initial in base ? initial : 'shadow')
    }
  }, [open, layer, initial])

  if (!open || !layer || !fx) return null

  const toggle = (k, on) => setFx({ ...fx, [k]: { ...fx[k], on, _listed: on } })
  const apply = () => { onApply(fx, lOpt); onClose() }

  return (
    <Modal open={open} onClose={onClose} title="Style de calque"
      subtitle={`Effets du calque « ${layer.name} »`} width="640px"
      footer={
        <HStack justify="flex-end" gap="2">
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" colorPalette="blue" onClick={apply}>OK</Button>
        </HStack>
      }>
      <HStack align="stretch" gap="0" h="360px">
        {/* Liste des styles (comme Photoshop) */}
        <VStack align="stretch" w="200px" flexShrink="0" gap="0" overflowY="auto"
          borderRight="1px solid" borderColor="whiteAlpha.100" pr="1">
          <Text fontSize="2xs" fontWeight="700" color="gray.400" px="2" py="1">Styles</Text>
          {FX_SECTIONS.map(({ key, label, fixed }) => {
            const on = fixed || fx[key]?.on
            return (
              <Tip key={key} label={fixed ? 'Fusion, opacité, remplissage' : `${on ? 'Actif' : 'Inactif'} — cocher pour activer, cliquer pour régler`}>
                <HStack px="2" py="1.5" gap="2" fontSize="xs" cursor="pointer" data-fxrow={key}
                  bg={sel === key ? 'whiteAlpha.100' : 'transparent'} borderRadius="sm"
                  color={sel === key ? 'white' : 'gray.300'}
                  onClick={() => setSel(key)}>
                  <Box w="14px" h="14px" borderRadius="sm" border="1px solid" flexShrink={0} data-fxcheck={key}
                    borderColor={on ? '#4f8fe8' : 'gray.600'} bg={on ? '#4f8fe8' : 'transparent'}
                    color="#ffffff" fontSize="2xs" lineHeight="14px" textAlign="center"
                    onClick={(e) => { if (!fixed) { e.stopPropagation(); toggle(key, !on); setSel(key) } }}>
                    {on ? '✓' : ''}
                  </Box>
                  {label}
                </HStack>
              </Tip>
            )
          })}
        </VStack>
        {/* Paramètres de l'effet sélectionné */}
        <VStack align="stretch" flex="1" px="4" py="2" gap="3" overflowY="auto">
          <Text fontSize="xs" fontWeight="700" color="gray.100">
            {FX_SECTIONS.find((s) => s.key === sel)?.label}
          </Text>
          <FxParams sel={sel} fx={fx} setFx={setFx} layer={lOpt} setLayer={setLOpt} />
        </VStack>
      </HStack>
    </Modal>
  )
}

// ---- Sélecteur de couleurs façon Photoshop ------------------------------------
// Carré saturation/luminosité + barre de teinte + champs TSL / RVB / hex.

const numIn = {
  w: '52px', h: '22px', fontSize: '2xs', px: '1.5',
}

export function ColorPickerModal({ open, onClose, color, onApply, title = 'Sélecteur de couleurs (premier plan)' }) {
  const [hsv, setHsv] = useState(() => hexToHsv(color || '#dc2626'))
  const [hexIn, setHexIn] = useState(color || '#dc2626')
  useEffect(() => {
    if (open) { setHsv(hexToHsv(color || '#dc2626')); setHexIn(color || '#dc2626') }
  }, [open, color])
  const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const hex = rgbToHex(r, g, b)
  const up = (k, v) => {
    const nh = { ...hsv, [k]: Math.max(0, Math.min(k === 'h' ? 360 : 1, v)) }
    setHsv(nh); setHexIn(hsvToHex(nh.h, nh.s, nh.v))
  }
  const up2sv = (fx, fy) => {
    const nh = {
      ...hsv,
      s: Math.max(0, Math.min(1, fx)),
      v: Math.max(0, Math.min(1, 1 - fy)),
    }
    setHsv(nh); setHexIn(hsvToHex(nh.h, nh.s, nh.v))
  }
  const setRgb = (i, val) => {
    const rgb = [r, g, b]; rgb[i] = Math.max(0, Math.min(255, +val || 0))
    const nh = hexToHsv(rgbToHex(...rgb))
    setHsv(nh); setHexIn(rgbToHex(...rgb))
  }
  const onHex = (v) => {
    setHexIn(v)
    if (/^#?[0-9a-f]{6}$/i.test(v.trim())) setHsv(hexToHsv(v))
  }
  // drag sur carré SV / barre teinte
  const drag = (ref, fn) => (e) => {
    const el = ref.current || e.currentTarget
    const move = (ev) => {
      const rc = el.getBoundingClientRect()
      fn((ev.clientX - rc.left) / rc.width, (ev.clientY - rc.top) / rc.height)
    }
    el.setPointerCapture(e.pointerId)
    move(e)
    const mm = (ev) => move(ev)
    const up2 = () => { el.removeEventListener('pointermove', mm); el.removeEventListener('pointerup', up2) }
    el.addEventListener('pointermove', mm)
    el.addEventListener('pointerup', up2)
  }
  const svRef = { current: null }, hueRef = { current: null }
  const row = (label, val, set, max) => (
    <HStack gap="1">
      <Text fontSize="2xs" color="gray.500" w="10px">{label}</Text>
      <Input {...numIn} type="number" value={val} min={0} max={max}
        onChange={(e) => set(e.target.value)} />
      <Text fontSize="2xs" color="gray.400" w="20px">{label === 'T' ? '°' : ''}</Text>
    </HStack>
  )
  return (
    <Modal open={open} onClose={onClose} title={title} width="470px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => { onApply(hex); onClose() }}>OK</Button>
        </>
      }>
      <HStack align="stretch" gap="4">
        {/* Carré saturation / luminosité */}
        <Box
          ref={(el) => (svRef.current = el)}
          w="240px" h="200px" borderRadius="md" cursor="crosshair" position="relative" flexShrink={0}
          bg={`linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h},100%,50%))`}
          onPointerDown={drag(svRef, (fx, fy) => up2sv(fx, fy))}
        >
          <Box position="absolute" w="12px" h="12px" borderRadius="full" border="2px solid #fff"
            boxShadow="0 0 0 1px rgba(0,0,0,.5)" pointerEvents="none"
            left={`${hsv.s * 100}%`} top={`${(1 - hsv.v) * 100}%`} transform="translate(-50%,-50%)" />
        </Box>
        {/* Barre de teinte */}
        <Box
          ref={(el) => (hueRef.current = el)}
          w="16px" h="200px" borderRadius="md" cursor="pointer" position="relative" flexShrink={0}
          bg="linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
          onPointerDown={drag(hueRef, (_x, fy) => up('h', fy * 360))}
        >
          <Box position="absolute" left="-3px" right="-3px" h="4px" borderRadius="sm"
            border="2px solid #fff" boxShadow="0 0 0 1px rgba(0,0,0,.4)" pointerEvents="none"
            top={`${(hsv.h / 360) * 100}%`} transform="translateY(-50%)" />
        </Box>
        {/* Champs */}
        <VStack align="stretch" gap="1.5" flex="1">
          {/* aperçu actuelle / nouvelle */}
          <HStack gap="0" mb="1" borderRadius="md" overflow="hidden" border="1px solid" borderColor="gray.300">
            <Box flex="1" h="34px" bg={hex} />
            <Box flex="1" h="34px" bg={color || '#000'} />
          </HStack>
          <Text fontSize="2xs" color="gray.400">nouvelle / actuelle</Text>
          {row('T', Math.round(hsv.h), (v) => up('h', +v || 0), 360)}
          {row('S', Math.round(hsv.s * 100), (v) => up('s', (+v || 0) / 100), 100)}
          {row('L', Math.round(hsv.v * 100), (v) => up('v', (+v || 0) / 100), 100)}
          <Box h="1" />
          {row('R', r, (v) => setRgb(0, v), 255)}
          {row('V', g, (v) => setRgb(1, v), 255)}
          {row('B', b, (v) => setRgb(2, v), 255)}
          <HStack gap="1">
            <Text fontSize="2xs" color="gray.500" w="10px">#</Text>
            <Input {...numIn} w="80px" value={hexIn} onChange={(e) => onHex(e.target.value)} />
          </HStack>
        </VStack>
      </HStack>
    </Modal>
  )
}

// ---- Filtre : paramètres + aperçu live sur le canevas (façon photocraft) ---------
// Le parent (index.jsx) mémorise l'état avant ouverture : chaque changement de
// paramètre restaure cet état puis ré-applique → aperçu temps réel réversible.

export function FilterModal({ open, onClose, def, onPreview, onApply, onCancel }) {
  const [params, setParams] = useState({})
  useEffect(() => {
    if (open && def) {
      const p = {}
      for (const d of def.params || []) p[d.key] = d.def
      setParams(p)
    }
  }, [open, def])
  const set = (k, v) => {
    const p = { ...params, [k]: v }
    setParams(p)
    onPreview?.(p)
  }
  if (!def) return null
  return (
    <Modal open={open} onClose={onCancel} title={def.label}
      subtitle="Aperçu appliqué au calque actif — limité à la sélection s'il y en a une"
      width="380px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => onApply(params)}>Appliquer</Button>
        </>
      }>
      <VStack align="stretch" gap="3">
        {(def.params || []).length === 0 && (
          <Text fontSize="xs" color="gray.500">Filtre sans paramètre — il s'applique directement.</Text>
        )}
        {(def.params || []).map((d) => (
          <VStack key={d.key} align="stretch" gap="1">
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.600">{d.label}</Text>
              <HStack gap="1">
                <Input type="number" w="64px" h="24px" fontSize="xs" px="1.5"
                  min={d.min} max={d.max} step={d.step} value={params[d.key] ?? d.def}
                  onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) set(d.key, Math.min(d.max, Math.max(d.min, v))) }} />
                {d.unit && <Text fontSize="2xs" color="gray.400">{d.unit}</Text>}
              </HStack>
            </HStack>
            <Input type="range" min={d.min} max={d.max} step={d.step} h="20px"
              value={params[d.key] ?? d.def}
              onChange={(e) => set(d.key, +e.target.value)} />
          </VStack>
        ))}
      </VStack>
    </Modal>
  )
}

// ---- Calque de réglage : création (choix du type) + édition des paramètres -------
// Non destructif : les changements modifient l'objet adj du calque, le composite
// est recalculé à chaque rendu — pas de « Appliquer » nécessaire.

export function AdjustLayerModal({ open, onClose, editor, layer, onChange }) {
  const adj = layer?.adj
  const p = adj?.params || {}
  const setP = (k, v) => { p[k] = v; onChange() }
  const setKind = (kind) => {
    layer.adj = { kind, params: JSON.parse(JSON.stringify(ADJUST_PARAMS[kind] || {})) }
    layer.name = ADJUST_KINDS.find((k) => k.key === kind)?.label || layer.name
    onChange()
  }
  const sl = (label, key, min, max, step = 1, unit = '') => (
    <VStack key={key} align="stretch" gap="0.5">
      <HStack justify="space-between">
        <Text fontSize="xs" color="gray.600">{label}</Text>
        <Input type="number" w="64px" h="22px" fontSize="xs" px="1.5"
          min={min} max={max} step={step} value={p[key] ?? 0}
          onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setP(key, Math.min(max, Math.max(min, v))) }} />
      </HStack>
      <Input type="range" min={min} max={max} step={step} h="18px"
        value={p[key] ?? 0} onChange={(e) => setP(key, +e.target.value)} />
    </VStack>
  )
  return (
    <Modal open={open} onClose={onClose} title={layer ? `Calque de réglage — ${layer.name}` : 'Calque de réglage'}
      subtitle="Non destructif : transforme les calques situés dessous. Masquez-le ou réordonnez-le à tout moment."
      width="400px">
      <VStack align="stretch" gap="3">
        <HStack gap="2">
          <Text fontSize="xs" color="gray.500" w="70px">Type</Text>
          <Select flex="1" value={adj?.kind || 'bc'} onChange={(e) => setKind(e.target.value)}>
            {ADJUST_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
        </HStack>
        <Box h="1px" bg="gray.100" />
        {adj?.kind === 'bc' && (<>
          {sl('Luminosité', 'brightness', -100, 100)}
          {sl('Contraste', 'contrast', -100, 100)}
        </>)}
        {adj?.kind === 'hsl' && (<>
          {sl('Teinte', 'hue', -180, 180, 1, '°')}
          {sl('Saturation', 'sat', -100, 100)}
          {sl('Luminosité', 'light', -100, 100)}
        </>)}
        {adj?.kind === 'levels' && (<>
          {sl('Noirs entrée', 'inBlack', 0, 254)}
          {sl('Gamma', 'gamma', 10, 400)}
          {sl('Blancs entrée', 'inWhite', 1, 255)}
          {sl('Noirs sortie', 'outBlack', 0, 254)}
          {sl('Blancs sortie', 'outWhite', 1, 255)}
        </>)}
        {adj?.kind === 'curves' && (
          <Text fontSize="xs" color="gray.500">
            Éditez la courbe de ce calque dans l'onglet <b>Courbes</b> du panneau — elle
            s'applique au calque de réglage actif.
          </Text>
        )}
        {adj?.kind === 'invert' && <Text fontSize="xs" color="gray.500">Inverse toutes les couleurs — sans paramètre.</Text>}
        {adj?.kind === 'bw' && (<>
          {sl('Rouge', 'r', 0, 200)}
          {sl('Vert', 'g', 0, 200)}
          {sl('Bleu', 'b', 0, 200)}
        </>)}
        {adj?.kind === 'threshold' && sl('Seuil', 'level', 0, 255)}
        {adj?.kind === 'photoFilter' && (<>
          <HStack gap="2">
            <Text fontSize="xs" color="gray.600" w="90px">Couleur</Text>
            <Input type="color" w="48px" h="26px" p="0" value={p.color || '#c8872a'}
              onChange={(e) => setP('color', e.target.value)} />
          </HStack>
          {sl('Densité', 'density', 0, 100)}
        </>)}
        {adj?.kind === 'vibrance' && (<>
          {sl('Vibrance', 'amount', -100, 100)}
          {sl('Saturation', 'sat', -100, 100)}
        </>)}
        {adj?.kind === 'posterize' && sl('Niveaux', 'levels', 2, 32)}
      </VStack>
    </Modal>
  )
}
