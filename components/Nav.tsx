'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const THEME = {
  primary: '#0d9488',
  primaryBg: '#f0fdfa',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  white: '#ffffff',
  blue: '#3b82f6',
  blueBg: '#eff6ff',
}

export default function Nav({
  activePage,
}: {
  activePage: string
}) {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('staff')
        .select('role')
        .eq('email', user.email)
        .single()

      setRole((data as any)?.role || null)
      setLoading(false)
    }

    getRole()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isOwner = role === 'owner'
  const isReceptionist = role === 'receptionist'
  const isDentist = role === 'dentist'

  const links = loading
    ? []
    : [
        ...(isOwner
          ? [{ label: 'Analytics', href: '/dashboard' }]
          : []),

        ...(isReceptionist || isDentist
          ? [{ label: 'Home', href: '/home' }]
          : []),

        { label: 'Patients', href: '/patients' },

        { label: 'Appointments', href: '/appointments' },

        ...(isOwner || isReceptionist
          ? [{ label: 'Expenses', href: '/expenses' }]
          : []),
      ]

  return (
    <nav
      style={{
        background: THEME.white,
        borderBottom: `1px solid ${THEME.border}`,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '60px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        fontFamily: 'sans-serif',
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            background: THEME.primary,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}
        >
          🦷
        </div>

        <span
          style={{
            fontWeight: '700',
            color: THEME.text,
            fontSize: '15px',
          }}
        >
          DentaRecord
        </span>

        {!loading && role && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: '500',
              padding: '2px 8px',
              borderRadius: '999px',
              textTransform: 'capitalize',
              background: isOwner
                ? THEME.primaryBg
                : THEME.blueBg,
              color: isOwner
                ? THEME.primary
                : THEME.blue,
            }}
          >
            {role}
          </span>
        )}
      </div>

      {/* Links + logout */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
        }}
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              color:
                activePage === link.href
                  ? THEME.primary
                  : THEME.muted,
              fontSize: '14px',
              textDecoration: 'none',
              fontWeight:
                activePage === link.href
                  ? '600'
                  : '400',
            }}
          >
            {link.label}
          </a>
        ))}

        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: `1px solid ${THEME.border}`,
            color: THEME.muted,
            fontSize: '13px',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '8px',
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}