// Données statiques de la page Acquisition : textes du guide et catalogue des sources.
import { FiCamera, FiFolder, FiMonitor, FiSmartphone, FiUpload, FiWifi, FiSettings, FiLayers } from 'react-icons/fi'

// Étapes du guide « Comprendre l'acquisition » (textes repris de l'original)
export const HELP_STEPS = [
  {
    icon: FiFolder, title: 'Tout part du dossier',
    desc: "Chaque photo est rangée dans un dossier. Ouvrez le dossier du cas (ou créez-le) : c'est lui la destination — le menu latéral sert uniquement à naviguer.",
  },
  {
    icon: FiCamera, title: "Ouvrez le dossier, lancez l'acquisition",
    desc: 'Dans la page du dossier : « Ajouter des photos » importe vos fichiers existants, « Capture » démarre une session live (QR smartphone, tablette, caméra bridge).',
  },
  {
    icon: FiMonitor, title: 'Source → destination en un coup d’œil',
    desc: 'Pendant une session, la pilule dans la barre du haut indique d’où viennent les photos et où elles se rangent, avec le compteur de clichés reçus.',
  },
  {
    icon: FiUpload, title: 'Import en masse',
    desc: '« Import routé » groupe automatiquement vos fichiers en sous-dossiers (date EXIF, préfixe de nom). « Planifier » prépare une séance de capture à venir.',
  },
  {
    icon: FiSettings, title: 'Réglages → Appareils',
    desc: 'La connexion des caméras (bridge Wi-Fi, FTP, carte SD) et du réseau se configure dans Réglages → Appareils — séparément de l’acquisition quotidienne.',
  },
]

// Catalogue des sources d'acquisition — `modal` = popup de configuration associée
export const SOURCE_DEFS = [
  {
    key: 'mobile', icon: FiSmartphone, label: 'Application mobile',
    hint: "QR code — l'app envoie les photos en direct", modal: 'mobile',
  },
  {
    key: 'camera', icon: FiCamera, label: 'Appareil photo',
    hint: 'Boîtier connecté — Canon, Nikon…', modal: 'camera',
  },
  {
    key: 'ftp', icon: FiWifi, label: 'FTP',
    hint: "Transfert FTP depuis l'appareil", modal: 'ftp',
  },
  {
    key: 'watch', icon: FiMonitor, label: 'Dossier surveillé',
    hint: 'Auto-import depuis un dossier (Nikon WMU, EOS Utility…)', modal: 'watch',
  },
  {
    key: 'import', icon: FiUpload, label: 'Importer des photos',
    hint: 'Fichiers ou dossier complet, glisser-déposer', modal: 'import',
  },
]

export const sourceLabel = (key) => SOURCE_DEFS.find((s) => s.key === key)?.label || key
export const sourceIcon = (key) => SOURCE_DEFS.find((s) => s.key === key)?.icon || FiLayers

// Type fonctionnel d'un appareil : metadata.kind ('ftp'|'watch') ou connection_type.
// (La contrainte SQL n'autorise que wifi/usb/mobile/other -> les sources FTP et
// dossier surveillé sont des appareils 'other' marqués par metadata.kind.)
export const devKind = (d) =>
  d?.metadata?.kind || (d?.connection_type === 'ftp' ? 'ftp'
    : d?.connection_type === 'watch_folder' ? 'watch' : 'camera')

// Types de connexion proposés dans le formulaire « Ajouter un appareil »
export const CONNECTION_TYPES = [
  ['wifi', 'Wi-Fi direct (Canon, Sony…)'],
  ['ptp', 'Wi-Fi PTP/IP (Nikon Z6 II, Z7 II, Z8, Z9…)'],
  ['ftp', 'FTP'],
  ['sd', 'Carte SD'],
  ['watch_folder', 'Dossier surveillé'],
]

// Marques rapides dans « Ajouter un appareil » — pré-remplissent fabricant + connexion
export const BRAND_PRESETS = [
  { label: 'Canon WiFi', manufacturer: 'Canon', connectionType: 'wifi', hint: 'Connexion WiFi directe à l’appareil' },
  { label: 'Nikon WiFi', manufacturer: 'Nikon', connectionType: 'ptp', hint: 'Pairing PTP/IP direct (Z6 II, Z7 II, Z8, Z9…)' },
  { label: 'Sony WiFi', manufacturer: 'Sony', connectionType: 'wifi', hint: 'Transfert WiFi / Imaging Edge' },
  { label: 'Autre', manufacturer: '', connectionType: 'wifi', hint: 'Saisie libre' },
]
