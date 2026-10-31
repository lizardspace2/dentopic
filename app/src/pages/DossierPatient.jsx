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
  FiImage, FiLayers, FiClock, FiArrowLeft, FiEdit2, FiGrid,
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
  listActiveSessions, photoStatsByDossier, createDossier, createPatient,
  getPatient, importPhotos, saveEditedPhoto, createMontage,
  updateDossier, trashDossier, listPhotosByDossier, listMontagesByDossier,
} from '../api'
import { photoUrl } from '../media'
import { buildContactSheet, fetchImg } from './studio/engine'

// Spécialités dentaires (comme le modal « Nouveau patient » de la concurrence)
export const SPECIALTIES = [
  { label: 'Orthodontie', color: '#4f8fe8' },
  { label: 'Implantologie', color: '#ed8936' },
  { label: 'Esthétique', color: '#ed64a6' },
  { label: 'Endodontie', color: '#9f7aea' },
  { label: 'Parodontie', color: '#48bb78' },
  { label: 'Prothèse', color: '#a0aec0' },
  { label: 'Dentisterie conservatrice', color: '#38b2ac' },
  { label: 'Chirurgie orale', color: '#e53e3e' },
]

const specColor = (s) => SPECIALTIES.find((x) => x.label === s)?.color || '#718096'

