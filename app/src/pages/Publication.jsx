import { useState } from 'react'
import { Box, Button, Flex, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiBell, FiPlus, FiZap, FiShare2, FiEdit3, FiList, FiGlobe,
  FiChevronLeft, FiChevronRight, FiFilter, FiCalendar,
} from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi2'
import { Card, EmptyPane, PageHeader, HelpButton, PrimaryButton } from '../components/ui'
import { C } from '../theme'

const DAYS = ['LUN 26', 'MAR 27', 'MER 28', 'JEU 29', 'VEN 30', 'SAM 31', 'DIM 1']

const STEPS = [
  'Connectez un réseau social (Instagram, Facebook…) dans les réglages.',
  'Préparez votre brouillon dès maintenant — média, légende et patient sont conservés même sans connexion.',
  "Une fois le réseau connecté, rattachez-le au brouillon puis programmez la publication.",
]

const EVENTS = [
  ['13 nov.', 'Journée mondiale de la gentill…'],
  ['14 nov.', 'Journée mondiale du diabète…'],
]

export default function Publication() {
  const [view, setView] = useState('week')
  const [tab, setTab] = useState('moments')
  return (
    <Box w="100%" px="6" py="6">
      <PageHeader
        icon={FiCalendar} iconBg={C.greenBg} iconColor={C.greenText}
        title="Programmation"
        subtitle="Planifiez vos publications sur les réseaux sociaux."
      >
        <HelpButton />
        <Button variant="outline" size="sm" borderRadius="md" color="gray.600">
          <FiBell /> Activer les notifications
        </Button>
      </PageHeader>
      <HStack gap="2" mb="5" justify="flex-end">
        <Button variant="outline" size="sm" borderRadius="md" color="gray.500">
          <HiOutlineSparkles /> Avant/Après express
        </Button>
        <Button variant="outline" size="sm" borderRadius="md" color="gray.500">
          <FiZap /> Campagne IA
        </Button>
        <PrimaryButton icon={FiPlus}>Nouvelle publication</PrimaryButton>
      </HStack>

      <Card p="5" mb="5" bg={C.softBlue} borderColor={C.softBlueBorder}>
        <HStack gap="2" mb="3">
          <Box as={FiShare2} color={C.primary} fontSize="sm" />
          <Text fontSize="sm" fontWeight="600" color={C.ink}>Publier pour la première fois</Text>
        </HStack>
        <VStack align="stretch" gap="1.5" mb="4">
          {STEPS.map((s, i) => (
            <HStack key={i} gap="2.5">
              <NumDot n={i + 1} />
              <Text fontSize="sm" color={C.body}>{s}</Text>
            </HStack>
          ))}
        </VStack>
        <HStack gap="3" mb="3">
          <PrimaryButton icon={FiShare2}>Connecter un réseau</PrimaryButton>
          <Button variant="outline" size="sm" color="gray.600">
            <FiEdit3 /> Préparer un brouillon
          </Button>
        </HStack>
        <Text fontSize="2xs" color="gray.500">
          La connexion d'un compte est réservée aux propriétaires et administrateurs du cabinet.
          Un brouillon peut être préparé par tout membre autorisé à écrire.
        </Text>
      </Card>

      <HStack gap="4" alignItems="start">
        <Box flex="1">
          <HStack mb="4" gap="2">
            <HStack gap="0">
              <Button size="xs" bg={view === 'week' ? C.primary : 'white'} color={view === 'week' ? '#ffffff' : 'gray.600'} border="1px solid" borderColor={C.cardBorder} borderRadius="md 0 0 md" onClick={() => setView('week')}>Semaine</Button>
              <Button size="xs" bg={view === 'month' ? C.primary : 'white'} color={view === 'month' ? '#ffffff' : 'gray.600'} border="1px solid" borderColor={C.cardBorder} borderRadius="0" onClick={() => setView('month')}>Calendrier</Button>
            </HStack>
            <Button variant="outline" size="xs" px="2"><FiList /></Button>
            <Button variant="outline" size="xs" px="2"><FiGlobe /></Button>
            <Button variant="ghost" size="xs" px="1"><FiChevronLeft /></Button>
            <Button variant="outline" size="xs">Aujourd'hui</Button>
            <Button variant="ghost" size="xs" px="1"><FiChevronRight /></Button>
            <Text fontSize="lg" fontWeight="700" color={C.ink} flex="1" textAlign="center">Octobre 2026</Text>
            <HStack bg="white" border="1px solid" borderColor={C.cardBorder} borderRadius="md" px="2" h="30px" gap="1.5">
              <Box as={FiFilter} color="gray.400" fontSize="xs" />
              <Text fontSize="xs" color="gray.600">Type de contenu : Tous</Text>
              <Text fontSize="2xs" color="gray.400">⌄</Text>
            </HStack>
          </HStack>
          <SimpleGrid columns={8} gap="0" border="1px solid" borderColor={C.cardBorder} borderRadius="lg" overflow="hidden">
            <EmptyPane borderRadius="0" border="none" borderRight="1px solid" borderColor={C.cardBorder} p="6" m="0" minH="220px">
              <VStack gap="3" align="center" justify="center" h="100%">
                <Text fontSize="xs" color="gray.600" textAlign="center">Créer une publication, une story ou un reel.</Text>
                <Text fontSize="2xs" color="gray.400" textAlign="center">Partagez du contenu avec votre audience aujourd'hui.</Text>
                <Button size="xs" variant="outline">Créer ⌄</Button>
              </VStack>
            </EmptyPane>
            {DAYS.map((d, i) => (
              <Box key={d} bg={i === 5 ? C.softBlue : 'white'} borderRight={i < 6 ? '1px solid' : 'none'} borderColor="gray.100" p="2" minH="220px">
                <HStack justify="space-between">
                  <Text fontSize="2xs" fontWeight={i === 5 ? '700' : '500'} color={i === 5 ? C.primary : 'gray.500'}>{d}</Text>
                  <Text fontSize="2xs" color="gray.300">+</Text>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        </Box>

        <Card w="270px" flexShrink={0} p="4">
          <HStack gap="4" mb="3" borderBottom="1px solid" borderColor="gray.100" pb="2">
            {[['objectifs', 'Objectifs'], ['moments', 'Moments'], ['brouillons', 'Brouillons']].map(([k, label]) => (
              <Text
                key={k} fontSize="xs" pb="1" cursor="pointer"
                fontWeight={tab === k ? '600' : '400'}
                color={tab === k ? C.primary : 'gray.500'}
                borderBottom={tab === k ? '2px solid' : 'none'}
                borderColor={C.primary}
                onClick={() => setTab(k)}
              >
                {label}
              </Text>
            ))}
          </HStack>
          <Text fontSize="xs" fontWeight="600" color={C.ink} mb="1">Meilleurs moments</Text>
          <Text fontSize="2xs" color="gray.500" mb="2">Heures où votre audience est la plus active cette semaine.</Text>
          <Text fontSize="2xs" color="gray.400" mb="3">Aucune donnée d'audience — connectez un compte.</Text>
          <Text fontSize="xs" fontWeight="600" color={C.ink} mb="2">Événements à venir</Text>
          <VStack align="stretch" gap="2">
            {EVENTS.map(([d, t]) => (
              <HStack key={d} bg={C.softBlue} borderRadius="md" px="2" py="1.5" gap="2">
                <Text fontSize="2xs" color={C.primary} fontWeight="600" whiteSpace="nowrap">{d}</Text>
                <Text fontSize="2xs" color={C.body} isTruncated flex="1">{t}</Text>
                <Box as={FiCalendar} color={C.primary} fontSize="2xs" />
              </HStack>
            ))}
          </VStack>
        </Card>
      </HStack>
    </Box>
  )
}

function NumDot({ n }) {
  return (
    <Flex w="18px" h="18px" borderRadius="full" bg={C.softBlue} color={C.primary}
      align="center" justify="center" fontSize="2xs" fontWeight="700" flexShrink={0}>
      {n}
    </Flex>
  )
}
