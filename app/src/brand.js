// Palettes de données métier — couleurs de « contenu », pas de thème.
// Distinct de theme.js (C) : ces couleurs sont des données utilisateur ou des
// couleurs de marque officielles — elles ne basculent PAS en mode sombre.

// ---- Réseaux sociaux (couleurs officielles de marque) -----------------------

export const PROVIDERS = [
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
export const providerOf = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0]

// ---- Spécialités cliniques --------------------------------------------------

export const SPECIALTIES = [
  { label: 'Orthodontie', color: '#4f8fe8' },
  { label: 'Implantologie', color: '#ed8936' },
  { label: 'Esthétique', color: '#ed64a6' },
  { label: 'Endodontie', color: '#9f7aea' },
  { label: 'Parodontie', color: '#48bb78' },
  { label: 'Prothèse', color: '#a0aec0' },
  { label: 'Dentisterie conservatrice', color: '#38b2ac' },
  { label: 'Chirurgie orale', color: '#e53e3e' },
]
export const specColor = (s) => SPECIALTIES.find((x) => x.label === s)?.color || '#718096'

// ---- Palette proposée à la création d'une collection ------------------------

export const COLLECTION_COLORS = [
  '#4f46e5', '#4f8fe8', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16',
  '#eab308', '#f59e0b', '#ed8936', '#e53e3e', '#ed64a6', '#9f7aea', '#718096',
]
