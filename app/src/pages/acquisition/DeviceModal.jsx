// Fiche « appareil » partagée par Acquisition et Réglages › Appareils :
// marque, méthode de liaison au poste (FTP, PTP/IP, CCAPI, carte SD Wi-Fi,
// dossier surveillé) et état réel de la liaison remonté par le DentoPic Bridge.
import { useEffect, useState } from 'react'
import { Box, Button, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { FiCheck, FiCopy, FiMonitor, FiPlus, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { Modal, PrimaryButton, Field, Select, Dot, IconTile, Tag, toast } from '../../components/ui'
import { C } from '../../theme'
import { BRIDGE_START_CMD, bridgeProbe, deviceLink } from '../../bridge'
import { CAMERA_BRANDS, LINK_METHODS, brandOf, defaultLink } from './constants'

const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success('Copié.'))

const STATE_LABEL = { listening: 'Prêt à recevoir', connected: 'Connecté', connecting: 'Connexion…', error: 'Erreur' }

/** Voyant + détail de l'état d'une liaison vu par le Bridge */
export function LinkState({ bridge, deviceId }) {
  const s = bridge.live[deviceId]
  if (!bridge.up || !s) return null
  const ok = s.state === 'listening' || s.state === 'connected'
  return (
    <HStack gap="2" align="start">
      <Dot ok={ok} warn={!ok} mt="1" />
      <Text fontSize="xs" color={C.body}>
        <Box as="span" fontWeight="600">{STATE_LABEL[s.state] || s.state}</Box>
        {s.detail ? ` — ${s.detail}` : ''}
        {s.received ? ` · ${s.received} photo(s) reçue(s)` : ''}
      </Text>
    </HStack>
  )
}

/** Bandeau d'état du Bridge (+ marche à suivre s'il n'est pas lancé) */
export function BridgeBanner({ bridge, ...rest }) {
  if (bridge.status === null) return null
  if (bridge.up) {
    const ips = bridge.status.addresses.map((a) => `${a.address} (${a.name})`).join(' · ')
    return (
      <HStack bg={C.greenBg} border="1px solid" borderColor={C.greenBorder} borderRadius="md" px="3" py="2" gap="2" align="start" {...rest}>
        <Box as={FiCheck} color={C.greenText} mt="0.5" flexShrink={0} />
        <Text fontSize="xs" color={C.greenText}>
          DentoPic Bridge actif sur ce poste{ips ? ` — adresse sur le réseau : ${ips}` : ' — aucun réseau détecté'}
        </Text>
      </HStack>
    )
  }
  const cmd = BRIDGE_START_CMD()
  return (
    <Box bg={C.amberBg} border="1px solid" borderColor={C.amberBorder} borderRadius="md" px="3" py="2.5" {...rest}>
      <Text fontSize="xs" fontWeight="600" color={C.amberText}>
        {bridge.error === 'origin' ? 'Le DentoPic Bridge n’autorise pas encore ce site' : 'DentoPic Bridge non détecté sur ce poste'}
      </Text>
      <Text fontSize="xs" color={C.amberText} mt="1">
        {bridge.error === 'origin'
          ? 'Relancez-le avec la commande ci-dessous.'
          : 'Ce programme reçoit les photos des boîtiers sur le réseau local, sans Internet. Lancez-le sur le poste de la salle, depuis le dossier du projet :'}
      </Text>
      <HStack mt="2" gap="2">
        <Box as="code" flex="1" minW="0" fontSize="2xs" px="2" py="1.5" borderRadius="sm" bg="white" color={C.ink}
          overflowX="auto" whiteSpace="nowrap">{cmd}</Box>
        <Button variant="outline" size="xs" onClick={() => copy(cmd)}><FiCopy /> Copier</Button>
        <Button variant="outline" size="xs" onClick={bridge.refresh}><FiRefreshCw /> Réessayer</Button>
      </HStack>
    </Box>
  )
}

function Tile({ def, active, badge, onClick }) {
  const I = def.icon
  return (
    <Box as="button" type="button" textAlign="left" px="3" py="2.5" borderRadius="lg" cursor="pointer"
      border="1.5px solid" borderColor={active ? C.primary : 'gray.200'}
      bg={active ? C.softBlue : 'transparent'} _hover={{ borderColor: C.primary }} onClick={onClick}>
      <HStack gap="2">
        <Box as={I} color={active ? C.primary : 'gray.500'} flexShrink={0} />
        <Text fontSize="xs" fontWeight="600" color={active ? C.primary : C.ink} flex="1" minW="0">{def.label}</Text>
        {badge}
      </HStack>
    </Box>
  )
}

// Ligne « à saisir sur le boîtier » : libellé + valeur copiable
function CameraValue({ label, value }) {
  return (
    <HStack gap="2" py="1">
      <Text fontSize="xs" color="gray.500" w="110px" flexShrink={0}>{label}</Text>
      <Text fontSize="xs" fontWeight="600" color={C.ink} flex="1" minW="0" wordBreak="break-all">{value}</Text>
      <Box as="button" type="button" color="gray.400" cursor="pointer" _hover={{ color: C.primary }}
        aria-label={`Copier ${label}`} onClick={() => copy(value)}><FiCopy size={12} /></Box>
    </HStack>
  )
}

/** Choix de la marque et de la méthode + réglages de la liaison */
export function LinkSetup({ form, setForm, bridge, devices = [], deviceId }) {
  const brand = CAMERA_BRANDS.find((b) => b.key === form.brand) || CAMERA_BRANDS.at(-1)
  const link = form.link
  const method = LINK_METHODS[link.method] || LINK_METHODS.none
  const setLink = (k) => (e) => setForm((f) => ({ ...f, link: { ...f.link, [k]: e.target.value } }))
  const [probe, setProbe] = useState(null) // null | 'busy' | résultat | { error }
  useEffect(() => { setProbe(null) }, [link.method, link.host])

  const pickBrand = (b) => setForm((f) => {
    const keep = b.methods.includes(f.link.method)
    return {
      ...f, brand: b.key,
      manufacturer: b.key === 'other' ? (CAMERA_BRANDS.some((x) => x.label === f.manufacturer) ? '' : f.manufacturer) : b.label,
      link: keep ? f.link : defaultLink(b.methods[0], devices.filter((d) => d.id !== deviceId)),
    }
  })
  const pickMethod = (m) => setForm((f) => (f.link.method === m ? f
    : { ...f, link: defaultLink(m, devices.filter((d) => d.id !== deviceId)) }))

  const runProbe = async () => {
    setProbe('busy')
    try { setProbe(await bridgeProbe(link.host.trim())) } catch (e) { setProbe({ error: e.message }) }
  }
  const probeText = () => {
    if (probe.error) return probe.error
    const found = [probe.ptpip && 'Wi-Fi PTP/IP', probe.ccapi && 'Canon CCAPI', probe.sdcard && 'Carte SD Wi-Fi'].filter(Boolean)
    return found.length ? `Répond en : ${found.join(', ')}` : 'Aucune réponse à cette adresse — vérifiez que le boîtier est allumé, sur le même réseau, et en mode connexion.'
  }
  const ips = bridge.up ? bridge.status.addresses : []
  const needsHost = ['ptpip', 'ccapi', 'sdcard'].includes(link.method)

  return (
    <VStack align="stretch" gap="3">
      <Box>
        <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mb="2">MARQUE</Text>
        <HStack gap="1.5" flexWrap="wrap">
          {CAMERA_BRANDS.map((b) => (
            <Box as="button" type="button" key={b.key} px="2.5" py="1" fontSize="xs" borderRadius="full" cursor="pointer"
              border="1.5px solid" borderColor={brand.key === b.key ? C.primary : 'gray.200'}
              color={brand.key === b.key ? C.primary : C.body} fontWeight={brand.key === b.key ? '600' : '400'}
              bg={brand.key === b.key ? C.softBlue : 'transparent'} onClick={() => pickBrand(b)}>
              {b.label}
            </Box>
          ))}
        </HStack>
      </Box>

      <Box>
        <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mb="2">LIAISON AVEC LE POSTE</Text>
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="2">
          {brand.methods.map((m, i) => (
            <Tile key={m} def={LINK_METHODS[m]} active={link.method === m}
              badge={i === 0 ? <Tag color="green">Conseillé</Tag> : null} onClick={() => pickMethod(m)} />
          ))}
        </SimpleGrid>
        <Text fontSize="xs" color="gray.500" mt="2">{method.hint}</Text>
      </Box>

      {link.method !== 'none' && <BridgeBanner bridge={bridge} />}

      {brand.steps[link.method] && (
        <Box bg={C.softBlue} borderRadius="md" px="3" py="2">
          <Text fontSize="2xs" fontWeight="600" color={C.primary} mb="0.5">SUR LE BOÎTIER {brand.label.toUpperCase()}</Text>
          <Text fontSize="xs" color={C.body}>{brand.steps[link.method]}</Text>
        </Box>
      )}

      {link.method === 'ftp' && (
        <>
          <SimpleGrid columns={3} gap="3">
            <Field label="Port">
              <Input fontSize="sm" value={link.port || ''} onChange={setLink('port')} />
            </Field>
            <Field label="Utilisateur">
              <Input fontSize="sm" value={link.user || ''} onChange={setLink('user')} />
            </Field>
            <Field label="Mot de passe">
              <Input fontSize="sm" value={link.pass || ''} onChange={setLink('pass')} />
            </Field>
          </SimpleGrid>
          <Box border="1px solid" borderColor={C.cardBorder} borderRadius="md" px="3" py="2">
            <Text fontSize="2xs" fontWeight="600" letterSpacing="0.08em" color="gray.400" mb="1">
              À SAISIR DANS LE MENU FTP DU BOÎTIER
            </Text>
            {ips.length
              ? ips.map((a) => <CameraValue key={a.address} label={`Serveur (${a.name})`} value={a.address} />)
              : <Text fontSize="xs" color="gray.500" py="1">Serveur : l’adresse IP de ce poste (affichée dès que le Bridge est lancé)</Text>}
            <CameraValue label="Port" value={link.port || '2121'} />
            <CameraValue label="Utilisateur" value={link.user || ''} />
            <CameraValue label="Mot de passe" value={link.pass || ''} />
            <Text fontSize="2xs" color="gray.500" mt="1">
              Mode passif : activé · Sécurité (FTPS) : désactivée · Dossier de destination : libre
            </Text>
          </Box>
        </>
      )}

      {needsHost && (
        <Box>
          <HStack gap="3" align="end">
            <Field label={link.method === 'sdcard' ? 'Adresse IP de la carte' : 'Adresse IP du boîtier'} flex="1">
              <Input fontSize="sm" placeholder={link.method === 'sdcard' ? 'ex. 192.168.0.1' : 'ex. 192.168.1.20'}
                value={link.host || ''} onChange={setLink('host')} />
            </Field>
            {link.method !== 'sdcard' && (
              <Field label="Port" w="90px">
                <Input fontSize="sm" value={link.port || ''} onChange={setLink('port')} />
              </Field>
            )}
            <Button variant="outline" size="sm" h="40px" onClick={runProbe}
              disabled={!bridge.up || !link.host?.trim() || probe === 'busy'}>
              <FiSearch /> {probe === 'busy' ? 'Recherche…' : 'Détecter'}
            </Button>
          </HStack>
          <Text fontSize="2xs" color="gray.500" mt="1.5">
            L’adresse IP est affichée dans le menu réseau du boîtier une fois le Wi-Fi établi.
          </Text>
          {probe && probe !== 'busy' && (
            <Text fontSize="xs" mt="1.5" color={probe.reachable ? C.greenText : C.amberText}>{probeText()}</Text>
          )}
        </Box>
      )}

      {link.method === 'watch' && (
        <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
          <Field label="Dossier sur ce poste" gridColumn={{ sm: 'span 2' }}>
            <Input fontSize="sm" placeholder="C:\Photos\Import" value={link.path || ''} onChange={setLink('path')} />
          </Field>
          <Field label="Extensions">
            <Input fontSize="sm" placeholder="jpg, png, heic…" value={link.exts || ''} onChange={setLink('exts')} />
          </Field>
        </SimpleGrid>
      )}

      {link.method !== 'none' && (
        <>
          {deviceId
            ? <LinkState bridge={bridge} deviceId={deviceId} />
            : <Text fontSize="2xs" color="gray.500">L’état de la liaison s’affiche dès que l’appareil est enregistré.</Text>}
          <Text fontSize="2xs" color="gray.500">
            Sans Internet : le boîtier et ce poste doivent seulement partager un réseau — le Wi-Fi du cabinet,
            le Wi-Fi émis par le boîtier (ce poste s’y connecte) ou le point d’accès mobile de Windows (le boîtier s’y connecte).
          </Text>
        </>
      )}
    </VStack>
  )
}

const linkReady = (l) => (l.method === 'ftp' ? !!(l.user?.trim() && l.pass?.trim() && Number(l.port))
  : l.method === 'watch' ? !!l.path?.trim()
    : l.method === 'none' ? true : !!l.host?.trim())

/** Création / modification d'un appareil. `preset` = méthode pré-sélectionnée à la création. */
export function DeviceModal({ open, onClose, rooms = [], device, devices = [], bridge, preset, onSave }) {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    if (device) {
      const link = deviceLink(device)
      setForm({
        name: device.name || '', roomId: device.room_id || '',
        manufacturer: device.manufacturer || '', model: device.model || '',
        brand: brandOf(device.manufacturer).key,
        // fiche FTP d'avant le Bridge : identifiants à générer
        link: link.method === 'ftp' && !link.pass ? { ...defaultLink('ftp', devices.filter((d) => d.id !== device.id)), ...link, pass: defaultLink('ftp').pass } : link,
        interop: !!device.metadata?.interop,
      })
    } else {
      const brand = preset ? CAMERA_BRANDS.at(-1) : CAMERA_BRANDS[0]
      setForm({
        name: '', roomId: '', manufacturer: preset ? '' : brand.label, model: '', brand: brand.key,
        link: defaultLink(preset || brand.methods[0], devices), interop: false,
      })
    }
  }, [open, device?.id, preset]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !form) return null
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const save = async () => {
    setBusy(true)
    try { await onSave(form, device || null) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} width="600px"
      title={device ? 'Modifier l’appareil' : 'Nouvel appareil'}
      subtitle="Reliez le boîtier au poste par le réseau local, sans Internet"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <PrimaryButton onClick={save} disabled={!form.name.trim() || !linkReady(form.link) || busy}>
            {device ? 'Mettre à jour' : 'Enregistrer l’appareil'}
          </PrimaryButton>
        </>
      }>
      <VStack align="stretch" gap="4">
        <LinkSetup form={form} setForm={setForm} bridge={bridge} devices={devices} deviceId={device?.id} />
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3" pt="3" borderTop="1px solid" borderColor={C.cardBorder}>
          <Field label="Nom *">
            <Input fontSize="sm" placeholder="ex. Nikon Z6 II — Salle 2" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Salle">
            <Select w="100%" h="40px" value={form.roomId} onChange={set('roomId')}>
              <option value="">Aucune</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Fabricant">
            <Input fontSize="sm" placeholder="Nikon, Canon…" value={form.manufacturer} onChange={set('manufacturer')} />
          </Field>
          <Field label="Modèle">
            <Input fontSize="sm" placeholder="ex. Z6 II" value={form.model} onChange={set('model')} />
          </Field>
        </SimpleGrid>
        <HStack as="label" gap="2" cursor="pointer">
          <input type="checkbox" checked={form.interop} onChange={set('interop')} />
          <Text fontSize="xs" color={C.body}>
            Interopérabilité (option) : exposer cet appareil à un autre logiciel d’imagerie dentaire
          </Text>
        </HStack>
      </VStack>
    </Modal>
  )
}

