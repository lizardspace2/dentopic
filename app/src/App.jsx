import { Center, Spinner } from '@chakra-ui/react'
import { Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { C } from './theme'
import AppShell from './components/AppShell'
import Login from './pages/Login'
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
import NotFound from './pages/NotFound'

export default function App() {
  const { session, loading } = useApp()

  if (loading) {
    return (
      <Center minH="100vh" bg={C.pageBg}>
        <Spinner size="lg" color={C.primary} />
      </Center>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
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
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
