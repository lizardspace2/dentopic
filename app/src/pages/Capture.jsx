// Route /capture/:token — page mobile ouverte en scannant le QR d'acquisition.
// Le token = capture_sessions.mobile_token. La page attend que la session démarre
// (polling), puis permet de photographier / envoyer des clichés directement
// dans la session (patient_photos.capture_session_id) et le dossier cible.
// Hors AppShell : pensée pour un téléphone. Nécessite une session utilisateur
// (mini-formulaire de connexion intégré si le téléphone n'est pas connecté).
import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Center, HStack, IconButton, Input, InputGroup, Text, VStack,
} from '@chakra-ui/react'
import { useParams } from 'react-router-dom'
import { FiCamera, FiCheckCircle, FiEye, FiEyeOff, FiImage, FiLock, FiMail } from 'react-icons/fi'
import { useApp } from '../context/AppContext'
import { getDossier, getSessionByToken, importPhotos } from '../api'
import { supabase } from '../supabase'
import Logo from '../components/Logo'
import { C } from '../theme'

const FIELD = {
  fontSize: 'sm', bg: 'white', border: '1px solid', borderColor: 'gray.200', borderRadius: 'md',
}

function CaptureLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }
  return (
    <Center minH="100vh" bg={C.pageBg} p="4">
      <Box as="form" onSubmit={submit} w="100%" maxW="360px" bg="white"
        border="1px solid" borderColor={C.cardBorder} borderRadius="2xl" px="7" py="7">
        <Logo size="md" />
        <Text mt="5" fontSize="lg" fontWeight="700" color={C.ink}>Capture mobile</Text>
        <Text fontSize="sm" color="gray.500">Connectez-vous pour envoyer vos clichés.</Text>
        <VStack align="stretch" mt="5" gap="3">
          <InputGroup startElement={<FiMail color="gray" />}>
            <Input {...FIELD} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          </InputGroup>
          <InputGroup startElement={<FiLock color="gray" />}
            endElement={
              <IconButton aria-label="Voir" variant="ghost" size="xs" onClick={() => setShow(!show)}>
                {show ? <FiEyeOff /> : <FiEye />}
              </IconButton>
            }>
            <Input {...FIELD} type={show ? 'text' : 'password'} placeholder="Mot de passe"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </InputGroup>
          {error && <Text fontSize="xs" color="red.500">{error}</Text>}
          <Button type="submit" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }} loading={busy}>
            Se connecter
          </Button>
        </VStack>
      </Box>
    </Center>
  )
}

export default function Capture() {
  const { token } = useParams()
  const { session, loading } = useApp()
  const [capSession, setCapSession] = useState(null)
  const [missing, setMissing] = useState(false)
  const [dossier, setDossier] = useState(null)
  const [shots, setShots] = useState([]) // previews des envois
  const [sent, setSent] = useState(0)
  const [busy, setBusy] = useState(false)
  const camInput = useRef(null)
  const galInput = useRef(null)

  // polling : attend que la session soit démarrée côté ordinateur
  useEffect(() => {
    if (!session || !token) return
    let tries = 0
    let alive = true
    const tick = async () => {
      const s = await getSessionByToken(token)
      if (!alive) return
      if (s) {
        setCapSession(s)
        setMissing(false)
        if (!s.ended_at) setTimeout(tick, 3000) // continue : détecter la fin
        if (s.dossier_id && !dossier) getDossier(s.dossier_id).then((d) => alive && setDossier(d))
      } else if (++tries < 40) {
        setTimeout(tick, 2500)
      } else setMissing(true)
    }
    tick()
    return () => { alive = false }
  }, [session, token])

  const send = async (files) => {
    const arr = Array.from(files || [])
    if (!arr.length || !capSession) return
    setBusy(true)
    const rows = await importPhotos(capSession.workspace_id, arr, capSession.dossier_id, capSession.id)
    setSent((n) => n + rows.length)
    setShots((s) => [...s, ...arr.map((f) => URL.createObjectURL(f))])
    setBusy(false)
  }

  if (loading) {
    return <Center minH="100vh" bg={C.pageBg}><Text color="gray.500">Chargement…</Text></Center>
  }
  if (!session) return <CaptureLogin />

  const ended = capSession?.ended_at
  return (
    <Center minH="100vh" bg={C.pageBg} p="4">
      <VStack w="100%" maxW="420px" gap="5" align="stretch">
        <Center flexDirection="column" gap="1">
          <Logo size="md" />
          <Text fontSize="lg" fontWeight="700" color={C.ink} mt="3">Capture mobile</Text>
        </Center>

        {!capSession && !missing && (
          <Box bg="white" border="1px solid" borderColor={C.cardBorder} borderRadius="xl" p="6" textAlign="center">
            <Text fontSize="sm" color="gray.500">
              En attente du démarrage de la session sur l'ordinateur…
            </Text>
          </Box>
        )}
        {missing && (
          <Box bg={C.amberBg} border="1px solid" borderColor={C.amberBorder} borderRadius="xl" p="6" textAlign="center">
            <Text fontSize="sm" color={C.amberText} fontWeight="600">Session introuvable</Text>
            <Text fontSize="xs" color={C.amberText} mt="1">
              Re-scannez le QR affiché dans l'Acquisition, ou démarrez une session.
            </Text>
          </Box>
        )}

        {capSession && (
          <>
            <HStack bg={dossier ? C.greenBg : C.softBlue} border="1px solid"
              borderColor={dossier ? C.greenBorder : 'transparent'} borderRadius="md" px="4" py="3" gap="2">
              <Box as={ended ? FiCheckCircle : FiCamera} color={dossier ? C.greenText : C.primary} />
              <Text fontSize="sm" fontWeight="600" color={dossier ? C.greenText : C.primary}>
                {ended ? 'Session terminée' : dossier ? `Destination : ${dossier.name}` : 'Session active — Non triées'}
              </Text>
            </HStack>

            {!ended && (
              <VStack gap="3">
                <Button size="lg" h="56px" fontSize="md" bg={C.primary} color="#ffffff"
                  _hover={{ bg: C.primaryHover }} loading={busy}
                  onClick={() => camInput.current?.click()}>
                  <FiCamera /> Prendre une photo
                </Button>
                <Button size="md" variant="outline" onClick={() => galInput.current?.click()}>
                  <FiImage /> Depuis la galerie
                </Button>
                <input ref={camInput} type="file" accept="image/*" capture="environment" hidden
                  onChange={(e) => { send(e.target.files); e.target.value = '' }} />
                <input ref={galInput} type="file" accept="image/*" multiple hidden
                  onChange={(e) => { send(e.target.files); e.target.value = '' }} />
              </VStack>
            )}

            {sent > 0 && (
              <HStack justify="center" gap="2">
                <Box as={FiCheckCircle} color={C.greenText} />
                <Text fontSize="sm" color={C.greenText} fontWeight="600">
                  {sent} photo(s) envoyée(s) dans le dossier
                </Text>
              </HStack>
            )}
            {shots.length > 0 && (
              <HStack gap="2" flexWrap="wrap" justify="center">
                {shots.slice(-6).map((s, i) => (
                  <Box key={i} w="72px" h="72px" borderRadius="md" overflow="hidden"
                    border="1px solid" borderColor={C.cardBorder}>
                    <img src={s} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </Box>
                ))}
              </HStack>
            )}
          </>
        )}
      </VStack>
    </Center>
  )
}
