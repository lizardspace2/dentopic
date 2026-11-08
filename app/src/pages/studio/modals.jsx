// Modals du Studio : ouverture d'une photo du workspace, export, sauvegarde.
import { useEffect, useRef, useState } from 'react'
import { Box, Button, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { FiDownload, FiFileText, FiFolder, FiSave } from 'react-icons/fi'
import { Field, Modal, SearchInput, Select, Tip, toast } from '../../components/ui'
import { C, S } from '../../theme'
import PhotoImg from '../../components/PhotoImg'
import { listDossiers, listPhotos } from '../../api'
import SessionComparison from './SessionComparison'
import { rootDossierId } from '../../phototheque'
import { BLEND_MODES, FILTER_DEFS, NEW_DOC_PRESETS, SHEET_SLOTS } from './constants'
import { ADJUST_KINDS, ADJUST_PARAMS, DEFAULT_FX, colorMask, hexToHsv, hsvToHex, hsvToRgb, rgbToHex } from './engine'

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

const fmtBytes = (n) => n == null ? '…' : n >= 1048576 ? `${(n / 1048576).toFixed(2)} M`
  : n >= 1024 ? `${Math.round(n / 1024)} K` : `${n} o`

export function ExportModal({ open, onClose, editor, docName, dossiers, onExport, onSave, onExportPdf }) {
  const [format, setFormat] = useState('jpeg')
  const [quality, setQuality] = useState(92)
  const [scale, setScale] = useState(100)
  const [dossierId, setDossierId] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null) // dataURL de l'aperçu
  const [est, setEst] = useState(null)         // taille estimée (octets)
  const W = editor?.w || 0, H = editor?.h || 0
  const outW = Math.max(1, Math.round(W * scale / 100))
  const outH = Math.max(1, Math.round(H * scale / 100))

  // aperçu + estimation de taille — recalculés (debounce) à chaque réglage
  useEffect(() => {
    if (!open || !editor?.w) return
    let dead = false
    const t = setTimeout(() => {
      try {
        const src = editor.compositeFiltered()
        const c = document.createElement('canvas')
        c.width = outW; c.height = outH
        const cx = c.getContext('2d')
        if (format === 'jpeg') { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, outW, outH) }
        cx.drawImage(src, 0, 0, outW, outH)
        const q = format === 'png' ? undefined : quality / 100
        c.toBlob((b) => { if (!dead && b) setEst(b.size) }, `image/${format}`, q)
        if (!dead) setPreview(c.toDataURL('image/jpeg', 0.72))
      } catch { /* composite pas prêt */ }
    }, 140)
    return () => { dead = true; clearTimeout(t) }
  }, [open, format, quality, scale]) // eslint-disable-line

  const save = async () => {
    setBusy(true)
    const ok = await onSave(dossierId || null)
    setBusy(false)
    setSaved(ok)
    if (ok) toast.success('Image enregistrée dans DentoPic.')
    else toast.error('Enregistrement impossible — réessayez.')
  }
  const lossy = format !== 'png'
  const ext = format === 'jpeg' ? 'JPG' : format.toUpperCase()
  return (
    <Modal open={open} onClose={() => { setSaved(false); onClose() }}
      title="Exporter sous…" subtitle="Format, qualité et dimensions — façon Photoshop"
      width="560px">
      <HStack align="stretch" gap="4">
        {/* colonne réglages */}
        <VStack align="stretch" gap="3" flex="1.1">
          <Text fontSize="2xs" fontWeight="700" color={S.muted} textTransform="uppercase"
            letterSpacing="wider">Paramètres du fichier</Text>
          <HStack gap="3">
            <Text fontSize="xs" color={S.muted} w="58px">Format</Text>
            <Box as="select" flex="1" fontSize="xs" bg={S.input} color={S.fg} borderRadius="md"
              border="1px solid" borderColor={S.border} h="28px" px="2" cursor="pointer"
              value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="jpeg">JPG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </Box>
          </HStack>
          <HStack gap="3" opacity={lossy ? 1 : 0.45}>
            <Text fontSize="xs" color={S.muted} w="58px">Qualité</Text>
            <Input type="range" flex="1" min="1" max="100" value={quality} disabled={!lossy}
              onChange={(e) => setQuality(+e.target.value)} />
            <Input type="number" w="52px" h="22px" fontSize="2xs" px="1" textAlign="center"
              bg={S.input} color={S.fg} border="1px solid" borderColor={S.border}
              min="1" max="100" value={quality} disabled={!lossy}
              onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) setQuality(Math.min(100, Math.max(1, v))) }} />
            <Text fontSize="2xs" color={S.muted}>%</Text>
          </HStack>
          <Text fontSize="2xs" fontWeight="700" color={S.muted} textTransform="uppercase"
            letterSpacing="wider" pt="1">Dimensions de l'image</Text>
          <HStack gap="3">
            <Text fontSize="xs" color={S.muted} w="58px">Échelle</Text>
            <Input type="number" w="64px" h="22px" fontSize="2xs" px="1" textAlign="center"
              bg={S.input} color={S.fg} border="1px solid" borderColor={S.border}
              min="1" max="400" value={scale}
              onChange={(e) => { const v = +e.target.value; if (!isNaN(v) && v > 0) setScale(Math.min(400, v)) }} />
            <Text fontSize="2xs" color={S.muted}>%</Text>
            <Text fontSize="2xs" color={S.fg}>{outW} × {outH} px</Text>
          </HStack>
          {/* rangée sauvegarde DentoPic — spécifique à l'app */}
          <Box h="1px" bg="var(--s-a50)" />
          <HStack gap="3">
            <Text fontSize="xs" color={S.muted} w="58px">Dossier</Text>
            <Box as="select" flex="1" fontSize="xs" bg={S.input} color={S.fg} borderRadius="md"
              border="1px solid" borderColor={S.border} h="26px" px="2" cursor="pointer"
              value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
              <option value="">Non triées</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Box>
          </HStack>
          <Button size="xs" variant="outline" loading={busy} onClick={save}>
            <FiSave /> Enregistrer dans DentoPic (PNG)
          </Button>
          {saved && (
            <HStack bg={C.greenBg} border="1px solid" borderColor={C.greenBorder}
              borderRadius="md" px="3" py="1.5" gap="2">
              <Box as={FiFolder} color={C.greenText} />
              <Text fontSize="2xs" color={C.greenText}>Enregistré — visible dans Recherche.</Text>
            </HStack>
          )}
        </VStack>
        {/* colonne aperçu */}
        <VStack align="stretch" gap="1" flex="1" minW="0">
          <Box borderRadius="md" border="1px solid" borderColor={S.border} overflow="hidden"
            bg={S.canvas} flex="1" minH="200px" display="flex" alignItems="center" justifyContent="center">
            {preview
              ? <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain' }} />
              : <Text fontSize="2xs" color={S.muted}>Aperçu…</Text>}
          </Box>
          <Text fontSize="2xs" color={S.muted}>{ext} ≈ {fmtBytes(est)}</Text>
        </VStack>
      </HStack>
      <HStack justify="end" gap="2" mt="4">
        <Box as="button" px="4" py="1.5" fontSize="xs" borderRadius="md" cursor="pointer"
          bg="var(--s-a100)" color={S.fg} onClick={onClose}>Annuler</Box>
        <Box as="button" px="4" py="1.5" fontSize="xs" borderRadius="md" cursor="pointer"
          bg="var(--s-a100)" color={S.fg} _hover={{ bg: 'var(--s-a50)' }}
          onClick={onExportPdf}>
          <HStack gap="1.5" as="span"><FiFileText /> PDF (A4)</HStack>
        </Box>
        <Box as="button" px="5" py="1.5" fontSize="xs" borderRadius="md" cursor="pointer"
          bg="#1a1a1a" color="#ffffff" _hover={{ bg: '#333333' }}
          onClick={() => { onExport({ format, quality, scale }); }}>
          <HStack gap="1.5" as="span"><FiDownload /> Exporter</HStack>
        </Box>
      </HStack>
    </Modal>
  )
}

