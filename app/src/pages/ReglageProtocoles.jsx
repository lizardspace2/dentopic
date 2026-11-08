// Route /reglage/protocoles — guides de prise de vue standardisés.
// CRUD protocols + protocol_steps (ordonnés), protocole par défaut,
// confirmations obligatoires (ConfirmModal) sur les suppressions.
import { useEffect, useState } from 'react'
import {
  Box, Center, HStack, Input, Text, Textarea, VStack,
} from '@chakra-ui/react'
import {
  FiFileText, FiPlus, FiTrash2, FiEdit2, FiCheck,
  FiChevronUp, FiChevronDown, FiStar, FiCamera, FiAlertCircle,
} from 'react-icons/fi'
import { ReglageNav } from '../components/ReglageNav'
import {
  Card, Tag, PageHeader, HelpButton, PrimaryButton, Modal, Select, Field,
  Tip, ConfirmModal,
} from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import {
  listProtocols, createProtocol, updateProtocol, setDefaultProtocol,
  deleteProtocol, addProtocolStep, updateProtocolStep, deleteProtocolStep,
} from '../api'

// Valeurs autorisées par le CHECK expected_photo_class
const CLASSES = [
  ['portrait', 'Portrait'], ['smile', 'Sourire'], ['intraoral', 'Intra-orale'],
  ['occlusal', 'Occlusale'], ['radiograph', 'Radiographie'], ['document', 'Document'],
]
const classLabel = (c) => CLASSES.find(([k]) => k === c)?.[1] || c

