import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiUser, FiUsers, FiChevronRight, FiMonitor, FiFileText, FiHardDrive, FiShare2,
} from 'react-icons/fi'
import { FaCrown, FaMagic } from 'react-icons/fa'
import { Card, SectionLabel, PageHeader, HelpButton, IconTile } from '../components/ui'
import { C } from '../theme'

// Sections affichées — ajouter une entrée suffit pour créer un écran de réglage
const SECTIONS = [
  {
    label: 'COMPTE',
    items: [
      { to: '/reglage/profil', icon: FiUser, title: 'Profil', text: 'Nom, profession, cabinet' },
      { to: '/reglage/membres', icon: FiUsers, title: "Membres de l'équipe", text: "Gérez les accès de votre équipe" },
      { to: '/reglage/pro', icon: FaCrown, title: 'Passer Pro', text: 'Débloquez toutes les fonctionnalités' },
    ],
  },
  {
    label: 'IDENTITÉ VISUELLE',
    items: [
      { to: '/reglage/brand', icon: FaMagic, title: 'Brand Système', text: 'Logo, signature, couleurs et polices' },
      { to: '/reglage/appareils', icon: FiMonitor, title: 'Appareils', text: 'Salles et appareils de capture' },
      { to: '/reglage/protocoles', icon: FiFileText, title: 'Protocoles', text: 'Guides de prise de vue standardisés' },
    ],
  },
  {
    label: 'PLAN ET STOCKAGE',
    items: [
      { to: '/reglage/stockage', icon: FiHardDrive, title: 'Usage du stockage', text: 'Consultez votre plan et votre stockage' },
    ],
  },
  {
    label: 'RÉSEAUX SOCIAUX',
    items: [
      { to: '/reglage/reseaux', icon: FiShare2, title: 'Réseaux sociaux', text: 'Comptes et programmation' },
    ],
  },
]

export default function Reglages() {
  return (
    <Box w="100%" px="6" py="6">
      <PageHeader title="Réglages"><HelpButton /></PageHeader>

      {SECTIONS.map((sec) => (
        <Box key={sec.label} mb="6">
          <SectionLabel mb="2">{sec.label}</SectionLabel>
          <Card overflow="hidden">
            <VStack align="stretch" gap="0">
              {sec.items.map((it, i) => (
                <Link key={it.title} to={it.to} style={{ textDecoration: 'none' }}>
                  <HStack
                    px="4" py="3.5" gap="3"
                    borderTop={i > 0 ? '1px solid' : 'none'}
                    borderColor="gray.100"
                    _hover={{ bg: 'gray.50' }}
                  >
                    <IconTile icon={it.icon} />
                    <Box flex="1">
                      <Text fontSize="sm" fontWeight="600" color={C.ink}>{it.title}</Text>
                      <Text fontSize="xs" color="gray.500">{it.text}</Text>
                    </Box>
                    <Box as={FiChevronRight} color="gray.300" />
                  </HStack>
                </Link>
              ))}
            </VStack>
          </Card>
        </Box>
      ))}
    </Box>
  )
}
