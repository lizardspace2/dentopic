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
            <Card key={p.id} overflow="hidden" _hover={{ borderColor: 'blue.300' }}
              cursor="pointer" onClick={() => setModal({ kind: 'detail', pres: p })}>
              <Box position="relative">
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
        onClose={() => setModal(null)} onCreate={createFromTemplate} />

      {/* ---- mode Présenter (plein écran) — Échap revient au contexte ---- */}
      {modal?.kind === 'present' && (
        <PresentMode slides={modal.slides} title={modal.pres?.name}
          onClose={() => setModal(modal.back || null)} />
      )}

      {/* ---- détail : diapositives ---- */}
      <DetailModal modal={modal} onClose={() => setModal(null)}
        onAdd={() => setModal({ kind: 'add', pres: modal.pres })}
        onPresent={(slides) => setModal({ kind: 'present', pres: modal.pres, slides, back: { kind: 'detail', pres: modal.pres } })} />

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

function DetailModal({ modal, onClose, onAdd, onPresent }) {
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
  // Réordonne : échange la position de la diapo i avec sa voisine.
  const move = async (i, d) => {
    const j = i + d
    if (j < 0 || j >= slides.length || busy) return
    const a = slides[i], b = slides[j]
    const next = [...slides]; next[i] = b; next[j] = a
    setSlides(next)
    setBusy(true)
    await updatePresentationSlide(a.id, { position: b.position })
    await updatePresentationSlide(b.id, { position: a.position })
    setBusy(false)
  }
  return (
    <Modal open={modal?.kind === 'detail'} onClose={onClose}
      title={p.name} subtitle={`${slides.length} diapositive(s) · modifiée ${ago(p.updated_at)}`}
      width="560px"
      footer={<>
        <Button variant="outline" size="sm" disabled={!slides.length}
          onClick={() => onPresent?.(slides)}>
          <FiPlay /> Présenter
        </Button>
        <PrimaryButton icon={FiPlus} onClick={onAdd}>Ajouter une diapositive</PrimaryButton>
      </>}>
      {!slides.length ? (
        <Text fontSize="sm" color="gray.500" py="3">
          Aucune diapositive — ajoutez des photos, montages, vidéos ou diapos texte.
        </Text>
      ) : (
        <VStack align="stretch" gap="2" maxH="400px" overflowY="auto">
          {slides.map((s, i) => (
            <HStack key={s.id} data-slide-title={s.title || s.type}
              border="1px solid" borderColor={C.cardBorder} borderRadius="md" px="3" py="2">
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
              <VStack gap="0" flexShrink={0}>
                <Box as="button" aria-label="Monter la diapositive" color="gray.400"
                  fontSize="xs" cursor={i === 0 ? 'default' : 'pointer'}
                  opacity={i === 0 ? 0.3 : 1} _hover={{ color: C.primary }}
                  onClick={() => move(i, -1)}><FiChevronUp /></Box>
                <Box as="button" aria-label="Descendre la diapositive" color="gray.400"
                  fontSize="xs" cursor={i === slides.length - 1 ? 'default' : 'pointer'}
                  opacity={i === slides.length - 1 ? 0.3 : 1} _hover={{ color: C.primary }}
                  onClick={() => move(i, 1)}><FiChevronDown /></Box>
              </VStack>
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

const TPL_CATS = [
  ['all', 'Tous les modèles'],
  ['patient', 'Pour le patient'],
  ['pro', 'Pro & laboratoire'],
]

function TemplateGalleryModal({ open, dossiers, busy, initialTpl, initialDossier, onClose, onCreate }) {
  const [cat, setCat] = useState('all')
  const [tpl, setTpl] = useState(null)
  const [name, setName] = useState('')
  const [dossierId, setDossierId] = useState('')
  useEffect(() => {
    if (open) { setCat('all'); setTpl(initialTpl || null); setName(''); setDossierId(initialDossier || '') }
  }, [open]) // eslint-disable-line
  const list = PRESENTATION_TEMPLATES.filter((t) => cat === 'all' || t.cat === cat)
  const dossierName = dossiers.find((d) => d.id === dossierId)?.name
  return (
    <Modal open={open} onClose={onClose} title="Choisir un modèle" width="880px"
      subtitle="Les diapositives se pré-remplissent avec les photos du dossier patient"
      footer={<>
        <Text fontSize="xs" color="gray.500" mr="auto">
          {tpl ? `${tpl.name} — ${tpl.slides.length} diapositive(s) prévues` : 'Choisissez un modèle'}
        </Text>
        <PrimaryButton onClick={() => onCreate(tpl, name, dossierId)} disabled={!tpl || busy}>
          {busy ? 'Création…' : 'Créer la présentation'}
        </PrimaryButton>
      </>}>
      <HStack gap="2" mb="4" flexWrap="wrap">
        {TPL_CATS.map(([k, l]) => (
          <Button key={k} size="xs" variant={cat === k ? 'solid' : 'outline'} borderRadius="full"
            aria-pressed={cat === k} onClick={() => setCat(k)}>{l}</Button>
        ))}
      </HStack>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" maxH="380px" overflowY="auto" pr="1">
        {list.map((t) => (
          <Box key={t.key} as="button" textAlign="left" cursor="pointer"
            border="2px solid" borderColor={tpl?.key === t.key ? C.primary : 'transparent'}
            borderRadius="lg" p="2" _hover={{ borderColor: tpl?.key === t.key ? C.primary : C.cardBorder }}
            onClick={() => setTpl(t)} aria-pressed={tpl?.key === t.key}>
            <TemplatePreview tpl={t} />
            <HStack mt="2" justify="space-between">
              <Text fontSize="xs" fontWeight="600" color={C.ink} isTruncated>{t.name}</Text>
              <Tag color="gray" fontSize="2xs">{t.slides.length} diapos</Tag>
            </HStack>
            <Text fontSize="2xs" color="gray.500" lineClamp="1">{t.desc}</Text>
          </Box>
        ))}
      </SimpleGrid>
      {tpl && (
        <HStack mt="4" gap="2" flexWrap="wrap">
          <Input flex="1" minW="220px" fontSize="sm" autoFocus
            placeholder={`Nom — ex. ${tpl.name.toLowerCase()} du cabinet`}
            value={name} onChange={(e) => setName(e.target.value)} />
          <Select w="260px" aria-label="Dossier patient" value={dossierId}
            onChange={(e) => setDossierId(e.target.value)}>
            <option value="">Sans patient (diapos vides)</option>
            {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </HStack>
      )}
      {tpl && dossierName && (
        <Text fontSize="2xs" color={C.primary} mt="2">
          Les photos de « {dossierName} » seront placées automatiquement selon leurs vues et étapes cliniques.
        </Text>
      )}
    </Modal>
  )
}


