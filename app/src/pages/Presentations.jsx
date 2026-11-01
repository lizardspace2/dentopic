// Route /presentations — diaporamas du workspace.
// Fonctionnel : recherche, onglets, tri, création (template ou vierge),
// détail des diapositives, ajout/suppression de diapos, édition (nom, patient,
// statut), duplication, archivage, partage par lien, corbeille (soft delete).
import { useEffect, useState } from 'react'
import { Box, Button, Center, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiPlus, FiType, FiMonitor, FiLayers, FiFileText, FiAlertCircle, FiEye,
  FiMoreVertical, FiClock, FiLink, FiEdit2, FiTrash2, FiCheck, FiCopy,
  FiExternalLink, FiImage, FiVideo, FiArchive, FiX, FiAlertTriangle,
} from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi2'
import {
  Card, Tag, PageHeader, HelpButton, PrimaryButton, SearchInput,
  Select, ago, isTestName, Modal, Field, Tip, IconTile, ConfirmModal,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  listPresentations, slideCountByPresentation,
  createPresentation, updatePresentation, trashPresentation, duplicatePresentation,
  listPresentationSlides, addPresentationSlide, removePresentationSlide,
  sharePresentation, listPhotos, listMontages, listVideoProjects,
  listDossiers, getPatient,
} from '../api'

const TABS = ['Toutes', 'Brouillons', 'Récentes', 'Archivées']
const SLIDE_TYPES = [
  ['photo', 'Photo', FiImage],
  ['montage', 'Montage avant/après', FiLayers],
  ['video', 'Vidéo', FiVideo],
  ['text', 'Diapo texte', FiType],
]
const STATUS_TAG = { draft: ['amber', 'Brouillon'], finalized: ['green', 'Finalisé'], archived: ['gray', 'Archivé'] }

