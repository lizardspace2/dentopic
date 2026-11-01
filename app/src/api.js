// ============================================================================
// COUCHE D'ACCÈS AUX DONNÉES — toutes les requêtes Supabase sont centralisées ici.
// Convention : listX(wsId, opts) / countX(wsId, opts) / updateX(id, fields)
// Toutes les listes excluent les éléments supprimés (deleted_at IS NULL).
// ============================================================================
import { supabase } from './supabase'

const alive = (q) => q.is('deleted_at', null)

// ---- Dossiers patients ------------------------------------------------------

export function listDossiers(wsId, { limit = 500 } = {}) {
  return alive(supabase.from('dossiers').select('*').eq('workspace_id', wsId))
    .order('updated_at', { ascending: false })
    .limit(limit)
    .then(({ data }) => data || [])
}

export function countTrashDossiers(wsId) {
  return supabase
    .from('dossiers')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', wsId)
    .not('deleted_at', 'is', null)
    .then(({ count }) => count || 0)
}

/** Met à jour les métadonnées d'une photo (teinte, favori, description…). */
export function updatePatientPhoto(id, fields) {
  return supabase
    .from('patient_photos')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('updatePatientPhoto:', error.message)
      return data
    })
}

export function getPhoto(id) {
  return supabase
    .from('patient_photos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
    .then(({ data }) => data)
}

export function updateDossier(id, fields) {
  return supabase.from('dossiers').update(fields).eq('id', id)
}

/** Met le dossier à la corbeille (soft delete) */
export function trashDossier(id) {
  return updateDossier(id, { deleted_at: new Date().toISOString() })
}

// ---- Photos -----------------------------------------------------------------

export function listPhotosByDossier(dossierId, { limit = 300 } = {}) {
  return alive(supabase.from('patient_photos').select('*').eq('dossier_id', dossierId))
    .order('created_at', { ascending: false })
    .limit(limit)
    .then(({ data }) => data || [])
}

export function listPhotos(wsId, { limit = 100, favoritesOnly = false } = {}) {
  let q = alive(supabase.from('patient_photos').select('*').eq('workspace_id', wsId))
    .order('created_at', { ascending: false })
    .limit(limit)
  if (favoritesOnly) q = q.eq('is_favorite', true)
  return q.then(({ data }) => data || [])
}

export function countPhotos(wsId, { since, unsortedOnly = false } = {}) {
  let q = supabase
    .from('patient_photos')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', wsId)
    .is('deleted_at', null)
  if (since) q = q.gte('created_at', since)
  if (unsortedOnly) q = q.is('dossier_id', null)
  return q.then(({ count }) => count || 0)
}

/** { dossierId: { photos, coverPath } } — couverture = photo la plus récente */
export function photoStatsByDossier(wsId) {
  return alive(
    supabase
      .from('patient_photos')
      .select('dossier_id,storage_path,created_at')
      .eq('workspace_id', wsId)
      .not('dossier_id', 'is', null)
  ).then(({ data }) => {
    const out = {}
    ;(data || []).forEach((p) => {
      const s = (out[p.dossier_id] = out[p.dossier_id] || { photos: 0, coverPath: null })
      s.photos++
      if (!s.coverPath) s.coverPath = p.storage_path
    })
    return out
  })
}

// ---- Montages & vidéos -------------------------------------------------------

export function listMontages(wsId, { limit = 50 } = {}) {
  return alive(supabase.from('montages').select('*').eq('workspace_id', wsId))
    .order('updated_at', { ascending: false })
    .limit(limit)
    .then(({ data }) => data || [])
}

export function listMontagesByDossier(dossierId, { limit = 50 } = {}) {
  return alive(supabase.from('montages').select('*').eq('dossier_id', dossierId))
    .order('updated_at', { ascending: false })
    .limit(limit)
    .then(({ data }) => data || [])
}

export function montageCountByDossier(wsId) {
  return alive(supabase.from('montages').select('dossier_id').eq('workspace_id', wsId))
    .not('dossier_id', 'is', null)
    .then(({ data }) => {
      const out = {}
      ;(data || []).forEach((m) => { out[m.dossier_id] = (out[m.dossier_id] || 0) + 1 })
      return out
    })
}

export function listVideoProjects(wsId) {
  return alive(supabase.from('video_projects').select('*').eq('workspace_id', wsId))
    .order('updated_at', { ascending: false })
    .then(({ data }) => data || [])
}

// ---- Présentations -----------------------------------------------------------

export function listPresentations(wsId) {
  return alive(supabase.from('presentations').select('*').eq('workspace_id', wsId))
    .order('updated_at', { ascending: false })
    .then(({ data }) => data || [])
}

/** { presentationId: slideCount } */
export function slideCountByPresentation() {
  return supabase
    .from('presentation_slides')
    .select('presentation_id')
    .then(({ data }) => {
      const out = {}
      ;(data || []).forEach((s) => { out[s.presentation_id] = (out[s.presentation_id] || 0) + 1 })
      return out
    })
}

// ---- Capture (sessions & appareils) ------------------------------------------

export function listCaptureSessions(wsId, { limit = 50 } = {}) {
  return supabase
    .from('capture_sessions')
    .select('*')
    .eq('workspace_id', wsId)
    .order('started_at', { ascending: false })
    .limit(limit)
    .then(({ data }) => data || [])
}

export function listCaptureDevices(wsId) {
  return supabase
    .from('capture_devices')
    .select('*')
    .eq('workspace_id', wsId)
    .order('name')
    .then(({ data }) => data || [])
}

/** Sessions encore ouvertes = "en écoute" sur leur dossier */
export function listActiveSessions(wsId) {
  return supabase
    .from('capture_sessions')
    .select('*')
    .eq('workspace_id', wsId)
    .is('ended_at', null)
    .neq('status', 'completed')
    .then(({ data }) => data || [])
}

/** Démarre une session de capture réelle (visible dans le bandeau "en écoute") */
export function createCaptureSession(wsId, userId, dossierId = null, deviceId = null, mobileToken = crypto.randomUUID()) {
  return supabase
    .from('capture_sessions')
    .insert({
      workspace_id: wsId,
      practitioner_id: userId,
      dossier_id: dossierId,
      device_id: deviceId,
      status: 'active',
      started_at: new Date().toISOString(),
      mobile_token: mobileToken,
    })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('createCaptureSession:', error.message)
      return data
    })
}

