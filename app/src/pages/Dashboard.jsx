import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Center, HStack, SimpleGrid, Text } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiFolder, FiCamera, FiLayers, FiUsers, FiMonitor, FiInfo, FiX, FiFileText,
  FiAlertTriangle, FiClock, FiTrendingUp, FiStar, FiImage, FiFilm, FiChevronRight,
  FiCheck, FiRefreshCw,
} from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi2'
import { Card, SectionLabel, Tag, HelpButton, PrimaryButton } from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  countPhotos, listDossiers, listMontages, listPresentations, listPhotos,
  listCaptureSessions, listCaptureDevices, listVideoProjects,
  slideCountByPresentation, predictionsByPhoto, photoStatsByDossier,
  listActiveSessions,
} from '../api'

const WEEK = 7 * 86400e3

const ACTIONS = [
  { to: '/dossier-patient?new=1', icon: FiFolder, title: 'Nouveau dossier', text: 'Créer un dossier de cas patient et lancer la capture' },
  { to: '/acquisition', icon: FiCamera, title: 'Acquisition', text: 'Acquérir des photos en temps réel (session)' },
  { to: '/studio', icon: FiLayers, title: 'Studio', text: 'Créer un montage photo avant/après' },
  { to: '/dossier-patient', icon: FiUsers, title: 'Dossiers patients', text: 'Gérer la photothèque et les dossiers' },
  { to: '/presentations', icon: FiMonitor, title: 'Présentations', text: 'Préparer un diaporama patient' },
]

