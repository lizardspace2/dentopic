// Route /presentations — diaporamas du workspace.
// Fonctionnel : recherche, onglets, tri, création (template ou vierge),
// détail des diapositives, ajout/suppression de diapos, édition (nom, patient,
// statut), duplication, archivage, partage par lien, corbeille (soft delete).
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Button, Center, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiPlus, FiType, FiMonitor, FiLayers, FiFileText, FiAlertCircle, FiEye,
  FiMoreVertical, FiClock, FiLink, FiEdit2, FiTrash2, FiCheck, FiCopy,
  FiExternalLink, FiImage, FiVideo, FiArchive, FiX, FiAlertTriangle,
  FiPlay, FiChevronUp, FiChevronDown, FiSmile, FiGrid, FiBook, FiHeart, FiTool,
  FiSquare, FiRotateCcw, FiRotateCw,
} from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi2'
import {
  Card, Tag, PageHeader, HelpButton, PrimaryButton, SearchInput,
  Select, ago, isTestName, Modal, Field, Tip, IconTile, ConfirmModal,
  MenuDropdown, MenuItem, toast,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  listPresentations, slideCountByPresentation,
  createPresentation, updatePresentation, trashPresentation, duplicatePresentation,
  listPresentationSlides, addPresentationSlide, removePresentationSlide,
  updatePresentationSlide,
  sharePresentation, listPhotos, listMontages, listVideoProjects,
  listDossiers, getPatient, listPhotosByDossier, coverByPresentation,
} from '../api'
import { PRESENTATION_TEMPLATES, BILAN_SLIDES } from '../presentationTemplates'
import { clinicalLabels } from '../clinical'
import PresentMode from '../components/PresentMode'
import SlideElements, { slideElements, layoutNotes, newEl } from '../components/SlideElements'

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
  const [covers, setCovers] = useState({})
  const [dossiers, setDossiers] = useState([])
  const [tab, setTab] = useState('Toutes')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const [modal, setModal] = useState(null)   // { kind, pres? }
  const [menuFor, setMenuFor] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [onlyEmpty, setOnlyEmpty] = useState(false)

  const reload = async () => {
    if (!wsId) return
    const [p, s, d, cv] = await Promise.all([
      listPresentations(wsId), slideCountByPresentation(), listDossiers(wsId), coverByPresentation(),
    ])
    setPres(p); setSlideCounts(s); setDossiers(d); setCovers(cv)
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  // /presentations?tpl=<key>&dossier=<id> — carte « Projet » d'un dossier patient
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const tpl = searchParams.get('tpl')
    if (!tpl) return
    const t = PRESENTATION_TEMPLATES.find((x) => x.key === tpl)
    setModal({ kind: 'gallery', initialTpl: t || null, initialDossier: searchParams.get('dossier') || '' })
    setSearchParams({}, { replace: true })
  }, [searchParams]) // eslint-disable-line

  const slideTotal = Object.values(slideCounts).reduce((a, b) => a + b, 0)
  const noSlides = pres.filter((p) => !slideCounts[p.id] && p.status !== 'archived').length
  const draftCount = pres.filter((p) => p.status === 'draft').length
  const testCount = pres.filter((p) => isTestName(p.name)).length

  const week = Date.now() - 7 * 86400000
  const list = pres
    .filter((p) => onlyEmpty ? (!slideCounts[p.id] && p.status !== 'archived')
      : tab === 'Toutes' ? p.status !== 'archived'
      : tab === 'Brouillons' ? p.status === 'draft'
      : tab === 'Récentes' ? new Date(p.updated_at) > week && p.status !== 'archived'
      : p.status === 'archived')
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'slides'
      ? (slideCounts[b.id] || 0) - (slideCounts[a.id] || 0)
      : sort === 'name'
      ? a.name.localeCompare(b.name, 'fr')
      : new Date(b.updated_at) - new Date(a.updated_at))

  // ---- actions ---------------------------------------------------------------

  const openNew = () => {
    setForm({ name: '', dossier_id: '' })
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
    await createPresentation(wsId, { name: form.name.trim(), patient_id: patientId })
    setBusy(false); setModal(null); setForm(null); reload()
  }
  // Création depuis un modèle — slides pré-remplies depuis le dossier patient.
  const createFromTemplate = async (tpl, name, dossierId) => {
    setBusy(true)
    const finalName = name.trim() || tpl.name
    const patientId = dossierId ? (await getPatient(dossierId))?.id : null
    const created = await createPresentation(wsId, { name: finalName, patient_id: patientId })
    if (created) {
      const slides = await buildTemplateSlides(wsId, tpl, dossierId || null, finalName)
      for (const s of slides) await addPresentationSlide(created.id, s)
      toast.success(`Présentation créée — ${slides.length} diapositive(s) pré-remplies.`)
    }
    setBusy(false); setModal(null); reload()
  }
  // Mode Présenter — charge les diapos puis passe en plein écran.
  const present = async (p, readySlides = null) => {
    const slides = readySlides || await listPresentationSlides(p.id)
    if (!slides.length) { toast.info('Ajoutez d\'abord des diapositives.'); return }
    setModal({ kind: 'present', pres: p, slides })
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
    setBusy(false); setModal(null); setMenuFor(null)
    toast.info('Présentation mise à la corbeille.'); reload()
  }
  const duplicate = async (p) => {
    setBusy(true); setMenuFor(null)
    await duplicatePresentation(p)
    setBusy(false); toast.success('Présentation dupliquée.'); reload()
  }
  const archive = async (p, archived = true) => {
    setMenuFor(null)
    await updatePresentation(p.id, { status: archived ? 'archived' : 'draft' })
    toast.success(archived ? 'Présentation archivée.' : 'Présentation restaurée.')
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
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success('Lien copié dans le presse-papiers.') })
  }

  // ---- rendu -----------------------------------------------------------------

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader
        icon={FiMonitor} title="Présentations"
        subtitle="Créez et partagez des présentations visuelles"
      >
        <HelpButton />
        <Tip label="Galerie de modèles dentaires — le contenu se pré-remplit depuis le dossier patient">
          <Button variant="outline" size="sm" borderRadius="md" color="gray.600"
            onClick={() => setModal({ kind: 'gallery' })}>
            <HiOutlineSparkles /> Démarrer depuis un template
          </Button>
        </Tip>
        <PrimaryButton icon={FiPlus} onClick={openNew}>Nouvelle présentation</PrimaryButton>
      </PageHeader>

      {/* ---- bandeau de création façon Canva : modèles visibles d'emblée ---- */}
      <Card p="4" mt="4" mb="2">
        <HStack justify="space-between" mb="3">
          <HStack gap="2">
            <Box as={HiOutlineSparkles} color={C.primary} fontSize="md" />
            <Text fontSize="sm" fontWeight="700" color={C.ink}>Créer une présentation</Text>
            <Text fontSize="xs" color="gray.500" display={{ base: 'none', md: 'block' }}>
              — choisissez un modèle, il se remplit avec les photos du dossier patient
            </Text>
          </HStack>
          <Button size="xs" variant="ghost" color={C.primary} flexShrink={0}
            onClick={() => setModal({ kind: 'gallery' })}>Tout voir →</Button>
        </HStack>
        <HStack gap="3" overflowX="auto" pb="1" align="stretch">
          {/* modèle vierge */}
          <Box as="button" flexShrink={0} w="148px" textAlign="left" cursor="pointer" onClick={openNew}>
            <Center aspectRatio="16/10" borderRadius="md" border="1.5px dashed" borderColor="gray.300"
              color="gray.400" _hover={{ borderColor: C.primary, color: C.primary }}>
              <VStack gap="1"><FiPlus /><Text fontSize="2xs">Vierge</Text></VStack>
            </Center>
            <Text fontSize="2xs" fontWeight="600" color={C.ink} mt="1">Document vierge</Text>
          </Box>
          {PRESENTATION_TEMPLATES.map((t) => (
            <Box key={t.key} as="button" flexShrink={0} w="148px" textAlign="left" cursor="pointer"
              onClick={() => setModal({ kind: 'gallery', initialTpl: t })} title={t.desc}>
              <TemplatePreview tpl={t} />
              <HStack mt="1" justify="space-between" gap="1">
                <Text fontSize="2xs" fontWeight="600" color={C.ink} isTruncated>{t.name}</Text>
                <Text fontSize="2xs" color="gray.400" flexShrink={0}>{t.slides.length}d</Text>
              </HStack>
            </Box>
          ))}
        </HStack>
      </Card>

      {noSlides > 0 && (
        <HStack bg={C.amberBg} border="1px solid" borderColor={C.amberBorder} borderRadius="md" px="3" py="2" my="4" gap="2"
          cursor="pointer" onClick={() => setOnlyEmpty(!onlyEmpty)}
          title={onlyEmpty ? 'Cliquer pour tout afficher' : 'Cliquer pour n\'afficher que ces présentations'}>
          <Box as={FiAlertCircle} color="#d97706" fontSize="sm" />
          <Text fontSize="sm" color={C.amberText} flex="1">
            {noSlides} présentation(s) sans diapositive — ajoutez du contenu ou mettez-les à la corbeille
          </Text>
          <Text fontSize="xs" color={C.amberText} fontWeight="600">
            {onlyEmpty ? 'Tout afficher' : 'Les afficher'}
          </Text>
        </HStack>
      )}

      <HStack gap="2" mb="4" mt="4">
        <Tip label="Présentations affichées — cliquer pour tout réafficher (onglet « Toutes », sans filtre)">
          <Tag color={onlyEmpty || tab !== 'Toutes' || q ? 'gray' : 'blue'} cursor="pointer"
            onClick={() => { setTab('Toutes'); setQ(''); setOnlyEmpty(false) }}>
            <FiMonitor style={{ marginRight: 4 }} />{list.length} présentation(s)
          </Tag>
        </Tip>
        <Tip label="Total de diapositives — cliquer pour trier par nombre de diapositives">
          <Tag color={sort === 'slides' ? 'blue' : 'gray'} cursor="pointer"
            onClick={() => setSort(sort === 'slides' ? 'recent' : 'slides')}>
            <FiLayers style={{ marginRight: 4 }} />{slideTotal} diapositive(s)
          </Tag>
        </Tip>
        {draftCount > 0 && (
          <Tip label="Présentations en brouillon — cliquer pour les afficher">
            <Tag color={tab === 'Brouillons' ? 'amber' : 'gray'} cursor="pointer"
              onClick={() => { setTab('Brouillons'); setOnlyEmpty(false) }}>
              <FiFileText style={{ marginRight: 4 }} />{draftCount} brouillon(s)
            </Tag>
          </Tip>
        )}
        {noSlides > 0 && (
          <Tip label="Présentations vides (aucune diapositive) — cliquer pour les afficher / tout afficher">
            <Tag color={onlyEmpty ? 'amber' : 'gray'} cursor="pointer"
              onClick={() => setOnlyEmpty(!onlyEmpty)}>
              <FiAlertCircle style={{ marginRight: 4 }} />{noSlides} sans diapo
            </Tag>
          </Tip>
        )}
        {testCount > 0 && (
          <Tip label="Présentations de test/démo — mettre à la corbeille">
            <Text fontSize="xs" color={C.amberText} cursor="pointer" onClick={() => setModal({ kind: 'clean' })}>
              <FiAlertTriangle style={{ display: 'inline' }} /> Nettoyer ({testCount})
            </Text>
          </Tip>
        )}
      </HStack>

      <HStack gap="2" mb="5" flexWrap="wrap">
        <Box flex="1" minW="200px">
          <SearchInput w="100%" placeholder="Rechercher une présentation…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </Box>
        <HStack gap="1.5">
          {TABS.map((t) => (
            <Button key={t} size="xs" variant={tab === t ? 'solid' : 'outline'} borderRadius="full"
              aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</Button>
          ))}
        </HStack>
        <Select h="30px" w="auto" px="3" fontSize="xs" borderRadius="full" aria-label="Trier les présentations"
          value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Tri : Plus récent</option>
          <option value="slides">Tri : Plus de diapos</option>
          <option value="name">Tri : Nom A→Z</option>
        </Select>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 4 }} gap="5">
        {list.map((p) => {
          const [tagColor, tagLabel] = STATUS_TAG[p.status] || STATUS_TAG.draft
          return (
            <Card key={p.id} _hover={{ borderColor: 'blue.300' }}
              position="relative" zIndex={menuFor === p.id ? 30 : 'auto'}
              cursor="pointer" onClick={() => setModal({ kind: 'detail', pres: p })}>
              {/* overflow:hidden ici (pas sur la carte) : coins arrondis de la
                  couverture sans couper le menu ⋯ qui s'ouvre vers le haut */}
              <Box position="relative" overflow="hidden" borderTopRadius="xl">
                {covers[p.id] ? (
                  covers[p.id].startsWith('http') ? (
                    <Box as="img" src={covers[p.id]} w="100%" aspectRatio="16/9" objectFit="cover" display="block" />
                  ) : (
                    <PhotoImg storagePath={covers[p.id]} ratio="16/9" />
                  )
                ) : (
                  <Center bg="gray.100" aspectRatio="16/9" color="gray.400">
                    <Box as={FiType} fontSize="22px" />
                  </Center>
                )}
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
                  <Tip label="Présenter en plein écran">
                    <IconBtn I={FiPlay} label="Présenter" onClick={() => present(p)} />
                  </Tip>
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
                    <MenuDropdown open={menuFor === p.id} onClose={() => setMenuFor(null)} minW="210px">
                        <MenuItem icon={FiPlay} label="Présenter"
                          onClick={() => { setMenuFor(null); present(p) }} />
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
                    </MenuDropdown>
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

      {/* ---- création ---- */}
      <Modal open={modal?.kind === 'new'} onClose={() => setModal(null)}
        title="Nouvelle présentation"
        subtitle="La présentation sera créée en brouillon"
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
            <option value="archived">Archivé</option>
          </Select>
        </Field>
      </Modal>

      {/* ---- galerie de modèles dentaires (façon Canva) ---- */}
      <TemplateGalleryModal open={modal?.kind === 'gallery'} dossiers={dossiers} busy={busy}
        initialTpl={modal?.initialTpl} initialDossier={modal?.initialDossier}
        onClose={() => setModal(null)} onCreate={createFromTemplate} onBlank={openNew} />

      {/* ---- mode Présenter (plein écran) — Échap revient au contexte ---- */}
      {modal?.kind === 'present' && (
        <PresentMode slides={modal.slides} title={modal.pres?.name}
          onClose={() => setModal(modal.back || null)} />
      )}

      {/* ---- éditeur de diapositives (façon Canva) ---- */}
      <EditorModal modal={modal} wsId={wsId} onClose={() => setModal(null)}
        onAdd={(insertAt) => setModal({ kind: 'add', pres: modal.pres, insertAt,
          back: { kind: 'detail', pres: modal.pres, focus: insertAt } })}
        onPresent={(slides) => setModal({ kind: 'present', pres: modal.pres, slides, back: { kind: 'detail', pres: modal.pres } })} />

      {/* ---- ajouter une diapositive ---- */}
      <AddSlideModal modal={modal} wsId={wsId}
        onClose={() => setModal(modal?.back || null)}
        onDone={() => { reload(); setModal(modal?.back || null) }} />

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

// ---- Éditeur de présentation façon Canva --------------------------------------
// Toile centrale (rendu réel 16:9 de la diapo), filmstrip glissable en bas
// (« + » insère à cette position), panneau de propriétés à droite.

// Toile centrale : canevas d'éléments libres — sélection, déplacement,
// redimensionnement à la souris comme sur PowerPoint/Canva.
function SlideCanvas({ s, selEl, onSelectEl, onEls }) {
  if (!s) return null
  return (
    <Box aspectRatio="16/9" w="100%" borderRadius="lg" overflow="hidden" position="relative"
      bg={s.type === 'text' ? '#1e3a5f' : '#0b1120'} boxShadow="lg">
      <SlideElements els={slideElements(s)} editing sel={selEl}
        onSelect={onSelectEl} onEls={onEls}
        emptyHint={{ icon: s.type === 'video' ? FiVideo : FiImage, label: 'Posez des éléments avec les boutons « + » ci-dessous' }} />
    </Box>
  )
}

// Miniature du filmstrip — mêmes éléments, réduits automatiquement (cqh).
function SlideThumb({ s }) {
  return (
    <Box position="relative" aspectRatio="16/9" borderRadius="sm" overflow="hidden"
      bg={s.type === 'text' ? '#1e3a5f' : '#0f172a'}>
      <SlideElements els={slideElements(s)} />
    </Box>
  )
}

const EL_SIZES = [
  ['xs', 'Mini'], ['sm', 'Petit'], ['md', 'Moyen'], ['lg', 'Grand'], ['xl', 'Titre'],
]
const EL_SIZE_CQH = { xs: 2.5, sm: 3.5, md: 5, lg: 7.5, xl: 11 }
const EL_COLORS = ['#f8fafc', '#94a3b8', '#0f172a', '#3b82f6', '#0d9488', '#f59e0b', '#ef4444']
const EL_FILLS = ['#0d9488', '#3b82f6', '#7c3aed', '#f59e0b', '#ef4444', '#0f172a', '#ffffff']

function sizeKeyOf(el) {
  const v = el.size || 5
  return Object.entries(EL_SIZE_CQH).reduce((best, [k, x]) => (Math.abs(x - v) < Math.abs(EL_SIZE_CQH[best] - v) ? k : best), 'md')
}

// Panneau de propriétés d'un élément sélectionné sur la toile.
function ElementPanel({ el, busy, onPatch, onOrder, onDup, onDel, onBack, onPickImg }) {
  const set = (p) => onPatch(el.id, p, true)
  const Swatch = ({ value, cur, onPick }) => (
    <Box as="button" w="18px" h="18px" borderRadius="sm" cursor="pointer" flexShrink={0}
      bg={value} border="2px solid" aria-label={`Couleur ${value}`}
      borderColor={cur === value ? C.primary : 'gray.300'} onClick={() => onPick(value)} />
  )
  return (
    <VStack align="stretch" gap="3">
      <HStack justify="space-between">
        <Button size="xs" variant="ghost" px="1" fontSize="2xs" color="gray.500" onClick={onBack}>
          ‹ Diapositive
        </Button>
        <Tag color="gray">
          {el.t === 'text' ? 'Texte' : el.t === 'img' ? 'Image' : el.t === 'shape' ? 'Forme' : 'Vidéo'}
        </Tag>
      </HStack>
      {el.t === 'text' && (
        <>
          <Field label="Contenu">
            <Box as="textarea" rows="3" w="100%" fontSize="xs" px="2" py="1.5"
              border="1px solid" borderColor={C.cardBorder} borderRadius="md"
              value={el.text || ''} autoFocus
              onChange={(e) => onPatch(el.id, { text: e.target.value }, false)}
              onBlur={() => onPatch(el.id, {}, true)} />
          </Field>
          <HStack gap="1">
            {EL_SIZES.map(([k, l]) => (
              <Button key={k} size="xs" variant={sizeKeyOf(el) === k ? 'solid' : 'outline'}
                fontSize="2xs" px="1.5" onClick={() => set({ size: EL_SIZE_CQH[k] })}>{l}</Button>
            ))}
          </HStack>
          <HStack gap="1.5">
            {EL_COLORS.map((c) => <Swatch key={c} value={c} cur={el.color} onPick={(v) => set({ color: v })} />)}
          </HStack>
          <HStack gap="1">
            {[['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']].map(([a, l]) => (
              <Button key={a} size="xs" variant={(el.align || 'left') === a ? 'solid' : 'outline'}
                fontSize="2xs" flex="1" onClick={() => set({ align: a })}>{l}</Button>
            ))}
          </HStack>
          <Button size="xs" variant={el.bold ? 'solid' : 'outline'} fontSize="2xs"
            onClick={() => set({ bold: !el.bold })}>Gras</Button>
        </>
      )}
      {el.t === 'img' && (
        <>
          <HStack gap="1">
            <Button size="xs" variant={(el.fit || 'contain') === 'contain' ? 'solid' : 'outline'}
              fontSize="2xs" flex="1" onClick={() => set({ fit: 'contain' })}>Ajuster</Button>
            <Button size="xs" variant={el.fit === 'cover' ? 'solid' : 'outline'}
              fontSize="2xs" flex="1" onClick={() => set({ fit: 'cover' })}>Remplir</Button>
          </HStack>
          <Button size="xs" variant={el.radius ? 'solid' : 'outline'} fontSize="2xs"
            onClick={() => set({ radius: !el.radius })}>Coins arrondis</Button>
          <Button size="xs" variant="outline" onClick={onPickImg}>
            <FiImage /> Changer l'image
          </Button>
        </>
      )}
      {el.t === 'shape' && (
        <>
          <Text fontSize="2xs" color="gray.500">Remplissage</Text>
          <HStack gap="1.5" flexWrap="wrap">
            {EL_FILLS.map((c) => <Swatch key={c} value={c} cur={el.fill} onPick={(v) => set({ fill: v })} />)}
          </HStack>
          <Button size="xs" variant={el.radius ? 'solid' : 'outline'} fontSize="2xs"
            onClick={() => set({ radius: !el.radius })}>Coins arrondis</Button>
        </>
      )}
      <Field label="Ordre de superposition">
        <HStack gap="1">
          <Button size="xs" variant="outline" flex="1" fontSize="2xs" disabled={busy}
            onClick={() => onOrder(el.id, -1)}><FiChevronUp /> Arrière</Button>
          <Button size="xs" variant="outline" flex="1" fontSize="2xs" disabled={busy}
            onClick={() => onOrder(el.id, 1)}><FiChevronDown /> Avant</Button>
        </HStack>
      </Field>
      <Field label={`Rotation ${el.rot ? `${Math.round(el.rot)}°` : ''}`}>
        <HStack gap="1">
          <Button size="xs" variant="outline" flex="1" fontSize="2xs"
            onClick={() => set({ rot: (((el.rot || 0) - 15) % 360 + 360) % 360 })}>−15°</Button>
          <Button size="xs" variant="outline" flex="1" fontSize="2xs" disabled={!el.rot}
            onClick={() => set({ rot: 0 })}>Réinit.</Button>
          <Button size="xs" variant="outline" flex="1" fontSize="2xs"
            onClick={() => set({ rot: ((el.rot || 0) + 15) % 360 })}>+15°</Button>
        </HStack>
      </Field>
      <HStack gap="1.5">
        <Button size="xs" variant="outline" flex="1" disabled={busy}
          onClick={() => onDup(el.id)}><FiCopy /> Dupliquer</Button>
        <Button size="xs" variant="outline" flex="1" color="red.500" disabled={busy}
          onClick={() => onDel(el.id)}><FiTrash2 /> Supprimer</Button>
      </HStack>
      <Text fontSize="2xs" color="gray.400">
        Position {Math.round(el.x)},{Math.round(el.y)} · Taille {Math.round(el.w)}×{Math.round(el.h)}%
      </Text>
    </VStack>
  )
}

function EditorModal({ modal, wsId, onClose, onAdd, onPresent }) {
  const p = modal?.pres
  const [slides, setSlides] = useState([])
  const [sel, setSel] = useState(0)
  const [busy, setBusy] = useState(false)
  const [rmSlide, setRmSlide] = useState(null)
  const [form, setForm] = useState({ title: '', text: '' })
  const [dragFrom, setDragFrom] = useState(null)
  const [dropAt, setDropAt] = useState(null)
  const [pool, setPool] = useState(null)          // 'photo'|'montage'|'video'
  const [poolMode, setPoolMode] = useState('slide') // 'slide' | 'el-add' | 'el-swap'
  const [poolItems, setPoolItems] = useState([])
  const [selEl, setSelEl] = useState(null)        // id de l'élément sélectionné sur la toile
  const [hist, setHist] = useState([])            // annuler : pile d'états d'éléments
  const [future, setFuture] = useState([])        // rétablir

  const load = () => p && listPresentationSlides(p.id).then(setSlides)
  useEffect(() => {
    if (modal?.kind === 'detail' && p) { setSel(modal.focus ?? 0); setPool(null); load() }
  }, [modal]) // eslint-disable-line
  const cur = slides[Math.min(sel, Math.max(0, slides.length - 1))] || null
  const els = cur ? slideElements(cur) : []
  const curEl = els.find((e) => e.id === selEl) || null
  useEffect(() => {
    setForm({ title: cur?.title || '', text: cur?.text_content || '' })
    setSelEl(null); setHist([]); setFuture([])
  }, [sel, cur?.id]) // eslint-disable-line
  useEffect(() => {
    if (!pool || !wsId) { setPoolItems([]); return }
    const fns = {
      photo: () => listPhotos(wsId, { limit: 60 }),
      montage: () => listMontages(wsId),
      video: () => listVideoProjects(wsId),
    }
    fns[pool]().then(setPoolItems)
  }, [pool, wsId])

  // ---- éléments libres sur la diapo (persistés en JSON dans `notes`) --------
  // commit=false → état local pendant le geste ; commit=true → historique +
  // sauvegarde REST. Undo/redo mémorisent les états de la diapo courante.
  const persistEls = (next) => {
    if (!cur) return
    const notes = layoutNotes(next)
    setSlides((list) => list.map((x) => (x.id === cur.id ? { ...x, notes } : x)))
    updatePresentationSlide(cur.id, { notes })
  }
  const applyEls = (next, commit) => {
    if (!cur) return
    if (!commit) {
      setSlides((list) => list.map((x) => (x.id === cur.id ? { ...x, notes: layoutNotes(next) } : x)))
      return
    }
    setHist((h) => [...h.slice(-49), els])
    setFuture([])
    persistEls(next)
  }
  const undo = () => {
    if (!hist.length) return
    setFuture((f) => [els, ...f])
    persistEls(hist[hist.length - 1])
    setHist((h) => h.slice(0, -1))
  }
  const redo = () => {
    if (!future.length) return
    setHist((h) => [...h, els])
    persistEls(future[0])
    setFuture((f) => f.slice(1))
  }
  const patchEl = (id, p_, commit) =>
    applyEls(els.map((e) => (e.id === id ? { ...e, ...p_ } : e)), commit)
  const addEl = (el) => { applyEls([...els, el], true); setSelEl(el.id) }
  const delEl = (id) => { applyEls(els.filter((e) => e.id !== id), true); setSelEl(null) }
  const dupEl = (id) => {
    const e = els.find((x) => x.id === id)
    if (!e) return
    const { id: _i, ...rest } = e
    addEl(newEl({ ...rest, x: Math.min(92, e.x + 4), y: Math.min(92, e.y + 4) }))
  }
  const orderEl = (id, d) => {
    const o = [...els].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    const i = o.findIndex((e) => e.id === id); const j = i + d
    if (j < 0 || j >= o.length) return
    const zi = o[i].z ?? i; o[i].z = o[j].z ?? j; o[j].z = zi
    applyEls(o, true)
  }
  // Ctrl+Z / Ctrl+Y (ou Ctrl+Maj+Z) — ignoré pendant la saisie dans un champ
  // et quand l'éditeur est fermé.
  useEffect(() => {
    const key = (e) => {
      if (!(e.ctrlKey || e.metaKey) || modal?.kind !== 'detail') return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }) // eslint-disable-line
  if (!p) return null

  // Renumérote toutes les positions après un changement structurel.
  const persistOrder = async (next) => {
    setSlides(next); setBusy(true)
    for (const [i, s] of next.entries()) {
      if (s.position !== i) await updatePresentationSlide(s.id, { position: i })
    }
    setBusy(false)
  }
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= slides.length || busy) return
    const next = [...slides]; [next[i], next[j]] = [next[j], next[i]]
    if (sel === i) setSel(j); else if (sel === j) setSel(i)
    persistOrder(next)
  }
  const onDrop = (to) => {
    setDropAt(null)
    if (dragFrom == null || dragFrom === to) { setDragFrom(null); return }
    const next = [...slides]
    const [m] = next.splice(dragFrom, 1)
    next.splice(to, 0, m)
    setSel(to); setDragFrom(null)
    persistOrder(next)
  }
  const saveFields = async () => {
    if (!cur) return
    await updatePresentationSlide(cur.id, {
      title: form.title.trim() || null,
      text_content: form.text.trim() || null,
    })
    load()
  }
  const duplicateSlide = async () => {
    if (!cur || busy) return
    setBusy(true)
    for (const s of slides.slice(sel + 1)) {
      await updatePresentationSlide(s.id, { position: (s.position ?? 0) + 1 })
    }
    await addPresentationSlide(p.id, {
      position: (cur.position ?? sel) + 1, type: cur.type, title: cur.title,
      text_content: cur.text_content, media_url: cur.media_url,
      before_url: cur.before_url, after_url: cur.after_url,
      photo_id: cur.photo_id, montage_id: cur.montage_id,
      video_project_id: cur.video_project_id, timeline_photo_ids: cur.timeline_photo_ids,
      notes: cur.notes,
    })
    await load(); setSel(sel + 1); setBusy(false)
  }
  const removeSlide = async () => {
    if (!rmSlide) return
    setBusy(true)
    await removePresentationSlide(rmSlide)
    const next = slides.filter((s) => s.id !== rmSlide)
    setRmSlide(null)
    setSel((i) => Math.max(0, Math.min(i, next.length - 1)))
    await persistOrder(next)
    setBusy(false)
  }
  const replaceMedia = async (mediaId) => {
    if (!cur || !pool) return
    setBusy(true)
    await updatePresentationSlide(cur.id, {
      photo_id: pool === 'photo' ? mediaId : null,
      montage_id: pool === 'montage' ? mediaId : null,
      video_project_id: pool === 'video' ? mediaId : null,
      media_url: null,
    })
    setPool(null); await load(); setBusy(false)
  }

  const openPool = (kind, mode) => { setPool(kind); setPoolMode(mode) }
  const onPick = (m) => {
    const path = pool === 'photo' ? m.storage_path : m.export_url
    if (poolMode === 'slide') return replaceMedia(m.id)
    if (poolMode === 'el-swap' && selEl) patchEl(selEl, { path }, true)
    else if (pool === 'video') addEl(newEl({ t: 'video', x: 12, y: 12, w: 76, h: 76, url: m.media_url || m.export_url }))
    else if (path) addEl(newEl({ t: 'img', x: 12, y: 12, w: 76, h: 76, path, fit: 'contain' }))
    setPool(null)
  }

  const typeLabel = (t) => SLIDE_TYPES.find(([k]) => k === t)?.[1] || t
  const InsertBtn = ({ at }) => (
    <Center as="button" aria-label={`Insérer une diapositive à la position ${at + 1}`}
      w="18px" h="18px" flexShrink={0} borderRadius="full" fontSize="2xs"
      bg="gray.200" color="gray.500" cursor="pointer" opacity="0.7"
      _hover={{ bg: C.primary, color: '#fff', opacity: 1 }}
      onClick={() => onAdd?.(at)}>
      <FiPlus />
    </Center>
  )

  return (
    <Modal open={modal?.kind === 'detail'} onClose={onClose}
      title={p.name} subtitle={`${slides.length} diapositive(s) · modifiée ${ago(p.updated_at)}`}
      width="1150px"
      footer={<>
        <Text fontSize="2xs" color="gray.400" mr="auto" display={{ base: 'none', md: 'block' }}>
          Glissez les vignettes pour réordonner · « + » insère une diapo à cette position
        </Text>
        <Button variant="outline" size="sm" disabled={!slides.length}
          onClick={() => onPresent?.(slides)}>
          <FiPlay /> Présenter
        </Button>
        <PrimaryButton icon={FiPlus} onClick={() => onAdd?.(slides.length)}>
          Ajouter une diapositive
        </PrimaryButton>
      </>}>
      {!slides.length ? (
        <VStack py="6" gap="3" align="center">
          <Text fontSize="sm" color="gray.500">
            Aucune diapositive — ajoutez des photos, montages, vidéos ou diapos texte.
          </Text>
          <PrimaryButton icon={FiPlus} onClick={() => onAdd?.(0)}>Ajouter une diapositive</PrimaryButton>
        </VStack>
      ) : (
        <>
          <HStack align="stretch" gap="4">
            {/* toile centrale */}
            <Box flex="1" minW="0" bg="gray.50" border="1px solid" borderColor={C.cardBorder}
              borderRadius="lg" p="4">
              <SlideCanvas s={cur} selEl={selEl} onSelectEl={setSelEl} onEls={applyEls} />
              <HStack mt="3" justify="space-between" flexWrap="wrap" gap="2">
                {/* pose d'éléments sur la diapo, façon barre latérale Canva */}
                <HStack gap="1">
                  <Button size="xs" variant="outline" px="1.5" disabled={!hist.length}
                    aria-label="Annuler" title="Annuler (Ctrl+Z)" onClick={undo}>
                    <FiRotateCcw />
                  </Button>
                  <Button size="xs" variant="outline" px="1.5" disabled={!future.length}
                    aria-label="Rétablir" title="Rétablir (Ctrl+Y)" onClick={redo}>
                    <FiRotateCw />
                  </Button>
                  {[
                    [FiType, 'Texte', () => addEl(newEl({ t: 'text', x: 10, y: 42, w: 80, h: 16, text: 'Nouveau texte', size: 6, color: '#f8fafc', align: 'center' }))],
                    [FiImage, 'Photo', () => openPool('photo', 'el-add')],
                    [FiLayers, 'Montage', () => openPool('montage', 'el-add')],
                    [FiSquare, 'Forme', () => addEl(newEl({ t: 'shape', x: 35, y: 35, w: 30, h: 30, fill: '#3b82f6', radius: true }))],
                  ].map(([I, l, fn]) => (
                    <Button key={l} size="xs" variant="outline" fontSize="2xs" onClick={fn}>
                      <FiPlus /><Box as={I} />{l}
                    </Button>
                  ))}
                </HStack>
                <HStack gap="2">
                  <Button size="xs" variant="outline" disabled={sel === 0}
                    onClick={() => setSel(sel - 1)}><FiChevronUp style={{ transform: 'rotate(-90deg)' }} /> Préc.</Button>
                  <Text fontSize="xs" color="gray.500" fontVariantNumeric="tabular-nums">
                    {Math.min(sel, slides.length - 1) + 1} / {slides.length}
                  </Text>
                  <Button size="xs" variant="outline" disabled={sel >= slides.length - 1}
                    onClick={() => setSel(sel + 1)}>Suiv. <FiChevronDown style={{ transform: 'rotate(-90deg)' }} /></Button>
                </HStack>
              </HStack>
            </Box>
            {/* propriétés : élément sélectionné, sinon diapo */}
            <Box w="235px" flexShrink={0} overflowY="auto" maxH="430px" pr="1">
              {curEl ? (
                <ElementPanel el={curEl} busy={busy}
                  onPatch={patchEl} onOrder={orderEl} onDup={dupEl} onDel={delEl}
                  onBack={() => setSelEl(null)}
                  onPickImg={() => openPool('photo', 'el-swap')} />
              ) : (
            <VStack align="stretch" gap="3">
              <HStack justify="space-between">
                <Text fontSize="2xs" fontWeight="700" color="gray.500">
                  DIAPOSITIVE {Math.min(sel, slides.length - 1) + 1}
                </Text>
                <Tag color="gray">{typeLabel(cur?.type)}</Tag>
              </HStack>
              <HStack gap="1.5">
                <Button size="xs" variant="outline" flex="1" disabled={sel === 0 || busy}
                  aria-label="Monter la diapositive" onClick={() => move(sel, -1)}>
                  <FiChevronUp style={{ transform: 'rotate(-90deg)' }} /> Reculer
                </Button>
                <Button size="xs" variant="outline" flex="1" disabled={sel >= slides.length - 1 || busy}
                  aria-label="Descendre la diapositive" onClick={() => move(sel, 1)}>
                  <FiChevronDown style={{ transform: 'rotate(-90deg)' }} /> Avancer
                </Button>
              </HStack>
              <Field label="Titre">
                <Input size="sm" fontSize="xs" value={form.title}
                  placeholder="Titre de la diapositive"
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  onBlur={saveFields} />
              </Field>
              <Field label={cur?.type === 'text' ? 'Texte' : 'Légende (optionnel)'}>
                <Box as="textarea" rows="3" w="100%" fontSize="xs" px="2" py="1.5"
                  border="1px solid" borderColor={C.cardBorder} borderRadius="md"
                  placeholder="Texte affiché sur la diapositive…"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  onBlur={saveFields} />
              </Field>
              {cur && cur.type !== 'text' && (
                <Button size="xs" variant="outline"
                  onClick={() => pool ? setPool(null) : openPool(cur.type === 'montage' ? 'montage' : cur.type === 'video' ? 'video' : 'photo', 'slide')}>
                  <FiImage /> {pool ? 'Fermer le choix' : 'Remplacer le média'}
                </Button>
              )}
              <HStack gap="1.5">
                <Button size="xs" variant="outline" flex="1" disabled={busy}
                  onClick={duplicateSlide}><FiCopy /> Dupliquer</Button>
                <Button size="xs" variant="outline" flex="1" color="red.500" disabled={busy}
                  onClick={() => setRmSlide(cur.id)}><FiTrash2 /> Supprimer</Button>
              </HStack>
            </VStack>
              )}
            </Box>
          </HStack>

          {/* remplacement du média */}
          {pool && cur && (
            <Box mt="3" border="1px solid" borderColor={C.cardBorder} borderRadius="md" p="2">
              <Text fontSize="2xs" fontWeight="600" color="gray.500" mb="2">
                {poolMode === 'el-swap' ? 'Choisir la nouvelle image de l’élément'
                  : poolMode === 'el-add' ? `Choisir ${pool === 'montage' ? 'un montage' : 'une photo'} à poser sur la diapo`
                  : `Choisir ${pool === 'photo' ? 'une photo' : pool === 'montage' ? 'un montage' : 'une vidéo'} de remplacement`}
              </Text>
              <Box maxH="170px" overflowY="auto">
                {!poolItems.length ? (
                  <Text fontSize="xs" color="gray.400" py="4" textAlign="center">Aucun élément disponible</Text>
                ) : (
                  <SimpleGrid columns={8} gap="2">
                    {poolItems.map((m) => {
                      const path = pool === 'photo' ? m.storage_path : m.export_url
                      return (
                        <Box key={m.id} borderRadius="md" overflow="hidden" cursor="pointer"
                          border="2px solid" borderColor="transparent"
                          _hover={{ borderColor: C.primary }} onClick={() => onPick(m)}>
                          {path ? <PhotoImg storagePath={path} ratio="1" />
                            : <Center bg="gray.100" aspectRatio="1"><Box as={FiLayers} color="gray.400" /></Center>}
                        </Box>
                      )
                    })}
                  </SimpleGrid>
                )}
              </Box>
            </Box>
          )}

          {/* filmstrip : glisser-déposer + insertion « + » entre les diapos */}
          <HStack mt="4" gap="1.5" overflowX="auto" py="1" align="center" minH="74px">
            {slides.map((s, i) => (
              <HStack key={s.id} gap="1.5" align="center" flexShrink={0}>
                <InsertBtn at={i} />
                <Box position="relative" w="96px" flexShrink={0} cursor="grab" role="group"
                  data-slide-title={s.title || s.type}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => { e.preventDefault(); setDropAt(i) }}
                  onDragLeave={() => setDropAt((d) => (d === i ? null : d))}
                  onDrop={() => onDrop(i)}
                  onDragEnd={() => { setDragFrom(null); setDropAt(null) }}
                  border="2px solid"
                  borderColor={i === sel ? C.primary : dropAt === i && dragFrom != null ? 'blue.300' : 'transparent'}
                  borderRadius="md" opacity={dragFrom === i ? 0.4 : 1}
                  _hover={{ borderColor: i === sel ? C.primary : 'gray.300' }}
                  onClick={() => setSel(i)}>
                  <SlideThumb s={s} />
                  <Center position="absolute" top="0.5" left="0.5" minW="14px" h="14px" px="0.5"
                    borderRadius="sm" bg="rgba(15,23,42,0.75)" color="#fff" fontSize="8px" fontWeight="700">
                    {i + 1}
                  </Center>
                  {i === sel && (
                    <Center position="absolute" top="0.5" right="0.5" w="14px" h="14px"
                      borderRadius="full" bg={C.primary} color="#fff" fontSize="8px">
                      <FiCheck />
                    </Center>
                  )}
                  <Center as="button" aria-label="Retirer la diapositive"
                    position="absolute" bottom="0.5" right="0.5" w="14px" h="14px"
                    borderRadius="full" bg="rgba(15,23,42,0.75)" color="#fca5a5"
                    fontSize="8px" cursor="pointer" opacity="0"
                    _groupHover={{ opacity: 1 }}
                    onClick={(e) => { e.stopPropagation(); setRmSlide(s.id) }}>
                    <FiX />
                  </Center>
                </Box>
              </HStack>
            ))}
            {/* ajouter en fin de filmstrip */}
            <Center as="button" aria-label="Ajouter une diapositive" flexShrink={0}
              w="56px" aspectRatio="16/9" borderRadius="sm" border="1.5px dashed"
              borderColor="gray.300" color="gray.400" cursor="pointer"
              _hover={{ borderColor: C.primary, color: C.primary }}
              onClick={() => onAdd?.(slides.length)}>
              <FiPlus />
            </Center>
          </HStack>
        </>
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
    const cur = await listPresentationSlides(p.id)
    const pos = modal?.insertAt ?? cur.length
    if (pos < cur.length) {
      for (const s of cur) {
        if ((s.position ?? 0) >= pos) await updatePresentationSlide(s.id, { position: (s.position ?? 0) + 1 })
      }
    }
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

// ---- Galerie de modèles dentaires (façon Canva) --------------------------------
// L'utilisateur choisit une maquette, un dossier patient optionnel, et les
// diapositives sont pré-remplies avec les photos correspondant aux vues/étapes
// cliniques prévues par le modèle (approche SmileCloud).

// Génère les slides d'un modèle : associe chaque emplacement à la meilleure
// photo du dossier (vue puis étape cliniques), texte indicatif si rien ne colle.
async function buildTemplateSlides(wsId, tpl, dossierId, presName) {
  const [photos, montages] = dossierId
    ? await Promise.all([listPhotosByDossier(dossierId, { limit: 500 }), listMontages(wsId, { limit: 200 })])
    : [[], []]
  const patientMontages = (montages || []).filter((m) => m.dossier_id === dossierId)
  const used = new Set()
  const lbl = (p) => clinicalLabels(p)
  const pick = (view, stage) => {
    const cand = photos.filter((p) => !used.has(p.id))
    const found = cand.find((x) => view && lbl(x).view === view && (!stage || lbl(x).stage === stage))
      || cand.find((x) => view && lbl(x).view === view)
      || cand.find((x) => stage && lbl(x).stage === stage)
      || null
    if (found) used.add(found.id)
    return found
  }
  const out = []
  const push = (fields) => out.push({ position: out.length, ...fields })
  const photoSlide = (title, photo, hint) => photo
    ? push({ type: 'photo', title, photo_id: photo.id })
    : push({ type: 'text', title, text_content: hint || 'Ajoutez une photo du dossier patient pour compléter cette diapositive.' })
  for (const s of tpl.slides) {
    if (s.kind === 'title') push({ type: 'text', title: presName, text_content: tpl.desc })
    else if (s.kind === 'text') push({ type: 'text', title: s.title, text_content: s.text })
    else if (s.kind === 'montage') {
      const m = patientMontages[0]
      m ? push({ type: 'montage', title: s.title, montage_id: m.id })
        : push({ type: 'text', title: s.title, text_content: 'Ajoutez un montage avant/après du dossier patient.' })
    } else if (s.kind === 'all') {
      BILAN_SLIDES.forEach(([view, title]) => photoSlide(title, pick(view), `Ajoutez la vue « ${title} ».`))
    } else photoSlide(s.title, pick(s.view, s.stage))
  }
  return out
}

// Aperçu stylisé d'un modèle — fausse diapo colorée façon vignette Canva.
function TemplatePreview({ tpl }) {
  const ICONS = { smile: FiSmile, plan: FiFileText, compare: FiLayers, learn: FiBook, case: FiImage, lab: FiTool, grid: FiGrid }
  const I = ICONS[tpl.preview] || FiMonitor
  return (
    <Box aspectRatio="16/10" borderRadius="md" overflow="hidden" position="relative"
      bg={tpl.accent} p="10%">
      <Box h="8%" w="62%" bg="rgba(255,255,255,0.85)" borderRadius="sm" mb="10%" />
      <HStack gap="6%" h="52%">
        <Center flex="1" h="100%" bg="rgba(255,255,255,0.22)" borderRadius="sm">
          <Box as={I} color="rgba(255,255,255,0.9)" fontSize="lg" />
        </Center>
        <Center flex="1" h="100%" bg="rgba(255,255,255,0.14)" borderRadius="sm" />
      </HStack>
      <Box position="absolute" bottom="8%" left="10%" right="10%" h="6%"
        bg="rgba(255,255,255,0.5)" borderRadius="sm" />
    </Box>
  )
}

// ---- « Créer un design » — reproduction du modal d'accueil de Canva ---------
// Sidebar de catégories à gauche, recherche en haut, actions rapides en
// pastilles rondes, puis grande grille de cartes « Populaires ».

const DESIGN_CATS = [
  ['all', 'Pour vous', HiOutlineSparkles, '#8b5cf6'],
  ['patient', 'Pour le patient', FiSmile, '#f59e0b'],
  ['pro', 'Pro & laboratoire', FiTool, '#0d9488'],
]

// Actions rapides : raccourcis vers un modèle ou le document vierge.
const QUICK_ACTIONS = [
  { icon: FiGrid, accent: '#334155', label: 'Bilan complet', tpl: 'bilan' },
  { icon: FiLayers, accent: '#059669', label: 'Avant / Après', tpl: 'avant-apres' },
  { icon: FiFileText, accent: '#0ea5e9', label: 'Plan de traitement', tpl: 'plan' },
  { icon: FiMonitor, accent: '#7c3aed', label: 'Cas esthétique', tpl: 'esthetique' },
  { icon: FiPlus, accent: '#64748b', label: 'Document vierge', blank: true },
]

// Carte format façon Canva : tuile icône colorée + nom + format.
function DesignCard({ tpl, selected, onClick }) {
  const ICONS = { smile: FiSmile, plan: FiFileText, compare: FiLayers, learn: FiBook, case: FiImage, lab: FiTool, grid: FiGrid }
  const I = ICONS[tpl.preview] || FiMonitor
  return (
    <Box as="button" textAlign="left" cursor="pointer" role="button" aria-pressed={selected}
      onClick={onClick}>
      <Center aspectRatio="4/3" borderRadius="lg" bg="gray.50" border="2px solid"
        borderColor={selected ? C.primary : 'transparent'}
        _hover={{ borderColor: selected ? C.primary : 'gray.300' }}>
        <Center w="44%" aspectRatio="1" borderRadius="22%" bg={tpl.accent} color="#fff"
          fontSize="xl" boxShadow="sm">
          <Box as={I} />
        </Center>
      </Center>
      <Text fontSize="2xs" fontWeight="600" color={C.ink} mt="1.5" isTruncated>{tpl.name}</Text>
      <Text fontSize="2xs" color="gray.400" isTruncated>Présentation · 16:9 · {tpl.slides.length} diapos</Text>
    </Box>
  )
}

function TemplateGalleryModal({ open, dossiers, busy, initialTpl, initialDossier, onClose, onCreate, onBlank }) {
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')
  const [tpl, setTpl] = useState(null)
  const [name, setName] = useState('')
  const [dossierId, setDossierId] = useState('')
  useEffect(() => {
    if (open) { setCat('all'); setSearch(''); setTpl(initialTpl || null); setName(''); setDossierId(initialDossier || '') }
  }, [open]) // eslint-disable-line
  const needle = search.trim().toLowerCase()
  const list = PRESENTATION_TEMPLATES
    .filter((t) => cat === 'all' || t.cat === cat)
    .filter((t) => !needle || `${t.name} ${t.desc}`.toLowerCase().includes(needle))
  const dossierName = dossiers.find((d) => d.id === dossierId)?.name
  if (!open) return null
  const quick = (a) => {
    if (a.blank) { onBlank?.(); return }
    setTpl(PRESENTATION_TEMPLATES.find((t) => t.key === a.tpl) || null)
  }
  return (
    <Box position="fixed" inset="0" zIndex="60" bg="blackAlpha.500" display="flex"
      alignItems="center" justifyContent="center" p="4" onClick={onClose}>
      <Box bg="white" borderRadius="xl" w="100%" maxW="1000px" h="85vh" display="flex"
        flexDirection="column" overflow="hidden" boxShadow="xl"
        onClick={(e) => e.stopPropagation()}>
        {/* en-tête : titre + recherche + fermer (comme la capture Canva) */}
        <HStack px="6" pt="5" pb="4" gap="4" flexShrink={0}>
          <Text fontSize="lg" fontWeight="700" color={C.ink} flexShrink={0}>Créer un design</Text>
          <Input flex="1" fontSize="sm" borderRadius="full" px="5" h="38px"
            placeholder="Qu'aimeriez-vous créer ?"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <Box as="button" aria-label="Fermer" color="gray.400" p="1.5" borderRadius="full"
            cursor="pointer" _hover={{ color: 'gray.600', bg: 'gray.100' }} onClick={onClose}>
            <FiX />
          </Box>
        </HStack>
        <HStack flex="1" minH="0" align="stretch">
          {/* sidebar catégories */}
          <VStack w="170px" flexShrink={0} align="stretch" gap="0.5" px="4" pb="4" overflowY="auto">
            {DESIGN_CATS.map(([k, label, I, accent]) => (
              <HStack key={k} as="button" gap="2.5" px="2.5" py="2" borderRadius="lg"
                cursor="pointer" textAlign="left" aria-pressed={cat === k}
                bg={cat === k ? C.softBlue : 'transparent'}
                _hover={{ bg: cat === k ? C.softBlue : 'gray.50' }}
                onClick={() => setCat(k)}>
                <Center w="20px" h="20px" borderRadius="md" bg={accent} color="#fff" fontSize="9px">
                  <Box as={I} />
                </Center>
                <Text fontSize="xs" fontWeight={cat === k ? '600' : '400'} color={C.ink}>{label}</Text>
              </HStack>
            ))}
            <Box mt="auto" pt="4">
              <Text fontSize="2xs" color="gray.400" px="2.5">
                Les diapos se pré-remplissent avec les photos du dossier patient.
              </Text>
            </Box>
          </VStack>
          {/* contenu : actions rapides + populaires */}
          <Box flex="1" minW="0" overflowY="auto" px="6" pb="5">
            <Text fontSize="xs" fontWeight="700" color={C.ink} mb="3">Actions rapides</Text>
            <HStack gap="5" mb="6" flexWrap="wrap">
              {QUICK_ACTIONS.map((a) => (
                <VStack key={a.label} as="button" gap="1.5" cursor="pointer" w="64px"
                  onClick={() => quick(a)}>
                  <Center w="44px" h="44px" borderRadius="full" bg={a.accent} color="#fff"
                    fontSize="md" _hover={{ transform: 'scale(1.06)' }} transition="transform .15s">
                    <Box as={a.icon} />
                  </Center>
                  <Text fontSize="2xs" color={C.body} textAlign="center" lineHeight="1.2">{a.label}</Text>
                </VStack>
              ))}
            </HStack>
            <Text fontSize="xs" fontWeight="700" color={C.ink} mb="3">
              {needle ? `Résultats pour « ${search.trim()} »` : 'Populaires'}
            </Text>
            <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
              {list.map((t) => (
                <DesignCard key={t.key} tpl={t} selected={tpl?.key === t.key}
                  onClick={() => setTpl(t)} />
              ))}
            </SimpleGrid>
            {!list.length && (
              <Text fontSize="sm" color="gray.400" py="8" textAlign="center">
                Aucun modèle ne correspond — essayez un autre mot.
              </Text>
            )}
          </Box>
        </HStack>
        {/* pied : paramètres de création (visible dès qu'un modèle est choisi) */}
        <HStack px="6" py="3" borderTop="1px solid" borderColor="gray.100"
          justify="space-between" flexShrink={0} gap="3" flexWrap="wrap">
          <HStack gap="2" flex="1" flexWrap="wrap">
            {tpl ? (
              <>
                <Text fontSize="xs" color="gray.500" flexShrink={0}>
                  <Text as="span" fontWeight="700" color={C.ink}>{tpl.name}</Text>
                  {' '}— {tpl.slides.length} diapos prévues
                </Text>
                <Input w="230px" size="sm" fontSize="xs" autoFocus
                  placeholder={`Nom — ex. ${tpl.name.toLowerCase()} du cabinet`}
                  value={name} onChange={(e) => setName(e.target.value)} />
                <Select w="220px" h="32px" fontSize="xs" aria-label="Dossier patient"
                  value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
                  <option value="">Sans patient (diapos vides)</option>
                  {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </>
            ) : (
              <Text fontSize="xs" color="gray.400">Choisissez un modèle ou une action rapide</Text>
            )}
          </HStack>
          <PrimaryButton onClick={() => onCreate(tpl, name, dossierId)} disabled={!tpl || busy}>
            {busy ? 'Création…' : 'Créer la présentation'}
          </PrimaryButton>
        </HStack>
        {tpl && dossierName && (
          <Text fontSize="2xs" color={C.primary} px="6" pb="3" flexShrink={0}>
            Les photos de « {dossierName} » seront placées automatiquement selon leurs vues et étapes cliniques.
          </Text>
        )}
      </Box>
    </Box>
  )
}


