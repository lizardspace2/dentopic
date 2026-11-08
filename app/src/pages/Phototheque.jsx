import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { FiExternalLink, FiFolder, FiFolderMinus, FiGrid, FiList, FiMaximize2, FiStar, FiTag } from 'react-icons/fi'
import { Card, EmptyPane, Field, Modal, PageHeader, PrimaryButton, SearchInput, Select, Tag, toast } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import PhotoViewer from '../components/PhotoViewer'
import PatientTimelineModal from './PatientTimelineModal'
import { useApp } from '../context/AppContext'
import { loadLibraryContext, searchLibraryPhotos, labelClinicalPhotos, setPhotoFavorite, addCollectionItem, fileUnassignedPhotos, classifyPhoto, movePhotosToDossier, importPhotos } from '../api'
import { DossierTree, ContextMenu, startPhotoDrag, useFileDrop, fileInfo } from '../components/Explorer'
import { CLINICAL_VIEWS, CLINICAL_STAGES, clinicalLabels } from '../clinical'
import { LIBRARY_DEFAULTS, expandDossierIds, matchesLibraryText, readLibraryFilters, rootDossierId } from '../phototheque'
import { C } from '../theme'

const textFor = (d) => [d.name, d.patientNames, d.patient_dossier_number, d.description].join(' ')
const labelFor = (options, id) => options.find(([key]) => key === id)?.[1] || id