export default function Dashboard() {
  const { profile, workspace } = useApp()
  const wsId = workspace?.id
  const [d, setD] = useState(null)

  useEffect(() => {
    if (!wsId) return
    let on = true
    ;(async () => {
      const weekAgo = new Date(Date.now() - WEEK).toISOString()
      const [weekCount, dossiers, montages, presentations, recentPhotos, sessions,
        devices, unsorted, videos, slideCounts, favPhotos, byDossier, activeSessions] =
        await Promise.all([
          countPhotos(wsId, { since: weekAgo }),
          listDossiers(wsId, { limit: 30 }),
          listMontages(wsId),
          listPresentations(wsId),
          listPhotos(wsId, { limit: 10 }),
          listCaptureSessions(wsId),
          listCaptureDevices(wsId),
          countPhotos(wsId, { unsortedOnly: true }),
          listVideoProjects(wsId),
          slideCountByPresentation(),
          listPhotos(wsId, { favoritesOnly: true, limit: 8 }),
          photoStatsByDossier(wsId),
          listActiveSessions(wsId),
        ])
      const preds = await predictionsByPhoto(recentPhotos.map((p) => p.id))
      if (!on) return
      setD({ weekCount, dossiers, montages, presentations, recentPhotos, sessions,
        devices, unsorted, videos, slideCounts, favPhotos, byDossier, preds, activeSessions })
    })()
    return () => { on = false }
  }, [wsId])

  const derived = useMemo(() => {
    if (!d) return null
    const drafts = d.montages.filter((m) => m.status === 'draft').length
    const noExportVideos = d.videos.filter((v) => !v.export_url).length
    const noSlidePres = d.presentations.filter((p) => !d.slideCounts[p.id]).length
    const offline = d.devices.filter((dev) => dev.status !== 'online')
    const emptyDossiers = d.dossiers.filter((ds) => !d.byDossier[ds.id])
    const active = d.activeSessions

    const tasks = []
    const push = (icon, tone, text, to) => tasks.push({ icon, tone, text, to })
    if (d.unsorted) push(FiImage, 'amber', `${d.unsorted} photo(s) non triée(s)`, '/dossier-patient')
    if (drafts) push(FiLayers, 'blue', `${drafts} montage(s) en brouillon`, '/studio')
    if (noExportVideos) push(FiFilm, 'blue', `${noExportVideos} vidéo(s) non exportée(s)`, '/studio/montage-video')
    if (noSlidePres) push(FiMonitor, 'blue', `${noSlidePres} présentation(s) sans diapositive — à compléter`, '/presentations')
    offline.forEach(() => push(FiAlertTriangle, 'amber', "Bridge de capture hors ligne — vérifier l'appareil", '/reglage/appareils'))
    emptyDossiers.slice(0, 4).forEach((ds) =>
      push(FiFolder, 'blue', `Dossier « ${ds.name} » sans photo — lancer l'acquisition`, `/dossier-patient/dossier/${ds.id}`))
    active.slice(0, 2).forEach((s) =>
      push(FiClock, 'blue', `Session de capture du ${new Date(s.started_at).toLocaleDateString('fr-FR')} encore active`, `/acquisition/capture/${s.id}`))

    return { tasks, resume: { dossier: d.dossiers[0], montage: d.montages[0], presentation: d.presentations[0] } }
  }, [d])

  const hour = new Date().getHours()
  const greet = hour < 18 ? 'Bonjour' : 'Bonsoir'

  return (
    <Box w="100%" px="6" py="6">
      <HStack justify="space-between" mb="1">
        <Text fontSize="sm" color="gray.500">{greet} {profile?.full_name || ''}</Text>
        <HStack gap="2">
          <HelpButton />
          <Link to="/acquisition">
            <PrimaryButton icon={FiCamera}>Nouvelle acquisition <FiChevronRight /></PrimaryButton>
          </Link>
        </HStack>
      </HStack>
      <Text fontSize="3xl" fontWeight="700" letterSpacing="-0.02em" color={C.ink} mb="4">
        Tableau de bord
      </Text>

      <HStack bg={C.greenBg} border="1px solid" borderColor={C.greenBorder} borderRadius="md"
        px="3" py="2" mb="5" gap="2">
        <Box as={FiInfo} color="#16a34a" />
        <Text fontSize="sm" color={C.greenText} fontWeight="500">
          Déjà {d?.weekCount ?? '…'} photo(s) cette semaine
        </Text>
        <Box flex="1" />
        <Box as={FiX} color="#16a34a" fontSize="sm" />
      </HStack>

      <Card p="5" mb="5">
        <HStack gap="2" mb="3">
          <Box as={FiClock} color="gray.400" fontSize="sm" />
          <SectionLabel>REPRENDRE OÙ VOUS EN ÉTIEZ</SectionLabel>
        </HStack>
        <SimpleGrid columns={3} gap="3">
          {derived?.resume?.dossier && (
            <ResumeChip kind="DOSSIER" name={derived.resume.dossier.name} to={`/dossier-patient/dossier/${derived.resume.dossier.id}`} />
          )}
          {derived?.resume?.montage && (
            <ResumeChip kind="MONTAGE" name={derived.resume.montage.name} to={`/studio?edit=${derived.resume.montage.id}`} />
          )}
          {derived?.resume?.presentation && (
            <ResumeChip kind="PRÉSENTATION" name={derived.resume.presentation.name} to={`/presentations/${derived.resume.presentation.id}`} />
          )}
        </SimpleGrid>
      </Card>

      <Card p="5" mb="5">
        <HStack gap="2" mb="3">
          <Box as={FiFileText} color="gray.400" fontSize="sm" />
          <Text fontSize="sm" fontWeight="600" color={C.ink}>À traiter</Text>
          <Tag color="blue">{derived?.tasks.length ?? 0}</Tag>
        </HStack>
        <SimpleGrid columns={2} gap="1.5">
          {(derived?.tasks || []).map((t, i) => (
            <Link key={i} to={t.to} style={{ textDecoration: 'none' }}>
              <HStack px="2" py="1.5" borderRadius="md" _hover={{ bg: 'gray.50' }} gap="2.5">
                <Box as={t.icon} color={t.tone === 'amber' ? '#f59e0b' : C.primary} fontSize="sm" flexShrink={0} />
                <Text fontSize="sm" color={C.body} flex="1">{t.text}</Text>
                <Box as={FiChevronRight} color="gray.300" fontSize="xs" />
              </HStack>
            </Link>
          ))}
        </SimpleGrid>
      </Card>

      <Card p="5" mb="5">
        <HStack justify="space-between" mb="1">
          <HStack gap="2">
            <Box as={HiOutlineSparkles} color={C.primary} fontSize="sm" />
            <Text fontSize="sm" fontWeight="600" color={C.ink}>Vérification IA</Text>
          </HStack>
          <Button variant="outline" size="xs" borderRadius="md" color="gray.600">
            <FiRefreshCw /> Relancer l'analyse
          </Button>
        </HStack>
        <Text fontSize="xs" color="gray.500" mb="4">
          Photos récentes en attente de classification automatique
        </Text>
        <SimpleGrid columns={3} gap="4">
          {(d?.recentPhotos || []).slice(0, 6).map((p) => {
            const pred = d.preds[p.id]
            return (
              <Box key={p.id}>
                <PhotoImg storagePath={p.edited_path || p.storage_path} ratio="16/10">
                  <Box position="absolute" top="2" right="2">
                    {pred ? <Tag color="green"><FiCheck /></Tag> : <Tag color="amber">IA</Tag>}
                  </Box>
                </PhotoImg>
                <Text fontSize="2xs" color="gray.500" mt="1" isTruncated>
                  {p.original_filename || p.storage_path?.split('/').pop()}
                </Text>
              </Box>
            )
          })}
        </SimpleGrid>
      </Card>

      <SimpleGrid columns={3} gap="4" mb="5">
        {ACTIONS.map((a) => (
          <Link key={a.title} to={a.to} style={{ textDecoration: 'none' }}>
            <Card p="4" _hover={{ borderColor: 'blue.300' }} h="100%">
              <Box as={a.icon} color={C.primary} fontSize="lg" mb="2" />
              <Text fontSize="sm" fontWeight="600" color={C.ink}>{a.title}</Text>
              <Text fontSize="xs" color="gray.500" mt="0.5">{a.text}</Text>
            </Card>
          </Link>
        ))}
      </SimpleGrid>

      <Card p="5" mb="5">
        <HStack gap="2" mb="4">
          <Box as={FiTrendingUp} color={C.primary} fontSize="sm" />
          <Text fontSize="sm" fontWeight="600" color={C.ink}>Montages récents</Text>
        </HStack>
        <SimpleGrid columns={4} gap="4">
          {(d?.montages || []).slice(0, 4).map((m) => (
            <Link key={m.id} to={`/studio?edit=${m.id}`} style={{ textDecoration: 'none' }}>
              <Center bg="gray.100" aspectRatio="4/3" borderRadius="lg" color="gray.400">
                <Box as={FiLayers} fontSize="22px" />
              </Center>
              <Text fontSize="xs" fontWeight="500" color={C.ink} mt="1.5" isTruncated>{m.name}</Text>
              <Text fontSize="2xs" color="gray.500">
                {m.ratio} · {m.status === 'draft' ? 'Brouillon' : 'Finalisé'}
              </Text>
            </Link>
          ))}
        </SimpleGrid>
      </Card>

      <Card p="5" mb="8">
        <HStack gap="2" mb="4">
          <Box as={FiStar} color="#f59e0b" fontSize="sm" />
          <Text fontSize="sm" fontWeight="600" color={C.ink}>Photos favorites</Text>
          <Tag color="amber">{d?.favPhotos.length ?? 0}</Tag>
        </HStack>
        <SimpleGrid columns={6} gap="4">
          {(d?.favPhotos || []).map((p) => (
            <PhotoImg key={p.id} storagePath={p.edited_path || p.storage_path} ratio="1/1" />
          ))}
        </SimpleGrid>
      </Card>
    </Box>
  )
}

function ResumeChip({ kind, name, to }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <HStack border="1px solid" borderColor={C.cardBorder} borderRadius="lg" px="3" py="2.5" gap="3" _hover={{ bg: 'gray.50' }}>
        <Box flex="1" minW="0">
          <SectionLabel fontSize="2xs">{kind}</SectionLabel>
          <Text fontSize="sm" fontWeight="500" color={C.ink} isTruncated>{name}</Text>
        </Box>
        <Box as={FiChevronRight} color="gray.400" />
      </HStack>
    </Link>
  )
}
