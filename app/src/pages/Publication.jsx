import { useEffect, useState } from 'react'
import { Box, Button, Center, Flex, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiBell, FiPlus, FiZap, FiShare2, FiEdit3, FiList, FiGlobe,
  FiChevronLeft, FiChevronRight, FiFilter, FiCalendar, FiCheck,
  FiInstagram, FiFacebook, FiImage, FiLayers, FiVideo, FiTrash2,
  FiClock, FiLink2, FiAlertCircle,
} from 'react-icons/fi'
import { FaYoutube, FaPinterestP, FaGoogle } from 'react-icons/fa'
import { FaXTwitter, FaThreads } from 'react-icons/fa6'
import { HiOutlineSparkles } from 'react-icons/hi2'
import {
  Card, EmptyPane, PageHeader, HelpButton, PrimaryButton, Modal, Select, Field,
  Tip, Tag, ago, ConfirmModal,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import { useApp } from '../context/AppContext'
import {
  listSocialAccounts, connectSocialAccount, disconnectSocialAccount,
  listSocialPosts, createSocialPost, updateSocialPost, deleteSocialPost,
  listPhotos, listMontages, listVideoProjects, listDossiers, getPatient,
} from '../api'

const DAYS = ['LUN 26', 'MAR 27', 'MER 28', 'JEU 29', 'VEN 30', 'SAM 31', 'DIM 1']

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

const KINDS = [
  ['publication', 'Publication'],
  ['story', 'Story'],
  ['reel', 'Reel'],
]

const EVENTS = [
  ['13 nov.', 'Journée mondiale de la gentillesse'],
  ['14 nov.', 'Journée mondiale du diabète'],
]

export default function Publication() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [view, setView] = useState('week')
  const [tab, setTab] = useState('moments')
  const [accounts, setAccounts] = useState([])
  const [posts, setPosts] = useState([])
  const [modal, setModal] = useState(null) // 'connect' | 'draft'
  const [editPost, setEditPost] = useState(null)

  const reload = async () => {
    if (!wsId) return
    const [accs, ps] = await Promise.all([listSocialAccounts(wsId), listSocialPosts(wsId)])
    setAccounts(accs)
    setPosts(ps)
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  const drafts = posts.filter((p) => p.status === 'draft')
  const scheduled = posts.filter((p) => p.status === 'scheduled')

  const steps = [
    { label: 'Connectez un réseau social (Instagram, Facebook…).', done: accounts.length > 0 },
    { label: 'Préparez votre brouillon dès maintenant — média, légende et patient sont conservés même sans connexion.', done: drafts.length > 0 || scheduled.length > 0 },
    { label: 'Une fois le réseau connecté, rattachez-le au brouillon puis programmez la publication.', done: scheduled.length > 0 },
  ]

  const openDraft = (post = null) => { setEditPost(post); setModal('draft') }

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader
        icon={FiCalendar} iconBg={C.greenBg} iconColor={C.greenText}
        title="Programmation"
        subtitle="Planifiez vos publications sur les réseaux sociaux."
      >
        <HelpButton />
        <Tip label="Recevoir une alerte quand une publication est publiée ou échoue">
          <Button variant="outline" size="sm" borderRadius="md" color="gray.600">
            <FiBell /> Activer les notifications
          </Button>
        </Tip>
      </PageHeader>
      <HStack gap="2" mb="5" justify="flex-end">
        <Tip label="Composer un avant/après prêt à publier depuis un montage">
          <Button variant="outline" size="sm" borderRadius="md" color="gray.500" onClick={() => openDraft()}>
            <HiOutlineSparkles /> Avant/Après express
          </Button>
        </Tip>
        <Tip label="Bientôt — génération de légende par IA">
          <Button variant="outline" size="sm" borderRadius="md" color="gray.500" disabled>
            <FiZap /> Campagne IA
          </Button>
        </Tip>
        <PrimaryButton icon={FiPlus} onClick={() => openDraft()}>Nouvelle publication</PrimaryButton>
      </HStack>

      <Card p="5" mb="5" bg={C.softBlue} borderColor={C.softBlueBorder}>
        <HStack gap="2" mb="3">
          <Box as={FiShare2} color={C.primary} fontSize="sm" />
          <Text fontSize="sm" fontWeight="600" color={C.ink}>Publier pour la première fois</Text>
        </HStack>
        <VStack align="stretch" gap="1.5" mb="4">
          {steps.map((s, i) => (
            <HStack key={i} gap="2.5">
              <NumDot n={s.done ? '✓' : i + 1} done={s.done} />
              <Text fontSize="sm" color={s.done ? 'gray.400' : C.body}
                textDecoration={s.done ? 'line-through' : 'none'}>{s.label}</Text>
            </HStack>
          ))}
        </VStack>
        <HStack gap="3" mb="3">
          <Tip label={accounts.length ? `${accounts.length} réseau(x) connecté(s) — gérer` : 'Lier un compte Instagram / Facebook / TikTok / LinkedIn'}>
            <PrimaryButton icon={FiShare2} onClick={() => setModal('connect')}>
              Connecter un réseau{accounts.length > 0 && ` (${accounts.length})`}
            </PrimaryButton>
          </Tip>
          <Tip label="Créer un brouillon : média, légende, dossier patient, programmation">
            <Button variant="outline" size="sm" color="gray.600" onClick={() => openDraft()}>
              <FiEdit3 /> Préparer un brouillon
            </Button>
          </Tip>
        </HStack>
        <Text fontSize="2xs" color="gray.500">
          La connexion d'un compte est réservée aux propriétaires et administrateurs du cabinet.
          Un brouillon peut être préparé par tout membre autorisé à écrire.
        </Text>
      </Card>

      <HStack gap="4" alignItems="start">
        <Box flex="1">
          <HStack mb="4" gap="2">
            <HStack gap="0">
              <Button size="xs" bg={view === 'week' ? C.primary : 'white'} color={view === 'week' ? '#ffffff' : 'gray.600'} border="1px solid" borderColor={C.cardBorder} borderRadius="md 0 0 md" onClick={() => setView('week')}>Semaine</Button>
              <Button size="xs" bg={view === 'month' ? C.primary : 'white'} color={view === 'month' ? '#ffffff' : 'gray.600'} border="1px solid" borderColor={C.cardBorder} borderRadius="0" onClick={() => setView('month')}>Calendrier</Button>
            </HStack>
            <Button variant="outline" size="xs" px="2"><FiList /></Button>
            <Button variant="outline" size="xs" px="2"><FiGlobe /></Button>
            <Button variant="ghost" size="xs" px="1"><FiChevronLeft /></Button>
            <Button variant="outline" size="xs">Aujourd'hui</Button>
            <Button variant="ghost" size="xs" px="1"><FiChevronRight /></Button>
            <Text fontSize="lg" fontWeight="700" color={C.ink} flex="1" textAlign="center">Octobre 2026</Text>
            <HStack bg="white" border="1px solid" borderColor={C.cardBorder} borderRadius="md" px="2" h="30px" gap="1.5">
              <Box as={FiFilter} color="gray.400" fontSize="xs" />
              <Text fontSize="xs" color="gray.600">Type de contenu : Tous</Text>
              <Text fontSize="2xs" color="gray.400">⌄</Text>
            </HStack>
          </HStack>
          <SimpleGrid columns={8} gap="0" border="1px solid" borderColor={C.cardBorder} borderRadius="lg" overflow="hidden">
            <EmptyPane borderRadius="0" border="none" borderRight="1px solid" borderColor={C.cardBorder} p="6" m="0" minH="220px">
              <VStack gap="3" align="center" justify="center" h="100%">
                <Text fontSize="xs" color="gray.600" textAlign="center">Créer une publication, une story ou un reel.</Text>
                <Text fontSize="2xs" color="gray.400" textAlign="center">Partagez du contenu avec votre audience aujourd'hui.</Text>
                <Button size="xs" variant="outline" onClick={() => openDraft()}>Créer +</Button>
              </VStack>
            </EmptyPane>
            {DAYS.map((d, i) => (
              <Box key={d} bg={i === 5 ? C.softBlue : 'white'} borderRight={i < 6 ? '1px solid' : 'none'} borderColor="gray.100" p="2" minH="220px">
                <HStack justify="space-between">
                  <Text fontSize="2xs" fontWeight={i === 5 ? '700' : '500'} color={i === 5 ? C.primary : 'gray.500'}>{d}</Text>
                  <Text fontSize="2xs" color="gray.300">+</Text>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        </Box>

        <Card w="270px" flexShrink={0} p="4">
          <HStack gap="4" mb="3" borderBottom="1px solid" borderColor="gray.100" pb="2">
            {[['objectifs', 'Objectifs'], ['moments', 'Moments'], ['brouillons', 'Brouillons']].map(([k, label]) => (
              <Text
                key={k} fontSize="xs" pb="1" cursor="pointer"
                fontWeight={tab === k ? '600' : '400'}
                color={tab === k ? C.primary : 'gray.500'}
                borderBottom={tab === k ? '2px solid' : 'none'}
                borderColor={C.primary}
                onClick={() => setTab(k)}
              >
                {label}{k === 'brouillons' && drafts.length > 0 ? ` (${drafts.length})` : ''}
              </Text>
            ))}
          </HStack>

          {tab === 'brouillons' ? (
            <DraftsPane drafts={posts.filter((p) => p.status !== 'published')} accounts={accounts}
              onEdit={openDraft} onReload={reload} />
          ) : tab === 'objectifs' ? (
            <VStack align="stretch" gap="2">
              <Text fontSize="xs" fontWeight="600" color={C.ink}>Objectifs de la semaine</Text>
              {[['3 publications', drafts.length + scheduled.length >= 3],
                ['1 réseau connecté', accounts.length > 0],
                ['1 publication programmée', scheduled.length > 0]].map(([l, done]) => (
                <HStack key={l} gap="2">
                  <Center w="14px" h="14px" borderRadius="full" bg={done ? C.greenBg : 'gray.100'} color={done ? C.greenText : 'gray.400'} fontSize="2xs">
                    <FiCheck />
                  </Center>
                  <Text fontSize="2xs" color={done ? C.body : 'gray.500'}>{l}</Text>
                </HStack>
              ))}
            </VStack>
          ) : (
            <>
              <Text fontSize="xs" fontWeight="600" color={C.ink} mb="1">Meilleurs moments</Text>
              <Text fontSize="2xs" color="gray.500" mb="2">Heures où votre audience est la plus active cette semaine.</Text>
              <Text fontSize="2xs" color="gray.400" mb="3">
                {accounts.length ? 'Données d\u2019audience disponibles après les premières publications.' : 'Aucune donnée d\u2019audience — connectez un compte.'}
              </Text>
              <Text fontSize="xs" fontWeight="600" color={C.ink} mb="2">Événements à venir</Text>
              <VStack align="stretch" gap="2">
                {EVENTS.map(([d, t]) => (
                  <HStack key={d} bg={C.softBlue} borderRadius="md" px="2" py="1.5" gap="2">
                    <Text fontSize="2xs" color={C.primary} fontWeight="600" whiteSpace="nowrap">{d}</Text>
                    <Text fontSize="2xs" color={C.body} isTruncated flex="1">{t}</Text>
                    <Box as={FiCalendar} color={C.primary} fontSize="2xs" />
                  </HStack>
                ))}
              </VStack>
            </>
          )}
        </Card>
      </HStack>

      <ConnectModal open={modal === 'connect'} onClose={() => setModal(null)}
        wsId={wsId} accounts={accounts} onDone={reload} />
      <DraftModal open={modal === 'draft'} onClose={() => { setModal(null); setEditPost(null) }}
        wsId={wsId} accounts={accounts} post={editPost} onDone={reload} />
    </Box>
  )
}

// ---- Onglet brouillons : posts réels -------------------------------------------

function DraftsPane({ drafts, accounts, onEdit, onReload }) {
  const [busy, setBusy] = useState(false)
  if (!drafts.length) {
    return (
      <VStack py="4" gap="2" align="center">
        <Text fontSize="2xs" color="gray.400" textAlign="center">
          Aucun brouillon — cliquez « Préparer un brouillon » pour en créer un.
        </Text>
      </VStack>
    )
  }
  const [rmPost, setRmPost] = useState(null)
  const del = async () => {
    if (!rmPost) return
    setBusy(true)
    await deleteSocialPost(rmPost)
    setBusy(false); setRmPost(null); onReload()
  }
  return (
    <VStack align="stretch" gap="2" maxH="380px" overflowY="auto">
      {drafts.map((p) => {
        const prov = p.account && providerOf(p.account.provider)
        return (
          <Card key={p.id} p="2" cursor="pointer" _hover={{ borderColor: 'blue.300' }} onClick={() => onEdit(p)}>
            <HStack gap="2" align="start">
              <Box w="44px" flexShrink={0}>
                {p.photo?.storage_path ? (
                  <PhotoImg storagePath={p.photo.storage_path} ratio="1" />
                ) : p.montage?.export_url ? (
                  <PhotoImg storagePath={p.montage.export_url} ratio="1" />
                ) : (
                  <Center bg="gray.100" borderRadius="md" h="44px">
                    <Box as={p.video_id ? FiVideo : FiLayers} color="gray.400" fontSize="sm" />
                  </Center>
                )}
              </Box>
              <Box flex="1" minW="0">
                <HStack gap="1.5" mb="0.5">
                  <Tag color={p.status === 'scheduled' ? 'blue' : 'gray'}>
                    {p.status === 'scheduled' ? 'Programmé' : 'Brouillon'}
                  </Tag>
                  {p.kind && <Tag color="purple">{p.kind}</Tag>}
                  {prov && <Box as={prov.icon} color={prov.color} fontSize="xs" />}
                </HStack>
                <Text fontSize="2xs" color={C.body} isTruncated>{p.caption || '(sans légende)'}</Text>
                <Text fontSize="2xs" color="gray.400">
                  {p.scheduled_at
                    ? `📅 ${new Date(p.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    : ago(p.created_at)}
                  {p.patient ? ` · ${[p.patient.first_name, p.patient.last_name].filter(Boolean).join(' ')}` : ''}
                </Text>
              </Box>
              <Tip label="Supprimer ce brouillon">
                <Box as="button" aria-label="Supprimer le brouillon" color="gray.400" p="1"
                  cursor={busy ? 'wait' : 'pointer'} _hover={{ color: 'red.500' }}
                  onClick={(e) => { e.stopPropagation(); setRmPost(p.id) }}>
                  <FiTrash2 />
                </Box>
              </Tip>
            </HStack>
          </Card>
        )
      })}
      <ConfirmModal open={!!rmPost} onClose={() => setRmPost(null)}
        onConfirm={del} busy={busy}
        title="Supprimer le brouillon ?"
        confirmLabel="Oui, supprimer"
        message="Voulez-vous vraiment supprimer ce brouillon ? Le média reste dans le workspace." />
    </VStack>
  )
}

// ---- Modal « Connecter un réseau » ---------------------------------------------

function ConnectModal({ open, onClose, wsId, accounts, onDone }) {
  const [provider, setProvider] = useState('instagram')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)

  const connect = async () => {
    if (!handle.trim()) return
    setBusy(true)
    await connectSocialAccount(wsId, { provider, handle: handle.trim().replace(/^@/, '') })
    setBusy(false); setHandle(''); onDone()
  }
  const [rmAcc, setRmAcc] = useState(null)
  const disconnect = async () => {
    if (!rmAcc) return
    setBusy(true)
    await disconnectSocialAccount(rmAcc)
    setBusy(false); setRmAcc(null); onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title="Connecter un réseau social"
      subtitle="Le compte sera utilisable pour programmer vos publications" width="480px"
      footer={<>
        <Text fontSize="2xs" color="gray.400">Réservé aux propriétaires et administrateurs</Text>
        <PrimaryButton onClick={connect} disabled={!handle.trim() || busy}>
          {busy ? 'Connexion…' : 'Connecter'}
        </PrimaryButton>
      </>}>
      {accounts.length > 0 && (
        <VStack align="stretch" gap="2" mb="4">
          {accounts.map((a) => {
            const prov = providerOf(a.provider)
            return (
              <HStack key={a.id} border="1px solid" borderColor={C.cardBorder} borderRadius="md" px="3" py="2">
                <Center w="30px" h="30px" borderRadius="md" bg={prov.color} color="#fff" fontSize="sm">
                  <Box as={prov.icon} />
                </Center>
                <Box flex="1" minW="0">
                  <Text fontSize="sm" fontWeight="600" color={C.ink}>@{a.handle}</Text>
                  <Text fontSize="2xs" color="gray.400">{prov.label} · connecté {ago(a.created_at)}</Text>
                </Box>
                <Tag color={a.meta?.pending_oauth ? 'orange' : 'green'}>
                  {a.meta?.pending_oauth ? 'En attente OAuth' : 'Actif'}
                </Tag>
                <Tip label="Déconnecter ce compte">
                  <Box as="button" aria-label="Déconnecter le compte" color="gray.400" p="1" cursor="pointer"
                    _hover={{ color: 'red.500' }} onClick={() => setRmAcc(a.id)}>
                    <FiTrash2 />
                  </Box>
                </Tip>
              </HStack>
            )
          })}
        </VStack>
      )}
      <Field label="Réseau" mb="3">
        <HStack gap="2">
          {PROVIDERS.map((p) => (
            <Box key={p.id} as="button" px="3" py="2" borderRadius="md" cursor="pointer"
              border="1.5px solid" fontSize="xs" fontWeight={provider === p.id ? '600' : '400'}
              borderColor={provider === p.id ? p.color : C.cardBorder}
              color={provider === p.id ? p.color : 'gray.600'}
              onClick={() => setProvider(p.id)}>
              <Box as={p.icon} display="inline" mr="1" />{p.label}
            </Box>
          ))}
        </HStack>
      </Field>
      <Field label="Identifiant du compte" mb="3">
        <Input fontSize="sm" placeholder="ex. cabinet.sourire (sans @)" value={handle}
          onChange={(e) => setHandle(e.target.value)} />
      </Field>
      <HStack bg="orange.50" borderRadius="md" px="3" py="2" gap="2">
        <Box as={FiAlertCircle} color="orange.500" fontSize="sm" flexShrink={0} />
        <Text fontSize="2xs" color="orange.700">
          L'autorisation OAuth réelle nécessite une app {providerOf(provider).label} côté serveur —
          le compte est enregistré « en attente » et déjà utilisable pour attacher vos brouillons.
        </Text>
      </HStack>
      <ConfirmModal open={!!rmAcc} onClose={() => setRmAcc(null)}
        onConfirm={disconnect} busy={busy}
        title="Déconnecter le compte ?"
        confirmLabel="Oui, déconnecter"
        message="Voulez-vous vraiment déconnecter ce compte social ? Les brouillons qui lui sont rattachés seront conservés sans réseau de destination." />
    </Modal>
  )
}

// ---- Modal « Préparer un brouillon » -------------------------------------------

function DraftModal({ open, onClose, wsId, accounts, post, onDone }) {
  const [kind, setKind] = useState('publication')
  const [mediaTab, setMediaTab] = useState('photos')
  const [mediaId, setMediaId] = useState(null)
  const [caption, setCaption] = useState('')
  const [dossierId, setDossierId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [schedule, setSchedule] = useState('')
  const [watermark, setWatermark] = useState(true)
  const [busy, setBusy] = useState(false)
  const [photos, setPhotos] = useState([])
  const [montages, setMontages] = useState([])
  const [videos, setVideos] = useState([])
  const [dossiers, setDossiers] = useState([])

  useEffect(() => {
    if (!open || !wsId) return
    listPhotos(wsId, { limit: 60 }).then(setPhotos)
    listMontages(wsId).then(setMontages)
    listVideoProjects(wsId).then(setVideos)
    listDossiers(wsId).then(setDossiers)
  }, [open, wsId])

  useEffect(() => {
    if (!open) return
    if (post) {
      setKind(post.kind || 'publication')
      setCaption(post.caption || '')
      setAccountId(post.account_id || '')
      setSchedule(post.scheduled_at ? post.scheduled_at.slice(0, 16) : '')
      setWatermark(post.watermark_enabled !== false)
      setDossierId('')
      setMediaId(post.photo_id || post.montage_id || post.video_id)
      setMediaTab(post.photo_id ? 'photos' : post.montage_id ? 'montages' : 'videos')
    } else {
      setKind('publication'); setCaption(''); setAccountId(accounts[0]?.id || '')
      setSchedule(''); setWatermark(true); setDossierId(''); setMediaId(null); setMediaTab('photos')
    }
  }, [open, post]) // eslint-disable-line

  const save = async () => {
    if (!mediaId) return
    setBusy(true)
    let patientId = null
    if (dossierId) patientId = (await getPatient(dossierId))?.id || null
    const fields = {
      kind, caption: caption.trim() || null,
      account_id: accountId || null,
      scheduled_at: schedule ? new Date(schedule).toISOString() : null,
      watermark_enabled: watermark,
      patient_id: patientId,
      photo_id: mediaTab === 'photos' ? mediaId : null,
      montage_id: mediaTab === 'montages' ? mediaId : null,
      video_id: mediaTab === 'videos' ? mediaId : null,
    }
    if (post) {
      await updateSocialPost(post.id, {
        ...fields, status: fields.scheduled_at ? 'scheduled' : 'draft',
      })
    } else {
      await createSocialPost(wsId, fields)
    }
    setBusy(false); onDone(); onClose()
  }

  const pool = mediaTab === 'photos' ? photos : mediaTab === 'montages' ? montages : videos

  return (
    <Modal open={open} onClose={onClose}
      title={post ? 'Modifier le brouillon' : 'Préparer un brouillon'}
      subtitle="Le média, la légende et le patient sont conservés même sans réseau connecté"
      width="620px"
      footer={<>
        <Text fontSize="2xs" color="gray.400">
          {schedule ? 'Sera programmé à la date choisie' : 'Sera conservé en brouillon'}
        </Text>
        <HStack gap="2">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <PrimaryButton onClick={save} disabled={!mediaId || busy}>
            {busy ? 'Enregistrement…' : post ? 'Enregistrer' : 'Créer le brouillon'}
          </PrimaryButton>
        </HStack>
      </>}>
      <Field label="Type de contenu" mb="3">
        <HStack gap="2">
          {KINDS.map(([k, l]) => (
            <Box key={k} as="button" px="3" py="1.5" borderRadius="md" cursor="pointer" fontSize="xs"
              fontWeight={kind === k ? '600' : '400'} border="1.5px solid"
              borderColor={kind === k ? C.primary : C.cardBorder}
              bg={kind === k ? C.softBlue : 'transparent'} color={kind === k ? C.primary : 'gray.600'}
              onClick={() => setKind(k)}>
              {l}
            </Box>
          ))}
        </HStack>
      </Field>

      <Field label="Média" mb="3">
        <HStack gap="2" mb="2">
          {[['photos', 'Photos', FiImage], ['montages', 'Montages', FiLayers], ['videos', 'Vidéos', FiVideo]].map(([k, l, I]) => (
            <Box key={k} as="button" px="2.5" py="1" fontSize="xs" borderRadius="md" cursor="pointer"
              fontWeight={mediaTab === k ? '600' : '400'}
              bg={mediaTab === k ? C.softBlue : 'transparent'} color={mediaTab === k ? C.primary : 'gray.500'}
              onClick={() => { setMediaTab(k); setMediaId(null) }}>
              <Box as={I} display="inline" mr="1" />{l}
            </Box>
          ))}
        </HStack>
        <Box maxH="220px" overflowY="auto" border="1px solid" borderColor={C.cardBorder} borderRadius="md" p="2">
          {!pool.length ? (
            <Text fontSize="xs" color="gray.400" py="4" textAlign="center">
              Aucun {mediaTab === 'photos' ? 'photo' : mediaTab} disponible
            </Text>
          ) : (
            <SimpleGrid columns={5} gap="2">
              {pool.map((m) => {
                const path = mediaTab === 'photos' ? m.storage_path : m.export_url
                return (
                  <Box key={m.id} position="relative" borderRadius="md" overflow="hidden"
                    cursor="pointer" border="2px solid"
                    borderColor={mediaId === m.id ? C.primary : 'transparent'}
                    onClick={() => setMediaId(m.id)}>
                    {path ? (
                      <PhotoImg storagePath={path} ratio="1" />
                    ) : (
                      <Center bg="gray.100" h="100%" minH="64px">
                        <Box as={mediaTab === 'videos' ? FiVideo : FiLayers} color="gray.400" />
                      </Center>
                    )}
                    {mediaId === m.id && (
                      <Center position="absolute" top="1" right="1" w="16px" h="16px"
                        borderRadius="full" bg={C.primary} color="#fff" fontSize="2xs">
                        <FiCheck />
                      </Center>
                    )}
                  </Box>
                )
              })}
            </SimpleGrid>
          )}
        </Box>
      </Field>

      <Field label="Légende" mb="3">
        <Box as="textarea" rows="3" w="100%" fontSize="sm" px="3" py="2"
          border="1px solid" borderColor={C.cardBorder} borderRadius="md"
          placeholder="Votre légende, hashtags…" value={caption}
          onChange={(e) => setCaption(e.target.value)} />
      </Field>

      <SimpleGrid columns={2} gap="3" mb="3">
        <Field label="Dossier patient (optionnel)">
          <Select w="100%" value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
            <option value="">Aucun</option>
            {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Réseau de destination">
          <Select w="100%" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">À choisir plus tard</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{providerOf(a.provider).label} — @{a.handle}</option>
            ))}
          </Select>
        </Field>
      </SimpleGrid>

      <SimpleGrid columns={2} gap="3">
        <Field label="Programmer (optionnel)">
          <Input type="datetime-local" fontSize="sm" value={schedule}
            onChange={(e) => setSchedule(e.target.value)} />
        </Field>
        <Field label="Filigrane DentoPic">
          <HStack h="34px" gap="2" cursor="pointer" onClick={() => setWatermark(!watermark)}>
            <Center w="34px" h="18px" borderRadius="full" px="1"
              bg={watermark ? C.primary : 'gray.300'} justify={watermark ? 'flex-end' : 'flex-start'}>
              <Box w="14px" h="14px" borderRadius="full" bg="#fff" />
            </Center>
            <Text fontSize="xs" color={C.body}>{watermark ? 'Activé' : 'Désactivé'}</Text>
          </HStack>
        </Field>
      </SimpleGrid>
    </Modal>
  )
}

function NumDot({ n, done }) {
  return (
    <Flex w="18px" h="18px" borderRadius="full"
      bg={done ? C.greenBg : C.softBlue} color={done ? C.greenText : C.primary}
      align="center" justify="center" fontSize="2xs" fontWeight="700" flexShrink={0}>
      {n}
    </Flex>
  )
}
