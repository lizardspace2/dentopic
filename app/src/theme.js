// Palette DentoPic — point d'entrée unique pour toutes les couleurs de l'app.
// Importer depuis n'importe quel composant :  import { C } from '../theme'
//
// Chaque valeur est une variable CSS (--c-*) définie dans index.css, déclinée
// en clair (:root) et en sombre (html[data-theme='dark']). Le basculement se
// fait via applyMode() — aucun re-render nécessaire, tout est piloté par le CSS.

const v = (name) => `var(--c-${name})`

export const C = {
  // Marque
  primary: v('primary'), // bleu boutons / accents
  primaryHover: v('primary-hover'),
  navy: v('navy'), // barre gauche du logo
  ink: v('ink'), // titres / texte fort
  body: v('body'), // texte courant
  muted: v('muted'), // texte secondaire

  // Fonds
  pageBg: v('page-bg'), // fond de page
  sidebarBg: v('sidebar-bg'), // fond sidebar
  cardBorder: v('card-border'),
  softBlue: v('soft-blue'), // pastille icône / survol actif
  softBlueBorder: v('soft-blue-border'),
  navActive: v('nav-active'),

  // États
  greenBg: v('green-bg'),
  greenBorder: v('green-border'),
  greenText: v('green-text'),
  amberBg: v('amber-bg'),
  amberBorder: v('amber-border'),
  amberText: v('amber-text'),

  // Studio (toujours sombre, quel que soit le mode)
  darkBg: '#0a0f18',
  darkSidebar: '#0d1420',
  darkCard: '#141c2a',
  darkBorder: '#263244',
  darkFg: '#f2f5f9',
  darkMuted: '#8b98ab',
  darkTile: '#1d2739',
  galleryBg: '#171a36',
  galleryBorder: '#2d3170',
  galleryAccent: '#8f95f8',
}

// ---- Bascule clair / sombre -------------------------------------------------

const KEY = 'dentopic.theme'

export function getMode() {
  return localStorage.getItem(KEY) || 'light'
}

export function applyMode(mode) {
  document.documentElement.dataset.theme = mode
  localStorage.setItem(KEY, mode)
}
