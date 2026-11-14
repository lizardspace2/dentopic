// Primitives UI partagées — tout motif visuel répété dans les pages vit ici.
// Palette : ../theme.js (objet C)
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Box, Button, Center, Flex, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { FiAlertTriangle, FiCheckCircle, FiHelpCircle, FiInfo, FiSearch, FiX } from 'react-icons/fi'
import { C } from '../theme'

// ---- Badges ----------------------------------------------------------------

export function Tag({ color = 'purple', children, ...rest }) {
  const map = {
    purple: ['#ede9fe', '#7c3aed'],
    teal: ['#d1fae5', '#059669'],
    amber: ['#fef3c7', '#d97706'],
    green: ['#dcfce7', '#16a34a'],
    blue: ['#dbeafe', '#2563eb'],
    gray: ['#f1f5f9', '#64748b'],
    red: ['#fee2e2', '#dc2626'],
  }
  const [bg, fg] = map[color] || map.gray
  return (
    <Text
      as="span"
      fontSize="2xs"
      fontWeight="600"
      px="1.5"
      py="0.5"
      borderRadius="md"
      bg={bg}
      color={fg}
      lineHeight="1"
      whiteSpace="nowrap"
      {...rest}
    >
      {children}
    </Text>
  )
}

// ---- Cartes & panneaux ------------------------------------------------------

export function Card({ children, onClick, _hover, ...rest }) {
  return (
    <Box
      bg="white" border="1px solid" borderColor={C.cardBorder} borderRadius="xl"
      boxShadow={C.cardShadow}
      transition="box-shadow .2s ease, transform .2s ease, border-color .2s ease"
      cursor={onClick ? 'pointer' : undefined}
      _hover={onClick ? { boxShadow: C.cardShadowHover, transform: 'translateY(-1px)', ..._hover } : _hover}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Box>
  )
}

export function EmptyPane({ children, ...rest }) {
  return (
    <Box border="1.5px dashed" borderColor="gray.300" borderRadius="xl" p="8" {...rest}>
      {children}
    </Box>
  )
}

export function SectionLabel({ children, ...rest }) {
  return (
    <Text fontSize="xs" fontWeight="600" letterSpacing="0.06em" color="gray.500" {...rest}>
      {children}
    </Text>
  )
}


// ---- En-têtes de page (motif répété sur toutes les pages) ---------------------

/** Carré arrondi coloré contenant une icône */
export function IconTile({ icon, bg = C.softBlue, color = C.primary, size = '34px', iconSize = '15px' }) {
  return (
    <Flex w={size} h={size} borderRadius="lg" bg={bg} color={color} align="center" justify="center" flexShrink={0}>
      <Box as={icon} fontSize={iconSize} />
    </Flex>
  )
}

/** Titre de page : icône optionnelle + titre + sous-titre + boutons à droite */
export function PageHeader({ icon, iconBg, iconColor, title, subtitle, children }) {
  return (
    <>
      <HStack justify="space-between" mb={subtitle ? '1' : '6'}>
        <HStack gap="3">
          {icon && <IconTile icon={icon} bg={iconBg} color={iconColor} />}
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="-0.02em" color={C.ink}>
            {title}
          </Text>
        </HStack>
        <HStack gap="2">{children}</HStack>
      </HStack>
      {subtitle && (
        <Text fontSize="sm" color="gray.500" mb="4">
          {subtitle}
        </Text>
      )}
    </>
  )
}

// ---- Boutons standards ---------------------------------------------------------

export function HelpButton({ active = false, ...rest }) {
  return (
    <Button variant="outline" size="sm" borderRadius="md"
      color={active ? C.primary : 'gray.600'} bg={active ? C.softBlue : 'transparent'}
      aria-pressed={active} {...rest}>
      <FiHelpCircle /> Aide
    </Button>
  )
}

export function PrimaryButton({ icon: I, children, ...rest }) {
  return (
    <Button size="sm" bg={C.primary} color="#ffffff" borderRadius="md" _hover={{ bg: C.primaryHover }} {...rest}>
      {I && <I />} {children}
    </Button>
  )
}

