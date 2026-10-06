import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { SITE_URL } from '@/config/brand'
import { getErrorMessage } from '@/utils/errors'
import { toast } from '@/store/toastStore'
import type { Profile } from '@/types/database'
import { AuthContext, type AuthContextValue } from './authContext'

/**
 * Supabase Auth is the source of truth for the session (JWT, verified by
 * the database on every request). The user's ROLE is read from
 * public.profiles. Remember: this only drives the UI - real authorization
 * is enforced by Row Level Security in Postgres (is_admin()).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [profileError, setProfileError] = useState<string | null>(null)
  const loadedFor = useRef<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

    if (error) {
      loadedFor.current = null // allow a retry
      setProfile(null)
      setProfileError(getErrorMessage(error, 'We could not load your account details.'))
      return
    }

    setProfileError(null)
    const row = data as Profile | null

    if (row?.is_disabled) {
      loadedFor.current = null
      setProfile(null)
      await supabase.auth.signOut()
      toast.error('This account has been disabled. Please contact support.')
      return
    }
    setProfile(row)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (!newSession) {
        loadedFor.current = null
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      const userId = newSession.user.id
      if (loadedFor.current === userId && event !== 'USER_UPDATED') {
        setLoading(false)
        return
      }
      loadedFor.current = userId
      setLoading(true)
      // Never call supabase APIs synchronously inside this callback (can deadlock).
      window.setTimeout(() => {
        void fetchProfile(userId).finally(() => setLoading(false))
      }, 0)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(async ({ email, password, fullName, phone }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: `${SITE_URL}/login`,
      },
    })
    if (error) throw error
    // With email confirmation on, an already-registered email returns a user with no identities.
    const alreadyRegistered = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
    return { alreadyRegistered, needsEmailConfirmation: !data.session && !alreadyRegistered }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      await supabase.auth.signOut({ scope: 'local' })
    }
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/reset-password`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    await fetchProfile(session.user.id)
  }, [session, fetchProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin' && !profile.is_disabled,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [session, profile, loading, profileError, signIn, signUp, signOut, sendPasswordReset, updatePassword, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
