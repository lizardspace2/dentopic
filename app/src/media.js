import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const cache = new Map()

export function photoUrl(storagePath) {
  if (!storagePath) return Promise.resolve(null)
  if (cache.has(storagePath)) return Promise.resolve(cache.get(storagePath))
  return supabase.storage
    .from('photos')
    .createSignedUrl(storagePath, 3600)
    .then(({ data, error }) => {
      const url = error || !data ? null : data.signedUrl
      cache.set(storagePath, url)
      return url
    })
    .catch(() => null)
}

export function usePhotoUrl(storagePath) {
  const [url, setUrl] = useState(storagePath ? cache.get(storagePath) || null : null)
  useEffect(() => {
    let alive = true
    if (!storagePath) {
      setUrl(null)
      return
    }
    photoUrl(storagePath).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [storagePath])
  return url
}
