import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, HStack, Input, SimpleGrid, Text } from '@chakra-ui/react'
import { FiSearch, FiBookmark, FiFolder } from 'react-icons/fi'
import { Card, EmptyPane, Select, Field, PrimaryButton, Tag, Tip } from '../components/ui'
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const search = () => { setApplied(f); setPeriodApplied(period) }

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
  const total = results ? results.dossiers.length + results.photos.length + results.montages.length : 0

  return (
    <Box w="100%" px="6" py="6">
      <HStack gap="3" mb="6">
        <Box as={FiSearch} color="blue.500" fontSize="xl" />
        <Box>
          <Text fontSize="xl" fontWeight="700" letterSpacing="-0.01em" color={C.ink}>
            Recherche multicritères
          </Text>
          <Text fontSize="sm" color="gray.500">
            Retrouvez dossiers, photos, montages et cas cliniques.
          </Text>
        </Box>
      </HStack>

      <Card p="6" mb="5">
        <Text fontSize="sm" fontWeight="600" color={C.ink} mb="4">Filtres</Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mb="4">
          <Field label="N° de dossier patient / N° de cas / nom">
            <TextInput placeholder="ex. 2024-001, Patient Dupont…" value={f.q} onChange={set('q')} />
          </Field>
          <Field label="Tag">
            <Select w="100%" value={f.tag} onChange={set('tag')}>
              <option value="">Tous les tags</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 4 }} gap="4" mb="4">
          <Field label="Diagnostic"><TextInput placeholder="ex. Carie" value={f.diagnostic} onChange={set('diagnostic')} /></Field>
          <Field label="Type de traitement"><TextInput placeholder="ex. Facette" value={f.traitement} onChange={set('traitement')} /></Field>
          <Field label="Matériau"><TextInput placeholder="ex. Céramique" value={f.materiau} onChange={set('materiau')} /></Field>
          <Field label="Sévérité"><TextInput placeholder="ex. Sévère" value={f.severite} onChange={set('severite')} /></Field>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 4 }} gap="4" mb="4">
          <Field label="Classe IA photo">
            <Select w="100%" value={f.aiClass} onChange={set('aiClass')}>
              <option value="">Toutes</option>
              {aiClasses.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Statut">
            <Select w="100%" value={f.statut} onChange={set('statut')}>
              <option value="">Tous</option>
              <option value="favorite">Photo favorite</option>
              <option value="unsorted">Photo non triée</option>
              <option value="draft">Montage brouillon</option>
              <option value="finalized">Montage finalisé</option>
            </Select>
          </Field>
          <Field label="Sexe">
            <Select w="100%" value={f.sexe} onChange={set('sexe')}>
              <option value="">Tous</option>
              <option value="F">F</option>
              <option value="M">M</option>
            </Select>
          </Field>
          <Field label="Âge min"><TextInput type="number" value={f.ageMin} onChange={set('ageMin')} /></Field>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 4 }} gap="4" mb="5">
          <Field label="Âge max"><TextInput type="number" value={f.ageMax} onChange={set('ageMax')} /></Field>
        </SimpleGrid>

        <HStack gap="0" mb="5">
          {PERIODS.map(([k, label], i) => (
            <Button
              key={k} size="xs"
              borderRadius={i === 0 ? 'md 0 0 md' : '0'}
              bg={period === k ? C.primary : 'white'}
              color={period === k ? '#ffffff' : 'gray.600'}
              border="1px solid" borderColor="gray.200"
              onClick={() => setPeriod(k)}
            >
              {label}
            </Button>
          ))}
        </HStack>

        <HStack gap="3">
          <PrimaryButton icon={FiSearch} onClick={search}>Rechercher</PrimaryButton>
          <Button variant="outline" size="sm" color="gray.600"
            onClick={() => { setF(EMPTY); setApplied(EMPTY); setPeriod('all'); setPeriodApplied('all') }}>
            Réinitialiser
          </Button>
          <Button variant="outline" size="sm" color="gray.600">
            <FiBookmark /> Enregistrer la recherche
          </Button>
        </HStack>
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
              <SimpleGrid columns={{ base: 1, md: 3, lg: 4 }} gap="3" mb="5">
                {results.dossiers.map((d) => {
                  const pat = patByDossier[d.id]
                  return (
                    <Card key={d.id} p="3" cursor="pointer" _hover={{ shadow: 'md' }}
                      onClick={() => nav(`/dossier-patient/dossier/${d.id}`)}>
                      <HStack gap="2" mb="1">
                        <Box as={FiFolder} color={C.primary} />
                        <Text fontSize="sm" fontWeight="600" color={C.ink} noOfLines={1}>{d.name}</Text>
                      </HStack>
                      {d.patient_dossier_number && (
                        <Text fontSize="2xs" color="gray.400">n° {d.patient_dossier_number}</Text>
                      )}
                      {pat && (
                        <Text fontSize="2xs" color="gray.500">
                          {[pat.first_name, pat.last_name].filter(Boolean).join(' ')}
                          {pat.birth_date ? ` · ${ageOf(pat.birth_date)} ans` : ''}
                          {pat.sex ? ` · ${pat.sex}` : ''}
                        </Text>
                      )}
                      {(d.specialties || []).length > 0 && (
                        <HStack gap="1" mt="1" flexWrap="wrap">
                          {d.specialties.slice(0, 3).map((s) => <Tag key={s}>{s}</Tag>)}
                        </HStack>
                      )}
                    </Card>
                  )
                })}
              </SimpleGrid>
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
