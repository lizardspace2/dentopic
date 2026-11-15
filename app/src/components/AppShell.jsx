import { useEffect, useRef, useState } from 'react'
import { Box, Flex, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  FiSearch, FiHome, FiCamera, FiUsers, FiLayers, FiFolder, FiCalendar,
  FiMonitor, FiSettings, FiLogOut, FiUser, FiChevronDown,
  FiMoon, FiSun, FiMenu,
} from 'react-icons/fi'
import Logo from './Logo'
import { MenuDropdown, MenuItem, Tip, ToastHost } from './ui'
import { C, getMode, applyMode } from '../theme'
import { useApp } from '../context/AppContext'

// Ordre = ordre affiché dans la barre latérale
const NAV = [
  { to: '/recherche', label: 'Recherche', icon: FiSearch },
  { to: '/', label: 'Accueil', icon: FiHome },
  { to: '/acquisition', label: 'Acquisition', icon: FiCamera },
  { to: '/dossier-patient', label: 'Dossier patient', icon: FiUsers },
  { to: '/studio', label: 'Studio', icon: FiLayers },
  { to: '/collection', label: 'Collection', icon: FiFolder },
  { to: '/publication', label: 'Publication', icon: FiCalendar },
  { to: '/presentations', label: 'Présentations', icon: FiMonitor },
  { to: '/reglage', label: 'Réglages', icon: FiSettings },
]

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'DG'
}

export default function AppShell() {
  const { profile, signOut } = useApp()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState(getMode())
  const [navOpen, setNavOpen] = useState(false) // tiroir latéral (< lg)
  const [userMenu, setUserMenu] = useState(false)
  const [q, setQ] = useState('')
  const searchRef = useRef(null)
  const goSearch = () => { const s = q.trim(); if (s) navigate(`/recherche?q=${encodeURIComponent(s)}`) }
  // Focus de la recherche : ⌘K / Ctrl+K, ou « / » hors champ de saisie
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const dark = mode === 'dark' // le Studio suit aussi le basculement clair/sombre
  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyMode(next)
  }
  // L'onglet navigateur reprend le nom de la section courante.
  useEffect(() => {
    const nav = NAV.find((n) => n.to === pathname)
      || NAV.find((n) => n.to !== '/' && pathname.startsWith(n.to))
    document.title = nav ? `${nav.label} — DentoPic` : 'DentoPic'
  }, [pathname])
  const sbBg = dark ? C.darkSidebar : C.sidebarBg
  const sbBorder = dark ? '#1c2635' : C.cardBorder
  const navFg = dark ? '#c4cdd9' : C.body
  const navActive = dark ? '#1a2434' : C.navActive
  const navActiveFg = dark ? C.darkFg : C.ink

  const sidebarInner = (onNav) => (
    <>
      <Box px="4" pt="4" pb="3"><Logo /></Box>
      <VStack align="stretch" gap="0.5" px="2" flex="1">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} style={{ textDecoration: 'none' }} onClick={onNav}>
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
    </>
  )

  return (
    <Flex h="100vh" bg={dark ? C.darkBg : C.pageBg} overflow="hidden">
      <Flex w="232px" direction="column" bg={sbBg} borderRight="1px solid" borderColor={sbBorder} flexShrink={0}
        display={{ base: 'none', lg: 'flex' }}>
        {sidebarInner()}
      </Flex>
      {navOpen && (
        <>
          <Box position="fixed" inset="0" bg="blackAlpha.400" zIndex="40"
            display={{ lg: 'none' }} onClick={() => setNavOpen(false)} />
          <Flex w="240px" position="fixed" left="0" top="0" bottom="0" direction="column"
            bg={sbBg} borderRight="1px solid" borderColor={sbBorder} zIndex="50"
            display={{ lg: 'none' }} overflowY="auto">
            {sidebarInner(() => setNavOpen(false))}
          </Flex>
        </>
      )}

      <Flex direction="column" flex="1" minW="0">
        <HStack h="52px" px={{ base: '3', lg: '5' }} gap={{ base: '2', lg: '4' }} bg={dark ? C.darkSidebar : 'white'} borderBottom="1px solid" borderColor={sbBorder} flexShrink={0}>
          <Box as={FiMenu} fontSize="18px" cursor="pointer" flexShrink={0}
            color={dark ? C.darkMuted : 'gray.500'}
            display={{ base: 'block', lg: 'none' }}
            aria-label="Ouvrir le menu" onClick={() => setNavOpen(true)} />
          <HStack
            flex="0 0 240px" h="30px" gap="2" px="2.5"
            bg={dark ? C.darkCard : 'gray.50'}
            border="1px solid" borderColor={dark ? C.darkBorder : C.cardBorder}
            borderRadius="md"
            display={{ base: 'none', md: 'flex' }}
          >
            <Box as={FiSearch} color={dark ? C.darkMuted : 'gray.400'} fontSize="13px" />
            <Input
              ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goSearch() }}
              variant="flushed" placeholder="Rechercher…" fontSize="xs"
              border="none" _focus={{ boxShadow: 'none' }} h="100%"
              color={dark ? '#dfe6ef' : 'inherit'}
            />
          </HStack>
          <Box flex="1" />
          <Tip label={mode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
            <Box
              as={mode === 'dark' ? FiSun : FiMoon} fontSize="15px" cursor="pointer"
              color={dark ? C.darkMuted : 'gray.500'}
              aria-label={mode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
              onClick={toggleMode}
            />
          </Tip>
          <Box position="relative">
            <HStack gap="1" cursor="pointer" onClick={() => setUserMenu((v) => !v)} aria-label="Menu utilisateur">
              <Flex w="28px" h="28px" borderRadius="full" align="center" justify="center"
                bg={dark ? C.darkBorder : 'gray.200'} color={dark ? '#dfe6ef' : 'gray.600'}
                fontSize="2xs" fontWeight="700" flexShrink={0}>
                {initials(profile?.full_name)}
              </Flex>
              <Box as={FiChevronDown} fontSize="12px" color={dark ? C.darkMuted : 'gray.400'} />
            </HStack>
            <MenuDropdown open={userMenu} onClose={() => setUserMenu(false)} up={false} minW="190px">
              <Box px="3" py="2" borderBottom="1px solid" borderColor={C.cardBorder}>
                <Text fontSize="xs" fontWeight="600" color={C.ink} isTruncated>{profile?.full_name || '—'}</Text>
                <Text fontSize="2xs" color="gray.500" isTruncated>{profile?.profession || ''}</Text>
              </Box>
              <MenuItem icon={FiUser} label="Mon profil" onClick={() => { setUserMenu(false); navigate('/reglage/profil') }} />
              <MenuItem icon={FiSettings} label="Réglages" onClick={() => { setUserMenu(false); navigate('/reglage') }} />
              <MenuItem icon={FiLogOut} label="Se déconnecter" danger onClick={() => { setUserMenu(false); signOut() }} />
            </MenuDropdown>
          </Box>
        </HStack>

        <Box flex="1" overflowY="auto" bg={dark ? C.darkBg : C.pageBg}>
          <Outlet />
        </Box>
      </Flex>
      <ToastHost />
    </Flex>
  )
}
