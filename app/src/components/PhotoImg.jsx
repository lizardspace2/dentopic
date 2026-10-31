import { Box, Center, Image } from '@chakra-ui/react'
import { FiImage } from 'react-icons/fi'
import { usePhotoUrl } from '../media'

export default function PhotoImg({ storagePath, ratio = '4/3', iconSize = '24px', children, ...rest }) {
  const url = usePhotoUrl(storagePath)
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
        <Image src={url} w="100%" h="100%" objectFit="cover" loading="lazy" />
      ) : (
        <Center w="100%" h="100%" color="gray.400">
          <Box as={FiImage} fontSize={iconSize} />
        </Center>
      )}
      {children}
    </Box>
  )
}
