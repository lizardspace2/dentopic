// Données statiques de la page Acquisition : catalogue des sources.
import { FiCamera, FiMonitor, FiSmartphone, FiUpload, FiVideo, FiWifi, FiLayers } from 'react-icons/fi'
import { MdOutlineSdCard } from 'react-icons/md'

// Catalogue des sources d'acquisition — `modal` = popup de configuration associée
export const SOURCE_DEFS = [
  {
    key: 'mobile', icon: FiSmartphone, label: 'Application mobile',
    hint: "QR code — l'app envoie les photos en direct", modal: 'mobile',
  },
  {
    key: 'device', icon: FiVideo, label: 'Depuis cet appareil',
    hint: 'Caméra de ce téléphone ou webcam de cet ordinateur — cliché en direct', modal: 'device',
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

// ---- « Nouvel appareil » façon concurrent : tuiles source + liaison ----------

// Tuiles « Source d'acquisition » — chaque tuile pré-remplit fabricant/connexion
// et définit le type fonctionnel (kind) de l'appareil.
export const DEVICE_SOURCES = [
  { key: 'manual', icon: FiMonitor, label: 'Manuel / autre', hint: 'Boîtier saisi à la main', kind: 'camera', conn: 'other' },
  { key: 'mobile', icon: FiSmartphone, label: 'Application mobile', hint: 'QR code — photos en direct', kind: 'camera', conn: 'mobile' },
  { key: 'canon', icon: FiCamera, label: 'Canon', hint: 'Connexion WiFi directe à l’appareil', kind: 'camera', conn: 'wifi', manufacturer: 'Canon' },
  { key: 'nikon', icon: FiCamera, label: 'Nikon WiFi', hint: 'Pairing PTP/IP direct (Z6 II, Z7 II, Z8, Z9…)', kind: 'camera', conn: 'ptp', manufacturer: 'Nikon' },
  { key: 'sdcard', icon: MdOutlineSdCard, label: 'Carte SD Wi-Fi', hint: 'Carte SD Wi-Fi (Toshiba FlashAir, ez Share…) — le bridge relève les nouvelles photos', kind: 'camera', conn: 'sd' },
  { key: 'ftp', icon: FiWifi, label: 'FTP', hint: 'Transfert FTP depuis l’appareil', kind: 'ftp', conn: 'ftp' },
  { key: 'watch', icon: FiMonitor, label: 'Dossier surveillé', hint: 'Auto-import depuis un dossier (Nikon WMU, EOS Utility…)', kind: 'watch', conn: 'watch_folder' },
]

// Tuiles « Liaison d'acquisition » (section DentoPic Bridge)
export const LIAISON_DEFS = [
  { key: 'sdcard', icon: MdOutlineSdCard, label: 'Carte SD Wi-Fi' },
  { key: 'watch', icon: FiMonitor, label: 'Dossier surveillé' },
  { key: 'wifi', icon: FiWifi, label: 'Wi-Fi intégré (DCAPI)' },
  { key: 'ftp', icon: FiUpload, label: 'Passerelle FTP' },
]

// Select « Connexion » du formulaire appareil — libellés conviviaux.
// NB : la contrainte SQL n'accepte que wifi|usb|mobile|other — les valeurs
// riches sont rangées dans metadata.conn par createCaptureDevice.
export const CONN_SELECT = [
  ['wifi', 'Wi-Fi'],
  ['ptp', 'Wi-Fi PTP/IP'],
  ['usb', 'USB'],
  ['sd', 'Carte SD Wi-Fi'],
  ['ftp', 'FTP'],
  ['watch_folder', 'Dossier surveillé'],
  ['mobile', 'Application mobile'],
  ['other', 'Autre'],
]
