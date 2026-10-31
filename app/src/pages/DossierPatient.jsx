import { useEffect, useState } from 'react'
import { Box, Button, HStack, SimpleGrid, Text } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiTrash2, FiPlus, FiFolder, FiCamera, FiUpload, FiEye, FiMoreHorizontal,
  FiImage, FiLayers, FiClock, FiAlertTriangle,
} from 'react-icons/fi'
import {
  Card, Tag, ProgressBar, PageHeader, HelpButton, PrimaryButton,
  SearchInput, Select, ago, isTestName,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  listDossiers, countTrashDossiers, listPhotos, montageCountByDossier,
  listActiveSessions, photoStatsByDossier,
} from '../api'

export default function DossierPatient() {
  const { workspace } = useApp()
  const [d, setD] = useState(null)

  useEffect(() => {
    if (!workspace?.id) return
    const wsId = workspace.id
    let on = true
    ;(async () => {
      const [dossiers, trash, photos, montageCounts, sessions, byDossier] =
        await Promise.all([
          listDossiers(wsId),
          countTrashDossiers(wsId),
          listPhotos(wsId),
          montageCountByDossier(wsId),
          listActiveSessions(wsId),
          photoStatsByDossier(wsId),
        ])
      if (!on) return
      const subCounts = {}
      dossiers.forEach((ds) => {
        if (ds.parent_id) subCounts[ds.parent_id] = (subCounts[ds.parent_id] || 0) + 1
      })
      setD({
        dossiers, trash, photoCount: photos.length, byDossier, subCounts,
        montageCounts,
        listening: new Set(sessions.map((s) => s.dossier_id).filter(Boolean)),
      })
    })()
    return () => { on = false }
  }, [workspace?.id])

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader title="Dossier patient" subtitle="Gérez les dossiers sans informations personnelles.">
        <HelpButton />
        <Button variant="outline" size="sm" borderRadius="md" color="gray.600">
          <FiTrash2 /> Corbeille <Tag color="gray">{d?.trash ?? 0}</Tag>
        </Button>
        <PrimaryButton icon={FiPlus}>Nouveau dossier</PrimaryButton>
      </PageHeader>

      <HStack gap="2" mb="4">
        <Tag color="gray"><FiFolder style={{ marginRight: 4 }} />{d?.dossiers.length ?? 0} dossiers</Tag>
        <Tag color="gray"><FiImage style={{ marginRight: 4 }} />{d?.photoCount ?? 0} photos</Tag>
        {d?.listening.size > 0 && <Tag color="teal">{d.listening.size} en écoute</Tag>}
      </HStack>

      <HStack gap="3" mb="3">
        <SearchInput placeholder="Rechercher par n° de dossier, nom ou patient…" />
        <Select><option>Récents</option></Select>
        <Select><option>Toutes spécialités</option></Select>
        <Button variant="outline" size="sm" color={C.amberText} borderColor={C.amberBorder} bg={C.amberBg}>
          <FiAlertTriangle /> Nettoyer les données de test (50)
        </Button>
      </HStack>

      <Box border="1.5px dashed" borderColor="gray.300" borderRadius="md" px="3" py="2" mb="5">
        <Text fontSize="xs" color="gray.500">
          <FiPlus style={{ display: 'inline', marginRight: 4 }} />
          Création express : nom du dossier + Entrée
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="5">
        {(d?.dossiers || []).map((ds) => {
          const p = d.byDossier[ds.id]
          const photos = p?.photos || 0
          const montages = d.montageCounts[ds.id] || 0
          const subs = d.subCounts[ds.id] || 0
          const progress = Math.min(100, photos * 20)
          return (
            <Card key={ds.id} p="4">
              <HStack mb="3" justify="space-between">
                <HStack gap="2" minW="0">
                  <Text fontSize="sm" fontWeight="700" color={C.ink} isTruncated>{ds.name}</Text>
                  {d.listening.has(ds.id) && <Tag color="teal">Écoute</Tag>}
                  {isTestName(ds.name) && <Tag color="purple">Test</Tag>}
                </HStack>
                <Box as={FiFolder} color="gray.400" fontSize="sm" />
              </HStack>
              <PhotoImg storagePath={p?.coverPath} ratio="16/9" mb="3" />
              <HStack gap="3" mb="2" color="gray.500">
                <Text fontSize="2xs"><FiImage style={{ display: 'inline' }} /> {photos} photos</Text>
                <Text fontSize="2xs"><FiLayers style={{ display: 'inline' }} /> {montages} montages</Text>
                <Text fontSize="2xs"><FiFolder style={{ display: 'inline' }} /> {subs} sous-dossiers</Text>
                <Text fontSize="2xs"><FiClock style={{ display: 'inline' }} /> {ago(ds.updated_at)}</Text>
              </HStack>
              <ProgressBar value={progress} label={`${progress} % du cas`} mb="3" />
              <HStack gap="2">
                <Link to={`/acquisition/capture/${ds.id}`} style={{ flex: 1 }}>
                  <PrimaryButton icon={FiCamera} w="100%">Capturer</PrimaryButton>
                </Link>
                <Button variant="outline" size="sm" px="2"><FiUpload /></Button>
                <Link to={`/dossier-patient/dossier/${ds.id}`}>
                  <Button variant="outline" size="sm" px="2"><FiEye /></Button>
                </Link>
                <Button variant="outline" size="sm" px="2"><FiMoreHorizontal /></Button>
              </HStack>
            </Card>
          )
        })}
      </SimpleGrid>
    </Box>
  )
}
