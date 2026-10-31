import { useEffect, useState } from 'react'
import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiMonitor, FiWifi, FiPlus } from 'react-icons/fi'
import { Card, Tag, IconTile, PrimaryButton } from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { listCaptureDevices } from '../api'

export default function ReglageAppareils() {
  const { workspace } = useApp()
  const [devices, setDevices] = useState([])

  useEffect(() => {
    if (!workspace?.id) return
    listCaptureDevices(workspace.id).then(setDevices)
  }, [workspace?.id])

  return (
    <Box w="100%" px="6" py="6">
      <Link to="/reglage" style={{ textDecoration: 'none' }}>
        <HStack gap="2" color="gray.500" mb="6">
          <FiArrowLeft /> <Text fontSize="sm">Retour aux réglages</Text>
        </HStack>
      </Link>
      <HStack justify="space-between" mb="6">
        <Text fontSize="3xl" fontWeight="700" letterSpacing="-0.02em" color={C.ink}>
          Appareils de capture
        </Text>
        <PrimaryButton icon={FiPlus}>Ajouter</PrimaryButton>
      </HStack>

      <VStack align="stretch" gap="3">
        {devices.map((d) => (
          <Card key={d.id} p="4">
            <HStack gap="3">
              <IconTile icon={FiMonitor} />
              <Box flex="1">
                <HStack gap="2">
                  <Text fontSize="sm" fontWeight="600" color={C.ink}>{d.name}</Text>
                  {d.status === 'online' ? <Tag color="green">En ligne</Tag> : <Tag color="gray">Hors ligne</Tag>}
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  {[d.manufacturer, d.model].filter(Boolean).join(' · ') || '—'}
                </Text>
              </Box>
              <HStack gap="2" color="gray.400">
                <FiWifi /> <Text fontSize="xs">{d.connection_type || '—'}</Text>
              </HStack>
            </HStack>
          </Card>
        ))}
        {devices.length === 0 && (
          <Card p="8">
            <Text fontSize="sm" color="gray.500" textAlign="center">Aucun appareil enregistré.</Text>
          </Card>
        )}
      </VStack>
    </Box>
  )
}