// ---- Champs ---------------------------------------------------------------------

/** Champ de recherche avec loupe (motif des pages listes) */
export function SearchInput({ placeholder, w, flex = 1, ...rest }) {
  return (
    <HStack
      w={w}
      flex={w ? '0 0 auto' : flex}
      bg="white"
      border="1px solid"
      borderColor={C.cardBorder}
      borderRadius="md"
      px="3"
      h="34px"
      gap="2"
    >
      <Box as={FiSearch} color="gray.400" fontSize="sm" />
      <Input variant="flushed" placeholder={placeholder} fontSize="sm" border="none" _focus={{ boxShadow: 'none' }} {...rest} />
    </HStack>
  )
}

/** <select> stylé façon DentoPic */
export function Select({ children, w = 'auto', h = '34px', ...rest }) {
  return (
    <Box
      as="select"
      w={w}
      h={h}
      px="3"
      fontSize="sm"
      border="1px solid"
      borderColor={C.cardBorder}
      borderRadius="md"
      bg="white"
      {...rest}
    >
      {children}
    </Box>
  )
}

/** Champ de formulaire avec label */
export function Field({ label, children, ...rest }) {
  return (
    <Box {...rest}>
      <Text fontSize="xs" fontWeight="500" color={C.ink} mb="1.5">
        {label}
      </Text>
      {children}
    </Box>
  )
}

// ---- Modal (popup centré, toutes les interactions restent sur la route) ---------

export function Modal({ open, onClose, title, subtitle, children, width = '480px', footer }) {
  useEffect(() => {
    if (!open) return
    const key = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])
  if (!open) return null
  return (
    <Box
      position="fixed" inset="0" zIndex="60" bg="blackAlpha.500"
      display="flex" alignItems="center" justifyContent="center" p="4"
      onClick={onClose}
    >
      <Box
        bg="white" borderRadius="xl" w="100%" maxW={width} maxH="85vh"
        overflowY="auto" boxShadow="xl"
        onClick={(e) => e.stopPropagation()}
      >
        <HStack px="5" pt="4" pb="3" justify="space-between" align="start">
          <Box>
            <Text fontSize="md" fontWeight="700" color={C.ink}>{title}</Text>
            {subtitle && <Text fontSize="xs" color="gray.500" mt="0.5">{subtitle}</Text>}
          </Box>
          <Box as="button" color="gray.400" fontSize="md" p="1" cursor="pointer" onClick={onClose} _hover={{ color: 'gray.600' }}>
            <FiX />
          </Box>
        </HStack>
        <Box px="5" pb="5">{children}</Box>
        {footer && (
          <HStack px="5" py="3" borderTop="1px solid" borderColor="gray.100" justify="space-between">
            {footer}
          </HStack>
        )}
      </Box>
    </Box>
  )
}

// ---- Confirmation de suppression (« Voulez-vous vraiment supprimer ? ») --------
// Toujours utiliser avant toute action destructive (corbeille, retrait, déconnexion).

export function ConfirmModal({
  open, onClose, onConfirm, busy,
  title = 'Confirmer la suppression',
  message = 'Voulez-vous vraiment supprimer cet élément ?',
  confirmLabel = 'Oui, supprimer',
  cancelLabel = 'Non',
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="420px"
      footer={<>
        <span />
        <HStack gap="2">
          <Button variant="outline" size="sm" onClick={onClose}>{cancelLabel}</Button>
          <PrimaryButton bg="red.500" _hover={{ bg: 'red.600' }} onClick={onConfirm} disabled={busy}>
            {busy ? 'Suppression…' : confirmLabel}
          </PrimaryButton>
        </HStack>
      </>}>
      <HStack gap="3" align="start">
        <Center w="36px" h="36px" borderRadius="full" bg="red.50" color="red.500" fontSize="md" flexShrink={0}>
          <FiAlertTriangle />
        </Center>
        <Text fontSize="sm" color={C.body}>{message}</Text>
      </HStack>
    </Modal>
  )
}

