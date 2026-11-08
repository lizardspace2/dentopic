// Route /reglage/pro — « Passer Pro ».
// Offres réelles depuis workspace_plans ; la bascule met à jour
// workspaces.plan (Stripe non configuré côté projet — bascule immédiate).
import { useEffect, useState } from 'react'
import {
  Box, Button, Center, HStack, SimpleGrid, Text, VStack,
} from '@chakra-ui/react'
import {
  FiCheck, FiUsers, FiUser, FiShare2, FiShield, FiStar,
} from 'react-icons/fi'
import { FaCrown } from 'react-icons/fa'
import { ReglageNav } from '../components/ReglageNav'
import {
  Card, Tag, PageHeader, HelpButton, PrimaryButton, Modal, SectionLabel,
} from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { getPlanInfo, setWorkspacePlan } from '../api'

const limitLabel = (n) => (n == null ? '—' : n < 0 ? 'Illimité' : n)
const PLAN_ORDER = ['free', 'pro', 'team', 'clinic']
const PLAN_DESC = {
  free: 'Découverte — un praticien seul',
  pro: 'Cabinet vérifié, plus de réseaux',
  team: 'Un binôme praticien + assistant',
  clinic: 'Structure multi-praticiens sans limite',
}

const features = (p) => [
  [FiUsers, `Membres de l'équipe : ${limitLabel(p.max_members)}`],
  [FiUser, `Praticiens : ${limitLabel(p.max_dentists)} · Assistants : ${limitLabel(p.max_assistants)}`],
  [FiShare2, `Comptes réseaux sociaux : ${limitLabel(p.max_social_accounts)}`],
  [FiShield, p.has_verification ? 'Badge cabinet vérifié inclus' : 'Pas de badge vérifié'],
]

export default function ReglagePro() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [info, setInfo] = useState(null)
  const [pick, setPick] = useState(null)   // plan choisi → modal
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  const reload = () => { if (wsId) getPlanInfo(wsId).then(setInfo) }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  const cur = info?.workspace?.plan
  const plans = (info?.plans || []).slice()
    .sort((a, b) => PLAN_ORDER.indexOf(a.slug) - PLAN_ORDER.indexOf(b.slug))

  const apply = async () => {
    setBusy(true)
    const ok = await setWorkspacePlan(wsId, pick.slug)
    setBusy(false)
    if (ok) { setDone(pick); setPick(null); reload() }
  }

  return (
    <Box w="100%" px="6" py="6">
      <ReglageNav />
      <PageHeader
        icon={FaCrown} iconBg="amber.100" iconColor="amber.500"
        title="Passer Pro" subtitle="Débloquez toutes les fonctionnalités de DentoPic"
      >
        <HelpButton />
      </PageHeader>

      {done && (
        <HStack mb="4" px="3" py="2" borderRadius="md" bg={C.greenBg} gap="2" maxW="520px">
          <Box as={FiCheck} color={C.greenText} fontSize="sm" />
          <Text fontSize="xs" color={C.greenText}>
            Plan « {done.display_name} » activé — vos nouvelles limites sont effectives.
          </Text>
        </HStack>
      )}

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="4" mt="4">
        {plans.map((p) => {
          const active = p.slug === cur
          const popular = p.slug === 'pro'
          return (
            <Card key={p.slug} p="5" position="relative"
              border={active ? `2px solid ${C.primary}` : popular ? `2px solid amber.400` : undefined}>
              {popular && (
                <Box position="absolute" top="-11px" left="16px" px="2" py="0.5"
                  borderRadius="md" bg="amber.400" color="white"
                  fontSize="2xs" fontWeight="700" display="flex" alignItems="center" gap="3px">
                  <FiStar />Populaire
                </Box>
              )}
              <HStack mb="1" gap="2">
                <Text fontSize="lg" fontWeight="800" color={C.ink}>{p.display_name}</Text>
                {active && <Tag color="blue">Plan actuel</Tag>}
              </HStack>
              <Text fontSize="2xs" color="gray.500" mb="3">{PLAN_DESC[p.slug]}</Text>
              <VStack align="start" gap="2" mb="4">
                {features(p).map(([I, txt], i) => (
                  <HStack key={i} gap="2" align="start">
                    <Box as={I} color={p.has_verification || i < 3 ? C.primary : 'gray.300'}
                      fontSize="sm" mt="0.5" flexShrink={0} />
                    <Text fontSize="xs" color={i === 3 && !p.has_verification ? 'gray.400' : 'gray.600'}>
                      {txt}
                    </Text>
                  </HStack>
                ))}
              </VStack>
              {active ? (
                <Button w="100%" variant="outline" size="sm" disabled>
                  <FiCheck /> Activé
                </Button>
              ) : (
                <PrimaryButton w="100%" icon={FaCrown} onClick={() => setPick(p)}>
                  {PLAN_ORDER.indexOf(p.slug) > PLAN_ORDER.indexOf(cur) ? 'Passer à cette offre' : 'Choisir cette offre'}
                </PrimaryButton>
              )}
            </Card>
          )
        })}
      </SimpleGrid>

      {/* ---- ce que débloquent les offres payantes ---- */}
      <SectionLabel mt="7" mb="2">CE QUE DÉBLOQUENT LES OFFRES SUPÉRIEURES</SectionLabel>
      <Card p="5">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
          {[
            [FiUsers, 'Équipe élargie', 'Invitez praticiens et assistants sur les dossiers partagés'],
            [FiShield, 'Cabinet vérifié', 'Badge de vérification sur vos partages et présentations'],
            [FiShare2, 'Réseaux illimités', 'Connectez tous vos comptes sociaux, programmez sans limite'],
            [FiStar, 'Support prioritaire', 'Réponse prioritaire de l’équipe DentoPic'],
          ].map(([I, t, d], i) => (
            <HStack key={i} gap="3" align="start">
              <Center w="32px" h="32px" borderRadius="lg" bg={C.softBlue}
                color={C.primary} flexShrink={0}>
                <Box as={I} fontSize="14px" />
              </Center>
              <Box>
                <Text fontSize="sm" fontWeight="600" color={C.ink}>{t}</Text>
                <Text fontSize="2xs" color="gray.500">{d}</Text>
              </Box>
            </HStack>
          ))}
        </SimpleGrid>
      </Card>

      {/* ---- confirmation de bascule ---- */}
      <Modal open={!!pick} onClose={() => setPick(null)}
        title={`Passer à « ${pick?.display_name || ''} » ?`}
        subtitle="Le changement de plan est appliqué immédiatement"
        width="440px"
        footer={<>
          <Box />
          <PrimaryButton icon={FaCrown} onClick={apply} disabled={busy}>
            {busy ? 'Activation…' : `Activer ${pick?.display_name || ''}`}
          </PrimaryButton>
        </>}>
        <VStack align="start" gap="2">
          {pick && features(pick).map(([I, txt], i) => (
            <HStack key={i} gap="2">
              <Box as={FiCheck} color={C.greenText} fontSize="xs" />
              <Text fontSize="xs" color="gray.600">{txt}</Text>
            </HStack>
          ))}
          <Text fontSize="2xs" color="gray.400" mt="2">
            La facturation Stripe n'est pas connectée sur ce projet — la bascule
            est appliquée directement à votre workspace à des fins de démonstration.
          </Text>
        </VStack>
      </Modal>
    </Box>
  )
}