// ---- Montage avant / après : choisir 2 photos + mise en page ----------------------

const slotBox = {
  w: '120px', h: '96px', borderRadius: 'md', border: '1.5px dashed',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 'xs', color: 'gray.400', overflow: 'hidden', position: 'relative',
}

export function MontageModal({ open, onClose, wsId, onCreate, sourcePhoto, comparisonPhoto }) {
  const [photos, setPhotos] = useState([])
  const [avant, setAvant] = useState(null)
  const [apres, setApres] = useState(null)
  const [layout, setLayout] = useState('side')
  const [labels, setLabels] = useState(true)
  const [busy, setBusy] = useState(false)

  const [dossiers, setDossiers] = useState([])
  const [dossierId, setDossierId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !wsId) return
    let active = true
    setDossierId(sourcePhoto?.dossier_id || '')
    setAvant(sourcePhoto || null)
    setApres(comparisonPhoto && comparisonPhoto.id !== sourcePhoto?.id && comparisonPhoto.dossier_id === sourcePhoto?.dossier_id ? comparisonPhoto : null)
    setLayout('side'); setLabels(true)
    setLoading(true); setError('')
    Promise.all([listPhotos(wsId, { limit: 500 }), listDossiers(wsId)])
      .then(([ps, ds]) => {
        if (!active) return
        setPhotos(ps); setDossiers(ds)
        if (comparisonPhoto && comparisonPhoto.id !== sourcePhoto?.id && comparisonPhoto.dossier_id
          && rootDossierId(ds, comparisonPhoto.dossier_id) === rootDossierId(ds, sourcePhoto?.dossier_id)) setApres(comparisonPhoto)
      })
      .catch(() => { if (active) setError('Impossible de charger les photos. Réessayez.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, wsId, sourcePhoto, comparisonPhoto])

  const pick = (p) => {
    if (!avant) setAvant(p)
    else if (!apres && p.id !== avant.id) {
      if (avant.dossier_id && p.dossier_id && rootDossierId(dossiers, avant.dossier_id) !== rootDossierId(dossiers, p.dossier_id)) {
        setError('Choisissez deux photos du même dossier patient.')
        return
      }
      setError(''); setApres(p)
    }
    else { setAvant(p); setApres(null) }
  }

  const create = async (thenExport) => {
    setBusy(true); setError('')
    try { await onCreate(avant, apres, { layout, labels }, thenExport) }
    catch { setError('Impossible de créer le montage. Réessayez.') }
    finally { setBusy(false) }
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
        <>
          <Button size="sm" variant="outline" disabled={!avant || !apres} loading={busy}
            onClick={() => create(true)}>
            Créer puis enregistrer…
          </Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            disabled={!avant || !apres} loading={busy}
            onClick={() => create(false)}>
            Créer le montage
          </Button>
        </>
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
        {avant && apres && <SessionComparison key={`${avant.id}:${apres.id}`} before={avant} after={apres}
          onCreateAligned={(alignedImages) => onCreate(avant, apres, { layout, labels, alignedImages }, true)} />}
        <Text fontSize="xs" color="gray.500">
          Comparez le même patient, la même vue et des conditions de lumière proches. Le montage ne corrige pas un angle de prise de vue différent.
        </Text>
        <Select w="100%" aria-label="Patient à comparer" value={dossierId}
          onChange={(e) => { setDossierId(e.target.value); setAvant(null); setApres(null) }}>
          <option value="">Tous les dossiers</option>
          {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Button size="xs" variant="outline" disabled={!avant || !apres}
          onClick={() => { setAvant(apres); setApres(avant) }}>Inverser avant / après</Button>
        {loading && <Text fontSize="xs">Chargement des photos…</Text>}
        {error && <Text fontSize="xs" role="alert">{error}</Text>}
        {!loading && !error && !photos.some((p) => !dossierId || p.dossier_id === dossierId) && (
          <Text fontSize="xs">Aucune photo dans ce dossier.</Text>
        )}
        <SimpleGrid columns={{ base: 4, md: 6 }} gap="2" maxH="240px" overflowY="auto">
          {photos.filter((p) => !dossierId || p.dossier_id === dossierId).map((p) => {
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
          <Button size="sm" variant="outline" disabled={!filled} loading={busy}
            onClick={async () => { setBusy(true); await onCompose(slots, true); setBusy(false) }}>
            Composer puis enregistrer…
          </Button>
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
          <Box as="select" flex="1" fontSize="xs" bg={S.input} color={S.fg} borderRadius="sm"
            border="1px solid" borderColor="var(--s-a200)" h="24px" px="1"
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
          <Box as="select" flex="1" fontSize="xs" bg={S.input} color={S.fg} borderRadius="sm"
            border="1px solid" borderColor="var(--s-a200)" h="24px" px="1"
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
          borderRight="1px solid" borderColor="var(--s-a100)" pr="1">
          <Text fontSize="2xs" fontWeight="700" color="gray.400" px="2" py="1">Styles</Text>
          {FX_SECTIONS.map(({ key, label, fixed }) => {
            const on = fixed || fx[key]?.on
            return (
              <Tip key={key} label={fixed ? 'Fusion, opacité, remplissage' : `${on ? 'Actif' : 'Inactif'} — cocher pour activer, cliquer pour régler`}>
                <HStack px="2" py="1.5" gap="2" fontSize="xs" cursor="pointer" data-fxrow={key}
                  bg={sel === key ? 'var(--s-a100)' : 'transparent'} borderRadius="sm"
                  color={sel === key ? S.fg : S.muted}
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
          <Text fontSize="xs" fontWeight="700" color={S.fg}>
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

export function FilterModal({ open, onClose, def, onPreview, onPreviewOff, onApply, onCancel }) {
  const [params, setParams] = useState({})
  const [previewOn, setPreviewOn] = useState(true)
  useEffect(() => {
    if (open && def) {
      const p = {}
      for (const d of def.params || []) p[d.key] = d.def
      setParams(p)
      setPreviewOn(true)
    }
  }, [open, def])
  const set = (k, v) => {
    const p = { ...params, [k]: v }
    setParams(p)
    if (previewOn) onPreview?.(p)
  }
  const togglePreview = () => {
    const on = !previewOn
    setPreviewOn(on)
    if (on) onPreview?.(params)
    else onPreviewOff?.()
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
        <HStack gap="2" cursor="pointer" onClick={togglePreview} userSelect="none" data-preview-toggle>
          <Box w="14px" h="14px" borderRadius="sm" border="1px solid"
            borderColor={previewOn ? '#4f8fe8' : 'gray.500'}
            bg={previewOn ? '#4f8fe8' : 'transparent'} color="#ffffff"
            fontSize="2xs" lineHeight="14px" textAlign="center">
            {previewOn ? '✓' : ''}
          </Box>
          <Text fontSize="xs" color="gray.600">Aperçu</Text>
        </HStack>
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

// ---- « Sélection et masque » : espace d'affinement du bord (façon Photoshop) ----

export function SelectMaskModal({ open, onClose, editor, onApply, onChange }) {
  const saved = useRef(null)         // état de sélection pour Annuler
  const [fe, setFe] = useState(0)    // contour progressif (px)
  const [shift, setShift] = useState(0) // déplacer le bord (px)
  const [smo, setSmo] = useState(0)  // lisser (itérations)
  const [view, setView] = useState('overlay') // overlay | masque | none
  const applied = useRef({ shift: 0, smo: 0, snap: false })
  const cvRef = useRef(null)
  const W = 460
  const H = editor?.w ? Math.min(300, Math.round(W * editor.h / editor.w)) : 200

  useEffect(() => {
    if (!open || !editor) return
    saved.current = editor.sel || editor.selPoly
      ? { sel: editor.sel && [...editor.sel], selPoly: editor.selPoly && editor.selPoly.map((p) => [...p]), selEllipse: editor.selEllipse, selInverted: editor.selInverted }
      : null
    setFe(0); setShift(0); setSmo(0); setView('overlay')
    applied.current = { shift: 0, smo: 0, snap: false }
  }, [open]) // eslint-disable-line

  const ensureSnap = () => {
    if (!applied.current.snap) { editor.snapshot('Sélection et masque'); applied.current.snap = true }
  }

  const draw = () => {
    const cv = cvRef.current
    if (!cv || !editor?.w) return
    const ctx = cv.getContext('2d')
    const k = Math.min(W / editor.w, H / editor.h)
    cv.width = W; cv.height = Math.round(editor.h * k)
    ctx.drawImage(editor.compositeFiltered(), 0, 0, editor.w * k, editor.h * k)
    // superposition rouge hors sélection (comme le mode Superposition de PS)
    if (view !== 'none') {
      ctx.save()
      ctx.scale(k, k)
      ctx.beginPath(); ctx.rect(0, 0, editor.w, editor.h)
      editor._selPath(ctx, 0, 0, true)
      ctx.filter = fe > 0 ? `blur(${fe * k}px)` : 'none'
      ctx.fillStyle = view === 'overlay' ? 'rgba(224,60,60,0.5)' : 'rgba(0,0,0,0.72)'
      ctx.fill('evenodd')
      ctx.restore()
      ctx.filter = 'none'
    }
  }
  useEffect(draw, [open, fe, view, editor?.w]) // eslint-disable-line

  const sl = (label, val, set, min, max, onUpd) => (
    <VStack align="stretch" gap="0.5">
      <HStack justify="space-between">
        <Text fontSize="2xs" color={S.muted}>{label}</Text>
        <Text fontSize="2xs" color={S.fg}>{val} px</Text>
      </HStack>
      <Input type="range" min={min} max={max} value={val} h="16px"
        onChange={(e) => { const v = +e.target.value; set(v); onUpd?.(v) }} />
    </VStack>
  )

  const close = (ok) => {
    if (ok) onApply?.(fe)
    else if (saved.current) { // Annuler : restaure la sélection d'origine
      editor.sel = saved.current.sel; editor.selPoly = saved.current.selPoly
      editor.selEllipse = saved.current.selEllipse; editor.selInverted = saved.current.selInverted
      onChange?.()
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={() => close(false)} title="Sélection et masque"
      subtitle="Affinez le bord de la sélection — superposition façon Photoshop" width="520px">
      <VStack align="stretch" gap="3">
        <Box as="canvas" ref={cvRef} borderRadius="md" border="1px solid" borderColor={S.border}
          w="100%" bg={S.canvas} />
        <HStack gap="2">
          {[['overlay', 'Superposition'], ['mask', 'Masque'], ['none', 'Sans aperçu']].map(([k, l]) => (
            <Box as="button" key={k} px="2" py="0.5" fontSize="2xs" borderRadius="sm" cursor="pointer"
              bg={view === k ? '#4f8fe8' : 'var(--s-a100)'} color={view === k ? '#ffffff' : S.fg}
              onClick={() => setView(k)}>{l}</Box>
          ))}
        </HStack>
        {sl('Contour progressif (plume)', fe, (v) => { setFe(v); draw() }, 0, 100)}
        {sl('Déplacer le bord', shift, (v) => {
          ensureSnap()
          editor.resizeSelection(v - applied.current.shift)
          applied.current.shift = v; setShift(v); onChange?.()
        }, -100, 100)}
        {sl('Lisser le contour', smo, (v) => {
          if (v > applied.current.smo) { ensureSnap(); editor.smoothSelection(v - applied.current.smo); onChange?.() }
          applied.current.smo = Math.max(applied.current.smo, v); setSmo(v)
        }, 0, 20)}
        <HStack justify="end" gap="2">
          <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" cursor="pointer"
            bg="var(--s-a100)" color={S.fg} onClick={() => close(false)}>Annuler</Box>
          <Box as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" cursor="pointer"
            bg={C.primary} color="#ffffff" onClick={() => close(true)}>OK</Box>
        </HStack>
      </VStack>
    </Modal>
  )
}

// ---- Fichier → Nouveau document vierge --------------------------------------------

export function NewDocModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('Sans titre-1')
  const [w, setW] = useState(1920)
  const [h, setH] = useState(1080)
  const [bg, setBg] = useState('transparent')
  const [custom, setCustom] = useState('#ffffff')
  useEffect(() => {
    if (open) { setName('Sans titre-1'); setW(1920); setH(1080); setBg('transparent'); setCustom('#ffffff') }
  }, [open])
  return (
    <Modal open={open} onClose={onClose} title="Nouveau document"
      subtitle="Canevas vierge — les photos s'y importent ensuite" width="420px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => onCreate({
              name: name.trim() || 'Sans titre-1',
              w: Math.max(8, Math.min(16000, Math.round(w))),
              h: Math.max(8, Math.min(16000, Math.round(h))),
              bg: bg === 'custom' ? custom : bg,
            })}>Créer</Button>
        </>
      }>
      <VStack align="stretch" gap="3">
        <Field label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} h="34px" fontSize="sm" />
        </Field>
        <Field label="Format prédéfini">
          <Select w="100%" onChange={(e) => {
            const p = NEW_DOC_PRESETS[+e.target.value]
            if (p) { setW(p.w); setH(p.h) }
          }}>
            <option value="-1">Personnalisé</option>
            {NEW_DOC_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name} — {p.w}×{p.h}</option>)}
          </Select>
        </Field>
        <HStack gap="3">
          <Field label="Largeur (px)" flex="1">
            <Input type="number" value={w} min={8} max={16000} h="34px" fontSize="sm"
              onChange={(e) => setW(+e.target.value || 8)} />
          </Field>
          <Field label="Hauteur (px)" flex="1">
            <Input type="number" value={h} min={8} max={16000} h="34px" fontSize="sm"
              onChange={(e) => setH(+e.target.value || 8)} />
          </Field>
        </HStack>
        <Field label="Contenu de l'arrière-plan">
          <HStack>
            <Select flex="1" value={bg} onChange={(e) => setBg(e.target.value)}>
              <option value="transparent">Transparent</option>
              <option value="#ffffff">Blanc</option>
              <option value="#000000">Noir</option>
              <option value="custom">Couleur…</option>
            </Select>
            {bg === 'custom' && (
              <Input type="color" value={custom} w="44px" h="34px" p="0.5"
                onChange={(e) => setCustom(e.target.value)} />
            )}
          </HStack>
        </Field>
      </VStack>
    </Modal>
  )
}

// ---- Image → Taille de la zone de travail (Canvas Size + ancre) --------------------

export function CanvasSizeModal({ open, onClose, editor, onApply }) {
  const [w, setW] = useState(0)
  const [h, setH] = useState(0)
  const [anchor, setAnchor] = useState(4) // index 0-8 dans la grille 3×3 (4 = centre)
  useEffect(() => {
    if (open && editor?.w) { setW(editor.w); setH(editor.h); setAnchor(4) }
  }, [open]) // eslint-disable-line
  const ax = (anchor % 3) / 2, ay = Math.floor(anchor / 3) / 2
  return (
    <Modal open={open} onClose={onClose} title="Taille de la zone de travail"
      subtitle={`Actuelle : ${editor?.w || 0} × ${editor?.h || 0} px — les pixels ne sont pas mis à l'échelle`}
      width="400px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => onApply(Math.max(8, Math.round(w)), Math.max(8, Math.round(h)), ax, ay)}>OK</Button>
        </>
      }>
      <VStack align="stretch" gap="3">
        <HStack gap="3">
          <Field label="Nouvelle largeur (px)" flex="1">
            <Input type="number" value={w} min={8} max={16000} h="34px" fontSize="sm"
              onChange={(e) => setW(+e.target.value || 8)} />
          </Field>
          <Field label="Nouvelle hauteur (px)" flex="1">
            <Input type="number" value={h} min={8} max={16000} h="34px" fontSize="sm"
              onChange={(e) => setH(+e.target.value || 8)} />
          </Field>
        </HStack>
        <Box>
          <Text fontSize="xs" fontWeight="500" color={C.ink} mb="1.5">Ancrage</Text>
          <SimpleGrid columns={3} gap="1" w="120px">
            {Array.from({ length: 9 }, (_, i) => (
              <Box as="button" key={i} w="36px" h="36px" borderRadius="sm" cursor="pointer"
                border="1px solid" borderColor={anchor === i ? C.primary : S.border}
                bg={anchor === i ? C.primary : S.input}
                onClick={() => setAnchor(i)} />
            ))}
          </SimpleGrid>
          <Text fontSize="2xs" color={S.muted} mt="1.5">
            Le carré bleu indique le bord de l'image qui reste fixe.
          </Text>
        </Box>
      </VStack>
    </Modal>
  )
}

// ---- Édition → Remplir… (contenu + mode + opacité + plume) -------------------------

export function FillModal({ open, onClose, fg, bg, onApply }) {
  const [content, setContent] = useState('fg')
  const [custom, setCustom] = useState('#808080')
  const [blend, setBlend] = useState('source-over')
  const [opacity, setOpacity] = useState(100)
  const [feather, setFeather] = useState(0)
  useEffect(() => {
    if (open) { setContent('fg'); setBlend('source-over'); setOpacity(100); setFeather(0) }
  }, [open])
  const color = content === 'fg' ? fg : content === 'bg' ? bg
    : content === 'black' ? '#000000' : content === 'gray50' ? '#808080'
    : content === 'white' ? '#ffffff' : custom
  return (
    <Modal open={open} onClose={onClose} title="Remplir"
      subtitle="Remplit la sélection (ou le calque actif entier)" width="400px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => onApply({ color, opacity: opacity / 100, blend, feather })}>OK</Button>
        </>
      }>
      <VStack align="stretch" gap="3">
        <Field label="Contenu">
          <HStack>
            <Select flex="1" value={content} onChange={(e) => setContent(e.target.value)}>
              <option value="fg">Premier plan</option>
              <option value="bg">Arrière-plan</option>
              <option value="custom">Couleur…</option>
              <option value="black">Noir</option>
              <option value="gray50">50 % gris</option>
              <option value="white">Blanc</option>
            </Select>
            <Box w="30px" h="30px" borderRadius="sm" border="1px solid" borderColor={S.border} bg={color} />
            {content === 'custom' && (
              <Input type="color" value={custom} w="44px" h="30px" p="0.5"
                onChange={(e) => setCustom(e.target.value)} />
            )}
          </HStack>
        </Field>
        <Field label="Mode">
          <Select w="100%" value={blend} onChange={(e) => setBlend(e.target.value)}>
            {BLEND_MODES.map(([label, v]) => <option key={v} value={v}>{label}</option>)}
          </Select>
        </Field>
        <HStack justify="space-between">
          <Text fontSize="xs" color={C.ink}>Opacité</Text>
          <Text fontSize="xs" color={S.fg}>{opacity} %</Text>
        </HStack>
        <Input type="range" min={1} max={100} value={opacity} h="20px"
          onChange={(e) => setOpacity(+e.target.value)} />
        <HStack justify="space-between">
          <Text fontSize="xs" color={C.ink}>Contour progressif</Text>
          <Text fontSize="xs" color={S.fg}>{feather} px</Text>
        </HStack>
        <Input type="range" min={0} max={100} value={feather} h="20px"
          onChange={(e) => setFeather(+e.target.value)} />
      </VStack>
    </Modal>
  )
}

// ---- Édition → Contour… (trait le long de la sélection) ----------------------------

export function StrokeModal({ open, onClose, fg, onApply }) {
  const [width, setWidth] = useState(4)
  const [color, setColor] = useState(null)
  const [pos, setPos] = useState('center')
  useEffect(() => { if (open) { setWidth(4); setColor(null); setPos('center') } }, [open])
  return (
    <Modal open={open} onClose={onClose} title="Contour"
      subtitle="Trace un trait le long du bord de la sélection" width="380px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => onApply({ color: color || fg, width, pos })}>OK</Button>
        </>
      }>
      <VStack align="stretch" gap="3">
        <HStack gap="3">
          <Field label="Largeur (px)" flex="1">
            <Input type="number" value={width} min={1} max={250} h="34px" fontSize="sm"
              onChange={(e) => setWidth(Math.max(1, +e.target.value || 1))} />
          </Field>
          <Field label="Couleur">
            <Input type="color" value={color || fg} w="60px" h="34px" p="0.5"
              onChange={(e) => setColor(e.target.value)} />
          </Field>
        </HStack>
        <Field label="Position">
          <Select w="100%" value={pos} onChange={(e) => setPos(e.target.value)}>
            <option value="inside">Intérieur</option>
            <option value="center">Centré</option>
            <option value="outside">Extérieur</option>
          </Select>
        </Field>
      </VStack>
    </Modal>
  )
}

// ---- Sélection → Plage de couleurs (pipette sur l'aperçu + tolérance) --------------

export function ColorRangeModal({ open, onClose, editor, onApply }) {
  const cvRef = useRef(null)
  const [rgb, setRgb] = useState(null)
  const [tol, setTol] = useState(60)
  const W = 460, H = 300

  const draw = () => {
    const cv = cvRef.current
    if (!cv || !editor?.w) return
    const k = Math.min(W / editor.w, H / editor.h)
    cv.width = Math.round(editor.w * k); cv.height = Math.round(editor.h * k)
    const ctx = cv.getContext('2d')
    ctx.drawImage(editor.compositeFiltered(), 0, 0, cv.width, cv.height)
    if (rgb) { // aperçu : pixels retenus en surbrillance rouge
      const mask = colorMask(cv, rgb, tol)
      const img = ctx.getImageData(0, 0, cv.width, cv.height)
      for (let i = 0; i < mask.length; i++) if (mask[i]) {
        img.data[i * 4] = 255
        img.data[i * 4 + 1] = img.data[i * 4 + 1] * 0.35
        img.data[i * 4 + 2] = img.data[i * 4 + 2] * 0.35
      }
      ctx.putImageData(img, 0, 0)
    }
  }
  useEffect(() => { if (open) { setRgb(null); setTol(60) } }, [open])
  useEffect(draw, [open, rgb, tol]) // eslint-disable-line

  return (
    <Modal open={open} onClose={onClose} title="Plage de couleurs"
      subtitle="Clique la couleur à sélectionner dans l'aperçu — la zone retenue s'affiche en rouge"
      width="500px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            disabled={!rgb} onClick={() => onApply(rgb, tol)}>OK</Button>
        </>
      }>
      <VStack align="stretch" gap="3">
        <Box as="canvas" ref={cvRef} borderRadius="md" border="1px solid" borderColor={S.border}
          cursor="crosshair" bg={S.canvas}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const x = Math.round((e.clientX - r.left) * (cvRef.current.width / r.width))
            const y = Math.round((e.clientY - r.top) * (cvRef.current.height / r.height))
            const d = cvRef.current.getContext('2d').getImageData(x, y, 1, 1).data
            setRgb([d[0], d[1], d[2]])
          }} />
        <HStack justify="space-between">
          <HStack gap="2">
            <Box w="24px" h="24px" borderRadius="sm" border="1px solid" borderColor={S.border}
              bg={rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : 'transparent'} />
            <Text fontSize="xs" color={S.fg}>{rgb ? `RVB ${rgb.join(', ')}` : 'Cliquez dans l’aperçu'}</Text>
          </HStack>
          <HStack gap="2">
            <Text fontSize="xs" color={C.ink}>Tolérance</Text>
            <Text fontSize="xs" color={S.fg}>{tol}</Text>
          </HStack>
        </HStack>
        <Input type="range" min={5} max={200} value={tol} h="20px"
          onChange={(e) => setTol(+e.target.value)} />
      </VStack>
    </Modal>
  )
}

// ---- Sélection → Transformer la sélection (translation, échelle, rotation) ---------

export function TransformSelModal({ open, onClose, onApply }) {
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [sx, setSx] = useState(100)
  const [sy, setSy] = useState(100)
  const [angle, setAngle] = useState(0)
  useEffect(() => { if (open) { setDx(0); setDy(0); setSx(100); setSy(100); setAngle(0) } }, [open])
  const num = (v, set, d = 0) => set(Number.isFinite(+v) ? +v : d)
  return (
    <Modal open={open} onClose={onClose} title="Transformer la sélection"
      subtitle="Déplace, redimensionne ou pivote le cadre de sélection — l'image n'est pas modifiée" width="380px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => onApply({ dx, dy, sx: sx / 100, sy: sy / 100, angle: (angle * Math.PI) / 180 })}>OK</Button>
        </>
      }>
      <VStack align="stretch" gap="3">
        <HStack gap="3">
          <Field label="Déplacer X (px)" flex="1">
            <Input type="number" value={dx} h="34px" fontSize="sm" onChange={(e) => num(e.target.value, setDx)} />
          </Field>
          <Field label="Déplacer Y (px)" flex="1">
            <Input type="number" value={dy} h="34px" fontSize="sm" onChange={(e) => num(e.target.value, setDy)} />
          </Field>
        </HStack>
        <HStack gap="3">
          <Field label="Échelle X (%)" flex="1">
            <Input type="number" value={sx} h="34px" fontSize="sm" onChange={(e) => num(e.target.value, setSx, 100)} />
          </Field>
          <Field label="Échelle Y (%)" flex="1">
            <Input type="number" value={sy} h="34px" fontSize="sm" onChange={(e) => num(e.target.value, setSy, 100)} />
          </Field>
        </HStack>
        <Field label="Rotation (°)">
          <Input type="number" value={angle} h="34px" fontSize="sm" onChange={(e) => num(e.target.value, setAngle)} />
        </Field>
      </VStack>
    </Modal>
  )
}

// ---- Sélection → Canaux alpha (Mémoriser / Récupérer la sélection) -----------------

export function SavedSelModal({ open, onClose, editor, version, onApply }) {
  const [name, setName] = useState('')
  const list = editor?.savedSels || []
  return (
    <Modal open={open} onClose={onClose} title="Sélections mémorisées"
      subtitle="Canaux alpha du document — récupérer une zone pour la retravailler plus tard" width="420px">
      <VStack align="stretch" gap="3">
        <HStack gap="2">
          <Input flex="1" placeholder="Nom du canal (ex : dent 21)" value={name} h="34px" fontSize="sm"
            onChange={(e) => setName(e.target.value)} />
          <Button size="sm" variant="outline"
            onClick={() => { editor.saveSel(name); setName(''); onApply() }}>
            Mémoriser la sélection
          </Button>
        </HStack>
        <VStack align="stretch" gap="1" maxH="300px" overflowY="auto">
          {list.map((s) => (
            <HStack key={s.id} gap="2" px="2" py="1" borderRadius="sm" bg={S.tile}>
              <Box w="42px" h="30px" flexShrink={0} borderRadius="sm" overflow="hidden"
                border="1px solid" borderColor={S.border} bg="#000">
                <img src={s.cv.toDataURL('image/png')} alt="" style={{ width: '100%', height: '100%' }} />
              </Box>
              <Text flex="1" fontSize="xs" color={S.fg} isTruncated>{s.name}</Text>
              <Button size="xs" variant="outline" onClick={() => { editor.loadSel(s.id); onApply() }}>Récupérer</Button>
              <Button size="xs" variant="outline" onClick={() => { editor.deleteSel(s.id); onApply() }}>✕</Button>
            </HStack>
          ))}
          {!list.length && (
            <Text fontSize="xs" color="gray.500" textAlign="center" py="4">
              Aucun canal — sélectionne une zone puis « Mémoriser la sélection ».
            </Text>
          )}
        </VStack>
      </VStack>
    </Modal>
  )
}

// ---- Édition → Atténuer (fondu du dernier filtre) ----------------------------------

export function FadeModal({ open, onClose, label = 'le dernier filtre', onApply }) {
  const [t, setT] = useState(50)
  useEffect(() => { if (open) setT(50) }, [open])
  return (
    <Modal open={open} onClose={onClose} title={`Atténuer ${label}`}
      subtitle="Dose l'effet du dernier filtre appliqué — 100 % = inchangé" width="360px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => onApply(t / 100)}>OK</Button>
        </>
      }>
      <VStack align="stretch" gap="2">
        <HStack justify="space-between">
          <Text fontSize="xs" color={C.ink}>Opacité de l'effet</Text>
          <Text fontSize="xs" color={S.fg}>{t} %</Text>
        </HStack>
        <Input type="range" min={0} max={100} value={t} h="20px"
          onChange={(e) => setT(+e.target.value)} />
      </VStack>
    </Modal>
  )
}

