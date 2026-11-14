import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Flex, HStack, Input, SimpleGrid, Text } from '@chakra-ui/react'
import { FiSearch, FiFilter } from 'react-icons/fi'
import { Card, EmptyPane, Select, Field, PrimaryButton, Tag, Tip, PageHeader, SearchInput } from '../components/ui'
import { FolderTile } from '../components/Explorer'
import PhotoImg from '../components/PhotoImg'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { loadSearchData } from '../api'

const PERIODS = [
  ['all', 'Toute période'],
  ['7d', '7 jours'],
  ['30d', '30 jours'],
  ['1y', '1 an'],
]
const PERIOD_MS = { '7d': 7 * 864e5, '30d': 30 * 864e5, '1y': 365 * 864e5 }

const EMPTY = {
  q: '', tag: '', diagnostic: '', traitement: '', materiau: '', severite: '',
  aiClass: '', statut: '', sexe: '', ageMin: '', ageMax: '',
}
const FIELD_LABELS = {
  tag: 'Tag', diagnostic: 'Diagnostic', traitement: 'Traitement', materiau: 'Matériau',
  severite: 'Sévérité', aiClass: 'Classe IA', statut: 'Statut', sexe: 'Sexe',
  ageMin: 'Âge min', ageMax: 'Âge max',
}
const STATUT_LABELS = { favorite: 'Photo favorite', unsorted: 'Photo non triée', draft: 'Montage brouillon', finalized: 'Montage finalisé' }

const TextInput = (p) => <Input fontSize="sm" bg="white" {...p} />
const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const match = (hay, needle) => !needle || norm(hay).includes(norm(needle))
const ageOf = (birth) => birth ? Math.floor((Date.now() - new Date(birth)) / 315576e5) : null

