// Outils et réglages du Studio (layout façon Photoshop).
import {
  FiCrop, FiEdit2, FiFeather, FiMove, FiRotateCw,
  FiSquare, FiType, FiZoomIn,
} from 'react-icons/fi'
import { LuHand } from 'react-icons/lu'
import { TbColorPicker } from 'react-icons/tb'

// Barre d'outils verticale (ordre = affichage)
export const TOOLS = [
  { key: 'move', icon: FiMove, label: 'Déplacement', hint: 'Déplace le calque actif — V' },
  { key: 'crop', icon: FiCrop, label: 'Recadrage', hint: 'Trace une zone puis valide — C' },
  { key: 'rect', icon: FiSquare, label: 'Sélection', hint: 'Rectangle de sélection — M' },
  { key: 'brush', icon: FiEdit2, label: 'Pinceau', hint: 'Dessine sur le calque actif — B' },
  { key: 'eraser', icon: FiFeather, label: 'Gomme', hint: 'Efface le calque actif — E' },
  { key: 'text', icon: FiType, label: 'Texte', hint: 'Clique puis saisis — T' },
  { key: 'picker', icon: TbColorPicker, label: 'Pipette', hint: 'Prélève une couleur — I' },
  { key: 'rotate', icon: FiRotateCw, label: 'Rotation', hint: 'Pivote le document de 90°' },
  { key: 'hand', icon: LuHand, label: 'Main', hint: 'Déplace la vue — H' },
  { key: 'zoom', icon: FiZoomIn, label: 'Zoom', hint: 'Cliquer = +, Alt+clic = − — Z' },
]

// Réglages du calque « Réglages » (sliders → ctx.filter)
export const ADJUST_DEFS = [
  { key: 'brightness', label: 'Luminosité', min: 0, max: 200, unit: '%' },
  { key: 'contrast', label: 'Contraste', min: 0, max: 200, unit: '%' },
  { key: 'saturate', label: 'Saturation', min: 0, max: 200, unit: '%' },
  { key: 'hue', label: 'Teinte', min: -180, max: 180, unit: '°' },
  { key: 'blur', label: 'Flou', min: 0, max: 10, unit: 'px', step: 0.5 },
  { key: 'grayscale', label: 'Niveaux de gris', min: 0, max: 100, unit: '%' },
  { key: 'sepia', label: 'Sépia', min: 0, max: 100, unit: '%' },
  { key: 'invert', label: 'Inversion', min: 0, max: 100, unit: '%' },
]

// Presets rapides du panneau Réglages
export const PRESETS = [
  { name: 'Défaut', adjust: {} },
  { name: 'N&B', adjust: { grayscale: 100 } },
  { name: 'Sépia', adjust: { sepia: 85 } },
  { name: 'Vif', adjust: { saturate: 145, contrast: 112 } },
  { name: 'Doux', adjust: { brightness: 108, contrast: 92, saturate: 90, blur: 0.4 } },
  { name: 'Froid', adjust: { hue: -14, saturate: 92, brightness: 102 } },
]

export const SWATCHES = [
  '#111827', '#ffffff', '#dc2626', '#ea580c', '#d97706',
  '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#0891b2',
]
