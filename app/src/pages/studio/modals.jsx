// Modals du Studio : ouverture d'une photo du workspace, export, sauvegarde.
import { useEffect, useState } from 'react'
import { Box, Button, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { FiDownload, FiFolder, FiSave } from 'react-icons/fi'
import { Card, Modal, SearchInput, Select, Tag, isTestName } from '../../components/ui'
import { C } from '../../theme'
import PhotoImg from '../../components/PhotoImg'
import { listDossiers, listPhotos } from '../../api'

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
