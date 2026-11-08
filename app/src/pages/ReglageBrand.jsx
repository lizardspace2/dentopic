// Route /reglage/brand — Brand Système (identité visuelle du cabinet).
// Config persistée dans workspaces.settings.brand ; le logo est un fichier
// du bucket privé `photos` (affiché via PhotoImg + signed URL).
import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Center, HStack, Input, SimpleGrid, Text, VStack,
} from '@chakra-ui/react'
import {
  FiImage, FiUpload, FiTrash2, FiCheck, FiRotateCcw,
  FiType, FiDroplet, FiFileText, FiAlertCircle,
} from 'react-icons/fi'
import { FaMagic } from 'react-icons/fa'
import { ReglageNav } from '../components/ReglageNav'
import {
  Card, PageHeader, HelpButton, PrimaryButton, Select, Field, SectionLabel,
  Tip, ConfirmModal, toast,
} from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { getWorkspaceSettings, saveWorkspaceBrand, uploadBrandAsset } from '../api'

const DEFAULT_BRAND = {
  cabinet_name: '',
  tagline: '',
  signature: '',
  color_primary: '#2563eb',
  color_secondary: '#7c3aed',
  font_title: 'Inter',
  font_body: 'Inter',
  logo_path: null,
}

const FONTS = [
  'Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Palatino', 'Garamond', 'Trebuchet MS', 'Verdana', 'Courier New',
]

const PRESETS = [
  ['#2563eb', '#7c3aed'], ['#0d9488', '#0ea5e9'], ['#dc2626', '#f59e0b'],
  ['#db2777', '#8b5cf6'], ['#16a34a', '#84cc16'], ['#111827', '#6b7280'],
]

