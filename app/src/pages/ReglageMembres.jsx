// Route /reglage/membres — équipe du workspace.
// Liste les membres (workspace_members + profiles), permet de créer un vrai
// compte (auth.signUp) rattaché au workspace, de changer un rôle et de retirer
// un membre (confirmations obligatoires via ConfirmModal).
import { useEffect, useState } from 'react'
import { Box, Button, Center, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  FiArrowLeft, FiUsers, FiUserPlus, FiTrash2, FiShield, FiClock, FiMail,
  FiCheck, FiAlertCircle, FiRefreshCw,
} from 'react-icons/fi'
import {
  Card, Tag, PageHeader, HelpButton, PrimaryButton, Modal, Select, Field,
  Tip, ConfirmModal, ago,
} from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import {
  listWorkspaceMembers, createMemberAccount, updateMemberRole, removeWorkspaceMember,
} from '../api'

const ROLES = [
  ['owner', 'Propriétaire', 'amber'],
  ['admin', 'Administrateur', 'blue'],
  ['member', 'Membre', 'gray'],
]
const roleTag = (r) => ROLES.find(([k]) => k === r) || ROLES[2]

export default function ReglageMembres() {
  const { workspace, session } = useApp()
  const wsId = workspace?.id
  const myId = session?.user?.id
  const [members, setMembers] = useState([])
  const [invite, setInvite] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { ok, msg }
  const [rmMember, setRmMember] = useState(null)

  const reload = async () => {
    if (!wsId) return
    setMembers(await listWorkspaceMembers(wsId))
  }
  useEffect(() => { reload() }, [wsId]) // eslint-disable-line

  const openInvite = () => {
    setForm({ full_name: '', email: '', password: '', role: 'member' })
    setResult(null); setInvite(true)
  }

  const genPassword = () => {
    const p = 'Dp' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10)
    setForm({ ...form, password: p })
  }

  const create = async () => {
    if (!form?.full_name.trim() || !form.email.trim() || form.password.length < 6) return
    setBusy(true); setResult(null)
    const r = await createMemberAccount(wsId, {
      email: form.email.trim(), password: form.password,
      full_name: form.full_name.trim(), role: form.role,
    })
    setBusy(false)
    if (r?.error) { setResult({ ok: false, msg: r.error }); return }
    setResult({
      ok: true,
      msg: r.needsConfirm
        ? `Compte créé pour ${form.email} — un e-mail de confirmation lui a été envoyé.`
        : `Compte créé pour ${form.email} — il peut se connecter immédiatement.`,
    })
    setForm({ full_name: '', email: '', password: '', role: 'member' })
    reload()
  }

  const setRole = async (m, role) => {
    await updateMemberRole(wsId, m.user_id, role)
    reload()
  }

  const remove = async () => {
    if (!rmMember) return
    setBusy(true)
    await removeWorkspaceMember(wsId, rmMember.user_id)
    setBusy(false); setRmMember(null); reload()
  }

  const memberName = (m) =>
    m.profile?.full_name || m.profile?.display_name || `Membre ${m.user_id.slice(0, 6)}`
  const initials = (m) =>
    (memberName(m).match(/\b\w/g) || ['?']).slice(0, 2).join('').toUpperCase()

  return (
    <Box w="100%" px="6" py="6">
      <Link to="/reglage">
        <Button size="sm" variant="ghost" color="gray.500" mb="2"><FiArrowLeft /> Réglages</Button>
      </Link>
      <PageHeader
        icon={FiUsers} title="Membres de l'équipe"
        subtitle="Gérez les accès de votre équipe au cabinet"
      >
        <HelpButton />
        <PrimaryButton icon={FiUserPlus} onClick={openInvite}>Créer un compte</PrimaryButton>
      </PageHeader>

      <Card overflow="hidden" mt="4">
        <VStack align="stretch" gap="0">
          {members.map((m, i) => {
            const [roleKey, roleLabel, roleColor] = roleTag(m.role)
            const isMe = m.user_id === myId
            const isOwner = m.role === 'owner'
            return (
              <HStack key={m.user_id} px="4" py="3.5" gap="3"
                borderTop={i > 0 ? '1px solid' : 'none'} borderColor="gray.100">
                <Center w="38px" h="38px" borderRadius="full" bg={C.softBlue} color={C.primary}
                  fontSize="sm" fontWeight="700" flexShrink={0}>
                  {initials(m)}
                </Center>
                <Box flex="1" minW="0">
                  <HStack gap="2">
                    <Text fontSize="sm" fontWeight="600" color={C.ink} isTruncated>{memberName(m)}</Text>
                    {isMe && <Tag color="blue">Vous</Tag>}
                    <Tag color={roleColor}>
                      <FiShield style={{ marginRight: 3 }} />{roleLabel}
                    </Tag>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {m.profile?.profession ? `${m.profile.profession} · ` : ''}
                    <FiClock style={{ display: 'inline' }} /> membre {ago(m.created_at)}
                  </Text>
                </Box>
                {!isOwner && (
                  <HStack gap="2">
                    <Select h="30px" fontSize="xs" value={m.role}
                      aria-label={`Rôle de ${memberName(m)}`}
                      onChange={(e) => setRole(m, e.target.value)}>
                      <option value="member">Membre</option>
                      <option value="admin">Administrateur</option>
                    </Select>
                    <Tip label="Retirer ce membre du cabinet">
                      <Box as="button" aria-label={`Retirer ${memberName(m)}`} p="1" color="gray.400"
                        cursor="pointer" _hover={{ color: 'red.500' }}
                        onClick={() => setRmMember(m)}>
                        <FiTrash2 size={14} />
                      </Box>
                    </Tip>
                  </HStack>
                )}
              </HStack>
            )
          })}
          {!members.length && (
            <Text fontSize="sm" color="gray.500" textAlign="center" py="8">
              Aucun membre — créez le premier compte de votre équipe.
            </Text>
          )}
        </VStack>
      </Card>

      <Text fontSize="2xs" color="gray.400" mt="3">
        Le propriétaire ne peut pas être retiré ni rétrogradé. Un membre retiré perd
        l'accès au workspace mais conserve son compte.
      </Text>

      {/* ---- créer un compte membre ---- */}
      <Modal open={invite} onClose={() => setInvite(false)}
        title="Créer un compte membre" subtitle="Le compte est créé immédiatement et rattaché au cabinet"
        width="460px"
        footer={<>
          <Text fontSize="2xs" color="gray.400">Mot de passe 6+ caractères</Text>
          <PrimaryButton icon={FiUserPlus} onClick={create}
            disabled={busy || !form?.full_name.trim() || !form?.email.trim() || (form?.password?.length || 0) < 6}>
            {busy ? 'Création…' : 'Créer le compte'}
          </PrimaryButton>
        </>}>
        {result && (
          <HStack mb="3" px="3" py="2" borderRadius="md" gap="2"
            bg={result.ok ? C.greenBg : 'red.50'}>
            <Box as={result.ok ? FiCheck : FiAlertCircle} fontSize="sm" flexShrink={0}
              color={result.ok ? C.greenText : 'red.500'} />
            <Text fontSize="xs" color={result.ok ? C.greenText : 'red.500'}>{result.msg}</Text>
          </HStack>
        )}
        <VStack align="stretch" gap="3">
          <Field label="Nom complet">
            <Input fontSize="sm" placeholder="ex. Julie Martin" autoFocus
              value={form?.full_name || ''}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="E-mail du compte">
            <Input type="email" fontSize="sm" placeholder="prenom@cabinet.fr"
              value={form?.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Mot de passe provisoire">
            <HStack>
              <Input fontSize="sm" placeholder="6+ caractères"
                value={form?.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Button variant="outline" size="sm" onClick={genPassword}>
                <FiRefreshCw /> Générer
              </Button>
            </HStack>
          </Field>
          <Field label="Rôle dans le cabinet">
            <Select w="100%" value={form?.role || 'member'}
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">Membre — accès aux dossiers et photos</option>
              <option value="admin">Administrateur — + réglages et membres</option>
            </Select>
          </Field>
          <HStack bg={C.softBlue} borderRadius="md" px="3" py="2" gap="2">
            <Box as={FiMail} color={C.primary} fontSize="sm" flexShrink={0} />
            <Text fontSize="2xs" color="gray.600">
              Communiquez l'identifiant et le mot de passe au membre — il pourra
              les changer après sa première connexion.
            </Text>
          </HStack>
        </VStack>
      </Modal>

      {/* ---- retrait : confirmation obligatoire ---- */}
      <ConfirmModal open={!!rmMember} onClose={() => setRmMember(null)}
        onConfirm={remove} busy={busy}
        title="Retirer le membre ?"
        confirmLabel="Oui, retirer"
        message={`Voulez-vous vraiment retirer « ${rmMember ? memberName(rmMember) : ''} » du cabinet ? Il perdra immédiatement l'accès au workspace (son compte utilisateur est conservé).`} />
    </Box>
  )
}