// ---- Filtre → Fluidité : déformation interactive au pinceau --------------------
// Champ de déplacement cumulé sur une grille (cell=8px) ; l'aperçu est calculé
// par échantillonnage inverse en résolution réduite, la cuisson utilise
// editor.warpField (triangles affines, pleine résolution) à la validation.

const LIQ_TOOLS = [
  ['push', 'Pousser', 'Glisser pour déplacer la matière dans le sens du geste'],
  ['bloat', 'Gonfler', 'Éloigne les pixels du centre — maintien pour amplifier'],
  ['pucker', 'Pincer', 'Rapproche les pixels du centre — maintien pour amplifier'],
  ['twirl', 'Tourbillon', 'Fait pivoter la matière autour du centre'],
  ['recon', 'Reconstruire', 'Atténue la déformation là où vous peignez'],
]

export function LiquifyModal({ open, onClose, editor, onDone }) {
  const [tool, setTool] = useState('push')
  const [size, setSize] = useState(120)
  const [strength, setStrength] = useState(60)
  const cvRef = useRef(null)
  const st = useRef(null) // { layer, src, data, gw, gh, cell, s, pw, ph, down, last }
  const [, setTick] = useState(0)

  // (Ré)initialisation à l'ouverture : source = raster courant du calque actif
  useEffect(() => {
    if (!open) return
    const layer = editor.active
    if (!layer?.cv) { st.current = null; return }
    const w = editor.w, h = editor.h
    const src = document.createElement('canvas')
    src.width = w; src.height = h
    src.getContext('2d').drawImage(layer.cv, 0, 0)
    const cell = 8, gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1
    const s = Math.min(1, 680 / w, 520 / h)
    st.current = {
      layer, src, gw, gh, cell, s,
      pw: Math.max(8, Math.round(w * s)), ph: Math.max(8, Math.round(h * s)),
      data: new Float32Array(gw * gh * 2), down: false, last: null,
      srcData: src.getContext('2d').getImageData(0, 0, w, h).data,
    }
    setTick((t) => t + 1)
  }, [open])

  // Rendu de l'aperçu : chaque pixel de sortie lit la source à (p − field(p)).
  const render = () => {
    const S = st.current, cv = cvRef.current
    if (!S || !cv) return
    const { pw, ph, s, data, gw, gh, cell, srcData } = S
    if (cv.width !== pw) { cv.width = pw; cv.height = ph }
    const ctx = cv.getContext('2d')
    const out = ctx.createImageData(pw, ph)
    const o = out.data
    const w2 = editor.w, h2 = editor.h
    const fieldAt = (x, y) => {
      const gx = Math.min(Math.max(x / cell, 0), gw - 1.001)
      const gy = Math.min(Math.max(y / cell, 0), gh - 1.001)
      const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j
      const k = (j * gw + i) * 2
      const fx = data[k] * (1 - u) * (1 - v) + data[k + 2] * u * (1 - v)
        + data[k + 2 * gw] * (1 - u) * v + data[k + 2 * gw + 2] * u * v
      const fy = data[k + 1] * (1 - u) * (1 - v) + data[k + 3] * u * (1 - v)
        + data[k + 2 * gw + 1] * (1 - u) * v + data[k + 2 * gw + 3] * u * v
      return [fx, fy]
    }
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const X = x / s, Y = y / s
        const [fx, fy] = fieldAt(X, Y)
        const sx = Math.min(Math.max(X - fx, 0), w2 - 1), sy = Math.min(Math.max(Y - fy, 0), h2 - 1)
        const si = (Math.round(sy) * w2 + Math.round(sx)) * 4
        const di = (y * pw + x) * 4
        o[di] = srcData[si]; o[di + 1] = srcData[si + 1]; o[di + 2] = srcData[si + 2]; o[di + 3] = srcData[si + 3]
      }
    }
    const tmp = document.createElement('canvas')
    tmp.width = pw; tmp.height = ph
    tmp.getContext('2d').putImageData(out, 0, 0)
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, 0, pw, ph)
    ctx.fillStyle = '#cbd5e1'
    for (let y = 0; y < ph; y += 12) for (let x = ((y / 12) % 2) * 12; x < pw; x += 24) ctx.fillRect(x, y, 12, 12)
    ctx.drawImage(tmp, 0, 0)
  }
  useEffect(() => { if (open) render() })

  // Application du pinceau au champ (coords doc)
  const brush = (x, y, dx = 0, dy = 0) => {
    const S = st.current
    if (!S) return
    const r = size, stg = strength / 100
    const i0 = Math.max(0, Math.floor((x - r) / S.cell)), i1 = Math.min(S.gw - 1, Math.ceil((x + r) / S.cell))
    const j0 = Math.max(0, Math.floor((y - r) / S.cell)), j1 = Math.min(S.gh - 1, Math.ceil((y + r) / S.cell))
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const vx = i * S.cell - x, vy = j * S.cell - y
        const d = Math.hypot(vx, vy)
        if (d >= r) continue
        const w = (1 - d / r) ** 2 * stg
        const k = (j * S.gw + i) * 2
        if (tool === 'push') { S.data[k] += dx * w; S.data[k + 1] += dy * w }
        else if (tool === 'bloat' || tool === 'pucker') {
          const m = (r * 0.08 * w) / (d || 1) * (tool === 'bloat' ? 1 : -1)
          S.data[k] += vx * m; S.data[k + 1] += vy * m
        } else if (tool === 'twirl') {
          const m = (r * 0.35 * w) / (d || 1)
          S.data[k] += -vy * m; S.data[k + 1] += vx * m
        } else if (tool === 'recon') { S.data[k] *= 1 - w * 0.3; S.data[k + 1] *= 1 - w * 0.3 }
      }
    }
  }

  const pos = (e) => {
    const S = st.current, b = cvRef.current.getBoundingClientRect()
    return [(e.clientX - b.left) / S.s, (e.clientY - b.top) / S.s]
  }
  const onDown = (e) => {
    e.preventDefault()
    const S = st.current
    if (!S) return
    const [x, y] = pos(e)
    S.down = true; S.last = [x, y]
    if (tool !== 'push') brush(x, y)
    const tick = setInterval(() => {
      if (!S.down || tool === 'push' || !S.last) return
      brush(S.last[0], S.last[1]); render()
    }, 40)
    const up = () => { clearInterval(tick); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointerup', up)
  }
  const onMove = (e) => {
    const S = st.current
    if (!S?.down) return
    const [x, y] = pos(e)
    const [lx, ly] = S.last
    if (tool === 'push') brush(x, y, (x - lx) / 2, (y - ly) / 2)
    else brush(x, y)
    S.last = [x, y]
    render()
  }
  const onUp = () => { if (st.current) st.current.down = false }

  const apply = () => {
    const S = st.current
    if (!S) { onClose(); return }
    const has = S.data.some((v) => v !== 0)
    if (has) {
      editor.snapshot('Fluidité')
      editor.warpField(S.layer, { data: S.data, gw: S.gw, gh: S.gh, cell: S.cell }, 2)
      onDone?.()
    }
    onClose()
  }
  const reset = () => { st.current?.data.fill(0); render() }

  return (
    <Modal open={open} onClose={onClose} title="Fluidité"
      subtitle="Déformation interactive au pinceau — façon Photoshop (Ctrl+Maj+X)" width="980px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={reset}>Tout reconstruire</Button>
          <Box flex="1" />
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={apply}>OK</Button>
        </>
      }>
      <HStack align="stretch" gap="3">
        <VStack w="150px" flexShrink={0} align="stretch" gap="0.5">
          {LIQ_TOOLS.map(([k, label, tip]) => (
            <Tip key={k} label={tip}>
              <Box as="button" w="100%" textAlign="left" px="2" py="1.5" fontSize="xs" borderRadius="md"
                cursor="pointer" bg={tool === k ? C.primary : 'transparent'}
                color={tool === k ? '#ffffff' : C.ink}
                _hover={{ bg: tool === k ? C.primary : 'blackAlpha.50' }}
                onClick={() => setTool(k)}>
                {label}
              </Box>
            </Tip>
          ))}
          <Box pt="3">
            <Text fontSize="2xs" color="gray.500">Taille : {size}px</Text>
            <Input type="range" min={10} max={400} value={size} h="18px"
              onChange={(e) => setSize(+e.target.value)} />
            <Text fontSize="2xs" color="gray.500">Intensité : {strength}%</Text>
            <Input type="range" min={5} max={100} value={strength} h="18px"
              onChange={(e) => setStrength(+e.target.value)} />
          </Box>
        </VStack>
        <Box flex="1" bg="blackAlpha.50" borderRadius="md" overflow="hidden"
          display="flex" alignItems="center" justifyContent="center" minH="300px">
          <canvas ref={cvRef} style={{ cursor: 'crosshair', maxWidth: '100%' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
        </Box>
      </HStack>
    </Modal>
  )
}

// ---- Filtre → Galerie de filtres : vignettes de prévisualisation (Photoshop) ---
// Chaque vignette = composite réduit + filtre appliqué avec ses paramètres par
// défaut. Clic sur une vignette → grande préview ; OK ouvre le dialogue de
// réglage du filtre (ou applique directement s'il est sans paramètre).

const GALLERY_GROUPS = [
  ['Flou', ['gaussian', 'motion']],
  ['Netteté', ['sharpen', 'highpass']],
  ['Distorsion', ['twirl', 'wave']],
  ['Bruit', ['noise', 'denoise']],
  ['Pixellisation', ['pixelate']],
  ['Stylisation', ['emboss', 'solarize', 'posterize', 'edge', 'vignette', 'sepia', 'invert', 'desaturate', 'equalize']],
]

export function FilterGalleryModal({ open, onClose, editor, applyTo, onPick, onApply }) {
  const [sel, setSel] = useState('gaussian')
  const [thumbs, setThumbs] = useState({})
  const [prevUrl, setPrevUrl] = useState(null)

  // vignette du composite à une taille donnée
  const thumb = (max) => {
    const comp = editor.compositeFiltered()
    const s = Math.min(1, max / comp.width, max / comp.height)
    const cv = document.createElement('canvas')
    cv.width = Math.max(4, Math.round(comp.width * s))
    cv.height = Math.max(4, Math.round(comp.height * s))
    cv.getContext('2d').drawImage(comp, 0, 0, cv.width, cv.height)
    return cv
  }
  const filtered = (key, max) => { const t = thumb(max); applyTo(key, t); return t.toDataURL() }

  useEffect(() => {
    if (!open) return
    setSel('gaussian')
    const map = {}
    for (const [, keys] of GALLERY_GROUPS) {
      const base = thumb(120)
      for (const k of keys) {
        const t = document.createElement('canvas')
        t.width = base.width; t.height = base.height
        t.getContext('2d').drawImage(base, 0, 0)
        applyTo(k, t)
        map[k] = t.toDataURL()
      }
    }
    setThumbs(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => { if (open) setPrevUrl(filtered(sel, 420)) }, [sel, open])

  const def = FILTER_DEFS[sel]
  const hasParams = (def?.params || []).length > 0

  return (
    <Modal open={open} onClose={onClose} title="Galerie de filtres"
      subtitle="Aperçu de chaque effet avec ses réglages par défaut — façon Photoshop" width="920px"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
            onClick={() => (hasParams ? onPick(sel) : onApply(sel))}>
            {hasParams ? 'Régler ce filtre…' : 'Appliquer'}
          </Button>
        </>
      }>
      <HStack align="stretch" gap="3">
        <Box w="470px" flexShrink={0} maxH="420px" overflowY="auto" pr="1">
          {GALLERY_GROUPS.map(([group, keys]) => (
            <Box key={group} mb="3">
              <Text fontSize="2xs" fontWeight="700" color="gray.500" textTransform="uppercase"
                letterSpacing="wide" mb="1.5">{group}</Text>
              <SimpleGrid columns={4} gap="2">
                {keys.map((k) => (
                  <Box key={k} cursor="pointer" onClick={() => setSel(k)}
                    border="2px solid" borderColor={sel === k ? '#4f8fe8' : 'transparent'}
                    borderRadius="md" overflow="hidden" _hover={{ borderColor: sel === k ? '#4f8fe8' : 'gray.300' }}>
                    <Box bg="blackAlpha.50" display="flex" alignItems="center" justifyContent="center" h="86px">
                      {thumbs[k]
                        ? <img src={thumbs[k]} alt={FILTER_DEFS[k]?.label} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        : <Box w="100%" h="86px" />}
                    </Box>
                    <Text fontSize="2xs" color={sel === k ? '#4f8fe8' : 'gray.600'} px="1" py="0.5" isTruncated
                      fontWeight={sel === k ? '600' : '400'}>
                      {FILTER_DEFS[k]?.label || k}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Box>
          ))}
        </Box>
        <VStack flex="1" align="stretch" minW="0">
          <Text fontSize="xs" fontWeight="600" color={C.ink}>{def?.label || '—'}</Text>
          <Box flex="1" bg="blackAlpha.50" borderRadius="md" minH="300px"
            display="flex" alignItems="center" justifyContent="center" overflow="hidden">
            {prevUrl && <img src={prevUrl} alt="" style={{ maxWidth: '100%', maxHeight: '400px' }} />}
          </Box>
        </VStack>
      </HStack>
    </Modal>
  )
}