// ---- Saisie d'une valeur (remplace window.prompt) -----------------------------
// `onSubmit(value)` — renvoyer false pour garder la popup ouverte (validation).
// Le composant interne est remonté à chaque ouverture : defaultValue se réinitialise.

export function PromptModal({ open, ...rest }) {
  if (!open) return null
  return <PromptForm {...rest} />
}

function PromptForm({
  onClose, onSubmit, title, subtitle,
  label = 'Valeur', defaultValue = '', placeholder, hint,
  type = 'text', min, max, step,
  confirmLabel = 'Valider', cancelLabel = 'Annuler',
}) {
  const [value, setValue] = useState(String(defaultValue ?? ''))
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const v = value.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      const ok = await onSubmit?.(v)
      if (ok !== false) onClose()
    } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={title} subtitle={subtitle} width="420px"
      footer={<>
        <span />
        <HStack gap="2">
          <Button variant="outline" size="sm" onClick={onClose}>{cancelLabel}</Button>
          <PrimaryButton onClick={submit} disabled={busy || !value.trim()}>
            {busy ? '…' : confirmLabel}
          </PrimaryButton>
        </HStack>
      </>}>
      <Box as="form" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label={label}>
          <Input autoFocus type={type} min={min} max={max} step={step} value={value}
            placeholder={placeholder} onFocus={(e) => e.target.select()}
            onChange={(e) => setValue(e.target.value)} />
        </Field>
        {hint && <Text fontSize="2xs" color="gray.500" mt="1.5">{hint}</Text>}
      </Box>
    </Modal>
  )
}

// ---- Menu contextuel (bouton ⋯ des cartes) -------------------------------------
// À rendre dans un <Box position="relative"> qui contient aussi le bouton
// d'ouverture : le clic extérieur et Échap ferment le menu via `onClose`.
// S'ouvre vers le haut (les cartes sont en bas de page).

export function MenuDropdown({ open, onClose, children, minW = '200px' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const down = (e) => {
      const root = ref.current?.parentElement
      if (root && !root.contains(e.target)) onClose?.()
    }
    const key = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key) }
  }, [open, onClose])
  if (!open) return null
  return (
    <VStack ref={ref} position="absolute" bottom="100%" right="0" mb="1" align="stretch" gap="0"
      bg="white" border="1px solid" borderColor={C.cardBorder} borderRadius="md"
      minW={minW} py="1" boxShadow="lg" zIndex="20">
      {children}
    </VStack>
  )
}

export function MenuItem({ icon: I, label, danger, onClick }) {
  return (
    <HStack px="3" py="2" gap="2" fontSize="xs" cursor="pointer"
      color={danger ? 'red.500' : C.ink} _hover={{ bg: C.softBlue }}
      onClick={onClick}>
      <Box as={I} /> <Text>{label}</Text>
    </HStack>
  )
}

// ---- Notifications toast --------------------------------------------------------
// `toast('Fait.')` / `toast.success('…')` / `toast.error('…')` / `toast.info('…')`
// appelable depuis n'importe quel handler — pas de provider :
// <ToastHost/> est monté une fois dans AppShell et écoute le bus.

let toastSeq = 0
const toastBus = new Set()

export function toast(message, type = 'success') {
  const t = { id: ++toastSeq, message: String(message), type }
  toastBus.forEach((fn) => fn(t))
  return t.id
}
toast.success = (m) => toast(m, 'success')
toast.error = (m) => toast(m, 'error')
toast.info = (m) => toast(m, 'info')

const TOAST_TONE = {
  success: { icon: FiCheckCircle, color: 'green.500' },
  error: { icon: FiAlertTriangle, color: 'red.500' },
  info: { icon: FiInfo, color: C.primary },
}