export default function ReglageProtocoles() {
  const { workspace } = useApp()
  const wsId = workspace?.id
  const [protocols, setProtocols] = useState([])
  const [selId, setSelId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editProto, setEditProto] = useState(null)   // null | {} (création) | protocol
  const [editStep, setEditStep] = useState(null)     // null | {} (ajout) | step
  const [rmProto, setRmProto] = useState(null)
  const [rmStep, setRmStep] = useState(null)

  const reload = async () => {
    if (!wsId) return
    const list = await listProtocols(wsId)
    setProtocols(list)
    if (!selId && list.length) setSelId(list[0].id)
    if (selId && !list.find((p) => p.id === selId)) setSelId(list[0]?.id || null)
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  const sel = protocols.find((p) => p.id === selId)

  // ---- protocole ----
  const saveProto = async () => {
    if (!editProto?.name?.trim()) return
    setBusy(true)
    if (editProto.id) await updateProtocol(editProto.id, { name: editProto.name.trim(), description: editProto.description })
    else await createProtocol(wsId, { name: editProto.name.trim(), description: editProto.description })
    setBusy(false); setEditProto(null); reload()
  }
  const rmProtocol = async () => {
    setBusy(true)
    await deleteProtocol(rmProto.id)
    setBusy(false); setRmProto(null); reload()
  }
  const makeDefault = async (p) => { await setDefaultProtocol(wsId, p.id); reload() }

  // ---- étape ----
  const saveStep = async () => {
    if (!editStep?.name?.trim()) return
    setBusy(true)
    const fields = {
      name: editStep.name.trim(),
      expected_photo_class: editStep.expected_photo_class || 'intraoral',
      required: !!editStep.required,
      instructions: editStep.instructions || '',
    }
    if (editStep.id) await updateProtocolStep(editStep.id, fields)
    else await addProtocolStep(selId, fields)
    setBusy(false); setEditStep(null); reload()
  }
  const rmStepFn = async () => {
    setBusy(true)
    await deleteProtocolStep(rmStep.id)
    setBusy(false); setRmStep(null); reload()
  }
  const move = async (step, dir) => {
    const steps = sel.steps
    const idx = steps.findIndex((s) => s.id === step.id)
    const other = steps[idx + dir]
    if (!other) return
    setBusy(true)
    await updateProtocolStep(step.id, { position: other.position })
    await updateProtocolStep(other.id, { position: step.position })
    setBusy(false); reload()
  }

  return (
    <Box w="100%" px="6" py="6">
      <ReglageNav />
      <PageHeader
        icon={FiFileText} title="Protocoles"
        subtitle="Guides de prise de vue standardisés — utilisés dans l'acquisition"
      >
        <HelpButton />
        <PrimaryButton icon={FiPlus} onClick={() => setEditProto({ name: '', description: '' })}>
          Nouveau protocole
        </PrimaryButton>
      </PageHeader>

      <HStack align="start" gap="5" mt="4">
        {/* ---- liste des protocoles ---- */}
        <VStack align="stretch" gap="3" w="320px" flexShrink={0}>
          {protocols.map((p) => (
            <Card key={p.id} p="4" cursor="pointer"
              border={p.id === selId ? `2px solid ${C.primary}` : undefined}
              onClick={() => setSelId(p.id)}>
              <HStack gap="2" mb="1">
                <Text fontSize="sm" fontWeight="700" color={C.ink} flex="1" isTruncated>{p.name}</Text>
                {p.is_default && <Tag color="amber"><FiStar style={{ marginRight: 3 }} />Défaut</Tag>}
              </HStack>
              <Text fontSize="2xs" color="gray.500" mb="2">
                {p.steps.length} vue{p.steps.length > 1 ? 's' : ''}
                {p.description ? ` · ${p.description}` : ''}
              </Text>
              <HStack gap="1">
                {!p.is_default && (
                  <Tip label="Définir comme protocole par défaut">
                    <Box as="button" aria-label={`Défaut ${p.name}`} p="1" color="gray.400"
                      cursor="pointer" _hover={{ color: 'amber.500' }}
                      onClick={(e) => { e.stopPropagation(); makeDefault(p) }}>
                      <FiStar size={13} />
                    </Box>
                  </Tip>
                )}
                <Tip label="Modifier le protocole">
                  <Box as="button" aria-label={`Modifier ${p.name}`} p="1" color="gray.400"
                    cursor="pointer" _hover={{ color: C.primary }}
                    onClick={(e) => { e.stopPropagation(); setEditProto({ ...p }) }}>
                    <FiEdit2 size={13} />
                  </Box>
                </Tip>
                <Tip label="Supprimer le protocole">
                  <Box as="button" aria-label={`Supprimer ${p.name}`} p="1" color="gray.400"
                    cursor="pointer" _hover={{ color: 'red.500' }}
                    onClick={(e) => { e.stopPropagation(); setRmProto(p) }}>
                    <FiTrash2 size={13} />
                  </Box>
                </Tip>
              </HStack>
            </Card>
          ))}
          {!protocols.length && (
            <Card p="6">
              <Center flexDirection="column" gap="2" color="gray.400">
                <Box as={FiCamera} fontSize="xl" />
                <Text fontSize="xs" textAlign="center">
                  Aucun protocole — créez un guide de prise de vue.
                </Text>
              </Center>
            </Card>
          )}
        </VStack>

        {/* ---- étapes du protocole sélectionné ---- */}
        <Card flex="1" overflow="hidden">
          {sel ? (
            <VStack align="stretch" gap="0">
              <HStack px="4" py="3" borderBottom="1px solid" borderColor="gray.100">
                <Box flex="1">
                  <Text fontSize="sm" fontWeight="700" color={C.ink}>{sel.name}</Text>
                  <Text fontSize="2xs" color="gray.500">
                    Les étapes s'affichent dans l'ordre pendant l'acquisition — les photos
                    importées y sont rattachées automatiquement.
                  </Text>
                </Box>
                <PrimaryButton icon={FiPlus}
                  onClick={() => setEditStep({ name: '', expected_photo_class: 'intraoral', required: true, instructions: '' })}>
                  Ajouter une étape
                </PrimaryButton>
              </HStack>
              {sel.steps.map((s, i) => (
                <HStack key={s.id} px="4" py="3" gap="3"
                  borderTop={i > 0 ? '1px solid' : 'none'} borderColor="gray.100">
                  <Center w="26px" h="26px" borderRadius="full" bg={C.softBlue}
                    color={C.primary} fontSize="2xs" fontWeight="700" flexShrink={0}>
                    {i + 1}
                  </Center>
                  <Box flex="1" minW="0">
                    <HStack gap="2">
                      <Text fontSize="sm" fontWeight="600" color={C.ink}>{s.name}</Text>
                      <Tag color="blue">{classLabel(s.expected_photo_class)}</Tag>
                      {s.required && <Tag color="red">Requis</Tag>}
                    </HStack>
                    {s.instructions && (
                      <Text fontSize="2xs" color="gray.500" mt="0.5">{s.instructions}</Text>
                    )}
                  </Box>
                  <HStack gap="1">
                    <Tip label="Monter"><Box as="button" aria-label={`Monter ${s.name}`}
                      p="1" color="gray.400" cursor={i === 0 ? 'not-allowed' : 'pointer'}
                      opacity={i === 0 ? 0.3 : 1} _hover={i ? { color: C.primary } : {}}
                      disabled={i === 0 || busy} onClick={() => move(s, -1)}>
                      <FiChevronUp size={14} /></Box></Tip>
                    <Tip label="Descendre"><Box as="button" aria-label={`Descendre ${s.name}`}
                      p="1" color="gray.400" cursor={i === sel.steps.length - 1 ? 'not-allowed' : 'pointer'}
                      opacity={i === sel.steps.length - 1 ? 0.3 : 1}
                      _hover={i < sel.steps.length - 1 ? { color: C.primary } : {}}
                      disabled={i === sel.steps.length - 1 || busy} onClick={() => move(s, 1)}>
                      <FiChevronDown size={14} /></Box></Tip>
                    <Tip label="Modifier l'étape">
                      <Box as="button" aria-label={`Modifier étape ${s.name}`} p="1" color="gray.400"
                        cursor="pointer" _hover={{ color: C.primary }}
                        onClick={() => setEditStep({ ...s })}>
                        <FiEdit2 size={13} />
                      </Box>
                    </Tip>
                    <Tip label="Supprimer l'étape">
                      <Box as="button" aria-label={`Supprimer étape ${s.name}`} p="1" color="gray.400"
                        cursor="pointer" _hover={{ color: 'red.500' }}
                        onClick={() => setRmStep(s)}>
                        <FiTrash2 size={13} />
                      </Box>
                    </Tip>
                  </HStack>
                </HStack>
              ))}
              {!sel.steps.length && (
                <Text fontSize="sm" color="gray.500" textAlign="center" py="8">
                  Aucune étape — ajoutez la première vue du guide.
                </Text>
              )}
            </VStack>
          ) : (
            <Center py="16" color="gray.400">
              <Text fontSize="sm">Sélectionnez ou créez un protocole.</Text>
            </Center>
          )}
        </Card>
      </HStack>

      {/* ---- modal protocole ---- */}
      <Modal open={!!editProto} onClose={() => setEditProto(null)}
        title={editProto?.id ? 'Modifier le protocole' : 'Nouveau protocole'}
        subtitle="Guide de prise de vue standardisé"
        footer={<>
          <Box />
          <PrimaryButton icon={FiCheck} onClick={saveProto}
            disabled={busy || !editProto?.name?.trim()}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </PrimaryButton>
        </>}>
        <VStack align="stretch" gap="3">
          <Field label="Nom du protocole">
            <Input fontSize="sm" placeholder="ex. Esthétique — 8 vues" autoFocus
              value={editProto?.name || ''}
              onChange={(e) => setEditProto({ ...editProto, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea fontSize="sm" rows={2} placeholder="Documentation du sourire, cas implantaire…"
              value={editProto?.description || ''}
              onChange={(e) => setEditProto({ ...editProto, description: e.target.value })} />
          </Field>
        </VStack>
      </Modal>

      {/* ---- modal étape ---- */}
      <Modal open={!!editStep} onClose={() => setEditStep(null)}
        title={editStep?.id ? "Modifier l'étape" : 'Ajouter une étape'}
        subtitle="Vue attendue pendant la session de capture"
        footer={<>
          <Box />
          <PrimaryButton icon={FiCheck} onClick={saveStep}
            disabled={busy || !editStep?.name?.trim()}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </PrimaryButton>
        </>}>
        <VStack align="stretch" gap="3">
          <Field label="Nom de la vue">
            <Input fontSize="sm" placeholder="ex. Intra-orale de face" autoFocus
              value={editStep?.name || ''}
              onChange={(e) => setEditStep({ ...editStep, name: e.target.value })} />
          </Field>
          <Field label="Type de photo attendu">
            <Select w="100%" value={editStep?.expected_photo_class || 'intraoral'}
              aria-label="Type de photo"
              onChange={(e) => setEditStep({ ...editStep, expected_photo_class: e.target.value })}>
              {CLASSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Consignes de cadrage">
            <Textarea fontSize="sm" rows={3}
              placeholder="ex. Rétracteurs en place, centrée sur les dents antérieures."
              value={editStep?.instructions || ''}
              onChange={(e) => setEditStep({ ...editStep, instructions: e.target.value })} />
          </Field>
          <HStack as="label" gap="2" cursor="pointer">
            <Box as="input" type="checkbox" checked={!!editStep?.required}
              aria-label="Vue obligatoire"
              onChange={(e) => setEditStep({ ...editStep, required: e.target.checked })} />
            <Text fontSize="sm" color={C.ink}>Vue obligatoire — la session la demande avant de conclure</Text>
          </HStack>
        </VStack>
      </Modal>

      {/* ---- confirmations obligatoires ---- */}
      <ConfirmModal open={!!rmProto} onClose={() => setRmProto(null)}
        onConfirm={rmProtocol} busy={busy}
        title="Supprimer le protocole ?"
        confirmLabel="Oui, supprimer"
        message={`Voulez-vous vraiment supprimer « ${rmProto?.name || ''} » ? Ses ${rmProto?.steps?.length || 0} étape(s) seront supprimées — les photos déjà rattachées sont conservées.`} />
      <ConfirmModal open={!!rmStep} onClose={() => setRmStep(null)}
        onConfirm={rmStepFn} busy={busy}
        title="Supprimer l'étape ?"
        confirmLabel="Oui, supprimer"
        message={`Voulez-vous vraiment supprimer l'étape « ${rmStep?.name || ''} » du guide ?`} />
    </Box>
  )
}
