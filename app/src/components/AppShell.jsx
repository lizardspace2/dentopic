import { useState } from 'react'
import { Box, Flex, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  FiSearch, FiHome, FiCamera, FiUsers, FiLayers, FiFolder, FiCalendar,
  FiMonitor, FiSettings, FiChevronsLeft, FiLogOut, FiFilter, FiBell,
  FiHelpCircle, FiEye, FiMoon, FiSun, FiCommand,
} from 'react-icons/fi'
import Logo from './Logo'
import { Tip, ToastHost } from './ui'
import { C, getMode, applyMode } from '../theme'
import { useApp } from '../context/AppContext'

// Ordre = ordre affiché dans la barre latérale
const NAV = [
  { to: '/recherche', label: 'Recherche', icon: FiSearch },
  { to: '/', label: 'Accueil', icon: FiHome },
  { to: '/acquisition', label: 'Acquisition Photo', icon: FiCamera },
  { to: '/dossier-patient', label: 'Dossier patient', icon: FiUsers },
  { to: '/studio', label: 'Studio', icon: FiLayers },
  { to: '/collection', label: 'Collection', icon: FiFolder },
  { to: '/publication', label: 'Publication', icon: FiCalendar },
  { to: '/presentations', label: 'Présentations', icon: FiMonitor },
  { to: '/reglage', label: 'Réglages', icon: FiSettings },
]

const TOP_ICONS = [FiBell, FiHelpCircle, FiEye] // + toggle thème + réglages

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'DG'
}

export default function AppShell() {
  const { profile, signOut } = useApp()
  const [mode, setMode] = useState(getMode())
  const dark = mode === 'dark' // le Studio suit aussi le basculement clair/sombre
  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyMode(next)
  }
  const sbBg = dark ? C.darkSidebar : C.sidebarBg
  const sbBorder = dark ? '#1c2635' : C.cardBorder
  const navFg = dark ? '#c4cdd9' : C.body
  const navActive = dark ? '#1a2434' : C.navActive
  const navActiveFg = dark ? C.darkFg : C.ink

  return (
    <Flex h="100vh" bg={dark ? C.darkBg : C.pageBg} overflow="hidden">
      <Flex w="232px" direction="column" bg={sbBg} borderRight="1px solid" borderColor={sbBorder} flexShrink={0}>
        <Box px="4" pt="4" pb="3"><Logo /></Box>
        <VStack align="stretch" gap="0.5" px="2" flex="1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <HStack
                  gap="2.5" px="3" py="2" borderRadius="lg" fontSize="sm"
                  bg={isActive ? navActive : 'transparent'}
                  color={isActive ? navActiveFg : navFg}
                  fontWeight={isActive ? '600' : '500'}
                  _hover={{ bg: isActive ? navActive : dark ? C.darkCard : 'gray.100' }}
                >
                  <Box as={n.icon} fontSize="15px" />
                  <Text>{n.label}</Text>
                </HStack>
              )}
            </NavLink>
          ))}
        </VStack>
        <Box px="2" pb="2">
          <HStack gap="2.5" px="3" py="2" borderRadius="lg" color={navFg} fontSize="sm" cursor="pointer" _hover={{ bg: dark ? C.darkCard : 'gray.100' }}>
            <Box as={FiChevronsLeft} fontSize="15px" />
            <Text>Réduire</Text>
          </HStack>
        </Box>
        <HStack px="3" py="3" gap="3" borderTop="1px solid" borderColor={sbBorder}>
          <Flex
            w="34px" h="34px" borderRadius="full" align="center" justify="center"
            bg={dark ? C.darkBorder : 'gray.200'} color={dark ? '#dfe6ef' : 'gray.600'}
            fontSize="xs" fontWeight="700" flexShrink={0}
          >
            {initials(profile?.full_name)}
          </Flex>
          <Box flex="1" minW="0">
            <Text fontSize="sm" fontWeight="600" color={dark ? C.darkFg : C.ink} isTruncated>
              {profile?.full_name || '—'}
            </Text>
            <Text fontSize="2xs" color={dark ? C.darkMuted : 'gray.500'} isTruncated>
              {profile?.profession || ''}
            </Text>
          </Box>
          <Box as={FiLogOut} color={dark ? C.darkMuted : 'gray.400'} cursor="pointer" onClick={signOut} title="Se déconnecter" />
        </HStack>
      </Flex>

      <Flex direction="column" flex="1" minW="0">
        <HStack h="52px" px="5" gap="4" bg={dark ? C.darkSidebar : 'white'} borderBottom="1px solid" borderColor={sbBorder} flexShrink={0}>
          <HStack
            flex="0 0 240px" h="30px" gap="2" px="2.5"
            bg={dark ? C.darkCard : 'gray.50'}
            border="1px solid" borderColor={dark ? C.darkBorder : C.cardBorder}
            borderRadius="md"
          >
            <Box as={FiSearch} color={dark ? C.darkMuted : 'gray.400'} fontSize="13px" />
            <Input
              variant="flushed" placeholder="Rechercher…" fontSize="xs"
              border="none" _focus={{ boxShadow: 'none' }} h="100%"
              color={dark ? '#dfe6ef' : 'inherit'}
            />
            <Box as={FiFilter} color={dark ? C.darkMuted : 'gray.400'} fontSize="13px" />
            <Text fontSize="2xs" color={dark ? C.darkMuted : 'gray.400'}>/</Text>
          </HStack>
          <Box flex="1" />
          <HStack
            bg={C.greenBg}
            border="1px solid" borderColor={C.greenBorder}
            borderRadius="md" px="2.5" h="26px" gap="1.5"
            fontSize="2xs" color={C.greenText}
          >
            <Box w="6px" h="6px" borderRadius="full" bg="#22c55e" />
            <Text fontWeight="600">Source non confi…</Text>
            <Text>→</Text>
            <Text isTruncated maxW="110px">E2E-17933332…</Text>
            <Text fontWeight="600">⌄</Text>
          </HStack>
          <HStack gap="1" color={dark ? C.darkMuted : 'gray.500'}>
            <Box as={FiCommand} fontSize="14px" />
            <Text fontSize="2xs" border="1px solid" borderColor={dark ? C.darkBorder : 'gray.300'} borderRadius="sm" px="1">⌘K</Text>
          </HStack>
          {TOP_ICONS.map((I, i) => (
            <Box key={i} as={I} fontSize="15px" color={dark ? C.darkMuted : 'gray.500'} cursor="pointer" />
          ))}
          <Tip label={mode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
            <Box
              as={mode === 'dark' ? FiSun : FiMoon} fontSize="15px" cursor="pointer"
              color={dark ? C.darkMuted : 'gray.500'}
              aria-label={mode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              onClick={toggleMode}
            />
          </Tip>
          <Box as={FiSettings} fontSize="15px" color={dark ? C.darkMuted : 'gray.500'} cursor="pointer" />
        </HStack>

        <Box flex="1" overflowY="auto" bg={dark ? C.darkBg : C.pageBg}>
          <Outlet />
        </Box>
      </Flex>
      <ToastHost />
    </Flex>
  )
}
