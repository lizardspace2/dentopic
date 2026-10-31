// Outils et réglages du Studio (layout façon Photoshop).
import {
  FiCrop, FiEdit2, FiFeather, FiMove, FiRotateCw,
  FiSquare, FiType, FiZoomIn, FiZap,
} from 'react-icons/fi'
import { LuHand } from 'react-icons/lu'
import { TbColorPicker } from 'react-icons/tb'

// Barre d'outils verticale (ordre = affichage)
export const TOOLS = [
  { key: 'move', icon: FiMove, label: 'Déplacement', hint: 'Déplace le calque actif — V' },
  { key: 'crop', icon: FiCrop, label: 'Recadrage', hint: 'Trace une zone puis valide — C' },
  { key: 'rect', icon: FiSquare, label: 'Sélection', hint: 'Rectangle de sélection — M' },
  { key: 'wand', icon: FiZap, label: 'Baguette', hint: 'Sélection par couleur — W' },
  { key: 'brush', icon: FiEdit2, label: 'Pinceau', hint: 'Dessine sur le calque actif — B' },
  { key: 'eraser', icon: FiFeather, label: 'Gomme', hint: 'Efface le calque actif — E' },
  { key: 'text', icon: FiType, label: 'Texte', hint: 'Clique puis saisis — T' },
  { key: 'picker', icon: TbColorPicker, label: 'Pipette', hint: 'Prélève une couleur — I' },
  { key: 'rotate', icon: FiRotateCw, label: 'Rotation', hint: 'Pivote le document de 90°' },
  { key: 'hand', icon: LuHand, label: 'Main', hint: 'Déplace la vue — H' },
  { key: 'zoom', icon: FiZoomIn, label: 'Zoom', hint: 'Cliquer = +, Alt+clic = − — Z' },
]

