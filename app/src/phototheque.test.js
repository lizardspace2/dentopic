import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dateBounds, expandDossierIds, matchesLibraryText, normalizeText, patientPhotoGroups,
  photoTextExpression, readLibraryFilters, rootDossierId,
} from './phototheque.js'

test('patient search ignores accents, case and word order', () => {
  assert.equal(normalizeText('ÉMAIL'), 'email')
  assert.ok(matchesLibraryText('DUPONT Jean · Émail', 'email jean'))
  assert.ok(!matchesLibraryText('DUPONT Jean', 'jean durand'))
  assert.ok(matchesLibraryText('Patient', '   '))
})

test('photo search quotes PostgREST operands and escapes regex syntax', () => {
  const expression = photoTextExpression('Émail (1)')
  assert.ok(expression.startsWith('and(or(original_filename.imatch.'))
  assert.ok(expression.includes('[eéèêë]'))
  assert.ok(expression.includes('\\\\('))
  assert.ok(expression.includes('description.imatch.'))
  assert.equal(photoTextExpression(' '), '')
  const quoted = photoTextExpression('"test,1"')
  assert.ok(quoted.includes('\\"'))
})

test('URL filters have bounded pages and known tabs', () => {
  const invalid = readLibraryFilters(new URLSearchParams('tab=invalid&page=-9&quick=bad'))
  assert.equal(invalid.tab, 'photos')
  assert.equal(invalid.page, '0')
  assert.equal(invalid.quick, 'recent')
  assert.equal(readLibraryFilters(new URLSearchParams('page=9999999')).page, '10000')
  assert.equal(readLibraryFilters(new URLSearchParams('tab=patients&view=smile')).view, 'smile')
})

test('date bounds reject invalid calendar days and include an entire local day', () => {
  assert.throws(() => dateBounds('2026-02-31'))
  assert.throws(() => dateBounds('not-a-date'))
  const bounds = dateBounds('2024-02-29')
  const start = new Date(bounds.start), end = new Date(bounds.end)
  assert.equal(start.getDate(), 29)
  assert.equal(start.getHours(), 0)
  assert.equal(end.getMonth(), 2)
  assert.ok(end > start)
})

test('patient filtering includes subfolders and handles cycles', () => {
  const dossiers = [{ id: 'a' }, { id: 'b', parent_id: 'a' }, { id: 'c', parent_id: 'b' }, { id: 'd' }]
  assert.deepEqual(expandDossierIds(dossiers, ['a']), ['a', 'b', 'c'])
  assert.equal(rootDossierId(dossiers, 'c'), 'a')
  assert.equal(rootDossierId(dossiers, null), null)
  const cycle = [{ id: 'a', parent_id: 'b' }, { id: 'b', parent_id: 'a' }]
  assert.deepEqual(expandDossierIds(cycle, ['a']), ['a', 'b'])
  assert.equal(rootDossierId(cycle, 'a'), 'a')
})

test('real capture sessions stay distinct from date-based groups', () => {
  const photos = [
    { id: '1', capture_session_id: 'session-a', created_at: '2026-03-01T12:00:00Z' },
    { id: '2', capture_session_id: 'session-a', created_at: '2026-03-01T13:00:00Z' },
    { id: '3', capture_session_id: 'session-b', created_at: '2026-03-01T14:00:00Z' },
    { id: '4', created_at: '2026-03-01T15:00:00Z' },
  ]
  const groups = patientPhotoGroups(photos)
  assert.equal(groups.length, 3)
  assert.equal(groups.find((g) => g.session === 'session-a').photos.length, 2)
  assert.equal(groups.find((g) => !g.session).photos.length, 1)
  assert.ok(groups[0].key.startsWith('day:'))
  assert.deepEqual(patientPhotoGroups([]), [])
})
