// Route /reglage/reseaux — comptes sociaux connectés + programmation.
// Comptes : social_accounts (même source que Publication). Créneaux de
// publication par défaut persistés dans workspaces.settings.social_schedule.
// Publications programmées : social_posts status=scheduled.
import { useEffect, useState } from 'react'
import {
  Box, Button, Center, HStack, Input, SimpleGrid, Text, VStack,
} from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiArrowLeft, FiShare2, FiPlus, FiTrash2, FiCheck, FiClock,
  FiCalendar, FiAlertCircle, FiInstagram, FiFacebook, FiVideo, FiLink2,
} from 'react-icons/fi'
import { FaYoutube, FaPinterestP, FaGoogle } from 'react-icons/fa'
import { FaXTwitter, FaThreads } from 'react-icons/fa6'
import {
  Card, Tag, PageHeader, HelpButton, PrimaryButton, Modal, Select, Field,
  Tip, ConfirmModal, SectionLabel, ago,
} from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import {
  listSocialAccounts, connectSocialAccount, disconnectSocialAccount,
  listSocialPosts, getWorkspaceSettings, saveWorkspaceSetting,
} from '../api'

const PROVIDERS = [
  { id: 'instagram', label: 'Instagram', icon: FiInstagram, color: '#d62976' },
  { id: 'facebook', label: 'Facebook', icon: FiFacebook, color: '#1877f2' },
  { id: 'tiktok', label: 'TikTok', icon: FiVideo, color: '#000000' },
  { id: 'linkedin', label: 'LinkedIn', icon: FiLink2, color: '#0a66c2' },
  { id: 'youtube', label: 'YouTube', icon: FaYoutube, color: '#ff0000' },
  { id: 'pinterest', label: 'Pinterest', icon: FaPinterestP, color: '#e60023' },
  { id: 'x', label: 'X (Twitter)', icon: FaXTwitter, color: '#000000' },
  { id: 'threads', label: 'Threads', icon: FaThreads, color: '#000000' },
  { id: 'google_business', label: 'Google Business', icon: FaGoogle, color: '#4285f4' },
]
const providerOf = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0]

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function ReglageReseaux() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [accounts, setAccounts] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [slots, setSlots] = useState([])
  const [slotForm, setSlotForm] = useState({ day: 0, time: '09:00' })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [connect, setConnect] = useState(false)
  const [form, setForm] = useState({ provider: 'instagram', handle: '' })
  const [rmAcc, setRmAcc] = useState(null)

  const reload = async () => {
    if (!wsId) return
    const [accs, posts, settings] = await Promise.all([
      listSocialAccounts(wsId),
      listSocialPosts(wsId, { status: 'scheduled' }),
      getWorkspaceSettings(wsId),
    ])
    setAccounts(accs)
    setScheduled(posts.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)))
    setSlots(settings.social_schedule || [])
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  const doConnect = async () => {
    if (!form.handle.trim()) return
    setBusy(true)
    await connectSocialAccount(wsId, { provider: form.provider, handle: form.handle.trim().replace(/^@/, '') })
    setBusy(false); setForm({ provider: 'instagram', handle: '' }); setConnect(false); reload()
  }
  const doDisconnect = async () => {
    setBusy(true)
    await disconnectSocialAccount(rmAcc.id)
    setBusy(false); setRmAcc(null); reload()
  }

  const addSlot = () => {
    if (slots.some((s) => s.day === slotForm.day && s.time === slotForm.time)) return
    setSlots([...slots, { ...slotForm }].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)))
    setSaved(false)
  }
  const saveSlots = async () => {
    setBusy(true)
    const ok = await saveWorkspaceSetting(wsId, 'social_schedule', slots)
    setBusy(false); if (ok) setSaved(true)
  }

  const fmtWhen = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <Box w="100%" px="6" py="6">
      <Link to="/reglage">
        <Button size="sm" variant="ghost" color="gray.500" mb="2"><FiArrowLeft /> Réglages</Button>
      </Link>
      <PageHeader
        icon={FiShare2} title="Réseaux sociaux"
        subtitle="Comptes connectés et programmation des publications"
      >
        <HelpButton />
        <PrimaryButton icon={FiPlus} onClick={() => setConnect(true)}>
          Connecter un réseau ({accounts.length})
        </PrimaryButton>
      </PageHeader>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" mt="4">
        {/* ---- comptes connectés ---- */}
        <Card overflow="hidden">
          <HStack px="4" py="3" borderBottom="1px solid" borderColor="gray.100">
            <Text fontSize="sm" fontWeight="700" color={C.ink} flex="1">Comptes connectés</Text>
            <Text fontSize="2xs" color="gray.500">{accounts.length} compte(s)</Text>
          </HStack>
          {accounts.map((a, i) => {
            const prov = providerOf(a.provider)
            return (
              <HStack key={a.id} px="4" py="3" gap="3"
                borderTop={i > 0 ? '1px solid' : 'none'} borderColor="gray.100">
                <Center w="34px" h="34px" borderRadius="lg" flexShrink={0}
                  bg={`${prov.color}18`} color={prov.color}>
                  <Box as={prov.icon} fontSize="15px" />
                </Center>
                <Box flex="1" minW="0">
                  <HStack gap="2">
                    <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>@{a.handle}</Text>
                    <Tag color="gray">{prov.label}</Tag>
                    {a.meta?.pending_oauth && <Tag color="amber">En attente OAuth</Tag>}
                  </HStack>
                  <Text fontSize="2xs" color="gray.500">
                    <FiClock style={{ display: 'inline' }} /> connecté {ago(a.created_at)}
                  </Text>
                </Box>
                <Tip label="Déconnecter ce compte">
                  <Box as="button" aria-label={`Déconnecter ${a.handle}`} p="1" color="gray.400"
                    cursor="pointer" _hover={{ color: 'red.500' }}
                    onClick={() => setRmAcc(a)}>
                    <FiTrash2 size={14} />
                  </Box>
                </Tip>
              </HStack>
            )
          })}
          {!accounts.length && (
            <Center py="10" color="gray.400" flexDirection="column" gap="2">
              <Box as={FiShare2} fontSize="xl" />
              <Text fontSize="sm">Aucun compte — connectez votre premier réseau.</Text>
            </Center>
          )}
        </Card>

        {/* ---- créneaux par défaut ---- */}
        <Card p="5">
          <HStack mb="1" gap="2">
            <Box as={FiCalendar} color={C.primary} />
            <Text fontSize="sm" fontWeight="700" color={C.ink}>Créneaux de publication</Text>
          </HStack>
          <Text fontSize="2xs" color="gray.500" mb="3">
            Jours et heures proposés par défaut lors de la programmation d'un brouillon.
          </Text>
          <HStack gap="2" flexWrap="wrap" mb="3">
            {slots.map((s, i) => (
              <HStack key={`${s.day}-${s.time}`} gap="1" px="2" py="1"
                borderRadius="md" bg={C.softBlue} fontSize="xs" color={C.ink}>
                <Text>{DAYS[s.day]} {s.time}</Text>
                <Box as="button" aria-label={`Retirer ${DAYS[s.day]} ${s.time}`}
                  cursor="pointer" color="gray.400" _hover={{ color: 'red.500' }}
                  onClick={() => { setSlots(slots.filter((_, j) => j !== i)); setSaved(false) }}>
                  <FiTrash2 size={11} />
                </Box>
              </HStack>
            ))}
            {!slots.length && (
              <Text fontSize="xs" color="gray.400">Aucun créneau défini.</Text>
            )}
          </HStack>
          <HStack gap="2">
            <Select value={slotForm.day} aria-label="Jour du créneau"
              onChange={(e) => setSlotForm({ ...slotForm, day: +e.target.value })}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
            <Input type="time" w="110px" fontSize="sm" value={slotForm.time}
              aria-label="Heure du créneau"
              onChange={(e) => setSlotForm({ ...slotForm, time: e.target.value })} />
            <Button variant="outline" size="sm" onClick={addSlot} aria-label="Ajouter le créneau">
              <FiPlus /> Ajouter
            </Button>
            <PrimaryButton icon={FiCheck} onClick={saveSlots} disabled={busy}>
              {saved ? 'Enregistré ✓' : 'Enregistrer'}
            </PrimaryButton>
          </HStack>
          {saved && (
            <HStack mt="2" gap="1">
              <Box as={FiCheck} color={C.greenText} fontSize="xs" />
              <Text fontSize="2xs" color={C.greenText}>Créneaux enregistrés.</Text>
            </HStack>
          )}
        </Card>
      </SimpleGrid>

      {/* ---- publications programmées ---- */}
      <Card mt="5" overflow="hidden">
        <HStack px="4" py="3" borderBottom="1px solid" borderColor="gray.100">
          <Text fontSize="sm" fontWeight="700" color={C.ink} flex="1">
            Publications programmées
          </Text>
          <Text fontSize="2xs" color="gray.500">{scheduled.length} à venir</Text>
        </HStack>
        {scheduled.map((p, i) => {
          const prov = p.account && providerOf(p.account.provider)
          return (
            <HStack key={p.id} px="4" py="3" gap="3"
              borderTop={i > 0 ? '1px solid' : 'none'} borderColor="gray.100">
              {prov && (
                <Center w="30px" h="30px" borderRadius="lg" flexShrink={0}
                  bg={`${prov.color}18`} color={prov.color}>
                  <Box as={prov.icon} fontSize="13px" />
                </Center>
              )}
              <Box flex="1" minW="0">
                <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>
                  {p.caption || p.title || 'Publication'}
                </Text>
                <Text fontSize="2xs" color="gray.500">
                  {p.kind || 'publication'}
                  {p.account ? ` · @${p.account.handle}` : ' · sans réseau'}
                  {p.patient ? ` · ${p.patient.first_name || ''} ${p.patient.last_name || ''}` : ''}
                </Text>
              </Box>
              <Tag color="amber"><FiClock style={{ marginRight: 3 }} />{fmtWhen(p.scheduled_at)}</Tag>
            </HStack>
          )
        })}
        {!scheduled.length && (
          <Center py="10" color="gray.400" flexDirection="column" gap="2">
            <Box as={FiCalendar} fontSize="xl" />
            <Text fontSize="sm">Aucune publication programmée — programmez un brouillon depuis l'onglet Publication.</Text>
          </Center>
        )}
      </Card>

      {/* ---- modal connexion ---- */}
      <Modal open={connect} onClose={() => setConnect(false)}
        title="Connecter un réseau social" subtitle="Le compte est utilisable pour attacher vos brouillons"
        footer={<>
          <Box />
          <PrimaryButton icon={FiPlus} onClick={doConnect}
            disabled={busy || !form.handle.trim()}>
            {busy ? 'Connexion…' : 'Connecter'}
          </PrimaryButton>
        </>}>
        <VStack align="stretch" gap="3">
          <Field label="Réseau">
            <HStack gap="2" flexWrap="wrap">
              {PROVIDERS.map((p) => (
                <Box as="button" key={p.id} aria-label={`Choisir ${p.label}`}
                  px="3" py="2" borderRadius="md" cursor="pointer"
                  border="1.5px solid" fontSize="xs" display="flex" alignItems="center" gap="6px"
                  fontWeight={form.provider === p.id ? '600' : '400'}
                  borderColor={form.provider === p.id ? p.color : C.cardBorder}
                  color={form.provider === p.id ? p.color : 'gray.600'}
                  onClick={() => setForm({ ...form, provider: p.id })}>
                  <Box as={p.icon} /> {p.label}
                </Box>
              ))}
            </HStack>
          </Field>
          <Field label="Identifiant du compte">
            <Input fontSize="sm" placeholder="@votre.cabinet" autoFocus
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })} />
          </Field>
          <HStack bg={C.softBlue} borderRadius="md" px="3" py="2" gap="2">
            <Box as={FiAlertCircle} color={C.primary} fontSize="sm" flexShrink={0} />
            <Text fontSize="2xs" color="gray.600">
              L'autorisation OAuth réelle nécessite une app {providerOf(form.provider).label} côté
              serveur — le compte est enregistré « en attente » et utilisable dès maintenant.
            </Text>
          </HStack>
        </VStack>
      </Modal>

      {/* ---- déconnexion : confirmation obligatoire ---- */}
      <ConfirmModal open={!!rmAcc} onClose={() => setRmAcc(null)}
        onConfirm={doDisconnect} busy={busy}
        title="Déconnecter le compte ?"
        confirmLabel="Oui, déconnecter"
        message={`Voulez-vous vraiment déconnecter @${rmAcc?.handle || ''} ? Les brouillons qui lui sont rattachés seront conservés sans réseau de destination.`} />
    </Box>
  )
}
