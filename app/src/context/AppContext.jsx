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
      if (!wsId) return
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', wsId)
        .maybeSingle()
      if (!alive) return
      setWorkspace(ws)
    })()
    return () => {
      alive = false
    }
  }, [session?.user?.id])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AppCtx.Provider value={{ session, loading, profile, workspace, signOut }}>
      {children}
    </AppCtx.Provider>
  )
}

export const useApp = () => useContext(AppCtx)
