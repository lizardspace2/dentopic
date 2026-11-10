// Modèles de présentations dentaires — galerie façon Canva, contenu
// auto-rempli depuis le dossier patient façon SmileCloud.
import { FiGrid, FiLayers, FiMonitor, FiFileText } from 'react-icons/fi'
//
// Chaque diapo du plan :
//   kind 'title'   → diapo texte de titre (nom de la présentation)
//   kind 'text'    → diapo texte avec contenu pré-écrit
//   kind 'photo'   → photo du dossier, repérée par view + stage cliniques
//   kind 'montage' → montage avant/après du dossier
//   kind 'all'     → une diapo photo par vue du bilan complet
//
// `view`/`stage` = codes de CLINICAL_VIEWS/CLINICAL_STAGES (clinical.js).

export const PRESENTATION_TEMPLATES = [
  {
    key: 'esthetique',
    cat: 'patient',
    name: 'Cas esthétique sourire',
    desc: 'Sourire initial → intra-orale → avant/après → résultat',
    accent: '#7c3aed',
    preview: 'smile',
    slides: [
      { kind: 'title' },
      { kind: 'photo', view: 'smile', stage: 'initial', title: 'Sourire — bilan initial' },
      { kind: 'photo', view: 'intraoral', stage: 'initial', title: 'Situation intra-buccale initiale' },
      { kind: 'montage', title: 'Avant / Après' },
      { kind: 'photo', view: 'smile', stage: 'final', title: 'Résultat — fin de traitement' },
      { kind: 'text', title: 'Récapitulatif', text: 'Traitement réalisé, entretien et contrôles recommandés.' },
    ],
  },
  {
    key: 'plan',
    cat: 'patient',
    name: 'Plan de traitement',
    desc: 'Expliquer les étapes au patient — façon ClinCheck',
    accent: '#0ea5e9',
    preview: 'plan',
    slides: [
      { kind: 'title' },
      { kind: 'photo', view: 'smile', stage: 'initial', title: 'Votre sourire aujourd\u2019hui' },
      { kind: 'photo', view: 'intraoral', title: 'Situation actuelle' },
      { kind: 'text', title: 'Les étapes prévues',
        text: '1. Bilan et préparation\n2. Phase de traitement\n3. Finitions et contrôle' },
      { kind: 'photo', view: 'detail', title: 'Secteur concerné' },
      { kind: 'text', title: 'Questions ?', text: 'Nous répondons à toutes vos questions avant de commencer.' },
    ],
  },
  {
    key: 'avant-apres',
    cat: 'patient',
    name: 'Avant / Après',
    desc: 'Comparer le bilan initial au résultat final',
    accent: '#059669',
    preview: 'compare',
    slides: [
      { kind: 'title' },
      { kind: 'photo', view: 'smile', stage: 'initial', title: 'AVANT — bilan initial' },
      { kind: 'montage', title: 'Comparaison avant / après' },
      { kind: 'photo', view: 'smile', stage: 'final', title: 'APRÈS — fin de traitement' },
      { kind: 'text', title: 'Conclusion', text: 'Résultat obtenu et consignes d\u2019entretien.' },
    ],
  },
  {
    key: 'education',
    cat: 'patient',
    name: 'Éducation patient',
    desc: 'Expliquer un soin ou une hygiène — salle d\u2019attente',
    accent: '#d97706',
    preview: 'learn',
    slides: [
      { kind: 'title' },
      { kind: 'text', title: 'Pourquoi ce soin ?', text: 'Objectifs et bénéfices pour votre santé bucco-dentaire.' },
      { kind: 'photo', view: 'detail', title: 'Exemple concret' },
      { kind: 'text', title: 'Les bons gestes', text: 'Conseils d\u2019hygiène et de prévention au quotidien.' },
      { kind: 'text', title: 'En résumé', text: 'Les points clés à retenir.' },
    ],
  },
  {
    key: 'clinique',
    cat: 'pro',
    name: 'Cas clinique (congrès)',
    desc: 'Diagnostic → traitement → résultat → discussion',
    accent: '#1e293b',
    preview: 'case',
    slides: [
      { kind: 'title' },
      { kind: 'text', title: 'Diagnostic initial', text: 'Motif de consultation et examen clinique.' },
      { kind: 'photo', view: 'intraoral', stage: 'initial', title: 'Situation initiale' },
      { kind: 'photo', view: 'intraoral', stage: 'progress', title: 'En cours de traitement' },
      { kind: 'photo', view: 'intraoral', stage: 'final', title: 'Résultat final' },
      { kind: 'montage', title: 'Avant / Après' },
      { kind: 'text', title: 'Discussion', text: 'Points techniques, limites et suivi.' },
    ],
  },
  {
    key: 'labo',
    cat: 'pro',
    name: 'Transmission laboratoire',
    desc: 'Protocole photo + notes pour le céramiste',
    accent: '#0d9488',
    preview: 'lab',
    slides: [
      { kind: 'title' },
      { kind: 'photo', view: 'smile', title: 'Sourire de face' },
      { kind: 'photo', view: 'intraoral', title: 'Vue à l\u2019écarteur' },
      { kind: 'photo', view: 'detail', title: 'Secteur traité / teinte' },
      { kind: 'text', title: 'Instructions', text: 'Teinte de référence, forme, texture et finition attendues.' },
    ],
  },
  {
    key: 'bilan',
    cat: 'pro',
    name: 'Bilan complet — 12 vues',
    desc: 'Toutes les vues du protocole photographique',
    accent: '#334155',
    preview: 'grid',
    slides: [
      { kind: 'title' },
      { kind: 'all' },
      { kind: 'text', title: 'Fin du bilan', text: 'Protocole photographique complet.' },
    ],
  },
]

// Vues utilisées pour la génération « bilan complet », dans l'ordre du
// protocole photographique (id → titre de diapo).
export const BILAN_SLIDES = [
  ['portrait', 'Portrait de face'], ['portrait', 'Portrait 3/4 droit'],
  ['portrait', 'Portrait 3/4 gauche'], ['portrait', 'Profil droit'],
  ['portrait', 'Profil gauche'], ['smile', 'Sourire de face'],
  ['intraoral', 'Face à l\u2019écarteur'], ['right', 'Latérale droite'],
  ['left', 'Latérale gauche'], ['upper', 'Occlusale maxillaire'],
  ['lower', 'Occlusale mandibulaire'], ['detail', 'Secteur traité'],
]

// Cartes « Projets » du détail dossier — inspirées de l'écran Projects de
// SmileCloud (Smile Design, Signature Design, Blueprint, Review, Compare).
// Chaque carte lance un outil pré-rempli avec le dossier en contexte.
export const DOSSIER_PROJECT_TOOLS = [
  { key: 'pres-esthetique', icon: FiMonitor, accent: '#7c3aed',
    label: 'Présentation du cas', sub: 'Diaporama pré-rempli',
    to: (id) => `/presentations?tpl=esthetique&dossier=${id}` },
  { key: 'pres-plan', icon: FiFileText, accent: '#0ea5e9',
    label: 'Plan de traitement', sub: 'Expliquer les étapes au patient',
    to: (id) => `/presentations?tpl=plan&dossier=${id}` },
  { key: 'montage', icon: FiLayers, accent: '#059669',
    label: 'Montage avant/après', sub: 'Comparer deux photos du dossier',
    to: (id) => `/studio?montage=${id}` },
  { key: 'sheet', icon: FiGrid, accent: '#d97706',
    label: 'Planche clinique', sub: 'Les 8 vues sur une image',
    to: (id) => `/studio?sheet=${id}` },
]
