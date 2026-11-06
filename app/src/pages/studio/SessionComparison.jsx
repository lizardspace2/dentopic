import { useEffect, useRef, useState } from 'react'
import { Box, Button, HStack, Input, SimpleGrid, Text } from '@chakra-ui/react'
import { Select } from '../../components/ui'
import { photoUrl } from '../../media'
import { alignLandmarks, comparisonCrop, refineAlignment } from '../../clinical'
import { C } from '../../theme'

const W = 900, H = 600
const fit = (img) => {
  const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight)
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale
  return { x: (W - w) / 2, y: (H - h) / 2, w, h }
}
const draw = (ctx, img) => {
  const r = fit(img)
  ctx.drawImage(img, r.x, r.y, r.w, r.h)
}
const load = async (path) => {
  const url = await photoUrl(path)
  if (!url) throw new Error('Photo inaccessible')
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = url
  await image.decode()
  return image
}

export default function SessionComparison({ before, after, onCreateAligned }) {
  const [images, setImages] = useState(null)
  const [error, setError] = useState('')
  const [points, setPoints] = useState([[], []])
  const [marking, setMarking] = useState(true)
  const [aligned, setAligned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [crop, setCrop] = useState({ left: 0, right: 0, top: 0, bottom: 0 })
  const cropRect = comparisonCrop(crop, W, H)
  const createAligned = async () => {
    if (!images || !transform) return
    setSaving(true); setError('')
    try {
      const canvases = images.map((img, index) => {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(cropRect.w * 2); canvas.height = Math.round(cropRect.h * 2)
        const ctx = canvas.getContext('2d')
        ctx.scale(2, 2)
        ctx.translate(-cropRect.x, -cropRect.y)
        if (index) ctx.transform(transform.a, transform.b, -transform.b, transform.a, transform.x, transform.y)
        draw(ctx, img)
        return canvas
      })
      await onCreateAligned(canvases)
    } catch { setError('Impossible de créer le montage aligné. Réessayez.') }
    finally { setSaving(false) }
  }
  const [mode, setMode] = useState('slider')
  const [split, setSplit] = useState(50)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fine, setFine] = useState({ scale: 0, angle: 0, x: 0, y: 0 })
  const [topAfter, setTopAfter] = useState(true)
  const [opacity, setOpacity] = useState(70)
  const firstRef = useRef(null), secondRef = useRef(null), previewRef = useRef(null)
  const transform = refineAlignment(aligned ? alignLandmarks(points[0], points[1]) : null, fine, W, H)
  const cropped = Object.values(crop).some((value) => value !== 0)
  const adjusted = aligned || Object.values(fine).some((value) => value !== 0)
  const updateFine = (key, value, min, max) => {
    if (Number.isFinite(value)) setFine((current) => ({ ...current, [key]: Math.min(max, Math.max(min, Math.round(value * 100) / 100)) }))
  }

  useEffect(() => {
    let active = true
    Promise.all([load(before.storage_path), load(after.storage_path)])
      .then((imgs) => { if (active) setImages(imgs) })
      .catch(() => { if (active) setError('Impossible de charger les images de comparaison.') })
    return () => { active = false }
  }, [before.storage_path, after.storage_path])

  useEffect(() => {
    if (!images) return
    ;[firstRef, secondRef].forEach((ref, i) => {
      const ctx = ref.current?.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      draw(ctx, images[i])
      points[i].forEach((p, index) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2)
        ctx.fillStyle = 'white'; ctx.fill(); ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.stroke()
        ctx.fillStyle = 'black'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(String(index + 1), p.x + 14, p.y - 12)
      })
    })
    const ctx = previewRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    const paint = (index, x, width, clip) => {
      ctx.save()
      ctx.beginPath(); ctx.rect(x, 0, width, H); ctx.clip()
      if (clip) {
        ctx.beginPath(); ctx.rect(x, 0, width * split / 100, H); ctx.clip()
        ctx.clearRect(x, 0, width, H)
      }
      ctx.translate(x + width / 2 + pan.x, H / 2 + pan.y)
      const scale = width / W
      ctx.scale(scale * zoom, scale * zoom)
      ctx.translate(-W / 2, -H / 2)
      if (index && transform) ctx.transform(transform.a, transform.b, -transform.b, transform.a, transform.x, transform.y)
      draw(ctx, images[index])
      ctx.restore()
    }
    if (mode === 'side') {
      paint(0, 0, W / 2); paint(1, W / 2, W / 2)
    } else {
      paint(topAfter ? 0 : 1, 0, W)
      ctx.save()
      if (mode === 'overlay') ctx.globalAlpha = opacity / 100
      paint(topAfter ? 1 : 0, 0, W, mode === 'slider')
      ctx.restore()
      if (mode === 'slider') {
        ctx.beginPath(); ctx.moveTo(W * split / 100, 0); ctx.lineTo(W * split / 100, H)
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke()
      }
    }
    if (cropped || cropOpen) {
      const width = mode === 'side' ? W / 2 : W
      for (const x of mode === 'side' ? [0, W / 2] : [0]) {
        ctx.save()
        ctx.beginPath(); ctx.rect(x, 0, width, H); ctx.clip()
        ctx.translate(x + width / 2 + pan.x, H / 2 + pan.y)
        ctx.scale(width / W * zoom, width / W * zoom); ctx.translate(-W / 2, -H / 2)
        ctx.strokeStyle = 'white'; ctx.lineWidth = 3 / zoom; ctx.setLineDash([10, 6])
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
        ctx.restore()
      }
    }
  }, [images, points, mode, split, zoom, pan, transform, marking, topAfter, opacity, cropped, cropOpen, cropRect])

  const addPoint = (event, index) => {
    if (points[index].length >= 2 || !images) return
    const rect = event.currentTarget.getBoundingClientRect()
    const p = { x: (event.clientX - rect.left) / rect.width * W,
      y: (event.clientY - rect.top) / rect.height * H }
    const r = fit(images[index])
    if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) return
    setPoints((value) => value.map((list, i) => i === index ? [...list, p] : list))
    setAligned(false)
  }
  const moveDivider = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width > 0) setSplit(Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100)))
  }
  const dividerKeys = (event) => {
    const step = event.shiftKey ? 10 : 1
    const values = { ArrowLeft: split - step, ArrowRight: split + step,
      ArrowDown: split - step, ArrowUp: split + step, PageDown: split - 10, PageUp: split + 10, Home: 0, End: 100 }
    if (event.key in values) {
      event.preventDefault()
      setSplit(Math.min(100, Math.max(0, values[event.key])))
    }
  }
  const canAlign = !!alignLandmarks(points[0], points[1])
  const date = (photo) => new Date(photo.taken_at || photo.created_at).toLocaleDateString('fr-FR')
  const canvasStyle = { width: '100%', aspectRatio: '3 / 2', display: 'block' }

  return (
    <Box border="1px solid" borderColor={C.greenBorder} bg={C.greenBg} borderRadius="md" p="3">
      <Text fontSize="sm" fontWeight="700" color={C.greenText}>Comparer les séances · alignement assisté</Text>
      <Text fontSize="xs" color={C.body} mb="2">Avant : {date(before)} · Après : {date(after)}</Text>
      {error && <Text role="alert" fontSize="xs">{error}</Text>}
      {!images && !error && <Text fontSize="xs">Chargement de la comparaison…</Text>}
      {images && (
        <>
          <HStack gap="2" flexWrap="wrap" mb="2">
            <Button size="xs" variant="outline" onClick={() => setMarking((v) => !v)}>
              {marking ? 'Masquer les repères' : 'Définir les repères'}
            </Button>
            <Button size="xs" disabled={!canAlign} onClick={() => { setAligned(true); setMarking(false) }}>
              Aligner les deux vues
            </Button>
            <Button size="xs" variant="outline" onClick={() => {
              setPoints([[], []]); setAligned(false); setMarking(true); setZoom(1); setPan({ x: 0, y: 0 })
              setFine({ scale: 0, angle: 0, x: 0, y: 0 }); setTopAfter(true); setOpacity(70); setSplit(50)
              setCrop({ left: 0, right: 0, top: 0, bottom: 0 }); setCropOpen(false)
            }}>Réinitialiser</Button>
          </HStack>
          {marking && (
            <>
              <Text fontSize="xs" color={C.body}>Cliquez deux repères stables et espacés sur AVANT, puis les deux mêmes dans le même ordre sur APRÈS. Évitez les zones modifiées par le traitement.</Text>
              <SimpleGrid columns={2} gap="2" my="2">
                {[firstRef, secondRef].map((ref, index) => (
                  <Box key={index} bg={C.pageBg}>
                    <Text fontSize="xs" color={C.ink}>{index ? 'APRÈS' : 'AVANT'} · {points[index].length}/2 repères</Text>
                    <canvas ref={ref} width={W} height={H} style={{ ...canvasStyle, cursor: 'crosshair' }}
                      aria-label={`Repères ${index ? 'après' : 'avant'}`} onClick={(e) => addPoint(e, index)} />
                  </Box>
                ))}
              </SimpleGrid>
              {!canAlign && points.every((p) => p.length === 2) && <Text fontSize="xs" role="alert">Repères trop proches : recommencez avec deux points plus espacés.</Text>}
            </>
          )}
          <HStack mb="2" gap="2" flexWrap="wrap">
            <Select aria-label="Mode de comparaison" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="slider">Curseur avant / après</option>
              <option value="side">Côte à côte</option>
              <option value="overlay">Superposition</option>
            </Select>
            <Text fontSize="xs" color={C.body}>{adjusted ? 'Alignement appliqué' : 'Sans alignement'} · zoom synchronisé</Text>
            {mode !== 'side' && <Button size="xs" variant="outline" onClick={() => setTopAfter((value) => !value)}>Intervertir dessus / dessous</Button>}
          </HStack>
          <Box bg={C.pageBg} overflow="hidden" borderRadius="md" position="relative"
            cursor={mode === 'slider' ? 'ew-resize' : 'default'}
            style={{ touchAction: mode === 'slider' ? 'none' : 'auto' }}
            onPointerDown={(event) => {
              if (mode !== 'slider' || event.button !== 0) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              moveDivider(event)
            }}
            onPointerMove={(event) => {
              if (mode === 'slider' && event.currentTarget.hasPointerCapture(event.pointerId)) moveDivider(event)
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
            }}>
            <canvas ref={previewRef} width={W} height={H} style={canvasStyle} aria-label="Comparaison des deux séances" />
            {mode === 'slider' && (
              <>
                <Box position="absolute" top="0" bottom="0" left={`${split}%`} w="2px" bg={C.greenText} pointerEvents="none" />
                <Box position="absolute" top="50%" left={`clamp(22px, ${split}%, calc(100% - 22px))`}
                  transform="translate(-50%, -50%)" w="44px" h="44px" display="flex" alignItems="center" justifyContent="center"
                  borderRadius="full" bg={C.greenText} color={C.greenBg} border="2px solid" borderColor={C.greenBg}
                  boxShadow="md" fontSize="lg" fontWeight="700" role="slider" tabIndex={0}
                  aria-label="Séparateur Avant Après" aria-orientation="horizontal"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)}
                  aria-valuetext={`${Math.round(split)} % ${topAfter ? 'Après' : 'Avant'} à gauche`}
                  onKeyDown={dividerKeys} _focusVisible={{ outline: '3px solid', outlineColor: C.primary, outlineOffset: '3px' }}>
                  <span aria-hidden="true">‹ ›</span>
                </Box>
              </>
            )}
            {mode !== 'overlay' && [0, 1].filter((side) => mode !== 'slider' || (side === 0 ? split >= 15 : split <= 85)).map((side) => (
              <Box key={side} position="absolute" bottom="2" {...(side ? { right: '2' } : { left: '2' })}
                px="2" py="1" borderRadius="md" bg={C.greenBg} color={C.greenText} fontSize="2xs" fontWeight="800" pointerEvents="none">
                {mode === 'side' ? (side ? 'APRÈS' : 'AVANT') : (side === 0 ? (topAfter ? 'APRÈS' : 'AVANT') : (topAfter ? 'AVANT' : 'APRÈS'))}
              </Box>
            ))}
          </Box>
          {mode === 'slider' && <Text fontSize="2xs" color={C.body}>Glissez sur la photo ou déplacez la poignée. Au clavier : flèches, Maj pour un grand pas.</Text>}
          <Text fontSize="xs" color={C.body} mt="1">{mode === 'slider'
            ? `${topAfter ? 'Après' : 'Avant'} à gauche du curseur · ${topAfter ? 'Avant' : 'Après'} à droite`
            : mode === 'overlay' ? `${topAfter ? 'Après' : 'Avant'} au-dessus · opacité ${opacity} %` : 'Avant à gauche / Après à droite'}</Text>
          {mode !== 'side' && <Input type="range" min="0" max="100" value={mode === 'overlay' ? opacity : split}
            aria-label={mode === 'overlay' ? 'Opacité de l’image du dessus' : 'Séparateur avant après'}
            onChange={(e) => mode === 'overlay' ? setOpacity(+e.target.value) : setSplit(+e.target.value)} />}
          <Box border="1px solid" borderColor={C.greenBorder} borderRadius="md" p="2" my="2">
            <Text fontSize="xs" fontWeight="700" color={C.greenText}>Ajustement fin de l’image Après</Text>
            <Text fontSize="2xs" color={C.body} mb="2">Ces réglages complètent les repères et sont conservés dans le montage aligné.</Text>
            {[
              ['scale', 'Zoom fin', '%', 0.1, -30, 30],
              ['angle', 'Rotation fine', '°', 0.1, -20, 20],
              ['x', 'Horizontal', 'px', 1, -450, 450],
              ['y', 'Vertical', 'px', 1, -300, 300],
            ].map(([key, label, unit, step, min, max]) => (
              <Box key={key} mb="2">
                <Text fontSize="2xs" color={C.body}>{label} ({unit})</Text>
                <HStack gap="1">
                  {[-10, -1].map((factor) => <Button key={factor} size="xs" variant="outline"
                    aria-label={`${label} moins ${Math.abs(factor * step)} ${unit}`}
                    onClick={() => updateFine(key, fine[key] + factor * step, min, max)}>{factor === -10 ? '−−' : '−'}</Button>)}
                  <Input type="number" min={min} max={max} step={step} value={fine[key]} size="xs" aria-label={label}
                    onChange={(e) => updateFine(key, +e.target.value, min, max)} />
                  {[1, 10].map((factor) => <Button key={factor} size="xs" variant="outline"
                    aria-label={`${label} plus ${factor * step} ${unit}`}
                    onClick={() => updateFine(key, fine[key] + factor * step, min, max)}>{factor === 10 ? '++' : '+'}</Button>)}
                </HStack>
              </Box>
            ))}
            <Button size="xs" variant="outline" onClick={() => setFine({ scale: 0, angle: 0, x: 0, y: 0 })}>Réinitialiser l’ajustement fin</Button>
          </Box>
          <HStack gap="2">
            <Text fontSize="xs" color={C.body}>Zoom {zoom.toFixed(1)}×</Text>
            <Input type="range" min="1" max="4" step="0.1" value={zoom} aria-label="Zoom synchronisé" onChange={(e) => setZoom(+e.target.value)} />
          </HStack>
          {zoom > 1 && ['x', 'y'].map((axis) => (
            <HStack gap="2" key={axis}>
              <Text fontSize="xs" color={C.body}>{axis === 'x' ? 'Horizontal' : 'Vertical'}</Text>
              <Input type="range" min="-600" max="600" value={pan[axis]} aria-label={`Déplacement ${axis}`}
                onChange={(e) => setPan((v) => ({ ...v, [axis]: +e.target.value }))} />
            </HStack>
          ))}
          <Button size="xs" variant="outline" aria-expanded={cropOpen} onClick={() => {
            setCropOpen((value) => !value); setZoom(1); setPan({ x: 0, y: 0 })
          }}>Recadrage commun · les deux images</Button>
          {cropOpen && <Box p="2" border="1px solid" borderColor={C.greenBorder} borderRadius="md" mt="2">
            <Text fontSize="2xs" color={C.body}>Le cadre pointillé définit la même zone exportée sur les deux photos. Les marges sont exprimées en % du cadre commun.</Text>
            {[['left', 'Gauche'], ['right', 'Droite'], ['top', 'Haut'], ['bottom', 'Bas']].map(([key, label]) => (
              <HStack key={key} gap="2">
                <Text fontSize="2xs" color={C.body} minW="60px">{label} {crop[key]} %</Text>
                <Input type="range" min="0" max="40" step="1" value={crop[key]} aria-label={`Marge ${label}`}
                  onChange={(e) => setCrop((value) => ({ ...value, [key]: +e.target.value }))} />
              </HStack>
            ))}
            <Button size="xs" variant="outline" onClick={() => setCrop({ left: 0, right: 0, top: 0, bottom: 0 })}>Annuler le recadrage</Button>
          </Box>}
          <Button size="xs" mt="2" disabled={(!adjusted && !cropped) || saving} loading={saving} onClick={createAligned}>Créer le montage ajusté puis exporter…</Button>
          <Text fontSize="xs" color={C.body} mt="2">Déplacement, rotation et échelle uniforme uniquement, sans déformation des dents. Un angle de prise de vue différent reste une limite. Le montage aligné conserve le cadrage commun, sans le zoom d’inspection. Les boutons de montage standard utilisent les vues non alignées.</Text>
        </>
      )}
    </Box>
  )
}