/** Session de capture trouvée par son mobile_token (lien QR /capture/<token>) */
export function getSessionByToken(token) {
  return supabase
    .from('capture_sessions')
    .select('*')
    .eq('mobile_token', token)
    .maybeSingle()
    .then(({ data }) => data)
}

export function getDossier(id) {
  return supabase
    .from('dossiers')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()
    .then(({ data }) => data)
}

/** Termine une session ouverte */
export function endCaptureSession(id) {
  return supabase
    .from('capture_sessions')
    .update({ ended_at: new Date().toISOString(), status: 'completed' })
    .eq('id', id)
}

/** Photos reçues pendant une session (capture_session_id) */
export function countSessionPhotos(sessionId) {
  return supabase
    .from('patient_photos')
    .select('id', { count: 'exact', head: true })
    .eq('capture_session_id', sessionId)
    .is('deleted_at', null)
    .then(({ count }) => count || 0)
}

// ---- Salles (rooms) — name + location, rattachables aux appareils (room_id) ──

export function listRooms(wsId) {
  return supabase
    .from('rooms')
    .select('*')
    .eq('workspace_id', wsId)
    .order('name')
    .then(({ data }) => data || [])
}

export function createRoom(wsId, { name, location = '' }) {
  return supabase
    .from('rooms')
    .insert({ workspace_id: wsId, name, location })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('createRoom:', error.message)
      return data
    })
}

export function updateRoom(id, fields) {
  return supabase.from('rooms').update(fields).eq('id', id).select().single()
    .then(({ data, error }) => { if (error) console.warn('updateRoom:', error.message); return data })
}

