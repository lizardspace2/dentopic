// Modals de la route Acquisition — toutes les interactions restent en popup.
// Composants « contrôlés » : la page (index.jsx) détient l'état et passe
// open/onClose + les données ; les modals remontent les actions via props.
import { useEffect, useRef, useState } from 'react'
import { Box, Button, Center, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  FiArrowRight, FiCamera, FiCheck, FiExternalLink, FiFolder, FiFolderPlus,
  FiHardDrive, FiMonitor, FiPlus, FiSmartphone, FiUpload, FiWifi,
} from 'react-icons/fi'
import {
  Card, Tag, Modal, PrimaryButton, SearchInput, IconTile, Field, Select, isTestName,
} from '../../components/ui'
import { C } from '../../theme'
import {
  HELP_STEPS, SOURCE_DEFS, CONNECTION_TYPES, BRAND_PRESETS, devKind,
  DEVICE_SOURCES, LIAISON_DEFS, CONN_SELECT,
} from './constants'

// ---- Petits morceaux partagés ------------------------------------------------

function SourceRow({ def, active, badge, onClick }) {
  const I = def.icon
  return (
    <HStack
      px="3" py="2.5" borderRadius="lg" cursor="pointer" gap="3"
      bg={active ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
      onClick={onClick}
    >
      <IconTile icon={I} />
      <Box flex="1" minW="0">
        <Text fontSize="sm" fontWeight="600" color={C.ink}>{def.label}</Text>
        <Text fontSize="xs" color="gray.500">{def.hint}</Text>
      </Box>
      {badge}
      <Box as={FiArrowRight} color="gray.300" />
    </HStack>
  )
}

function DeviceRow({ dev, rooms = [], selected, onClick }) {
  const online = dev.status === 'online'
  const kind = devKind(dev)
  const room = rooms.find((r) => r.id === dev.room_id)?.name
  const hint = (kind === 'ftp'
    ? `FTP · ${dev.metadata?.ftp?.host || ''}${dev.metadata?.ftp?.path ? ' ' + dev.metadata.ftp.path : ''}`
    : kind === 'watch'
      ? `Surveillé · ${dev.metadata?.watch?.path || ''}`
      : [dev.manufacturer, dev.model].filter(Boolean).join(' · ')
  ) + (room ? ` · ${room}` : '')
  return (
    <HStack px="3" py="2" gap="3" borderRadius="lg" cursor="pointer"
      bg={selected ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }} onClick={onClick}>
      <IconTile icon={FiMonitor} />
      <Box flex="1" minW="0">
        <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{dev.name}</Text>
        <Text fontSize="xs" color="gray.500" isTruncated>{hint}</Text>
      </Box>
      <HStack gap="1.5">
        <Box w="7px" h="7px" borderRadius="full" bg={online ? '#22c55e' : '#cbd5e1'} />
        <Text fontSize="2xs" color={online ? C.greenText : 'gray.500'}>
          {online ? 'En ligne' : 'Hors ligne'}
        </Text>
      </HStack>
    </HStack>
  )
}

// ---- 1. Guide « Comprendre l'acquisition » ------------------------------------

export function GuideModal({ step, onStep, onClose }) {
  const s = step != null ? HELP_STEPS[step] : null
  return (
    <Modal
      open={step != null} onClose={onClose} title="Comprendre l'acquisition" width="430px"
      footer={
        <>
          <Text fontSize="xs" color="gray.500">Étape {(step ?? 0) + 1} / {HELP_STEPS.length}</Text>
          <PrimaryButton onClick={() => (step < HELP_STEPS.length - 1 ? onStep(step + 1) : onClose())}>
            {step < HELP_STEPS.length - 1 ? 'Suivant' : "C'est parti"} <FiArrowRight />
          </PrimaryButton>
        </>
      }
    >
      {s && (
        <>
          <HStack gap="0" mb="5" mt="1">
            {HELP_STEPS.map((_, i) => (
              <Box key={i} flex="1" h="4px" bg={i <= step ? C.primary : 'gray.200'} borderRadius="full" mr={i < HELP_STEPS.length - 1 ? 1 : 0} />
            ))}
          </HStack>
          <IconTile icon={s.icon} size="44px" iconSize="20px" mb="3" />
          <Text fontSize="lg" fontWeight="700" color={C.ink} mb="2">{s.title}</Text>
          <Text fontSize="sm" color={C.body} lineHeight="1.6">{s.desc}</Text>
        </>
      )}
    </Modal>
  )
}

