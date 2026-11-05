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

export function createPresentation(wsId, fields) {
  return supabase
    .from('presentations')
    .insert({ workspace_id: wsId, status: 'draft', ...fields })
    .select().single()
    .then(({ data, error }) => {
      if (error) { console.warn('createPresentation:', error.message); return null }
      return data
    })
}

export function updatePresentation(id, fields) {
  return supabase
    .from('presentations')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
    .then(({ data, error }) => {
      if (error) { console.warn('updatePresentation:', error.message); return null }
      return data
    })
}

/** Corbeille (soft delete) */
export function trashPresentation(id) {
  return updatePresentation(id, { deleted_at: new Date().toISOString() })
}

/** Duplique la présentation + toutes ses diapositives */
export async function duplicatePresentation(pres) {
  const copy = await createPresentation(pres.workspace_id, {
    name: `${pres.name} (copie)`, patient_id: pres.patient_id, status: 'draft',
  })
  if (!copy) return null
  const slides = await listPresentationSlides(pres.id)
  for (const s of slides) {
    await supabase.from('presentation_slides').insert({
      presentation_id: copy.id, position: s.position, type: s.type,
      title: s.title, media_url: s.media_url, before_url: s.before_url,
      after_url: s.after_url, text_content: s.text_content,
      photo_id: s.photo_id, montage_id: s.montage_id,
      video_project_id: s.video_project_id, timeline_photo_ids: s.timeline_photo_ids,
      notes: s.notes,
    })
  }
  return copy
}

export function listPresentationSlides(presentationId) {
  return supabase
    .from('presentation_slides')
    .select('*,photo:patient_photos(storage_path),montage:montages(name,export_url)')
    .eq('presentation_id', presentationId)
    .order('position', { ascending: true })
    .then(({ data }) => data || [])
}

export function addPresentationSlide(presentationId, fields) {
  return supabase
    .from('presentation_slides')
    .insert({ presentation_id: presentationId, ...fields })
    .select().single()
    .then(({ data, error }) => {
      if (error) { console.warn('addPresentationSlide:', error.message); return null }
      return data
    })
}

export function removePresentationSlide(id) {
  return supabase.from('presentation_slides').delete().eq('id', id)
    .then(({ error }) => !error)
}

