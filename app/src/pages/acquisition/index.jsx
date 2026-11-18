// Route /acquisition — flux « source → DentoPic → dossier ».
// Toutes les actions (source, destination, config appareil, FTP, import, session)
// se font en popups sans quitter la route — voir ./modals.jsx.
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, Center, Flex, HStack, Input, Text, VStack } from '@chakra-ui/react'
import {
  FiArrowRight, FiCamera, FiCheck, FiChevronDown, FiChevronRight, FiClock, FiFolder,
  FiFolderPlus, FiMonitor,
} from 'react-icons/fi'
import {
  Card, Tag, PageHeader, PrimaryButton, SearchInput, IconTile, Tip, Dot, ConfirmModal, toast, ago, isTestName,
} from '../../components/ui'
import { C } from '../../theme'
import { useApp } from '../../context/AppContext'
import {
  listCaptureDevices, listDossiers, listActiveSessions,
  createCaptureSession, endCaptureSession, createDossier,
  createCaptureDevice, updateCaptureDevice, importPhotos, countSessionPhotos, countPhotosByDossier,
  listProtocolSteps, listPhotosByDossier, listRooms,
} from '../../api'
import { SOURCE_DEFS, sourceLabel, sourceIcon, devKind, deviceFormToPayload } from './constants'
import { DossierModal, MobileModal, ImportModal, NewAcqModal, DeviceCaptureModal } from './modals'
import { DeviceModal, DevicePickModal, BridgeBanner, LinkState } from './DeviceModal'
import {
  useBridge, withLiveStatus, isBridgeDevice, bridgeQueue, bridgeFile, bridgeAck,
} from '../../bridge'

// Listes d'appareils par type de source (popups « Appareil photo », « FTP », « Dossier surveillé »)
const PICKERS = {
  camera: { title: 'Appareil photo', subtitle: 'Boîtier relié au poste en Wi-Fi, sans Internet',
    empty: 'Aucun boîtier — ajoutez le vôtre ci-dessous.', add: 'Connecter un boîtier', preset: null },
  ftp: { title: 'Transfert FTP', subtitle: 'Le boîtier envoie chaque photo à ce poste',
    empty: 'Aucune liaison FTP — créez-en une ci-dessous, elle restera réutilisable.', add: 'Nouvelle liaison FTP', preset: 'ftp' },
  watch: { title: 'Dossier surveillé', subtitle: 'Auto-import depuis un dossier de ce poste',
    empty: 'Aucun dossier surveillé — ajoutez-en un ci-dessous, il restera réutilisable.', add: 'Nouveau dossier surveillé', preset: 'watch' },
}

// Petit point de statut : vert = configuré, ambre = à configurer
function StatusDot({ ok }) {
  return <Dot ok={ok} warn={!ok} />
}