// ---- 2. Source d'acquisition (clic sur DÉPART) --------------------------------

export function SourceModal({ open, onClose, source, devices, rooms = [], onPick }) {
  // Répartition des appareils par type de source — badges « n sources » comme la caméra
  const cams = devices.filter((x) => devKind(x) === 'camera')
  const ftps = devices.filter((x) => devKind(x) === 'ftp')
  const watches = devices.filter((x) => devKind(x) === 'watch')
  const counts = { camera: cams.length, ftp: ftps.length, watch: watches.length }
  // clic sur un appareil listé -> retrouve la clé de source selon son type
  const keyFor = devKind
  return (
    <Modal open={open} onClose={onClose}
      title="Source d'acquisition" subtitle="Choisissez d'où viennent les photos" width="460px">
      <VStack align="stretch" gap="2">
        {SOURCE_DEFS.map((def) => (
          <SourceRow
            key={def.key} def={def} active={source?.key === def.key}
            badge={counts[def.key] > 0 ? <Tag color="blue">{counts[def.key]}</Tag> : null}
            onClick={() => onPick(def)}
          />
        ))}
      </VStack>
      <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mt="5" mb="2">
        AUTRE APPAREIL
      </Text>
      <VStack align="stretch" gap="1.5">
        {devices.map((dev) => (
          <DeviceRow key={dev.id} dev={dev} rooms={rooms}
            selected={source?.deviceId === dev.id}
            onClick={() => onPick({ key: keyFor(dev), modal: null, deviceId: dev.id, label: dev.name })} />
        ))}
        <SourceRow
          def={{ icon: FiCamera, label: 'Session directe (sans appareil)', hint: '' }}
          active={source?.key === 'direct'}
          onClick={() => onPick({ key: 'direct', modal: null })} />
        <Link to="/reglage/appareils" style={{ textDecoration: 'none' }}>
          <HStack px="3" py="2" gap="3" cursor="pointer" _hover={{ bg: C.softBlue }} borderRadius="lg">
            <IconTile icon={FiPlus} />
            <Text fontSize="sm" color={C.primary} fontWeight="500">Connecter un nouvel appareil</Text>
          </HStack>
        </Link>
      </VStack>
    </Modal>
  )
}

// ---- 3. Dossier de destination (clic sur ARRIVÉE) ------------------------------

export function DossierModal({ open, onClose, dossiers, target, onPick, onCreate }) {
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const list = dossiers.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()))
  const create = async () => {
    const ds = await onCreate(newName.trim())
    if (ds) { setNewName(''); setQ('') }
  }
  return (
    <Modal open={open} onClose={onClose}
      title="Dossier de destination" subtitle="Les photos seront rangées dans ce dossier" width="480px">
      <SearchInput placeholder="Rechercher un dossier ou un patient…" w="100%"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <Box maxH="320px" overflowY="auto" mt="3">
        <VStack align="stretch" gap="1.5">
          {list.map((ds) => (
            <HStack key={ds.id} px="3" py="2" borderRadius="lg" gap="3" cursor="pointer"
              bg={target?.id === ds.id ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
              onClick={() => onPick(ds)}>
              <Box as={FiFolder} color={C.primary} />
              <Text fontSize="sm" color={C.ink} flex="1" isTruncated>{ds.name}</Text>
              {isTestName(ds.name) && <Tag color="purple">Test</Tag>}
              {ds.patient_dossier_number && <Text fontSize="xs" color="gray.400">n° {ds.patient_dossier_number}</Text>}
              {target?.id === ds.id && <Box as={FiCheck} color={C.primary} />}
            </HStack>
          ))}
          {list.length === 0 && (
            <Text fontSize="sm" color="gray.500" textAlign="center" py="4">Aucun dossier ne correspond.</Text>
          )}
        </VStack>
      </Box>
      <HStack mt="4" gap="2">
        <Input placeholder="Créer un nouveau dossier…" fontSize="sm" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()} />
        <PrimaryButton icon={FiFolderPlus} onClick={create} disabled={!newName.trim()}>Créer</PrimaryButton>
      </HStack>
      <Link to="/dossier-patient" style={{ textDecoration: 'none' }}>
        <HStack mt="3" gap="1" color={C.primary} cursor="pointer">
          <FiExternalLink /> <Text fontSize="xs">Gérer les dossiers</Text>
        </HStack>
      </Link>
    </Modal>
  )
}

