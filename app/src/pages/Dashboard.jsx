import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Center, HStack, SimpleGrid, Text } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiFolder, FiCamera, FiLayers, FiUsers, FiMonitor, FiFileText, FiCheckCircle,
  FiAlertTriangle, FiClock, FiTrendingUp, FiStar, FiImage, FiFilm, FiChevronRight,
  FiChevronDown,
  FiHome,
} from 'react-icons/fi'
import { Card, Tag, PrimaryButton, PageHeader, Tip } from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  countPhotos, listDossiers, listMontages, listPresentations, listPhotos,
  listCaptureSessions, listCaptureDevices, listVideoProjects,
  slideCountByPresentation, photoStatsByDossier,
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
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [d, setD] = useState(null)
  const [tasksOpen, setTasksOpen] = useState(false)

  const load = async () => {
    if (!wsId) return
    const weekAgo = new Date(Date.now() - WEEK).toISOString()
    const [totalPhotos, weekCount, dossiers, montages, presentations, sessions,
      devices, unsorted, unassignedPhotos, videos, slideCounts, favPhotos, byDossier, activeSessions] =
      await Promise.all([
        countPhotos(wsId),
        countPhotos(wsId, { since: weekAgo }),
        listDossiers(wsId),
        listMontages(wsId),
        listPresentations(wsId),
        listCaptureSessions(wsId),
        listCaptureDevices(wsId),
        countPhotos(wsId, { unassignedOnly: true }),
        listPhotos(wsId, { unassignedOnly: true, limit: 6 }),
        listVideoProjects(wsId),
        slideCountByPresentation(),
        listPhotos(wsId, { favoritesOnly: true, limit: 8 }),
        photoStatsByDossier(wsId),
        listActiveSessions(wsId),
      ])
    setD({ totalPhotos, weekCount, dossiers, montages, presentations, sessions,
      devices, unsorted, unassignedPhotos, videos, slideCounts, favPhotos, byDossier, activeSessions })
  }

  useEffect(() => { load() }, [wsId])

  const derived = useMemo(() => {
    if (!d) return null
    const drafts = d.montages.filter((m) => m.status === 'draft').length
    const noExportVideos = d.videos.filter((v) => !v.export_url).length
    const noSlidePres = d.presentations.filter((p) => !d.slideCounts[p.id]).length
    const offline = d.devices.filter((dev) => dev.status !== 'online')
    const emptyDossiers = d.dossiers.filter((ds) => !d.byDossier[ds.id])
    const active = d.activeSessions

    const tasks = []
    const push = (icon, tone, text, to, tip) => tasks.push({ icon, tone, text, to, tip })
    if (drafts) push(FiLayers, 'blue', `${drafts} montage(s) en brouillon`, '/studio',
      'Aller à l\'onglet Studio pour finaliser ces montages')
    if (noExportVideos) push(FiFilm, 'blue', `${noExportVideos} vidéo(s) non exportée(s)`, '/studio/montage-video',
      'Aller à l\'onglet Studio pour exporter ces vidéos')
    if (noSlidePres) push(FiMonitor, 'blue', `${noSlidePres} présentation(s) sans diapositive — à compléter`, '/presentations',
      'Aller à l\'onglet Présentations pour ajouter des diapositives')
    if (offline.length) push(FiAlertTriangle, 'amber', `${offline.length} appareil(s) hors ligne — vérifier dans Réglages`, '/reglage/appareils',
      'Aller à Réglages → Appareils pour vérifier la connexion')
    emptyDossiers.slice(0, 4).forEach((ds) =>
      push(FiFolder, 'blue', `Dossier « ${ds.name} » sans photo — lancer l'acquisition`, `/dossier-patient/dossier/${ds.id}`,
        `Ouvrir le dossier « ${ds.name} » dans l'onglet Dossier patient`))
    active.slice(0, 2).forEach((s) =>
      push(FiClock, 'blue', `Session de capture du ${new Date(s.started_at).toLocaleDateString('fr-FR')} encore active`, `/acquisition/capture/${s.id}`,
        'Reprendre la session dans l\'onglet Acquisition photo'))

    return { tasks, drafts, noSlidePres, emptyCount: emptyDossiers.length }
  }, [d])

  const toSort = (d?.unassignedPhotos || []).slice(0, 6)

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader icon={FiHome} title="Accueil"
        subtitle="Tableau de bord — l'activité du cabinet en un coup d'œil.">
        <Link to="/acquisition">
          <PrimaryButton icon={FiCamera}>Nouvelle acquisition <FiChevronRight /></PrimaryButton>
        </Link>
      </PageHeader>

      <SimpleGrid columns={{ base: 2, md: 5 }} gap="4" mb="5">
        <StatCard icon={FiImage} label="Photos" value={d?.totalPhotos ?? '…'}
          sub={d ? `+${d.weekCount} cette semaine` : null}
          to="/collection?tab=photos" />
        <StatCard icon={FiFolder} label="Dossiers" value={d?.dossiers.length ?? '…'}
          sub={derived?.emptyCount ? `${derived.emptyCount} sans photo` : null}
          tone={derived?.emptyCount ? 'amber' : undefined}
          to="/dossier-patient" />
        <StatCard icon={FiLayers} label="Montages" value={d?.montages.length ?? '…'}
          sub={derived?.drafts ? `${derived.drafts} brouillon(s)` : null}
          tone={derived?.drafts ? 'amber' : undefined}
          to="/studio" />
        <StatCard icon={FiMonitor} label="Présentations" value={d?.presentations.length ?? '…'}
          sub={derived?.noSlidePres ? `${derived.noSlidePres} sans diapo` : null}
          tone={derived?.noSlidePres ? 'amber' : undefined}
          to="/presentations" />
        <StatCard icon={d?.unsorted ? FiAlertTriangle : FiCheckCircle} label="À classer"
          value={d?.unsorted ?? '…'}
          sub={d ? (d.unsorted ? 'photo(s) à compléter' : 'photothèque à jour') : null}
          tone={d?.unsorted ? 'amber' : 'green'}
          to="/collection?tab=photos&quick=unassigned" />
      </SimpleGrid>

      {derived?.tasks.length > 0 && (
        <Card p="5" mb="5">
          <HStack gap="2" mb={tasksOpen ? '3' : '0'} as="button" w="100%" cursor="pointer"
            aria-expanded={tasksOpen} onClick={() => setTasksOpen((v) => !v)}>
            <Box as={FiFileText} color="gray.400" fontSize="sm" />
            <Text fontSize="sm" fontWeight="600" color={C.ink}>À traiter</Text>
            <Tag color="blue">{derived.tasks.length}</Tag>
            <Box flex="1" />
            <Box as={tasksOpen ? FiChevronDown : FiChevronRight} color="gray.400" />
          </HStack>
          {tasksOpen && <SimpleGrid columns={2} gap="1.5">
            {derived.tasks.map((t, i) => (
              <Tip key={i} label={t.tip} display="block">
                <Link to={t.to} style={{ textDecoration: 'none' }}>
                  <HStack px="2" py="1.5" borderRadius="md" _hover={{ bg: 'gray.50' }} gap="2.5">
                    <Box as={t.icon} color={t.tone === 'amber' ? '#f59e0b' : C.primary} fontSize="sm" flexShrink={0} />
                    <Text fontSize="sm" color={C.body} flex="1">{t.text}</Text>
                    <Box as={FiChevronRight} color="gray.300" fontSize="xs" />
                  </HStack>
                </Link>
              </Tip>
            ))}
          </SimpleGrid>}
        </Card>
      )}

      <Card p="5" mb="5">
        <HStack gap="2" mb="1">
          <Box as={FiImage} color={C.primary} fontSize="sm" />
          <Text fontSize="sm" fontWeight="600" color={C.ink}>Photos à classer</Text>
          <Box flex="1" />
          {d?.unsorted > 0 && <Tag color="amber">{d.unsorted} à classer</Tag>}
        </HStack>
        {d?.unsorted ? (
          <>
            <Text fontSize="xs" color="gray.500" mb="4">
              Patient, vue ou étape manquant — sélectionnez-les dans la photothèque puis attribuez en lot.
            </Text>
            <SimpleGrid columns={6} gap="3" mb="4">
              {toSort.map((p) => (
                <PhotoImg key={p.id} storagePath={p.edited_path || p.storage_path} ratio="1/1" />
              ))}
            </SimpleGrid>
            <Link to="/collection?tab=photos&quick=unassigned">
              <Button variant="outline" size="sm">Trier dans la photothèque <FiChevronRight /></Button>
            </Link>
          </>
        ) : d && d.totalPhotos === 0 ? (
          <>
            <Text fontSize="xs" color="gray.500" mb="4">
              Votre photothèque est vide — importez vos premières photos de cas pour commencer.
            </Text>
            <Link to="/acquisition">
              <PrimaryButton icon={FiCamera}>Importer mes premières photos <FiChevronRight /></PrimaryButton>
            </Link>
          </>
        ) : (
          <Text fontSize="xs" color="gray.500">
            Photothèque à jour — toutes les photos ont un patient, une vue et une étape.
          </Text>
        )}
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

function StatCard({ icon, label, value, sub, to, tone }) {
  const color = tone === 'amber' ? C.amberText : tone === 'green' ? C.greenText : C.primary
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <Card p="4" h="100%" _hover={{ borderColor: 'blue.300' }}>
        <HStack gap="1.5" mb="1.5">
          <Box as={icon} color={color} fontSize="sm" />
          <Text fontSize="2xs" color="gray.500" fontWeight="600" letterSpacing="0.05em"
            textTransform="uppercase">{label}</Text>
        </HStack>
        <Text fontSize="2xl" fontWeight="700" color={C.ink} lineHeight="1.1">{value}</Text>
        <Text fontSize="2xs" color={tone ? color : 'gray.400'} mt="1" minH="3">{sub || ' '}</Text>
      </Card>
    </Link>
  )
}
