// Route /reglage/stockage — usage du stockage et plan du workspace.
// Usage réel = somme des octets patient_photos ; limites via workspace_plans.
import { useEffect, useState } from 'react'
import {
  Box, Center, HStack, SimpleGrid, Text, VStack,
} from '@chakra-ui/react'
import {
  FiHardDrive, FiUsers, FiShare2, FiFolder, FiCheck,
  FiAlertTriangle, FiImage, FiClock,
} from 'react-icons/fi'
import { FaCrown } from 'react-icons/fa'
import { ReglageNav } from '../components/ReglageNav'
import {
  Card, Tag, PageHeader, SectionLabel, ago,
} from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { getStorageUsage, getPlanInfo } from '../api'

const GB = 1024 ** 3
const fmtBytes = (n) => {
  if (n == null) return '—'
  if (n >= GB) return `${(n / GB).toFixed(1)} Go`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} Mo`
  return `${(n / 1024).toFixed(0)} Ko`
}
const MIME_LABEL = {
  'image/jpeg': ['JPEG', 'blue'], 'image/png': ['PNG', 'purple'],
  'image/webp': ['WebP', 'teal'], 'video/mp4': ['Vidéo MP4', 'orange'],
}
const limitLabel = (n) => (n == null ? '—' : n < 0 ? 'Illimité' : n)

export default function ReglageStockage() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [usage, setUsage] = useState(null)
  const [plan, setPlan] = useState(null)

  useEffect(() => {
    if (!wsId) return
    getStorageUsage(wsId).then(setUsage)
    getPlanInfo(wsId).then(setPlan)
  }, [wsId])

  const limit = plan?.workspace?.storage_limit_bytes ?? workspace?.storage_limit_bytes ?? 10 * GB
  const used = usage?.totalBytes ?? 0
  const pct = Math.min(100, (used / limit) * 100)
  const barColor = pct >= 90 ? 'red.500' : pct >= 70 ? 'orange.400' : C.primary
  const cur = plan?.current

  return (
    <Box w="100%" px="6" py="6">
      <ReglageNav />
      <PageHeader
        icon={FiHardDrive} title="Usage du stockage"
        subtitle="Consultez votre plan et votre consommation réelle"
      >
      </PageHeader>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" mt="4">
        {/* ---- plan ---- */}
        <Card p="5">
          <HStack mb="3" gap="2">
            <Box as={FaCrown} color="amber.500" />
            <Text fontSize="sm" fontWeight="700" color={C.ink}>Plan actuel</Text>
          </HStack>
          <HStack mb="4" gap="2">
            <Text fontSize="xl" fontWeight="800" color={C.ink}>
              {cur?.display_name || plan?.workspace?.plan || '—'}
            </Text>
            <Tag color={plan?.workspace?.plan === 'free' ? 'gray' : 'amber'}>
              {plan?.workspace?.plan === 'free' ? 'Gratuit' : plan?.workspace?.plan}
            </Tag>
            {plan?.workspace?.subscription_status && (
              <Tag color="green">{plan.workspace.subscription_status}</Tag>
            )}
          </HStack>
          {plan?.workspace?.plan_period_end && (
            <Text fontSize="2xs" color="gray.500" mb="3">
              Fin de période : {new Date(plan.workspace.plan_period_end).toLocaleDateString('fr-FR')}
              {plan.workspace.plan_interval ? ` · facturation ${plan.workspace.plan_interval === 'year' ? 'annuelle' : 'mensuelle'}` : ''}
            </Text>
          )}
          <VStack align="stretch" gap="2">
            {[
              [FiUsers, 'Membres de l’équipe', plan?.usage?.members, cur?.max_members],
              [FiShare2, 'Comptes réseaux sociaux', plan?.usage?.accounts, cur?.max_social_accounts],
              [FiFolder, 'Dossiers patients', plan?.usage?.dossiers, -1],
            ].map(([I, label, have, max], i) => (
              <HStack key={i} fontSize="sm" color="gray.600">
                <Box as={I} color="gray.400" />
                <Text flex="1">{label}</Text>
                <Text fontWeight="600" color={C.ink}>
                  {have ?? '…'} / {limitLabel(max)}
                </Text>
                {max != null && max >= 0 && have != null && have >= max && (
                  <Box as={FiAlertTriangle} color="orange.400" aria-label="Limite atteinte" />
                )}
              </HStack>
            ))}
          </VStack>
        </Card>

        {/* ---- stockage ---- */}
        <Card p="5">
          <HStack mb="1" gap="2">
            <Box as={FiHardDrive} color={C.primary} />
            <Text fontSize="sm" fontWeight="700" color={C.ink}>Stockage média</Text>
          </HStack>
          <HStack align="baseline" gap="2" mb="2">
            <Text fontSize="2xl" fontWeight="800" color={C.ink}>{fmtBytes(used)}</Text>
            <Text fontSize="xs" color="gray.500">utilisés sur {fmtBytes(limit)} — {usage?.count ?? '…'} fichier(s)</Text>
          </HStack>
          <Box h="10px" bg="gray.200" borderRadius="full" overflow="hidden" mb="1"
            role="progressbar" aria-valuenow={Math.round(pct)} aria-label="Usage du stockage">
            <Box h="100%" w={`${Math.max(pct, 0.5)}%`} bg={barColor}
              borderRadius="full" transition="width .4s" />
          </Box>
          <Text fontSize="2xs" color="gray.500" mb="4">{pct.toFixed(1)} % utilisé</Text>

          <SectionLabel mb="2">RÉPARTITION PAR TYPE</SectionLabel>
          <VStack align="stretch" gap="2">
            {Object.entries(usage?.byMime || {}).map(([mime, m]) => {
              const [label, color] = MIME_LABEL[mime] || [mime, 'gray']
              const share = used ? (m.bytes / used) * 100 : 0
              return (
                <HStack key={mime} gap="3">
                  <Tag color={color}>{label}</Tag>
                  <Box flex="1" h="5px" bg="gray.200" borderRadius="full" overflow="hidden">
                    <Box h="100%" w={`${share}%`} bg={C.primary} />
                  </Box>
                  <Text fontSize="xs" color="gray.600" w="150px" textAlign="right">
                    {fmtBytes(m.bytes)} · {m.count} fichier{m.count > 1 ? 's' : ''}
                  </Text>
                </HStack>
              )
            })}
            {!usage && <Text fontSize="xs" color="gray.400">Chargement…</Text>}
          </VStack>
        </Card>
      </SimpleGrid>

      {/* ---- fichiers les plus lourds ---- */}
      <Card mt="5" overflow="hidden">
        <HStack px="4" py="3" borderBottom="1px solid" borderColor="gray.100">
          <Text fontSize="sm" fontWeight="700" color={C.ink} flex="1">
            Fichiers les plus volumineux
          </Text>
          <Text fontSize="2xs" color="gray.500">
            Pistes de libération : supprimez les doublons ou exports inutiles
          </Text>
        </HStack>
        {(usage?.largest || []).map((p, i) => (
          <HStack key={p.id} px="4" py="2.5" gap="3"
            borderTop={i > 0 ? '1px solid' : 'none'} borderColor="gray.100">
            <Box w="46px" flexShrink={0}>
              <PhotoImg storagePath={p.storage_path} ratio="4/3" iconSize="14px" />
            </Box>
            <Box flex="1" minW="0">
              <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>
                {p.original_filename || p.storage_path?.split('/').pop()}
              </Text>
              <Text fontSize="2xs" color="gray.500">
                {p.dossier?.name ? `${p.dossier.name} · ` : ''}
                <FiClock style={{ display: 'inline' }} /> {ago(p.created_at)}
                {p.source ? ` · ${p.source}` : ''}
              </Text>
            </Box>
            <Tag color="blue">{fmtBytes(p.bytes)}</Tag>
          </HStack>
        ))}
        {usage && !usage.largest.length && (
          <Center py="10" color="gray.400" flexDirection="column" gap="2">
            <Box as={FiImage} fontSize="xl" />
            <Text fontSize="sm">Aucun fichier dans le stockage.</Text>
          </Center>
        )}
      </Card>

      {/* ---- offres ---- */}
      {plan?.plans?.length > 0 && (
        <>
          <SectionLabel mt="6" mb="2">OFFRES DISPONIBLES</SectionLabel>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="3">
            {plan.plans.map((p) => {
              const active = p.slug === plan.workspace?.plan
              return (
                <Card key={p.slug} p="4"
                  border={active ? `2px solid ${C.primary}` : undefined}>
                  <HStack mb="1" gap="2">
                    <Text fontSize="sm" fontWeight="700" color={C.ink}>{p.display_name}</Text>
                    {active && <Tag color="blue">Plan actuel</Tag>}
                  </HStack>
                  <VStack align="start" gap="1" mt="1">
                    <Text fontSize="2xs" color="gray.500">
                      Membres : {limitLabel(p.max_members)}
                    </Text>
                    <Text fontSize="2xs" color="gray.500">
                      Réseaux sociaux : {limitLabel(p.max_social_accounts)}
                    </Text>
                    <Text fontSize="2xs" color="gray.500">
                      Vérification du cabinet : {p.has_verification ? 'incluse' : 'non'}
                    </Text>
                  </VStack>
                </Card>
              )
            })}
          </SimpleGrid>
        </>
      )}
    </Box>
  )
}
