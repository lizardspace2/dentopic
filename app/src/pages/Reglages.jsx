import { Box, HStack, SimpleGrid, Text } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import { Card, SectionLabel, PageHeader, HelpButton, IconTile } from '../components/ui'
import { REGLAGE_SECTIONS } from '../components/ReglageNav'
import { C } from '../theme'

export default function Reglages() {
  return (
    <Box w="100%" px="6" py="6">
      <PageHeader title="Réglages"
        subtitle="Compte, cabinet, abonnement et diffusion"><HelpButton /></PageHeader>

      {REGLAGE_SECTIONS.map((sec) => (
        <Box key={sec.label} mb="6">
          <SectionLabel mb="2">{sec.label}</SectionLabel>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} gap="3">
            {sec.items.map((it) => (
              <Link key={it.to} to={it.to} style={{ textDecoration: 'none' }}>
                <Card p="4" h="100%"
                  _hover={{ borderColor: 'blue.300', boxShadow: 'sm', transform: 'translateY(-1px)' }}
                  transition="all .12s ease">
                  <HStack gap="3" align="center">
                    <IconTile icon={it.icon} bg={it.bg} color={it.color} size="38px" iconSize="17px" />
                    <Box flex="1" minW="0">
                      <Text fontSize="sm" fontWeight="600" color={C.ink}>{it.title}</Text>
                      <Text fontSize="xs" color="gray.500" isTruncated>{it.text}</Text>
                    </Box>
                    <Box as={FiChevronRight} color="gray.300" flexShrink="0" />
                  </HStack>
                </Card>
              </Link>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </Box>
  )
}
