// Route /dossier-patient — grille des dossiers + vue détail (/dossier-patient/dossier/:id).
// Cartes entièrement fonctionnelles : capturer, importer, ouvrir, menu
// (renommer / corbeille). La vue détail liste les photos, montages et sous-dossiers.
import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Center, HStack, Input, SimpleGrid, Text, VStack,
} from '@chakra-ui/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  FiTrash2, FiPlus, FiFolder, FiCamera, FiUpload, FiEye, FiMoreHorizontal,
  FiImage, FiLayers, FiClock, FiArrowLeft, FiEdit2,
} from 'react-icons/fi'
import {
  Card, Tag, ProgressBar, PageHeader, HelpButton, PrimaryButton,
  SearchInput, Select, Modal, ago, isTestName, Tip,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  listDossiers, countTrashDossiers, listPhotos, montageCountByDossier,
  listActiveSessions, photoStatsByDossier, createDossier, importPhotos,
  updateDossier, trashDossier, listPhotosByDossier, listMontagesByDossier,
} from '../api'

export default function DossierPatient() {
  const { id } = useParams()
  return id ? <DossierDetail id={id} /> : <DossierGrid />
}

// ============================================================================
// Grille des dossiers
// ============================================================================

function DossierGrid() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null) // 'new' | 'rename'
  const [name, setName] = useState('')
  const [menuFor, setMenuFor] = useState(null)
  const importTarget = useRef(null) // dossier id de l'import
  const fileInput = useRef(null)

  const reload = async () => {
    if (!wsId) return
    const [dossiers, trash, photos, montageCounts, sessions, byDossier] =
      await Promise.all([
        listDossiers(wsId),
        countTrashDossiers(wsId),
        listPhotos(wsId),
        montageCountByDossier(wsId),
        listActiveSessions(wsId),
        photoStatsByDossier(wsId),
      ])
    const subCounts = {}
    dossiers.forEach((ds) => {
      if (ds.parent_id) subCounts[ds.parent_id] = (subCounts[ds.parent_id] || 0) + 1
    })
    setD({
      dossiers, trash, photoCount: photos.length, byDossier, subCounts,
      montageCounts,
      listening: new Set(sessions.map((s) => s.dossier_id).filter(Boolean)),
    })
  }
  useEffect(() => { reload() }, [wsId])

  const create = async (n) => {
    if (!n?.trim()) return
    const ds = await createDossier(wsId, n.trim())
    setName(''); setModal(null)
    await reload()
    if (ds?.id) nav(`/dossier-patient/dossier/${ds.id}`)
  }

  const rename = async () => {
    if (!name.trim() || !modal?.id) return
    await updateDossier(modal.id, { name: name.trim() })
    setName(''); setModal(null); reload()
  }

  const trash = async (ds) => {
    setMenuFor(null)
    await trashDossier(ds.id)
    reload()
  }

  const onImportFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length && importTarget.current) {
      await importPhotos(wsId, files, importTarget.current)
      reload()
    }
  }

  const list = (d?.dossiers || []).filter((ds) =>
    !q || ds.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Box w="100%" px="6" py="6">
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onImportFiles} />
      <PageHeader title="Dossier patient" subtitle="Gérez les dossiers sans informations personnelles.">
        <HelpButton />
        <Button variant="outline" size="sm" borderRadius="md" color="gray.600">
          <FiTrash2 /> Corbeille <Tag color="gray">{d?.trash ?? 0}</Tag>
        </Button>
        <PrimaryButton icon={FiPlus} onClick={() => { setName(''); setModal({ kind: 'new' }) }}>
          Nouveau dossier
        </PrimaryButton>
      </PageHeader>

      <HStack gap="2" mb="4">
        <Tag color="gray"><FiFolder style={{ marginRight: 4 }} />{d?.dossiers.length ?? 0} dossiers</Tag>
        <Tag color="gray"><FiImage style={{ marginRight: 4 }} />{d?.photoCount ?? 0} photos</Tag>
        {d?.listening.size > 0 && <Tag color="teal">{d.listening.size} en écoute</Tag>}
      </HStack>

      <HStack gap="3" mb="3">
        <SearchInput placeholder="Rechercher par n° de dossier, nom ou patient…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <Select><option>Récents</option></Select>
        <Select><option>Toutes spécialités</option></Select>
      </HStack>

      <Box border="1.5px dashed" borderColor="gray.300" borderRadius="md" px="3" py="1" mb="5">
        <Input
          variant="flushed" border="none" fontSize="xs" h="8" px="1" _focusVisible={{ boxShadow: 'none' }}
          placeholder="Création express : nom du dossier + Entrée"
          onKeyDown={(e) => { if (e.key === 'Enter') { create(e.target.value); e.target.value = '' } }}
        />
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="5">
        {list.map((ds) => {
          const p = d?.byDossier[ds.id]
          const photos = p?.photos || 0
          const montages = d?.montageCounts[ds.id] || 0
          const subs = d?.subCounts[ds.id] || 0
          const progress = Math.min(100, photos * 20)
          return (
            <Card key={ds.id} p="4">
              <HStack mb="3" justify="space-between">
                <HStack gap="2" minW="0">
                  <Text fontSize="sm" fontWeight="700" color={C.ink} isTruncated>{ds.name}</Text>
                  {d?.listening.has(ds.id) && <Tag color="teal">Écoute</Tag>}
                  {isTestName(ds.name) && <Tag color="purple">Test</Tag>}
                </HStack>
                <Box as={FiFolder} color="gray.400" fontSize="sm" />
              </HStack>
              <Link to={`/dossier-patient/dossier/${ds.id}`}>
                <PhotoImg storagePath={p?.coverPath} ratio="16/9" mb="3" />
              </Link>
              <HStack gap="3" mb="2" color="gray.500">
                <Text fontSize="2xs"><FiImage style={{ display: 'inline' }} /> {photos} photos</Text>
                <Text fontSize="2xs"><FiLayers style={{ display: 'inline' }} /> {montages} montages</Text>
                <Text fontSize="2xs"><FiFolder style={{ display: 'inline' }} /> {subs} sous-dossiers</Text>
                <Text fontSize="2xs"><FiClock style={{ display: 'inline' }} /> {ago(ds.updated_at)}</Text>
              </HStack>
              <ProgressBar value={progress} label={`${progress} % du cas`} mb="3" />
              <HStack gap="2">
                <Link to={`/acquisition/capture/${ds.id}`} style={{ flex: 1 }}>
                  <Tip label="Démarrer une session de capture dans ce dossier">
                    <PrimaryButton icon={FiCamera} w="100%">Capturer</PrimaryButton>
                  </Tip>
                </Link>
                <Tip label="Importer des photos dans ce dossier">
                  <Button variant="outline" size="sm" px="2"
                    onClick={() => { importTarget.current = ds.id; fileInput.current?.click() }}>
                    <FiUpload />
                  </Button>
                </Tip>
                <Tip label="Ouvrir le dossier">
                  <Link to={`/dossier-patient/dossier/${ds.id}`}>
                    <Button variant="outline" size="sm" px="2"><FiEye /></Button>
                  </Link>
                </Tip>
                <Box position="relative">
                  <Tip label="Actions">
                    <Button variant="outline" size="sm" px="2"
                      onClick={() => setMenuFor(menuFor === ds.id ? null : ds.id)}>
                      <FiMoreHorizontal />
                    </Button>
                  </Tip>
                  {menuFor === ds.id && (
                    <VStack
                      position="absolute" bottom="100%" right="0" mb="1" align="stretch" gap="0"
                      bg="white" border="1px solid" borderColor={C.cardBorder} borderRadius="md"
                      minW="180px" py="1" boxShadow="lg" zIndex="20"
                    >
                      <MenuItem icon={FiEye} label="Ouvrir"
                        onClick={() => { setMenuFor(null); nav(`/dossier-patient/dossier/${ds.id}`) }} />
                      <MenuItem icon={FiEdit2} label="Renommer…"
                        onClick={() => { setMenuFor(null); setName(ds.name); setModal({ kind: 'rename', id: ds.id }) }} />
                      <MenuItem icon={FiTrash2} label="Mettre à la corbeille" danger
                        onClick={() => trash(ds)} />
                    </VStack>
                  )}
                </Box>
              </HStack>
            </Card>
          )
        })}
      </SimpleGrid>
      {list.length === 0 && d && (
        <Text fontSize="sm" color="gray.500" textAlign="center" py="10">
          Aucun dossier{q ? ` ne correspond à « ${q} »` : ''}.
        </Text>
      )}

      {/* création / renommage — une seule modal, deux usages */}
      <Modal open={!!modal} onClose={() => setModal(null)} width="400px"
        title={modal?.kind === 'rename' ? 'Renommer le dossier' : 'Nouveau dossier'}
        footer={
          <PrimaryButton onClick={modal?.kind === 'rename' ? rename : () => create(name)}
            disabled={!name.trim()}>
            {modal?.kind === 'rename' ? 'Renommer' : 'Créer le dossier'}
          </PrimaryButton>
        }>
        <Input fontSize="sm" placeholder="Nom du dossier (ex. PAT-2026-0142)" autoFocus
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (modal?.kind === 'rename' ? rename() : create(name)) }} />
      </Modal>
    </Box>
  )
}

