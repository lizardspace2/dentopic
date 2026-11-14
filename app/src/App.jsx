import { useState } from 'react'
import { Box, Button, Center, Input, Spinner, Text, VStack } from '@chakra-ui/react'
import { Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { C } from './theme'
import AppShell from './components/AppShell'
import Logo from './components/Logo'
import Login from './pages/Login'
import Capture from './pages/Capture'
import Dashboard from './pages/Dashboard'
import Recherche from './pages/Recherche'
import Acquisition from './pages/acquisition'
import DossierPatient from './pages/DossierPatient'
import Studio from './pages/studio'
import Collection from './pages/Collection'
import Publication from './pages/Publication'
import Presentations from './pages/Presentations'
import Reglages from './pages/Reglages'
import ReglageProfil from './pages/ReglageProfil'
import ReglageAppareils from './pages/ReglageAppareils'
import ReglageMembres from './pages/ReglageMembres'
import ReglageBrand from './pages/ReglageBrand'
import ReglageProtocoles from './pages/ReglageProtocoles'
import ReglageStockage from './pages/ReglageStockage'
import ReglageReseaux from './pages/ReglageReseaux'
import ReglagePro from './pages/ReglagePro'
import NotFound from './pages/NotFound'

function WelcomeCabinet() {
  const { createWorkspace } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createWorkspace(name.trim() || 'Mon cabinet')
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
      setBusy(false)
    }
  }

  return (
    <Center minH="100vh" bg={C.pageBg} p="4">
      <Box as="form" onSubmit={submit} w="100%" maxW="384px" bg="white"
        border="1px solid" borderColor={C.cardBorder} borderRadius="2xl" px="8" py="8" boxShadow="sm">
        <Logo size="lg" />
        <Text mt="7" fontSize="xl" fontWeight="700" color={C.ink}>Bienvenue sur DentoPic</Text>
        <Text mt="1" fontSize="sm" color="gray.500">
          Donnez un nom à votre espace de travail pour commencer — photos, dossiers et publications y seront rangés.
        </Text>
        <VStack align="stretch" mt="6" gap="4">
          <Box>
            <Text fontSize="sm" fontWeight="500" mb="1.5" color={C.ink}>Nom du cabinet</Text>
            <Input fontSize="sm" placeholder="ex. Cabinet Sourire" value={name}
              onChange={(e) => setName(e.target.value)} autoFocus />
          </Box>
          {error && <Text fontSize="xs" color="red.500">{error}</Text>}
          <Button type="submit" w="100%" bg={C.primary} color="#ffffff" fontWeight="600"
            loading={busy} _hover={{ bg: C.primaryHover }}>
            Créer mon espace
          </Button>
        </VStack>
      </Box>
    </Center>
  )
}

export default function App() {
  const { session, loading, workspace, wsLoaded } = useApp()

  if (loading || (session && !wsLoaded)) {
    return (
      <Center minH="100vh" bg={C.pageBg}>
        <Spinner size="lg" color={C.primary} />
      </Center>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/capture/:token" element={<Capture />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  // Compte authentifié sans cabinet : seul le bootstrap est accessible.
  if (!workspace) {
    return (
      <Routes>
        <Route path="/capture/:token" element={<Capture />} />
        <Route path="*" element={<WelcomeCabinet />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/capture/:token" element={<Capture />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/recherche" element={<Recherche />} />
        <Route path="/acquisition" element={<Acquisition />} />
        <Route path="/acquisition/capture/:id" element={<Acquisition />} />
        <Route path="/dossier-patient" element={<DossierPatient />} />
        <Route path="/dossier-patient/dossier/:id" element={<DossierPatient />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/studio/:sub" element={<Studio />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/publication" element={<Publication />} />
        <Route path="/presentations" element={<Presentations />} />
        <Route path="/presentations/:id" element={<Presentations />} />
        <Route path="/reglage" element={<Reglages />} />
        <Route path="/reglage/profil" element={<ReglageProfil />} />
        <Route path="/reglage/appareils" element={<ReglageAppareils />} />
        <Route path="/reglage/membres" element={<ReglageMembres />} />
        <Route path="/reglage/brand" element={<ReglageBrand />} />
        <Route path="/reglage/protocoles" element={<ReglageProtocoles />} />
        <Route path="/reglage/stockage" element={<ReglageStockage />} />
        <Route path="/reglage/reseaux" element={<ReglageReseaux />} />
        <Route path="/reglage/pro" element={<ReglagePro />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