/** Active/désactive le partage par lien (share_token, expiration optionnelle). */
export function sharePresentation(id, enabled, expiresDays = null) {
  const fields = enabled
    ? {
        share_enabled: true,
        share_token: crypto.randomUUID(),
        share_expires_at: expiresDays
          ? new Date(Date.now() + expiresDays * 86400000).toISOString()
          : null,
      }
    : { share_enabled: false, share_token: null, share_expires_at: null }
  return updatePresentation(id, fields)
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
/** Photos reçues via un appareil de capture : total + 4 dernières (sessions liées). */
export async function devicePhotoStats(wsId, deviceId) {
  const { data: sess } = await supabase
    .from('capture_sessions').select('id')
    .eq('workspace_id', wsId).eq('device_id', deviceId)
  const ids = (sess || []).map((s) => s.id)
  if (!ids.length) return { count: 0, latest: [] }
  const [{ count }, { data: latest }] = await Promise.all([
    supabase.from('patient_photos').select('*', { count: 'exact', head: true }).in('capture_session_id', ids),
    supabase.from('patient_photos').select('id,storage_path').in('capture_session_id', ids)
      .order('created_at', { ascending: false }).limit(4),
  ])
  return { count: count || 0, latest: latest || [] }
}

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

/** Tous les patients du workspace — { dossierId: patient } si byDossier. */
export function listPatients(wsId, { byDossier = false } = {}) {
  return alive(supabase.from('patients').select('*').eq('workspace_id', wsId))
    .then(({ data }) => {
      const rows = data || []
      if (!byDossier) return rows
      return Object.fromEntries(rows.map((p) => [p.dossier_id, p]))
    })
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

// ---- Recherche multicritères --------------------------------------------------

/**
 * Charge tout le nécessaire à la recherche multicritères :
 * dossiers + patients + photos (+ prédictions IA) + montages du workspace.
 * Le filtrage est fait côté client (volumes cabinet).
 */
export async function loadSearchData(wsId) {
  const [dossiers, patients, photos, montages] = await Promise.all([
    listDossiers(wsId),
    listPatients(wsId),
    listPhotos(wsId, { limit: 500 }),
    listMontages(wsId, { limit: 200 }),
  ])
  const preds = await predictionsByPhoto(photos.map((p) => p.id))
  return { dossiers, patients, photos, montages, preds }
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

// ---- Réseaux sociaux & publications -------------------------------------------
// social_accounts : provider, handle, access_token (NOT NULL — la vraie connexion
// OAuth nécessite une app Meta/TikTok côté backend ; en attendant on enregistre
// la connexion "en attente" avec meta.pending_oauth = true).
// social_posts : brouillons/programmations (status draft|scheduled|published|
// failed), liés à photo_id / montage_id / video_id + dossier patient + account.

export function listSocialAccounts(wsId) {
  return supabase
    .from('social_accounts').select('*').eq('workspace_id', wsId)
    .order('created_at', { ascending: true })
    .then(({ data }) => data || [])
}

export function connectSocialAccount(wsId, { provider, handle }) {
  return supabase
    .from('social_accounts')
    .insert({
      workspace_id: wsId, provider, handle,
      access_token: `pending:${crypto.randomUUID()}`,
      meta: { pending_oauth: true },
    })
    .select().single()
    .then(({ data, error }) => {
      if (error) { console.warn('connectSocialAccount:', error.message); return null }
      return data
    })
}

export function disconnectSocialAccount(id) {
  return supabase.from('social_accounts').delete().eq('id', id)
    .then(({ error }) => !error)
}

export function updateSocialAccount(id, fields) {
  return supabase.from('social_accounts').update(fields).eq('id', id)
    .then(({ error }) => !error)
}

/** Nombre de brouillons/publications rattachés à un compte social. */
export function countSocialPostsByAccount(accountId) {
  return supabase.from('social_posts').select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .then(({ count }) => count || 0)
}

export function listSocialPosts(wsId, { status } = {}) {
  let q = supabase
    .from('social_posts')
    .select('*,account:social_accounts(provider,handle),photo:patient_photos(storage_path),montage:montages(name,export_url),patient:patients(first_name,last_name,dossier_id)')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (status) q = q.eq('status', status)
  return q.then(({ data }) => data || [])
}

export function createSocialPost(wsId, fields) {
  return supabase
    .from('social_posts')
    .insert({ workspace_id: wsId, status: fields.scheduled_at ? 'scheduled' : 'draft', ...fields })
    .select().single()
    .then(({ data, error }) => {
      if (error) { console.warn('createSocialPost:', error.message); return null }
      return data
    })
}

export function updateSocialPost(id, fields) {
  return supabase
    .from('social_posts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
    .then(({ data, error }) => {
      if (error) { console.warn('updateSocialPost:', error.message); return null }
      return data
    })
}

export function deleteSocialPost(id) {
  return supabase.from('social_posts').delete().eq('id', id).then(({ error }) => !error)
}

/** Démarre le flux OAuth via l'Edge Function (Meta natif ou agrégateur).
 *  Retourne { url } à ouvrir, ou { configured:false } si le serveur n'est pas
 *  configuré (le frontend bascule alors sur la connexion manuelle). */
export async function socialOAuthStart(wsId, provider, action) {
  const { data, error } = await supabase.functions.invoke('social-oauth-start', {
    body: { workspace_id: wsId, provider, action },
  })
  if (error) return { url: null, configured: false, error: error.message }
  return data || { url: null, configured: false }
}

/** Resynchronise les comptes liés côté agrégateur → lignes social_accounts. */
export function socialSyncAccounts(wsId) {
  return socialOAuthStart(wsId, 'aggregator', 'sync')
}

/** Déconnexion côté serveur (révocation best-effort + suppression). */
export async function socialDisconnectAccount(id) {
  const { data, error } = await supabase.functions.invoke('social-disconnect', {
    body: { account_id: id },
  })
  if (error) return false
  return data?.ok !== false
}

/** Moteur de publication : tente l'Edge Function (publication réelle via les
 *  APIs réseau), puis replie sur la simulation locale si elle n'est pas déployée.
 *  Une Edge Function + cron (x-cron-secret) remplacera le déclencheur client. */
export async function publishDuePosts(wsId) {
  try {
    const { data, error } = await supabase.functions.invoke('social-publish-due', {
      body: { workspace_id: wsId },
    })
    if (!error && data && data.errors !== undefined) {
      return { published: data.published || 0, failed: data.failed || 0 }
    }
  } catch { /* function non déployée → simulation */ }
  const { data: due, error } = await supabase
    .from('social_posts')
    .select('id,account_id')
    .eq('workspace_id', wsId)
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
  if (error) { console.warn('publishDuePosts:', error.message); return { published: 0, failed: 0 } }
  let published = 0, failed = 0
  for (const p of due || []) {
    const status = p.account_id ? 'published' : 'failed'
    if (await updateSocialPost(p.id, { status })) {
      if (status === 'published') published++; else failed++
    }
  }
  return { published, failed }
}

// ---- Protocoles de prise de vues ----------------------------------------------
// protocols (workspace_id, name, description, is_default) + protocol_steps
// (protocol_id, position, name, expected_photo_class, required, instructions).
// expected_photo_class est contraint CHECK : portrait|smile|intraoral|
// occlusal|radiograph|document.

export function listProtocols(wsId) {
  return supabase
    .from('protocols')
    .select('*,steps:protocol_steps(*)')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true })
    .then(({ data, error }) => {
      if (error) { console.warn('listProtocols:', error.message); return [] }
      return (data || []).map((p) => ({
        ...p,
        steps: (p.steps || []).sort((a, b) => a.position - b.position),
      }))
    })
}

export function createProtocol(wsId, { name, description }) {
  return supabase
    .from('protocols')
    .insert({ workspace_id: wsId, name, description })
    .select().single()
    .then(({ data, error }) => {
      if (error) { console.warn('createProtocol:', error.message); return null }
      return data
    })
}

export function updateProtocol(id, fields) {
  return supabase
    .from('protocols').update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .then(({ error }) => !error)
}

/** Un seul protocole par défaut : retire le flag des autres avant de le poser. */
export async function setDefaultProtocol(wsId, id) {
  await supabase.from('protocols').update({ is_default: false }).eq('workspace_id', wsId)
  const { error } = await supabase.from('protocols').update({ is_default: true }).eq('id', id)
  if (error) { console.warn('setDefaultProtocol:', error.message); return false }
  return true
}

export function deleteProtocol(id) {
  return supabase.from('protocols').delete().eq('id', id).then(({ error }) => !error)
}

export function addProtocolStep(protocolId, { name, expected_photo_class, required, instructions }) {
  return supabase
    .from('protocol_steps')
    .select('position').eq('protocol_id', protocolId)
    .order('position', { ascending: false }).limit(1)
    .then(({ data }) => {
      const position = (data?.[0]?.position || 0) + 1
      return supabase
        .from('protocol_steps')
        .insert({ protocol_id: protocolId, position, name, expected_photo_class, required, instructions })
        .select().single()
    })
    .then(({ data, error }) => {
      if (error) { console.warn('addProtocolStep:', error.message); return null }
      return data
    })
}

export function updateProtocolStep(id, fields) {
  return supabase
    .from('protocol_steps').update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .then(({ error }) => !error)
}

export function deleteProtocolStep(id) {
  return supabase.from('protocol_steps').delete().eq('id', id).then(({ error }) => !error)
}

// ---- Usage du stockage & plan --------------------------------------------------
// workspaces.storage_limit_bytes + plan (slug) ; workspace_plans décrit les
// limites (membres, réseaux sociaux…). Usage réel = somme patient_photos.bytes.

export async function getStorageUsage(wsId) {
  const { data, error } = await supabase
    .from('patient_photos')
    .select('id,bytes,mime,source,storage_path,original_filename,created_at,dossier_id,dossier:dossiers(name)')
    .eq('workspace_id', wsId)
    .is('deleted_at', null)
  if (error) { console.warn('getStorageUsage:', error.message); return null }
  const rows = data || []
  const byMime = {}
  rows.forEach((p) => {
    const k = p.mime || 'inconnu'
    byMime[k] = byMime[k] || { bytes: 0, count: 0 }
    byMime[k].bytes += p.bytes || 0
    byMime[k].count += 1
  })
  return {
    totalBytes: rows.reduce((a, p) => a + (p.bytes || 0), 0),
    count: rows.length,
    byMime,
    largest: rows.filter((p) => p.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 8),
  }
}

export async function getPlanInfo(wsId) {
  const [{ data: ws }, { data: plans }, { count: members }, { count: accounts }, { count: dossiers }] =
    await Promise.all([
      supabase.from('workspaces').select('plan,storage_limit_bytes,subscription_status,plan_period_end,plan_interval').eq('id', wsId).single(),
      supabase.from('workspace_plans').select('*').eq('is_visible', true).order('max_members', { ascending: true }),
      supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId),
      supabase.from('social_accounts').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId),
      supabase.from('dossiers').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId).is('deleted_at', null),
    ])
  const current = (plans || []).find((p) => p.slug === ws?.plan) || null
  return { workspace: ws, plans: plans || [], current, usage: { members, accounts, dossiers } }
}

