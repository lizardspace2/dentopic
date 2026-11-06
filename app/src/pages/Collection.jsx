// Route /collection — collections thématiques de photos et montages.
// Tout est fonctionnel : recherche, tri, création/édition, ajout d'éléments,
// partage par lien, corbeille (soft delete), panneau DÉTAIL avec vignettes.
import { useEffect, useState } from 'react'
import { Box, Button, Center, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiPlus, FiFolder, FiFolderPlus, FiEye, FiLink, FiEdit2, FiTrash2,
  FiAlertTriangle, FiCheck, FiImage, FiLayers, FiX, FiCopy,
  FiExternalLink,
} from 'react-icons/fi'
import {
  Card, Tag, EmptyPane, SectionLabel, PageHeader, HelpButton,
  PrimaryButton, SearchInput, isTestName, Modal, Select, Field, Tip, ago,
  ConfirmModal,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  listCollections, listDossiers, listPhotos, listMontages,
  createCollection, updateCollection, trashCollection,
  collectionItemCounts, listCollectionItems, addCollectionItem, removeCollectionItem,
  shareCollection, labelClinicalPhotos,
} from '../api'
import { CLINICAL_VIEWS, CLINICAL_STAGES, clinicalLabels } from '../clinical'
import { SPECIALTIES, specColor } from './DossierPatient'
import Phototheque from './Phototheque'
import { expandDossierIds, matchesLibraryText } from '../phototheque'

