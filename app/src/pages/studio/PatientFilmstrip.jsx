import { useEffect, useState } from 'react'
import { Box, HStack, Text } from '@chakra-ui/react'
import { FiStar, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import PhotoImg from '../../components/PhotoImg'
import { Select, Tip } from '../../components/ui'
import { CLINICAL_VIEWS, CLINICAL_STAGES, clinicalLabels } from '../../clinical'
import { listPhotos, setPhotoFavorite } from '../../api'
import { C, S } from '../../theme'

const labelFor = (options, value) => options.find(([id]) => id === value)?.[1]
const dateFor = (photo) => {
  const date = new Date(photo?.taken_at || photo?.created_at)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR')
}

export function PatientContext({ photo, dossier, onExport }) {
  const labels = clinicalLabels(photo)
  const meta = photo?.capture_meta || {}
  const exif = meta.exif || meta
  const specs = [
    exif.iso && `ISO ${exif.iso}`,
    exif.fNumber && `f/${exif.fNumber}`,
    exif.exposureTime && `${exif.exposureTime} s`,
    exif.focalLength && `${exif.focalLength} mm`,
  ].filter(Boolean)
  return (
    <HStack px="3" py="1.5" gap="3" flexWrap="wrap" bg={S.card} borderBottom="1px solid" borderColor={S.border} flexShrink="0">
      <Box flex="1" minW="0">
        <HStack gap="2" flexWrap="wrap">
          <Text fontSize="xs" fontWeight="700" color={S.fg}>{dossier?.name || (photo?.dossier_id ? 'Dossier patient' : photo ? 'Photo sans dossier patient' : 'Document libre')}</Text>
          {dossier?.patient_dossier_number && <Text fontSize="2xs" color={S.muted}>N° {dossier.patient_dossier_number}</Text>}
          {[labelFor(CLINICAL_STAGES, labels.stage), labelFor(CLINICAL_VIEWS, labels.view)].filter(Boolean).map((label) => (
            <Text key={label} fontSize="2xs" fontWeight="600" px="2" py="0.5" borderRadius="sm" bg={C.greenBg} color={C.greenText}>{label}</Text>
          ))}
        </HStack>
        {photo && <Text fontSize="2xs" color={S.muted} truncate>
          {[photo.original_filename, dateFor(photo), photo.width && photo.height ? `${photo.width} × ${photo.height} px` : '', ...specs].filter(Boolean).join(' · ')}
        </Text>}
      </Box>
      <Box as="button" fontSize="xs" px="3" py="1" borderRadius="md" bg={C.greenBg} color={C.greenText}
        border="1px solid" borderColor={C.greenBorder} onClick={onExport}>Exporter / enregistrer</Box>
    </HStack>
  )
}

export default function PatientFilmstrip({ wsId, photo, onPick, onCompare, onPhotoChange }) {
  const [photos, setPhotos] = useState([])
  const [view, setView] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [retry, setRetry] = useState(0)
  const dossierId = photo?.dossier_id

  useEffect(() => {
    if (!wsId) return
    let active = true
    setLoading(true); setError(''); setPhotos([])
    listPhotos(wsId, { dossierId, limit: 300, throwOnError: true })
      .then((rows) => { if (active) setPhotos(rows) })
      .catch(() => { if (active) setError('Chargement des photos impossible.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [wsId, dossierId, retry])

  useEffect(() => { setView(''); setFavorites(false) }, [wsId, dossierId])

  const toggleFavorite = async (p) => {
    setBusy(p.id); setError('')
    try {
      const saved = await setPhotoFavorite(wsId, p.id, !p.is_favorite)
      setPhotos((rows) => rows.map((item) => item.id === saved.id ? saved : item))
      onPhotoChange(saved)
    } catch { setError('Favori non enregistré. Réessayez.') }
    finally { setBusy(null) }
  }
  const list = photos.filter((p) => (!view || clinicalLabels(p).view === view) && (!favorites || p.is_favorite))
  const currentIndex = list.findIndex((p) => p.id === photo?.id)
  const smallButton = { fontSize: '2xs', px: '2', py: '1', borderRadius: 'sm', border: '1px solid', borderColor: S.border, color: S.fg }

  return (
    <Box bg={S.card} borderTop="1px solid" borderColor={S.border} flexShrink="0">
      <HStack px="3" py="1" gap="2" flexWrap="wrap">
        <Text fontSize="2xs" fontWeight="700" color={S.fg}>{dossierId ? 'PHOTOS DU DOSSIER' : 'PHOTOS DU CABINET'}</Text>
        <Text fontSize="2xs" color={S.muted}>{list.length} affichée(s){photos.length === 300 ? ' · 300 dernières photos' : ''}</Text>
        <Box flex="1" />
        <Box as="button" {...smallButton} aria-label="Photo précédente" disabled={currentIndex <= 0}
          _disabled={{ opacity: 0.35 }} onClick={() => onPick(list[currentIndex - 1])}>Précédente</Box>
        <Box as="button" {...smallButton} aria-label="Photo suivante" disabled={currentIndex < 0 || currentIndex >= list.length - 1}
          _disabled={{ opacity: 0.35 }} onClick={() => onPick(list[currentIndex + 1])}>Suivante</Box>
        <Box as="button" {...smallButton} aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)}>
          <HStack gap="1"><Box as={collapsed ? FiChevronUp : FiChevronDown} /><Text>{collapsed ? 'Afficher la pellicule' : 'Réduire'}</Text></HStack>
        </Box>
      </HStack>
      {!collapsed && (
        <>
          <HStack px="3" gap="2" pb="1">
            <Select h="25px" fontSize="2xs" bg={S.input} color={S.fg} value={view} aria-label="Filtrer la pellicule par vue" onChange={(e) => setView(e.target.value)}>
              <option value="">Toutes les vues</option>
              {CLINICAL_VIEWS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </Select>
            <Box as="button" {...smallButton} aria-pressed={favorites} bg={favorites ? C.greenBg : S.input}
              onClick={() => setFavorites((v) => !v)}>{favorites ? 'Favorites uniquement' : 'Toutes / Favorites'}</Box>
            {loading && <Text fontSize="2xs" color={S.muted}>Chargement…</Text>}
            {error && <Text fontSize="2xs" color={S.fg} role="alert">{error} <Box as="button" textDecoration="underline" onClick={() => setRetry((v) => v + 1)}>Recharger</Box></Text>}
          </HStack>
          <HStack overflowX="auto" align="start" gap="2" px="3" pb="2" maxH="150px">
            {list.map((p) => (
              <Box key={p.id} w="108px" flexShrink="0" border="2px solid" borderColor={p.id === photo?.id ? C.greenText : S.border} borderRadius="md" overflow="hidden">
                <Tip label={[p.original_filename, dateFor(p), labelFor(CLINICAL_VIEWS, clinicalLabels(p).view)].filter(Boolean).join(' · ')}>
                  <Box as="button" w="104px" display="block" aria-label={`Ouvrir ${p.original_filename || 'la photo'}`} aria-pressed={p.id === photo?.id} onClick={() => onPick(p)}>
                    <PhotoImg storagePath={p.storage_path} ratio="2/1" borderRadius="0" />
                  </Box>
                </Tip>
                <Text fontSize="2xs" color={S.muted} px="1" truncate>{labelFor(CLINICAL_VIEWS, clinicalLabels(p).view) || dateFor(p) || 'Sans date'}</Text>
                <HStack gap="1" px="1" pb="1">
                  <Box as="button" aria-label={p.is_favorite ? 'Retirer des favorites' : 'Ajouter aux favorites'} aria-pressed={!!p.is_favorite} disabled={busy != null}
                    color={p.is_favorite ? C.greenText : S.muted} onClick={() => toggleFavorite(p)}><FiStar fill={p.is_favorite ? 'currentColor' : 'none'} /></Box>
                  {photo?.id !== p.id && photo?.dossier_id && photo.dossier_id === p.dossier_id && (
                    <Box as="button" ml="auto" fontSize="2xs" color={C.greenText} onClick={() => onCompare(p)}>Comparer</Box>
                  )}
                </HStack>
              </Box>
            ))}
            {!loading && !error && list.length === 0 && <Text fontSize="xs" color={S.muted} py="3">Aucune photo pour ces filtres.</Text>}
          </HStack>
        </>
      )}
    </Box>
  )
}