// ---- Membres du workspace -----------------------------------------------------
// workspace_members : workspace_id, user_id (FK auth.users), role, created_at.
// Pas de FK vers profiles → le nom est récupéré par requête séparée.

export function listWorkspaceMembers(wsId) {
  return supabase
    .from('workspace_members').select('*').eq('workspace_id', wsId)
    .order('created_at', { ascending: true })
    .then(async ({ data }) => {
      const members = data || []
      const ids = members.map((m) => m.user_id)
      if (!ids.length) return members
      const { data: profiles } = await supabase
        .from('profiles').select('*').in('id', ids)
      const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
      return members.map((m) => ({ ...m, profile: byId[m.user_id] || null }))
    })
}

/** Crée un vrai compte (auth.signUp) puis le rattache au workspace avec un rôle.
 *  La session courante est sauvegardée puis restaurée si le nouveau compte
 *  prend le relais (confirmation e-mail désactivée côté projet). */
export async function createMemberAccount(wsId, { email, password, full_name, role }) {
  const { data: sess } = await supabase.auth.getSession()
  const prev = sess?.session
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name } },
  })
  if (error) return { error: error.message }
  if (prev && data?.session && data.session.user.id !== prev.user.id) {
    await supabase.auth.setSession({
      access_token: prev.access_token, refresh_token: prev.refresh_token,
    })
  }
  const uid = data?.user?.id
  if (!uid) return { error: 'Compte non créé' }
  const { error: insErr } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: wsId, user_id: uid, role })
  if (insErr) {
    console.warn('createMemberAccount member:', insErr.message)
    return { error: `Compte créé mais rattachement impossible : ${insErr.message}` }
  }
  return { user: data.user, needsConfirm: !data?.session }
}

