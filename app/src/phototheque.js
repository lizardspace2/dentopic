export const LIBRARY_DEFAULTS = { tab: 'photos', q: '', patient: '', specialty: '', view: '', stage: '',
  quick: 'recent', from: '', to: '', session: '', day: '', page: '0' }

export const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const searchWords = (value) => normalizeText(value).trim().slice(0, 120).split(/\s+/).filter(Boolean).slice(0, 6)
export const matchesLibraryText = (text, search) => searchWords(search).every((word) => normalizeText(text).includes(word))

export function readLibraryFilters(params) {
  const filters = Object.fromEntries(Object.entries(LIBRARY_DEFAULTS).map(([key, value]) => [key, params.get(key) || value]))
  if (!['photos', 'patients', 'collections'].includes(filters.tab)) filters.tab = 'photos'
  if (!['recent', 'favorites', 'unassigned'].includes(filters.quick)) filters.quick = 'recent'
  filters.page = String(Math.max(0, Math.min(10000, parseInt(filters.page, 10) || 0)))
  return filters
}

export function photoTextExpression(value) {
  const variants = { a: '[aàâäáãå]', e: '[eéèêë]', i: '[iîïíì]', o: '[oôöóòõ]', u: '[uùûüú]', c: '[cç]', n: '[nñ]' }
  const parts = searchWords(value).map((word) => {
    const pattern = [...word].map((ch) => variants[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')
    const quoted = JSON.stringify(pattern)
    return `or(original_filename.imatch.${quoted},description.imatch.${quoted})`
  })
  return parts.length ? `and(${parts.join(',')})` : ''
}

export function localPhotoDay(photo) {
  const date = new Date(photo.taken_at || photo.created_at)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateBounds(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Date invalide.')
  const start = new Date(`${day}T00:00:00`)
  if (Number.isNaN(start.getTime()) || localPhotoDay({ created_at: start }) !== day) throw new Error('Date invalide.')
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function rootDossierId(dossiers, id) {
  if (!id) return null
  const seen = new Set()
  let current = id
  while (!seen.has(current)) {
    seen.add(current)
    const parent = dossiers.find((d) => d.id === current)?.parent_id
    if (!parent) return current
    current = parent
  }
  return id
}

export function expandDossierIds(dossiers, ids) {
  const result = new Set(ids)
  let changed = true
  while (changed) {
    changed = false
    for (const dossier of dossiers) {
      if (result.has(dossier.parent_id) && !result.has(dossier.id)) { result.add(dossier.id); changed = true }
    }
  }
  return [...result]
}

export function patientPhotoGroups(photos) {
  const groups = new Map()
  for (const photo of photos) {
    const day = localPhotoDay(photo)
    const key = photo.capture_session_id ? `session:${photo.capture_session_id}` : `day:${day}`
    if (!groups.has(key)) groups.set(key, { key, session: photo.capture_session_id || '', day, photos: [], timestamp: 0 })
    const group = groups.get(key)
    group.photos.push(photo)
    const timestamp = new Date(photo.taken_at || photo.created_at).getTime() || 0
    group.timestamp = Math.max(group.timestamp, timestamp)
  }
  return [...groups.values()].sort((a, b) => b.timestamp - a.timestamp)
}