// ---- 4. Capture mobile (QR) -----------------------------------------------------

export function MobileModal({ open, onClose, target, onStart }) {
  const [token, setToken] = useState(null)
  const [copied, setCopied] = useState(false)
  // un token frais à chaque ouverture — transmis à la session au démarrage
  useEffect(() => { if (open) setToken(crypto.randomUUID()) }, [open])
  const url = token ? `${window.location.origin}/capture/${token}` : ''
  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  return (
    <Modal open={open} onClose={onClose}
      title="Connexion smartphone / tablette" subtitle="Scanner le QR code avec l'appareil photo" width="400px">
      <Center mb="3">
        <Box p="3" bg="#ffffff" border="2px solid" borderColor={C.cardBorder} borderRadius="lg">
          {token && <QRCodeSVG value={url} size={156} level="M" fgColor="#111827" />}
        </Box>
      </Center>
      <HStack mb="4" gap="2" justify="center">
        <Text fontSize="2xs" color="gray.400" isTruncated maxW="240px">{url}</Text>
        <Box as="button" fontSize="2xs" color={C.primary} fontWeight="600" cursor="pointer" onClick={copy}>
          {copied ? 'Copié ✓' : 'Copier'}
        </Box>
      </HStack>
      <VStack align="stretch" gap="2" mb="4">
        {[
          'Scannez ce QR avec l’appareil photo de votre smartphone.',
          'La page de capture s’ouvre — connectez-vous si besoin.',
          'Chaque cliché arrive directement dans le dossier sélectionné.',
        ].map((t, i) => (
          <HStack key={i} gap="2.5">
            <Center w="18px" h="18px" borderRadius="full" bg={C.softBlue} color={C.primary} fontSize="2xs" fontWeight="700" flexShrink={0}>{i + 1}</Center>
            <Text fontSize="xs" color={C.body}>{t}</Text>
          </HStack>
        ))}
      </VStack>
      {target && (
        <HStack bg={C.greenBg} border="1px solid" borderColor={C.greenBorder} borderRadius="md" px="3" py="2" gap="2">
          <Box as={FiFolder} color={C.greenText} />
          <Text fontSize="xs" color={C.greenText}>Destination : {target.name}</Text>
        </HStack>
      )}
      <Button mt="4" w="100%" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }}
        onClick={() => onStart(token)}>
        Démarrer la session de capture
      </Button>
    </Modal>
  )
}

// ---- 5. Appareil photo : choix + ajout -------------------------------------------

export function CameraModal({ open, onClose, devices, rooms = [], selectedId, onPick, onCreate }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', manufacturer: '', model: '', connectionType: 'wifi', roomId: '' })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const pickBrand = (b) => setForm((f) => ({
    ...f,
    manufacturer: b.manufacturer,
    connectionType: b.connectionType,
    name: f.name || (b.manufacturer ? `${b.manufacturer} — Salle 1` : f.name),
  }))
  const save = async () => {
    const ok = await onCreate({ ...form })
    if (ok) { setAdding(false); setForm({ name: '', manufacturer: '', model: '', connectionType: 'wifi', roomId: '' }) }
  }
  return (
    <Modal open={open} onClose={onClose}
      title="Appareil photo" subtitle="Sélectionnez ou connectez un boîtier" width="460px">
      <VStack align="stretch" gap="1.5" maxH="260px" overflowY="auto">
        {devices.map((dev) => (
          <DeviceRow key={dev.id} dev={dev} rooms={rooms} selected={selectedId === dev.id} onClick={() => onPick(dev)} />
        ))}
        {devices.length === 0 && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py="4">
            Aucun appareil — ajoutez votre premier boîtier ci-dessous.
          </Text>
        )}
      </VStack>

      {!adding ? (
        <HStack mt="4" px="3" py="2" gap="3" cursor="pointer" _hover={{ bg: C.softBlue }}
          borderRadius="lg" onClick={() => setAdding(true)}>
          <IconTile icon={FiPlus} />
          <Text fontSize="sm" color={C.primary} fontWeight="500">Ajouter un appareil</Text>
        </HStack>
      ) : (
        <Card p="4" mt="4">
          <VStack align="stretch" gap="3">
            {/* Marques rapides — comme « Canon / Nikon WiFi » de la concurrence */}
            <Field label="Connexion rapide">
              <HStack gap="1.5" flexWrap="wrap">
                {BRAND_PRESETS.map((b) => (
                  <Box as="button" key={b.label} px="2.5" py="1" fontSize="2xs" borderRadius="full"
                    cursor="pointer" border="1.5px solid"
                    borderColor={form.manufacturer === b.manufacturer && b.manufacturer ? C.primary : 'gray.200'}
                    color={form.manufacturer === b.manufacturer && b.manufacturer ? C.primary : 'gray.600'}
                    fontWeight={form.manufacturer === b.manufacturer && b.manufacturer ? '600' : '400'}
                    onClick={() => pickBrand(b)}>
                    {b.label}
                  </Box>
                ))}
              </HStack>
            </Field>
            <Field label="Nom de l'appareil *">
              <Input fontSize="sm" placeholder="ex. Canon R6 — Salle 1" value={form.name} onChange={set('name')} />
            </Field>
            <SimpleGrid columns={2} gap="3">
              <Field label="Fabricant">
                <Input fontSize="sm" placeholder="Canon, Nikon…" value={form.manufacturer} onChange={set('manufacturer')} />
              </Field>
              <Field label="Modèle">
                <Input fontSize="sm" placeholder="ex. EOS R6" value={form.model} onChange={set('model')} />
              </Field>
            </SimpleGrid>
            <SimpleGrid columns={2} gap="3">
              <Field label="Type de connexion">
                <Select w="100%" value={form.connectionType} onChange={set('connectionType')}>
                  {CONNECTION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Salle">
                <Select w="100%" value={form.roomId} onChange={set('roomId')}>
                  <option value="">Aucune</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            </SimpleGrid>
            <HStack justify="end" gap="2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Annuler</Button>
              <PrimaryButton onClick={save} disabled={!form.name.trim()}>Enregistrer</PrimaryButton>
            </HStack>
          </VStack>
        </Card>
      )}
    </Modal>
  )
}