export function ToastHost() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const push = (t) => {
      setItems((l) => [...l, t].slice(-4)) // 4 max — les plus anciens disparaissent
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== t.id)), 4000)
    }
    toastBus.add(push)
    return () => toastBus.delete(push)
  }, [])
  if (!items.length) return null
  return (
    <VStack position="fixed" bottom="5" right="5" zIndex="100" align="stretch" gap="2" pointerEvents="none">
      {items.map((t) => {
        const tone = TOAST_TONE[t.type] || TOAST_TONE.info
        return (
          <HStack key={t.id} pointerEvents="auto" cursor="pointer"
            bg="white" border="1px solid" borderColor={C.cardBorder}
            borderLeftWidth="3px" borderLeftColor={tone.color} borderRadius="md" boxShadow="lg"
            px="3" py="2.5" gap="2.5" minW="240px" maxW="360px"
            onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
            <Box as={tone.icon} color={tone.color} fontSize="sm" flexShrink={0} />
            <Text fontSize="xs" color={C.ink} flex="1">{t.message}</Text>
            <Box as={FiX} color="gray.400" fontSize="xs" flexShrink={0} />
          </HStack>
        )
      })}
    </VStack>
  )
}

// ---- Tooltip (hover) --------------------------------------------------------------
// Rendu en <body> via portal + position: fixed — jamais clippé par un parent
// (overflow:hidden / contexte d'empilement). Placement auto : à droite dans les
// rails étroits (toolbar), en bas près du bord haut, en haut sinon ; clampé au
// viewport. `place` = 'auto' | 'top' | 'bottom' | 'left' | 'right'.

export function Tip({ label, children, place = 'auto', tipW, ...rest }) {
  const [tip, setTip] = useState(null)
  if (!label) return <>{children}</>

  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vw = window.innerWidth
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const estW = tipW || Math.min(340, 16 + String(label).length * 6)

    let p = place
    if (p === 'auto') {
      if (r.left < 280 && r.right + 8 + estW < vw) p = 'right'
      else if (vw - r.right < 160) p = 'left'
      else if (r.top < 70) p = 'bottom'
      else p = 'top'
    }
    // Rebascule si la bulle sort de l'écran dans la direction choisie
    if (p === 'right' && r.right + 8 + estW > vw) p = 'left'
    if (p === 'left' && r.left - 8 - estW < 0) p = 'right'
    if (p === 'top' && r.top < 60) p = 'bottom'
    if (p === 'bottom' && r.bottom > window.innerHeight - 40) p = 'top'

    let style
    if (p === 'right') style = { left: r.right + 8, top: cy, transform: 'translateY(-50%)' }
    else if (p === 'left') style = { left: r.left - 8, top: cy, transform: 'translate(-100%, -50%)' }
    else {
      const x = Math.min(Math.max(cx, 8 + estW / 2), vw - 8 - estW / 2)
      style = p === 'bottom'
        ? { left: x, top: r.bottom + 8, transform: 'translateX(-50%)' }
        : { left: x, top: r.top - 8, transform: 'translate(-50%, -100%)' }
    }
    setTip({ style, long: tipW != null ? tipW >= 240 : estW >= 300 })
  }

  return (
    <Box
      className="dentip-parent" position="relative" display="inline-flex" {...rest}
      onMouseEnter={show} onMouseLeave={() => setTip(null)}
    >
      {children}
      {tip && createPortal(
        <Box
          className="dentip" position="fixed" {...tip.style}
          bg="#1f2937" color="#ffffff" fontSize="2xs" px="2" py="1"
          borderRadius="md" boxShadow="md" maxW={tipW ? `${tipW}px` : '320px'}
          whiteSpace={tip.long ? 'normal' : 'nowrap'} textAlign="left"
          pointerEvents="none" zIndex="9999"
        >
          {label}
        </Box>,
        document.body,
      )}
    </Box>
  )
}

// ---- Helpers ---------------------------------------------------------------------

/** "il y a X min / h / jour(s)" */
export function ago(d) {
  if (!d) return ''
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 3600) return `il y a ${Math.max(1, Math.floor(s / 60))} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} heure(s)`
  return `il y a ${Math.floor(s / 86400)} jour(s)`
}

/** Nom de test E2E/QA généré par les données de démo */
export const isTestName = (name = '') => /E2E|test|QRAUTO|QRA/i.test(name)
