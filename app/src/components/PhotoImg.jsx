import { Box, Center, Image } from '@chakra-ui/react'
import { FiImage, FiPlay } from 'react-icons/fi'
import { usePhotoUrl } from '../media'

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv|3gp|mts|mpg|mpeg)$/i
export const isVideoMedia = (p) =>
  (p?.mime || '').startsWith('video/') || VIDEO_EXT.test(p?.storage_path || '')

export default function PhotoImg({ storagePath, mime, ratio = '4/3', iconSize = '24px', children, ...rest }) {
  const url = usePhotoUrl(storagePath)
  const video = (mime || '').startsWith('video/') || VIDEO_EXT.test(storagePath || '')
  return (
    <Box
      position="relative"
      borderRadius="lg"
      overflow="hidden"
      bg="gray.100"
      aspectRatio={ratio}
      {...rest}
    >
      {url ? (
        video ? (
          <>
            <Box as="video" src={url} muted playsInline preload="metadata"
              w="100%" h="100%" objectFit="cover" sx={{ pointerEvents: 'none' }} />
            <Center position="absolute" inset="0">
              <Center w="30px" h="30px" borderRadius="full" bg="blackAlpha.600" color="white">
                <Box as={FiPlay} fontSize="12px" ml="2px" />
              </Center>
            </Center>
          </>
        ) : (
          <Image src={url} w="100%" h="100%" objectFit="cover" loading="lazy" draggable={false} />
        )
      ) : (
        <Center w="100%" h="100%" color="gray.400">
          <Box as={FiImage} fontSize={iconSize} />
        </Center>
      )}
      {children}
    </Box>
  )
}
