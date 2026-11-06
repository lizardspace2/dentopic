import { useEffect, useMemo, useState } from 'react'
import { Box, Button, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { Modal, Select, Tag } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { listPatientTimeline } from '../api'
import { CLINICAL_VIEWS, CLINICAL_STAGES, clinicalLabels } from '../clinical'
import { expandDossierIds, patientPhotoGroups } from '../phototheque'
import { C } from '../theme'

export default function PatientTimelineModal({ patient, wsId, dossiers, onClose, onShowGroup, onCompare }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [sessions, setSessions] = useState(['', ''])
  const [view, setView] = useState('smile')
  const [picked, setPicked] = useState([null, null])
  const groups = useMemo(() => patientPhotoGroups(photos), [photos])
  const groupTitle = (g) => `${g.day || 'Sans date'} · ${g.photos.length} photo(s)${g.session ? ' · séance de capture' : ' · regroupement par date'}`

  useEffect(() => {
    if (!patient || !wsId) return
    const controller = new AbortController()
    setLoading(true); setPhotos([]); setError('')
    listPatientTimeline(wsId, expandDossierIds(dossiers, [patient.id]), controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return
        setPhotos(rows)
        const ordered = patientPhotoGroups(rows)
        setSessions([ordered.at(-1)?.key || '', ordered.length > 1 ? ordered[0].key : ''])
      })
      .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les séances.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [patient?.id, wsId, dossiers, retry])

  useEffect(() => { setPicked([null, null]) }, [sessions, view, patient?.id])
  const candidates = sessions.map((key) => (groups.find((g) => g.key === key)?.photos || [])
    .filter((p) => clinicalLabels(p).view === view))
  const sameSession = sessions[0] && sessions[0] === sessions[1]

  return (
    <Modal open={!!patient} onClose={onClose} title={patient?.name || 'Patient'} width="900px"
      subtitle="Séances du patient et comparaison de vues correspondantes.">
      <VStack align="stretch" gap="3">
        {loading && <Text fontSize="sm">Chargement des séances…</Text>}
        {error && <HStack><Text role="alert" fontSize="sm">{error}</Text><Button size="xs" onClick={() => setRetry((v) => v + 1)}>Réessayer</Button></HStack>}
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="2" maxH="240px" overflowY="auto">
          {groups.map((g) => {
            const stages = [...new Set(g.photos.map((p) => clinicalLabels(p).stage).filter(Boolean))]
            return <Box key={g.key} p="3" border="1px solid" borderColor={C.cardBorder} borderRadius="md">
              <Text fontSize="xs" fontWeight="700" color={C.ink}>{groupTitle(g)}</Text>
              <HStack gap="1" flexWrap="wrap" my="2">{stages.map((stage) => <Tag key={stage} color="green">{CLINICAL_STAGES.find(([id]) => id === stage)?.[1] || stage}</Tag>)}</HStack>
              <Button size="xs" variant="outline" onClick={() => onShowGroup(g)}>Voir les photos</Button>
            </Box>
          })}
        </SimpleGrid>
        {!loading && !error && !groups.length && <Text fontSize="sm">Aucune photo dans ce dossier.</Text>}
        {groups.length > 1 && <Box p="3" bg={C.greenBg} border="1px solid" borderColor={C.greenBorder} borderRadius="md">
          <Text fontSize="sm" fontWeight="700" color={C.greenText} mb="2">Comparer deux séances</Text>
          <Select w="100%" value={view} aria-label="Vue à comparer" onChange={(e) => setView(e.target.value)}>
            {CLINICAL_VIEWS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" mt="3">
            {[0, 1].map((side) => <Box key={side}>
              <Text fontSize="xs" fontWeight="700" color={C.ink} mb="1">{side ? 'APRÈS' : 'AVANT'}</Text>
              <Select w="100%" value={sessions[side]} aria-label={`Séance ${side ? 'après' : 'avant'}`}
                onChange={(e) => setSessions((old) => old.map((key, i) => i === side ? e.target.value : key))}>
                <option value="">Choisir une séance</option>
                {groups.map((g) => <option key={g.key} value={g.key}>{groupTitle(g)}</option>)}
              </Select>
              <SimpleGrid columns={3} gap="2" mt="2" maxH="180px" overflowY="auto">
                {candidates[side].map((p) => <Box as="button" key={p.id} border="2px solid" borderRadius="md" overflow="hidden"
                  borderColor={picked[side]?.id === p.id ? C.greenText : C.cardBorder}
                  aria-label={`Choisir ${p.original_filename || 'la photo'} ${side ? 'après' : 'avant'}`}
                  aria-pressed={picked[side]?.id === p.id} onClick={() => setPicked((old) => old.map((value, i) => i === side ? p : value))}>
                  <PhotoImg storagePath={p.storage_path} ratio="1" />
                </Box>)}
              </SimpleGrid>
              {sessions[side] && !candidates[side].length && <Text fontSize="xs" color={C.body} mt="2">Cette vue n’est pas étiquetée dans cette séance. Classez les photos par Vue pour la retrouver ici.</Text>}
            </Box>)}
          </SimpleGrid>
          {sameSession && <Text fontSize="xs" role="alert" mt="2">Choisissez deux séances différentes.</Text>}
          <Button size="sm" mt="3" disabled={!picked[0] || !picked[1] || sameSession || picked[0]?.id === picked[1]?.id}
            onClick={() => onCompare(picked[0], picked[1])}>Comparer dans le Studio</Button>
          <Text fontSize="2xs" color={C.body} mt="2">Seules les photos de la même vue sont proposées. Aucun appariement arbitraire n’est effectué.</Text>
        </Box>}
      </VStack>
    </Modal>
  )
}