const COLORS = ['#4f46e5', '#4f8fe8', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#ed8936', '#e53e3e', '#ed64a6', '#9f7aea', '#718096']

export default function Collection() {
  return <Phototheque CollectionsComponent={CollectionsManager} />
}

function CollectionsManager({ globalQuery = '', globalPatient = '', globalSpecialty = '', matchingCollectionIds, onCollectionsChange }) {
  const { workspace, session } = useApp()
  const wsId = workspace?.id
  const userId = session?.user?.id
  const [cols, setCols] = useState([])
  const [dossiers, setDossiers] = useState([])
  const [counts, setCounts] = useState({})
  const [sel, setSel] = useState(null)          // collection affichée en DÉTAIL
  const [items, setItems] = useState([])
  const q = globalQuery
  const [sort, setSort] = useState('recent')    // 'recent' | 'name'
  const [modal, setModal] = useState(null)      // { kind, col? }
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const patientFilter = globalPatient
  const [itemSort, setItemSort] = useState('recent')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [viewFilter, setViewFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [batchView, setBatchView] = useState('')
  const [batchStage, setBatchStage] = useState('')
  const [labelMessage, setLabelMessage] = useState('')
  const visibleItems = items.filter((it) => (!favoritesOnly || it.photo?.is_favorite)
    && (!viewFilter || clinicalLabels(it.photo).view === viewFilter)
    && (!stageFilter || clinicalLabels(it.photo).stage === stageFilter))
    .sort((a, b) => {
      const first = new Date(a.photo?.created_at || a.montage?.created_at || a.created_at)
      const second = new Date(b.photo?.created_at || b.montage?.created_at || b.created_at)
      return itemSort === 'oldest' ? first - second : second - first
    })

  const reload = async () => {
    if (!wsId) return
    const [cs, ds] = await Promise.all([listCollections(wsId), listDossiers(wsId)])
    setCols(cs); setDossiers(ds)
    onCollectionsChange?.(cs)
    setCounts(await collectionItemCounts(cs.map((c) => c.id)))
    if (sel) setSel(cs.find((c) => c.id === sel.id) || null)
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  // panneau DÉTAIL : recharge les éléments à chaque sélection / modification
  useEffect(() => {
    let active = true
    setItems([]); setSelectedPhotos([]); setLabelMessage('')
    if (!sel) return
    listCollectionItems(sel.id).then((rows) => { if (active) setItems(rows) })
    return () => { active = false }
  }, [sel?.id, counts])

  useEffect(() => {
    setSelectedPhotos([]); setViewFilter(''); setStageFilter('')
    setBatchView(''); setBatchStage(''); setFavoritesOnly(false)
  }, [sel?.id])

  const applyLabels = async () => {
    setBusy(true); setLabelMessage('')
    try {
      const result = await labelClinicalPhotos(wsId, selectedPhotos, {
        view: batchView === 'clear' ? null : batchView || undefined,
        stage: batchStage === 'clear' ? null : batchStage || undefined,
      })
      const byId = Object.fromEntries(result.updated.map((p) => [p.id, p]))
      setItems((rows) => rows.map((it) => byId[it.photo_id]
        ? { ...it, photo: { ...it.photo, edit_meta: byId[it.photo_id].edit_meta } } : it))
      setSelectedPhotos((ids) => ids.filter((id) => !byId[id]))
      setLabelMessage(`${result.updated.length} photo(s) classée(s).${result.failed ? ` ${result.failed} échec(s), réessayez.` : ''}`)
    } catch {
      setLabelMessage('Enregistrement impossible. Vos photos restent sélectionnées pour réessayer.')
    } finally { setBusy(false) }
  }

  const testCount = cols.filter((c) => isTestName(c.name)).length

  const allowedDossiers = patientFilter ? expandDossierIds(dossiers, [patientFilter]) : null
  const list = cols
    .filter((c) => !allowedDossiers || allowedDossiers.includes(c.dossier_id))
    .filter((c) => !globalSpecialty || c.specialty === globalSpecialty)
    .filter((c) => {
      if (matchingCollectionIds) return matchingCollectionIds.includes(c.id)
      const dossier = dossiers.find((d) => d.id === c.dossier_id)
      return matchesLibraryText([c.name, c.description, dossier?.name, dossier?.patient_dossier_number, dossier?.description].join(' '), q)
    })
    .sort((a, b) => sort === 'name'
      ? a.name.localeCompare(b.name, 'fr')
      : new Date(b.updated_at) - new Date(a.updated_at))

  // ---- actions ---------------------------------------------------------------

  const EMPTY = { name: '', description: '', color: COLORS[0], specialty: '', dossier_id: '' }
  const openNew = () => { setForm({ ...EMPTY }); setModal({ kind: 'edit', col: null }) }
  const openEdit = (col) => {
    setForm({
      name: col.name, description: col.description || '', color: col.color || COLORS[0],
      specialty: col.specialty || '', dossier_id: col.dossier_id || '',
    })
    setModal({ kind: 'edit', col })
  }
  const save = async () => {
    if (!form?.name.trim()) return
    setBusy(true)
    const fields = {
      name: form.name.trim(), description: form.description.trim() || null,
      color: form.color, specialty: form.specialty || null, dossier_id: form.dossier_id || null,
    }
    const saved = modal.col
      ? await updateCollection(modal.col.id, fields)
      : await createCollection(wsId, fields)
    setBusy(false); setModal(null); setForm(null)
    await reload()
    if (saved && !modal.col) setSel(saved)
  }

  const trash = async (col) => {
    setBusy(true)
    await trashCollection(col.id)
    if (sel?.id === col.id) setSel(null)
    setBusy(false); setModal(null); reload()
  }

  const cleanTests = async () => {
    setBusy(true)
    for (const c of cols.filter((x) => isTestName(x.name))) await trashCollection(c.id)
    setBusy(false); setModal(null); setSel(null); reload()
  }

  const share = async (col, enabled, days = null) => {
    const updated = await shareCollection(col.id, enabled, days)
    await reload()
    if (updated) { setSel((s) => (s?.id === col.id ? updated : s)); setModal({ kind: 'share', col: updated }) }
  }

  const shareUrl = (col) => `${window.location.origin}/partage/${col.share_token}`
  const copy = (col) => {
    navigator.clipboard?.writeText(shareUrl(col))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  const removeItem = async () => {
    const item = modal?.item
    if (!item) return
    setBusy(true)
    await removeCollectionItem(item.id)
    setItems((l) => l.filter((x) => x.id !== item.id))
    setCounts((m) => ({ ...m, [sel.id]: Math.max(0, (m[sel.id] || 1) - 1) }))
    setBusy(false); setModal(null)
  }

  const setCover = async (item) => {
    if (!item.photo_id && !item.montage_id) return
    const updated = await updateCollection(sel.id, {
      cover_photo_id: item.photo_id || null, cover_montage_id: item.montage_id || null,
    })
    if (updated) setSel(updated)
    reload()
  }

  // ---- rendu -----------------------------------------------------------------

  const dossierName = (id) => dossiers.find((x) => x.id === id)?.name

  return (
    <Box w="100%">
      <PageHeader
        icon={FiFolder} iconBg={C.amberBg} iconColor={C.amberText}
        title="Collections"
        subtitle="Organisez vos photos et montages en collections thématiques"
      >
        <HelpButton />
        <Tip label="Créer une collection : nom, couleur, dossier patient lié">
          <PrimaryButton icon={FiPlus} onClick={openNew}>Nouvelle collection</PrimaryButton>
        </Tip>
      </PageHeader>

      <Card p="4" mb="4">
        <Text fontSize="sm" fontWeight="700" color={C.ink} mb="1">Organiser un cas clinique</Text>
        <Text fontSize="xs" color={C.body} mb="3">Un patient, une étape de traitement, une collection. Choisissez un modèle puis ajoutez vos photos.</Text>
        <HStack gap="2" flexWrap="wrap">
          {['Bilan initial', 'Suivi de traitement', 'Fin de traitement', 'Transmission au laboratoire'].map((name) => (
            <Button key={name} size="xs" variant="outline" onClick={() => {
              setForm({ ...EMPTY, name, dossier_id: patientFilter,
                description: name === 'Transmission au laboratoire'
                  ? 'Vues rapprochées, références de teinte et instructions pour le laboratoire.'
                  : 'Portrait · Sourire · Face intra-orale · Latérale droite / gauche · Occlusale maxillaire / mandibulaire · Secteur traité' })
              setModal({ kind: 'edit', col: null })
            }}>{name}</Button>
          ))}
        </HStack>
      </Card>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6" alignItems="start" mt="2">
        <Box>
          <SectionLabel mb="2">MES COLLECTIONS</SectionLabel>

          <HStack my="3" gap="2" color="gray.500">
            <Text fontSize="xs">Trier par</Text>
            <Box as="button" cursor="pointer" onClick={() => setSort('recent')}>
              <Tag color={sort === 'recent' ? 'blue' : 'gray'}>Récentes</Tag>
            </Box>
            <Box as="button" cursor="pointer" fontSize="xs"
              color={sort === 'name' ? C.primary : 'gray.500'} fontWeight={sort === 'name' ? '700' : '400'}
              onClick={() => setSort('name')}>
              A→Z
            </Box>
            <Box flex="1" />
            {testCount > 0 && (
              <Tip label={`${testCount} collection(s) de test/démo — mettre à la corbeille`}>
                <Text fontSize="xs" color={C.amberText} cursor="pointer"
                  onClick={() => setModal({ kind: 'clean' })}>
                  <FiAlertTriangle style={{ display: 'inline' }} /> Nettoyer ({testCount})
                </Text>
              </Tip>
            )}
          </HStack>

          <VStack align="stretch" gap="3">
            {list.map((c) => {
              const n = counts[c.id] || 0
              return (
                <Card key={c.id} p="3" cursor="pointer"
                  borderColor={sel?.id === c.id ? 'blue.300' : C.cardBorder}
                  _hover={{ borderColor: 'blue.300' }}
                  onClick={() => setSel(c)}>
                  <HStack gap="3" align="start">
                    <Box w="34px" h="34px" borderRadius="lg" bg={c.color || '#4f46e5'} flexShrink="0" />
                    <Box flex="1" minW="0">
                      <HStack gap="2" mb="0.5">
                        <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{c.name}</Text>
                        {isTestName(c.name) && <Tag color="purple">Test</Tag>}
                        {c.share_enabled && (
                          <Tip label="Lien de partage actif">
                            <Box as={FiLink} color={C.primary} fontSize="xs" flexShrink="0" />
                          </Tip>
                        )}
                      </HStack>
                      <Text fontSize="xs" color="gray.500" isTruncated mb="2">
                        {c.description || 'Collection automatique : montages avant/après du dossier patient.'}
                      </Text>
                      {c.cover_photo?.storage_path && (
                        <PhotoImg storagePath={c.cover_photo.storage_path} ratio="16/5" mb="2" />
                      )}
                      <HStack justify="space-between">
                        <Text fontSize="2xs" color="gray.500">{n} élément(s)</Text>
                        <HStack gap="1" color="gray.400" fontSize="sm" onClick={(e) => e.stopPropagation()}>
                          <Tip label="Ajouter des photos / montages à cette collection">
                            <ActionIcon I={FiFolderPlus} label="Ajouter des éléments" onClick={() => setModal({ kind: 'add', col: c })} />
                          </Tip>
                          <Tip label="Voir le détail de la collection">
                            <ActionIcon I={FiEye} label="Voir le détail" onClick={() => setSel(c)} />
                          </Tip>
                          <Tip label="Partager par lien (activable/désactivable)">
                            <ActionIcon I={FiLink} label="Partager par lien" onClick={() => setModal({ kind: 'share', col: c })} />
                          </Tip>
                          <Tip label="Modifier : nom, couleur, dossier, spécialité">
                            <ActionIcon I={FiEdit2} label="Modifier la collection" onClick={() => openEdit(c)} />
                          </Tip>
                          <Tip label="Mettre la collection à la corbeille">
                            <ActionIcon I={FiTrash2} label="Mettre à la corbeille" onClick={() => setModal({ kind: 'trash', col: c })} />
                          </Tip>
                        </HStack>
                      </HStack>
                    </Box>
                  </HStack>
                </Card>
              )
            })}
            {list.length === 0 && (
              <Text fontSize="sm" color="gray.500" textAlign="center" py="8">
                Aucune collection{q ? ` ne correspond à « ${q} »` : ' — créez-en une'}.
              </Text>
            )}
          </VStack>
        </Box>

        {/* ---- panneau DÉTAIL ---- */}
        <Box>
          <SectionLabel mb="2">DÉTAIL</SectionLabel>
          {!sel ? (
            <EmptyPane minH="400px">
              <Center flexDirection="column" gap="2" color="gray.400">
                <FiEye size="22px" />
                <Text fontSize="xs">Cliquez une collection pour voir son contenu</Text>
              </Center>
            </EmptyPane>
          ) : (
            <Card p="4" minH="400px">
              <HStack gap="3" mb="3">
                <Box w="40px" h="40px" borderRadius="lg" bg={sel.color || '#4f46e5'} flexShrink="0" />
                <Box flex="1" minW="0">
                  <Text fontSize="md" fontWeight="700" color={C.ink} isTruncated>{sel.name}</Text>
                  <Text fontSize="xs" color="gray.500">{items.length} élément(s) · modifiée {ago(sel.updated_at)}</Text>
                </Box>
                <ActionIcon I={FiEdit2} label="Modifier la collection" onClick={() => openEdit(sel)} />
              </HStack>
              {sel.description && <Text fontSize="xs" color={C.body} mb="3">{sel.description}</Text>}
              <VStack align="stretch" gap="1.5" mb="3">
                {sel.dossier_id && <DetailRow k="Dossier patient" v={dossierName(sel.dossier_id)} />}
                {sel.specialty && (
                  <HStack justify="space-between" fontSize="xs">
                    <Text color="gray.500">Spécialité</Text>
                    <HStack gap="1"><Box w="6px" h="6px" borderRadius="full" bg={specColor(sel.specialty)} /><Text color={C.ink}>{sel.specialty}</Text></HStack>
                  </HStack>
                )}
                <DetailRow k="Créée" v={new Date(sel.created_at).toLocaleDateString('fr-FR')} />
                {sel.share_enabled && (
                  <HStack justify="space-between" fontSize="xs">
                    <Text color="gray.500">Partage</Text>
                    <HStack gap="2">
                      <Tag color="green"><FiLink style={{ marginRight: 3 }} />actif</Tag>
                      <Text fontSize="2xs" color={C.primary} cursor="pointer"
                        onClick={() => setModal({ kind: 'share', col: sel })}>
                        gérer
                      </Text>
                    </HStack>
                  </HStack>
                )}
              </VStack>

              <HStack mb="3" gap="2" flexWrap="wrap">
                <Select aria-label="Ordre des photos" value={itemSort} onChange={(e) => setItemSort(e.target.value)}>
                  <option value="recent">Plus récentes d’abord</option>
                  <option value="oldest">Chronologie du traitement</option>
                </Select>
                <Button size="xs" variant="outline" aria-pressed={favoritesOnly}
                  onClick={() => setFavoritesOnly((v) => !v)}>
                  {favoritesOnly ? 'Afficher tout' : 'Photos favorites'}
                </Button>
                <Text fontSize="xs" color={C.body}>{visibleItems.length} affiché(s)</Text>
              </HStack>
              <HStack gap="2" mb="3" flexWrap="wrap">
                {[[viewFilter, setViewFilter, CLINICAL_VIEWS, 'Toutes les vues'],
                  [stageFilter, setStageFilter, CLINICAL_STAGES, 'Toutes les étapes']].map(([value, change, options, label]) => (
                  <Select key={label} aria-label={label} value={value} onChange={(e) => { change(e.target.value); setSelectedPhotos([]) }}>
                    <option value="">{label}</option>
                    {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
                  </Select>
                ))}
              </HStack>
              <Box p="3" mb="3" bg={C.greenBg} border="1px solid" borderColor={C.greenBorder} borderRadius="md">
                <Text fontSize="xs" fontWeight="700" color={C.greenText} mb="2">Classer les photos · Vue / Étape</Text>
                <Button size="xs" variant="outline" disabled={busy || !visibleItems.some((it) => it.photo_id)}
                  onClick={() => setSelectedPhotos([...new Set(visibleItems.filter((it) => it.photo_id).map((it) => it.photo_id))])}>
                  Sélectionner les photos affichées
                </Button>
                {selectedPhotos.length > 0 && (
                  <>
                    <Text fontSize="xs" color={C.body} my="2">{selectedPhotos.length} photo(s) sélectionnée(s)</Text>
                    <HStack gap="2" flexWrap="wrap">
                      {[[batchView, setBatchView, CLINICAL_VIEWS, 'Vue'], [batchStage, setBatchStage, CLINICAL_STAGES, 'Étape']].map(([value, change, options, label]) => (
                        <Select key={label} aria-label={`Attribuer ${label}`} value={value} disabled={busy} onChange={(e) => change(e.target.value)}>
                          <option value="">{label} : ne pas modifier</option>
                          {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
                          <option value="clear">Retirer l’étiquette</option>
                        </Select>
                      ))}
                      <PrimaryButton disabled={busy || (!batchView && !batchStage)} onClick={applyLabels}>Appliquer</PrimaryButton>
                      <Button size="xs" variant="outline" disabled={busy} onClick={() => setSelectedPhotos([])}>Annuler</Button>
                    </HStack>
                  </>
                )}
                {labelMessage && <Text fontSize="xs" color={C.body} mt="2" role="status">{labelMessage}</Text>}
              </Box>
              {items.length > 0 && visibleItems.length === 0 && (
                <Text fontSize="xs" color={C.body}>Aucun élément ne correspond aux filtres.</Text>
              )}
              {/* éléments */}
              {items.length === 0 ? (
                <Center py="8" flexDirection="column" gap="2" color="gray.400">
                  <FiImage size="20px" />
                  <Text fontSize="xs">Aucun élément — ajoutez des photos ou montages</Text>
                  <Button size="xs" variant="outline" onClick={() => setModal({ kind: 'add', col: sel })}>
                    <FiFolderPlus style={{ marginRight: 4 }} /> Ajouter des éléments
                  </Button>
                </Center>
              ) : (
                <SimpleGrid columns={3} gap="2">
                  {visibleItems.map((it) => (
                    <Box key={it.id} position="relative" borderRadius="md" overflow="hidden"
                      border="1px solid" borderColor={C.cardBorder} role="group">
                      {it.photo?.storage_path ? (
                        <PhotoImg storagePath={it.photo.storage_path} ratio="1" />
                      ) : (
                        <Center bg={C.softBlue} style={{ aspectRatio: '1' }} flexDirection="column" gap="1">
                          <FiLayers color={C.primary} />
                          <Text fontSize="2xs" color={C.ink} px="1" isTruncated maxW="95%">
                            {it.montage?.name || 'Montage'}
                          </Text>
                        </Center>
                      )}
                      {it.photo_id && (
                        <Box position="absolute" top="1" left="1" bg={C.pageBg} borderRadius="sm" px="1" zIndex="1">
                          <input type="checkbox" aria-label={`Sélectionner ${it.photo?.original_filename || 'la photo'}`}
                            disabled={busy} checked={selectedPhotos.includes(it.photo_id)}
                            onChange={(e) => setSelectedPhotos((ids) => e.target.checked
                              ? [...new Set([...ids, it.photo_id])] : ids.filter((id) => id !== it.photo_id))} />
                        </Box>
                      )}
                      {it.photo && (
                        <HStack gap="1" flexWrap="wrap" p="1">
                          {[[CLINICAL_VIEWS, clinicalLabels(it.photo).view], [CLINICAL_STAGES, clinicalLabels(it.photo).stage]].map(([options, value], index) =>
                            value ? <Tag key={index} color="green">{options.find(([id]) => id === value)?.[1] || value}</Tag> : null)}
                        </HStack>
                      )}
                      <HStack position="absolute" top="1" right="1" gap="1"
                        opacity="0" _groupHover={{ opacity: 1 }} transition="opacity .15s">
                        <Tip label="Définir comme couverture">
                          <Center w="20px" h="20px" borderRadius="sm" bg="white" cursor="pointer"
                            boxShadow="sm" fontSize="2xs" color={C.primary} onClick={() => setCover(it)}>
                            <FiImage />
                          </Center>
                        </Tip>
                        <Tip label="Retirer de la collection">
                          <Center w="20px" h="20px" borderRadius="sm" bg="white" cursor="pointer"
                            boxShadow="sm" fontSize="2xs" color="red.500" onClick={() => setModal({ kind: 'rmItem', item: it })}>
                            <FiX />
                          </Center>
                        </Tip>
                      </HStack>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Card>
          )}
        </Box>
      </SimpleGrid>

      {/* ---- création / édition ---- */}
      <Modal open={modal?.kind === 'edit'} onClose={() => setModal(null)} width="520px"
        title={modal?.col ? 'Modifier la collection' : 'Nouvelle collection'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Annuler</Button>
            <PrimaryButton onClick={save} disabled={!form?.name.trim() || busy}>
              {busy ? 'Enregistrement…' : modal?.col ? 'Enregistrer' : 'Créer'}
            </PrimaryButton>
          </>
        }>
        {form && (
          <VStack align="stretch" gap="4">
            <Field label="Nom *">
              <Input fontSize="sm" placeholder="ex. Cas d'esthétique antérieure" autoFocus
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input fontSize="sm" placeholder="Thème, objectif de la collection…"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Couleur">
              <HStack gap="1.5" flexWrap="wrap">
                {COLORS.map((col) => (
                  <Center key={col} w="26px" h="26px" borderRadius="md" bg={col} cursor="pointer"
                    border="2px solid" borderColor={form.color === col ? C.ink : 'transparent'}
                    color="#ffffff" fontSize="xs"
                    onClick={() => setForm({ ...form, color: col })}>
                    {form.color === col && <FiCheck />}
                  </Center>
                ))}
              </HStack>
            </Field>
            <SimpleGrid columns={2} gap="3">
              <Field label="Dossier patient lié">
                <Select w="100%" value={form.dossier_id} onChange={(e) => setForm({ ...form, dossier_id: e.target.value })}>
                  <option value="">Aucun</option>
                  {dossiers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
              </Field>
              <Field label="Spécialité">
                <Select w="100%" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
                  <option value="">Aucune</option>
                  {SPECIALTIES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                </Select>
              </Field>
            </SimpleGrid>
          </VStack>
        )}
      </Modal>

      {/* ---- ajout d'éléments ---- */}
      <AddItemsModal
        open={modal?.kind === 'add'} col={modal?.col} wsId={wsId} userId={userId}
        existing={items.map((i) => i.photo_id || i.montage_id)}
        onClose={() => setModal(null)}
        onDone={async () => { setModal(null); await reload() }}
      />

      {/* ---- partage ---- */}
      <Modal open={modal?.kind === 'share'} onClose={() => setModal(null)} width="460px"
        title="Partager la collection" subtitle="Lien public — le destinataire voit la collection sans compte">
        {modal?.col && (
          <VStack align="stretch" gap="3">
            {modal.col.share_enabled ? (
              <>
                <HStack bg={C.greenBg} border="1px solid" borderColor={C.greenBorder}
                  borderRadius="md" px="3" py="2" gap="2">
                  <FiLink color={C.greenText} />
                  <Text fontSize="xs" color={C.greenText} fontWeight="600">Partage actif</Text>
                  {modal.col.share_expires_at && (
                    <Text fontSize="2xs" color={C.greenText}>
                      — expire le {new Date(modal.col.share_expires_at).toLocaleDateString('fr-FR')}
                    </Text>
                  )}
                </HStack>
                <HStack gap="2">
                  <Input fontSize="xs" value={shareUrl(modal.col)} readOnly />
                  <Button size="sm" variant="outline" onClick={() => copy(modal.col)}>
                    <FiCopy style={{ marginRight: 4 }} /> {copied ? 'Copié !' : 'Copier'}
                  </Button>
                </HStack>
                <HStack gap="2">
                  <Button size="sm" variant="outline" onClick={() => window.open(shareUrl(modal.col), '_blank')}>
                    <FiExternalLink style={{ marginRight: 4 }} /> Ouvrir
                  </Button>
                  <Box flex="1" />
                  <Button size="sm" variant="outline" color="red.500" onClick={() => share(modal.col, false)}>
                    Désactiver
                  </Button>
                </HStack>
              </>
            ) : (
              <>
                <Text fontSize="xs" color="gray.500">
                  Génère un lien public vers « {modal.col.name} » (lecture seule, sans connexion).
                </Text>
                <HStack gap="2">
                  {[7, 30].map((d) => (
                    <Button key={d} size="sm" variant="outline" onClick={() => share(modal.col, true, d)}>
                      {d} jours
                    </Button>
                  ))}
                  <PrimaryButton onClick={() => share(modal.col, true)}>Sans expiration</PrimaryButton>
                </HStack>
              </>
            )}
          </VStack>
        )}
      </Modal>

      {/* ---- corbeille : confirmation obligatoire ---- */}
      <ConfirmModal open={modal?.kind === 'trash'} onClose={() => setModal(null)}
        onConfirm={() => trash(modal.col)} busy={busy}
        title="Mettre la collection à la corbeille ?"
        confirmLabel="Oui, mettre à la corbeille"
        message={`Voulez-vous vraiment mettre « ${modal?.col?.name || ''} » et ses ${counts[modal?.col?.id] || 0} élément(s) à la corbeille ? Restauration possible.`} />

      {/* ---- retrait d'un élément : confirmation obligatoire ---- */}
      <ConfirmModal open={modal?.kind === 'rmItem'} onClose={() => setModal(null)}
        onConfirm={removeItem} busy={busy}
        title="Retirer l'élément ?"
        confirmLabel="Oui, retirer"
        message="Voulez-vous vraiment retirer cet élément de la collection ? La photo ou le montage reste dans le workspace." />

      {/* ---- nettoyage des collections de test ---- */}
      <Modal open={modal?.kind === 'clean'} onClose={() => setModal(null)} width="420px"
        title="Nettoyer les collections de test"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Non</Button>
            <Button size="sm" bg="red.500" color="#ffffff" borderRadius="md" disabled={busy}
              onClick={cleanTests}>
              {busy ? 'Suppression…' : `Oui, mettre à la corbeille (${testCount})`}
            </Button>
          </>
        }>
        <Text fontSize="sm" color={C.body} mb="2">
          Voulez-vous vraiment mettre {testCount} collection(s) démo/test à la corbeille ?
        </Text>
        <VStack align="stretch" gap="1" maxH="180px" overflowY="auto">
          {cols.filter((c) => isTestName(c.name)).map((c) => (
            <HStack key={c.id} fontSize="xs" color="gray.500" gap="2">
              <Box w="8px" h="8px" borderRadius="sm" bg={c.color || '#4f46e5'} flexShrink="0" />
              <Text isTruncated>{c.name}</Text>
            </HStack>
          ))}
        </VStack>
      </Modal>
    </Box>
  )
}

function ActionIcon({ I, onClick, label }) {
  return (
    <Center w="24px" h="24px" borderRadius="md" cursor="pointer" fontSize="sm"
      color="gray.400" _hover={{ bg: C.softBlue, color: C.primary }}
      aria-label={label} onClick={onClick}>
      <I />
    </Center>
  )
}

function DetailRow({ k, v }) {
  if (!v) return null
  return (
    <HStack justify="space-between" fontSize="xs" gap="3">
      <Text color="gray.500" flexShrink="0">{k}</Text>
      <Text color={C.ink} fontWeight="600" textAlign="right" isTruncated>{v}</Text>
    </HStack>
  )
}

// ---- Modal « ajouter des éléments » : photos + montages du workspace ----------

function AddItemsModal({ open, col, wsId, userId, existing = [], onClose, onDone }) {
  const [tab, setTab] = useState('photos')
  const [photos, setPhotos] = useState([])
  const [montages, setMontages] = useState([])
  const [picked, setPicked] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open || !wsId) return
    setPicked(new Set()); setQ('')
    listPhotos(wsId).then((l) => setPhotos(l.slice(0, 120)))
    listMontages(wsId).then(setMontages)
  }, [open, wsId])

  const pool = tab === 'photos' ? photos : montages
  const list = pool
    .filter((x) => !existing.includes(x.id))
    .filter((x) => !q || (x.original_filename || x.name || '').toLowerCase().includes(q.toLowerCase()))

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n
  })

  const run = async () => {
    setBusy(true)
    let pos = existing.length
    for (const id of picked) {
      const isPhoto = tab === 'photos'
      await addCollectionItem(col.id, {
        item_kind: isPhoto ? 'photo' : 'montage',
        photo_id: isPhoto ? id : null,
        montage_id: isPhoto ? null : id,
        position: ++pos,
      }, userId)
    }
    setBusy(false)
    onDone()
  }

  return (
    <Modal open={open} onClose={onClose} width="560px"
      title={`Ajouter à « ${col?.name || ''} »`}
      subtitle="Sélectionnez les photos ou montages à intégrer"
      footer={
        <>
          <Text fontSize="xs" color="gray.500">{picked.size} sélectionné(s)</Text>
          <PrimaryButton onClick={run} disabled={!picked.size || busy}>
            {busy ? 'Ajout…' : 'Ajouter'}
          </PrimaryButton>
        </>
      }>
      <HStack gap="2" mb="3">
        {[['photos', 'Photos', FiImage], ['montages', 'Montages', FiLayers]].map(([k, l, I]) => (
          <Box key={k} as="button" px="3" py="1.5" fontSize="xs" borderRadius="md" cursor="pointer"
            fontWeight={tab === k ? '700' : '400'}
            bg={tab === k ? C.softBlue : 'transparent'} color={tab === k ? C.primary : 'gray.500'}
            onClick={() => { setTab(k); setPicked(new Set()) }}>
            <I style={{ display: 'inline', marginRight: 5 }} />{l}
          </Box>
        ))}
        <Box flex="1" />
        <SearchInput placeholder="Filtrer…" w="180px" value={q} onChange={(e) => setQ(e.target.value)} />
      </HStack>
      <Box maxH="320px" overflowY="auto">
        {tab === 'photos' ? (
          <SimpleGrid columns={4} gap="2">
            {list.map((p) => (
              <Box key={p.id} position="relative" borderRadius="md" overflow="hidden"
                cursor="pointer" border="2px solid"
                borderColor={picked.has(p.id) ? C.primary : 'transparent'}
                onClick={() => toggle(p.id)}>
                <PhotoImg storagePath={p.storage_path} ratio="1" />
                {picked.has(p.id) && (
                  <Center position="absolute" top="1" right="1" w="18px" h="18px"
                    borderRadius="full" bg={C.primary} color="#ffffff" fontSize="2xs">
                    <FiCheck />
                  </Center>
                )}
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          <VStack align="stretch" gap="1.5">
            {list.map((m) => (
              <HStack key={m.id} px="3" py="2" borderRadius="md" cursor="pointer" gap="3"
                bg={picked.has(m.id) ? C.softBlue : 'transparent'}
                border="1px solid" borderColor={picked.has(m.id) ? C.primary : C.cardBorder}
                onClick={() => toggle(m.id)}>
                <FiLayers color={C.primary} />
                <Box flex="1" minW="0">
                  <Text fontSize="xs" fontWeight="600" color={C.ink} isTruncated>{m.name || 'Montage'}</Text>
                  <Text fontSize="2xs" color="gray.400">{m.image_count || 2} images · {ago(m.updated_at)}</Text>
                </Box>
                {picked.has(m.id) && <FiCheck color={C.primary} />}
              </HStack>
            ))}
          </VStack>
        )}
        {list.length === 0 && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py="6">
            {tab === 'photos' ? 'Aucune photo disponible.' : 'Aucun montage disponible.'}
          </Text>
        )}
      </Box>
    </Modal>
  )
}
