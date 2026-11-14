// Route /acquisition — flux « source → DentoPic → dossier ».
// Toutes les actions (source, destination, config appareil, FTP, import, session)
// se font en popups sans quitter la route — voir ./modals.jsx.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, Center, HStack, Input, Text, VStack } from '@chakra-ui/react'
import {
  FiArrowRight, FiCamera, FiCheck, FiChevronDown, FiChevronRight, FiClock, FiFolder,
  FiFolderPlus, FiMonitor,
} from 'react-icons/fi'
import {
  Card, Tag, PageHeader, PrimaryButton, SearchInput, IconTile, Tip, ago, isTestName,
} from '../../components/ui'
import { C } from '../../theme'
import { useApp } from '../../context/AppContext'
import {
  listCaptureDevices, listDossiers, listActiveSessions,
  createCaptureSession, endCaptureSession, createDossier,
  createCaptureDevice, updateCaptureDevice, importPhotos, countSessionPhotos,
  listProtocolSteps, listPhotosByDossier, listRooms,
} from '../../api'
import { sourceLabel, sourceIcon, devKind } from './constants'
import {
  SourceModal, DossierModal, MobileModal, CameraModal,
  FtpModal, WatchModal, ImportModal, NewAcqModal, DeviceCaptureModal,
} from './modals'

// Petit point de statut : vert = configuré, ambre = à configurer
function StatusDot({ ok }) {
  return <Box w="8px" h="8px" borderRadius="full" bg={ok ? '#22c55e' : '#f59e0b'} flexShrink={0} />
}


