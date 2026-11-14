// Route /acquisition — flux « source → DentoPic → dossier ».
// Toutes les actions (source, destination, config appareil, FTP, import, session)
// se font en popups sans quitter la route — voir ./modals.jsx.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, Center, HStack, Text, VStack } from '@chakra-ui/react'
import {
  FiArrowRight, FiCamera, FiCheck, FiChevronDown, FiClock, FiFolder,
  FiMonitor, FiSmartphone, FiUpload, FiEdit3, FiSettings, FiPlay,
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
  listProtocolSteps, listPhotosByDossier, listRooms, devicePhotoStats,
} from '../../api'
import { SOURCE_DEFS, sourceLabel, sourceIcon, devKind, CONN_SELECT, LIAISON_DEFS } from './constants'
import {
  SourceModal, DossierModal, MobileModal, CameraModal,
  FtpModal, WatchModal, ImportModal, NewAcqModal, DeviceCaptureModal,
} from './modals'
import PhotoImg from '../../components/PhotoImg'

// Petit point de statut : vert = configuré, ambre = à configurer
function StatusDot({ ok }) {
  return <Box w="8px" h="8px" borderRadius="full" bg={ok ? '#22c55e' : '#f59e0b'} flexShrink={0} />
}

// ---- Infobulles riches DÉPART / ARRIVÉE (comme l'ancien projet) ----------------

const connLabel = (v) => CONN_SELECT.find(([k]) => k === v)?.[1] || v
const liaisonLabel = (v) => LIAISON_DEFS.find((l) => l.key === v)?.label || v

/** Infobulle INTERACTIVE : reste ouverte au survol du contenu (icônes cliquables). */
function HoverTip({ label, tipW = 300, children, ...rest }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const [tip, setTip] = useState(null)
  const show = () => {
    clearTimeout(timer.current)
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = Math.min(Math.max(r.left + r.width / 2, 8 + tipW / 2), window.innerWidth - 8 - tipW / 2)
    const below = r.bottom + 320 <= window.innerHeight || r.top < 320
    setTip({
      style: below
        ? { left: x, top: r.bottom + 8, transform: 'translateX(-50%)' }
        : { left: x, top: r.top - 8, transform: 'translate(-50%,-100%)' },
    })
  }
  const hide = () => { timer.current = setTimeout(() => setTip(null), 160) }
  return (
    <Box ref={ref} position="relative" display="inline-flex" {...rest}
      onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {tip && createPortal(
        <Box position="fixed" {...tip.style} bg="var(--tip-bg)" color="var(--tip-fg)"
          fontSize="2xs" px="3" py="2.5" borderRadius="lg" boxShadow="var(--tip-shadow)"
          border="1px solid" borderColor="var(--tip-border)"
          w={`${tipW}px`} textAlign="left" zIndex="9999"
          onMouseEnter={show} onMouseLeave={hide}>
          {label}
        </Box>,
        document.body,
      )}
    </Box>
  )
}