export default function Phototheque({ CollectionsComponent }) {
  const { workspace, session } = useApp()
  const wsId = workspace?.id, userId = session?.user?.id
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readLibraryFilters(params), [params])
  const [context, setContext] = useState(null)
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [contextError, setContextError] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [contextRetry, setContextRetry] = useState(0)
  const [selected, setSelected] = useState([])
  const [batch, setBatch] = useState({ view: '', stage: '' })
  const [collectionId, setCollectionId] = useState('')
  const [fileDossier, setFileDossier] = useState('')
  const [busy, setBusy] = useState(false)
  const [patient, setPatient] = useState(null)
  const [saved, setSaved] = useState([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [savedError, setSavedError] = useState('')
  const [classify, setClassify] = useState(null)
  const [menu, setMenu] = useState(null) // menu contextuel clic droit {x, y, photo}
  const [moveForm, setMoveForm] = useState(null) // déplacement vers un dossier {ids, dossierId}
  const [viewer, setViewer] = useState(null) // index dans `rows` de la photo agrandie
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dentopic.library-view') || 'grid')
  const lastIdx = useRef(-1)
  useEffect(() => { localStorage.setItem('dentopic.library-view', viewMode) }, [viewMode])
  const storageKey = wsId && userId ? `dentopic.library-searches.${wsId}.${userId}` : null
  const change = (patch) => setParams((old) => {
    const next = new URLSearchParams(old)
    for (const [key, value] of Object.entries({ page: '0', ...patch })) {
      if (!value || value === LIBRARY_DEFAULTS[key]) next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }, { replace: true })

  useEffect(() => {
    if (!wsId) return
    const controller = new AbortController()
    setContext(null); setContextError(''); setPatient(null)
    loadLibraryContext(wsId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setContext(result) })
      .catch(() => { if (!controller.signal.aborted) setContextError('Impossible de charger les dossiers et collections.') })
    return () => controller.abort()
  }, [wsId, contextRetry])

  useEffect(() => {
    if (!context || !wsId) return
    const controller = new AbortController()
    setLoading(true); setError(''); setRows([]); setCount(null)
    const timer = setTimeout(() => {
      searchLibraryPhotos(wsId, filters.tab === 'photos' ? filters : { ...filters, page: '0' }, context, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          if (filters.tab === 'photos' && Number(filters.page) > 0 && Number(filters.page) * result.pageSize >= result.count) {
            change({ page: String(Math.max(0, Math.ceil(result.count / result.pageSize) - 1)) })
            return
          }
          setRows(result.rows); setCount(result.count)
        })
        .catch(() => { if (!controller.signal.aborted) setError('Recherche impossible. Vérifiez vos filtres ou réessayez.') })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [wsId, context, filters, refresh])

  useEffect(() => { setSelected([]) }, [filters, wsId])
  useEffect(() => {
    setSaved([]); setSavedError('')
    if (!storageKey) return
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '[]')
      if (Array.isArray(value)) setSaved(value.filter((s) => typeof s.id === 'string' && typeof s.name === 'string' && typeof s.params === 'string').slice(0, 20))
    } catch { setSavedError('Les recherches enregistrées sont illisibles sur cet appareil.') }
  }, [storageKey])

  const dossiers = context?.dossiers || []
  const patients = dossiers.filter((d) => !d.parent_id
    && (!filters.patient || d.id === filters.patient)
    && (!filters.specialty || (d.specialties || []).includes(filters.specialty))
    && matchesLibraryText(textFor(d), filters.q))
  const allowedCollections = filters.patient ? expandDossierIds(dossiers, [filters.patient]) : null
  const collections = (context?.collections || []).filter((c) => (!allowedCollections || allowedCollections.includes(c.dossier_id))
    && (!filters.specialty || c.specialty === filters.specialty)
    && matchesLibraryText([c.name, c.description, textFor(dossiers.find((d) => d.id === c.dossier_id) || {})].join(' '), filters.q))
  const specialties = [...new Set([...dossiers.flatMap((d) => d.specialties || []), ...(context?.collections || []).map((c) => c.specialty).filter(Boolean)])].sort()
  const patientDossier = (id) => dossiers.find((d) => d.id === rootDossierId(dossiers, id))
  const patientName = (id) => patientDossier(id)?.name || 'Sans dossier'
  const page = Number(filters.page), pageSize = 48
  const chips = [
    ['patient', filters.patient && patientName(filters.patient)], ['specialty', filters.specialty],
    ...(filters.tab === 'photos' ? [
      ['view', labelFor(CLINICAL_VIEWS, filters.view)], ['stage', labelFor(CLINICAL_STAGES, filters.stage)],
      ['from', filters.from && `Depuis le ${filters.from}`], ['to', filters.to && `Jusqu’au ${filters.to}`],
      ['session', filters.session && 'Séance de capture'], ['day', filters.day && `Séance du ${filters.day}`],
    ] : []),
  ].filter(([, value]) => value)

  const applyBatch = async () => {
    setBusy(true)
    try {
      const result = await labelClinicalPhotos(wsId, selected, {
        view: batch.view === 'clear' ? null : batch.view || undefined,
        stage: batch.stage === 'clear' ? null : batch.stage || undefined,
      })
      const updated = new Set(result.updated.map((p) => p.id))
      setSelected((ids) => ids.filter((id) => !updated.has(id)))
      if (result.failed) toast.error(`${updated.size} photo(s) classée(s) — ${result.failed} échec(s), réessayez.`)
      else toast.success(`${updated.size} photo(s) classée(s).`)
      setRefresh((v) => v + 1)
    } catch { toast.error('Enregistrement impossible. La sélection est conservée pour réessayer.') }
    finally { setBusy(false) }
  }
  const addSelection = async () => {
    if (!collectionId) return
    setBusy(true)
    try {
      const result = await Promise.all(selected.map(async (id) => ({ id, saved: await addCollectionItem(collectionId, { photo_id: id }, userId) })))
      const added = new Set(result.filter((r) => r.saved).map((r) => r.id))
      setSelected((ids) => ids.filter((id) => !added.has(id)))
      if (added.size < result.length) toast.error(`${added.size} photo(s) ajoutée(s) — certaines étaient déjà présentes.`)
      else toast.success(`${added.size} photo(s) ajoutée(s), sans duplication des originaux.`)
    } catch { toast.error('Ajout interrompu. Vérifiez la collection avant de réessayer.') }
    finally { setBusy(false) }
  }
  const fileSelection = async () => {
    if (!fileDossier || !selected.length) return
    setBusy(true)
    try {
      const updated = await fileUnassignedPhotos(wsId, selected, fileDossier)
      const ids = new Set(updated.map((p) => p.id))
      setSelected((old) => old.filter((id) => !ids.has(id)))
      toast.success(`${ids.size} photo(s) rangée(s).`)
      setRefresh((v) => v + 1)
    } catch { toast.error('Classement impossible. La sélection est conservée.') }
    finally { setBusy(false) }
  }
  const favorite = async (photo) => {
    setBusy(true)
    try { await setPhotoFavorite(wsId, photo.id, !photo.is_favorite); setRefresh((v) => v + 1) }
    catch { toast.error('Favori non enregistré. Réessayez.') }
    finally { setBusy(false) }
  }
  // dépôt de fichiers depuis l'ordinateur (explorateur Windows → dossier)
  const importInto = async (files, dossierId) => {
    const to = (context?.dossiers || []).find((d) => d.id === dossierId)
    setBusy(true)
    try {
      await importPhotos(wsId, files, dossierId)
      toast.success(`${files.length} photo(s) importée(s) dans « ${to?.name || 'Sans dossier'} ».`)
      setRefresh((v) => v + 1)
    } catch { toast.error('Import impossible. Réessayez.') }
    finally { setBusy(false) }
  }
  const fileDrop = useFileDrop((files) => importInto(files, filters.patient || null))
  // glisser-déposer : photos lâchées sur un dossier de l'arborescence
  const movePhotos = async (ids, dossierId) => {
    const to = (context?.dossiers || []).find((d) => d.id === dossierId)
    setBusy(true)
    try {
      await movePhotosToDossier(wsId, ids, dossierId)
      setSelected((old) => old.filter((id) => !ids.includes(id)))
      toast.success(`${ids.length} photo(s) déplacée(s) vers « ${to?.name || 'Sans dossier'} ».`)
      setRefresh((v) => v + 1)
    } catch { toast.error('Déplacement impossible. Réessayez.') }
    finally { setBusy(false) }
  }
  // sélection façon explorateur : clic = seule, Ctrl+clic = bascule, Shift+clic = plage
  const photoClick = (e, p, idx) => {
    if (e.shiftKey && lastIdx.current >= 0) {
      const a = Math.min(lastIdx.current, idx), b = Math.max(lastIdx.current, idx)
      setSelected((old) => [...new Set([...old, ...rows.slice(a, b + 1).map((x) => x.id)])])
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((old) => old.includes(p.id) ? old.filter((x) => x !== p.id) : [...old, p.id])
      lastIdx.current = idx
    } else {
      setSelected([p.id]); lastIdx.current = idx
    }
  }
  // clic droit : sélectionne la photo si hors sélection, puis ouvre le menu contextuel
  const openMenu = (e, p, idx) => {
    e.preventDefault()
    if (!selected.includes(p.id)) { setSelected([p.id]); lastIdx.current = idx }
    setMenu({ x: e.clientX, y: e.clientY, photo: p })
  }
  const openClassify = (photo) => setClassify({
    photo, dossierId: photo.dossier_id || '',
    view: clinicalLabels(photo).view || '', stage: clinicalLabels(photo).stage || '',
  })
  const saveClassify = async () => {
    if (!classify) return
    setBusy(true)
    try {
      await classifyPhoto(wsId, classify.photo.id, { dossierId: classify.dossierId, view: classify.view, stage: classify.stage })
      setSelected((ids) => ids.filter((id) => id !== classify.photo.id))
      setClassify(null)
      toast.success('Photo classée.')
      setRefresh((v) => v + 1)
    } catch { toast.error('Classement impossible. Réessayez.') }
    finally { setBusy(false) }
  }
  const storeSaved = (next) => {
    if (!storageKey) return false
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); setSavedError(''); return true }
    catch { setSavedError('Enregistrement local impossible. Vérifiez le stockage du navigateur.'); return false }
  }
  const saveSearch = () => {
    if (!saveName.trim()) return
    const approved = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (key !== 'page' && value !== LIBRARY_DEFAULTS[key]) approved.set(key, value)
    const next = [...saved, { id: crypto.randomUUID(), name: saveName.trim(), params: approved.toString() }].slice(-20)
    if (storeSaved(next)) { setSaveOpen(false); setSaveName('') }
  }
  const reset = () => setParams(filters.tab === 'photos' ? {} : { tab: filters.tab }, { replace: true })

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader icon={FiFolder} iconBg={C.greenBg} iconColor={C.greenText} title="Collection · Photothèque clinique"
        subtitle="Retrouvez une photo, un patient ou une collection, sans déplacer les originaux." />
      <Card p="4" mb="4">
        <SearchInput w="100%" placeholder="Patient, N° dossier, fichier, description, collection…" value={filters.q}
          onChange={(e) => change({ q: e.target.value })} />
        <HStack mt="3" gap="2" flexWrap="wrap">
          {[["photos", "Photos", count], ["patients", "Patients", patients.length], ["collections", "Collections", collections.length]].map(([tab, label, total]) => (
            <Button key={tab} size="sm" variant={filters.tab === tab ? 'solid' : 'outline'} aria-pressed={filters.tab === tab}
              onClick={() => change({ tab })}>{label} ({total == null ? '…' : total})</Button>
          ))}
          <Box flex="1" />
          <Button size="xs" variant="outline" disabled={!storageKey} onClick={() => setSaveOpen(true)}>Enregistrer cette recherche</Button>
        </HStack>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="2" mt="3">
          <Select w="100%" value={filters.patient} aria-label="Filtrer par patient" onChange={(e) => change({ patient: e.target.value, session: '', day: '' })}>
            <option value="">Tous les patients / dossiers</option>
            {dossiers.filter((d) => !d.parent_id).map((d) => <option key={d.id} value={d.id}>{d.name}{d.patient_dossier_number ? ` · ${d.patient_dossier_number}` : ''}</option>)}
          </Select>
          <Select w="100%" value={filters.specialty} aria-label="Filtrer par spécialité" onChange={(e) => change({ specialty: e.target.value })}>
            <option value="">Toutes les spécialités</option>
            {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </SimpleGrid>
        {filters.tab === 'photos' && <>
          <HStack mt="3" gap="2" flexWrap="wrap">
            {[["recent", "Récentes"], ["favorites", "Favorites"], ["unassigned", "À classer"]].map(([quick, label]) => (
              <Button key={quick} size="xs" variant={filters.quick === quick ? 'solid' : 'outline'} aria-pressed={filters.quick === quick}
                onClick={() => change({ quick })}>{label}</Button>
            ))}
            <Text fontSize="2xs" color={C.body}>À classer : patient, vue ou étape manquant — bouton « Classer » sur chaque photo, ou cochez-en plusieurs pour classer en lot.</Text>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap="2" mt="3">
            {[["view", "Toutes les vues", CLINICAL_VIEWS], ["stage", "Toutes les étapes", CLINICAL_STAGES]].map(([key, label, options]) => (
              <Select key={key} w="100%" aria-label={label} value={filters[key]} onChange={(e) => change({ [key]: e.target.value })}>
                <option value="">{label}</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </Select>
            ))}
            <Field label="Du"><Input type="date" size="sm" aria-label="Date de début" value={filters.from} onChange={(e) => change({ from: e.target.value })} /></Field>
            <Field label="Au"><Input type="date" size="sm" aria-label="Date de fin" value={filters.to} onChange={(e) => change({ to: e.target.value })} /></Field>
          </SimpleGrid>
        </>}
        <HStack mt="3" gap="2" flexWrap="wrap">
          {chips.map(([key, value]) => <Button key={key} size="xs" variant="outline" onClick={() => change(key === 'patient' ? { patient: '', session: '', day: '' } : { [key]: '' })}>{value} ×</Button>)}
          <Button size="xs" variant="plain" onClick={reset}>Tout effacer</Button>
        </HStack>
        {saved.length > 0 && <HStack mt="2" gap="2" flexWrap="wrap">
          <Text fontSize="2xs" color={C.body}>Mes recherches · cet appareil :</Text>
          {saved.map((s) => <HStack key={s.id} gap="0">
            <Button size="xs" variant="outline" onClick={() => setParams(new URLSearchParams(s.params), { replace: true })}>{s.name}</Button>
            <Button size="xs" variant="plain" aria-label={`Retirer la recherche ${s.name}`} onClick={() => storeSaved(saved.filter((item) => item.id !== s.id))}>×</Button>
          </HStack>)}
        </HStack>}
        {savedError && <Text fontSize="xs" role="alert" mt="2">{savedError}</Text>}
      </Card>
      {contextError && <Card p="4"><Text role="alert">{contextError}</Text><Button size="xs" onClick={() => setContextRetry((v) => v + 1)}>Réessayer</Button></Card>}
      {!context && !contextError && <Text fontSize="sm">Chargement de la photothèque…</Text>}
      {context && filters.tab === 'photos' && <>
      <HStack align="start" gap="4">
        <DossierTree dossiers={context.dossiers} currentId={filters.patient || null}
          allLabel="Toutes les photos" title="Dossiers"
          onNavigate={(id) => change({ patient: id || '', session: '', day: '' })}
          onMove={movePhotos} onFileDrop={importInto} />
        <Box flex="1" minW="0" position="relative" borderRadius="lg"
          outline={fileDrop.over ? `2px dashed ${C.primary}` : 'none'} outlineOffset="-2px"
          {...fileDrop.handlers}>
          {fileDrop.over && (
            <Box position="absolute" inset="0" zIndex="10" bg="blackAlpha.50" borderRadius="lg"
              display="flex" alignItems="center" justifyContent="center" pointerEvents="none">
              <Text fontSize="sm" fontWeight="600" color={C.primary}>
                Déposez pour importer {filters.patient ? `dans « ${patientName(filters.patient)} »` : 'sans dossier'}
              </Text>
            </Box>
          )}
        <HStack mb="3" gap="2" flexWrap="wrap">
          <Text fontSize="sm" fontWeight="700" color={C.ink}>{count == null ? 'Recherche…' : `${count} photo(s)`}</Text>
          {selected.length > 0 && <Text fontSize="2xs" color={C.muted}>— Ctrl+clic : ajouter, Shift+clic : plage, clic droit : menu</Text>}
          <Box flex="1" />
          <HStack gap="0" border="1px solid" borderColor={C.cardBorder} borderRadius="md" overflow="hidden">
            {[['grid', FiGrid, 'Vue vignettes'], ['list', FiList, 'Vue liste (détails)']].map(([mode, Icon, label]) => (
              <Box key={mode} as="button" px="2" py="1" aria-label={label} aria-pressed={viewMode === mode}
                bg={viewMode === mode ? C.softBlue : 'white'} color={viewMode === mode ? C.primary : 'gray.400'}
                onClick={() => setViewMode(mode)}><Icon /></Box>
            ))}
          </HStack>
          <Button size="xs" variant="outline" disabled={loading || busy || !rows.length} onClick={() => setSelected(rows.map((p) => p.id))}>Sélectionner cette page</Button>
          {selected.length > 0 && <Button size="xs" variant="plain" disabled={busy} onClick={() => setSelected([])}>Désélectionner</Button>}
        </HStack>
        {selected.length > 0 && <Card p="3" mb="3" bg={C.greenBg}>
          <Text fontSize="xs" fontWeight="700" color={C.greenText} mb="2">{selected.length} photo(s) sélectionnée(s)</Text>
          <HStack gap="2" flexWrap="wrap">
            {[["view", "Vue", CLINICAL_VIEWS], ["stage", "Étape", CLINICAL_STAGES]].map(([key, label, options]) => <Select key={key} disabled={busy}
              value={batch[key]} aria-label={`Attribuer ${label}`} onChange={(e) => setBatch((old) => ({ ...old, [key]: e.target.value }))}>
              <option value="">{label} : ne pas modifier</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              <option value="clear">Retirer l’étiquette</option>
            </Select>)}
            <PrimaryButton disabled={busy || (!batch.view && !batch.stage)} onClick={applyBatch}>Appliquer</PrimaryButton>
            <Select value={collectionId} disabled={busy} aria-label="Collection de destination" onChange={(e) => setCollectionId(e.target.value)}>
              <option value="">Ajouter à une collection…</option>{context.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button size="xs" variant="outline" disabled={busy || !collectionId} onClick={addSelection}>Ajouter</Button>
            <Select value={fileDossier} disabled={busy} aria-label="Dossier des photos sans patient" onChange={(e) => setFileDossier(e.target.value)}>
              <option value="">Ranger les photos sans patient…</option>
              {dossiers.filter((d) => !d.parent_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Button size="xs" variant="outline" disabled={busy || !fileDossier} onClick={fileSelection}>Ranger</Button>
          </HStack>
        </Card>}

        {loading && <Text fontSize="sm">Recherche en cours…</Text>}
        {error && <Card p="4"><Text role="alert">{error}</Text><Button size="xs" onClick={() => setRefresh((v) => v + 1)}>Réessayer</Button></Card>}
        {!loading && !error && !rows.length && (filters.patient ? (
          <EmptyPane py="12" textAlign="center">
            <VStack gap="2">
              <Box as={FiFolderMinus} fontSize="3xl" color="gray.300" />
              <Text fontSize="md" fontWeight="600" color={C.ink}>Ce dossier est vide</Text>
              <Text fontSize="sm" color="gray.500">« {patientName(filters.patient)} » ne contient aucune photo — glissez des images sur ce dossier dans l'arborescence pour les y ranger.</Text>
              <Button size="sm" variant="outline" mt="1" onClick={reset}>Toutes les photos</Button>
            </VStack>
          </EmptyPane>
        ) : (
          <Card p="5"><Text fontSize="sm">Aucune photo pour ces critères.</Text><Button size="xs" mt="2" onClick={reset}>Effacer les filtres</Button></Card>
        ))}
        {viewMode === 'grid' ? (
        <SimpleGrid columns={{ base: 2, md: 4, xl: 6 }} gap="3"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected([]) }}>
          {rows.map((p, idx) => { const cl = clinicalLabels(p); return <Card key={p.id} overflow="hidden" draggable
            title={fileInfo(p, patientName(p.dossier_id))}
            onDragStart={(e) => startPhotoDrag(e, selected.includes(p.id) ? selected : [p.id])}
            onClick={(e) => photoClick(e, p, idx)}
            onContextMenu={(e) => openMenu(e, p, idx)}
            boxShadow={selected.includes(p.id) ? `0 0 0 2px ${C.primary}` : 'none'}>
            <Box position="relative">
              <Box as="button" display="block" w="100%" aria-label={`Agrandir ${p.original_filename || 'la photo'}`} onClick={(e) => { e.stopPropagation(); setViewer(idx) }}>
                <PhotoImg storagePath={p.storage_path} ratio="4/3" borderRadius="0" />
              </Box>
              <Box position="absolute" top="1" left="1" bg={C.pageBg} px="1" borderRadius="sm" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" aria-label={`Sélectionner ${p.original_filename || 'la photo'}`} checked={selected.includes(p.id)} disabled={busy}
                  onChange={(e) => setSelected((ids) => e.target.checked ? [...new Set([...ids, p.id])] : ids.filter((id) => id !== p.id))} />
              </Box>
              <Box as="button" position="absolute" top="1" right="1" bg={C.pageBg} borderRadius="sm" p="1" color={p.is_favorite ? C.greenText : C.muted}
                aria-label={p.is_favorite ? 'Retirer des favorites' : 'Ajouter aux favorites'} aria-pressed={!!p.is_favorite} disabled={busy}
                onClick={(e) => { e.stopPropagation(); favorite(p) }}>
                <FiStar fill={p.is_favorite ? 'currentColor' : 'none'} />
              </Box>
            </Box>
            <Box p="2">
              <Box as="button" textAlign="left" disabled={!p.dossier_id} onClick={(e) => { e.stopPropagation(); setPatient(patientDossier(p.dossier_id)) }}>
                <Text fontSize="xs" fontWeight="700" color={C.ink} truncate>{patientName(p.dossier_id)}</Text>
              </Box>
              <Text fontSize="2xs" color={C.body} truncate>{p.original_filename || 'Photo'}</Text>
              <Text fontSize="2xs" color={C.muted}>{new Date(p.taken_at || p.created_at).toLocaleDateString('fr-FR')}</Text>
              <HStack gap="1" mt="1" flexWrap="wrap">
                {(!p.dossier_id || !cl.view || !cl.stage) && <Tag color="amber">À classer</Tag>}
                {cl.view && <Tag color="green">{labelFor(CLINICAL_VIEWS, cl.view)}</Tag>}
                {cl.stage && <Tag>{labelFor(CLINICAL_STAGES, cl.stage)}</Tag>}
              </HStack>
              <Button size="xs" variant="outline" w="100%" mt="2" disabled={busy}
                onClick={(e) => { e.stopPropagation(); openClassify(p) }}>
                <FiTag /> Classer la photo
              </Button>
            </Box>
          </Card>})}
        </SimpleGrid>
        ) : (
        <Card p="0" overflow="hidden">
          <HStack px="3" py="2" gap="3" borderBottom="1px solid" borderColor={C.cardBorder}>
            <Box w="44px" flexShrink={0} />
            <Text flex="1.6" fontSize="2xs" fontWeight="700" color="gray.500">FICHIER</Text>
            <Text flex="1" fontSize="2xs" fontWeight="700" color="gray.500">DOSSIER</Text>
            <Text w="90px" fontSize="2xs" fontWeight="700" color="gray.500">DATE</Text>
            <Text w="70px" fontSize="2xs" fontWeight="700" color="gray.500">TYPE</Text>
            <Text w="70px" fontSize="2xs" fontWeight="700" color="gray.500" textAlign="right">TAILLE</Text>
            <Text w="190px" fontSize="2xs" fontWeight="700" color="gray.500">ÉTIQUETTES</Text>
            <Box w="110px" flexShrink={0} />
          </HStack>
          {rows.map((p, idx) => { const cl = clinicalLabels(p); return (
            <HStack key={p.id} px="3" py="1.5" gap="3" cursor="default" draggable
              title={fileInfo(p, patientName(p.dossier_id))}
              bg={selected.includes(p.id) ? C.softBlue : 'transparent'}
              _hover={{ bg: C.softBlue }}
              onClick={(e) => photoClick(e, p, idx)}
              onContextMenu={(e) => openMenu(e, p, idx)}
              onDragStart={(e) => startPhotoDrag(e, selected.includes(p.id) ? selected : [p.id])}
              borderTop={idx ? '1px solid' : 'none'} borderColor={C.cardBorder}>
              <Box w="44px" flexShrink={0}><PhotoImg storagePath={p.storage_path} ratio="1/1" /></Box>
              <Text flex="1.6" fontSize="xs" color={C.ink} isTruncated>{p.original_filename || 'Photo'}</Text>
              <Text flex="1" fontSize="xs" color={C.body} isTruncated>{patientName(p.dossier_id)}</Text>
              <Text w="90px" fontSize="2xs" color={C.muted}>{new Date(p.taken_at || p.created_at).toLocaleDateString('fr-FR')}</Text>
              <Text w="70px" fontSize="2xs" color={C.muted}>{(p.mime || '').replace('image/', '').toUpperCase() || '—'}</Text>
              <Text w="70px" fontSize="2xs" color={C.muted} textAlign="right">{p.bytes ? `${(p.bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko` : '—'}</Text>
              <HStack w="190px" gap="1" flexWrap="wrap">
                {(!p.dossier_id || !cl.view || !cl.stage) && <Tag color="amber">À classer</Tag>}
                {cl.view && <Tag color="green">{labelFor(CLINICAL_VIEWS, cl.view)}</Tag>}
                {cl.stage && <Tag>{labelFor(CLINICAL_STAGES, cl.stage)}</Tag>}
              </HStack>
              <HStack w="110px" gap="1" flexShrink={0} justify="end">
                <Box as="button" p="1" color={p.is_favorite ? C.greenText : 'gray.300'} disabled={busy}
                  aria-label={p.is_favorite ? 'Retirer des favorites' : 'Ajouter aux favorites'}
                  onClick={(e) => { e.stopPropagation(); favorite(p) }}>
                  <FiStar fill={p.is_favorite ? 'currentColor' : 'none'} />
                </Box>
                <Button size="xs" variant="outline" disabled={busy}
                  onClick={(e) => { e.stopPropagation(); openClassify(p) }}>Classer</Button>
              </HStack>
            </HStack>
          )})}
        </Card>
        )}
        <HStack justify="center" my="4" gap="3">
          <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => change({ page: String(page - 1) })}>Précédente</Button>
          <Text fontSize="xs" color={C.body}>Page {page + 1}{count != null ? ` / ${Math.max(1, Math.ceil(count / pageSize))}` : ''}</Text>
          <Button size="sm" variant="outline" disabled={loading || count == null || (page + 1) * pageSize >= count} onClick={() => change({ page: String(page + 1) })}>Suivante</Button>
        </HStack>
        </Box>
      </HStack>
      </>}
      {context && filters.tab === 'patients' && <><SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
        {patients.slice(page * pageSize, (page + 1) * pageSize).map((d) => <Card key={d.id} p="4">
          <Text fontSize="sm" fontWeight="700" color={C.ink}>{d.name}</Text>
          <Text fontSize="xs" color={C.body}>{d.patientNames}{d.patient_dossier_number ? ` · N° ${d.patient_dossier_number}` : ''}</Text>
          <HStack gap="1" my="2" flexWrap="wrap">{(d.specialties || []).map((s) => <Tag key={s}>{s}</Tag>)}</HStack>
          <HStack gap="2" flexWrap="wrap">
            <Button size="xs" onClick={() => setPatient(d)}>Séances / comparer</Button>
            <Button size="xs" variant="outline" onClick={() => change({ ...LIBRARY_DEFAULTS, tab: 'photos', patient: d.id })}>Toutes les photos</Button>
          </HStack>
        </Card>)}
        {!patients.length && <Text fontSize="sm">Aucun patient / dossier pour cette recherche.</Text>}
      </SimpleGrid>
      <HStack justify="center" my="4" gap="3">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => change({ page: String(page - 1) })}>Précédente</Button>
        <Text fontSize="xs" color={C.body}>Page {page + 1} / {Math.max(1, Math.ceil(patients.length / pageSize))}</Text>
        <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= patients.length} onClick={() => change({ page: String(page + 1) })}>Suivante</Button>
      </HStack></>}
      {context && filters.tab === 'collections' && <CollectionsComponent globalQuery={filters.q} globalPatient={filters.patient} globalSpecialty={filters.specialty} matchingCollectionIds={collections.map((c) => c.id)}
        onCollectionsChange={(collections) => setContext((old) => old ? { ...old, collections } : old)} />}
      <PatientTimelineModal patient={patient} wsId={wsId} dossiers={dossiers} onClose={() => setPatient(null)}
        onShowGroup={(group) => { change({ ...LIBRARY_DEFAULTS, tab: 'photos', patient: patient.id, session: group.session, day: group.session ? '' : group.day }); setPatient(null) }}
        onCompare={(before, after) => nav(`/studio?edit=${before.id}&compare=${after.id}`)} />
      <Modal open={!!classify} onClose={() => setClassify(null)} title="Classer la photo"
        subtitle={classify?.photo.original_filename || ''} width="440px"
        footer={<>
          <Box />
          <HStack gap="2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setClassify(null)}>Annuler</Button>
            <PrimaryButton disabled={busy} onClick={saveClassify}>Enregistrer</PrimaryButton>
          </HStack>
        </>}>
        {classify && <>
          <Box w="120px" mb="4">
            <PhotoImg storagePath={classify.photo.storage_path} ratio="4/3" />
          </Box>
          <Field label="Patient / dossier">
            <Select w="100%" value={classify.dossierId} aria-label="Dossier de destination"
              onChange={(e) => setClassify((c) => ({ ...c, dossierId: e.target.value }))}>
              <option value="">Sans dossier</option>
              {dossiers.filter((d) => !d.parent_id).map((d) => <option key={d.id} value={d.id}>{d.name}{d.patient_dossier_number ? ` · ${d.patient_dossier_number}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Vue clinique" mt="3">
            <Select w="100%" value={classify.view} aria-label="Vue clinique"
              onChange={(e) => setClassify((c) => ({ ...c, view: e.target.value }))}>
              <option value="">Non définie</option>
              {CLINICAL_VIEWS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </Field>
          <Field label="Étape clinique" mt="3">
            <Select w="100%" value={classify.stage} aria-label="Étape clinique"
              onChange={(e) => setClassify((c) => ({ ...c, stage: e.target.value }))}>
              <option value="">Non définie</option>
              {CLINICAL_STAGES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </Field>
          <Text fontSize="2xs" color={C.muted} mt="3">
            Une photo est classée quand elle a un patient, une vue et une étape. Pour plusieurs photos : cochez-les puis utilisez la barre d’actions en haut.
          </Text>
        </>}
      </Modal>
      {/* visionneuse plein écran — flèches ← → pour naviguer dans la page courante */}
      <PhotoViewer photo={viewer != null ? rows[viewer] : null}
        counter={viewer != null ? `${viewer + 1} / ${rows.length}` : null}
        onClose={() => setViewer(null)}
        onPrev={viewer > 0 ? () => setViewer(viewer - 1) : null}
        onNext={viewer != null && viewer < rows.length - 1 ? () => setViewer(viewer + 1) : null}
        onStudio={(p) => nav(`/studio?edit=${p.id}`)} />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} items={menu ? [
        { icon: FiMaximize2, label: 'Agrandir', onClick: () => setViewer(rows.findIndex((x) => x.id === menu.photo.id)) },
        { icon: FiExternalLink, label: 'Ouvrir dans le Studio', onClick: () => nav(`/studio?edit=${menu.photo.id}`) },
        { icon: FiTag, label: 'Classer la photo…', onClick: () => openClassify(menu.photo) },
        { icon: FiStar, label: menu.photo.is_favorite ? 'Retirer des favorites' : 'Ajouter aux favorites', onClick: () => favorite(menu.photo) },
        '-',
        { icon: FiFolder, label: selected.length > 1 ? `Déplacer ${selected.length} photos vers un dossier…` : 'Déplacer vers un dossier…',
          onClick: () => setMoveForm({ ids: selected.length ? [...selected] : [menu.photo.id], dossierId: '' }) },
      ] : []} />
      <Modal open={!!moveForm} onClose={() => setMoveForm(null)} title="Déplacer vers un dossier"
        subtitle={moveForm ? `${moveForm.ids.length} photo(s) — le dossier de destination s'applique à toutes` : ''} width="420px"
        footer={<>
          <Box />
          <HStack gap="2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setMoveForm(null)}>Annuler</Button>
            <PrimaryButton disabled={busy || !moveForm?.dossierId}
              onClick={async () => { const f = moveForm; setMoveForm(null); await movePhotos(f.ids, f.dossierId) }}>Déplacer</PrimaryButton>
          </HStack>
        </>}>
        {moveForm && (
          <Field label="Dossier de destination">
            <Select w="100%" value={moveForm.dossierId} aria-label="Dossier de destination"
              onChange={(e) => setMoveForm((f) => ({ ...f, dossierId: e.target.value }))}>
              <option value="">Choisir un dossier…</option>
              {dossiers.filter((d) => !d.parent_id).map((d) => <option key={d.id} value={d.id}>{d.name}{d.patient_dossier_number ? ` · ${d.patient_dossier_number}` : ''}</option>)}
            </Select>
          </Field>
        )}
      </Modal>
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Enregistrer cette recherche" width="420px"
        footer={<PrimaryButton disabled={!saveName.trim() || !storageKey} onClick={saveSearch}>Enregistrer</PrimaryButton>}>
        <Field label="Nom"><Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Ex. Sourires · fins de traitement" /></Field>
        <Text fontSize="xs" color={C.body} mt="2">Conservée sur cet appareil pour votre compte et ce cabinet, jusqu’à 20 recherches. Les résultats sont recalculés à chaque ouverture. Aucun partage public n’est créé.</Text>
        {savedError && <Text fontSize="xs" role="alert">{savedError}</Text>}
      </Modal>
    </Box>
  )
}
