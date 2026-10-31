import { useEffect, useState } from 'react'
import { Box, Button, Center, HStack, SimpleGrid, Text } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiPlus, FiType, FiMonitor, FiLayers, FiFileText, FiAlertCircle,
  FiMoreVertical, FiClock,
} from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi2'
import {
  Card, Tag, PageHeader, HelpButton, PrimaryButton, SearchInput,
  Select, ago, isTestName,
} from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { listPresentations, slideCountByPresentation } from '../api'

const TABS = ['Toutes', 'Mes prés.', 'Brouillons', 'Récentes', 'Archivées']

export default function Presentations() {
  const { workspace } = useApp()
  const [pres, setPres] = useState([])
  const [slideCounts, setSlideCounts] = useState({})
  const [tab, setTab] = useState('Toutes')

  useEffect(() => {
    if (!workspace?.id) return
    ;(async () => {
      const [p, s] = await Promise.all([
        listPresentations(workspace.id),
        slideCountByPresentation(),
      ])
      setPres(p)
      setSlideCounts(s)
    })()
  }, [workspace?.id])

  const slideTotal = Object.values(slideCounts).reduce((a, b) => a + b, 0)
  const noSlides = pres.filter((p) => !slideCounts[p.id]).length

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader
        icon={FiMonitor} title="Présentations"
        subtitle="Créez et partagez des présentations visuelles"
      >
        <HelpButton />
        <Button variant="outline" size="sm" borderRadius="md" color="gray.600">
          <HiOutlineSparkles /> Démarrer depuis un template
        </Button>
        <PrimaryButton icon={FiPlus}>Nouvelle présentation</PrimaryButton>
      </PageHeader>

      {noSlides > 0 && (
        <HStack bg={C.amberBg} border="1px solid" borderColor={C.amberBorder} borderRadius="md" px="3" py="2" my="4" gap="2">
          <Box as={FiAlertCircle} color="#d97706" fontSize="sm" />
          <Text fontSize="sm" color={C.amberText}>{noSlides} présentation(s) sans diapositive</Text>
        </HStack>
      )}

      <HStack gap="2" mb="4" mt="4">
        <Tag color="gray"><FiMonitor style={{ marginRight: 4 }} />{pres.length} présentation(s)</Tag>
        <Tag color="gray"><FiLayers style={{ marginRight: 4 }} />{slideTotal} diapositive(s)</Tag>
        {noSlides > 0 && <Tag color="amber"><FiFileText style={{ marginRight: 4 }} />{noSlides} brouillon</Tag>}
      </HStack>

      <HStack gap="3" mb="5">
        <SearchInput placeholder="Rechercher une présentation…" />
        <HStack gap="3">
          {TABS.map((t) => (
            <Text
              key={t} fontSize="xs" cursor="pointer"
              fontWeight={tab === t ? '600' : '400'}
              color={tab === t ? C.primary : 'gray.500'}
              onClick={() => setTab(t)}
            >
              {t}
            </Text>
          ))}
        </HStack>
        <Select h="30px" fontSize="xs"><option>Plus récent</option></Select>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 4 }} gap="5">
        {pres.map((p) => (
          <Link key={p.id} to={`/presentations/${p.id}`} style={{ textDecoration: 'none' }}>
            <Card overflow="hidden" _hover={{ borderColor: 'blue.300' }}>
              <Box position="relative">
                <Center bg="gray.100" aspectRatio="16/9" color="gray.400">
                  <Box as={FiType} fontSize="22px" />
                </Center>
                <Box position="absolute" top="2" right="2">
                  {p.status === 'draft' ? <Tag color="amber">Brouillon</Tag> : <Tag color="green">Finalisé</Tag>}
                </Box>
                <Box position="absolute" bottom="2" left="2" bg="#1f2937" opacity="0.9" borderRadius="md" px="1.5" py="0.5">
                  <Text fontSize="2xs" color="#ffffff"><FiLayers style={{ display: 'inline' }} /> {slideCounts[p.id] || 0}</Text>
                </Box>
              </Box>
              <HStack px="3" py="2.5" justify="space-between">
                <Box minW="0">
                  <HStack gap="1.5">
                    <Text fontSize="xs" fontWeight="600" color={C.ink} isTruncated>{p.name}</Text>
                    {isTestName(p.name) && <Tag color="purple">TEST</Tag>}
                  </HStack>
                  <Text fontSize="2xs" color="gray.500"><FiClock style={{ display: 'inline' }} /> {ago(p.updated_at)}</Text>
                </Box>
                <Box as={FiMoreVertical} color="gray.400" fontSize="xs" />
              </HStack>
            </Card>
          </Link>
        ))}
      </SimpleGrid>
    </Box>
  )
}
