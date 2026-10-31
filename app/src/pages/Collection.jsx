import { useEffect, useState } from 'react'
import { Box, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiPlus, FiFolder, FiFolderPlus, FiEye, FiLink, FiEdit2, FiTrash2,
  FiAlertTriangle,
} from 'react-icons/fi'
import {
  Card, Tag, EmptyPane, SectionLabel, PageHeader, HelpButton,
  PrimaryButton, SearchInput, IconTile, isTestName,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import { listCollections } from '../api'

export default function Collection() {
  const { workspace } = useApp()
  const [cols, setCols] = useState([])

  useEffect(() => {
    if (!workspace?.id) return
    listCollections(workspace.id).then(setCols)
  }, [workspace?.id])

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader
        icon={FiFolder} iconBg={C.amberBg} iconColor={C.amberText}
        title="Collections"
        subtitle="Organisez vos photos et montages en collections thématiques"
      >
        <HelpButton />
        <PrimaryButton icon={FiPlus}>Nouvelle collection</PrimaryButton>
      </PageHeader>

      <SimpleGrid columns={2} gap="6" alignItems="start" mt="2">
        <Box>
          <SectionLabel mb="2">MES COLLECTIONS</SectionLabel>
          <SearchInput placeholder="Nom ou N° dossier…" w="100%" />
          <HStack my="3" gap="2" color="gray.500">
            <Text fontSize="xs">Trier par</Text>
            <Tag color="blue">Récentes</Tag>
            <Text fontSize="xs">A→Z</Text>
            <Box flex="1" />
            <Text fontSize="xs" color={C.amberText}>
              <FiAlertTriangle style={{ display: 'inline' }} /> Nettoyer (56)
            </Text>
          </HStack>

          <VStack align="stretch" gap="3">
            {cols.map((c) => (
              <Card key={c.id} p="3" _hover={{ borderColor: 'blue.300' }}>
                <HStack gap="3" align="start">
                  <Box w="34px" h="34px" borderRadius="lg" bg={c.color || '#4f46e5'} flexShrink={0} />
                  <Box flex="1" minW="0">
                    <HStack gap="2" mb="0.5">
                      <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{c.name}</Text>
                      {isTestName(c.name) && <Tag color="purple">Test</Tag>}
                    </HStack>
                    <Text fontSize="xs" color="gray.500" isTruncated mb="2">
                      {c.description || 'Collection automatique : montages avant/après du dossier patient.'}
                    </Text>
                    {c.cover_photo?.storage_path && (
                      <PhotoImg storagePath={c.cover_photo.storage_path} ratio="16/5" mb="2" />
                    )}
                    <HStack justify="space-between">
                      <Text fontSize="2xs" color="gray.500">1 élément(s)</Text>
                      <HStack gap="1" color="gray.400" fontSize="sm">
                        <Box as={FiFolderPlus} cursor="pointer" />
                        <Box as={FiEye} cursor="pointer" />
                        <Box as={FiLink} cursor="pointer" />
                        <Box as={FiEdit2} cursor="pointer" />
                        <Box as={FiTrash2} cursor="pointer" />
                      </HStack>
                    </HStack>
                  </Box>
                </HStack>
              </Card>
            ))}
          </VStack>
        </Box>

        <Box>
          <SectionLabel mb="2">DÉTAIL</SectionLabel>
          <EmptyPane minH="400px" />
        </Box>
      </SimpleGrid>
    </Box>
  )
}