/** Liste des appareils d'un type : choisir, modifier ou en ajouter un (Acquisition) */
export function DevicePickModal({
  open, onClose, title, subtitle, devices = [], rooms = [], bridge, selectedId,
  emptyText, addLabel, onPick, onAdd, onEdit,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width="480px">
      <BridgeBanner bridge={bridge} mb="3" />
      <VStack align="stretch" gap="1.5" maxH="300px" overflowY="auto">
        {devices.map((dev) => {
          const room = rooms.find((r) => r.id === dev.room_id)?.name
          const online = dev.status === 'online'
          return (
            <HStack key={dev.id} px="3" py="2" gap="3" borderRadius="lg" cursor="pointer"
              bg={selectedId === dev.id ? C.softBlue : 'transparent'} _hover={{ bg: C.softBlue }}
              onClick={() => onPick(dev)}>
              <IconTile icon={LINK_METHODS[deviceLink(dev).method]?.icon || FiMonitor} />
              <Box flex="1" minW="0">
                <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{dev.name}</Text>
                <Text fontSize="xs" color="gray.500" isTruncated>
                  {[LINK_METHODS[deviceLink(dev).method]?.label, dev.manufacturer, dev.model, room].filter(Boolean).join(' · ')}
                </Text>
              </Box>
              <HStack gap="1.5" flexShrink={0}>
                <Dot ok={online} size="7px" />
                <Text fontSize="2xs" color={online ? C.greenText : 'gray.500'}>{online ? 'En ligne' : 'Hors ligne'}</Text>
              </HStack>
              {selectedId === dev.id && <Box as={FiCheck} color={C.primary} />}
              <Box as="button" fontSize="2xs" color={C.primary} cursor="pointer" px="1"
                onClick={(e) => { e.stopPropagation(); onEdit(dev) }}>
                Régler
              </Box>
            </HStack>
          )
        })}
        {devices.length === 0 && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py="4">{emptyText}</Text>
        )}
      </VStack>
      <HStack mt="3" px="3" py="2" gap="3" cursor="pointer" _hover={{ bg: C.softBlue }} borderRadius="lg" onClick={onAdd}>
        <IconTile icon={FiPlus} />
        <Text fontSize="sm" color={C.primary} fontWeight="500">{addLabel}</Text>
      </HStack>
    </Modal>
  )
}
