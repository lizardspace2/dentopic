import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, HStack, Input, SimpleGrid, Text } from '@chakra-ui/react'
import { FiFolder, FiStar } from 'react-icons/fi'
import { Card, Field, Modal, PageHeader, PrimaryButton, SearchInput, Select, Tag } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import PatientTimelineModal from './PatientTimelineModal'
import { useApp } from '../context/AppContext'
import { loadLibraryContext, searchLibraryPhotos, labelClinicalPhotos, setPhotoFavorite, addCollectionItem, fileUnassignedPhotos } from '../api'
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
  const [message, setMessage] = useState('')
  const [patient, setPatient] = useState(null)
  const [saved, setSaved] = useState([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [savedError, setSavedError] = useState('')
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

  useEffect(() => { setSelected([]); setMessage('') }, [filters, wsId])
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
    setBusy(true); setMessage('')
    try {
      const result = await labelClinicalPhotos(wsId, selected, {
        view: batch.view === 'clear' ? null : batch.view || undefined,
        stage: batch.stage === 'clear' ? null : batch.stage || undefined,
      })
      const updated = new Set(result.updated.map((p) => p.id))
      setSelected((ids) => ids.filter((id) => !updated.has(id)))
      setMessage(`${updated.size} photo(s) classée(s).${result.failed ? ` ${result.failed} échec(s) : réessayez.` : ''}`)
      setRefresh((v) => v + 1)
    } catch { setMessage('Enregistrement impossible. La sélection est conservée pour réessayer.') }
    finally { setBusy(false) }
  }
  const addSelection = async () => {
    if (!collectionId) return
    setBusy(true); setMessage('')
    try {
      const result = await Promise.all(selected.map(async (id) => ({ id, saved: await addCollectionItem(collectionId, { photo_id: id }, userId) })))
      const added = new Set(result.filter((r) => r.saved).map((r) => r.id))
      setSelected((ids) => ids.filter((id) => !added.has(id)))
      setMessage(`${added.size} photo(s) ajoutée(s), sans duplication des originaux.${added.size < result.length ? ' Certaines photos sont déjà présentes ou n’ont pas pu être ajoutées.' : ''}`)
    } catch { setMessage('Ajout interrompu. Vérifiez la collection avant de réessayer.') }
    finally { setBusy(false) }
  }
  const fileSelection = async () => {
    if (!fileDossier || !selected.length) return
    setBusy(true); setMessage('')
    try {
      const updated = await fileUnassignedPhotos(wsId, selected, fileDossier)
      const ids = new Set(updated.map((p) => p.id))
      setSelected((old) => old.filter((id) => !ids.has(id)))
      setMessage(`${ids.size} photo(s) rangée(s). Les photos déjà attribuées à un patient n’ont pas été déplacées.`)
      setRefresh((v) => v + 1)
    } catch { setMessage('Classement impossible. La sélection est conservée.') }
    finally { setBusy(false) }
  }
  const favorite = async (photo) => {
    setBusy(true); setMessage('')
    try { await setPhotoFavorite(wsId, photo.id, !photo.is_favorite); setRefresh((v) => v + 1) }
    catch { setMessage('Favori non enregistré. Réessayez.') }
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
            <Text fontSize="2xs" color={C.body}>À classer : patient, vue ou étape manquant.</Text>
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
        <HStack mb="3" gap="2" flexWrap="wrap">
          <Text fontSize="sm" fontWeight="700" color={C.ink}>{count == null ? 'Recherche…' : `${count} photo(s)`}</Text>
          <Box flex="1" />
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
        {message && <Text role="status" fontSize="xs" mb="3">{message}</Text>}
        {loading && <Text fontSize="sm">Recherche en cours…</Text>}
        {error && <Card p="4"><Text role="alert">{error}</Text><Button size="xs" onClick={() => setRefresh((v) => v + 1)}>Réessayer</Button></Card>}
        {!loading && !error && !rows.length && <Card p="5"><Text fontSize="sm">Aucune photo pour ces critères.</Text><Button size="xs" mt="2" onClick={reset}>Effacer les filtres</Button></Card>}
        <SimpleGrid columns={{ base: 2, md: 4, xl: 6 }} gap="3">
          {rows.map((p) => <Card key={p.id} overflow="hidden">
            <Box position="relative">
              <Box as="button" display="block" w="100%" aria-label={`Ouvrir ${p.original_filename || 'la photo'} dans le Studio`} onClick={() => nav(`/studio?edit=${p.id}`)}>
                <PhotoImg storagePath={p.storage_path} ratio="4/3" borderRadius="0" />
              </Box>
              <Box position="absolute" top="1" left="1" bg={C.pageBg} px="1" borderRadius="sm">
                <input type="checkbox" aria-label={`Sélectionner ${p.original_filename || 'la photo'}`} checked={selected.includes(p.id)} disabled={busy}
                  onChange={(e) => setSelected((ids) => e.target.checked ? [...new Set([...ids, p.id])] : ids.filter((id) => id !== p.id))} />
              </Box>
              <Box as="button" position="absolute" top="1" right="1" bg={C.pageBg} borderRadius="sm" p="1" color={p.is_favorite ? C.greenText : C.muted}
                aria-label={p.is_favorite ? 'Retirer des favorites' : 'Ajouter aux favorites'} aria-pressed={!!p.is_favorite} disabled={busy} onClick={() => favorite(p)}>
                <FiStar fill={p.is_favorite ? 'currentColor' : 'none'} />
              </Box>
            </Box>
            <Box p="2">
              <Box as="button" textAlign="left" disabled={!p.dossier_id} onClick={() => setPatient(patientDossier(p.dossier_id))}>
                <Text fontSize="xs" fontWeight="700" color={C.ink} truncate>{patientName(p.dossier_id)}</Text>
              </Box>
              <Text fontSize="2xs" color={C.body} truncate>{p.original_filename || 'Photo'}</Text>
              <Text fontSize="2xs" color={C.muted}>{new Date(p.taken_at || p.created_at).toLocaleDateString('fr-FR')}</Text>
              <HStack gap="1" mt="1" flexWrap="wrap">
                {clinicalLabels(p).view && <Tag color="green">{labelFor(CLINICAL_VIEWS, clinicalLabels(p).view)}</Tag>}
                {clinicalLabels(p).stage && <Tag>{labelFor(CLINICAL_STAGES, clinicalLabels(p).stage)}</Tag>}
              </HStack>
            </Box>
          </Card>)}
        </SimpleGrid>
        <HStack justify="center" my="4" gap="3">
          <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => change({ page: String(page - 1) })}>Précédente</Button>
          <Text fontSize="xs" color={C.body}>Page {page + 1}{count != null ? ` / ${Math.max(1, Math.ceil(count / pageSize))}` : ''}</Text>
          <Button size="sm" variant="outline" disabled={loading || count == null || (page + 1) * pageSize >= count} onClick={() => change({ page: String(page + 1) })}>Suivante</Button>
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
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Enregistrer cette recherche" width="420px"
        footer={<PrimaryButton disabled={!saveName.trim() || !storageKey} onClick={saveSearch}>Enregistrer</PrimaryButton>}>
        <Field label="Nom"><Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Ex. Sourires · fins de traitement" /></Field>
        <Text fontSize="xs" color={C.body} mt="2">Conservée sur cet appareil pour votre compte et ce cabinet, jusqu’à 20 recherches. Les résultats sont recalculés à chaque ouverture. Aucun partage public n’est créé.</Text>
        {savedError && <Text fontSize="xs" role="alert">{savedError}</Text>}
      </Modal>
    </Box>
  )
}