export function updateMemberRole(wsId, userId, role) {
  return supabase
    .from('workspace_members').update({ role })
    .eq('workspace_id', wsId).eq('user_id', userId)
    .then(({ error }) => !error)
}

export function removeWorkspaceMember(wsId, userId) {
  return supabase
    .from('workspace_members').delete()
    .eq('workspace_id', wsId).eq('user_id', userId)
    .then(({ error }) => !error)
}

// ---- Brand Système --------------------------------------------------------------
// Identité visuelle persistée dans workspaces.settings.brand (jsonb).
// Le logo est un fichier du bucket privé `photos` (préfixe brand/).

export function getWorkspaceSettings(wsId) {
  return supabase
    .from('workspaces').select('settings').eq('id', wsId).single()
    .then(({ data, error }) => {
      if (error) { console.warn('getWorkspaceSettings:', error.message); return {} }
      return data?.settings || {}
    })
}

export async function saveWorkspaceBrand(wsId, brand) {
  const settings = await getWorkspaceSettings(wsId)
  const { error } = await supabase
    .from('workspaces')
    .update({ settings: { ...settings, brand } })
    .eq('id', wsId)
  if (error) { console.warn('saveWorkspaceBrand:', error.message); return false }
  return true
}

/** Bascule le plan du workspace (slug workspace_plans : free|pro|team|clinic). */
export function setWorkspacePlan(wsId, slug) {
  return supabase
    .from('workspaces').update({ plan: slug }).eq('id', wsId)
    .then(({ error }) => {
      if (error) { console.warn('setWorkspacePlan:', error.message); return false }
      return true
    })
}

/** Écrit une clé dans workspaces.settings (merge non destructif). */
export async function saveWorkspaceSetting(wsId, key, value) {
  const settings = await getWorkspaceSettings(wsId)
  const { error } = await supabase
    .from('workspaces')
    .update({ settings: { ...settings, [key]: value } })
    .eq('id', wsId)
  if (error) { console.warn('saveWorkspaceSetting:', error.message); return false }
  return true
}

/** Upload un asset de marque (logo…) dans le bucket photos — retourne storage_path */
export async function uploadBrandAsset(wsId, file, kind = 'logo') {
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase()
  const path = `${wsId}/brand/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file, {
    contentType: file.type || 'image/png',
  })
  if (error) { console.warn('uploadBrandAsset:', error.message); return null }
  return path
}