export default function Recherche() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const nav = useNavigate()
  const [f, setF] = useState(EMPTY)          // brouillon des champs
  const [applied, setApplied] = useState(EMPTY) // filtres réellement appliqués
  const [period, setPeriod] = useState('all')
  const [periodApplied, setPeriodApplied] = useState('all')
  const [advOpen, setAdvOpen] = useState(() => {
    try { return localStorage.getItem('dentopic.searchFiltersOpen') === '1' } catch { return false }
  })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const search = () => { setApplied(f); setPeriodApplied(period) }
  const toggleAdv = () => setAdvOpen((v) => {
    const n = !v
    try { localStorage.setItem('dentopic.searchFiltersOpen', n ? '1' : '0') } catch { /* privé */ }
    return n
  })
  // critères avancés appliqués → cartouches + compteur + ouverture auto
  const advApplied = Object.entries(applied).filter(([k, v]) => k !== 'q' && v)
  const advCount = advApplied.length + (periodApplied !== 'all' ? 1 : 0)
  const panelOpen = advOpen || advCount > 0
  const clearCriterion = (k) => { setF((s) => ({ ...s, [k]: '' })); setApplied((s) => ({ ...s, [k]: '' })) }

  useEffect(() => {
    if (!wsId) return
    setLoading(true)
    loadSearchData(wsId).then((d) => { setData(d); setLoading(false) })
  }, [wsId])

  const tags = useMemo(() =>
    [...new Set((data?.dossiers || []).flatMap((d) => d.specialties || []))].sort(),
  [data])

  const aiClasses = useMemo(() =>
    [...new Set(Object.values(data?.preds || {}).map((p) => p.label).filter(Boolean))].sort(),
  [data])

  // Dossiers correspondant aux critères texte/patient (restreint ensuite photos/montages)
  const dossierOk = useMemo(() => {
    if (!data) return new Set()
    const patByDossier = Object.fromEntries(data.patients.map((p) => [p.dossier_id, p]))
    const ok = new Set()
    for (const d of data.dossiers) {
      const pat = patByDossier[d.id]
      const hay = [d.name, d.patient_dossier_number, d.description,
        pat?.last_name, pat?.first_name, ...(d.specialties || [])].join(' ')
      if (!match(hay, applied.q)) continue
      if (applied.tag && !(d.specialties || []).includes(applied.tag)) continue
      if (!match(hay, applied.diagnostic)) continue
      if (!match(hay, applied.traitement)) continue
      if (!match(hay, applied.materiau)) continue
      if (!match(hay, applied.severite)) continue
      if (applied.sexe && pat?.sex !== applied.sexe) continue
      const age = ageOf(pat?.birth_date)
      if (applied.ageMin && (age == null || age < +applied.ageMin)) continue
      if (applied.ageMax && (age == null || age > +applied.ageMax)) continue
      if (PERIOD_MS[periodApplied] && Date.now() - new Date(d.updated_at || d.created_at) > PERIOD_MS[periodApplied]) continue
      ok.add(d.id)
    }
    return ok
  }, [data, applied, periodApplied])

  const dossierFilterActive = applied.q || applied.tag || applied.diagnostic || applied.traitement
    || applied.materiau || applied.severite || applied.sexe || applied.ageMin || applied.ageMax

  const results = useMemo(() => {
    if (!data) return null
    const dossiers = data.dossiers.filter((d) => dossierOk.has(d.id))
    const inPeriod = (date) => !PERIOD_MS[periodApplied] || Date.now() - new Date(date) <= PERIOD_MS[periodApplied]
    const inDossier = (dossierId) => !dossierFilterActive
      ? true
      : (dossierId && dossierOk.has(dossierId))
    const statutPhoto = !applied.statut || applied.statut === 'favorite' || applied.statut === 'unsorted'
    const statutMontage = !applied.statut || applied.statut === 'draft' || applied.statut === 'finalized'
    const photos = statutPhoto ? data.photos.filter((p) =>
      inDossier(p.dossier_id)
      && inPeriod(p.created_at)
      && match(data.preds[p.id]?.label || '', applied.aiClass)
      && (!applied.statut || (applied.statut === 'favorite' ? p.is_favorite : !p.dossier_id))) : []
    const montages = statutMontage ? data.montages.filter((m) =>
      inDossier(m.dossier_id)
      && inPeriod(m.created_at)
      && (!applied.statut || m.status === applied.statut)) : []
    return { dossiers, photos, montages }
  }, [data, dossierOk, dossierFilterActive, applied, periodApplied])

  const patByDossier = useMemo(() =>
    Object.fromEntries((data?.patients || []).map((p) => [p.dossier_id, p])), [data])
  const dossierName = useMemo(() =>
    Object.fromEntries((data?.dossiers || []).map((d) => [d.id, d.name])), [data])
  const photoCountByDossier = useMemo(() => {
    const m = {}
    for (const p of data?.photos || []) if (p.dossier_id) m[p.dossier_id] = (m[p.dossier_id] || 0) + 1
    return m
  }, [data])
  const total = results ? results.dossiers.length + results.photos.length + results.montages.length : 0

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader icon={FiSearch} title="Recherche"
        subtitle="Retrouvez dossiers, photos, montages et cas cliniques." />

      {/* barre compacte + panneau de filtres dépliable — cartouches des
          filtres appliqués, façon comparateurs de vols */}
      <Card p="3" mb="4">
        <HStack gap="2" flexWrap="wrap">
          <Box flex="1" minW="200px">
            <SearchInput w="100%" placeholder="N° de dossier, n° de cas, nom ou patient — ex. 2024-001, Dupont…"
              value={f.q} onChange={set('q')} onKeyDown={(e) => { if (e.key === 'Enter') search() }} />
          </Box>
          <PrimaryButton icon={FiSearch} onClick={search}>Rechercher</PrimaryButton>
          <Button size="sm" variant={panelOpen ? 'solid' : 'outline'} borderRadius="full"
            aria-expanded={panelOpen} onClick={toggleAdv}>
            <HStack gap="1"><FiFilter /><Text>Filtres{advCount ? ` (${advCount})` : ''}</Text></HStack>
          </Button>
        </HStack>
        {(advCount > 0 || applied.q) && (
          <HStack mt="2" gap="2" flexWrap="wrap">
            {applied.q && <Button size="xs" variant="outline" borderRadius="full" onClick={() => clearCriterion('q')}>{applied.q} ×</Button>}
            {advApplied.map(([k, v]) => (
              <Button key={k} size="xs" variant="outline" borderRadius="full" onClick={() => clearCriterion(k)}>
                {FIELD_LABELS[k]} : {k === 'statut' ? (STATUT_LABELS[v] || v) : v} ×
              </Button>
            ))}
            {periodApplied !== 'all' && (
              <Button size="xs" variant="outline" borderRadius="full"
                onClick={() => { setPeriod('all'); setPeriodApplied('all') }}>
                Période : {PERIODS.find(([k]) => k === periodApplied)?.[1]} ×
              </Button>
            )}
            <Button size="xs" variant="plain"
              onClick={() => { setF(EMPTY); setApplied(EMPTY); setPeriod('all'); setPeriodApplied('all') }}>
              Tout effacer
            </Button>
          </HStack>
        )}
        {panelOpen && <Box mt="3" pt="3" borderTop="1px solid" borderColor={C.cardBorder}>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap="3" mb="3">
            <Field label="Tag">
              <Select w="100%" h="30px" fontSize="xs" borderRadius="full" value={f.tag} onChange={set('tag')}>
                <option value="">Tous les tags</option>
                {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Diagnostic"><TextInput h="30px" fontSize="xs" borderRadius="full" placeholder="ex. Carie" value={f.diagnostic} onChange={set('diagnostic')} /></Field>
            <Field label="Type de traitement"><TextInput h="30px" fontSize="xs" borderRadius="full" placeholder="ex. Facette" value={f.traitement} onChange={set('traitement')} /></Field>
            <Field label="Matériau"><TextInput h="30px" fontSize="xs" borderRadius="full" placeholder="ex. Céramique" value={f.materiau} onChange={set('materiau')} /></Field>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap="3" mb="3">
            <Field label="Sévérité"><TextInput h="30px" fontSize="xs" borderRadius="full" placeholder="ex. Sévère" value={f.severite} onChange={set('severite')} /></Field>
            <Field label="Classe IA photo">
              <Select w="100%" h="30px" fontSize="xs" borderRadius="full" value={f.aiClass} onChange={set('aiClass')}>
                <option value="">Toutes</option>
                {aiClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Statut">
              <Select w="100%" h="30px" fontSize="xs" borderRadius="full" value={f.statut} onChange={set('statut')}>
                <option value="">Tous</option>
                {Object.entries(STATUT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Sexe">
              <Select w="100%" h="30px" fontSize="xs" borderRadius="full" value={f.sexe} onChange={set('sexe')}>
                <option value="">Tous</option>
                <option value="F">F</option>
                <option value="M">M</option>
              </Select>
            </Field>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 2, md: 4 }} gap="3" mb="4">
            <Field label="Âge min"><TextInput h="30px" fontSize="xs" borderRadius="full" type="number" value={f.ageMin} onChange={set('ageMin')} /></Field>
            <Field label="Âge max"><TextInput h="30px" fontSize="xs" borderRadius="full" type="number" value={f.ageMax} onChange={set('ageMax')} /></Field>
          </SimpleGrid>
          <HStack gap="2" flexWrap="wrap">
            <HStack gap="0">
              {PERIODS.map(([k, label], i) => (
                <Button key={k} size="xs" borderRadius={i === 0 ? 'full 0 0 full' : i === PERIODS.length - 1 ? '0 full full 0' : '0'}
                  variant={period === k ? 'solid' : 'outline'} onClick={() => setPeriod(k)}>
                  {label}
                </Button>
              ))}
            </HStack>
            <Box flex="1" />
            <Button variant="outline" size="sm" borderRadius="full" color="gray.600"
              onClick={() => { setF(EMPTY); setApplied(EMPTY); setPeriod('all'); setPeriodApplied('all') }}>
              Réinitialiser
            </Button>
          </HStack>
        </Box>}
      </Card>

      {loading && <EmptyPane><Text fontSize="sm" color="gray.500">Chargement…</Text></EmptyPane>}

      {!loading && results && total === 0 && (
        <EmptyPane>
          <Text fontSize="sm" fontWeight="600" color={C.ink} mb="1">Aucun résultat</Text>
          <Text fontSize="xs" color="gray.500">
            Modifiez votre recherche ou ajoutez un terme plus général.
          </Text>
        </EmptyPane>
      )}

      {!loading && results && total > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="600" color={C.ink} mb="3">
            {total} résultat{total > 1 ? 's' : ''}
          </Text>

          {results.dossiers.length > 0 && (
            <>
              <Text fontSize="xs" fontWeight="700" color="gray.500" mb="2">
                DOSSIERS ({results.dossiers.length})
              </Text>
              <Flex flexWrap="wrap" gap="1" mb="5">
                {results.dossiers.map((d) => {
                  const pat = patByDossier[d.id]
                  const photos = photoCountByDossier[d.id] || 0
                  const info = [
                    d.name,
                    pat ? `Patient : ${[pat.first_name, pat.last_name].filter(Boolean).join(' ')}` : null,
                    `${photos} photo(s)`,
                    d.patient_dossier_number ? `Dossier n° ${d.patient_dossier_number}` : null,
                    (d.specialties || []).length ? `Spécialités : ${d.specialties.join(', ')}` : null,
                  ].filter(Boolean).join('\n')
                  return (
                    <FolderTile key={d.id} dossier={d} size={64} w="118px" title={info}
                      subtitle={`${photos} photo(s)`}
                      onOpen={(fid) => nav(`/dossier-patient/dossier/${fid}`)} />
                  )
                })}
              </Flex>
            </>
          )}

          {results.photos.length > 0 && (
            <>
              <Text fontSize="xs" fontWeight="700" color="gray.500" mb="2">
                PHOTOS ({results.photos.length})
              </Text>
              <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} gap="3" mb="5">
                {results.photos.map((p) => (
                  <Tip key={p.id} label={dossierName[p.dossier_id] || 'Non triée'}>
                    <Box cursor="pointer"
                      onClick={() => p.dossier_id && nav(`/dossier-patient/dossier/${p.dossier_id}`)}>
                      <PhotoImg storagePath={p.storage_path} ratio="1/1" borderRadius="md" />
                      <HStack mt="1" gap="1">
                        {p.is_favorite && <Tag color="yellow">Favori</Tag>}
                        {data.preds[p.id]?.label && <Tag color="blue">{data.preds[p.id].label}</Tag>}
                        {p.tooth_shade && <Tag color="purple">{p.tooth_shade}</Tag>}
                      </HStack>
                    </Box>
                  </Tip>
                ))}
              </SimpleGrid>
            </>
          )}

          {results.montages.length > 0 && (
            <>
              <Text fontSize="xs" fontWeight="700" color="gray.500" mb="2">
                MONTAGES ({results.montages.length})
              </Text>
              <SimpleGrid columns={{ base: 1, md: 3, lg: 4 }} gap="3">
                {results.montages.map((m) => (
                  <Card key={m.id} p="3">
                    <Text fontSize="sm" fontWeight="600" color={C.ink} noOfLines={1}>
                      {m.name || 'Montage'}
                    </Text>
                    <HStack mt="1" gap="1">
                      <Tag color={m.status === 'finalized' ? 'green' : 'gray'}>
                        {m.status === 'finalized' ? 'Finalisé' : 'Brouillon'}
                      </Tag>
                      {dossierName[m.dossier_id] && <Tag>{dossierName[m.dossier_id]}</Tag>}
                    </HStack>
                  </Card>
                ))}
              </SimpleGrid>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}