/** Icône d'action cliquable dans une infobulle. */
function TipAction({ icon, label, onClick }) {
  return (
    <HStack as="button" gap="1.5" px="2" py="1.5" borderRadius="md" cursor="pointer"
      bg="var(--tip-tile)" _hover={{ bg: 'var(--tip-hover)' }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      aria-label={label} title={label} flex="1" justify="center">
      <Box as={icon} fontSize="xs" color="var(--tip-accent)" />
      <Text fontSize="2xs" color="var(--tip-fg)" fontWeight="600">{label}</Text>
    </HStack>
  )
}

/** Rangée de 3-4 miniatures dans une bulle. */
function TipThumbs({ photos }) {
  if (!photos?.length) return null
  return (
    <HStack gap="1.5" pt="0.5">
      {photos.slice(0, 4).map((p) => (
        <Box key={p.id} w="52px" borderRadius="sm" overflow="hidden">
          <PhotoImg storagePath={p.storage_path} ratio="1/1" iconSize="12px" />
        </Box>
      ))}
      {photos.length > 4 && (
        <Text fontSize="2xs" color="var(--tip-muted)" pl="1">+{photos.length - 4}</Text>
      )}
    </HStack>
  )
}

function TipRow({ k, v }) {
  if (!v) return null
  return (
    <HStack justify="space-between" gap="4" fontSize="2xs">
      <Text color="var(--tip-muted)" flexShrink={0}>{k}</Text>
      <Text color="var(--tip-fg)" fontWeight="600" textAlign="right" isTruncated maxW="190px">{v}</Text>
    </HStack>
  )
}

/** Ligne cliquable dans une bulle (choix d'une source / d'un dossier). */
function TipPickRow({ icon, title, sub, right, onClick }) {
  return (
    <HStack gap="2" px="1.5" py="1" mx="-1.5" borderRadius="md" cursor="pointer"
      role="button" aria-label={title}
      _hover={{ bg: 'var(--tip-hover)' }} onClick={(e) => { e.stopPropagation(); onClick?.() }}>
      {icon && (
        <Center w="6" h="6" borderRadius="md" bg="var(--tip-tile)" flexShrink={0}>
          <Box as={icon} color="var(--tip-accent)" fontSize="xs" />
        </Center>
      )}
      <Box flex="1" minW="0">
        <Text fontSize="2xs" color="var(--tip-fg)" fontWeight="600" isTruncated>{title}</Text>
        {sub && <Text fontSize="2xs" color="var(--tip-muted)" isTruncated>{sub}</Text>}
      </Box>
      {right}
    </HStack>
  )
}

function TipCard({ title, icon, badge, children }) {
  return (
    <VStack align="stretch" gap="1.5" py="0.5" minW="220px">
      <HStack gap="2" pb="1" borderBottom="1px solid" borderColor="var(--tip-border)">
        <Box as={icon} color="var(--tip-accent)" fontSize="sm" />
        <Text fontWeight="700" color="var(--tip-fg)" fontSize="xs" flex="1" isTruncated>{title}</Text>
        {badge}
      </HStack>
      {children}
    </VStack>
  )
}

/** Bulle détaillée et interactive de la source DÉPART :
 *  type, appareil, connexion, salle, FTP/dossier + photos reçues
 *  (vignettes) + icônes d'action (changer / configurer / nouvelle acquisition). */
function SourceTip({ source, devices, rooms, stats, received, sessionActive, onChange, onConfigure, onNew, onPick }) {
  // État vide : catalogue complet des sources — chaque ligne choisit directement.
  if (!source) {
    return (
      <TipCard title="Choisir la source" icon={FiUpload}
        badge={<Text fontSize="2xs" color="var(--tip-accent)" flexShrink={0}>Départ</Text>}>
        <Text fontSize="2xs" color="var(--tip-muted)">D'où viennent les photos :</Text>
        {SOURCE_DEFS.map((def) => (
          <TipPickRow key={def.key} icon={def.icon} title={def.label} sub={def.hint}
            right={<Box as={FiArrowRight} color="var(--tip-faint)" fontSize="xs" flexShrink={0} />}
            onClick={() => onPick?.(def)} />
        ))}
        {devices.length > 0 && (
          <>
            <Text fontSize="2xs" color="var(--tip-faint)" pt="1" fontWeight="700" letterSpacing="0.06em">
              APPAREILS CONFIGURÉS ({devices.length})
            </Text>
            {devices.slice(0, 3).map((dev) => (
              <TipPickRow key={dev.id} icon={FiMonitor} title={dev.name}
                sub={connLabel(dev.metadata?.conn || dev.connection_type)}
                right={
                  <HStack gap="1" flexShrink={0}>
                    <Box w="5px" h="5px" borderRadius="full" bg={dev.status === 'online' ? 'var(--tip-ok)' : 'var(--tip-faint)'} />
                  </HStack>
                }
                onClick={() => onPick?.({ key: devKind(dev), deviceId: dev.id, label: dev.name })} />
            ))}
            {devices.length > 3 && <Text fontSize="2xs" color="var(--tip-muted)" pl="1">+{devices.length - 3} autre(s)</Text>}
          </>
        )}
        <HStack gap="1.5" pt="1.5" borderTop="1px solid" borderColor="var(--tip-border)">
          <TipAction icon={FiEdit3} label="Choisir" onClick={onChange} />
          <TipAction icon={FiPlay} label="Capturer" onClick={onNew} />
        </HStack>
      </TipCard>
    )
  }
  const dev = source.deviceId ? devices.find((x) => x.id === source.deviceId) : null
  const room = dev?.room_id ? rooms.find((r) => r.id === dev.room_id) : null
  const m = dev?.metadata || {}
  const online = dev?.status === 'online'
  const photoN = dev ? stats?.count : null
  return (
    <TipCard title={source.label || sourceLabel(source.key)} icon={sourceIcon(source.key)}
      badge={
        <HStack gap="1" flexShrink={0}>
          <Box w="6px" h="6px" borderRadius="full" bg={dev ? (online ? 'var(--tip-ok)' : 'var(--tip-warn)') : 'var(--tip-accent)'} />
          <Text fontSize="2xs" color={dev ? (online ? 'var(--tip-ok)' : 'var(--tip-warn)') : 'var(--tip-accent)'}>
            {dev ? (online ? 'En ligne' : 'Hors ligne') : 'Prêt'}
          </Text>
        </HStack>
      }>
      <TipRow k="Type de source" v={sourceLabel(source.key)} />
      {dev && <TipRow k="Connexion" v={connLabel(m.conn || dev.connection_type)} />}
      {dev?.manufacturer && <TipRow k="Fabricant" v={dev.manufacturer} />}
      {dev?.model && <TipRow k="Modèle" v={dev.model} />}
      {room && <TipRow k="Salle" v={`${room.name}${room.location ? ` — ${room.location}` : ''}`} />}
      {m.ftp?.host && <TipRow k="Hôte FTP" v={`${m.ftp.host}${m.ftp.port ? ':' + m.ftp.port : ''}`} />}
      {m.ftp?.path && <TipRow k="Chemin FTP" v={m.ftp.path} />}
      {m.ftp?.user && <TipRow k="Utilisateur" v={m.ftp.user} />}
      {m.watch?.path && <TipRow k="Dossier surveillé" v={m.watch.path} />}
      {m.watch?.grouping && <TipRow k="Regroupement" v={m.watch.grouping === 'prefix' ? 'Préfixe du nom' : 'Date EXIF'} />}
      {m.liaison && <TipRow k="Liaison (bridge)" v={liaisonLabel(m.liaison)} />}
      {m.interop && <TipRow k="Interopérabilité" v="Activée" />}
      {photoN != null && <TipRow k="Photos reçues" v={`${photoN} au total`} />}
      {sessionActive && <TipRow k="Session" v={`en direct — ${received} reçue(s)`} />}
      {!dev && (
        <Text fontSize="2xs" color="var(--tip-muted)">
          {SOURCE_DEFS.find((s) => s.key === source.key)?.hint || ''}
        </Text>
      )}
      <TipThumbs photos={stats?.latest} />
      <HStack gap="1.5" pt="1.5" borderTop="1px solid" borderColor="var(--tip-border)">
        <TipAction icon={FiEdit3} label="Changer" onClick={onChange} />
        <TipAction icon={FiSettings} label="Configurer" onClick={onConfigure} />
        <TipAction icon={FiPlay} label="Capturer" onClick={onNew} />
      </HStack>
    </TipCard>
  )
}

/** Bulle détaillée et interactive du dossier ARRIVÉE :
 *  patient, n°, spécialités, dates + vignettes des dernières photos
 *  + icônes (ouvrir le dossier / changer / nouvelle acquisition). */
function DestTip({ target, photoCount, photos, dossiers = [], onOpen, onChange, onNew, onPick }) {
  // État vide : dossiers récents — un clic choisit la destination directement.
  if (!target) {
    const recent = [...dossiers]
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 5)
    return (
      <TipCard title="Choisir la destination" icon={FiFolder}
        badge={<Text fontSize="2xs" color="var(--tip-accent)" flexShrink={0}>Arrivée</Text>}>
        <Text fontSize="2xs" color="var(--tip-muted)">
          Les photos seront rangées dans ce dossier :
        </Text>
        {recent.map((ds) => (
          <TipPickRow key={ds.id} icon={FiFolder} title={ds.name}
            sub={ds.updated_at ? `Modifié ${ago(ds.updated_at)}` : undefined}
            right={<Box as={FiArrowRight} color="var(--tip-faint)" fontSize="xs" flexShrink={0} />}
            onClick={() => onPick?.(ds)} />
        ))}
        {dossiers.length > 5 && (
          <Text fontSize="2xs" color="var(--tip-muted)" pl="1">+{dossiers.length - 5} autre(s) dossier(s)</Text>
        )}
        {dossiers.length === 0 && (
          <Text fontSize="2xs" color="var(--tip-muted)">Aucun dossier — créez-en un pour commencer.</Text>
        )}
        <HStack gap="1.5" pt="1.5" borderTop="1px solid" borderColor="var(--tip-border)">
          <TipAction icon={FiFolder} label="Parcourir" onClick={onChange} />
          <TipAction icon={FiPlay} label="Capturer" onClick={onNew} />
        </HStack>
      </TipCard>
    )
  }
  const patient = [target.first_name, target.last_name].filter(Boolean).join(' ')
  const specs = Array.isArray(target.specialties) ? target.specialties.join(', ') : target.specialties
  return (
    <TipCard title={target.name} icon={FiFolder}
      badge={<Text fontSize="2xs" color="var(--tip-accent)" flexShrink={0}>Destination</Text>}>
      {patient && <TipRow k="Patient" v={patient} />}
      {target.patient_dossier_number && <TipRow k="N° dossier" v={target.patient_dossier_number} />}
      {target.birth_date && <TipRow k="Naissance" v={new Date(target.birth_date).toLocaleDateString('fr-FR')} />}
      {specs && <TipRow k="Spécialité(s)" v={specs} />}
      {target.description && <TipRow k="Notes" v={target.description} />}
      {photoCount != null && <TipRow k="Photos" v={`${photoCount} photo(s)`} />}
      {target.created_at && <TipRow k="Créé" v={ago(target.created_at)} />}
      {target.updated_at && <TipRow k="Modifié" v={ago(target.updated_at)} />}
      <TipThumbs photos={photos} />
      <HStack gap="1.5" pt="1.5" borderTop="1px solid" borderColor="var(--tip-border)">
        <TipAction icon={FiFolder} label="Ouvrir" onClick={onOpen} />
        <TipAction icon={FiEdit3} label="Changer" onClick={onChange} />
        <TipAction icon={FiPlay} label="Capturer" onClick={onNew} />
      </HStack>
    </TipCard>
  )
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
  const [q, setQ] = useState('')
  const [dragging, setDragging] = useState(false)
  // Protocole de prise de vues : étapes attendues + étape active pour taguer les photos
  const [protoSteps, setProtoSteps] = useState([])
  const [activeStep, setActiveStep] = useState(null)
  const [stepCounts, setStepCounts] = useState({})
  const [photoCount, setPhotoCount] = useState(null) // nb photos du dossier cible
  const [destPhotos, setDestPhotos] = useState([])   // vignettes du dossier cible (bulle)
  const [srcStats, setSrcStats] = useState(null)     // photos reçues par l'appareil source (bulle)

  const active = d.active[0]

  const close = () => setModal(null)

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
    if (!did) { setStepCounts({}); setPhotoCount(null); setDestPhotos([]); return }
    listPhotosByDossier(did).then((ph) => {
      setPhotoCount(ph.length)
      setDestPhotos(ph.slice(0, 4))
      const c = {}
      ph.forEach((p) => { if (p.protocol_step_id) c[p.protocol_step_id] = (c[p.protocol_step_id] || 0) + 1 })
      setStepCounts(c)
    })
  }, [target?.id, active?.dossier_id, received])

  // Photos déjà reçues par l'appareil source (bulle DÉPART)
  useEffect(() => {
    if (!wsId || !source?.deviceId) { setSrcStats(null); return }
    devicePhotoStats(wsId, source.deviceId).then(setSrcStats)
  }, [wsId, source?.deviceId, received])

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
          metadata: { ...(d.devices.find((x) => x.id === deviceId)?.metadata || {}), kind: 'ftp', ftp },
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
          metadata: { ...(d.devices.find((x) => x.id === deviceId)?.metadata || {}), kind: 'watch', watch },
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
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); setModal('import') }}
    >
      <PageHeader title="Dossiers photo" subtitle="Créez un dossier patient et importez vos photos.">
        <Tip label="QR code — l'app envoie les photos ici">
          <Button variant="outline" size="sm" borderRadius="md" color="gray.600" onClick={() => setModal('mobile')}>
            <FiSmartphone /> Capturer depuis mobile
          </Button>
        </Tip>
        <Tip label="Destination + source, puis session live">
          <PrimaryButton icon={FiCamera} onClick={() => setModal('new')}>Nouvelle acquisition</PrimaryButton>
        </Tip>
      </PageHeader>

      <Card p="3" mb="4">
        <SearchInput placeholder="Rechercher un dossier ou un patient…" w="100%"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>

      {/* ---- Flux : DÉPART → DentoPic → ARRIVÉE (une carte épurée) ---- */}
      <Card px="5" py="4" my="5">
        <HStack gap="5" align="stretch">
          <HoverTip label={
            <SourceTip source={source} devices={d.devices} rooms={d.rooms}
              stats={srcStats} received={received} sessionActive={!!active}
              onChange={() => setModal('source')}
              onConfigure={() => setModal(source ? (SOURCE_DEFS.find((s) => s.key === source.key)?.modal || 'source') : 'source')}
              onNew={() => setModal('new')}
              onPick={pickSource} />
          }
            tipW={300}>
            <Box flex="1" cursor="pointer" onClick={() => setModal('source')}>
              <HStack mb="2" gap="2">
                <StatusDot ok={!!source} />
                <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400">DÉPART</Text>
              </HStack>
              <HStack gap="3" p="3" borderRadius="lg" border="1px solid" borderColor={C.cardBorder}
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
          </HoverTip>

          <Center flexDirection="column" gap="1" flexShrink={0} alignSelf="center">
            <HStack bg={C.softBlue} borderRadius="full" px="3" py="1" gap="1.5">
              <Box w="9px" h="9px" borderRadius="full" bg={C.primary} />
              <Text fontSize="2xs" color={C.primary} fontWeight="700">DentoPic</Text>
            </HStack>
            <Box as={FiArrowRight} color={C.primary} fontSize="sm" />
          </Center>

          <HoverTip label={
            <DestTip target={target} photoCount={photoCount} photos={destPhotos}
              dossiers={d.dossiers}
              onOpen={() => target && navigate(`/dossier-patient/dossier/${target.id}`)}
              onChange={() => setModal('dossier')}
              onNew={() => setModal('new')}
              onPick={(ds) => setTarget(ds)} />
          }
            tipW={300}>
            <Box flex="1" cursor="pointer" onClick={() => setModal('dossier')}>
              <HStack mb="2" gap="2">
                <StatusDot ok={!!target} />
                <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400">ARRIVÉE</Text>
              </HStack>
              <HStack gap="3" p="3" borderRadius="lg" border="1px solid" borderColor={C.cardBorder}
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
                <Box as={FiChevronDown} color="gray.300" />
              </HStack>
            </Box>
          </HoverTip>
        </HStack>
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

      {/* ---- Drop zone rapide ---- */}
      <Center
        border="1.5px dashed" borderRadius="xl" py="6" mb="4" cursor="pointer"
        borderColor={dragging ? C.primary : 'gray.300'} bg={dragging ? C.softBlue : 'transparent'}
        _hover={{ borderColor: C.primary }} onClick={() => setModal('import')}
      >
        <HStack gap="3">
          <IconTile icon={FiUpload} />
          <Box>
            <Text fontSize="sm" fontWeight="600" color={C.ink}>
              Glissez vos photos ici{target ? ` — rangées dans « ${target.name} »` : ''}
            </Text>
            <Text fontSize="xs" color="gray.500">ou cliquez pour ouvrir l'import — JPEG, PNG, WebP</Text>
          </Box>
        </HStack>
      </Center>

      {/* ---- Dossiers ---- */}
      <VStack align="stretch" gap="3">
        {d.dossiers
          .filter((ds) => !q || [ds.name, ds.patient_dossier_number, ds.first_name, ds.last_name]
            .filter(Boolean).join(' ').toLowerCase().includes(q.trim().toLowerCase()))
          .slice(0, 10).map((ds) => (
          <Card key={ds.id} px="4" py="3" _hover={{ borderColor: 'blue.300' }} cursor="pointer"
            onClick={() => setTarget(ds)}>
            <HStack gap="3">
              <Box as={FiFolder} color={C.primary} />
              <Text fontSize="sm" fontWeight="600" color={C.ink}>{ds.name}</Text>
              {isTestName(ds.name) && <Tag color="purple">Test</Tag>}
              {target?.id === ds.id && <Tag color="green"><FiCheck /> Destination</Tag>}
              <Box flex="1" />
              <Box as={FiArrowRight} color="gray.300" />
            </HStack>
          </Card>
        ))}
        {q && !d.dossiers.some((ds) => [ds.name, ds.patient_dossier_number, ds.first_name, ds.last_name]
          .filter(Boolean).join(' ').toLowerCase().includes(q.trim().toLowerCase())) && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py="4">
            Aucun dossier ne correspond à « {q} ».
          </Text>
        )}
      </VStack>

      {/* ---- Modals : tout se configure en popup ---- */}
      <SourceModal open={modal === 'source'} onClose={close} source={source} devices={d.devices} rooms={d.rooms} onPick={pickSource} />
      <DossierModal open={modal === 'dossier'} onClose={close} dossiers={d.dossiers} target={target}
        onPick={(ds) => { setTarget(ds); close() }} onCreate={createDest} />
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
        onPickDest={() => setModal('dossier')} onPickSource={pickSource} onStart={startSession} />
    </Box>
  )
}