// ---- 6. FTP : liste des sources enregistrées + formulaire ---------------------------
// Comme la caméra : une source FTP enregistrée reste réutilisable — on la retrouve
// dans la liste (badge dans SourceModal), on clique pour la reprendre, ✎ pour éditer.

export function FtpModal({ open, onClose, devices = [], rooms = [], selectedId, onPick, onSave }) {
  const [editing, setEditing] = useState(null) // device en cours d'édition | 'new' | null
  const [form, setForm] = useState({})
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const startNew = () => { setEditing('new'); setForm({ name: '', host: '', port: '21', path: '', user: '', roomId: '' }) }
  const startEdit = (dev) => { setEditing(dev.id); setForm({ name: dev.name, ...(dev.metadata?.ftp || {}), roomId: dev.room_id || '' }) }
  const save = async () => {
    const ok = await onSave(editing === 'new' ? null : editing, form)
    if (ok) setEditing(null)
  }
  const hint = (d) => d.metadata?.ftp?.host
    ? `${d.metadata.ftp.host}${d.metadata.ftp.port ? ':' + d.metadata.ftp.port : ''}${d.metadata.ftp.path ? ' ' + d.metadata.ftp.path : ''}`
    : 'FTP'
  return (
    <Modal open={open} onClose={onClose}
      title="Source FTP" subtitle="Sources enregistrées — réutilisables à tout moment" width="460px">
      <VStack align="stretch" gap="1.5" maxH="240px" overflowY="auto">
        {devices.map((dev) => (
          <HStack key={dev.id} px="3" py="2" gap="3" borderRadius="lg" cursor="pointer"
            bg={selectedId === dev.id ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
            onClick={() => onPick(dev)}>
            <IconTile icon={FiWifi} />
            <Box flex="1" minW="0">
              <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{dev.name}</Text>
              <Text fontSize="xs" color="gray.500" isTruncated>{hint(dev)}</Text>
            </Box>
            {selectedId === dev.id && <Box as={FiCheck} color={C.primary} />}
            <Box as="button" fontSize="2xs" color={C.primary} cursor="pointer" px="1"
              onClick={(e) => { e.stopPropagation(); startEdit(dev) }}>
              Modifier
            </Box>
          </HStack>
        ))}
        {devices.length === 0 && !editing && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py="4">
            Aucune source FTP — enregistrez-en une ci-dessous, elle restera réutilisable.
          </Text>
        )}
      </VStack>

      {!editing ? (
        <HStack mt="4" px="3" py="2" gap="3" cursor="pointer" _hover={{ bg: C.softBlue }}
          borderRadius="lg" onClick={startNew}>
          <IconTile icon={FiPlus} />
          <Text fontSize="sm" color={C.primary} fontWeight="500">Nouvelle source FTP</Text>
        </HStack>
      ) : (
        <Card p="4" mt="4">
          <VStack align="stretch" gap="3">
            <Field label="Nom de la source *">
              <Input fontSize="sm" placeholder="ex. FTP — Canon Salle 1" value={form.name || ''} onChange={set('name')} />
            </Field>
            <SimpleGrid columns={2} gap="3">
              <Field label="Hôte">
                <Input fontSize="sm" placeholder="192.168.1.20" value={form.host || ''} onChange={set('host')} />
              </Field>
              <Field label="Port">
                <Input fontSize="sm" placeholder="21" value={form.port || ''} onChange={set('port')} />
              </Field>
            </SimpleGrid>
            <Field label="Chemin surveillé">
              <Input fontSize="sm" placeholder="/photos/dentaire" value={form.path || ''} onChange={set('path')} />
            </Field>
            <SimpleGrid columns={2} gap="3">
              <Field label="Utilisateur">
                <Input fontSize="sm" placeholder="dentopic" value={form.user || ''} onChange={set('user')} />
              </Field>
              <Field label="Salle">
                <Select w="100%" value={form.roomId || ''} onChange={set('roomId')}>
                  <option value="">Aucune</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            </SimpleGrid>
            <HStack justify="end" gap="2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Annuler</Button>
              <PrimaryButton onClick={save} disabled={!form.name?.trim()}>
                {editing === 'new' ? 'Enregistrer la source' : 'Mettre à jour'}
              </PrimaryButton>
            </HStack>
          </VStack>
        </Card>
      )}
    </Modal>
  )
}