function SpecChip({ label, active, onClick, size = '2xs' }) {
  return (
    <HStack
      as="button" px="2.5" py="1" gap="1.5" borderRadius="full" fontSize={size} cursor="pointer"
      bg={active ? 'white' : 'transparent'} color={active ? C.ink : 'gray.500'}
      border="1.5px solid" borderColor={active ? specColor(label) : 'gray.200'}
      _hover={{ borderColor: specColor(label) }} onClick={onClick}
    >
      <Box w="7px" h="7px" borderRadius="full" bg={specColor(label)} flexShrink="0" />
      <Text fontWeight={active ? '600' : '400'}>{label}</Text>
    </HStack>
  )
}

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
  const [specFilter, setSpecFilter] = useState(null)
  const [modal, setModal] = useState(null) // 'new' | 'rename'
  const [name, setName] = useState('')
  // formulaire « Nouveau patient »
  const EMPTY_FORM = { last: '', first: '', birth: '', num: '', specs: [] }
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
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

  // « Nouveau patient » : dossier (nom + n° + spécialités) + fiche patient liée
  const createPatientDossier = async () => {
    const last = form.last.trim().toUpperCase(), first = form.first.trim()
    const label = [last, first].filter(Boolean).join(' ').trim()
    if (!label) return
    setBusy(true)
    const ds = await createDossier(wsId, label, {
      patient_dossier_number: form.num.trim() || null,
      specialties: form.specs,
      description: form.birth ? `Né(e) le ${form.birth}` : null,
    })
    if (ds?.id && (last || first || form.birth)) {
      await createPatient(wsId, ds.id, {
        last_name: last || null, first_name: first || null,
        birth_date: form.birth || null,
      })
    }
    setBusy(false)
    setForm(EMPTY_FORM); setModal(null)
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
    (!q || ds.name.toLowerCase().includes(q.toLowerCase())
      || (ds.patient_dossier_number || '').includes(q))
    && (!specFilter || (ds.specialties || []).includes(specFilter)))

  return (
    <Box w="100%" px="6" py="6">
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onImportFiles} />
      <PageHeader title="Dossier patient" subtitle="Gérez les dossiers sans informations personnelles.">
        <HelpButton />
        <Button variant="outline" size="sm" borderRadius="md" color="gray.600">
          <FiTrash2 /> Corbeille <Tag color="gray">{d?.trash ?? 0}</Tag>
        </Button>
        <PrimaryButton icon={FiPlus} onClick={() => { setForm(EMPTY_FORM); setModal({ kind: 'new' }) }}>
          Nouveau patient
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
      </HStack>
      {/* filtre par spécialité (chips façon « Cas cliniques ») */}
      <HStack gap="1.5" mb="4" flexWrap="wrap">
        <Box as="button" px="2.5" py="1" fontSize="2xs" borderRadius="full" cursor="pointer"
          bg={!specFilter ? C.ink : 'transparent'} color={!specFilter ? '#ffffff' : 'gray.500'}
          border="1.5px solid" borderColor={!specFilter ? C.ink : 'gray.200'}
          onClick={() => setSpecFilter(null)}>
          Toutes spécialités
        </Box>
        {SPECIALTIES.map((s) => {
          const n = (d?.dossiers || []).filter((x) => (x.specialties || []).includes(s.label)).length
          return (
            <SpecChip key={s.label} label={s.label} active={specFilter === s.label}
              onClick={() => setSpecFilter(specFilter === s.label ? null : s.label)} />
          )
        })}
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
                  {ds.patient_dossier_number && (
                    <Text fontSize="2xs" color="gray.400" flexShrink="0">n°{ds.patient_dossier_number}</Text>
                  )}
                  {d?.listening.has(ds.id) && <Tag color="teal">Écoute</Tag>}
                  {isTestName(ds.name) && <Tag color="purple">Test</Tag>}
                </HStack>
                <Box as={FiFolder} color="gray.400" fontSize="sm" />
              </HStack>
              <Link to={`/dossier-patient/dossier/${ds.id}`}>
                <PhotoImg storagePath={p?.coverPath} ratio="16/9" mb="3" />
              </Link>
              {(ds.specialties || []).length > 0 && (
                <HStack gap="1.5" mb="2" flexWrap="wrap">
                  {ds.specialties.slice(0, 3).map((s) => (
                    <HStack key={s} gap="1" fontSize="2xs" color="gray.500">
                      <Box w="6px" h="6px" borderRadius="full" bg={specColor(s)} />
                      <Text>{s}</Text>
                    </HStack>
                  ))}
                </HStack>
              )}
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

      {/* renommage — modal simple */}
      <Modal open={modal?.kind === 'rename'} onClose={() => setModal(null)} width="400px"
        title="Renommer le dossier"
        footer={<PrimaryButton onClick={rename} disabled={!name.trim()}>Renommer</PrimaryButton>}>
        <Input fontSize="sm" placeholder="Nom du dossier" autoFocus
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') rename() }} />
      </Modal>

      {/* « Nouveau patient » — fidèle au modal de la concurrence :
          nom / prénom / naissance / n° + chips spécialité + création dossier+patient */}
      <Modal open={modal?.kind === 'new'} onClose={() => setModal(null)} width="560px"
        title="Nouveau patient"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Annuler</Button>
            <Button size="sm" bg={C.amber || '#d97706'} color="#ffffff" borderRadius="md"
              disabled={!(form.last.trim() || form.first.trim()) || busy}
              onClick={createPatientDossier}>
              {busy ? 'Création…' : 'Créer'}
            </Button>
          </>
        }>
        <VStack align="stretch" gap="4">
          <SimpleGrid columns={3} gap="3">
            <Box>
              <Text fontSize="xs" color="gray.500" mb="1">Nom</Text>
              <Input fontSize="sm" placeholder="DOE" textTransform="uppercase" autoFocus
                value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" mb="1">Prénom</Text>
              <Input fontSize="sm" placeholder="John"
                value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" mb="1">Naissance</Text>
              <Input fontSize="sm" type="date"
                value={form.birth} onChange={(e) => setForm({ ...form, birth: e.target.value })} />
            </Box>
          </SimpleGrid>
          <Box>
            <Text fontSize="xs" color="gray.500" mb="1">N° de dossier (optionnel)</Text>
            <Input fontSize="sm" placeholder="877" w="160px"
              value={form.num} onChange={(e) => setForm({ ...form, num: e.target.value })} />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb="2">Spécialité de la séance</Text>
            <HStack gap="1.5" flexWrap="wrap">
              {SPECIALTIES.map((s) => (
                <SpecChip key={s.label} label={s.label} size="xs"
                  active={form.specs.includes(s.label)}
                  onClick={() => setForm((f) => ({
                    ...f,
                    specs: f.specs.includes(s.label)
                      ? f.specs.filter((x) => x !== s.label)
                      : [...f.specs, s.label],
                  }))} />
              ))}
            </HStack>
          </Box>
          <HStack gap="2" fontSize="xs" color="gray.500">
            <Box w="14px" h="14px" borderRadius="sm" bg={C.amber || '#d97706'} color="#ffffff"
              fontSize="2xs" textAlign="center" lineHeight="14px">✓</Box>
            <Text>Crée le dossier <b>{[form.last.trim().toUpperCase(), form.first.trim()].filter(Boolean).join(' ') || '…'}</b>
              {' '}et la fiche patient associée.</Text>
          </HStack>
        </VStack>
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
  const [patient, setPatient] = useState(null)
  const [photos, setPhotos] = useState([])
  const [montages, setMontages] = useState([])
  const [subs, setSubs] = useState([])
  const [missing, setMissing] = useState(false)
  const [sheet, setSheet] = useState(false) // modal planche contact
  const fileInput = useRef(null)

  const reload = async () => {
    if (!wsId) return
    const [all, ph, mo, pat] = await Promise.all([
      listDossiers(wsId), listPhotosByDossier(id), listMontagesByDossier(id), getPatient(id),
    ])
    const ds = all.find((x) => x.id === id)
    setDossier(ds || null)
    setMissing(!ds)
    setPatient(pat)
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
        {(dossier?.specialties || []).map((s) => (
          <HStack key={s} gap="1" px="2" py="0.5" borderRadius="full" fontSize="2xs"
            border="1.5px solid" borderColor={specColor(s)} color="gray.600">
            <Box w="6px" h="6px" borderRadius="full" bg={specColor(s)} />
            <Text>{s}</Text>
          </HStack>
        ))}
        <Box flex="1" />
        <Link to={`/acquisition/capture/${id}`}>
          <PrimaryButton icon={FiCamera}>Capturer</PrimaryButton>
        </Link>
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
          <FiUpload /> Importer
        </Button>
        <Button size="sm" variant="outline" disabled={!photos.length}
          onClick={() => setSheet(true)}>
          <FiGrid /> Planche contact
        </Button>
        <Button size="sm" variant="outline" onClick={rename}><FiEdit2 /> Renommer</Button>
        <Button size="sm" variant="outline" color="red.500" onClick={trash}><FiTrash2 /></Button>
      </HStack>

      {(patient || dossier?.patient_dossier_number) && (
        <Card p="3" mb="4">
          <HStack gap="4" fontSize="xs" color="gray.600" flexWrap="wrap">
            {dossier?.patient_dossier_number && (
              <Text><b>Dossier n°</b> {dossier.patient_dossier_number}</Text>
            )}
            {patient && (
              <>
                <Text><b>Patient</b> {[patient.last_name, patient.first_name].filter(Boolean).join(' ') || '—'}</Text>
                {patient.birth_date && <Text><b>Naissance</b> {patient.birth_date}</Text>}
                {patient.sex && <Text><b>Sexe</b> {patient.sex}</Text>}
                {patient.phone && <Text><b>Tél.</b> {patient.phone}</Text>}
                {patient.email && <Text><b>Email</b> {patient.email}</Text>}
              </>
            )}
            {dossier?.description && <Text color="gray.400">{dossier.description}</Text>}
          </HStack>
        </Card>
      )}

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

      <PlancheModal open={sheet} onClose={() => setSheet(false)}
        wsId={wsId} dossier={dossier} photos={photos} onDone={reload} />
    </Box>
  )
}