export default function Acquisition() {
  const { workspace, session } = useApp()
  const { id: routeDossierId } = useParams() // /acquisition/capture/<dossierId>
  const navigate = useNavigate()
  const wsId = workspace?.id
  const [d, setD] = useState({ devices: [], dossiers: [], active: [], rooms: [] })
  const [received, setReceived] = useState(0)
  const [target, setTarget] = useState(null) // dossier ARRIVÉE
  const [source, setSource] = useState(null) // { key, deviceId?, label? } DÉPART

  // Un seul état pour la modal ouverte — tout reste sur la route
  const [modal, setModal] = useState(null)
  const [checklistHidden, setChecklistHidden] = useState(() => localStorage.getItem('dentopic.acq.checklist') === '1')
  // Protocole de prise de vues : étapes attendues + étape active pour taguer les photos
  const [protoSteps, setProtoSteps] = useState([])
  const [activeStep, setActiveStep] = useState(null)
  const [stepCounts, setStepCounts] = useState({})

  const active = d.active[0]

  const close = () => setModal(null)
  // `dossierBack` : modal à rouvrir après le choix/annulation de destination
  const [dossierBack, setDossierBack] = useState(null)
  const openDossier = (back = null) => { setDossierBack(back); setModal('dossier') }
  // Dropdown ARRIVÉE : liste de tous les dossiers en ligne sous la carte
  const [destOpen, setDestOpen] = useState(false)
  const [destQ, setDestQ] = useState('')
  const [destNew, setDestNew] = useState('')

  const reload = async () => {
    if (!wsId) return
    const [devices, dossiers, active, rooms] = await Promise.all([
      listCaptureDevices(wsId),
      listDossiers(wsId, { limit: 200 }),
      listActiveSessions(wsId),
      listRooms(wsId),
    ])
    setD({ devices, dossiers, active, rooms })
    const cur = active[0]
    if (cur) {
      setReceived(await countSessionPhotos(cur.id))
      if (cur.device_id) {
        const dev = devices.find((x) => x.id === cur.device_id)
        if (dev) setSource({ key: 'camera', deviceId: dev.id, label: dev.name })
      }
      if (cur.dossier_id) {
        const t = dossiers.find((x) => x.id === cur.dossier_id)
        if (t) setTarget(t)
      }
    }
  }
  useEffect(() => { reload() }, [wsId])

  // Référentiel de prise : on prend le protocole le plus complet
  useEffect(() => {
    listProtocolSteps().then((rows) => {
      const byProto = {}
      rows.forEach((s) => { (byProto[s.protocol_id] ||= []).push(s) })
      const best = Object.values(byProto).sort((a, b) => b.length - a.length)[0] || []
      setProtoSteps(best.sort((a, b) => a.position - b.position))
    })
  }, [])

  // Compte des photos déjà taguées par étape dans le dossier cible
  useEffect(() => {
    const did = target?.id || active?.dossier_id
    if (!did) { setStepCounts({}); return }
    listPhotosByDossier(did).then((ph) => {
      const c = {}
      ph.forEach((p) => { if (p.protocol_step_id) c[p.protocol_step_id] = (c[p.protocol_step_id] || 0) + 1 })
      setStepCounts(c)
    })
  }, [target?.id, active?.dossier_id, received])

  // Photos déjà reçues par l'appareil source (bulle DÉPART)

  // « Capturer » depuis une carte dossier : pré-sélectionne la destination + ouvre la modal
  useEffect(() => {
    if (!routeDossierId || !d.dossiers.length || target) return
    const t = d.dossiers.find((x) => x.id === routeDossierId)
    if (t) { setTarget(t); setModal('new') }
  }, [routeDossierId, d.dossiers, target])

  // ---- Actions ----------------------------------------------------------------

  const startSession = async (mobileToken) => {
    // mobileToken : uuid du QR (modal mobile) ; les autres modals passent un event
    const token = typeof mobileToken === 'string' ? mobileToken : undefined
    await createCaptureSession(wsId, session.user.id, target?.id || null, source?.deviceId || null, token)
    close()
    await reload()
  }

  // Clic sur une source : mémorise + ouvre la modal de configuration associée
  const pickSource = (def) => {
    const firstOfType = d.devices.find((x) => devKind(x) === def.key)
    setSource({
      key: def.key,
      deviceId: def.deviceId || firstOfType?.id || null,
      label: def.label || firstOfType?.name,
    })
    if (def.modal) setModal(def.modal)
    else setModal(null)
  }

  // FTP : deviceId=null -> crée une source ; sinon met à jour sa config.
  // Dans les deux cas la source devient l'appareil sélectionné (réutilisable ensuite).
  const saveFtp = async (deviceId, { roomId, ...ftp }) => {
    const dev = deviceId
      ? await updateCaptureDevice(deviceId, {
          name: ftp.name?.trim() || undefined,
          room_id: roomId || null,
          metadata: { ...d.devices.find((x) => x.id === deviceId)?.metadata, kind: 'ftp', ftp },
        })
      : await createCaptureDevice(wsId, {
          name: ftp.name?.trim() || `FTP — ${ftp.host || 'serveur'}`,
          connectionType: 'other', roomId, metadata: { kind: 'ftp', ftp },
        })
    if (dev) setSource({ key: 'ftp', deviceId: dev.id, label: dev.name })
    await reload()
    return dev
  }

  const saveWatch = async (deviceId, { roomId, ...watch }) => {
    const dev = deviceId
      ? await updateCaptureDevice(deviceId, {
          name: watch.name?.trim() || undefined,
          room_id: roomId || null,
          metadata: { ...d.devices.find((x) => x.id === deviceId)?.metadata, kind: 'watch', watch },
        })
      : await createCaptureDevice(wsId, {
          name: watch.name?.trim() || watch.path || 'Dossier surveillé',
          connectionType: 'other', roomId, metadata: { kind: 'watch', watch },
        })
    if (dev) setSource({ key: 'watch', deviceId: dev.id, label: dev.name })
    await reload()
    return dev
  }

  const doImport = async (files) => {
    await importPhotos(wsId, files, target?.id || null, d.active[0]?.id || null, activeStep)
    setActiveStep(null)
    reload()
  }

  const createDest = async (name) => {
    const ds = await createDossier(wsId, name)
    if (ds) { setTarget(ds); setModal(null); reload() }
    return ds
  }

  const createDestRow = async () => {
    const ds = await createDest(destNew.trim())
    if (ds) { setDestNew(''); setDestQ(''); setDestOpen(false) }
  }

  const hideChecklist = () => {
    localStorage.setItem('dentopic.acq.checklist', '1')
    setChecklistHidden(true)
  }

  const steps = [
    { done: !!target, label: 'Dossier de destination', desc: 'la destination des photos' },
    { done: !!source, label: 'Source choisie', desc: 'mobile, boîtier, FTP, dossier…' },
    { done: !!active, label: 'Session lancée', desc: 'les photos arrivent et se rangent' },
  ]
  const allDone = steps.every((s) => s.done)

  return (
    <Box w="100%" px="6" py="6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setModal('import') }}
    >
      <PageHeader icon={FiCamera} title="Acquisition photo" subtitle="Créez un dossier patient et importez vos photos.">
        <Tip label="Destination + source, puis session live">
          <PrimaryButton icon={FiCamera} onClick={() => setModal('new')}>Nouvelle acquisition</PrimaryButton>
        </Tip>
      </PageHeader>

      {/* ---- Flux : DÉPART → DentoPic → ARRIVÉE (une carte épurée) ---- */}
      <Card px="5" py="4" my="5">
        <HStack gap="5" align="stretch">
          <Box flex="1" minW="0">
            <Box cursor="pointer" w="100%" onClick={() => setModal('source')}>
              <HStack mb="2" gap="2">
                <StatusDot ok={!!source} />
                <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400">DÉPART</Text>
              </HStack>
              <HStack gap="3" px="4" py="3.5" h="100%" align="center" borderRadius="lg" border="1px solid" borderColor={C.cardBorder}
                _hover={{ borderColor: 'blue.300', bg: C.softBlue }}>
                <IconTile icon={source ? sourceIcon(source.key) : FiMonitor} />
                <Box flex="1" minW="0">
                  <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>
                    {source ? source.label || sourceLabel(source.key) : 'Choisir la source'}
                  </Text>
                  <Text fontSize="2xs" color="gray.500">
                    {source ? 'Source sélectionnée' : 'Mobile, boîtier, FTP, dossier, import…'}
                  </Text>
                </Box>
                <Box as={FiChevronDown} color="gray.300" />
              </HStack>
            </Box>
          </Box>

          <Center flexDirection="column" gap="1" flexShrink={0} alignSelf="center" pt="3">
            <HStack bg={C.softBlue} borderRadius="full" px="3" py="1" gap="1.5">
              <Box w="9px" h="9px" borderRadius="full" bg={C.primary} />
              <Text fontSize="2xs" color={C.primary} fontWeight="700">DentoPic</Text>
            </HStack>
            <Box as={FiArrowRight} color={C.primary} fontSize="sm" />
          </Center>

          <Box flex="1" minW="0">
            <Box cursor="pointer" w="100%" onClick={() => setDestOpen((v) => !v)}>
              <HStack mb="2" gap="2">
                <StatusDot ok={!!target} />
                <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400">ARRIVÉE</Text>
              </HStack>
              <HStack gap="3" px="4" py="3.5" h="100%" align="center" borderRadius="lg" border="1px solid" borderColor={C.cardBorder}
                _hover={{ borderColor: 'blue.300', bg: C.softBlue }}>
                <IconTile icon={FiFolder} />
                <Box flex="1" minW="0">
                  <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>
                    {target?.name || 'Sélectionner un dossier patient'}
                  </Text>
                  <Text fontSize="2xs" color="gray.500">
                    {target ? 'Destination sélectionnée' : 'Cliquer pour choisir'}
                  </Text>
                </Box>
                <Box as={destOpen ? FiChevronDown : FiChevronRight} color="gray.300" />
              </HStack>
            </Box>
          </Box>
        </HStack>

        {/* ---- Dropdown : toutes les destinations ---- */}
        {destOpen && (
          <Box mt="4" pt="4" borderTop="1px solid" borderColor={C.cardBorder}>
            <SearchInput placeholder="Rechercher un dossier ou un patient…" w="100%"
              value={destQ} onChange={(e) => setDestQ(e.target.value)} />
            <VStack align="stretch" gap="1.5" mt="3" maxH="280px" overflowY="auto">
              {d.dossiers
                .filter((x) => !destQ || x.name.toLowerCase().includes(destQ.toLowerCase()))
                .map((ds) => (
                  <HStack key={ds.id} px="3" py="2" borderRadius="lg" gap="3" cursor="pointer"
                    bg={target?.id === ds.id ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
                    onClick={() => { setTarget(ds); setDestOpen(false) }}>
                    <Box as={FiFolder} color={C.primary} />
                    <Text fontSize="sm" color={C.ink} flex="1" isTruncated>{ds.name}</Text>
                    {isTestName(ds.name) && <Tag color="purple">Test</Tag>}
                    {ds.patient_dossier_number && <Text fontSize="xs" color="gray.400">n° {ds.patient_dossier_number}</Text>}
                    {target?.id === ds.id && <Box as={FiCheck} color={C.primary} />}
                  </HStack>
                ))}
              {d.dossiers.filter((x) => !destQ || x.name.toLowerCase().includes(destQ.toLowerCase())).length === 0 && (
                <Text fontSize="sm" color="gray.500" textAlign="center" py="3">Aucun dossier ne correspond.</Text>
              )}
            </VStack>
            <HStack mt="3" gap="2">
              <Input placeholder="Créer un nouveau dossier…" fontSize="sm" value={destNew}
                onChange={(e) => setDestNew(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createDestRow()} />
              <PrimaryButton icon={FiFolderPlus} onClick={createDestRow} disabled={!destNew.trim()}>Créer</PrimaryButton>
            </HStack>
          </Box>
        )}
      </Card>

      {/* ---- Session active ---- */}
      {active && (
        <Card px="4" py="3" mb="4" borderColor={C.greenBorder} bg={C.greenBg}>
          <HStack gap="3">
            <Box w="8px" h="8px" borderRadius="full" bg="#22c55e" />
            <Box flex="1" minW="0">
              <Text fontSize="sm" color={C.greenText} fontWeight="600">Rangement automatique actif</Text>
              <Text fontSize="xs" color="gray.500" isTruncated>
                {source ? source.label || sourceLabel(source.key) : 'Source non configurée'} →{' '}
                {d.dossiers.find((x) => x.id === active.dossier_id)?.name || 'Non triées'} —{' '}
                {received} photo(s) reçue(s)
              </Text>
            </Box>
            <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
              <FiClock style={{ display: 'inline', marginRight: 4 }} />ouverte {ago(active.started_at)}
            </Text>
            <Tip label="Voir les photos qui arrivent en direct">
              <Button variant="outline" size="xs" borderRadius="md"
                onClick={() => navigate(active.dossier_id ? `/dossier-patient/dossier/${active.dossier_id}` : '/dossier-patient')}>
                <FiCamera /> Suivre la capture
              </Button>
            </Tip>
            <Tip label="Ferme la réception dans ce dossier">
              <Button variant="outline" size="xs" borderRadius="md"
                onClick={async () => { await endCaptureSession(active.id); reload() }}>
                Terminer
              </Button>
            </Tip>
          </HStack>
        </Card>
      )}

      {/* ---- Protocole de prise de vues (référentiel DentoPic) ---- */}
      {protoSteps.length > 0 && (active || target) && (
        <Card px="5" py="4" mb="4">
          <HStack justify="space-between" mb="3">
            <HStack gap="2">
              <Text fontSize="sm" fontWeight="600" color={C.ink}>Protocole de prise de vues</Text>
              <Tag color="gray">{protoSteps.length} vues attendues</Tag>
            </HStack>
            {activeStep && (
              <Text fontSize="xs" color={C.primary} cursor="pointer" onClick={() => setActiveStep(null)}>
                Étape active : {protoSteps.find((s) => s.id === activeStep)?.name} — désactiver
              </Text>
            )}
          </HStack>
          <HStack gap="2" flexWrap="wrap">
            {protoSteps.map((s) => {
              const n = stepCounts[s.id] || 0
              const done = n > 0
              const isActive = activeStep === s.id
              return (
                <Tip key={s.id} label={s.instructions || s.name}>
                  <HStack as="button" px="3" py="1.5" gap="2" borderRadius="md" cursor="pointer"
                    fontSize="xs" border="1.5px solid"
                    bg={isActive ? C.softBlue : done ? C.greenBg : 'white'}
                    borderColor={isActive ? C.primary : done ? C.greenBorder : 'gray.200'}
                    color={done ? C.greenText : C.ink}
                    onClick={() => setActiveStep(isActive ? null : s.id)}>
                    <Box w="6px" h="6px" borderRadius="full"
                      bg={done ? '#22c55e' : isActive ? C.primary : 'gray.300'} />
                    <Text fontWeight={done || isActive ? '600' : '400'}>{s.name}</Text>
                    {s.required && <Text fontSize="2xs" color="gray.400">req.</Text>}
                    {done && <Text fontSize="2xs" color={C.greenText}>×{n}</Text>}
                  </HStack>
                </Tip>
              )
            })}
          </HStack>
          <Text fontSize="2xs" color="gray.400" mt="2">
            Cliquez une étape : les prochaines photos importées y seront rattachées (protocol_step_id).
          </Text>
        </Card>
      )}

      {/* ---- Checklist première acquisition ---- */}
      {!checklistHidden && !allDone && (
        <Card px="5" py="4" mb="4">
          <HStack justify="space-between" mb="3">
            <Text fontSize="sm" fontWeight="600" color={C.ink}>Votre première acquisition</Text>
            <Text fontSize="xs" color={C.primary} cursor="pointer" onClick={hideChecklist}>Masquer ce guide</Text>
          </HStack>
          <HStack gap="3" align="stretch">
            {steps.map((s, i) => (
              <HStack key={i} flex="1" p="3" borderRadius="lg"
                bg={s.done ? C.greenBg : 'gray.50'} border="1px solid"
                borderColor={s.done ? C.greenBorder : C.cardBorder}>
                <Center w="22px" h="22px" borderRadius="full" flexShrink={0}
                  bg={s.done ? '#22c55e' : C.softBlue} color={s.done ? '#ffffff' : C.primary}
                  fontSize="2xs" fontWeight="700">
                  {s.done ? <FiCheck /> : i + 1}
                </Center>
                <Box minW="0">
                  <Text fontSize="xs" fontWeight="600" color={C.ink}>{s.label}</Text>
                  <Text fontSize="2xs" color="gray.500">{s.desc}</Text>
                </Box>
              </HStack>
            ))}
          </HStack>
        </Card>
      )}

      {/* ---- Modals : tout se configure en popup ---- */}
      <SourceModal open={modal === 'source'} onClose={close} source={source} devices={d.devices} rooms={d.rooms} onPick={pickSource} />
      <DossierModal open={modal === 'dossier'} onClose={() => setModal(dossierBack)} dossiers={d.dossiers} target={target}
        onPick={(ds) => { setTarget(ds); setModal(dossierBack) }} onCreate={createDest} />
      <MobileModal open={modal === 'mobile'} onClose={close} target={target} onStart={startSession} />
      <CameraModal open={modal === 'camera'} onClose={close}
        devices={d.devices.filter((x) => devKind(x) === 'camera')}
        rooms={d.rooms}
        selectedId={source?.deviceId}
        onPick={(dev) => { setSource({ key: 'camera', deviceId: dev.id, label: dev.name }); close() }}
        onCreate={async (form) => {
          const dev = await createCaptureDevice(wsId, form)
          if (dev) { setSource({ key: 'camera', deviceId: dev.id, label: dev.name }); reload() }
          return dev
        }} />
      <FtpModal open={modal === 'ftp'} onClose={close}
        devices={d.devices.filter((x) => devKind(x) === 'ftp')}
        rooms={d.rooms}
        selectedId={source?.deviceId}
        onPick={(dev) => { setSource({ key: 'ftp', deviceId: dev.id, label: dev.name }); close() }}
        onSave={saveFtp} />
      <WatchModal open={modal === 'watch'} onClose={close}
        devices={d.devices.filter((x) => devKind(x) === 'watch')}
        rooms={d.rooms}
        selectedId={source?.deviceId}
        onPick={(dev) => { setSource({ key: 'watch', deviceId: dev.id, label: dev.name }); close() }}
        onSave={saveWatch} />
      <ImportModal open={modal === 'import'} onClose={close} target={target} onImport={doImport} />
      <DeviceCaptureModal open={modal === 'device'} onClose={close} target={target} onCapture={doImport} />
      <NewAcqModal open={modal === 'new'} onClose={close} target={target} source={source} devices={d.devices}
        rooms={d.rooms}
        onPickDest={() => openDossier('new')} onPickSource={pickSource}
        onPickDevice={(dev) => setSource({ key: 'camera', deviceId: dev.id, label: dev.name })}
        onStart={startSession} />
    </Box>
  )
}
