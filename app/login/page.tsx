'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const THEME = {
  primary: '#0d9488',
  border:  '#e5e7eb',
  text:    '#111827',
  muted:   '#6b7280',
  white:   '#ffffff',
  bg:      '#f9fafb',
  red:     '#ef4444',
  redBg:   '#fef2f2',
}

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const router   = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Step 1 — sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email, password,
    })

    if (signInError) {
      setError('Incorrect email or password. Please try again.')
      setLoading(false)
      return
    }

    // Step 2 — get role to decide where to redirect
    const { data: staffData } = await supabase
      .from('staff')
      .select('role')
      .eq('email', email)
      .single()

    const role = (staffData as any)?.role

    // Step 3 — redirect based on role
    if (role === 'owner') {
      router.push('/dashboard')
    } else {
      // Receptionist and dentist go to home screen
      router.push('/home')
    }

    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: THEME.bg,
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', width: '56px', height: '56px',
            background: THEME.primary, borderRadius: '16px', marginBottom: '16px'
          }}>
            <span style={{ fontSize: '24px' }}>🦷</span>
          </div>
          <h1 style={{
            fontSize: '24px', fontWeight: '700',
            color: THEME.text, margin: '0'
          }}>
            DentaRecord
          </h1>
          <p style={{ color: THEME.muted, marginTop: '4px', fontSize: '14px' }}>
            Sign in to your clinic dashboard
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: THEME.white, borderRadius: '16px',
          border: `1px solid ${THEME.border}`, padding: '32px'
        }}>
          <form onSubmit={handleLogin} style={{
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>

            {error && (
              <div style={{
                background: THEME.redBg, border: `1px solid #fecaca`,
                color: THEME.red, padding: '12px 16px',
                borderRadius: '8px', fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{
                display: 'block', fontSize: '14px',
                fontWeight: '500', color: THEME.text, marginBottom: '6px'
              }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="clinic@example.com"
                required
                style={{
                  width: '100%', padding: '10px 14px',
                  border: `1px solid ${THEME.border}`,
                  borderRadius: '8px', fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: '14px',
                fontWeight: '500', color: THEME.text, marginBottom: '6px'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '10px 14px',
                  border: `1px solid ${THEME.border}`,
                  borderRadius: '8px', fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#99f6e4' : THEME.primary,
                color: THEME.white, border: 'none',
                borderRadius: '8px', fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>
        </div>

        <p style={{
          textAlign: 'center', fontSize: '12px',
          color: THEME.muted, marginTop: '24px'
        }}>
          Need an account? Contact your clinic administrator.
        </p>

      </div>
    </div>
  )
}