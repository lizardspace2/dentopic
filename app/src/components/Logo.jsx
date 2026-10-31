import { Box, HStack, Text } from '@chakra-ui/react'
import { C } from '../theme'

export default function Logo({ size = 'md' }) {
  const barH = size === 'lg' ? 22 : 16
  const barW = size === 'lg' ? 7 : 6
  const fs = size === 'lg' ? 'lg' : 'sm'
  return (
    <HStack gap="1.5" userSelect="none">
      <HStack gap="1" align="center">
        <Box w={`${barW}px`} h={`${barH}px`} borderRadius="4px" bg={C.navy} />
        <Box w={`${barW}px`} h={`${barH}px`} borderRadius="4px" bg={C.primary} />
      </HStack>
      <Text fontSize={fs} fontWeight="700" letterSpacing="-0.01em" color={C.ink}>
        Dento<Text as="span" color={C.primary}>Pic</Text>
      </Text>
    </HStack>
  )
}