// ---- 7. Dossier surveillé : liste + formulaire ---------------------------------------

export function WatchModal({ open, onClose, devices = [], rooms = [], selectedId, onPick, onSave }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const startNew = () => { setEditing('new'); setForm({ name: '', path: '', grouping: 'date', exts: '', roomId: '' }) }
  const startEdit = (dev) => { setEditing(dev.id); setForm({ name: dev.name, ...(dev.metadata?.watch || {}), roomId: dev.room_id || '' }) }
  const save = async () => {
    const ok = await onSave(editing === 'new' ? null : editing, form)
    if (ok) setEditing(null)
  }
  return (
    <Modal open={open} onClose={onClose}
      title="Dossier surveillé" subtitle="Auto-import depuis un dossier (Nikon WMU, EOS Utility…)" width="460px">
      <VStack align="stretch" gap="1.5" maxH="240px" overflowY="auto">
        {devices.map((dev) => (
          <HStack key={dev.id} px="3" py="2" gap="3" borderRadius="lg" cursor="pointer"
            bg={selectedId === dev.id ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
            onClick={() => onPick(dev)}>
            <IconTile icon={FiHardDrive} />
            <Box flex="1" minW="0">
              <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{dev.name}</Text>
              <Text fontSize="xs" color="gray.500" isTruncated>{dev.metadata?.watch?.path || 'Dossier surveillé'}</Text>
            </Box>
            {selectedId === dev.id && <Box as={FiCheck} color={C.primary} />}
            <Box as="button" fontSize="2xs" color={C.primary} cursor="pointer" px="1"
              onClick={(e) => { e.stopPropagation(); startEdit(dev) }}>
              Modifier
            </Box>
          </HStack>
        ))}
        {devices.length === 0 && !editing && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py="4">
            Aucun dossier surveillé — enregistrez-en un ci-dessous, il restera réutilisable.
          </Text>
        )}
      </VStack>

      {!editing ? (
        <HStack mt="4" px="3" py="2" gap="3" cursor="pointer" _hover={{ bg: C.softBlue }}
          borderRadius="lg" onClick={startNew}>
          <IconTile icon={FiPlus} />
          <Text fontSize="sm" color={C.primary} fontWeight="500">Nouveau dossier surveillé</Text>
        </HStack>
      ) : (
        <Card p="4" mt="4">
          <VStack align="stretch" gap="3">
            <Field label="Nom de la source *">
              <Input fontSize="sm" placeholder="ex. SD — Nikon WMU" value={form.name || ''} onChange={set('name')} />
            </Field>
            <Field label="Chemin du dossier">
              <Input fontSize="sm" placeholder="C:\Photos\Import ou /Volumes/SD/DCIM" value={form.path || ''} onChange={set('path')} />
            </Field>
            <Field label="Rangement">
              <Select w="100%" value={form.grouping || 'date'} onChange={set('grouping')}>
                <option value="date">Sous-dossiers par date (AAAA-MM-JJ)</option>
                <option value="flat">Tout au même niveau</option>
                <option value="prefix">Sous-dossiers par préfixe de nom</option>
              </Select>
            </Field>
            <SimpleGrid columns={2} gap="3">
              <Field label="Extensions acceptées">
                <Input fontSize="sm" placeholder="jpg, jpeg, png, webp" value={form.exts || ''} onChange={set('exts')} />
              </Field>
              <Field label="Salle">
                <Select w="100%" value={form.roomId || ''} onChange={set('roomId')}>
                  <option value="">Aucune</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            </SimpleGrid>
            <HStack bg={C.softBlue} borderRadius="md" px="3" py="2" gap="2">
              <Box as={FiHardDrive} color={C.primary} />
              <Text fontSize="xs" color={C.body}>
                Toute photo déposée dans ce dossier est importée et rangée automatiquement dans le dossier de destination.
              </Text>
            </HStack>
            <HStack justify="end" gap="2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Annuler</Button>
              <PrimaryButton onClick={save} disabled={!form.name?.trim()}>
                {editing === 'new' ? 'Enregistrer la source' : 'Mettre à jour'}
              </PrimaryButton>
            </HStack>
          </VStack>
        </Card>
      )}
    </Modal>
  )
}