export function deleteRoom(id) {
  // on délie les appareils avant de supprimer la salle (room_id -> null)
  return supabase.from('capture_devices').update({ room_id: null }).eq('room_id', id)
    .then(() => supabase.from('rooms').delete().eq('id', id))
    .then(({ error }) => { if (error) console.warn('deleteRoom:', error.message); return !error })
}

// ---- Appareils (capture_devices) — name/manufacturer/model/connection_type + metadata (jsonb) ──

// La contrainte SQL n'accepte que wifi|usb|mobile|other — les types riches
// (ptp, sd, watch_folder, ftp…) sont rangés dans metadata.conn.
export const ALLOWED_CONN = new Set(['wifi', 'usb', 'mobile', 'other'])

export function createCaptureDevice(wsId, { name, manufacturer = '', model = '', connectionType = 'wifi', roomId = null, status = 'offline', metadata = {} }) {
  const conn = ALLOWED_CONN.has(connectionType) ? connectionType : 'other'
  const meta = { ...metadata }
  if (!ALLOWED_CONN.has(connectionType) && !meta.conn) meta.conn = connectionType
  return supabase
    .from('capture_devices')
    .insert({
      workspace_id: wsId,
      name,
      manufacturer,
      model,
      connection_type: conn,
      room_id: roomId,
      status,
      metadata: meta,
    })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('createCaptureDevice:', error.message)
      return data
    })
}

/** Met à jour un appareil (nom, config FTP/dossier dans metadata, statut…) */
export function updateCaptureDevice(id, fields) {
  return supabase
    .from('capture_devices')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('updateCaptureDevice:', error.message)
      return data
    })
}

// ---- Création d'entités -----------------------------------------------------------

export function createDossier(wsId, name, extra = {}) {
  return supabase
    .from('dossiers')
    .insert({ workspace_id: wsId, name, ...extra })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('createDossier:', error.message)
      return data
    })
}

/** Fiche patient rattachée à un dossier (nom, prénom, naissance…). */
export function createPatient(wsId, dossierId, p) {
  return supabase
    .from('patients')
    .insert({ workspace_id: wsId, dossier_id: dossierId, ...p })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('createPatient:', error.message)
      return data
    })
}

/** Met à jour la fiche patient (id = patients.id). */
export function updatePatient(id, fields) {
  return supabase
    .from('patients')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('updatePatient:', error.message)
      return data
    })
}

/** Patient d'un dossier (ou null). */
export function getPatient(dossierId) {
  return supabase
    .from('patients')
    .select('*')
    .eq('dossier_id', dossierId)
    .is('deleted_at', null)
    .limit(1)
    .then(({ data }) => data?.[0] || null)
}

/** Étapes du protocole de prise de vues (référentiel DentoPic). */
export function listProtocolSteps() {
  return supabase
    .from('protocol_steps')
    .select('id,protocol_id,position,name,expected_photo_class,required,instructions')
    .order('position', { ascending: true })
    .then(({ data, error }) => {
      if (error) console.warn('listProtocolSteps:', error.message)
      return data || []
    })
}

/** Upload + enregistre des fichiers dans le bucket privé `photos` (rangés au dossier/session si fournis) */
export async function importPhotos(wsId, files, dossierId = null, sessionId = null, protocolStepId = null) {
  const out = []
  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${wsId}/unsorted/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file)
    if (upErr) { console.warn('upload:', upErr.message); continue }
    const { data } = await supabase
      .from('patient_photos')
      .insert({
        workspace_id: wsId,
        storage_path: path,
        original_filename: file.name,
        mime: file.type || 'image/jpeg',
        bytes: file.size,
        source: 'import',
        dossier_id: dossierId,
        capture_session_id: sessionId,
        protocol_step_id: protocolStepId,
      })
      .select()
      .single()
    if (data) out.push(data)
  }
  return out
}

// ---- Collections ---------------------------------------------------------------

export function listCollections(wsId) {
  return alive(
    supabase
      .from('collections')
      .select('*,cover_photo:patient_photos!cover_photo_id(*),cover_montage:montages!cover_montage_id(*)')
      .eq('workspace_id', wsId)
  )
    .order('updated_at', { ascending: false })
    .then(({ data }) => data || [])
}

