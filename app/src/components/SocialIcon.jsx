// Logos officiels des réseaux sociaux en couleur.
// Formes : simple-icons (SVG officiels) ; Instagram = dégradé de marque,
// TikTok = double-ton cyan/rose, Google = G 4 couleurs, LinkedIn = glyph
// officiel (retiré de simple-icons pour raisons de marque).
import { Box } from '@chakra-ui/react'
import {
  siInstagram, siFacebook, siTiktok, siYoutube, siPinterest, siX, siThreads,
} from 'simple-icons'
import { FaLinkedinIn } from 'react-icons/fa'

// Google « G » multicolore (simple-icons ne fournit que la version mono)
const GOOGLE_G = [
  ['#4285F4', 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'],
  ['#34A853', 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'],
  ['#FBBC05', 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'],
  ['#EA4335', 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'],
]

const mono = (icon, hex) => ({ path: icon.path, color: `#${hex}` })

const BRANDS = {
  facebook: mono(siFacebook, siFacebook.hex),
  youtube: mono(siYoutube, siYoutube.hex),
  pinterest: mono(siPinterest, siPinterest.hex),
  x: mono(siX, siX.hex),
  threads: mono(siThreads, siThreads.hex),
  linkedin: { react: FaLinkedinIn, color: '#0A66C2' },
}

let gid = 0

export default function SocialIcon({ provider, size = 16, color, ...rest }) {
  // Instagram : dégradé officiel (jaune → rose → violet)
  if (provider === 'instagram') {
    const id = `ig${++gid}`
    return (
      <Box as="svg" viewBox="0 0 24 24" w={`${size}px`} h={`${size}px`} flexShrink={0} {...rest}>
        <defs>
          <linearGradient id={id} x1="0" y1="24" x2="24" y2="0">
            <stop offset="0%" stopColor="#feda75" />
            <stop offset="45%" stopColor="#fa7e1e" />
            <stop offset="70%" stopColor="#d62976" />
            <stop offset="100%" stopColor="#962fbf" />
          </linearGradient>
        </defs>
        <path d={siInstagram.path} fill={color || `url(#${id})`} />
      </Box>
    )
  }
  // TikTok : double-ton cyan/rose derrière le glyph noir
  if (provider === 'tiktok') {
    return (
      <Box as="svg" viewBox="0 0 24 24" w={`${size}px`} h={`${size}px`} flexShrink={0} {...rest}>
        {!color && <path d={siTiktok.path} fill="#25f4ee" transform="translate(-0.8,-0.8)" />}
        {!color && <path d={siTiktok.path} fill="#fe2c55" transform="translate(0.8,0.8)" />}
        <path d={siTiktok.path} fill={color || '#010101'} />
      </Box>
    )
  }
  // Google : « G » 4 couleurs
  if (provider === 'google_business' || provider === 'google') {
    return (
      <Box as="svg" viewBox="0 0 24 24" w={`${size}px`} h={`${size}px`} flexShrink={0} {...rest}>
        {GOOGLE_G.map(([c, d]) => (
          <path key={c} d={d} fill={color || c} />
        ))}
      </Box>
    )
  }
  const brand = BRANDS[provider]
  if (!brand) return null
  if (brand.react) {
    const I = brand.react
    return <Box as={I} color={color || brand.color} fontSize={`${size}px`} flexShrink={0} {...rest} />
  }
  return (
    <Box as="svg" viewBox="0 0 24 24" w={`${size}px`} h={`${size}px`} flexShrink={0} {...rest}>
      <path d={brand.path} fill={color || brand.color} />
    </Box>
  )
}