// Réglages groupés façon Lightroom/Photoshop (panneau « Réglages »)
export const ADJUST_GROUPS = [
  {
    title: 'Exposition',
    defs: [
      { key: 'exposure', label: 'Exposition', min: -3, max: 3, step: 0.05, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`, tip: 'Correction globale en stops photo (±3 EV)' },
      { key: 'brightness', label: 'Luminosité', min: 0, max: 200, unit: '%', tip: 'Éclaire ou assombrit toute l\'image' },
      { key: 'contrast', label: 'Contraste', min: 0, max: 200, unit: '%', tip: 'Écart entre zones claires et sombres' },
      { key: 'saturate', label: 'Saturation', min: 0, max: 200, unit: '%', tip: 'Intensité des couleurs — 0 % = gris' },
    ],
  },
  {
    title: 'Balance des blancs', wb: true,
    defs: [
      { key: 'temp', label: 'Température', min: -100, max: 100, fmt: (v) => (v > 0 ? '+' : '') + v, tip: 'Bleu (froid) ← → jaune (chaud)' },
      { key: 'tint', label: 'Teinte', min: -100, max: 100, fmt: (v) => (v > 0 ? '+' : '') + v, tip: 'Vert ← → magenta' },
    ],
  },
  {
    title: 'Niveaux', levels: true,
    defs: [
      { key: 'inBlack', label: 'Noirs entrée', min: 0, max: 254, tip: 'Seuil des ombres — tout en dessous devient noir' },
      { key: 'gamma', label: 'Gamma', min: 10, max: 400, fmt: (v) => (v / 100).toFixed(2), tip: 'Luminosité des tons moyens (courbe)' },
      { key: 'inWhite', label: 'Blancs entrée', min: 1, max: 255, tip: 'Seuil des hautes lumières — tout au-dessus devient blanc' },
    ],
  },
  {
    title: 'Détails',
    defs: [
      { key: 'sharp', label: 'Netteté', min: 0, max: 100, tip: 'Accentue les contours — utile pour l\'émail et les détails' },
      { key: 'blur', label: 'Flou', min: 0, max: 10, unit: 'px', step: 0.5, tip: 'Flou gaussien appliqué à toute l\'image' },
    ],
  },
  {
    title: 'Effets',
    defs: [
      { key: 'hue', label: 'Teinte', min: -180, max: 180, unit: '°', tip: 'Rotation du cercle chromatique' },
      { key: 'grayscale', label: 'Niveaux de gris', min: 0, max: 100, unit: '%', tip: 'Conversion progressive en noir & blanc' },
      { key: 'sepia', label: 'Sépia', min: 0, max: 100, unit: '%', tip: 'Virage brun (rendu vintage)' },
      { key: 'invert', label: 'Inversion', min: 0, max: 100, unit: '%', tip: 'Négatif — inverse toutes les couleurs' },
    ],
  },
]

// Presets rapides du panneau Réglages (+ presets utilisateur en localStorage)
export const PRESETS = [
  { name: 'Défaut', adjust: {} },
  { name: 'N&B', adjust: { grayscale: 100 } },
  { name: 'Sépia', adjust: { sepia: 85 } },
  { name: 'Vif', adjust: { saturate: 145, contrast: 112, sharp: 30 } },
  { name: 'Doux', adjust: { brightness: 108, contrast: 92, saturate: 90, blur: 0.4 } },
  { name: 'Froid', adjust: { temp: -35, tint: 8, saturate: 95 } },
  { name: 'Écarteur', adjust: { exposure: 0.25, contrast: 118, sharp: 40 } },
]

export const SWATCHES = [
  '#111827', '#ffffff', '#dc2626', '#ea580c', '#d97706',
  '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#0891b2',
]

// Modes de fusion des calques (label -> globalCompositeOperation Canvas2D)
export const BLEND_MODES = [
  ['Normal', 'source-over'],
  ['Multiplier', 'multiply'],
  ['Écran', 'screen'],
  ['Incrustation', 'overlay'],
  ['Obscurcir', 'darken'],
  ['Éclaircir', 'lighten'],
  ['Densité couleur −', 'color-burn'],
  ['Densité couleur +', 'color-dodge'],
  ['Lumière douce', 'soft-light'],
  ['Lumière dure', 'hard-light'],
  ['Différence', 'difference'],
  ['Teinte', 'hue'],
  ['Saturation', 'saturation'],
  ['Couleur', 'color'],
  ['Luminosité', 'luminosity'],
]

// Canaux du panneau Courbes
export const CURVE_CHANNELS = [
  ['rgb', 'RGB'], ['r', 'Rouge'], ['g', 'Vert'], ['b', 'Bleu'],
]

// ---- Onglet Dentaire -------------------------------------------------------------

// Guide de teinte VITA classique (couleurs approximatives pour l'affichage)
export const VITA_SHADES = [
  { code: 'A1', color: '#efe0bd' }, { code: 'A2', color: '#e8d5ac' },
  { code: 'A3', color: '#dfc79a' }, { code: 'A3.5', color: '#d9bc8f' },
  { code: 'A4', color: '#d0b183' },
  { code: 'B1', color: '#f0e3c4' }, { code: 'B2', color: '#e9d9b4' },
  { code: 'B3', color: '#ddc89b' }, { code: 'B4', color: '#d4bc8d' },
  { code: 'C1', color: '#ded8c9' }, { code: 'C2', color: '#d3ccba' },
  { code: 'C3', color: '#c6bfab' }, { code: 'C4', color: '#b5ae97' },
  { code: 'D2', color: '#e3dcc4' }, { code: 'D3', color: '#d8d0b4' },
  { code: 'D4', color: '#cbc2a4' },
]

// Les 8 vues du référentiel — planche 3×3 (cellule centrale = titre)
export const SHEET_SLOTS = [
  'Portrait de face', 'Portrait sourire', 'Portrait de profil',
  'Intra-orale de face', 'Intra-orale droite', 'Intra-orale gauche',
  'Occlusale maxillaire', 'Occlusale mandibulaire',
]
