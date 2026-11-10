import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Center, Flex, HStack, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import {
  FiBell, FiPlus, FiZap, FiShare2, FiEdit3,
  FiChevronLeft, FiChevronRight, FiCalendar, FiCheck, FiSend,
  FiImage, FiLayers, FiVideo, FiTrash2,
  FiClock, FiAlertCircle,
} from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi2'
import {
  Card, PageHeader, HelpButton, PrimaryButton, Modal, Select, Field,
  Tip, Tag, ago, ConfirmModal, toast,
} from '../components/ui'
import { C } from '../theme'
import PhotoImg from '../components/PhotoImg'
import SocialIcon from '../components/SocialIcon'
import { useApp } from '../context/AppContext'
import {
  listSocialAccounts, connectSocialAccount, disconnectSocialAccount,
  listSocialPosts, createSocialPost, updateSocialPost, deleteSocialPost, getSocialPost,
  publishDuePosts, getWorkspaceSettings, saveWorkspaceSetting,
  listPhotos, listMontages, listVideoProjects, listDossiers, getPatient,
  socialOAuthStart, socialSyncAccounts, socialDisconnectAccount,
} from '../api'

// ---- Calendrier ---------------------------------------------------------------
const DAYS_FR = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const DAYS_SHORT = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const pad2 = (n) => String(n).padStart(2, '0')
const toLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const fmtTime = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
// Prochaine occurrence d'un créneau {day:0-6 (lun-dim), time:'HH:mm'}
const nextSlotDate = (s) => {
  const [h, m] = (s.time || '09:00').split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  let diff = ((s.day ?? 0) - ((d.getDay() + 6) % 7) + 7) % 7
  if (diff === 0 && d <= new Date()) diff = 7
  d.setDate(d.getDate() + diff)
  return d
}

// Journées santé/dentaire — dates fixes annuelles + sourire (1er vendredi d'octobre)
const HEALTH_DAYS = [
  [2, 4, 'Journée mondiale contre le cancer'],
  [3, 20, 'Journée mondiale de la santé bucco-dentaire'],
  [4, 7, 'Journée mondiale de la santé'],
  [5, 12, 'Journée internationale des infirmières'],
  [5, 31, 'Journée mondiale sans tabac'],
  [10, 10, 'Journée mondiale de la santé mentale'],
  [11, 14, 'Journée mondiale du diabète'],
]
function upcomingEvents(n = 3) {
  const now = new Date()
  const out = []
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    for (const [m, d, t] of HEALTH_DAYS) out.push({ date: new Date(y, m - 1, d), label: t })
    const o = new Date(y, 9, 1)
    o.setDate(1 + ((5 - o.getDay() + 7) % 7))
    out.push({ date: o, label: 'Journée mondiale du sourire' })
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return out.filter((e) => e.date >= start).sort((a, b) => a.date - b.date).slice(0, n)
}

const STATUS_META = {
  draft: { color: 'gray', label: 'Brouillon' },
  scheduled: { color: 'blue', label: 'Programmé' },
  published: { color: 'green', label: 'Publié' },
  failed: { color: 'red', label: 'Échec' },
}

const PROVIDERS = [
  { id: 'instagram', label: 'Instagram', color: '#d62976' },
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  { id: 'tiktok', label: 'TikTok', color: '#000000' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2' },
  { id: 'youtube', label: 'YouTube', color: '#ff0000' },
  { id: 'pinterest', label: 'Pinterest', color: '#e60023' },
  { id: 'x', label: 'X (Twitter)', color: '#000000' },
  { id: 'threads', label: 'Threads', color: '#000000' },
  { id: 'google_business', label: 'Google Business', color: '#4285f4' },
]
const providerOf = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0]

const KINDS = [
  ['publication', 'Publication'],
  ['story', 'Story'],
  ['reel', 'Reel'],
]