export default function Presentations() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [pres, setPres] = useState([])
  const [slideCounts, setSlideCounts] = useState({})
  const [dossiers, setDossiers] = useState([])
  const [tab, setTab] = useState('Toutes')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const [modal, setModal] = useState(null)   // { kind, pres? }
  const [menuFor, setMenuFor] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const reload = async () => {
    if (!wsId) return
    const [p, s, d] = await Promise.all([
      listPresentations(wsId), slideCountByPresentation(), listDossiers(wsId),
    ])
    setPres(p); setSlideCounts(s); setDossiers(d)
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  const slideTotal = Object.values(slideCounts).reduce((a, b) => a + b, 0)
  const noSlides = pres.filter((p) => !slideCounts[p.id] && p.status !== 'archived').length
  const testCount = pres.filter((p) => isTestName(p.name)).length

  const week = Date.now() - 7 * 86400000
  const list = pres
    .filter((p) => tab === 'Toutes' ? p.status !== 'archived'
      : tab === 'Brouillons' ? p.status === 'draft'
      : tab === 'Récentes' ? new Date(p.updated_at) > week && p.status !== 'archived'
      : p.status === 'archived')
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'name'
      ? a.name.localeCompare(b.name, 'fr')
      : new Date(b.updated_at) - new Date(a.updated_at))

  // ---- actions ---------------------------------------------------------------

  const openNew = (template = false) => {
    setForm({ name: '', dossier_id: '', template })
    setModal({ kind: 'new' })
  }
  const openEdit = (p) => {
    setForm({ name: p.name, dossier_id: '', status: p.status })
    setModal({ kind: 'edit', pres: p })
  }
  const saveNew = async () => {
    if (!form?.name.trim()) return
    setBusy(true)
    const patientId = form.dossier_id ? (await getPatient(form.dossier_id))?.id : null
    const created = await createPresentation(wsId, { name: form.name.trim(), patient_id: patientId })
    if (created && form.template) {
      await addPresentationSlide(created.id, {
        position: 0, type: 'text', title: form.name.trim(),
        text_content: 'Présentation — ajoutez vos diapositives depuis la carte.',
      })
    }
    setBusy(false); setModal(null); setForm(null); reload()
  }
  const saveEdit = async () => {
    if (!form?.name.trim()) return
    setBusy(true)
    const patientId = form.dossier_id ? (await getPatient(form.dossier_id))?.id : null
    await updatePresentation(modal.pres.id, {
      name: form.name.trim(), status: form.status,
      patient_id: form.dossier_id ? patientId : modal.pres.patient_id,
    })
    setBusy(false); setModal(null); setForm(null); reload()
  }
  const trash = async (p) => {
    setBusy(true); await trashPresentation(p.id)
    setBusy(false); setModal(null); setMenuFor(null); reload()
  }
  const duplicate = async (p) => {
    setBusy(true); setMenuFor(null)
    await duplicatePresentation(p)
    setBusy(false); reload()
  }
  const archive = async (p, archived = true) => {
    setMenuFor(null)
    await updatePresentation(p.id, { status: archived ? 'archived' : 'draft' })
    reload()
  }
  const cleanTests = async () => {
    setBusy(true)
    for (const p of pres.filter((x) => isTestName(x.name))) await trashPresentation(p.id)
    setBusy(false); setModal(null); reload()
  }
  const share = async (p, enabled, days = null) => {
    const updated = await sharePresentation(p.id, enabled, days)
    if (updated) setModal({ kind: 'share', pres: updated })
    reload()
  }
  const shareUrl = (p) => `${window.location.origin}/partage-presentation/${p.share_token}`
  const copyLink = (p) => {
    navigator.clipboard?.writeText(shareUrl(p))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  // ---- rendu -----------------------------------------------------------------

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader
        icon={FiMonitor} title="Présentations"
        subtitle="Créez et partagez des présentations visuelles"
      >
        <HelpButton />
        <Tip label="Créer une présentation avec une diapo de titre déjà en place">
          <Button variant="outline" size="sm" borderRadius="md" color="gray.600"
            onClick={() => openNew(true)}>
            <HiOutlineSparkles /> Démarrer depuis un template
          </Button>
        </Tip>
        <PrimaryButton icon={FiPlus} onClick={() => openNew(false)}>Nouvelle présentation</PrimaryButton>
      </PageHeader>

      {noSlides > 0 && (
        <HStack bg={C.amberBg} border="1px solid" borderColor={C.amberBorder} borderRadius="md" px="3" py="2" my="4" gap="2">
          <Box as={FiAlertCircle} color="#d97706" fontSize="sm" />
          <Text fontSize="sm" color={C.amberText}>{noSlides} présentation(s) sans diapositive</Text>
        </HStack>
      )}

      <HStack gap="2" mb="4" mt="4">
        <Tag color="gray"><FiMonitor style={{ marginRight: 4 }} />{list.length} présentation(s)</Tag>
        <Tag color="gray"><FiLayers style={{ marginRight: 4 }} />{slideTotal} diapositive(s)</Tag>
        {noSlides > 0 && <Tag color="amber"><FiFileText style={{ marginRight: 4 }} />{noSlides} brouillon</Tag>}
        {testCount > 0 && (
          <Tip label="Présentations de test/démo — mettre à la corbeille">
            <Text fontSize="xs" color={C.amberText} cursor="pointer" onClick={() => setModal({ kind: 'clean' })}>
              <FiAlertTriangle style={{ display: 'inline' }} /> Nettoyer ({testCount})
            </Text>
          </Tip>
        )}
      </HStack>

      <HStack gap="3" mb="5">
        <SearchInput placeholder="Rechercher une présentation…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <HStack gap="3">
          {TABS.map((t) => (
            <Text
              key={t} fontSize="xs" cursor="pointer"
              fontWeight={tab === t ? '600' : '400'}
              color={tab === t ? C.primary : 'gray.500'}
              onClick={() => setTab(t)}
            >
              {t}
            </Text>
          ))}
        </HStack>
        <Select h="30px" fontSize="xs" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Plus récent</option>
          <option value="name">Nom A→Z</option>
        </Select>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 4 }} gap="5">
        {list.map((p) => {
          const [tagColor, tagLabel] = STATUS_TAG[p.status] || STATUS_TAG.draft
          return (
            <Card key={p.id} overflow="hidden" _hover={{ borderColor: 'blue.300' }}
              cursor="pointer" onClick={() => setModal({ kind: 'detail', pres: p })}>
              <Box position="relative">
                <Center bg="gray.100" aspectRatio="16/9" color="gray.400">
                  <Box as={FiType} fontSize="22px" />
                </Center>
                <Box position="absolute" top="2" right="2"><Tag color={tagColor}>{tagLabel}</Tag></Box>
                <Box position="absolute" bottom="2" left="2" bg="#1f2937" opacity="0.9" borderRadius="md" px="1.5" py="0.5">
                  <Text fontSize="2xs" color="#ffffff"><FiLayers style={{ display: 'inline' }} /> {slideCounts[p.id] || 0}</Text>
                </Box>
                {p.share_enabled && (
                  <Box position="absolute" bottom="2" right="2" bg={C.primary} opacity="0.95" borderRadius="md" px="1.5" py="0.5">
                    <Box as={FiLink} color="#fff" fontSize="2xs" />
                  </Box>
                )}
              </Box>
              <HStack px="3" py="2.5" justify="space-between" onClick={(e) => e.stopPropagation()}>
                <Box minW="0" flex="1">
                  <HStack gap="1.5">
                    <Text fontSize="xs" fontWeight="600" color={C.ink} isTruncated>{p.name}</Text>
                    {isTestName(p.name) && <Tag color="purple">TEST</Tag>}
                  </HStack>
                  <Text fontSize="2xs" color="gray.500"><FiClock style={{ display: 'inline' }} /> {ago(p.updated_at)}</Text>
                </Box>
                <HStack gap="0.5">
                  <Tip label="Voir les diapositives">
                    <IconBtn I={FiEye} label="Voir les diapositives" onClick={() => setModal({ kind: 'detail', pres: p })} />
                  </Tip>
                  <Tip label="Ajouter une diapositive">
                    <IconBtn I={FiPlus} label="Ajouter une diapositive" onClick={() => setModal({ kind: 'add', pres: p })} />
                  </Tip>
                  <Tip label="Partager par lien">
                    <IconBtn I={FiLink} label="Partager par lien" onClick={() => setModal({ kind: 'share', pres: p })} />
                  </Tip>
                  <Box position="relative">
                    <Tip label="Plus d'actions : renommer, dupliquer, archiver, corbeille">
                      <IconBtn I={FiMoreVertical} label="Plus d'actions"
                        onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} />
                    </Tip>
                    {menuFor === p.id && (
                      <VStack
                        position="absolute" bottom="100%" right="0" mb="1" align="stretch" gap="0"
                        bg="white" border="1px solid" borderColor={C.cardBorder} borderRadius="md"
                        minW="210px" py="1" boxShadow="lg" zIndex="20"
                      >
                        <MenuItem icon={FiEye} label="Voir les diapositives"
                          onClick={() => { setMenuFor(null); setModal({ kind: 'detail', pres: p }) }} />
                        <MenuItem icon={FiEdit2} label="Modifier (nom, patient, statut)…"
                          onClick={() => { setMenuFor(null); openEdit(p) }} />
                        <MenuItem icon={FiCopy} label="Dupliquer"
                          onClick={() => duplicate(p)} />
                        <MenuItem icon={FiLink} label="Partager par lien…"
                          onClick={() => { setMenuFor(null); setModal({ kind: 'share', pres: p }) }} />
                        {p.status === 'archived' ? (
                          <MenuItem icon={FiArchive} label="Restaurer"
                            onClick={() => archive(p, false)} />
                        ) : (
                          <MenuItem icon={FiArchive} label="Archiver"
                            onClick={() => archive(p, true)} />
                        )}
                        <MenuItem icon={FiTrash2} label="Mettre à la corbeille" danger
                          onClick={() => { setMenuFor(null); setModal({ kind: 'trash', pres: p }) }} />
                      </VStack>
                    )}
                  </Box>
                </HStack>
              </HStack>
            </Card>
          )
        })}
      </SimpleGrid>
      {!list.length && (
        <Card p="10" textAlign="center" mt="4">
          <Text fontSize="sm" color="gray.500">Aucune présentation — créez-en une ou changez de filtre.</Text>
        </Card>
      )}

      {/* ---- création / template ---- */}
      <Modal open={modal?.kind === 'new'} onClose={() => setModal(null)}
        title={form?.template ? 'Démarrer depuis un template' : 'Nouvelle présentation'}
        subtitle={form?.template ? 'Une diapositive de titre sera créée automatiquement' : 'La présentation sera créée en brouillon'}
        footer={<>
          <span />
          <PrimaryButton onClick={saveNew} disabled={!form?.name.trim() || busy}>
            {busy ? 'Création…' : 'Créer'}
          </PrimaryButton>
        </>}>
        <Field label="Nom de la présentation" mb="3">
          <Input fontSize="sm" placeholder="ex. Cas d'esthétique — séminaire" autoFocus
            value={form?.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Dossier patient (optionnel)">
          <Select w="100%" value={form?.dossier_id || ''}
            onChange={(e) => setForm({ ...form, dossier_id: e.target.value })}>
            <option value="">Aucun</option>
            {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      </Modal>

      {/* ---- édition ---- */}
      <Modal open={modal?.kind === 'edit'} onClose={() => setModal(null)}
        title="Modifier la présentation" subtitle={modal?.pres?.name}
        footer={<>
          <span />
          <PrimaryButton onClick={saveEdit} disabled={!form?.name.trim() || busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </PrimaryButton>
        </>}>
        <Field label="Nom" mb="3">
          <Input fontSize="sm" autoFocus placeholder="Nom de la présentation" value={form?.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Dossier patient" mb="3">
          <Select w="100%" value={form?.dossier_id || ''}
            onChange={(e) => setForm({ ...form, dossier_id: e.target.value })}>
            <option value="">Conserver l'actuel</option>
            {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Statut">
          <Select w="100%" value={form?.status || 'draft'}
            onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Brouillon</option>
            <option value="finalized">Finalisé</option>
            <option value="archived">Archivé</option>
          </Select>
        </Field>
      </Modal>

      {/* ---- détail : diapositives ---- */}
      <DetailModal modal={modal} onClose={() => setModal(null)} onAdd={() => setModal({ kind: 'add', pres: modal.pres })} />

      {/* ---- ajouter une diapositive ---- */}
      <AddSlideModal modal={modal} wsId={wsId} onClose={() => setModal(null)} onDone={reload} />

      {/* ---- partage ---- */}
      <Modal open={modal?.kind === 'share'} onClose={() => setModal(null)}
        title="Partager la présentation"
        subtitle="Lien public — le destinataire voit la présentation sans compte">
        {modal?.pres?.share_enabled ? (
          <>
            <HStack bg={C.greenBg} borderRadius="md" px="3" py="2" mb="3" gap="2">
              <Box as={FiLink} color={C.greenText} fontSize="sm" />
              <Text fontSize="xs" color={C.greenText} fontWeight="600">
                Partage actif{modal.pres.share_expires_at ? ` jusqu'au ${new Date(modal.pres.share_expires_at).toLocaleDateString('fr-FR')}` : ''}
              </Text>
            </HStack>
            <HStack mb="4">
              <Input fontSize="xs" value={shareUrl(modal.pres)} readOnly />
              <Button variant="outline" size="sm" onClick={() => copyLink(modal.pres)}>
                {copied ? <><FiCheck /> Copié</> : <><FiCopy /> Copier</>}
              </Button>
            </HStack>
            <HStack justify="space-between">
              <Button variant="outline" size="sm" onClick={() => window.open(shareUrl(modal.pres), '_blank')}>
                <FiExternalLink /> Ouvrir
              </Button>
              <Button variant="ghost" size="sm" color="red.500" onClick={() => share(modal.pres, false)}>
                Désactiver
              </Button>
            </HStack>
          </>
        ) : (
          <>
            <Text fontSize="sm" color={C.body} mb="4">
              Activez le partage pour générer un lien public vers cette présentation.
            </Text>
            <HStack gap="2">
              {[null, 7, 30].map((d) => (
                <Button key={String(d)} variant="outline" size="sm"
                  onClick={() => share(modal.pres, true, d)}>
                  {d ? `Expire dans ${d} jours` : 'Sans expiration'}
                </Button>
              ))}
            </HStack>
          </>
        )}
      </Modal>

      {/* ---- corbeille : confirmation obligatoire ---- */}
      <ConfirmModal open={modal?.kind === 'trash'} onClose={() => setModal(null)}
        onConfirm={() => trash(modal.pres)} busy={busy}
        title="Mettre la présentation à la corbeille ?"
        confirmLabel="Oui, mettre à la corbeille"
        message={`Voulez-vous vraiment mettre « ${modal?.pres?.name || ''} » à la corbeille avec ses ${slideCounts[modal?.pres?.id] || 0} diapositive(s) ? Restauration possible depuis la corbeille.`} />

      {/* ---- nettoyage tests ---- */}
      <Modal open={modal?.kind === 'clean'} onClose={() => setModal(null)} title="Nettoyer les présentations de test"
        footer={<>
          <span />
          <HStack gap="2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Non</Button>
            <PrimaryButton bg="red.500" _hover={{ bg: 'red.600' }} onClick={cleanTests} disabled={busy}>
              {busy ? 'Suppression…' : `Oui, mettre à la corbeille (${testCount})`}
            </PrimaryButton>
          </HStack>
        </>}>
        <Text fontSize="sm" color={C.body}>
          Voulez-vous vraiment mettre {testCount} présentation(s) de test/démo à la corbeille ?
        </Text>
      </Modal>
    </Box>
  )
}

// ---- Détail : liste des diapositives -------------------------------------------

function DetailModal({ modal, onClose, onAdd }) {
  const p = modal?.pres
  const [slides, setSlides] = useState([])
  const [busy, setBusy] = useState(false)
  const [rmSlide, setRmSlide] = useState(null)
  useEffect(() => {
    if (modal?.kind === 'detail' && p) listPresentationSlides(p.id).then(setSlides)
  }, [modal]) // eslint-disable-line
  if (!p) return null
  const removeSlide = async () => {
    if (!rmSlide) return
    setBusy(true)
    await removePresentationSlide(rmSlide)
    setSlides((l) => l.filter((s) => s.id !== rmSlide))
    setBusy(false); setRmSlide(null)
  }
  return (
    <Modal open={modal?.kind === 'detail'} onClose={onClose}
      title={p.name} subtitle={`${slides.length} diapositive(s) · modifiée ${ago(p.updated_at)}`}
      width="560px"
      footer={<>
        <span />
        <PrimaryButton icon={FiPlus} onClick={onAdd}>Ajouter une diapositive</PrimaryButton>
      </>}>
      {!slides.length ? (
        <Text fontSize="sm" color="gray.500" py="3">
          Aucune diapositive — ajoutez des photos, montages, vidéos ou diapos texte.
        </Text>
      ) : (
        <VStack align="stretch" gap="2" maxH="400px" overflowY="auto">
          {slides.map((s, i) => (
            <HStack key={s.id} border="1px solid" borderColor={C.cardBorder} borderRadius="md" px="3" py="2">
              <Text fontSize="2xs" color="gray.400" w="16px">{i + 1}</Text>
              <Box w="56px" flexShrink={0}>
                {s.photo?.storage_path ? (
                  <PhotoImg storagePath={s.photo.storage_path} ratio="16/10" />
                ) : s.montage?.export_url ? (
                  <PhotoImg storagePath={s.montage.export_url} ratio="16/10" />
                ) : s.media_url ? (
                  <Box as="img" src={s.media_url} w="56px" h="35px" objectFit="cover" borderRadius="sm" />
                ) : (
                  <Center bg="gray.100" borderRadius="sm" h="35px">
                    <Box as={s.type === 'text' ? FiType : s.type === 'video' ? FiVideo : FiLayers} color="gray.400" fontSize="xs" />
                  </Center>
                )}
              </Box>
              <Box flex="1" minW="0">
                <Text fontSize="xs" fontWeight="600" color={C.ink} isTruncated>
                  {s.title || SLIDE_TYPES.find(([k]) => k === s.type)?.[1] || s.type}
                </Text>
                <Text fontSize="2xs" color="gray.400" isTruncated>
                  {SLIDE_TYPES.find(([k]) => k === s.type)?.[1] || s.type}
                  {s.text_content ? ` — ${s.text_content.slice(0, 60)}` : ''}
                </Text>
              </Box>
              <Tag color="gray">{s.type}</Tag>
              <Tip label="Retirer cette diapositive">
                <Box as="button" aria-label="Retirer la diapositive" color="gray.400" p="1"
                  cursor={busy ? 'wait' : 'pointer'} _hover={{ color: 'red.500' }}
                  onClick={() => setRmSlide(s.id)}>
                  <FiX />
                </Box>
              </Tip>
            </HStack>
          ))}
        </VStack>
      )}
      <ConfirmModal open={!!rmSlide} onClose={() => setRmSlide(null)}
        onConfirm={removeSlide} busy={busy}
        title="Retirer la diapositive ?"
        confirmLabel="Oui, retirer"
        message="Voulez-vous vraiment retirer cette diapositive de la présentation ? Le média reste dans le workspace." />
    </Modal>
  )
}

// ---- Ajouter une diapositive ----------------------------------------------------

function AddSlideModal({ modal, wsId, onClose, onDone }) {
  const p = modal?.pres
  const [type, setType] = useState('photo')
  const [mediaId, setMediaId] = useState(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [photos, setPhotos] = useState([])
  const [montages, setMontages] = useState([])
  const [videos, setVideos] = useState([])

  useEffect(() => {
    if (modal?.kind !== 'add' || !wsId) return
    setType('photo'); setMediaId(null); setTitle(''); setText('')
    listPhotos(wsId, { limit: 60 }).then(setPhotos)
    listMontages(wsId).then(setMontages)
    listVideoProjects(wsId).then(setVideos)
  }, [modal, wsId])
  if (!p) return null

  const pool = type === 'photo' ? photos : type === 'montage' ? montages : videos
  const add = async () => {
    setBusy(true)
    const pos = await listPresentationSlides(p.id).then((l) => l.length)
    const fields = {
      position: pos, type,
      title: title.trim() || null,
      text_content: type === 'text' ? text.trim() || null : null,
      photo_id: type === 'photo' ? mediaId : null,
      montage_id: type === 'montage' ? mediaId : null,
      video_project_id: type === 'video' ? mediaId : null,
    }
    await addPresentationSlide(p.id, fields)
    setBusy(false); onClose(); onDone()
  }
  const needMedia = type !== 'text'

  return (
    <Modal open={modal?.kind === 'add'} onClose={onClose}
      title="Ajouter une diapositive" subtitle={p.name} width="620px"
      footer={<>
        <span />
        <PrimaryButton onClick={add} disabled={busy || (needMedia && !mediaId) || (type === 'text' && !text.trim())}>
          {busy ? 'Ajout…' : 'Ajouter'}
        </PrimaryButton>
      </>}>
      <Field label="Type de diapositive" mb="3">
        <HStack gap="2" flexWrap="wrap">
          {SLIDE_TYPES.map(([k, l, I]) => (
            <Box key={k} as="button" px="3" py="1.5" borderRadius="md" cursor="pointer" fontSize="xs"
              fontWeight={type === k ? '600' : '400'} border="1.5px solid"
              borderColor={type === k ? C.primary : C.cardBorder}
              bg={type === k ? C.softBlue : 'transparent'} color={type === k ? C.primary : 'gray.600'}
              onClick={() => { setType(k); setMediaId(null) }}>
              <Box as={I} display="inline" mr="1" />{l}
            </Box>
          ))}
        </HStack>
      </Field>
      {needMedia && (
        <Field label={`Choisir ${type === 'photo' ? 'une photo' : type === 'montage' ? 'un montage' : 'une vidéo'}`} mb="3">
          <Box maxH="220px" overflowY="auto" border="1px solid" borderColor={C.cardBorder} borderRadius="md" p="2">
            {!pool.length ? (
              <Text fontSize="xs" color="gray.400" py="4" textAlign="center">Aucun élément disponible</Text>
            ) : (
              <SimpleGrid columns={5} gap="2">
                {pool.map((m) => {
                  const path = type === 'photo' ? m.storage_path : m.export_url
                  return (
                    <Box key={m.id} position="relative" borderRadius="md" overflow="hidden"
                      cursor="pointer" border="2px solid"
                      borderColor={mediaId === m.id ? C.primary : 'transparent'}
                      onClick={() => setMediaId(m.id)}>
                      {path ? (
                        <PhotoImg storagePath={path} ratio="1" />
                      ) : (
                        <Center bg="gray.100" h="100%" minH="60px">
                          <Box as={type === 'video' ? FiVideo : FiLayers} color="gray.400" />
                        </Center>
                      )}
                      {mediaId === m.id && (
                        <Center position="absolute" top="1" right="1" w="16px" h="16px"
                          borderRadius="full" bg={C.primary} color="#fff" fontSize="2xs">
                          <FiCheck />
                        </Center>
                      )}
                    </Box>
                  )
                })}
              </SimpleGrid>
            )}
          </Box>
        </Field>
      )}
      {type === 'text' && (
        <Field label="Contenu de la diapo" mb="3">
          <Box as="textarea" rows="3" w="100%" fontSize="sm" px="3" py="2"
            border="1px solid" borderColor={C.cardBorder} borderRadius="md"
            placeholder="Titre ou texte de la diapositive…" value={text}
            onChange={(e) => setText(e.target.value)} />
        </Field>
      )}
      <Field label="Titre (optionnel)">
        <Input fontSize="sm" placeholder="Titre affiché sur la diapositive" value={title}
          onChange={(e) => setTitle(e.target.value)} />
      </Field>
    </Modal>
  )
}

function IconBtn({ I, label, onClick }) {
  return (
    <Box as="button" aria-label={label} p="1" color="gray.400" fontSize="sm"
      cursor="pointer" _hover={{ color: C.primary }} onClick={onClick}>
      <I />
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
