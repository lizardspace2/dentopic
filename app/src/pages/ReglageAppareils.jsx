import { useEffect, useState } from 'react'
import { Box, Button, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiArrowLeft, FiMapPin, FiMonitor, FiPlus, FiTrash2, FiWifi, FiEdit2,
} from 'react-icons/fi'
import { Card, Tag, IconTile, PrimaryButton, Tip, Field } from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import {
  ALLOWED_CONN, createCaptureDevice, createRoom, deleteRoom,
  listCaptureDevices, listRooms, updateCaptureDevice,
} from '../api'
import { devKind, sourceLabel } from './acquisition/constants'
import { DeviceModal } from './acquisition/modals'

export default function ReglageAppareils() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [devices, setDevices] = useState([])
  const [rooms, setRooms] = useState([])
  const [roomForm, setRoomForm] = useState(null) // { name, location } | null
  const [devModal, setDevModal] = useState(null) // 'new' | device | null

  const reload = async () => {
    if (!wsId) return
    const [devs, rms] = await Promise.all([listCaptureDevices(wsId), listRooms(wsId)])
    setDevices(devs); setRooms(rms)
  }
  useEffect(() => { reload() }, [wsId])

  const roomName = (id) => rooms.find((r) => r.id === id)?.name

  const saveRoom = async () => {
    const r = await createRoom(wsId, { name: roomForm.name.trim(), location: roomForm.location.trim() })
    if (r) { setRoomForm(null); reload() }
  }

  const removeRoom = async (r) => {
    if (await deleteRoom(r.id)) reload()
  }

  // Formulaire DeviceModal -> payload capture_devices (+ metadata fonctionnelle)
  const saveDevice = async (form) => {
    const prev = devModal && devModal !== 'new' ? devModal : null
    const kind = form.src === 'ftp' ? 'ftp' : form.src === 'watch' ? 'watch' : 'camera'
    const meta = {
      ...(prev?.metadata || {}),
      source: form.src, kind,
      liaison: form.liaison || undefined,
      interop: form.interop || undefined,
      conn: ALLOWED_CONN.has(form.conn) ? undefined : form.conn,
    }
    if (kind === 'ftp') meta.ftp = { ...(prev?.metadata?.ftp || {}), host: form.ftpHost }
    if (kind === 'watch') meta.watch = { ...(prev?.metadata?.watch || {}), path: form.watchPath }
    const payload = {
      name: form.name.trim(),
      manufacturer: form.manufacturer,
      model: form.model,
      status: form.status,
      room_id: form.roomId || null,
      connection_type: ALLOWED_CONN.has(form.conn) ? form.conn : 'other',
      metadata: meta,
    }
    const dev = prev
      ? await updateCaptureDevice(prev.id, payload)
      : await createCaptureDevice(wsId, { ...payload, roomId: payload.room_id, connectionType: payload.connection_type, status: payload.status })
    if (dev) { setDevModal(null); reload() }
    return !!dev
  }

  return (
    <Box w="100%" px="6" py="6">
      <Link to="/reglage" style={{ textDecoration: 'none' }}>
        <HStack gap="2" color="gray.500" mb="6">
          <FiArrowLeft /> <Text fontSize="sm">Retour aux réglages</Text>
        </HStack>
      </Link>
      <HStack justify="space-between" mb="6">
        <Text fontSize="3xl" fontWeight="700" letterSpacing="-0.02em" color={C.ink}>
          Appareils
        </Text>
        <PrimaryButton icon={FiPlus} onClick={() => setDevModal('new')}>Ajouter</PrimaryButton>
      </HStack>

      <VStack align="stretch" gap="6">
        {/* ---- Salles : localisation des appareils ---- */}
        <Box>
          <Text fontSize="lg" fontWeight="700" color={C.ink} mb="3">Salles</Text>
          <Card p="0" overflow="hidden">
            {rooms.map((r) => (
              <HStack key={r.id} px="4" py="3" borderBottom="1px solid" borderColor={C.cardBorder}>
                <Box as={FiMapPin} color={C.primary} flexShrink={0} />
                <Box flex="1" minW="0">
                  <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{r.name}</Text>
                  {r.location && <Text fontSize="xs" color="gray.500" isTruncated>{r.location}</Text>}
                </Box>
                <Text fontSize="xs" color="gray.400">
                  {devices.filter((d) => d.room_id === r.id).length} appareil(s)
                </Text>
                <Tip label="Supprimer la salle (les appareils sont déliés)">
                  <Box as="button" p="1" color="gray.400" cursor="pointer" _hover={{ color: 'red.500' }}
                    aria-label={`Supprimer ${r.name}`} onClick={() => removeRoom(r)}>
                    <FiTrash2 size={14} />
                  </Box>
                </Tip>
              </HStack>
            ))}
            {rooms.length === 0 && (
              <Text fontSize="sm" color="gray.500" textAlign="center" py="5">
                Aucune salle — créez-en une pour localiser vos appareils.
              </Text>
            )}
          </Card>
          {!roomForm ? (
            <HStack mt="3" px="3" py="2" gap="3" cursor="pointer" borderRadius="lg"
              _hover={{ bg: C.softBlue }} onClick={() => setRoomForm({ name: '', location: '' })}>
              <IconTile icon={FiPlus} />
              <Text fontSize="sm" color={C.primary} fontWeight="500">Nouvelle salle</Text>
            </HStack>
          ) : (
            <Card p="4" mt="3">
              <SimpleGrid columns={2} gap="3" mb="3">
                <Field label="Nom de la salle *">
                  <Input fontSize="sm" placeholder="ex. Salle 2" value={roomForm.name}
                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && roomForm.name.trim() && saveRoom()} />
                </Field>
                <Field label="Emplacement">
                  <Input fontSize="sm" placeholder="ex. RDC, couloir B" value={roomForm.location}
                    onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })} />
                </Field>
              </SimpleGrid>
              <HStack justify="end" gap="2">
                <Button variant="outline" size="sm" onClick={() => setRoomForm(null)}>Annuler</Button>
                <PrimaryButton onClick={saveRoom} disabled={!roomForm.name.trim()}>Créer</PrimaryButton>
              </HStack>
            </Card>
          )}
        </Box>

        {/* ---- Appareils de capture ---- */}
        <Box>
          <Text fontSize="lg" fontWeight="700" color={C.ink} mb="3">Appareils de capture</Text>
          <VStack align="stretch" gap="3">
            {devices.map((d) => (
              <Card key={d.id} p="4">
                <HStack gap="3">
                  <IconTile icon={FiMonitor} />
                  <Box flex="1" minW="0">
                    <HStack gap="2" flexWrap="wrap">
                      <Text fontSize="sm" fontWeight="600" color={C.ink}>{d.name}</Text>
                      {d.status === 'online' ? <Tag color="green">En ligne</Tag> : <Tag color="gray">Hors ligne</Tag>}
                      <Tag color="blue">{sourceLabel(devKind(d) === 'camera' ? 'camera' : devKind(d))}</Tag>
                      {d.room_id && roomName(d.room_id) && <Tag color="purple">{roomName(d.room_id)}</Tag>}
                    </HStack>
                    <Text fontSize="xs" color="gray.500" isTruncated>
                      {[d.manufacturer, d.model].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </Box>
                  <HStack gap="2" color="gray.400" flexShrink={0}>
                    <FiWifi /> <Text fontSize="xs">{d.metadata?.conn || d.connection_type || '—'}</Text>
                    <Tip label="Modifier l'appareil">
                      <Box as="button" p="1" cursor="pointer" _hover={{ color: C.primary }}
                        aria-label={`Modifier ${d.name}`} onClick={() => setDevModal(d)}>
                        <FiEdit2 size={14} />
                      </Box>
                    </Tip>
                  </HStack>
                </HStack>
              </Card>
            ))}
            {devices.length === 0 && (
              <Card p="8">
                <Text fontSize="sm" color="gray.500" textAlign="center">Aucun appareil enregistré.</Text>
              </Card>
            )}
            <HStack px="3" py="2" gap="3" cursor="pointer" borderRadius="lg"
              _hover={{ bg: C.softBlue }} onClick={() => setDevModal('new')}>
              <IconTile icon={FiPlus} />
              <Text fontSize="sm" color={C.primary} fontWeight="500">Nouvel appareil</Text>
            </HStack>
          </VStack>
        </Box>
      </VStack>

      <DeviceModal
        open={!!devModal}
        onClose={() => setDevModal(null)}
        rooms={rooms}
        device={devModal && devModal !== 'new' ? devModal : null}
        onSave={saveDevice} />
    </Box>
  )
}
