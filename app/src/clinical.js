export const CLINICAL_VIEWS = [
  ['portrait', 'Portrait'], ['smile', 'Sourire'], ['intraoral', 'Face intra-orale'],
  ['right', 'Latérale droite'], ['left', 'Latérale gauche'],
  ['upper', 'Occlusale maxillaire'], ['lower', 'Occlusale mandibulaire'],
  ['detail', 'Secteur traité'],
]

export const REFERENCE_VIEWS = [
  { id: 'portrait-face', name: 'Portrait de face', group: 'Portrait', view: 'portrait', expected_photo_class: 'portrait', instructions: 'Yeux à l’horizontale, axe du nez centré. Garder la même posture et la même distance entre les séances.' },
  { id: 'portrait-right45', name: 'Portrait 3/4 droit', group: 'Portrait', view: 'portrait', expected_photo_class: 'portrait', instructions: 'Conserver le même angle de trois quarts et la même hauteur de cadrage à chaque séance.' },
  { id: 'portrait-left45', name: 'Portrait 3/4 gauche', group: 'Portrait', view: 'portrait', expected_photo_class: 'portrait', instructions: 'Reproduire l’angle et la distance du côté opposé, sans inclinaison de la tête.' },
  { id: 'profile-right', name: 'Profil droit', group: 'Portrait', view: 'portrait', expected_photo_class: 'portrait', instructions: 'Profil strict, tête droite. Conserver une posture naturelle et un cadrage identique.' },
  { id: 'profile-left', name: 'Profil gauche', group: 'Portrait', view: 'portrait', expected_photo_class: 'portrait', instructions: 'Profil strict du côté gauche, même posture et même grandissement que le profil droit.' },
  { id: 'smile-face', name: 'Sourire de face', group: 'Sourire', view: 'smile', expected_photo_class: 'smile', instructions: 'Plan incisif horizontal, sourire centré. Vérifier la visibilité des dents et reproduire l’expression.' },
  { id: 'intraoral-face', name: 'Face à l’écarteur', group: 'Intra-oral', view: 'intraoral', expected_photo_class: 'intraoral', instructions: 'Milieu interincisif au centre et plan d’occlusion horizontal. Éviter l’avancée artificielle de la mandibule.' },
  { id: 'intraoral-right', name: 'Latérale droite', group: 'Intra-oral', view: 'right', expected_photo_class: 'intraoral', instructions: 'Première molaire entière dans le champ. Garder le même axe et éviter une vue trop frontale.' },
  { id: 'intraoral-left', name: 'Latérale gauche', group: 'Intra-oral', view: 'left', expected_photo_class: 'intraoral', instructions: 'Première molaire entière et cadrage comparable à la latérale droite.' },
  { id: 'occlusal-upper', name: 'Occlusale maxillaire', group: 'Occlusal', view: 'upper', expected_photo_class: 'occlusal', instructions: 'Arcade entière, axe sagittal vertical. Vérifier la buée et le bord des lèvres. Contrôler l’orientation de la photo au miroir.' },
  { id: 'occlusal-lower', name: 'Occlusale mandibulaire', group: 'Occlusal', view: 'lower', expected_photo_class: 'occlusal', instructions: 'Arcade entière, axe sagittal vertical, langue dégagée du champ. Contrôler l’orientation de la photo au miroir.' },
  { id: 'detail-sector', name: 'Secteur traité', group: 'Détail', view: 'detail', expected_photo_class: 'intraoral', instructions: 'Secteur concerné centré, fond homogène si contrasteur. Garder le même grandissement et surveiller les reflets.' },
]

export const STUDIO_PROTOCOLS = [
  { id: 'builtin:complete', name: 'Bilan complet · 12 vues', steps: REFERENCE_VIEWS },
  { id: 'builtin:followup', name: 'Suivi · 7 vues', steps: REFERENCE_VIEWS.filter((s) => ['smile-face', 'intraoral-face', 'intraoral-right', 'intraoral-left', 'occlusal-upper', 'occlusal-lower', 'detail-sector'].includes(s.id)) },
  { id: 'builtin:lab', name: 'Laboratoire · 3 vues', steps: REFERENCE_VIEWS.filter((s) => ['smile-face', 'intraoral-face', 'detail-sector'].includes(s.id)) },
]

export const CLINICAL_STAGES = [
  ['initial', 'Bilan initial'], ['progress', 'En cours de traitement'],
  ['final', 'Fin de traitement'], ['followup', 'Contrôle'],
]

export const clinicalLabels = (photo) => photo?.edit_meta?.dental || {}

export function comparisonCrop(crop, width = 900, height = 600) {
  const margin = (key) => Math.min(40, Math.max(0, Number(crop[key]) || 0)) / 100
  return { x: width * margin('left'), y: height * margin('top'),
    w: width * (1 - margin('left') - margin('right')),
    h: height * (1 - margin('top') - margin('bottom')) }
}

export function refineAlignment(base, fine, width = 900, height = 600) {
  const matrix = base || { a: 1, b: 0, x: 0, y: 0 }
  const angle = fine.angle * Math.PI / 180, scale = 1 + fine.scale / 100
  const u = Math.cos(angle) * scale, v = Math.sin(angle) * scale
  const x = matrix.x - width / 2, y = matrix.y - height / 2
  return { a: u * matrix.a - v * matrix.b, b: v * matrix.a + u * matrix.b,
    x: u * x - v * y + width / 2 + fine.x,
    y: v * x + u * y + height / 2 + fine.y }
}

export function alignLandmarks(before, after) {
  if (before.length !== 2 || after.length !== 2) return null
  const dx = after[1].x - after[0].x, dy = after[1].y - after[0].y
  const ux = before[1].x - before[0].x, uy = before[1].y - before[0].y
  const length = dx * dx + dy * dy
  if (length < 100 || ux * ux + uy * uy < 100) return null
  const a = (ux * dx + uy * dy) / length
  const b = (uy * dx - ux * dy) / length
  return { a, b, x: before[0].x - a * after[0].x + b * after[0].y,
    y: before[0].y - b * after[0].x - a * after[0].y }
}
