import { useEffect, useState } from 'react'
import { Box, Center, Circle, HStack, Input, SimpleGrid, Text } from '@chakra-ui/react'
import { FiUser } from 'react-icons/fi'
import { Field, Select, PrimaryButton, PageHeader, toast } from '../components/ui'
import { ReglageNav } from '../components/ReglageNav'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { updateProfile } from '../api'

const TextInput = (p) => <Input fontSize="sm" bg="white" {...p} />

const PROFESSIONS = ['Chirurgien-dentister', 'Orthodontiste', 'Assistant dentaire']

export default function ReglageProfil() {
  const { profile, session } = useApp()
  const [f, setF] = useState({})

  useEffect(() => {
    if (profile) setF({ ...profile })
  }, [profile])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async () => {
    await updateProfile(session.user.id, {
      first_name: f.first_name,
      last_name: f.last_name,
      full_name: [f.first_name, f.last_name].filter(Boolean).join(' '),
      profession: f.profession,
      cabinet_name: f.cabinet_name,
      phone: f.phone,
      professional_number: f.professional_number,
      postal_address: f.postal_address,
      vat_number: f.vat_number,
    })
    toast.success('Profil enregistré.')
  }

  return (
    <Box w="100%" px="6" py="6">
      <ReglageNav />
      <PageHeader icon={FiUser} title="Profil" />

      <Center mb="2">
        <Circle size="96px" bg="gray.100" color="gray.400">
          <FiUser size="40" />
        </Circle>
      </Center>
      <Center mb="8">
        <Text fontSize="sm" color={C.primary} fontWeight="500" cursor="pointer">Changer la photo</Text>
      </Center>

      <SimpleGrid columns={2} gap="4" mb="4">
        <Field label="Prénom"><TextInput value={f.first_name || ''} onChange={set('first_name')} /></Field>
        <Field label="Nom"><TextInput value={f.last_name || ''} onChange={set('last_name')} /></Field>
      </SimpleGrid>
      <Field label="N° professionnel" mb="4"><TextInput value={f.professional_number || ''} onChange={set('professional_number')} /></Field>
      <Field label="Profession" mb="4">
        <Select w="100%" h="36px" value={f.profession || ''} onChange={set('profession')}>
          {PROFESSIONS.map((p) => <option key={p}>{p}</option>)}
        </Select>
      </Field>
      <SimpleGrid columns={2} gap="4" mb="4">
        <Field label="Email"><TextInput type="email" value={f.email || session?.user?.email || ''} onChange={set('email')} /></Field>
        <Field label="Téléphone"><TextInput value={f.phone || ''} onChange={set('phone')} /></Field>
      </SimpleGrid>
      <Field label="Nom du cabinet" mb="4"><TextInput value={f.cabinet_name || ''} onChange={set('cabinet_name')} /></Field>
      <Field label="Adresse postale" mb="4"><TextInput value={f.postal_address || ''} onChange={set('postal_address')} /></Field>
      <Field label="Numéro de TVA" mb="6"><TextInput value={f.vat_number || ''} onChange={set('vat_number')} /></Field>

      <HStack>
        <PrimaryButton onClick={save}>Enregistrer</PrimaryButton>
      </HStack>
    </Box>
  )
}