export async function createCollection(wsId, fields) {
  const { data, error } = await supabase
    .from('collections')
    .insert({ workspace_id: wsId, ...fields })
    .select()
    .single()
  if (error) { console.warn('createCollection:', error.message); return null }
  return data
}

export function updateCollection(id, fields) {
  return supabase.from('collections').update(fields).eq('id', id).select().single()
    .then(({ data, error }) => {
      if (error) console.warn('updateCollection:', error.message)
      return data
    })
}

/** Met la collection à la corbeille (soft delete). */
export function trashCollection(id) {
  return updateCollection(id, { deleted_at: new Date().toISOString() })
}

/** { collectionId: nb d'éléments } pour un lot de collections. */
export function collectionItemCounts(collectionIds) {
  if (!collectionIds?.length) return Promise.resolve({})
  return supabase
    .from('collection_items')
    .select('collection_id')
    .in('collection_id', collectionIds)
    .then(({ data }) => {
      const out = {}
      ;(data || []).forEach((i) => { out[i.collection_id] = (out[i.collection_id] || 0) + 1 })
      return out
    })
}

/** Éléments d'une collection avec la photo / le montage joint. */
export function listCollectionItems(collectionId) {
  return supabase
    .from('collection_items')
    .select('*,photo:patient_photos!photo_id(*),montage:montages!montage_id(*)')
    .eq('collection_id', collectionId)
    .order('position', { ascending: true })
    .order('added_at', { ascending: true })
    .then(({ data }) => data || [])
}

/** Ajoute une photo ou un montage à une collection. */
export function addCollectionItem(collectionId, fields, userId) {
  return supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, added_by: userId, ...fields })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) console.warn('addCollectionItem:', error.message)
      return data
    })
}

export function removeCollectionItem(itemId) {
  return supabase.from('collection_items').delete().eq('id', itemId)
}

/** Active/désactive le partage public — génère un token à l'activation. */
export function shareCollection(id, enabled, expiresDays = null) {
  const fields = enabled
    ? {
        share_enabled: true,
        share_token: crypto.randomUUID(),
        share_expires_at: expiresDays
          ? new Date(Date.now() + expiresDays * 864e5).toISOString()
          : null,
      }
    : { share_enabled: false }
  return updateCollection(id, fields)
}

// ---- IA -------------------------------------------------------------------------

/** { photoId: prediction } pour un lot de photos */
export function predictionsByPhoto(photoIds) {
  if (!photoIds?.length) return Promise.resolve({})
  return supabase
    .from('ai_predictions')
    .select('*')
    .in('photo_id', photoIds)
    .then(({ data }) => Object.fromEntries((data || []).map((p) => [p.photo_id, p])))
}

// ---- Profil -----------------------------------------------------------------------

/** Sauvegarde une image éditée (studio) dans le bucket + table patient_photos */
export async function saveEditedPhoto(wsId, blob, filename, dossierId = null) {
  const path = `${wsId}/edits/${crypto.randomUUID()}.png`
  const { error: upErr } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/png' })
  if (upErr) { console.warn('saveEditedPhoto upload:', upErr.message); return null }
  const { data } = await supabase
    .from('patient_photos')
    .insert({
      workspace_id: wsId,
      storage_path: path,
      original_filename: filename,
      mime: 'image/png',
      bytes: blob.size,
      source: 'montage',
      dossier_id: dossierId,
    })
    .select()
    .single()
  return data
}

export function updateProfile(userId, fields) {
  return supabase.from('profiles').update(fields).eq('id', userId)
}

/** Crée une entrée montage (avant/après studio) — status draft par défaut */
export async function createMontage(wsId, fields) {
  const { data, error } = await supabase
    .from('montages')
    .insert({ workspace_id: wsId, image_count: 2, status: 'draft', ...fields })
    .select()
    .single()
  if (error) { console.warn('createMontage:', error.message); return null }
  return data
}