// ---- 7b. « Nouvel appareil » façon concurrent : tuiles source + salle + liaison -------

const STATUS_DEFS = [
  ['offline', 'Hors ligne'],
  ['online', 'En ligne'],
  ['pairing', 'Appairage en cours'],
]

function DeviceTile({ def, active, onClick }) {
  const I = def.icon
  return (
    <Box
      as="button" textAlign="left" px="3" py="2.5" borderRadius="lg" cursor="pointer"
      border="1.5px solid" borderColor={active ? C.primary : 'gray.200'}
      bg={active ? C.softBlue : 'transparent'}
      _hover={{ borderColor: C.primary }}
      title={def.hint}
      onClick={onClick}
    >
      <HStack gap="2">
        <Box as={I} color={active ? C.primary : 'gray.500'} flexShrink={0} />
        <Text fontSize="xs" fontWeight="600" color={active ? C.primary : C.ink} isTruncated>
          {def.label}
        </Text>
      </HStack>
    </Box>
  )
}

export function DeviceModal({ open, onClose, rooms = [], device, onSave }) {
  const empty = {
    src: 'manual', name: '', roomId: '', conn: 'wifi', status: 'offline',
    manufacturer: '', model: '', liaison: '', watchPath: '', ftpHost: '', interop: false,
  }
  const [form, setForm] = useState(empty)
  useEffect(() => {
    if (!open) return
    if (device) {
      const m = device.metadata || {}
      setForm({
        src: m.source || 'manual',
        name: device.name || '',
        roomId: device.room_id || '',
        conn: m.conn || device.connection_type || 'wifi',
        status: device.status || 'offline',
        manufacturer: device.manufacturer || '',
        model: device.model || '',
        liaison: m.liaison || '',
        watchPath: m.watch?.path || '',
        ftpHost: m.ftp?.host || '',
        interop: !!m.interop,
      })
    } else {
      setForm(empty)
    }
  }, [open, device?.id])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value }))
  const pickSrc = (s) => setForm((f) => ({
    ...f,
    src: s.key,
    conn: s.conn || f.conn,
    manufacturer: s.manufacturer !== undefined ? s.manufacturer : f.manufacturer,
    liaison: f.liaison || (s.key === 'watch' ? 'watch' : s.key === 'ftp' ? 'ftp' : s.key === 'sdcard' ? 'sdcard' : f.liaison),
  }))
  const save = async () => { const ok = await onSave(form); if (ok) setForm(empty) }
  const showWatch = form.src === 'watch' || form.liaison === 'watch'
  const showFtp = form.src === 'ftp' || form.liaison === 'ftp'
  return (
    <Modal open={open} onClose={onClose} width="560px"
      title={device ? "Modifier l'appareil" : 'Nouvel appareil'}
      subtitle={device ? undefined : 'Déclarez la source puis rattachez l’appareil à une salle'}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <PrimaryButton onClick={save} disabled={!form.name.trim()}>
            {device ? 'Mettre à jour' : 'Créer'}
          </PrimaryButton>
        </>
      }
    >
      <VStack align="stretch" gap="4">
        <Box>
          <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mb="2">
            SOURCE D'ACQUISITION
          </Text>
          <SimpleGrid columns={3} gap="2">
            {DEVICE_SOURCES.map((s) => (
              <DeviceTile key={s.key} def={s} active={form.src === s.key} onClick={() => pickSrc(s)} />
            ))}
          </SimpleGrid>
          <Text fontSize="2xs" color="gray.400" mt="1.5">
            {DEVICE_SOURCES.find((s) => s.key === form.src)?.hint}
          </Text>
        </Box>

        <SimpleGrid columns={2} gap="3">
          <Field label="Nom *">
            <Input fontSize="sm" placeholder="ex. Nikon Z6 II — Salle 2" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Salle">
            <Select w="100%" value={form.roomId} onChange={set('roomId')}>
              <option value="">Aucune (non rattaché)</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Connexion">
            <Select w="100%" value={form.conn} onChange={set('conn')}>
              {CONN_SELECT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Statut">
            <Select w="100%" value={form.status} onChange={set('status')}>
              {STATUS_DEFS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Fabricant">
            <Input fontSize="sm" placeholder="Nikon, Canon…" value={form.manufacturer} onChange={set('manufacturer')} />
          </Field>
          <Field label="Modèle">
            <Input fontSize="sm" placeholder="ex. Z6 II" value={form.model} onChange={set('model')} />
          </Field>
        </SimpleGrid>

        <Box border="1px solid" borderColor={C.cardBorder} borderRadius="lg" p="4">
          <Text fontSize="xs" fontWeight="700" color={C.ink} mb="1">
            Connexion via DentoPic Bridge <Box as="span" color="red.500">*</Box>
          </Text>
          <Text fontSize="2xs" color="gray.500" mb="3">
            DentoPic Bridge tourne sur le poste de salle — il assure le lien entre cet appareil et l'acquisition (carte SD Wi-Fi, dossier surveillé, Wi-Fi intégré ou passerelle FTP).
          </Text>
          <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mb="2">
            LIAISON D'ACQUISITION
          </Text>
          <SimpleGrid columns={4} gap="2">
            {LIAISON_DEFS.map((l) => (
              <DeviceTile key={l.key} def={l} active={form.liaison === l.key}
                onClick={() => setForm((f) => ({ ...f, liaison: f.liaison === l.key ? '' : l.key }))} />
            ))}
          </SimpleGrid>
          {showWatch && (
            <Field label="Dossier surveillé" mt="3">
              <Input fontSize="sm" placeholder="C:\Photos\Import ou /Volumes/SD/DCIM"
                value={form.watchPath} onChange={set('watchPath')} />
            </Field>
          )}
          {showFtp && (
            <Field label="Hôte FTP" mt="3">
              <Input fontSize="sm" placeholder="192.168.1.20" value={form.ftpHost} onChange={set('ftpHost')} />
            </Field>
          )}
          <HStack as="label" mt="3" gap="2" cursor="pointer">
            <input type="checkbox" checked={form.interop} onChange={set('interop')} />
            <Text fontSize="xs" color={C.body}>
              Interopérabilité (option) — exposer cet appareil à un autre logiciel d'imagerie dentaire
            </Text>
          </HStack>
        </Box>
      </VStack>
    </Modal>
  )
}

