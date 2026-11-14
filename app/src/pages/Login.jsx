import { useState } from 'react'
import {
  Box, Button, Center, HStack, IconButton, Input, InputGroup, Text, VStack,
} from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'
import Logo from '../components/Logo'
import { C } from '../theme'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const nav = useNavigate()
  const loc = useLocation()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (signup) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice('Email de confirmation envoyé — vérifiez votre boîte de réception.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // préserve le lien profond (ex. /capture/<token> scanné par QR)
        nav(loc.pathname === '/login' ? '/' : loc.pathname, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setBusy(false)
    }
  }

  const forgot = async () => {
    if (!email) { setError('Saisissez votre e-mail pour recevoir le lien.'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setBusy(false)
    if (error) setError(error.message)
    else setNotice('Lien de réinitialisation envoyé — vérifiez votre boîte de réception.')
  }

  const resend = async () => {
    if (!email) return
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setBusy(false)
    if (error) setError(error.message)
    else setNotice('Email de confirmation renvoyé.')
  }

  return (
    <Center minH="100vh" bg={C.pageBg} p="4">
      <Box
        as="form" onSubmit={submit}
        w="100%" maxW="384px" bg="white"
        border="1px solid" borderColor={C.cardBorder}
        borderRadius="2xl" px="8" py="8" boxShadow="sm"
      >
        <Logo size="lg" />
        <Text mt="7" fontSize="xl" fontWeight="700" color={C.ink}>
          {signup ? 'Créer un compte' : 'Connexion'}
        </Text>
        <Text mt="1" fontSize="sm" color="gray.500">
          {signup ? 'Choisissez votre e-mail et un mot de passe.' : 'Connectez-vous à votre compte.'}
        </Text>

        <VStack align="stretch" mt="6" gap="4">
          <Box>
            <Text fontSize="sm" fontWeight="500" mb="1.5" color={C.ink}>E-mail</Text>
            <InputGroup startElement={<FiMail color="gray.400" />}>
              <Input
                type="email" value={email} required ps="9"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cabinet@example.com"
              />
            </InputGroup>
          </Box>

          <Box>
            <HStack justify="space-between" mb="1.5">
              <Text fontSize="sm" fontWeight="500" color={C.ink}>Mot de passe</Text>
              {!signup && (
                <Text fontSize="xs" color="gray.400" cursor="pointer" _hover={{ color: C.primary }}
                  onClick={forgot}>Mot de passe oublié ?</Text>
              )}
            </HStack>
            <InputGroup
              startElement={<FiLock color="gray.400" />}
              endElement={
                <IconButton aria-label="Afficher" variant="ghost" size="xs" onClick={() => setShow(!show)}>
                  {show ? <FiEyeOff /> : <FiEye />}
                </IconButton>
              }
            >
              <Input
                type={show ? 'text' : 'password'} value={password} required ps="9" pe="9"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </InputGroup>
          </Box>

          {error && <Text fontSize="xs" color="red.500">{error}</Text>}
          {notice && (
            <Text fontSize="xs" color="green.600">
              {notice}{' '}
              {signup && notice.includes('confirmation') && (
                <Text as="span" color={C.primary} cursor="pointer" onClick={resend}>
                  Renvoyer l'email
                </Text>
              )}
            </Text>
          )}

          <Button type="submit" w="100%" bg={C.primary} color="#ffffff" fontWeight="600" loading={busy} _hover={{ bg: C.primaryHover }}>
            {signup ? 'Créer un compte' : 'Se connecter'}
          </Button>

          <Text textAlign="center" fontSize="sm" color="gray.500">
            {signup ? 'Déjà un compte ? ' : "Vous n'avez pas de compte ? "}
            <Text
              as="span" color={C.primary} fontWeight="500" cursor="pointer"
              onClick={() => { setSignup(!signup); setError(null); setNotice(null) }}
            >
              {signup ? 'Se connecter' : 'Créer un compte'}
            </Text>
          </Text>
        </VStack>
      </Box>
    </Center>
  )
}