export default function Publication() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const location = useLocation()
  const navigate = useNavigate()
  const [view, setView] = useState('week')
  const [tab, setTab] = useState('moments')
  const [accounts, setAccounts] = useState([])
  const [posts, setPosts] = useState([])
  const [slots, setSlots] = useState([])
  const [notify, setNotify] = useState(false)
  const [cursor, setCursor] = useState(() => new Date())
  const [kindFilter, setKindFilter] = useState('all')
  const [modal, setModal] = useState(null) // 'connect' | 'draft'
  const [editPost, setEditPost] = useState(null)
  const [prefill, setPrefill] = useState(null) // Date pré-remplie (clic « + » sur un jour)

  const reload = async () => {
    if (!wsId) return
    const [accs, settings] = await Promise.all([listSocialAccounts(wsId), getWorkspaceSettings(wsId)])
    const pub = await publishDuePosts(wsId)
    const ps = await listSocialPosts(wsId)
    setAccounts(accs)
    setPosts(ps)
    setSlots(settings.social_schedule || [])
    setNotify(settings.social_notify === true)
    if (settings.social_notify && (pub.published || pub.failed)) {
      if (pub.published) toast.success(`${pub.published} publication(s) publiée(s).`)
      if (pub.failed) toast.error(`${pub.failed} publication(s) en échec.`)
    }
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line
  // Retour de l'OAuth Meta (?meta_connected=1&n=2 posé par social-oauth-callback)
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const ok = q.get('meta_connected')
    if (!ok) return
    const n = +(q.get('n') || 0)
    if (ok === '1') toast.success(`${n} compte(s) connecté(s) via Facebook.`)
    else toast.error('La connexion Facebook a échoué ou a été annulée.')
    navigate('/publication', { replace: true })
  }, [location.search]) // eslint-disable-line
  useEffect(() => {
    if (!wsId) return
    const t = setInterval(reload, 60000)
    return () => clearInterval(t)
  }, [wsId]) // eslint-disable-line

  const drafts = posts.filter((p) => p.status === 'draft')
  const scheduled = posts.filter((p) => p.status === 'scheduled')

  const steps = [
    { label: 'Connectez un réseau social (Instagram, Facebook…).', done: accounts.length > 0 },
    { label: 'Préparez votre brouillon dès maintenant — média, légende et patient sont conservés même sans connexion.', done: drafts.length > 0 || scheduled.length > 0 },
    { label: 'Une fois le réseau connecté, rattachez-le au brouillon puis programmez la publication.', done: scheduled.length > 0 },
  ]

  const openDraft = (post = null, date = null) => {
    setEditPost(post); setPrefill(date); setModal('draft')
  }

  const toggleNotify = async () => {
    const v = !notify
    setNotify(v)
    await saveWorkspaceSetting(wsId, 'social_notify', v)
  }

  // ---- données du calendrier ----
  const kindOk = (p) => kindFilter === 'all' || (p.kind || 'publication') === kindFilter
  const postsOn = (day) => posts.filter((p) =>
    kindOk(p) && p.scheduled_at && sameDay(new Date(p.scheduled_at), day))
  const unscheduled = posts.filter((p) => kindOk(p) && !p.scheduled_at && p.status !== 'published')
  const shift = (dir) => setCursor((c) =>
    view === 'week' ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1))
  const mon = monday(cursor)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const monthWeeks = (() => {
    const start = monday(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  })()
  const calTitle = view === 'week'
    ? `Semaine du ${mon.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
    : cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const events = upcomingEvents(3)

  return (
    <Box w="100%" px="6" py="6">
      <PageHeader
        icon={FiCalendar} iconBg={C.greenBg} iconColor={C.greenText}
        title="Programmation"
        subtitle="Planifiez vos publications sur les réseaux sociaux."
      >
        <HelpButton />
        <Tip label={notify ? 'Notifications activées — cliquer pour désactiver' : 'Recevoir une alerte quand une publication est publiée ou échoue'}>
          <Button variant={notify ? 'solid' : 'outline'} size="sm" borderRadius="md"
            color={notify ? '#ffffff' : 'gray.600'} bg={notify ? C.primary : 'transparent'}
            onClick={toggleNotify}>
            <FiBell /> Notifications {notify ? 'on' : 'off'}
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

      {!steps.every((s) => s.done) && (
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
      )}

      <HStack gap="4" alignItems="start">
        <Box flex="1">
          <HStack mb="4" gap="2">
            <HStack gap="0">
              <Button size="xs" bg={view === 'week' ? C.primary : 'white'} color={view === 'week' ? '#ffffff' : 'gray.600'} border="1px solid" borderColor={C.cardBorder} borderRadius="md 0 0 md" onClick={() => setView('week')}>Semaine</Button>
              <Button size="xs" bg={view === 'month' ? C.primary : 'white'} color={view === 'month' ? '#ffffff' : 'gray.600'} border="1px solid" borderColor={C.cardBorder} borderRadius="0" onClick={() => setView('month')}>Calendrier</Button>
            </HStack>
            <Button variant="ghost" size="xs" px="1" onClick={() => shift(-1)} aria-label="Période précédente"><FiChevronLeft /></Button>
            <Button variant="outline" size="xs" onClick={() => setCursor(new Date())}>Aujourd'hui</Button>
            <Button variant="ghost" size="xs" px="1" onClick={() => shift(1)} aria-label="Période suivante"><FiChevronRight /></Button>
            <Text fontSize="lg" fontWeight="700" color={C.ink} flex="1" textAlign="center">{calTitle}</Text>
            <Select h="30px" w="auto" px="3" fontSize="xs" borderRadius="full" value={kindFilter} aria-label="Filtrer par type de contenu"
              onChange={(e) => setKindFilter(e.target.value)}>
              <option value="all">Type : Tous</option>
              {KINDS.map(([k, l]) => <option key={k} value={k}>Type : {l}</option>)}
            </Select>
          </HStack>

          {view === 'week' ? (
          <SimpleGrid columns={8} gap="0" border="1px solid" borderColor={C.cardBorder} borderRadius="lg" overflow="hidden">
            <Box borderRight="1px solid" borderColor={C.cardBorder} p="1.5" minH="220px" bg="gray.50">
              <Text fontSize="2xs" fontWeight="700" color="gray.500" mb="1">FILE</Text>
              <VStack align="stretch" gap="1" maxH="190px" overflowY="auto" mb="1">
                {unscheduled.map((p) => <PostChip key={p.id} p={p} onClick={() => openDraft(p)} />)}
                {!unscheduled.length && (
                  <Text fontSize="2xs" color="gray.400" textAlign="center" py="2">Aucun brouillon sans date.</Text>
                )}
              </VStack>
              <Button size="xs" variant="outline" w="100%" onClick={() => openDraft()}>Créer +</Button>
            </Box>
            {weekDays.map((day, i) => {
              const today = sameDay(day, new Date())
              return (
                <Box key={i} bg={today ? C.softBlue : 'white'}
                  borderRight={i < 6 ? '1px solid' : 'none'} borderColor="gray.100"
                  p="1.5" minH="220px">
                  <HStack justify="space-between" mb="1">
                    <Text fontSize="2xs" fontWeight={today ? '700' : '500'}
                      color={today ? C.primary : 'gray.500'}>
                      {DAYS_FR[i]} {day.getDate()}
                    </Text>
                    <Tip label="Créer un brouillon pour ce jour">
                      <Box as="button" fontSize="xs" color="gray.300" cursor="pointer"
                        _hover={{ color: C.primary }} aria-label={`Créer le ${DAYS_FR[i]} ${day.getDate()}`}
                        onClick={() => { const d = new Date(day); d.setHours(9, 0, 0, 0); openDraft(null, d) }}>+</Box>
                    </Tip>
                  </HStack>
                  {postsOn(day).map((p) => <PostChip key={p.id} p={p} onClick={() => openDraft(p)} />)}
                </Box>
              )
            })}
          </SimpleGrid>
          ) : (
          <Box border="1px solid" borderColor={C.cardBorder} borderRadius="lg" overflow="hidden">
            <SimpleGrid columns={7} gap="0" bg="gray.50">
              {DAYS_FR.map((d) => (
                <Text key={d} fontSize="2xs" fontWeight="700" color="gray.500"
                  px="2" py="1" borderBottom="1px solid" borderColor="gray.100">{d}</Text>
              ))}
            </SimpleGrid>
            {monthWeeks.map((week, w) => (
              <SimpleGrid key={w} columns={7} gap="0">
                {week.map((day, d) => {
                  const inMonth = day.getMonth() === cursor.getMonth()
                  const today = sameDay(day, new Date())
                  return (
                    <Box key={d} minH="92px" p="1" borderTop="1px solid" borderColor="gray.100"
                      borderRight={d < 6 ? '1px solid' : 'none'}
                      bg={today ? C.softBlue : 'white'} opacity={inMonth ? 1 : 0.45}>
                      <HStack justify="space-between">
                        <Text fontSize="2xs" fontWeight={today ? '700' : '400'}
                          color={today ? C.primary : 'gray.500'}>{day.getDate()}</Text>
                        <Box as="button" fontSize="2xs" color="gray.300" cursor="pointer"
                          _hover={{ color: C.primary }} aria-label={`Créer le ${day.getDate()}`}
                          onClick={() => { const x = new Date(day); x.setHours(9, 0, 0, 0); openDraft(null, x) }}>+</Box>
                      </HStack>
                      {postsOn(day).slice(0, 3).map((p) => <PostChip key={p.id} p={p} compact onClick={() => openDraft(p)} />)}
                      {postsOn(day).length > 3 && (
                        <Text fontSize="2xs" color="gray.400">+{postsOn(day).length - 3}</Text>
                      )}
                    </Box>
                  )
                })}
              </SimpleGrid>
            ))}
          </Box>
          )}
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
              wsId={wsId} onEdit={openDraft} onReload={reload} />
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
              <Text fontSize="2xs" color="gray.500" mb="2">Créneaux de publication par défaut (Réglages → Réseaux sociaux).</Text>
              {slots.length ? (
                <VStack align="stretch" gap="1" mb="3">
                  {slots.slice(0, 5).map((s) => (
                    <HStack key={`${s.day}-${s.time}`} bg={C.softBlue} borderRadius="md" px="2" py="1" gap="2">
                      <Box as={FiClock} color={C.primary} fontSize="2xs" />
                      <Text fontSize="2xs" color={C.body}>{['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][s.day]} · {s.time}</Text>
                    </HStack>
                  ))}
                </VStack>
              ) : (
                <Text fontSize="2xs" color="gray.400" mb="3">Aucun créneau défini — ajoutez-en dans Réglages → Réseaux sociaux.</Text>
              )}
              <Text fontSize="xs" fontWeight="600" color={C.ink} mb="2">Événements à venir</Text>
              <VStack align="stretch" gap="2">
                {events.map((e) => (
                  <HStack key={e.label} bg={C.softBlue} borderRadius="md" px="2" py="1.5" gap="2">
                    <Text fontSize="2xs" color={C.primary} fontWeight="600" whiteSpace="nowrap">
                      {e.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text fontSize="2xs" color={C.body} isTruncated flex="1">{e.label}</Text>
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
      <DraftModal open={modal === 'draft'} onClose={() => { setModal(null); setEditPost(null); setPrefill(null) }}
        wsId={wsId} accounts={accounts} post={editPost} prefill={prefill} slots={slots} onDone={reload} />
    </Box>
  )
}

// ---- Onglet brouillons : posts réels -------------------------------------------

function DraftsPane({ drafts, accounts, wsId, onEdit, onReload }) {
  const [busy, setBusy] = useState(false)
  const [rmPost, setRmPost] = useState(null)
  if (!drafts.length) {
    return (
      <VStack py="4" gap="2" align="center">
        <Text fontSize="2xs" color="gray.400" textAlign="center">
          Aucun brouillon — cliquez « Préparer un brouillon » pour en créer un.
        </Text>
      </VStack>
    )
  }
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
                  <Tag color={STATUS_META[p.status]?.color || 'gray'}>
                    {STATUS_META[p.status]?.label || p.status}
                  </Tag>
                  {p.kind && <Tag color="purple">{p.kind}</Tag>}
                  {prov && <SocialIcon provider={p.account.provider} size={12} />}
                </HStack>
                <Text fontSize="2xs" color={C.body} isTruncated>{p.caption || '(sans légende)'}</Text>
                <Text fontSize="2xs" color="gray.400">
                  {p.scheduled_at
                    ? `📅 ${new Date(p.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    : ago(p.created_at)}
                  {p.patient ? ` · ${[p.patient.first_name, p.patient.last_name].filter(Boolean).join(' ')}` : ''}
                </Text>
              </Box>
              <VStack gap="0" align="center">
              <Tip label="Publier maintenant">
                <Box as="button" aria-label="Publier maintenant" color="gray.400" p="1"
                  cursor={busy ? 'wait' : 'pointer'} _hover={{ color: C.primary }}
                  onClick={async (e) => {
                    e.stopPropagation()
                    setBusy(true)
                    await updateSocialPost(p.id, { status: 'scheduled', scheduled_at: new Date().toISOString() })
                    await publishDuePosts(wsId)
                    setBusy(false); onReload()
                  }}>
                  <FiSend />
                </Box>
              </Tip>
              <Tip label="Supprimer ce brouillon">
                <Box as="button" aria-label="Supprimer le brouillon" color="gray.400" p="1"
                  cursor={busy ? 'wait' : 'pointer'} _hover={{ color: 'red.500' }}
                  onClick={(e) => { e.stopPropagation(); setRmPost(p.id) }}>
                  <FiTrash2 />
                </Box>
              </Tip>
              </VStack>
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
  const [oauthMsg, setOauthMsg] = useState('')

  // OAuth réel via l'Edge Function (Meta natif ou page hébergée agrégateur).
  const connectOAuth = async (prov) => {
    setBusy(true); setOauthMsg('')
    const r = await socialOAuthStart(wsId, prov)
    setBusy(false)
    if (r.url) window.open(r.url, '_blank', 'width=980,height=720')
    else setOauthMsg(r.error || 'OAuth non configuré côté serveur — le mode manuel ci-dessous reste disponible.')
  }
  const syncAgg = async () => {
    setBusy(true)
    const r = await socialSyncAccounts(wsId)
    setBusy(false)
    if (r.synced !== undefined) { onDone(); setOauthMsg(`${r.synced} compte(s) synchronisé(s).`) }
    else setOauthMsg(r.error || 'Agrégateur non configuré côté serveur.')
  }

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
    // Révocation côté serveur si la function est déployée, sinon suppression locale.
    if (!(await socialDisconnectAccount(rmAcc))) await disconnectSocialAccount(rmAcc)
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
                <Center w="30px" h="30px" borderRadius="md" bg="gray.100" fontSize="sm">
                  <SocialIcon provider={a.provider} size={15} />
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
      <VStack align="stretch" gap="2" mb="4" p="3" bg={C.softBlue}
        border="1px solid" borderColor={C.softBlueBorder} borderRadius="md">
        <Text fontSize="xs" fontWeight="700" color={C.ink}>Connexion automatique (recommandé)</Text>
        <HStack gap="2" flexWrap="wrap">
          <Button size="sm" variant="outline" onClick={() => connectOAuth('facebook')} disabled={busy}>
            <SocialIcon provider="facebook" size={13} /> via Facebook
          </Button>
          <Button size="sm" variant="outline" onClick={() => connectOAuth('aggregator')} disabled={busy}>
            <FiShare2 /> via l'agrégateur
          </Button>
          <Button size="xs" variant="ghost" onClick={syncAgg} disabled={busy} aria-label="Synchroniser les comptes agrégateur">
            <FiClock /> Sync
          </Button>
        </HStack>
        {oauthMsg && <Text fontSize="2xs" color="orange.700">{oauthMsg}</Text>}
        <Text fontSize="2xs" color="gray.500">
          Le flux Facebook ramène vos Pages et le compte Instagram Pro associé en une seule autorisation.
        </Text>
      </VStack>

      <Field label="Réseau" mb="3">
        <HStack gap="2">
          {PROVIDERS.map((p) => (
            <Box key={p.id} as="button" px="3" py="2" borderRadius="md" cursor="pointer"
              border="1.5px solid" fontSize="xs" fontWeight={provider === p.id ? '600' : '400'}
              borderColor={provider === p.id ? p.color : C.cardBorder}
              color={provider === p.id ? p.color : 'gray.600'}
              display="inline-flex" alignItems="center" gap="6px"
              onClick={() => setProvider(p.id)}>
              <SocialIcon provider={p.id} size={13} />{p.label}
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

function DraftModal({ open, onClose, wsId, accounts, post, prefill, slots, onDone }) {
  const [kind, setKind] = useState('publication')
  const [mediaTab, setMediaTab] = useState('photos')
  const [mediaId, setMediaId] = useState(null)
  const [caption, setCaption] = useState('')
  const [dossierId, setDossierId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [schedule, setSchedule] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
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
      setShowSchedule(!!post.scheduled_at)
      setWatermark(post.watermark_enabled !== false)
      setDossierId('')
      setMediaId(post.photo_id || post.montage_id || post.video_id)
      setMediaTab(post.photo_id ? 'photos' : post.montage_id ? 'montages' : 'videos')
    } else {
      setKind('publication'); setCaption(''); setAccountId(accounts[0]?.id || '')
      setSchedule(prefill ? toLocal(prefill) : ''); setShowSchedule(!!prefill); setWatermark(true)
      setDossierId(''); setMediaId(null); setMediaTab('photos')
    }
  }, [open, post, prefill]) // eslint-disable-line

  // mode : 'now' (envoi immédiat, défaut) | 'schedule' (programmé) | 'draft'
  const submit = async (mode) => {
    if (!mediaId || (mode === 'schedule' && !schedule)) return
    setBusy(true)
    let patientId = null
    if (dossierId) patientId = (await getPatient(dossierId))?.id || null
    const fields = {
      kind, caption: caption.trim() || null,
      account_id: accountId || null,
      scheduled_at: mode === 'now' ? new Date().toISOString()
        : mode === 'schedule' ? new Date(schedule).toISOString() : null,
      watermark_enabled: watermark,
      patient_id: patientId,
      photo_id: mediaTab === 'photos' ? mediaId : null,
      montage_id: mediaTab === 'montages' ? mediaId : null,
      video_id: mediaTab === 'videos' ? mediaId : null,
      status: mode === 'draft' ? 'draft' : 'scheduled',
    }
    const res = post
      ? await updateSocialPost(post.id, fields)
      : await createSocialPost(wsId, fields)
    if (mode === 'now' && res?.id) {
      await publishDuePosts(wsId)
      const final = await getSocialPost(res.id)
      if (final?.status === 'published') toast.success('Publication envoyée !')
      else if (final?.status === 'failed') toast.error("L'envoi a échoué — vérifiez la connexion du réseau.")
    }
    setBusy(false); onDone(); onClose()
  }

  const pool = mediaTab === 'photos' ? photos : mediaTab === 'montages' ? montages : videos

  return (
    <Modal open={open} onClose={onClose}
      title={post ? 'Modifier la publication' : 'Nouvelle publication'}
      subtitle="Choisissez un média, écrivez la légende — c'est publié en un clic"
      width="620px"
      footer={<>
        <Text fontSize="2xs" color="gray.400">
          {showSchedule
            ? schedule
              ? `Sera publié le ${new Date(schedule).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'Choisissez une date de publication'
            : accountId
              ? 'Sera publié immédiatement'
              : 'Sera conservé en brouillon — choisissez un réseau pour publier'}
        </Text>
        <HStack gap="2">
          {(showSchedule || accountId) && (
            <Button variant="ghost" size="sm" color="gray.500" onClick={() => submit('draft')} disabled={busy}>
              Brouillon
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <PrimaryButton
            icon={showSchedule ? FiClock : accountId ? FiSend : FiEdit3}
            onClick={() => submit(showSchedule ? 'schedule' : accountId ? 'now' : 'draft')}
            disabled={!mediaId || busy || (showSchedule && !schedule)}>
            {busy ? 'Envoi…' : showSchedule ? 'Programmer' : accountId ? 'Publier maintenant' : 'Enregistrer le brouillon'}
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

      <HStack justify="space-between" align="center">
        <HStack gap="2" cursor="pointer" onClick={() => setWatermark(!watermark)}>
          <Center w="34px" h="18px" borderRadius="full" px="1"
            bg={watermark ? C.primary : 'gray.300'} justify={watermark ? 'flex-end' : 'flex-start'}>
            <Box w="14px" h="14px" borderRadius="full" bg="#fff" />
          </Center>
          <Text fontSize="xs" color={C.body}>Filigrane DentoPic {watermark ? 'activé' : 'désactivé'}</Text>
        </HStack>
        {!showSchedule && (
          <Box as="button" fontSize="xs" fontWeight="600" color={C.primary} cursor="pointer"
            display="inline-flex" alignItems="center" gap="4px"
            onClick={() => setShowSchedule(true)}>
            <FiClock /> Programmer pour plus tard
          </Box>
        )}
      </HStack>
      {showSchedule && (
        <Box mt="2">
          <HStack gap="2">
            <Input type="datetime-local" fontSize="sm" value={schedule} flex="1"
              onChange={(e) => setSchedule(e.target.value)} />
            <Button size="sm" variant="ghost" color="gray.500" flexShrink={0}
              onClick={() => { setShowSchedule(false); setSchedule('') }}>
              Publier maintenant
            </Button>
          </HStack>
          {slots?.length > 0 && (
            <HStack gap="1" flexWrap="wrap" mt="1.5">
              {slots.map((s) => (
                <Box key={`${s.day}-${s.time}`} as="button" fontSize="2xs" px="2" py="0.5"
                  borderRadius="md" border="1px solid" borderColor={C.cardBorder} color="gray.600"
                  _hover={{ borderColor: C.primary, color: C.primary }}
                  onClick={() => setSchedule(toLocal(nextSlotDate(s)))}>
                  {DAYS_SHORT[s.day]} {s.time}
                </Box>
              ))}
            </HStack>
          )}
        </Box>
      )}
    </Modal>
  )
}

// Pastille d'une publication sur le calendrier — clic = ouvrir le brouillon.
function PostChip({ p, compact, onClick }) {
  const meta = STATUS_META[p.status] || STATUS_META.draft
  const prov = p.account && providerOf(p.account.provider)
  const time = p.scheduled_at ? fmtTime(new Date(p.scheduled_at)) : null
  return (
    <Box mb="1" px="1.5" py="1" borderRadius="sm" bg="white" cursor="pointer"
      border="1px solid" borderColor="gray.100" borderLeft="3px solid"
      borderLeftColor={prov?.color || 'gray.300'} _hover={{ borderColor: 'blue.300' }}
      onClick={onClick} title={p.caption || ''}>
      <HStack gap="1" mb={compact ? 0 : '0.5'}>
        {prov && <SocialIcon provider={p.account.provider} size={10} />}
        <Tag color={meta.color}>{meta.label}{time && p.status === 'scheduled' ? ` ${time}` : ''}</Tag>
      </HStack>
      {!compact && <Text fontSize="2xs" color={C.body} isTruncated>{p.caption || '(sans légende)'}</Text>}
    </Box>
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