export default function ReglageBrand() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const fileRef = useRef(null)
  const [brand, setBrand] = useState(DEFAULT_BRAND)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rmLogo, setRmLogo] = useState(false)
  const [uploadErr, setUploadErr] = useState(null)

  useEffect(() => {
    if (!wsId) return
    getWorkspaceSettings(wsId).then((s) => {
      setBrand({ ...DEFAULT_BRAND, ...(s.brand || {}) })
      setLoaded(true)
    })
  }, [wsId])

  const set = (k, v) => setBrand((b) => ({ ...b, [k]: v }))

  const pickLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setUploadErr(null)
    const path = await uploadBrandAsset(wsId, file, 'logo')
    setBusy(false)
    if (path) set('logo_path', path)
    else setUploadErr('Échec de l’envoi du fichier — réessayez.')
  }

  const removeLogo = async () => {
    setRmLogo(false); set('logo_path', null)
    await save({ ...brand, logo_path: null })
  }

  const save = async (b = brand) => {
    setBusy(true)
    const ok = await saveWorkspaceBrand(wsId, b)
    setBusy(false)
    if (ok) { setBrand(b); toast.success('Identité visuelle enregistrée.') }
    else toast.error('Enregistrement impossible — réessayez.')
  }

  const reset = () => setBrand(DEFAULT_BRAND)

  const b = brand
  const previewName = b.cabinet_name || workspace?.name || 'Mon cabinet'

  return (
    <Box w="100%" px="6" py="6">
      <ReglageNav />
      <PageHeader
        icon={FaMagic} title="Brand Système"
        subtitle="Logo, signature, couleurs et polices de votre cabinet"
      >
        <HelpButton />
        <Button variant="outline" size="sm" onClick={reset}><FiRotateCcw /> Rétablir</Button>
        <PrimaryButton icon={FiCheck} onClick={() => save()} disabled={busy || !loaded}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </PrimaryButton>
      </PageHeader>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" mt="4">
        <VStack align="stretch" gap="5">
          {/* ---- Logo ---- */}
          <Card p="5">
            <HStack mb="3" gap="2">
              <Box as={FiImage} color={C.primary} />
              <Text fontSize="sm" fontWeight="700" color={C.ink}>Logo du cabinet</Text>
            </HStack>
            <HStack gap="4" align="start">
              <Box w="140px" flexShrink={0}>
                {b.logo_path ? (
                  <PhotoImg storagePath={b.logo_path} ratio="1/1" objectFit="contain" />
                ) : (
                  <Center w="140px" h="140px" borderRadius="lg" border="2px dashed"
                    borderColor="gray.300" color="gray.400" bg="gray.50">
                    <VStack gap="1">
                      <Box as={FiImage} fontSize="xl" />
                      <Text fontSize="2xs">Aucun logo</Text>
                    </VStack>
                  </Center>
                )}
              </Box>
              <VStack align="start" gap="2" flex="1">
                <Text fontSize="xs" color="gray.500">
                  Utilisé sur les exports, présentations et documents partagés.
                  PNG ou JPG, fond transparent recommandé.
                </Text>
                <HStack gap="2">
                  <PrimaryButton icon={FiUpload} onClick={() => fileRef.current?.click()}
                    disabled={busy}>
                    {b.logo_path ? 'Remplacer' : 'Choisir un fichier'}
                  </PrimaryButton>
                  {b.logo_path && (
                    <Tip label="Supprimer le logo">
                      <Box as="button" aria-label="Supprimer le logo" p="2" color="gray.400"
                        cursor="pointer" _hover={{ color: 'red.500' }}
                        onClick={() => setRmLogo(true)}>
                        <FiTrash2 size={15} />
                      </Box>
                    </Tip>
                  )}
                </HStack>
                {uploadErr && (
                  <HStack gap="1" color="red.500">
                    <Box as={FiAlertCircle} fontSize="xs" />
                    <Text fontSize="2xs">{uploadErr}</Text>
                  </HStack>
                )}
              </VStack>
            </HStack>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickLogo}
              aria-label="Fichier logo" />
          </Card>

          {/* ---- Signature ---- */}
          <Card p="5">
            <HStack mb="3" gap="2">
              <Box as={FiFileText} color={C.primary} />
              <Text fontSize="sm" fontWeight="700" color={C.ink}>Signature</Text>
            </HStack>
            <VStack align="stretch" gap="3">
              <Field label="Nom du cabinet">
                <Input fontSize="sm" placeholder={workspace?.name || 'Mon cabinet'}
                  value={b.cabinet_name} onChange={(e) => set('cabinet_name', e.target.value)} />
              </Field>
              <Field label="Accroche / sous-titre">
                <Input fontSize="sm" placeholder="ex. Imagerie dentaire & cas cliniques"
                  value={b.tagline} onChange={(e) => set('tagline', e.target.value)} />
              </Field>
              <Field label="Ligne de signature (pied des documents)">
                <Input fontSize="sm" placeholder="ex. Dr Guillaume · Cabinet dentaire · 75001 Paris"
                  value={b.signature} onChange={(e) => set('signature', e.target.value)} />
              </Field>
            </VStack>
          </Card>
        </VStack>

        <VStack align="stretch" gap="5">
          {/* ---- Couleurs ---- */}
          <Card p="5">
            <HStack mb="3" gap="2">
              <Box as={FiDroplet} color={C.primary} />
              <Text fontSize="sm" fontWeight="700" color={C.ink}>Couleurs</Text>
            </HStack>
            <SimpleGrid columns={2} gap="3" mb="3">
              {[['color_primary', 'Couleur principale'], ['color_secondary', 'Couleur secondaire']].map(([k, lbl]) => (
                <Field key={k} label={lbl}>
                  <HStack>
                    <Box as="input" type="color" w="38px" h="34px" p="0" border="none"
                      borderRadius="md" cursor="pointer" bg="transparent"
                      aria-label={lbl}
                      value={b[k]} onChange={(e) => set(k, e.target.value)} />
                    <Input fontSize="xs" fontFamily="mono" w="90px" value={b[k]}
                      aria-label={`${lbl} (hexadécimal)`}
                      onChange={(e) => set(k, e.target.value)} />
                  </HStack>
                </Field>
              ))}
            </SimpleGrid>
            <SectionLabel mb="2">PALETTES SUGGÉRÉES</SectionLabel>
            <HStack gap="2" flexWrap="wrap">
              {PRESETS.map(([p, s]) => (
                <Box as="button" key={p + s} aria-label={`Palette ${p} / ${s}`}
                  onClick={() => { set('color_primary', p); set('color_secondary', s) }}
                  display="flex" borderRadius="md" overflow="hidden"
                  border={b.color_primary === p ? `2px solid ${C.ink}` : '2px solid transparent'}
                  cursor="pointer">
                  <Box w="18px" h="18px" bg={p} />
                  <Box w="18px" h="18px" bg={s} />
                </Box>
              ))}
            </HStack>
          </Card>

          {/* ---- Polices ---- */}
          <Card p="5">
            <HStack mb="3" gap="2">
              <Box as={FiType} color={C.primary} />
              <Text fontSize="sm" fontWeight="700" color={C.ink}>Polices</Text>
            </HStack>
            <SimpleGrid columns={2} gap="3">
              <Field label="Titres">
                <Select w="100%" value={b.font_title} aria-label="Police des titres"
                  onChange={(e) => set('font_title', e.target.value)}>
                  {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              <Field label="Texte courant">
                <Select w="100%" value={b.font_body} aria-label="Police du texte"
                  onChange={(e) => set('font_body', e.target.value)}>
                  {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
            </SimpleGrid>
          </Card>

          {/* ---- Aperçu ---- */}
          <Card p="5">
            <SectionLabel mb="3">APERÇU — EN-TÊTE DE DOCUMENT</SectionLabel>
            <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p="4" bg="white">
              <HStack gap="3">
                {b.logo_path ? (
                  <PhotoImg storagePath={b.logo_path} ratio="1/1" w="52px" h="52px" />
                ) : (
                  <Center w="52px" h="52px" borderRadius="lg" flexShrink={0}
                    bg={b.color_primary} color="white"
                    fontWeight="800" fontSize="lg" fontFamily={b.font_title}>
                    {(previewName.match(/\b\w/g) || ['D']).slice(0, 2).join('').toUpperCase()}
                  </Center>
                )}
                <Box flex="1">
                  <Text fontFamily={b.font_title} fontWeight="700" fontSize="md"
                    color={b.color_primary}>{previewName}</Text>
                  {b.tagline && (
                    <Text fontFamily={b.font_body} fontSize="xs" color={b.color_secondary}>
                      {b.tagline}
                    </Text>
                  )}
                </Box>
                <Box px="2.5" py="1" borderRadius="full" fontSize="2xs" fontWeight="600"
                  color="white" bg={b.color_secondary} fontFamily={b.font_body}>
                  DOCUMENT
                </Box>
              </HStack>
              <Box mt="3" pt="3" borderTop={`2px solid ${b.color_primary}`}>
                <Text fontFamily={b.font_body} fontSize="2xs" color="gray.500">
                  {b.signature || 'Ligne de signature — pied de vos documents partagés'}
                </Text>
              </Box>
            </Box>
          </Card>
        </VStack>
      </SimpleGrid>

      {/* ---- suppression du logo : confirmation obligatoire ---- */}
      <ConfirmModal open={rmLogo} onClose={() => setRmLogo(false)}
        onConfirm={removeLogo} busy={busy}
        title="Supprimer le logo ?"
        confirmLabel="Oui, supprimer"
        message="Voulez-vous vraiment supprimer le logo du cabinet ? Il ne sera plus affiché sur les exports et documents (le fichier reste dans le stockage)." />
    </Box>
  )
}
