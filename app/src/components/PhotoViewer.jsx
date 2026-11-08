// Visionneuse photo en plein écran — façon « Photos » Windows :
// clic sur une photo = aperçu en grand, Échap/clic dehors = fermer,
// flèches ← → = photo précédente / suivante.
import { useEffect } from 'react'
import { Box, Button, Center, HStack, Image, Text } from '@chakra-ui/react'
import { FiX, FiChevronLeft, FiChevronRight, FiExternalLink } from 'react-icons/fi'
import { usePhotoUrl } from '../media'

export default function PhotoViewer({ photo, onClose, onStudio, onPrev, onNext, counter }) {
  const url = usePhotoUrl(photo?.edited_path || photo?.storage_path)

  useEffect(() => {
    if (!photo) return
    const key = (e) => {
      if (e.key === 'Escape') onClose?.()
      else if (e.key === 'ArrowLeft') onPrev?.()
      else if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [photo, onClose, onPrev, onNext])

  if (!photo) return null

  const meta = [
    (photo.mime || '').replace('image/', '').toUpperCase() || null,
    photo.width && photo.height ? `${photo.width} × ${photo.height} px` : null,
    photo.bytes ? `${(photo.bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko` : null,
    new Date(photo.taken_at || photo.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
  ].filter(Boolean).join(' · ')

  const navBtn = (icon, onClick, side) => onClick && (
    <Box as="button" position="absolute" top="50%" transform="translateY(-50%)" {...side}
      w="44px" h="44px" borderRadius="full" display="flex" alignItems="center" justifyContent="center"
      bg="blackAlpha.500" color="white" fontSize="xl" cursor="pointer" zIndex="2"
      _hover={{ bg: 'blackAlpha.700' }}
      onClick={(e) => { e.stopPropagation(); onClick() }}>
      <Box as={icon} />
    </Box>
  )

  return (
    <Box position="fixed" inset="0" zIndex="70" bg="blackAlpha.800"
      display="flex" flexDirection="column" onClick={onClose}>
      {/* barre supérieure : nom + fermer */}
      <HStack px="5" py="3" justify="space-between" flexShrink={0}>
        <HStack gap="3" minW="0">
          <Text color="white" fontSize="sm" fontWeight="600" isTruncated>
            {photo.original_filename || 'Photo'}
          </Text>
          {counter && <Text color="whiteAlpha.700" fontSize="xs" flexShrink={0}>{counter}</Text>}
        </HStack>
        <Box as="button" color="whiteAlpha.800" p="1.5" borderRadius="md" cursor="pointer"
          _hover={{ bg: 'whiteAlpha.200' }} onClick={onClose} aria-label="Fermer">
          <FiX size={20} />
        </Box>
      </HStack>

      {/* image centrée */}
      <Box flex="1" position="relative" display="flex" alignItems="center" justifyContent="center"
        px="60px" pb="2" minH="0">
        {navBtn(FiChevronLeft, onPrev, { left: '12px' })}
        {url ? (
          <Image src={url} alt={photo.original_filename || 'Photo'}
            maxW="100%" maxH="100%" objectFit="contain" borderRadius="md" draggable={false} />
        ) : (
          <Center color="whiteAlpha.600" fontSize="sm">Chargement…</Center>
        )}
        {navBtn(FiChevronRight, onNext, { right: '12px' })}
      </Box>

      {/* barre inférieure : métadonnées + action Studio */}
      <HStack px="5" py="3" justify="space-between" flexShrink={0} gap="4"
        onClick={(e) => e.stopPropagation()}>
        <Text color="whiteAlpha.700" fontSize="xs" isTruncated flex="1">{meta}</Text>
        {onStudio && (
          <Button size="sm" variant="outline" color="white" borderColor="whiteAlpha.500"
            _hover={{ bg: 'whiteAlpha.200' }} flexShrink={0}
            onClick={() => onStudio(photo)}>
            <FiExternalLink style={{ marginRight: 6 }} /> Ouvrir dans le Studio
          </Button>
        )}
      </HStack>
    </Box>
  )
}
