import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AppCtx = createContext({
  session: null,
  loading: true,
  profile: null,
  workspace: null,
  signOut: async () => {},
})

export function AppProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [wsLoaded, setWsLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      setWorkspace(null)
      setWsLoaded(false)
      return
    }
    let alive = true
    ;(async () => {
      const uid = session.user.id
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle()
      if (!alive) return
      setProfile(prof)
      const { data: mem } = await supabase
        .from('workspace_members')
        .select('workspace_id,role')
        .eq('user_id', uid)
        .order('created_at', { ascending: true })
        .limit(1)
      const wsId = mem && mem[0] && mem[0].workspace_id
      if (wsId) {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', wsId)
          .maybeSingle()
        if (!alive) return
        setWorkspace(ws)
      }
      if (alive) setWsLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [session?.user?.id])

  // Bootstrap : un compte sans cabinet ne peut rien faire — on en crée un.
  const createWorkspace = async (name) => {
    const uid = session.user.id
    const { data: ws, error } = await supabase
      .from('workspaces').insert({ name }).select().single()
    if (error) throw error
    const { error: mErr } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: ws.id, user_id: uid, role: 'owner' })
    if (mErr) throw mErr
    setWorkspace(ws)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AppCtx.Provider value={{ session, loading, profile, workspace, wsLoaded, createWorkspace, signOut }}>
      {children}
    </AppCtx.Provider>
  )
}

export const useApp = () => useContext(AppCtx)
