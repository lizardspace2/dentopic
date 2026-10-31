import { useState } from 'react'
import { Box, Button, HStack, Input, SimpleGrid, Text } from '@chakra-ui/react'
import { FiSearch, FiBookmark } from 'react-icons/fi'
import { Card, EmptyPane, Select, Field, PrimaryButton } from '../components/ui'
import { C } from '../theme'

const PERIODS = [
  ['all', 'Toute période'],
  ['7d', '7 jours'],
  ['30d', '30 jours'],
  ['1y', '1 an'],
]

const TextInput = (p) => <Input fontSize="sm" bg="white" {...p} />

export default function Recherche() {
  const [period, setPeriod] = useState('all')
  return (
    <Box w="100%" px="6" py="6">
      <HStack gap="3" mb="6">
        <Box as={FiSearch} color="blue.500" fontSize="xl" />
        <Box>
          <Text fontSize="xl" fontWeight="700" letterSpacing="-0.01em" color={C.ink}>
            Recherche multicritères
          </Text>
          <Text fontSize="sm" color="gray.500">
            Retrouvez dossiers, photos, montages et cas cliniques.
          </Text>
        </Box>
      </HStack>

      <Card p="6" mb="5">
        <Text fontSize="sm" fontWeight="600" color={C.ink} mb="4">Filtres</Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mb="4">
          <Field label="N° de dossier patient / N° de cas / nom">
            <TextInput placeholder="ex. 2024-001, Patient Dupont…" />
          </Field>
          <Field label="Tag"><Select w="100%"><option>Tous les tags</option></Select></Field>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 4 }} gap="4" mb="4">
          <Field label="Diagnostic"><TextInput placeholder="ex. Carie" /></Field>
          <Field label="Type de traitement"><TextInput placeholder="ex. Facette" /></Field>
          <Field label="Matériau"><TextInput placeholder="ex. Céramique" /></Field>
          <Field label="Sévérité"><TextInput placeholder="ex. Sévère" /></Field>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 4 }} gap="4" mb="4">
          <Field label="Classe IA photo"><TextInput placeholder="ex. smile" /></Field>
          <Field label="Statut"><Select w="100%"><option>Tous</option></Select></Field>
          <Field label="Sexe"><Select w="100%"><option>Tous</option><option>F</option><option>M</option></Select></Field>
          <Field label="Âge min"><TextInput type="number" /></Field>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 4 }} gap="4" mb="5">
          <Field label="Âge max"><TextInput type="number" /></Field>
        </SimpleGrid>

        <HStack gap="0" mb="5">
          {PERIODS.map(([k, label], i) => (
            <Button
              key={k} size="xs"
              borderRadius={i === 0 ? 'md 0 0 md' : '0'}
              bg={period === k ? C.primary : 'white'}
              color={period === k ? '#ffffff' : 'gray.600'}
              border="1px solid" borderColor="gray.200"
              onClick={() => setPeriod(k)}
            >
              {label}
            </Button>
          ))}
          <Box w="170px" flexShrink={0} ml="3">
            <Select w="100%" h="30px" fontSize="xs"><option>Toutes les dents</option></Select>
          </Box>
        </HStack>

        <HStack gap="3">
          <PrimaryButton>Rechercher</PrimaryButton>
          <Button variant="outline" size="sm" color="gray.600">
            <FiBookmark /> Enregistrer la recherche
          </Button>
        </HStack>
      </Card>

      <EmptyPane>
        <Text fontSize="sm" fontWeight="600" color={C.ink} mb="1">Aucun résultat</Text>
        <Text fontSize="xs" color="gray.500">
          Modifiez votre recherche ou ajoutez un terme plus général.
        </Text>
      </EmptyPane>
    </Box>
  )
}