function MenuItem({ icon: I, label, danger, onClick }) {
  return (
    <HStack px="3" py="2" gap="2" fontSize="xs" cursor="pointer"
      color={danger ? 'red.500' : C.ink} _hover={{ bg: C.softBlue }}
      onClick={onClick}>
      <Box as={I} /> <Text>{label}</Text>
    </HStack>
  )
}

// ============================================================================
// Vue détail d'un dossier — photos, montages, sous-dossiers
// ============================================================================

function DossierDetail({ id }) {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const nav = useNavigate()
  const [dossier, setDossier] = useState(null)
  const [photos, setPhotos] = useState([])
  const [montages, setMontages] = useState([])
  const [subs, setSubs] = useState([])
  const [missing, setMissing] = useState(false)
  const fileInput = useRef(null)

  const reload = async () => {
    if (!wsId) return
    const [all, ph, mo] = await Promise.all([
      listDossiers(wsId), listPhotosByDossier(id), listMontagesByDossier(id),
    ])
    const ds = all.find((x) => x.id === id)
    setDossier(ds || null)
    setMissing(!ds)
    setPhotos(ph)
    setMontages(mo)
    setSubs(all.filter((x) => x.parent_id === id))
  }
  useEffect(() => { reload() }, [wsId, id])

  const onImportFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length) { await importPhotos(wsId, files, id); reload() }
  }

  const rename = async () => {
    const n = window.prompt('Nouveau nom du dossier :', dossier?.name)
    if (n?.trim()) { await updateDossier(id, { name: n.trim() }); reload() }
  }

  const trash = async () => {
    await trashDossier(id)
    nav('/dossier-patient')
  }

  if (missing) {
    return (
      <Center py="20" flexDirection="column" gap="3">
        <Text fontSize="sm" color="gray.500">Dossier introuvable — supprimé ou déplacé.</Text>
        <Link to="/dossier-patient"><Button size="sm" variant="outline"><FiArrowLeft /> Retour aux dossiers</Button></Link>
      </Center>
    )
  }

  return (
    <Box w="100%" px="6" py="6">
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onImportFiles} />

      <HStack mb="4" gap="3" flexWrap="wrap">
        <Link to="/dossier-patient">
          <Button size="sm" variant="ghost" color="gray.500"><FiArrowLeft /> Dossiers</Button>
        </Link>
        <Text fontSize="lg" fontWeight="700" color={C.ink}>{dossier?.name || '…'}</Text>
        {isTestName(dossier?.name) && <Tag color="purple">Test</Tag>}
        <Box flex="1" />
        <Link to={`/acquisition/capture/${id}`}>
          <PrimaryButton icon={FiCamera}>Capturer</PrimaryButton>
        </Link>
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
          <FiUpload /> Importer
        </Button>
        <Button size="sm" variant="outline" onClick={rename}><FiEdit2 /> Renommer</Button>
        <Button size="sm" variant="outline" color="red.500" onClick={trash}><FiTrash2 /></Button>
      </HStack>

      <HStack gap="2" mb="5" flexWrap="wrap">
        <Tag color="gray"><FiImage style={{ marginRight: 4 }} />{photos.length} photos</Tag>
        <Tag color="gray"><FiLayers style={{ marginRight: 4 }} />{montages.length} montages</Tag>
        <Tag color="gray"><FiFolder style={{ marginRight: 4 }} />{subs.length} sous-dossiers</Tag>
        {dossier && <Tag color="gray"><FiClock style={{ marginRight: 4 }} />{ago(dossier.updated_at)}</Tag>}
      </HStack>

      {subs.length > 0 && (
        <>
          <Text fontSize="xs" fontWeight="600" color="gray.500" mb="2">SOUS-DOSSIERS</Text>
          <HStack gap="2" mb="5" flexWrap="wrap">
            {subs.map((s) => (
              <Link key={s.id} to={`/dossier-patient/dossier/${s.id}`}>
                <HStack px="3" py="1.5" borderRadius="md" border="1px solid" borderColor={C.cardBorder}
                  bg="white" _hover={{ borderColor: C.primary }} gap="2">
                  <Box as={FiFolder} color={C.primary} />
                  <Text fontSize="xs" fontWeight="600" color={C.ink}>{s.name}</Text>
                </HStack>
              </Link>
            ))}
          </HStack>
        </>
      )}

      <Text fontSize="xs" fontWeight="600" color="gray.500" mb="2">PHOTOS — cliquer ouvre dans le Studio</Text>
      {photos.length === 0 ? (
        <Box border="1.5px dashed" borderColor="gray.300" borderRadius="lg" py="10" textAlign="center" mb="6">
          <VStack gap="2">
            <Box as={FiImage} fontSize="xl" color="gray.400" />
            <Text fontSize="sm" color="gray.500">Aucune photo — capturez ou importez pour commencer.</Text>
            <HStack gap="2">
              <Link to={`/acquisition/capture/${id}`}><Button size="sm" bg={C.primary} color="#ffffff"><FiCamera /> Capturer</Button></Link>
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}><FiUpload /> Importer</Button>
            </HStack>
          </VStack>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 2, md: 5, xl: 6 }} gap="4" mb="6">
          {photos.map((p) => (
            <Link key={p.id} to={`/studio?edit=${p.id}`}>
              <Box cursor="pointer" _hover={{ opacity: 0.85 }}>
                <PhotoImg storagePath={p.storage_path} ratio="1/1" />
                <Text fontSize="2xs" color="gray.500" mt="1" isTruncated>
                  {p.original_filename || 'photo'}
                </Text>
                <Text fontSize="2xs" color="gray.400">{ago(p.created_at)}</Text>
              </Box>
            </Link>
          ))}
        </SimpleGrid>
      )}

      <Text fontSize="xs" fontWeight="600" color="gray.500" mb="2">MONTAGES</Text>
      {montages.length === 0 ? (
        <Text fontSize="sm" color="gray.500" mb="2">Aucun montage — créez-en un dans le Studio.</Text>
      ) : (
        <SimpleGrid columns={{ base: 2, md: 5, xl: 6 }} gap="4">
          {montages.map((m) => (
            <Link key={m.id} to="/studio">
              <Card p="2" cursor="pointer" _hover={{ borderColor: C.primary }}>
                {m.export_url
                  ? <PhotoImg storagePath={m.export_url} ratio="4/3" />
                  : (
                    <Center bg="gray.100" borderRadius="md" h="90px">
                      <Box as={FiLayers} color="gray.400" fontSize="xl" />
                    </Center>
                  )}
                <Text fontSize="2xs" fontWeight="600" color={C.ink} mt="1.5" isTruncated>{m.name}</Text>
                <Text fontSize="2xs" color="gray.400">{ago(m.updated_at)} · {m.status}</Text>
              </Card>
            </Link>
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}
