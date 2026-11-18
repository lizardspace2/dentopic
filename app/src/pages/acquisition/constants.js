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
    hint: 'Boîtier relié en Wi-Fi au poste — Canon, Nikon, Sony, Fujifilm…', modal: 'camera',
  },
  {
    key: 'ftp', icon: FiWifi, label: 'FTP',
    hint: 'Le boîtier envoie ses photos au poste en FTP', modal: 'ftp',
  },
  {
    key: 'watch', icon: FiMonitor, label: 'Dossier surveillé',
    hint: 'Auto-import depuis un dossier du poste (EOS Utility, NX Tether, Imaging Edge…)', modal: 'watch',
  },
  {
    key: 'import', icon: FiUpload, label: 'Importer des fichiers',
    hint: 'Photos ou vidéos — fichiers ou dossier complet, glisser-déposer', modal: 'import',
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

// ---- Liaisons boîtier ↔ poste (réseau local, sans Internet) ---------------------
// Chaque méthode correspond à un pilote du DentoPic Bridge (bridge/src).

export const LINK_METHODS = {
  ftp: { icon: FiUpload, label: 'Transfert FTP', conn: 'ftp', kind: 'ftp',
    hint: 'Le boîtier envoie chaque photo au poste dès la prise de vue. Méthode la plus répandue et la plus fiable.' },
  ptpip: { icon: FiWifi, label: 'Wi-Fi PTP/IP', conn: 'ptp', kind: 'camera',
    hint: 'Le poste se connecte au boîtier (mode « connexion au PC ») et rapatrie les nouvelles photos.' },
  ccapi: { icon: FiCamera, label: 'Canon CCAPI', conn: 'wifi', kind: 'camera',
    hint: 'API Wi-Fi des Canon EOS R récents. Doit être activée sur le boîtier.' },
  sdcard: { icon: MdOutlineSdCard, label: 'Carte SD Wi-Fi', conn: 'sd', kind: 'camera',
    hint: 'Carte FlashAir dans le boîtier : pour les appareils sans Wi-Fi intégré.' },
  watch: { icon: FiMonitor, label: 'Dossier surveillé', conn: 'watch_folder', kind: 'watch',
    hint: 'Le logiciel du constructeur (Wi-Fi ou USB) ou un lecteur de carte dépose les photos dans un dossier du poste.' },
  none: { icon: FiLayers, label: 'Sans liaison', conn: 'other', kind: 'camera',
    hint: 'Appareil déclaré pour mémoire. Les photos sont importées à la main.' },
}

// Marques : méthodes proposées (la première est recommandée) + où trouver le
// réglage sur le boîtier. Les menus varient selon le modèle et le firmware.
export const CAMERA_BRANDS = [
  { key: 'canon', label: 'Canon', methods: ['ftp', 'ccapi', 'watch', 'ptpip', 'sdcard'], steps: {
    ftp: 'Menu Réseau › Transfert FTP (EOS R5, R6 II, R3, R1… ; boîtiers plus anciens via un émetteur WFT). Activez le transfert automatique.',
    ccapi: 'Activez CCAPI sur le boîtier avec l’outil d’activation Canon, puis Menu Réseau › Camera Control API.',
    watch: 'EOS Utility (Wi-Fi ou USB) : choisissez comme destination le dossier indiqué ci-dessous.',
    ptpip: 'Menu Réseau › Connexion à EOS Utility. Liaison expérimentale : préférez le FTP.',
  } },
  { key: 'nikon', label: 'Nikon', methods: ['ptpip', 'ftp', 'watch', 'sdcard'], steps: {
    ptpip: 'Menu Réseau › Connecter au PC (Z6 II, Z7 II, Z8, Z9, Zf…). Validez l’appairage sur l’écran du boîtier à la première connexion.',
    ftp: 'Menu Réseau › Connecter au serveur FTP (Z8, Z9, Z6 III ; autres boîtiers via un émetteur WT). Activez l’envoi automatique.',
    watch: 'NX Tether ou Wireless Transmitter Utility : choisissez comme destination le dossier indiqué ci-dessous.',
  } },
  { key: 'sony', label: 'Sony', methods: ['ftp', 'watch', 'sdcard'], steps: {
    ftp: 'Menu Réseau › Fonction de transfert FTP › Enregistrer un serveur (α7 III et suivants, α7R, α9, α1…). Activez le transfert automatique.',
    watch: 'Imaging Edge Desktop (Remote, Wi-Fi ou USB) : choisissez comme destination le dossier indiqué ci-dessous.',
  } },
  { key: 'fujifilm', label: 'Fujifilm', methods: ['ftp', 'watch', 'sdcard'], steps: {
    ftp: 'Menu Réseau › Transfert FTP (X-H2S, X-H2, GFX100 II, ou poignée transmetteur FT-XH).',
    watch: 'FUJIFILM X Acquire (Wi-Fi ou USB) : choisissez comme destination le dossier indiqué ci-dessous.',
  } },
  { key: 'panasonic', label: 'Panasonic', methods: ['watch', 'ftp', 'sdcard'], steps: {
    watch: 'LUMIX Tether (Wi-Fi ou USB) : choisissez comme destination le dossier indiqué ci-dessous.',
    ftp: 'Transfert FTP disponible sur certains boîtiers LUMIX S et GH récents.',
  } },
  { key: 'om', label: 'OM System / Olympus', methods: ['watch', 'sdcard', 'ftp'], steps: {
    watch: 'OM Capture (Wi-Fi ou USB) : choisissez comme destination le dossier indiqué ci-dessous.',
  } },
  { key: 'other', label: 'Autre', methods: ['ftp', 'watch', 'sdcard', 'ptpip', 'none'], steps: {} },
]

export const brandOf = (manufacturer = '') => {
  const m = manufacturer.trim().toLowerCase()
  return CAMERA_BRANDS.find((b) => m && (b.label.toLowerCase().includes(m) || m.startsWith(b.key))) || CAMERA_BRANDS.at(-1)
}

const password = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')

/** Valeurs par défaut d'une liaison ; `devices` sert à proposer un port FTP libre. */
export function defaultLink(method, devices = []) {
  if (method === 'ftp') {
    const used = new Set(devices.map((d) => String(d.metadata?.link?.port || '')))
    let port = 2121
    while (used.has(String(port))) port++
    return { method, port: String(port), user: 'dentopic', pass: password() }
  }
  if (method === 'ptpip') return { method, host: '', port: '15740' }
  if (method === 'ccapi') return { method, host: '', port: '8080' }
  if (method === 'sdcard') return { method, host: '' }
  if (method === 'watch') return { method, path: '', exts: '' }
  return { method: 'none' }
}

/** Formulaire « appareil » -> colonnes capture_devices (les autres clés de metadata sont préservées) */
export function deviceFormToPayload(form, prev = null) {
  const def = LINK_METHODS[form.link.method] || LINK_METHODS.none
  const allowed = ['wifi', 'usb', 'mobile', 'other']
  return {
    name: form.name.trim(),
    manufacturer: form.manufacturer,
    model: form.model,
    room_id: form.roomId || null,
    connection_type: allowed.includes(def.conn) ? def.conn : 'other',
    metadata: {
      ...prev?.metadata,
      kind: def.kind,
      conn: allowed.includes(def.conn) ? undefined : def.conn,
      link: form.link,
      interop: form.interop || undefined,
    },
  }
}