export default function Acquisition() {
  const { workspace, session } = useApp()
  const { id: routeDossierId } = useParams() // /acquisition/capture/<dossierId>
  const navigate = useNavigate()
  const wsId = workspace?.id
  const [d, setD] = useState({ devices: [], dossiers: [], active: [], rooms: [] })
  const [loaded, setLoaded] = useState(false)
  // DentoPic Bridge (programme local) : liaisons FTP / Wi-Fi / dossier + état réel des appareils
  const bridge = useBridge(loaded ? d.devices : null)
  const devices = withLiveStatus(d.devices, bridge)
  const [devEdit, setDevEdit] = useState(null) // { device?, preset?, back } — fiche appareil ouverte
  const [waiting, setWaiting] = useState([])   // photos reçues par le Bridge hors session en cours
  const [dropWaiting, setDropWaiting] = useState(false)
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
  // Dropdown DÉPART : liste des sources en ligne sous la carte
  const [departOpen, setDepartOpen] = useState(false)
  // Protocole optionnel : repliable, choix mémorisé
  const [protoOpen, setProtoOpen] = useState(() => localStorage.getItem('dentopic.acq.proto') === '1')
  const [destQ, setDestQ] = useState('')
  const [destNew, setDestNew] = useState('')
  const [photoCounts, setPhotoCounts] = useState({})

  const reload = async () => {
    if (!wsId) return
    const [devices, dossiers, active, rooms, counts] = await Promise.all([
      listCaptureDevices(wsId),
      listDossiers(wsId, { limit: 200 }),
      listActiveSessions(wsId),
      listRooms(wsId),
      countPhotosByDossier(wsId),
    ])
    setD({ devices, dossiers, active, rooms })
    setLoaded(true)
    setPhotoCounts(counts)
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
    const firstOfType = devices.find((x) => devKind(x) === def.key)
    setSource({
      key: def.key,
      deviceId: def.deviceId || firstOfType?.id || null,
      label: def.label || firstOfType?.name,
    })
    if (def.modal) setModal(def.modal)
    else setModal(null)
  }

  // Fiche appareil (création / réglage de la liaison) — même formulaire que Réglages › Appareils
  const editDevice = (device, preset, back) => { setDevEdit({ device, preset, back }); setModal('devedit') }
  const saveDevice = async (form, prev) => {
    const payload = deviceFormToPayload(form, prev)
    const dev = prev
      ? await updateCaptureDevice(prev.id, payload)
      : await createCaptureDevice(wsId, { ...payload, roomId: payload.room_id, connectionType: payload.connection_type })
    if (!dev) return
    setSource({ key: devKind(dev), deviceId: dev.id, label: dev.name })
    setModal(null)
    await reload()
  }

  // ---- Réception réseau : photos en attente dans le Bridge -> session active ----
  const importing = useRef(false)
  const failed = useRef(new Set())
  const stepRef = useRef(null)
  stepRef.current = activeStep
  // Une photo n'entre dans la session que si elle a été reçue APRÈS son ouverture
  // (et par son appareil, s'il est défini) : jamais dans le dossier du patient suivant.
  const forSession = (it) => active
    && Date.parse(it.at) >= Date.parse(active.started_at)
    && (!active.device_id || !bridge.live[active.device_id] || it.sourceId === active.device_id)
  const pump = async () => {
    if (importing.current) return
    importing.current = true
    try {
      const items = await bridgeQueue()
      let n = 0
      for (const it of items.filter(forSession)) {
        if (failed.current.has(it.id)) continue
        const out = await importPhotos(wsId, [await bridgeFile(it)], active.dossier_id || null, active.id, stepRef.current)
        if (out.length) { await bridgeAck(it.id); n++ }
        else { failed.current.add(it.id); toast.error(`Import impossible : ${it.name}`) }
      }
      setWaiting(items.filter((it) => !forSession(it) || failed.current.has(it.id)))
      if (n) { setActiveStep(null); reload() }
    } catch { /* Bridge momentanément injoignable : nouvel essai au prochain relevé */ } finally {
      importing.current = false
    }
  }
  // un seul onglet importe à la fois (sinon doublons)
  const pumpOnce = () => (navigator.locks
    ? navigator.locks.request('dentopic-bridge-import', { ifAvailable: true }, (lock) => lock && pump())
    : pump())
  useEffect(() => {
    if (bridge.up && wsId && (bridge.status.queue || waiting.length)) pumpOnce()
  }, [bridge.status, active?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const importWaiting = async () => {
    for (const it of waiting) {
      const out = await importPhotos(wsId, [await bridgeFile(it)], null, null, null).catch(() => [])
      if (out.length) { failed.current.delete(it.id); await bridgeAck(it.id) }
    }
    toast.success('Photos importées dans « Non triées ».')
    await pump(); reload()
  }
  const discardWaiting = async () => {
    for (const it of waiting) await bridgeAck(it.id).catch(() => {})
    setDropWaiting(false)
    await pump()
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

  const srcDev = devices.find((x) => x.id === source?.deviceId)

  const steps = [
    { done: !!target, label: 'Dossier de destination', desc: 'la destination des photos' },
    { done: !!source, label: 'Source choisie', desc: 'mobile, boîtier, FTP, dossier…' },
    { done: !!active, label: 'Session lancée', desc: 'les photos arrivent et se rangent' },
  ]
  const allDone = steps.every((s) => s.done)

  return (
    <Box w="100%" px={{ base: '4', md: '6' }} py={{ base: '4', md: '6' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setModal('import') }}
    >
      <PageHeader icon={FiCamera} title="Acquisition" subtitle="Créez un dossier patient et importez vos photos et vidéos.">
        <Tip label="Destination + source, puis session live">
          <PrimaryButton icon={FiCamera} onClick={() => setModal('new')}>Nouvelle acquisition</PrimaryButton>
        </Tip>
      </PageHeader>

      {/* ---- Flux : DÉPART → DentoPic → ARRIVÉE (une carte épurée) ---- */}
      <Card px="5" py="4" my="5">
        <Flex gap={{ base: '3', md: '5' }} align="stretch" direction={{ base: 'column', md: 'row' }}>
          <Box flex="1" minW="0">
            <Box cursor="pointer" w="100%" onClick={() => { setDepartOpen((v) => !v); setDestOpen(false) }}>
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
                <Box as={departOpen ? FiChevronDown : FiChevronRight} color="gray.300" />
              </HStack>
            </Box>
          </Box>

          <Center flexDirection={{ base: 'row', md: 'column' }} gap="1" flexShrink={0} alignSelf="center" pt={{ base: '0', md: '3' }}>
            <HStack bg={C.softBlue} borderRadius="full" px="3" py="1" gap="1.5">
              <Box w="9px" h="9px" borderRadius="full" bg={C.primary} />
              <Text fontSize="2xs" color={C.primary} fontWeight="700">DentoPic</Text>
            </HStack>
            <Box as={FiArrowRight} color={C.primary} fontSize="sm"
              transform={{ base: 'rotate(90deg)', md: 'rotate(0deg)' }} />
          </Center>

          <Box flex="1" minW="0">
            <Box cursor="pointer" w="100%" onClick={() => { setDestOpen((v) => !v); setDepartOpen(false) }}>
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
        </Flex>

        {/* ---- Dropdown : toutes les sources ---- */}
        {departOpen && (
          <Box mt="4" pt="4" borderTop="1px solid" borderColor={C.cardBorder}>
            <VStack align="stretch" gap="1.5" maxH="300px" overflowY="auto">
              {SOURCE_DEFS.map((def) => (
                <HStack key={def.key} px="3" py="2" borderRadius="lg" gap="3" cursor="pointer"
                  bg={source?.key === def.key && !source?.deviceId ? C.softBlue : 'transparent'}
                  _hover={{ bg: C.softBlue }}
                  onClick={() => { pickSource(def); setDepartOpen(false) }}>
                  <IconTile icon={def.icon} />
                  <Box flex="1" minW="0">
                    <Text fontSize="sm" color={C.ink}>{def.label}</Text>
                    <Text fontSize="xs" color="gray.500" isTruncated>{def.hint}</Text>
                  </Box>
                  {source?.key === def.key && !source?.deviceId && <Tag color="green">Source</Tag>}
                  {source?.key === def.key && !source?.deviceId && <Box as={FiCheck} color={C.primary} />}
                </HStack>
              ))}
              {devices.length > 0 && (
                <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" pt="2">
                  AUTRE APPAREIL
                </Text>
              )}
              {devices.map((dev) => (
                <HStack key={dev.id} px="3" py="2" borderRadius="lg" gap="3" cursor="pointer"
                  bg={source?.deviceId === dev.id ? C.softBlue : 'transparent'}
                  _hover={{ bg: C.softBlue }}
                  onClick={() => { pickSource({ key: devKind(dev), modal: null, deviceId: dev.id, label: dev.name }); setDepartOpen(false) }}>
                  <IconTile icon={FiMonitor} />
                  <Box flex="1" minW="0">
                    <Text fontSize="sm" color={C.ink} isTruncated>{dev.name}</Text>
                    <Text fontSize="xs" color="gray.500" isTruncated>
                      {[dev.manufacturer, dev.model].filter(Boolean).join(' · ') || 'Appareil'}
                    </Text>
                  </Box>
                  <HStack gap="1.5" flexShrink={0}>
                    <Dot ok={dev.status === 'online'} size="7px" />
                    <Text fontSize="2xs" color={dev.status === 'online' ? C.greenText : 'gray.500'}>
                      {dev.status === 'online' ? 'En ligne' : 'Hors ligne'}
                    </Text>
                  </HStack>
                  {source?.deviceId === dev.id && <Tag color="green">Source</Tag>}
                  {source?.deviceId === dev.id && <Box as={FiCheck} color={C.primary} />}
                </HStack>
              ))}
              <HStack px="3" py="2" borderRadius="lg" gap="3" cursor="pointer"
                bg={source?.key === 'direct' ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
                onClick={() => { pickSource({ key: 'direct', modal: null }); setDepartOpen(false) }}>
                <IconTile icon={FiCamera} />
                <Text fontSize="sm" color={C.ink} flex="1">Session directe (sans appareil)</Text>
                {source?.key === 'direct' && <Tag color="green">Source</Tag>}
                {source?.key === 'direct' && <Box as={FiCheck} color={C.primary} />}
              </HStack>
            </VStack>
            <HStack px="3" py="2" mt="1" borderRadius="lg" cursor="pointer" _hover={{ bg: C.softBlue }}
              onClick={() => { setDepartOpen(false); editDevice(null, null, null) }}>
              <IconTile icon={FiFolderPlus} />
              <Text fontSize="sm" color={C.primary} fontWeight="500">Connecter un nouvel appareil</Text>
            </HStack>
          </Box>
        )}

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
                    <Text fontSize="xs" color="gray.400" whiteSpace="nowrap">
                      {photoCounts[ds.id] || 0} photo{(photoCounts[ds.id] || 0) > 1 ? 's' : ''}
                    </Text>
                    {ds.patient_dossier_number && <Text fontSize="xs" color="gray.400">n° {ds.patient_dossier_number}</Text>}
                    {target?.id === ds.id && <Tag color="green">Destination</Tag>}
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

      {/* ---- Liaison réseau de l'appareil source (état réel vu par le Bridge) ---- */}
      {srcDev && isBridgeDevice(srcDev) && (
        <Card px="4" py="3" mb="4">
          <HStack gap="3" align="start">
            <Box flex="1" minW="0">
              {bridge.up ? <LinkState bridge={bridge} deviceId={srcDev.id} /> : <BridgeBanner bridge={bridge} />}
            </Box>
            <Button variant="outline" size="xs" borderRadius="md" onClick={() => editDevice(srcDev, null, null)}>
              Régler la liaison
            </Button>
          </HStack>
        </Card>
      )}

      {/* ---- Photos reçues par le Bridge hors session : jamais rangées d'office ---- */}
      {waiting.length > 0 && (
        <Card px="4" py="3" mb="4" borderColor={C.amberBorder} bg={C.amberBg}>
          <HStack gap="3" flexWrap="wrap">
            <Box flex="1" minW="200px">
              <Text fontSize="sm" fontWeight="600" color={C.amberText}>
                {waiting.length} photo(s) reçue(s) hors session
              </Text>
              <Text fontSize="xs" color={C.amberText}>
                {active
                  ? 'Arrivées avant l’ouverture de la session ou depuis un autre appareil : elles ne sont pas rangées dans le dossier du patient en cours.'
                  : 'Aucune session ouverte : démarrez la session avant de photographier pour un rangement automatique dans le dossier du patient.'}
              </Text>
            </Box>
            <Button variant="outline" size="xs" borderRadius="md" onClick={importWaiting}>Importer dans « Non triées »</Button>
            <Button variant="outline" size="xs" borderRadius="md" onClick={() => setDropWaiting(true)}>Supprimer</Button>
          </HStack>
        </Card>
      )}

      {/* ---- Session active ---- */}
      {active && (
        <Card px="4" py="3" mb="4" borderColor={C.greenBorder} bg={C.greenBg}>
          <HStack gap="3" flexWrap="wrap">
            <HStack gap="2" flex="1" minW={{ base: '100%', sm: '0' }} w={{ base: '100%', sm: 'auto' }}>
              <Dot ok />
              <Box minW="0">
              <Text fontSize="sm" color={C.greenText} fontWeight="600">Rangement automatique actif</Text>
              <Text fontSize="xs" color="gray.500" isTruncated>
                {source ? source.label || sourceLabel(source.key) : 'Source non configurée'} →{' '}
                {d.dossiers.find((x) => x.id === active.dossier_id)?.name || 'Non triées'} —{' '}
                {received} photo(s) reçue(s)
              </Text>
              </Box>
            </HStack>
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

      {/* ---- Protocole de prise de vues (optionnel, repliable) ---- */}
      {protoSteps.length > 0 && (active || target) && (
        <Card px="5" py="4" mb="4">
          <HStack justify="space-between" mb={protoOpen ? '3' : '0'} as="button" w="100%" cursor="pointer"
            aria-expanded={protoOpen} onClick={() => {
              const v = !protoOpen
              setProtoOpen(v)
              localStorage.setItem('dentopic.acq.proto', v ? '1' : '0')
            }}>
            <HStack gap="2">
              <Text fontSize="sm" fontWeight="600" color={C.ink}>Protocole de prise de vues</Text>
              <Tag color="gray">{protoSteps.length} vues attendues</Tag>
              {activeStep && (
                <Text fontSize="xs" color={C.primary} cursor="pointer"
                  onClick={(e) => { e.stopPropagation(); setActiveStep(null) }}>
                  Étape : {protoSteps.find((s) => s.id === activeStep)?.name} — désactiver
                </Text>
              )}
            </HStack>
            <Box as={protoOpen ? FiChevronDown : FiChevronRight} color="gray.400" />
          </HStack>
          {protoOpen && (
          <>
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
                      bg={done ? C.ok : isActive ? C.primary : 'gray.300'} />
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
          </>
          )}
        </Card>
      )}

      {/* ---- Checklist première acquisition ---- */}
      {!checklistHidden && !allDone && (
        <Card px="5" py="4" mb="4">
          <HStack justify="space-between" mb="3">
            <Text fontSize="sm" fontWeight="600" color={C.ink}>Votre première acquisition</Text>
            <Text fontSize="xs" color={C.primary} cursor="pointer" onClick={hideChecklist}>Masquer ce guide</Text>
          </HStack>
          <Flex gap="3" align="stretch" direction={{ base: 'column', sm: 'row' }}>
            {steps.map((s, i) => (
              <HStack key={i} flex="1" p="3" borderRadius="lg"
                bg={s.done ? C.greenBg : 'gray.50'} border="1px solid"
                borderColor={s.done ? C.greenBorder : C.cardBorder}>
                <Center w="22px" h="22px" borderRadius="full" flexShrink={0}
                  bg={s.done ? C.ok : C.softBlue} color={s.done ? C.onPrimary : C.primary}
                  fontSize="2xs" fontWeight="700">
                  {s.done ? <FiCheck /> : i + 1}
                </Center>
                <Box minW="0">
                  <Text fontSize="xs" fontWeight="600" color={C.ink}>{s.label}</Text>
                  <Text fontSize="2xs" color="gray.500">{s.desc}</Text>
                </Box>
              </HStack>
            ))}
          </Flex>
        </Card>
      )}

      {/* ---- Modals : tout se configure en popup ---- */}
      {/* Le choix de source se fait dans le dropdown DÉPART (plus de modal) */}
      <DossierModal open={modal === 'dossier'} onClose={() => setModal(dossierBack)} dossiers={d.dossiers} target={target}
        onPick={(ds) => { setTarget(ds); setModal(dossierBack) }} onCreate={createDest} />
      <MobileModal open={modal === 'mobile'} onClose={close} target={target} onStart={startSession} />
      {Object.entries(PICKERS).map(([k, p]) => (
        <DevicePickModal key={k} open={modal === k} onClose={close}
          title={p.title} subtitle={p.subtitle} emptyText={p.empty} addLabel={p.add}
          devices={devices.filter((x) => devKind(x) === k)} rooms={d.rooms} bridge={bridge}
          selectedId={source?.deviceId}
          onPick={(dev) => { setSource({ key: k, deviceId: dev.id, label: dev.name }); close() }}
          onAdd={() => editDevice(null, p.preset, k)}
          onEdit={(dev) => editDevice(dev, null, k)} />
      ))}
      <DeviceModal open={modal === 'devedit'} onClose={() => setModal(devEdit?.back || null)}
        rooms={d.rooms} devices={d.devices} bridge={bridge}
        device={devEdit?.device || null} preset={devEdit?.preset} onSave={saveDevice} />
      <ConfirmModal open={dropWaiting} onClose={() => setDropWaiting(false)} onConfirm={discardWaiting}
        title="Supprimer ces photos ?" confirmLabel="Oui, supprimer"
        message={`Les ${waiting.length} photo(s) reçue(s) hors session seront effacées du poste sans être importées. Elles restent sur la carte du boîtier.`} />
      <ImportModal open={modal === 'import'} onClose={close} target={target} onImport={doImport} />
      <DeviceCaptureModal open={modal === 'device'} onClose={close} target={target} onCapture={doImport} />
      <NewAcqModal open={modal === 'new'} onClose={close} target={target} source={source} devices={devices}
        rooms={d.rooms}
        onPickDest={() => openDossier('new')} onPickSource={pickSource}
        onPickDevice={(dev) => setSource({ key: 'camera', deviceId: dev.id, label: dev.name })}
        onStart={startSession} />
    </Box>
  )
}