// ---- Planche contact : grille de photos -> une seule image, sauvée comme montage ----

// ratio autorisé par la contrainte `montages_ratio_check` le plus proche de w/h
const MONTAGE_RATIOS = ['1:1', '2:3', '3:2', '4:5', '5:4', '16:9', '9:16']
function closestMontageRatio(w, h) {
  const r = w / h
  return MONTAGE_RATIOS
    .map((s) => { const [a, b] = s.split(':').map(Number); return { s, d: Math.abs(a / b - r) } })
    .sort((x, y) => x.d - y.d)[0].s
}

function PlancheModal({ open, onClose, wsId, dossier, photos, onDone }) {
  const [sel, setSel] = useState(null) // Set d'ids — null = toutes
  const [cols, setCols] = useState(4)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null) // canvas généré
  const picked = photos.filter((p) => !sel || sel.has(p.id))

  const toggle = (id) => {
    const s = new Set(sel || photos.map((p) => p.id))
    s.has(id) ? s.delete(id) : s.add(id)
    setSel(s)
  }

  const generate = async () => {
    if (!picked.length) return
    setBusy(true)
    try {
      const imgs = await Promise.all(picked.map(async (p) => {
        const url = await photoUrl(p.storage_path)
        return url ? fetchImg(url) : null
      }))
      setPreview(buildContactSheet(imgs.filter(Boolean), { cols, cellW: 800 }))
    } finally { setBusy(false) }
  }

  const save = async () => {
    if (!preview) return
    setBusy(true)
    const blob = await new Promise((r) => preview.toBlob(r, 'image/jpeg', 0.92))
    const name = `planche-${(dossier?.name || 'dossier').replace(/\W+/g, '-').toLowerCase()}.jpg`
    const photo = await saveEditedPhoto(wsId, blob, name, dossier?.id || null)
    if (photo) {
      await createMontage(wsId, {
        name: `Planche contact — ${dossier?.name || ''}`.trim(),
        dossier_id: dossier?.id || null,
        image_count: picked.length,
        ratio: closestMontageRatio(preview.width, preview.height),
        status: 'finalized',
        export_url: photo.storage_path,
      })
    }
    setBusy(false); setPreview(null); setSel(null)
    onClose(); onDone()
  }

  return (
    <Modal open={open} onClose={onClose} width="640px" title="Planche contact"
      subtitle="Assemble les photos du dossier en une seule image — sauvée comme montage"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          {!preview
            ? <PrimaryButton onClick={generate} disabled={!picked.length || busy}>
                {busy ? 'Génération…' : `Générer (${picked.length} photo${picked.length > 1 ? 's' : ''})`}
              </PrimaryButton>
            : <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la planche'}</PrimaryButton>}
        </>
      }>
      {!preview ? (
        <VStack align="stretch" gap="3">
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.500">Sélection — cliquer pour inclure/exclure</Text>
            <HStack gap="2" fontSize="xs" color="gray.500">
              <Text>Colonnes</Text>
              {[3, 4, 5, 6].map((n) => (
                <Box as="button" key={n} px="2" py="0.5" borderRadius="sm" cursor="pointer"
                  fontSize="2xs" fontWeight={cols === n ? '700' : '400'}
                  bg={cols === n ? C.primary : 'gray.100'} color={cols === n ? '#ffffff' : C.ink}
                  onClick={() => setCols(n)}>{n}</Box>
              ))}
            </HStack>
          </HStack>
          <SimpleGrid columns={{ base: 3, md: 5 }} gap="2" maxH="320px" overflowY="auto">
            {photos.map((p) => {
              const on = !sel || sel.has(p.id)
              return (
                <Box key={p.id} position="relative" cursor="pointer"
                  opacity={on ? 1 : 0.3} onClick={() => toggle(p.id)}
                  border="2px solid" borderColor={on ? C.primary : 'transparent'} borderRadius="md">
                  <PhotoImg storagePath={p.storage_path} ratio="1/1" />
                  {on && (
                    <Center position="absolute" top="1" right="1" w="16px" h="16px"
                      borderRadius="full" bg={C.primary} color="#ffffff" fontSize="2xs">✓</Center>
                  )}
                </Box>
              )
            })}
          </SimpleGrid>
        </VStack>
      ) : (
        <VStack align="stretch" gap="2">
          <img src={preview.toDataURL('image/jpeg', 0.8)} alt="Planche contact"
            style={{ width: '100%', borderRadius: 8 }} />
          <HStack justify="space-between" fontSize="2xs" color="gray.500">
            <Text>{picked.length} photos · {preview.width} × {preview.height}px</Text>
            <Text color={C.primary} cursor="pointer" onClick={() => setPreview(null)}>← Modifier la sélection</Text>
          </HStack>
        </VStack>
      )}
    </Modal>
  )
}
