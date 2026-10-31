import { Button, Center, Text, VStack } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { C } from '../theme'

export default function NotFound() {
  return (
    <Center minH="100vh" bg={C.pageBg}>
      <VStack gap="3">
        <Text fontSize="6xl" fontWeight="800" color={C.ink} letterSpacing="-0.03em">404</Text>
        <Text fontSize="lg" fontWeight="600" color={C.ink}>Page not found</Text>
        <Text fontSize="sm" color="gray.500">
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Link to="/">
          <Button bg={C.primary} color="#ffffff" _hover={{ bg: C.primaryHover }} size="sm" mt="2">
            Go home
          </Button>
        </Link>
      </VStack>
    </Center>
  )
}
