// Diaporama plein écran — façon « Présenter » de Canva / visionneuse SmileCloud.
// Navigation flèches + clavier (← →, Échap, Début, Fin), compteur, barre de
// progression. Reçoit les diapos déjà chargées (join photo/montage).
import { useEffect, useState } from 'react'
import { Box, Center, HStack, Text, VStack } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight, FiImage, FiLayers, FiType, FiVideo, FiX } from 'react-icons/fi'
import { usePhotoUrl } from '../media'

const BG = '#0b1120'

function SlideMedia({ storagePath }) {
  const url = usePhotoUrl(storagePath)
  if (!url) {
    return <Center h="55vh" color="#334155"><Box as={FiImage} fontSize="4xl" /></Center>
  }
  return (
    <Box as="img" src={url} maxW="100%" maxH="70vh" objectFit="contain"
      borderRadius="lg" boxShadow="0 12px 48px rgba(0,0,0,0.55)" draggable={false} />
  )
}

function SlideBody({ s }) {
  if (s.type === 'text') {
    return (
      <VStack gap="4" maxW="760px" textAlign="center" px="6">
        <Text fontSize={{ base: '2xl', md: '4xl' }} fontWeight="700" color="#f1f5f9" lineHeight="1.2">
          {s.title || 'Diapositive'}
        </Text>
        {s.text_content && (
          <Text fontSize={{ base: 'sm', md: 'lg' }} color="#94a3b8" whiteSpace="pre-line" lineHeight="1.7">
            {s.text_content}
          </Text>
        )}
      </VStack>
    )
  }
  const path = s.photo?.storage_path || s.montage?.export_url
  if (s.type === 'video' && s.media_url) {
    return <Box as="video" src={s.media_url} controls maxW="100%" maxH="70vh" borderRadius="lg" />
  }
  if (!path) {
    return (
      <Center h="55vh" flexDirection="column" gap="3" color="#475569">
        <Box as={s.type === 'video' ? FiVideo : s.type === 'montage' ? FiLayers : FiType} fontSize="4xl" />
        <Text fontSize="sm">Élément à ajouter à cette diapositive</Text>
      </Center>
    )
  }
  return <SlideMedia storagePath={path} />
}

export default function PresentMode({ slides, title, onClose }) {
  const [idx, setIdx] = useState(0)
  const n = slides.length
  const cur = slides[idx] || null

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') setIdx((i) => Math.min(n - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      else if (e.key === 'Home') setIdx(0)
      else if (e.key === 'End') setIdx(n - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [n, onClose])

  const nav = (d, e) => { e?.stopPropagation(); setIdx((i) => Math.min(n - 1, Math.max(0, i + d))) }
  const NavBtn = ({ d, I, label }) => (
    <Center as="button" aria-label={label} w="44px" h="44px" borderRadius="full"
      bg="rgba(255,255,255,0.08)" color="#e2e8f0" cursor="pointer" flexShrink={0}
      _hover={{ bg: 'rgba(255,255,255,0.2)' }}
      opacity={(d < 0 ? idx === 0 : idx === n - 1) ? 0.3 : 1}
      onClick={(e) => nav(d, e)}>
      <Box as={I} fontSize="lg" />
    </Center>
  )

  return (
    <Box position="fixed" inset="0" zIndex="95" bg={BG} display="flex" flexDirection="column"
      role="dialog" aria-label="Mode présentation">
      {/* barre du haut : nom + compteur + fermer */}
      <HStack px="5" h="48px" flexShrink={0} justify="space-between">
        <Text fontSize="sm" fontWeight="600" color="#94a3b8" isTruncated>{title}</Text>
        <HStack gap="3">
          <Text fontSize="xs" color="#64748b" fontVariantNumeric="tabular-nums">{idx + 1} / {n}</Text>
          <Center as="button" aria-label="Quitter la présentation" w="32px" h="32px"
            borderRadius="full" bg="rgba(255,255,255,0.08)" color="#e2e8f0" cursor="pointer"
            _hover={{ bg: 'rgba(255,255,255,0.2)' }} onClick={onClose}>
            <FiX />
          </Center>
        </HStack>
      </HStack>
      {/* diapositive centrée + flèches latérales */}
      <HStack flex="1" minH="0" px="4" gap="2" align="center">
        <NavBtn d={-1} I={FiChevronLeft} label="Diapositive précédente" />
        <Center flex="1" minH="0" flexDirection="column" gap="3">
          {cur && <SlideBody s={cur} />}
          {cur?.type !== 'text' && cur?.title && (
            <Text fontSize="sm" color="#cbd5e1" fontWeight="500">{cur.title}</Text>
          )}
        </Center>
        <NavBtn d={1} I={FiChevronRight} label="Diapositive suivante" />
      </HStack>
      {/* barre de progression */}
      <Box h="3px" bg="rgba(255,255,255,0.08)" flexShrink={0}>
        <Box h="100%" bg="#3b82f6" w={`${n ? ((idx + 1) / n) * 100 : 0}%`} transition="width .25s" />
      </Box>
    </Box>
  )
}
