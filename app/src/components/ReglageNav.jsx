// Navigation des réglages — source unique des sections (hub + sous-pages).
// ReglageNav est la barre persistante affichée en tête de chaque sous-page :
// elle remplace le bouton « Retour aux réglages » et permet de passer
// directement d'une section à l'autre sans repasser par le hub.
import { Box, HStack, Text } from '@chakra-ui/react'
import { Link, useLocation } from 'react-router-dom'
import {
  FiGrid, FiUser, FiUsers, FiMonitor, FiFileText, FiHardDrive, FiShare2,
} from 'react-icons/fi'
import { FaCrown, FaMagic } from 'react-icons/fa'
import { Card } from './ui'
import { C } from '../theme'

export const REGLAGE_SECTIONS = [
  {
    label: 'COMPTE',
    items: [
      { to: '/reglage/profil', icon: FiUser, nav: 'Profil', title: 'Profil', text: 'Nom, profession, cabinet', bg: C.softBlue, color: C.primary },
      { to: '/reglage/membres', icon: FiUsers, nav: 'Membres', title: "Membres de l'équipe", text: "Accès et rôles de l'équipe", bg: C.greenBg, color: C.greenText },
      { to: '/reglage/pro', icon: FaCrown, nav: 'Pro', title: 'Passer Pro', text: 'Débloquez toutes les fonctionnalités', bg: C.amberBg, color: C.amberText },
    ],
  },
  {
    label: 'CABINET',
    items: [
      { to: '/reglage/brand', icon: FaMagic, nav: 'Brand', title: 'Brand Système', text: 'Logo, signature, couleurs et polices', bg: C.softBlue, color: C.primary },
      { to: '/reglage/appareils', icon: FiMonitor, nav: 'Appareils', title: 'Appareils', text: 'Salles et appareils de capture', bg: C.greenBg, color: C.greenText },
      { to: '/reglage/protocoles', icon: FiFileText, nav: 'Protocoles', title: 'Protocoles', text: 'Guides de prise de vue standardisés', bg: C.amberBg, color: C.amberText },
    ],
  },
  {
    label: 'ABONNEMENT',
    items: [
      { to: '/reglage/stockage', icon: FiHardDrive, nav: 'Stockage', title: 'Plan et stockage', text: 'Consultez votre plan et votre stockage', bg: C.softBlue, color: C.primary },
    ],
  },
  {
    label: 'DIFFUSION',
    items: [
      { to: '/reglage/reseaux', icon: FiShare2, nav: 'Réseaux sociaux', title: 'Réseaux sociaux', text: 'Comptes et programmation', bg: C.greenBg, color: C.greenText },
    ],
  },
]

export const REGLAGE_PAGES = REGLAGE_SECTIONS.flatMap((s) => s.items)

export function ReglageNav() {
  const { pathname } = useLocation()
  return (
    <Card px="2" py="1.5" mb="5" overflowX="auto">
      <HStack gap="1" flexWrap="nowrap" minW="max-content">
        <Link to="/reglage" style={{ textDecoration: 'none' }}>
          <HStack px="2" py="1.5" borderRadius="md" gap="1.5" fontSize="xs"
            color="gray.500" _hover={{ bg: C.softBlue, color: C.primary }}>
            <FiGrid /> <Text fontWeight="600">Réglages</Text>
          </HStack>
        </Link>
        <Box w="1px" h="18px" bg="gray.200" flexShrink="0" />
        {REGLAGE_PAGES.map((p) => {
          const active = pathname === p.to
          return (
            <Link key={p.to} to={p.to} style={{ textDecoration: 'none' }}>
              <HStack px="2.5" py="1.5" borderRadius="md" gap="1.5" fontSize="xs" flexShrink="0"
                bg={active ? C.softBlue : 'transparent'}
                color={active ? C.primary : 'gray.500'}
                fontWeight={active ? '700' : '500'}
                _hover={{ bg: C.softBlue, color: C.primary }}>
                <Box as={p.icon} fontSize="12px" />
                <Text>{p.nav}</Text>
              </HStack>
            </Link>
          )
        })}
      </HStack>
    </Card>
  )
}