// ---- 8. Import de photos : drop zone + liste + destination --------------------------

export function ImportModal({ open, onClose, target, onImport }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(0)
  const input = useRef(null)
  const add = (fl) => setFiles((f) => [...f, ...Array.from(fl || [])])
  const run = async () => {
    setBusy(1)
    await onImport(files)
    setBusy(0); setFiles([]); onClose()
  }
  return (
    <Modal open={open} onClose={onClose}
      title="Importer des photos" subtitle="Fichiers ou dossier complet" width="480px">
      <Center
        border="1.5px dashed" borderColor="gray.300" borderRadius="xl" py="8" mb="4"
        cursor="pointer" _hover={{ borderColor: C.primary, bg: C.softBlue }}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files) }}
      >
        <VStack gap="1.5">
          <IconTile icon={FiUpload} size="40px" iconSize="18px" />
          <Text fontSize="sm" fontWeight="600" color={C.ink}>Glissez vos photos ici</Text>
          <Text fontSize="xs" color="gray.500">ou cliquez pour parcourir — JPEG, PNG, WebP</Text>
        </VStack>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      </Center>

      {files.length > 0 && (
        <Box maxH="160px" overflowY="auto" mb="3">
          <VStack align="stretch" gap="1">
            {files.map((f, i) => (
              <HStack key={i} px="2" py="1" gap="2" fontSize="xs" color={C.body}>
                <Box as={FiUpload} color={C.primary} flexShrink={0} />
                <Text isTruncated flex="1">{f.name}</Text>
                <Text color="gray.400" flexShrink={0}>{(f.size / 1024).toFixed(0)} Ko</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      <HStack bg={target ? C.greenBg : C.amberBg} border="1px solid"
        borderColor={target ? C.greenBorder : C.amberBorder} borderRadius="md" px="3" py="2" gap="2" mb="4">
        <Box as={FiFolder} color={target ? C.greenText : C.amberText} />
        <Text fontSize="xs" color={target ? C.greenText : C.amberText}>
          {target ? `Destination : ${target.name}` : 'Aucune destination — les photos iront dans « Non triées »'}
        </Text>
      </HStack>

      <HStack justify="end" gap="2">
        <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
        <PrimaryButton onClick={run} disabled={!files.length || busy} loading={busy}>
          {busy ? 'Import en cours…' : `Importer ${files.length || ''} photo(s)`}
        </PrimaryButton>
      </HStack>
    </Modal>
  )
}

// ---- 9. Nouvelle acquisition : destination + mode + démarrage ------------------------

export function NewAcqModal({ open, onClose, target, source, devices, onPickDest, onPickSource, onStart }) {
  const modes = SOURCE_DEFS.filter((s) => ['mobile', 'camera', 'import'].includes(s.key))
  return (
    <Modal open={open} onClose={onClose}
      title="Nouvelle acquisition" subtitle="Choisissez le dossier de destination, puis la source des photos." width="560px">
      <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mb="2">DESTINATION</Text>
      <Card px="4" py="3" mb="4" cursor="pointer" _hover={{ borderColor: 'blue.300' }} onClick={onPickDest}>
        <HStack gap="3">
          <IconTile icon={FiFolder} />
          <Text fontSize="sm" fontWeight="600" color={C.ink} flex="1" isTruncated>
            {target?.name || 'Sélectionner un dossier patient'}
          </Text>
          <Box as={FiArrowRight} color="gray.300" />
        </HStack>
      </Card>

      <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mb="2">MODE D'ACQUISITION</Text>
      <SimpleGrid columns={3} gap="3" mb="4">
        {modes.map((m) => (
          <Card key={m.key} p="3" cursor="pointer" textAlign="center"
            borderColor={source?.key === m.key ? C.primary : C.cardBorder}
            bg={source?.key === m.key ? C.softBlue : undefined}
            _hover={{ borderColor: C.primary }}
            onClick={() => onPickSource(m)}>
            <Center w="36px" h="36px" mx="auto" mb="2" borderRadius="lg" bg={C.softBlue} color={C.primary}>
              <Box as={m.icon} />
            </Center>
            <Text fontSize="xs" fontWeight="600" color={C.ink}>{m.label}</Text>
            <Text fontSize="2xs" color="gray.500" mt="0.5">{m.hint}</Text>
          </Card>
        ))}
      </SimpleGrid>

      {devices.map((dev) => (
        <DeviceRow key={dev.id} dev={dev} selected={source?.deviceId === dev.id}
          onClick={() => onPickSource({ key: 'camera', deviceId: dev.id })} />
      ))}
      <Link to="/reglage/appareils" style={{ textDecoration: 'none' }}>
        <HStack mt="2" gap="2" color={C.primary} cursor="pointer">
          <FiPlus />
          <Box>
            <Text fontSize="xs" fontWeight="600">Connecter un appareil</Text>
            <Text fontSize="2xs" color="gray.500">Canon, Nikon, FTP, dossier surveillé — dans Réglages → Appareils</Text>
          </Box>
        </HStack>
      </Link>

      <Button mt="5" w="100%" bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }} onClick={onStart}>
        Démarrer la session
      </Button>
    </Modal>
  )
}

// ---- Exports utilitaires -------------------------------------------------------------

export { FiSmartphone, FiCamera, FiWifi, FiMonitor }
