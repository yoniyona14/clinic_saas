'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const THEME = {
  primary:   '#0d9488',
  primaryBg: '#f0fdfa',
  red:       '#ef4444',
  redBg:     '#fef2f2',
  green:     '#22c55e',
  border:    '#e5e7eb',
  text:      '#111827',
  muted:     '#6b7280',
  white:     '#ffffff',
  bg:        '#f9fafb',
}

type Patient = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  phone: string
  email: string
  blood_type: string
  allergies: string[]
  notes: string
  clinic_id: string
  created_at: string
}

export default function PatientsPage() {
  const [patients,  setPatients]  = useState<Patient[]>([])
  const [filtered,  setFiltered]  = useState<Patient[]>([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [clinicId,  setClinicId]  = useState('')
  const [showForm,  setShowForm]  = useState(false)

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchPatients = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: staff } = await supabase
        .from('staff')
        .select('clinic_id')
        .eq('email', user.email)
        .single()

      if (!staff) { setLoading(false); return }
      setClinicId(staff.clinic_id)

      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', staff.clinic_id)
        .order('created_at', { ascending: false })

      if (data) {
        setPatients(data as Patient[])
        setFiltered(data as Patient[])
      }
      setLoading(false)
    }
    fetchPatients()
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    if (!value.trim()) { setFiltered(patients); return }
    const q = value.toLowerCase()
    setFiltered(patients.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    ))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <PageLayout onLogout={handleLogout} activePage="/patients">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <p style={{ color: THEME.muted }}>Loading patients...</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout onLogout={handleLogout} activePage="/patients">
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: '0' }}>Patients</h2>
            <p style={{ color: THEME.muted, fontSize: '14px', marginTop: '4px' }}>{patients.length} registered patients</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: THEME.primary, color: THEME.white,
              border: 'none', borderRadius: '10px',
              padding: '10px 18px', fontSize: '14px',
              fontWeight: '500', cursor: 'pointer'
            }}
          >
            + Add Patient
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, phone or email..."
          style={{
            width: '100%', maxWidth: '400px',
            padding: '10px 14px', border: `1px solid ${THEME.border}`,
            borderRadius: '10px', fontSize: '14px',
            marginBottom: '20px', outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{
            background: THEME.white, borderRadius: '16px',
            border: `1px solid ${THEME.border}`,
            padding: '48px', textAlign: 'center'
          }}>
            <p style={{ color: THEME.muted, fontSize: '14px' }}>
              {search ? 'No patients match your search.' : 'No patients yet. Add your first patient!'}
            </p>
          </div>
        ) : (
          <div style={{ background: THEME.white, borderRadius: '16px', border: `1px solid ${THEME.border}`, overflow: 'hidden' }}>

            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
              padding: '12px 20px', background: THEME.bg,
              borderBottom: `1px solid ${THEME.border}`,
              fontSize: '11px', fontWeight: '600',
              color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              <span>Patient</span>
              <span>Phone</span>
              <span>Blood Type</span>
              <span>Registered</span>
            </div>

            {/* Rows */}
            {filtered.map((p, i) => {
              const initials = `${p.first_name[0]}${p.last_name[0]}`.toUpperCase()
              const colors = ['#0d9488','#3b82f6','#8b5cf6','#f59e0b','#ec4899']
              const color  = colors[p.first_name.charCodeAt(0) % colors.length]

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/patients/${p.id}`)}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${THEME.border}` : 'none',
                    cursor: 'pointer', transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = THEME.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = THEME.white)}
                >
                  {/* Name + avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: color + '20', color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: '600', flexShrink: 0
                    }}>
                      {initials}
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: THEME.text, margin: '0' }}>
                        {p.first_name} {p.last_name}
                      </p>
                      {p.allergies && p.allergies.length > 0 && (
                        <p style={{ fontSize: '11px', color: THEME.red, margin: '2px 0 0' }}>
                          Allergic: {p.allergies.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <span style={{ fontSize: '13px', color: THEME.muted }}>{p.phone || '—'}</span>

                  <span>
                    {p.blood_type ? (
                      <span style={{
                        background: '#fef2f2', color: THEME.red,
                        padding: '2px 8px', borderRadius: '6px',
                        fontSize: '12px', fontWeight: '500'
                      }}>
                        {p.blood_type}
                      </span>
                    ) : '—'}
                  </span>

                  <span style={{ fontSize: '13px', color: THEME.muted }}>
                    {new Date(p.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <AddPatientModal
          clinicId={clinicId}
          onClose={() => setShowForm(false)}
          onSaved={(newP) => {
            const updated = [newP, ...patients]
            setPatients(updated)
            setFiltered(updated)
            setShowForm(false)
          }}
        />
      )}
    </PageLayout>
  )
}

// ============================================
// ADD PATIENT MODAL
// ============================================
function AddPatientModal({ clinicId, onClose, onSaved }: {
  clinicId: string
  onClose: () => void
  onSaved: (p: Patient) => void
}) {
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [dob,        setDob]        = useState('')
  const [gender,     setGender]     = useState('female')
  const [phone,      setPhone]      = useState('')
  const [email,      setEmail]      = useState('')
  const [bloodType,  setBloodType]  = useState('')
  const [allergies,  setAllergies]  = useState('')
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const supabase = createClient()

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    setSaving(true)
    setError('')

    const allergiesArr = allergies.split(',').map(a => a.trim()).filter(Boolean)

    const { data, error: saveError } = await supabase
      .from('patients')
      .insert({
        clinic_id:     clinicId,
        first_name:    firstName.trim(),
        last_name:     lastName.trim(),
        date_of_birth: dob || null,
        gender,
        phone:         phone.trim() || null,
        email:         email.trim() || null,
        blood_type:    bloodType || null,
        allergies:     allergiesArr,
        notes:         notes.trim() || null,
      })
      .select()
      .single()

    if (saveError) { setError('Failed to save patient.'); setSaving(false); return }
    onSaved(data as Patient)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: THEME.white, borderRadius: '16px',
        width: '100%', maxWidth: '480px', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: `1px solid ${THEME.border}`
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: THEME.text }}>New Patient</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.muted }}>x</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
          {error && (
            <div style={{ background: THEME.redBg, color: THEME.red, padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Amara" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Tesfaye" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)} style={inputStyle}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251 9XX XXX XXX" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Blood Type</label>
              <select value={bloodType} onChange={e => setBloodType(e.target.value)} style={inputStyle}>
                <option value="">Unknown</option>
                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Allergies (comma separated)</label>
              <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Penicillin, Latex" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." rows={3} style={{ ...inputStyle, resize: 'none' }} />
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '16px 24px', borderTop: `1px solid ${THEME.border}`
        }}>
          <button onClick={onClose} style={{ padding: '9px 16px', border: `1px solid ${THEME.border}`, borderRadius: '8px', background: 'none', fontSize: '13px', color: THEME.muted, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', border: 'none', borderRadius: '8px', background: saving ? '#99f6e4' : THEME.primary, color: THEME.white, fontSize: '13px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Patient'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// SHARED STYLES + LAYOUT
// ============================================
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: `1px solid ${THEME.border}`, borderRadius: '8px',
  fontSize: '13px', color: THEME.text,
  background: THEME.bg, outline: 'none', boxSizing: 'border-box'
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '600',
  color: THEME.muted, textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '6px'
}

function PageLayout({ children, onLogout, activePage }: {
  children: React.ReactNode
  onLogout: () => void
  activePage: string
}) {
  const links = [
    { label: 'Analytics',    href: '/dashboard'    },
    { label: 'Patients',     href: '/patients'     },
    { label: 'Appointments', href: '/appointments' },
    { label: 'Expenses',     href: '/expenses'     },
  ]

  return (
    <div style={{ minHeight: '100vh', background: THEME.bg, fontFamily: 'sans-serif' }}>
      <nav style={{
        background: THEME.white, borderBottom: `1px solid ${THEME.border}`,
        padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '60px',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: THEME.primary, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
            🦷
          </div>
          <span style={{ fontWeight: '700', color: THEME.text, fontSize: '15px' }}>DentaRecord</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {links.map(link => (
            <a key={link.href} href={link.href} style={{
              color: activePage === link.href ? THEME.primary : THEME.muted,
              fontSize: '14px', textDecoration: 'none',
              fontWeight: activePage === link.href ? '600' : '400'
            }}>
              {link.label}
            </a>
          ))}
          <button onClick={onLogout} style={{
            background: 'none', border: `1px solid ${THEME.border}`,
            color: THEME.muted, fontSize: '13px',
            cursor: 'pointer', padding: '6px 12px', borderRadius: '8px'
          }}>
            Sign out
          </button>
        </div>
      </nav>
      {children}
    </div>
  )
}