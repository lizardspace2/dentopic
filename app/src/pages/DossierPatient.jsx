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
  FiImage, FiLayers, FiClock, FiArrowLeft, FiEdit2, FiGrid, FiFolderPlus,
  FiUser, FiFolderMinus,
} from 'react-icons/fi'
import {
  Card, Tag, ProgressBar, PageHeader, HelpButton, PrimaryButton,
  SearchInput, Select, Modal, ago, isTestName, Tip, ConfirmModal, PromptModal,
  MenuDropdown, MenuItem, toast, EmptyPane,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  listDossiers, countTrashDossiers, listPhotos, montageCountByDossier,
  listActiveSessions, photoStatsByDossier, createDossier, createPatient,
  getPatient, importPhotos, saveEditedPhoto, createMontage,
  updateDossier, trashDossier, listPhotosByDossier, listMontagesByDossier,
  updatePatient, listTrashDossiers, restoreDossier, movePhotosToDossier,
} from '../api'
import {
  DossierTree, FolderTile, FolderBreadcrumb, startPhotoDrag, dossierChildren,
} from '../components/Explorer'
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

export const specColor = (s) => SPECIALTIES.find((x) => x.label === s)?.color || '#718096'

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
  const [sort, setSort] = useState('recent') // 'recent' | 'name' | 'photos'
  const [modal, setModal] = useState(null) // 'new' | 'rename' | 'edit' | 'sub'
  const [name, setName] = useState('')
  const [editForm, setEditForm] = useState(null) // fiche patient en édition
  // formulaire « Nouveau patient »
  const EMPTY_FORM = { last: '', first: '', birth: '', num: '', specs: [] }
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  const [trashList, setTrashList] = useState([]) // dossiers à la corbeille
  const [hover, setHover] = useState(null) // dossier id survolé
  const [patients, setPatients] = useState({}) // cache fiche patient par dossier
  const importTarget = useRef(null) // dossier id de l'import
  const fileInput = useRef(null)

  // fiche patient chargée à la demande au premier survol de la carte
  const onCardHover = (ds) => {
    setHover(ds.id)
    if (!(ds.id in patients)) {
      getPatient(ds.id).then((pat) => setPatients((m) => ({ ...m, [ds.id]: pat })))
    }
  }

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

  const openTrash = async () => {
    setTrashList(await listTrashDossiers(wsId))
    setModal({ kind: 'bin' })
  }

  const restore = async (ds) => {
    await restoreDossier(ds.id)
    setTrashList((l) => l.filter((x) => x.id !== ds.id))
    toast.success(`« ${ds.name} » restauré.`); reload()
  }

  const create = async (n) => {
    if (!n?.trim()) return
    const ds = await createDossier(wsId, n.trim())
    setName(''); setModal(null)
    toast.success(`Dossier « ${n.trim()} » créé.`)
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
    toast.success(`Dossier « ${label} » créé.`)
    await reload()
    if (ds?.id) nav(`/dossier-patient/dossier/${ds.id}`)
  }

  const rename = async () => {
    if (!name.trim() || !modal?.id) return
    await updateDossier(modal.id, { name: name.trim() })
    setName(''); setModal(null); toast.success('Dossier renommé.'); reload()
  }

  const trash = async () => {
    if (!modal?.ds) return
    setBusy(true)
    await trashDossier(modal.ds.id)
    setBusy(false); setModal(null); toast.info('Dossier mis à la corbeille.'); reload()
  }

  // « Modifier la fiche » : charge la fiche patient liée puis ouvre le modal d'édition
  const openEdit = async (ds) => {
    setMenuFor(null)
    const pat = await getPatient(ds.id)
    setEditForm({
      id: ds.id, patientId: pat?.id || null,
      name: ds.name,
      num: ds.patient_dossier_number || '',
      specs: ds.specialties || [],
      desc: ds.description || '',
      last: pat?.last_name || '', first: pat?.first_name || '', birth: pat?.birth_date || '',
    })
    setModal({ kind: 'edit' })
  }

  // Sauvegarde : dossier (n°, spécialités, description) + fiche patient (update ou create)
  const saveEdit = async () => {
    const f = editForm
    if (!f) return
    setBusy(true)
    await updateDossier(f.id, {
      patient_dossier_number: f.num.trim() || null,
      specialties: f.specs,
      description: f.desc.trim() || null,
    })
    const fields = {
      last_name: f.last.trim() || null, first_name: f.first.trim() || null,
      birth_date: f.birth || null,
    }
    if (f.patientId) await updatePatient(f.patientId, fields)
    else if (fields.last_name || fields.first_name || fields.birth_date) {
      await createPatient(wsId, f.id, fields)
    }
    setBusy(false); setModal(null); setEditForm(null)
    toast.success('Fiche enregistrée.'); reload()
  }

  // Sous-dossier : même table, parent_id pointe vers le dossier courant
  const createSub = async (parentId) => {
    if (!name.trim()) return
    await createDossier(wsId, name.trim(), { parent_id: parentId })
    setName(''); setModal(null); reload()
  }

  const onImportFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length && importTarget.current) {
      await importPhotos(wsId, files, importTarget.current)
      toast.success(`${files.length} photo(s) importée(s).`); reload()
    }
  }

  const list = (d?.dossiers || [])
    .filter((ds) =>
      (!q || ds.name.toLowerCase().includes(q.toLowerCase())
        || (ds.patient_dossier_number || '').includes(q))
      && (!specFilter || (ds.specialties || []).includes(specFilter)))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr')
      if (sort === 'photos') return (d?.byDossier[b.id]?.photos || 0) - (d?.byDossier[a.id]?.photos || 0)
      return new Date(b.updated_at) - new Date(a.updated_at)
    })

  return (
    <Box w="100%" px="6" py="6">
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onImportFiles} />
      <PageHeader title="Dossier patient" subtitle="Gérez les dossiers sans informations personnelles.">
        <HelpButton />
        <Tip label="Dossiers mis à la corbeille — restauration possible">
          <Button variant="outline" size="sm" borderRadius="md" color="gray.600" onClick={openTrash}>
            <FiTrash2 /> Corbeille <Tag color="gray">{d?.trash ?? 0}</Tag>
          </Button>
        </Tip>
        <Tip label="Créer un dossier patient : identité, spécialité, n° de dossier">
          <PrimaryButton icon={FiPlus} onClick={() => { setForm(EMPTY_FORM); setModal({ kind: 'new' }) }}>
            Nouveau patient
          </PrimaryButton>
        </Tip>
      </PageHeader>

      <HStack gap="2" mb="4">
        <Tip label="Nombre de dossiers actifs">
          <Tag color="gray"><FiFolder style={{ marginRight: 4 }} />{d?.dossiers.length ?? 0} dossiers</Tag>
        </Tip>
        <Tip label="Photos stockées dans tous les dossiers">
          <Tag color="gray"><FiImage style={{ marginRight: 4 }} />{d?.photoCount ?? 0} photos</Tag>
        </Tip>
        {d?.listening.size > 0 && (
          <Tip label="Dossiers où une session de capture est en cours">
            <Tag color="teal">{d.listening.size} en écoute</Tag>
          </Tip>
        )}
      </HStack>

      <HStack gap="3" mb="3">
        <SearchInput placeholder="Rechercher par n° de dossier, nom ou patient…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <Tip label="Trier les dossiers">
          <Select w="160px" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Récents</option>
            <option value="name">Nom A→Z</option>
            <option value="photos">Nb de photos</option>
          </Select>
        </Tip>
      </HStack>
      {/* filtre par spécialité (chips façon « Cas cliniques ») */}
      <HStack gap="1.5" mb="4" flexWrap="wrap">
        <Tip label="Afficher tous les dossiers">
          <Box as="button" px="2.5" py="1" fontSize="2xs" borderRadius="full" cursor="pointer"
            bg={!specFilter ? C.ink : 'transparent'} color={!specFilter ? '#ffffff' : 'gray.500'}
            border="1.5px solid" borderColor={!specFilter ? C.ink : 'gray.200'}
            onClick={() => setSpecFilter(null)}>
            Toutes spécialités
          </Box>
        </Tip>
        {SPECIALTIES.map((s) => (
          <Tip key={s.label} label={`Filtrer : ${s.label}`}>
            <span>
              <SpecChip label={s.label} active={specFilter === s.label}
                onClick={() => setSpecFilter(specFilter === s.label ? null : s.label)} />
            </span>
          </Tip>
        ))}
      </HStack>

      <Tip label="Tapez un nom puis Entrée — le dossier est créé et ouvert" display="block" mb="5">
        <Box border="1.5px dashed" borderColor="gray.300" borderRadius="md" px="3" py="1">
          <Input
            variant="flushed" border="none" fontSize="xs" h="8" px="1" _focusVisible={{ boxShadow: 'none' }}
            placeholder="Création express : nom du dossier + Entrée"
            onKeyDown={(e) => { if (e.key === 'Enter') { create(e.target.value); e.target.value = '' } }}
          />
        </Box>
      </Tip>

      <HStack align="start" gap="4">
        <DossierTree dossiers={d?.dossiers || []} currentId={null}
          onNavigate={(id) => { if (id) nav(`/dossier-patient/dossier/${id}`) }} />
        <Box flex="1" minW="0">
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
                  <Text fontSize="sm" fontWeight="700" color={C.ink} isTruncated
                    cursor="pointer" onClick={() => nav(`/dossier-patient/dossier/${ds.id}`)}
                    _hover={{ color: C.primary }}>
                    {ds.name}
                  </Text>
                  {ds.patient_dossier_number && (
                    <Tip label="Numéro de dossier patient">
                      <Text fontSize="2xs" color="gray.400" flexShrink="0">n°{ds.patient_dossier_number}</Text>
                    </Tip>
                  )}
                  {d?.listening.has(ds.id) && (
                    <Tip label="Une session de capture est en cours dans ce dossier">
                      <Tag color="teal">Écoute</Tag>
                    </Tip>
                  )}
                  {isTestName(ds.name) && (
                    <Tip label="Dossier de démonstration / test">
                      <Tag color="purple">Test</Tag>
                    </Tip>
                  )}
                </HStack>
                <Tip label="Dossier patient — cliquez la vignette pour ouvrir">
                  <Box as={FiFolder} color="gray.400" fontSize="sm" />
                </Tip>
              </HStack>
              {/* vignette = dernière photo du dossier — clic ouvre la fiche,
                  survol = fiche récapitulative du patient + actions rapides */}
              <Box position="relative" mb="3"
                onMouseEnter={() => onCardHover(ds)} onMouseLeave={() => setHover(null)}>
                <Link to={`/dossier-patient/dossier/${ds.id}`}>
                  <PhotoImg storagePath={p?.coverPath} ratio="16/9" />
                </Link>
                {hover === ds.id && (
                  <PatientHover ds={ds} pat={patients[ds.id]}
                    onView={() => nav(`/dossier-patient/dossier/${ds.id}`)}
                    onEdit={() => openEdit(ds)} />
                )}
              </Box>
              {(ds.specialties || []).length > 0 && (
                <HStack gap="1.5" mb="2" flexWrap="wrap">
                  {ds.specialties.slice(0, 3).map((s) => (
                    <Tip key={s} label={`Spécialité : ${s}`}>
                      <HStack gap="1" fontSize="2xs" color="gray.500">
                        <Box w="6px" h="6px" borderRadius="full" bg={specColor(s)} />
                        <Text>{s}</Text>
                      </HStack>
                    </Tip>
                  ))}
                  {ds.specialties.length > 3 && (
                    <Tip label={ds.specialties.slice(3).join(', ')}>
                      <Text fontSize="2xs" color="gray.400">+{ds.specialties.length - 3}</Text>
                    </Tip>
                  )}
                </HStack>
              )}
              <HStack gap="3" mb="2" color="gray.500">
                <Tip label="Photos rangées dans ce dossier"><Text fontSize="2xs"><FiImage style={{ display: 'inline' }} /> {photos} photos</Text></Tip>
                <Tip label="Montages et planches créés depuis ce dossier"><Text fontSize="2xs"><FiLayers style={{ display: 'inline' }} /> {montages} montages</Text></Tip>
                <Tip label="Sous-dossiers de rangement"><Text fontSize="2xs"><FiFolder style={{ display: 'inline' }} /> {subs} sous-dossiers</Text></Tip>
                <Tip label="Dernière modification"><Text fontSize="2xs"><FiClock style={{ display: 'inline' }} /> {ago(ds.updated_at)}</Text></Tip>
              </HStack>
              <Tip label={`Progression estimée du cas — ${photos} photo(s) sur ~5 attendues`} display="block" mb="3">
                <ProgressBar value={progress} label={`${progress} % du cas`} />
              </Tip>
              <HStack gap="2">
                <Link to={`/acquisition/capture/${ds.id}`} style={{ flex: 1 }}>
                  <Tip label="Démarrer une session de capture dans ce dossier">
                    <PrimaryButton icon={FiCamera} w="100%">Capturer</PrimaryButton>
                  </Tip>
                </Link>
                <Tip label="Importer des fichiers (JPG, PNG…) dans ce dossier">
                  <Button variant="outline" size="sm" px="2" aria-label="Importer des photos"
                    onClick={() => { importTarget.current = ds.id; fileInput.current?.click() }}>
                    <FiUpload />
                  </Button>
                </Tip>
                <Tip label="Ouvrir le dossier — photos, montages, sous-dossiers">
                  <Link to={`/dossier-patient/dossier/${ds.id}`}>
                    <Button variant="outline" size="sm" px="2" aria-label="Ouvrir le dossier"><FiEye /></Button>
                  </Link>
                </Tip>
                <Box position="relative">
                  <Tip label="Plus d'actions : fiche, sous-dossier, corbeille">
                    <Button variant="outline" size="sm" px="2" aria-label="Plus d'actions"
                      onClick={() => setMenuFor(menuFor === ds.id ? null : ds.id)}>
                      <FiMoreHorizontal />
                    </Button>
                  </Tip>
                  <MenuDropdown open={menuFor === ds.id} onClose={() => setMenuFor(null)}>
                      <MenuItem icon={FiEye} label="Ouvrir le dossier"
                        onClick={() => { setMenuFor(null); nav(`/dossier-patient/dossier/${ds.id}`) }} />
                      <MenuItem icon={FiUser} label="Modifier la fiche patient…"
                        onClick={() => openEdit(ds)} />
                      <MenuItem icon={FiFolderPlus} label="Nouveau sous-dossier…"
                        onClick={() => { setMenuFor(null); setName(''); setModal({ kind: 'sub', id: ds.id }) }} />
                      <MenuItem icon={FiEdit2} label="Renommer…"
                        onClick={() => { setMenuFor(null); setName(ds.name); setModal({ kind: 'rename', id: ds.id }) }} />
                      <MenuItem icon={FiTrash2} label="Mettre à la corbeille" danger
                        onClick={() => { setMenuFor(null); setModal({ kind: 'trash', ds }) }} />
                  </MenuDropdown>
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
        </Box>
      </HStack>

      {/* corbeille dossier — confirmation obligatoire */}
      <ConfirmModal open={modal?.kind === 'trash'} onClose={() => setModal(null)}
        onConfirm={trash} busy={busy}
        title="Mettre le dossier à la corbeille ?"
        confirmLabel="Oui, mettre à la corbeille"
        message={`Voulez-vous vraiment mettre « ${modal?.ds?.name || ''} » à la corbeille ? Ses photos et montages seront déplacés avec lui — restauration possible depuis la corbeille.`} />

      {/* renommage — modal simple */}
      <Modal open={modal?.kind === 'rename'} onClose={() => setModal(null)} width="400px"
        title="Renommer le dossier"
        footer={<PrimaryButton onClick={rename} disabled={!name.trim()}>Renommer</PrimaryButton>}>
        <Input fontSize="sm" placeholder="Nom du dossier" autoFocus
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') rename() }} />
      </Modal>

      {/* sous-dossier : rangement hiérarchique (parent_id) */}
      <Modal open={modal?.kind === 'sub'} onClose={() => setModal(null)} width="400px"
        title="Nouveau sous-dossier"
        footer={<PrimaryButton onClick={() => createSub(modal.id)} disabled={!name.trim()}>Créer</PrimaryButton>}>
        <VStack align="stretch" gap="3">
          <Text fontSize="xs" color="gray.500">
            Rangé dans <b>{d?.dossiers.find((x) => x.id === modal?.id)?.name}</b> — ex. « Traitement », « Suivi 6 mois ».
          </Text>
          <Input fontSize="sm" placeholder="Nom du sous-dossier" autoFocus
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createSub(modal?.id) }} />
        </VStack>
      </Modal>

      {/* modifier la fiche : n°, spécialités, description + identité patient */}
      <Modal open={modal?.kind === 'edit'} onClose={() => setModal(null)} width="560px"
        title={`Fiche patient — ${editForm?.name || ''}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Annuler</Button>
            <PrimaryButton onClick={saveEdit} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
          </>
        }>
        {editForm && (
          <VStack align="stretch" gap="4">
            <SimpleGrid columns={3} gap="3">
              <Box>
                <Text fontSize="xs" color="gray.500" mb="1">Nom</Text>
                <Input fontSize="sm" placeholder="DOE" textTransform="uppercase"
                  value={editForm.last} onChange={(e) => setEditForm({ ...editForm, last: e.target.value })} />
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500" mb="1">Prénom</Text>
                <Input fontSize="sm" placeholder="John"
                  value={editForm.first} onChange={(e) => setEditForm({ ...editForm, first: e.target.value })} />
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500" mb="1">Naissance</Text>
                <Input fontSize="sm" type="date"
                  value={editForm.birth || ''} onChange={(e) => setEditForm({ ...editForm, birth: e.target.value })} />
              </Box>
            </SimpleGrid>
            <Box>
              <Text fontSize="xs" color="gray.500" mb="1">N° de dossier</Text>
              <Input fontSize="sm" placeholder="877" w="160px"
                value={editForm.num} onChange={(e) => setEditForm({ ...editForm, num: e.target.value })} />
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" mb="2">Spécialités de la séance</Text>
              <HStack gap="1.5" flexWrap="wrap">
                {SPECIALTIES.map((s) => (
                  <SpecChip key={s.label} label={s.label} size="xs"
                    active={editForm.specs.includes(s.label)}
                    onClick={() => setEditForm((f) => ({
                      ...f,
                      specs: f.specs.includes(s.label)
                        ? f.specs.filter((x) => x !== s.label)
                        : [...f.specs, s.label],
                    }))} />
                ))}
              </HStack>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" mb="1">Notes</Text>
              <Input fontSize="sm" placeholder="Observations, contexte du cas…"
                value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} />
            </Box>
          </VStack>
        )}
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

      {/* Corbeille : dossiers supprimés + restauration */}
      <Modal open={modal?.kind === 'bin'} onClose={() => setModal(null)} width="480px"
        title="Corbeille" subtitle="Dossiers supprimés — restaurez-les en un clic">
        <VStack align="stretch" gap="1.5" maxH="320px" overflowY="auto">
          {trashList.map((ds) => (
            <HStack key={ds.id} px="3" py="2" borderRadius="lg" border="1px solid" borderColor="gray.200" gap="3">
              <Box as={FiFolder} color="gray.400" />
              <Box flex="1" minW="0">
                <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{ds.name}</Text>
                <Text fontSize="2xs" color="gray.500">Supprimé {ago(ds.deleted_at)}</Text>
              </Box>
              <Button variant="outline" size="xs" borderRadius="md" onClick={() => restore(ds)}>Restaurer</Button>
            </HStack>
          ))}
          {!trashList.length && (
            <Text fontSize="sm" color="gray.500" textAlign="center" py="6">La corbeille est vide.</Text>
          )}
        </VStack>
      </Modal>
    </Box>
  )
}

// Survol d'une carte : fiche récapitulative du patient + actions rapides.
// Posé sur la vignette — cliquable (contrairement à <Tip> qui est pointerEvents:none).
const SYS_KEYS = new Set(['id', 'workspace_id', 'dossier_id', 'created_at', 'updated_at', 'deleted_at'])
const FIELD_LABELS = {
  phone: 'Téléphone', email: 'E-mail', address: 'Adresse', city: 'Ville',
  notes: 'Notes', gender: 'Sexe', blood_type: 'Groupe', allergies: 'Allergies',
}

function PatientHover({ ds, pat, onView, onEdit }) {
  const birth = pat?.birth_date
    ? new Date(pat.birth_date).toLocaleDateString('fr-FR')
    : null
  const age = pat?.birth_date
    ? Math.floor((Date.now() - new Date(pat.birth_date)) / (365.25 * 864e5))
    : null
  // champs supplémentaires renseignés dans la fiche (téléphone, e-mail, notes…)
  const extras = pat
    ? Object.entries(pat)
        .filter(([k, v]) => !SYS_KEYS.has(k) && !['last_name', 'first_name', 'birth_date'].includes(k) && v != null && v !== '')
        .slice(0, 3)
    : []
  const row = (k, v) => (
    <HStack key={k} justify="space-between" fontSize="2xs" gap="3">
      <Text color="gray.500" flexShrink="0">{k}</Text>
      <Text color={C.ink} fontWeight="600" textAlign="right" isTruncated>{v}</Text>
    </HStack>
  )
  return (
    <Box
      position="absolute" inset="0" borderRadius="lg" overflow="hidden" zIndex="5"
      bg="white" opacity="0.98" border="1px solid" borderColor={C.cardBorder}
      boxShadow="lg" p="3" display="flex" flexDirection="column" gap="1.5"
      cursor="default" onClick={(e) => e.preventDefault()}
    >
      <HStack justify="space-between" mb="0.5">
        <Text fontSize="xs" fontWeight="700" color={C.ink} isTruncated>
          {[pat?.last_name, pat?.first_name].filter(Boolean).join(' ') || ds.name}
        </Text>
        <Tag color="blue"><FiUser style={{ marginRight: 3 }} />Fiche</Tag>
      </HStack>
      {pat === undefined ? (
        <Text fontSize="2xs" color="gray.400">Chargement de la fiche…</Text>
      ) : (
        <VStack align="stretch" gap="1" flex="1" overflow="auto">
          {ds.patient_dossier_number && row('N° dossier', ds.patient_dossier_number)}
          {birth && row('Né(e) le', `${birth}${age != null ? ` — ${age} ans` : ''}`)}
          {(ds.specialties || []).length > 0 && row('Spécialité(s)', ds.specialties.join(', '))}
          {ds.description && row('Notes', ds.description)}
          {extras.map(([k, v]) => row(FIELD_LABELS[k] || k, typeof v === 'string' ? v : JSON.stringify(v)))}
          {!pat && <Text fontSize="2xs" color="gray.400">Aucune fiche patient liée — « Modifier » la crée.</Text>}
        </VStack>
      )}
      <HStack gap="2" pt="1" mt="auto">
        <Button size="xs" flex="1" bg={C.primary} color="#ffffff" borderRadius="md"
          _hover={{ filter: 'brightness(1.1)' }} onClick={onView}>
          <FiEye style={{ marginRight: 4 }} /> Voir la fiche
        </Button>
        <Button size="xs" flex="1" variant="outline" borderRadius="md" onClick={onEdit}>
          <FiEdit2 style={{ marginRight: 4 }} /> Modifier
        </Button>
      </HStack>
    </Box>
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
  const [allDossiers, setAllDossiers] = useState([])
  const [patient, setPatient] = useState(null)
  const [photos, setPhotos] = useState([])
  const [montages, setMontages] = useState([])
  const [subs, setSubs] = useState([])
  const [missing, setMissing] = useState(false)
  const [sheet, setSheet] = useState(false) // modal planche contact
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const reload = async () => {
    if (!wsId) return
    const [all, ph, mo, pat] = await Promise.all([
      listDossiers(wsId), listPhotosByDossier(id), listMontagesByDossier(id), getPatient(id),
    ])
    const ds = all.find((x) => x.id === id)
    setDossier(ds || null)
    setAllDossiers(all)
    setMissing(!ds)
    setPatient(pat)
    setPhotos(ph)
    setMontages(mo)
    setSubs(dossierChildren(all, id))
  }
  useEffect(() => { reload() }, [wsId, id])

  // glisser-déposer : ids lâchés sur un dossier (arbre ou tuile sous-dossier)
  const movePhotos = async (ids, dossierId) => {
    const to = allDossiers.find((x) => x.id === dossierId)
    try {
      await movePhotosToDossier(wsId, ids, dossierId)
      toast.success(`${ids.length} photo(s) déplacée(s) vers « ${to?.name || 'Sans dossier'} ».`)
      reload()
    } catch { toast.error('Déplacement impossible. Réessayez.') }
  }
  const openFolder = (fid) => nav(fid ? `/dossier-patient/dossier/${fid}` : '/dossier-patient')

  const onImportFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length) { await importPhotos(wsId, files, id); toast.success(`${files.length} photo(s) importée(s).`); reload() }
  }

  const rename = async (n) => {
    await updateDossier(id, { name: n })
    toast.success('Dossier renommé.'); reload()
  }

  const trash = async () => {
    setBusy(true)
    await trashDossier(id)
    setConfirmTrash(false)
    toast.info('Dossier mis à la corbeille.')
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

      <HStack align="start" gap="4">
        <DossierTree dossiers={allDossiers} currentId={id}
          onNavigate={openFolder} onMove={movePhotos} />
        <Box flex="1" minW="0">

      <Box mb="3">
        <FolderBreadcrumb dossiers={allDossiers} currentId={id}
          rootLabel="Dossiers" onNavigate={openFolder} />
      </Box>

      <HStack mb="4" gap="3" flexWrap="wrap">
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
        <Button size="sm" variant="outline" onClick={() => setRenameOpen(true)}><FiEdit2 /> Renommer</Button>
        <Button size="sm" variant="outline" color="red.500" onClick={() => setConfirmTrash(true)}><FiTrash2 /></Button>
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
          <Text fontSize="xs" fontWeight="600" color="gray.500" mb="2">SOUS-DOSSIERS — cliquez pour ouvrir, glissez des photos dessus pour les ranger</Text>
          <HStack gap="1" mb="5" flexWrap="wrap">
            {subs.map((s) => (
              <FolderTile key={s.id} dossier={s} onOpen={openFolder} onMove={movePhotos} />
            ))}
          </HStack>
        </>
      )}

      {photos.length > 0 && <Text fontSize="xs" fontWeight="600" color="gray.500" mb="2">PHOTOS — cliquer ouvre dans le Studio, glisser vers un dossier déplace</Text>}
      {photos.length === 0 ? (
        <EmptyPane py="14" textAlign="center" mb="6">
          <VStack gap="2">
            <Box as={subs.length || montages.length ? FiImage : FiFolderMinus} fontSize="3xl" color="gray.300" />
            <Text fontSize="md" fontWeight="600" color={C.ink}>
              {subs.length || montages.length ? 'Aucune photo dans ce dossier' : 'Ce dossier est vide'}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {subs.length || montages.length
                ? 'Glissez des photos sur ce dossier depuis la photothèque, ou importez-en.'
                : 'Capturez ou importez des photos, ou glissez-en depuis la photothèque.'}
            </Text>
            <HStack gap="2" mt="2" justify="center">
              <Link to={`/acquisition/capture/${id}`}><Button size="sm" bg={C.primary} color="#ffffff"><FiCamera /> Capturer</Button></Link>
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}><FiUpload /> Importer</Button>
            </HStack>
          </VStack>
        </EmptyPane>
      ) : (
        <SimpleGrid columns={{ base: 2, md: 5, xl: 6 }} gap="4" mb="6">
          {photos.map((p) => (
            <Box key={p.id} as={Link} to={`/studio?edit=${p.id}`} draggable cursor="pointer" _hover={{ opacity: 0.85 }}
              onDragStart={(e) => startPhotoDrag(e, [p.id])}>
              <PhotoImg storagePath={p.storage_path} ratio="1/1" />
              <Text fontSize="2xs" color="gray.500" mt="1" isTruncated>
                {p.original_filename || 'photo'}
              </Text>
              <Text fontSize="2xs" color="gray.400">{ago(p.created_at)}</Text>
            </Box>
          ))}
        </SimpleGrid>
      )}

      {(montages.length > 0 || photos.length > 0 || subs.length > 0) && <Text fontSize="xs" fontWeight="600" color="gray.500" mb="2">MONTAGES</Text>}
      {montages.length === 0 ? (
        (photos.length > 0 || subs.length > 0) && <Text fontSize="sm" color="gray.500" mb="2">Aucun montage — créez-en un dans le Studio.</Text>
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

      <PromptModal open={renameOpen} onClose={() => setRenameOpen(false)}
        title="Renommer le dossier" subtitle={dossier?.name}
        label="Nouveau nom" defaultValue={dossier?.name} confirmLabel="Renommer"
        onSubmit={rename} />

      <ConfirmModal open={confirmTrash} onClose={() => setConfirmTrash(false)}
        onConfirm={trash} busy={busy}
        title="Mettre le dossier à la corbeille ?"
        confirmLabel="Oui, mettre à la corbeille"
        message={`Voulez-vous vraiment mettre « ${dossier?.name || ''} » à la corbeille ? Ses ${photos.length} photo(s) et ${montages.length} montage(s) seront déplacés avec lui — restauration possible depuis la corbeille.`} />
        </Box>
      </HStack>
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
