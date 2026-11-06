import { useEffect, useState } from 'react'
import { Box, Button, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { Modal, Select } from '../../components/ui'
import PhotoImg from '../../components/PhotoImg'
import { listClinicalReferences, listProtocols, saveClinicalReference } from '../../api'
import { STUDIO_PROTOCOLS, clinicalLabels } from '../../clinical'
import { C } from '../../theme'

function FramingGuide({ photoClass }) {
  const portrait = photoClass === 'portrait'
  return (
    <Box color={C.greenText} bg={C.greenBg} borderRadius="md" p="2">
      <svg viewBox="0 0 240 160" width="100%" height="120" role="img" aria-label="Repère schématique de cadrage">
        <rect x="15" y="10" width="210" height="140" rx="8" fill="none" stroke="currentColor" />
        <path d="M120 10V150 M15 80H225" fill="none" stroke="currentColor" strokeDasharray="5 5" />
        {portrait ? <ellipse cx="120" cy="80" rx="42" ry="60" fill="none" stroke="currentColor" strokeWidth="2" />
          : <ellipse cx="120" cy="80" rx="85" ry="40" fill="none" stroke="currentColor" strokeWidth="2" />}
        <path d={portrait ? 'M85 60H155' : 'M40 80H200'} fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>
      <Text fontSize="2xs" textAlign="center">Schéma de centrage indicatif, pas une référence anatomique.</Text>
    </Box>
  )
}

export default function ProtocolGuideModal({ open, onClose, wsId, sourcePhoto, canOverlay, onPhotoChange, onUseReference }) {
  const [custom, setCustom] = useState([])
  const [photos, setPhotos] = useState([])
  const [protocolId, setProtocolId] = useState(STUDIO_PROTOCOLS[0].id)
  const [stepId, setStepId] = useState('portrait-face')
  const [referenceId, setReferenceId] = useState(null)
  const [tab, setTab] = useState('protocol')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const protocols = [...STUDIO_PROTOCOLS, ...custom]
  const protocol = protocols.find((p) => p.id === protocolId) || protocols[0]
  const steps = protocol.steps || []
  const step = steps.find((s) => s.id === stepId) || steps[0]
  const references = photos.filter((p) => Array.isArray(clinicalLabels(p).referenceViews)
    && clinicalLabels(p).referenceViews.includes(step?.id))
  const reference = references.find((p) => p.id === referenceId) || references[0]
  const index = steps.findIndex((s) => s.id === step?.id)

  useEffect(() => {
    if (!open || !wsId) return
    let active = true
    setLoading(true); setError(''); setMessage(''); setPhotos([]); setCustom([])
    Promise.allSettled([
      listProtocols(wsId, { throwOnError: true }),
      listClinicalReferences(wsId),
    ]).then(([ps, images]) => {
      if (!active) return
      if (ps.status === 'fulfilled') setCustom(ps.value)
      if (images.status === 'fulfilled') setPhotos(images.value)
      if (ps.status === 'rejected' || images.status === 'rejected') setError('Certaines données du cabinet sont indisponibles. Les modèles prédéfinis restent utilisables.')
      setLoading(false)
    })
    return () => { active = false }
  }, [open, wsId, retry])

  useEffect(() => { setReferenceId(null); setMessage('') }, [protocolId, stepId])

  const saveReference = async () => {
    if (!sourcePhoto || !step) return
    setBusy(true); setError(''); setMessage('')
    try {
      const saved = await saveClinicalReference(wsId, sourcePhoto.id, step.id)
      setPhotos((rows) => [saved, ...rows.filter((p) => p.id !== saved.id)])
      onPhotoChange(saved)
      setReferenceId(saved.id); setTab('references')
      setMessage('Référence enregistrée pour cette vue. Elle sera disponible aux prochaines séances.')
    } catch { setError('Référence non enregistrée. Réessayez.') }
    finally { setBusy(false) }
  }
  const useReference = async () => {
    setBusy(true); setError('')
    try { await onUseReference(reference) }
    catch { setError('Impossible d’afficher la référence. Réessayez.') }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Protocoles & références" width="900px"
      subtitle="Retrouver le même cadrage à chaque séance, sans modifier les photos.">
      <VStack align="stretch" gap="3">
        <Select w="100%" aria-label="Protocole de cadrage" value={protocol.id}
          onChange={(e) => { setProtocolId(e.target.value); setStepId('') }}>
          <optgroup label="Modèles DentoPic">
            {STUDIO_PROTOCOLS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
          {custom.length > 0 && <optgroup label="Protocoles du cabinet">
            {custom.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>}
        </Select>
        <Text fontSize="xs" color={C.body}>Les modèles DentoPic sont des propositions à adapter au cas clinique. Les protocoles du cabinet se personnalisent dans Réglages → Protocoles.</Text>
        {loading && <Text fontSize="xs">Chargement des références…</Text>}
        {error && <HStack><Text role="alert" fontSize="xs">{error}</Text><Button size="xs" variant="outline" onClick={() => setRetry((v) => v + 1)}>Recharger</Button></HStack>}
        <HStack gap="2">
          <Button size="xs" variant={tab === 'protocol' ? 'solid' : 'outline'} onClick={() => setTab('protocol')}>Vues du protocole</Button>
          <Button size="xs" variant={tab === 'references' ? 'solid' : 'outline'} onClick={() => setTab('references')}>Mes références · cette vue ({references.length})</Button>
        </HStack>
        {tab === 'protocol' ? (
          <SimpleGrid columns={{ base: 2, md: 4 }} gap="2" maxH="240px" overflowY="auto">
            {steps.map((s, i) => {
              const sample = photos.find((p) => clinicalLabels(p).referenceViews?.includes(s.id))
              return <Box as="button" key={s.id} textAlign="left" p="2" border="2px solid" borderRadius="md"
                borderColor={step?.id === s.id ? C.greenText : C.cardBorder} bg={step?.id === s.id ? C.greenBg : C.pageBg}
                aria-pressed={step?.id === s.id} onClick={() => setStepId(s.id)}>
                {sample && <PhotoImg storagePath={sample.storage_path} ratio="2/1" mb="1" />}
                <Text fontSize="xs" fontWeight="700" color={C.ink}>{i + 1}. {s.name}</Text>
                <Text fontSize="2xs" color={C.body}>{sample ? 'Référence disponible' : s.group || s.expected_photo_class}</Text>
              </Box>
            })}
          </SimpleGrid>
        ) : (
          <SimpleGrid columns={{ base: 2, md: 5 }} gap="2" maxH="200px" overflowY="auto">
            {references.map((p) => <Box as="button" key={p.id} border="2px solid" borderRadius="md" overflow="hidden"
              borderColor={reference?.id === p.id ? C.greenText : C.cardBorder} aria-label={`Choisir la référence ${p.original_filename || ''}`}
              aria-pressed={reference?.id === p.id} onClick={() => setReferenceId(p.id)}>
              <PhotoImg storagePath={p.storage_path} ratio="4/3" />
              <Text fontSize="2xs" color={C.body} truncate>{p.original_filename || 'Photo de référence'}</Text>
            </Box>)}
            {!references.length && <Text fontSize="xs" color={C.body}>Aucune référence enregistrée pour cette vue. Vous pouvez utiliser la photo ouverte.</Text>}
          </SimpleGrid>
        )}
        {!step ? <Text fontSize="xs">Ce protocole ne contient pas encore de vues.</Text> : (
          <Box p="3" border="1px solid" borderColor={C.greenBorder} borderRadius="md">
            <HStack justify="space-between" mb="2">
              <Text fontSize="sm" fontWeight="700" color={C.greenText}>{index + 1}/{steps.length} · {step.name}</Text>
              <HStack gap="1">
                <Button size="xs" variant="outline" disabled={index <= 0} onClick={() => setStepId(steps[index - 1].id)}>Précédente</Button>
                <Button size="xs" variant="outline" disabled={index >= steps.length - 1} onClick={() => setStepId(steps[index + 1].id)}>Suivante</Button>
              </HStack>
            </HStack>
            <Text fontSize="xs" color={C.body} mb="3">{step.instructions || 'Choisissez une référence du cabinet et reproduisez le cadrage, la distance et la lumière.'}</Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
              <Box>
                <Text fontSize="xs" fontWeight="700" color={C.ink} mb="1">{reference ? 'Référence du cabinet' : 'Guide de cadrage'}</Text>
                {reference ? <PhotoImg storagePath={reference.storage_path} ratio="3/2" /> : <FramingGuide photoClass={step.expected_photo_class} />}
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="700" color={C.ink} mb="1">Photo ouverte · original</Text>
                {sourcePhoto ? <PhotoImg storagePath={sourcePhoto.storage_path} ratio="3/2" /> : <Text fontSize="xs" color={C.body}>Ouvrez une photo du cabinet pour la confronter à cette référence.</Text>}
              </Box>
            </SimpleGrid>
            <HStack mt="3" gap="2" flexWrap="wrap">
              <Button size="xs" disabled={!sourcePhoto || busy} loading={busy} onClick={saveReference}>Photo ouverte → référence de cette vue</Button>
              <Button size="xs" variant="outline" disabled={!reference || busy || !canOverlay} onClick={useReference}>Afficher la référence sur le canevas</Button>
            </HStack>
          </Box>
        )}
        {message && <Text fontSize="xs" color={C.greenText} role="status">{message}</Text>}
        <Text fontSize="2xs" color={C.body}>Bibliothèque du cabinet : jusqu’à 500 photos de référence. Une référence peut appartenir à un autre patient ; elle sert uniquement de guide de cadrage, pas de comparaison de résultat. Aucune capture automatique ni validation clinique n’est réalisée ici.</Text>
      </VStack>
    </Modal>
  )
}
