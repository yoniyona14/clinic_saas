'use client'
import Nav from '@/components/Nav'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const THEME = {
  primary:   '#0d9488',
  primaryBg: '#f0fdfa',
  red:       '#ef4444',
  redBg:     '#fef2f2',
  green:     '#22c55e',
  greenBg:   '#f0fdf4',
  amber:     '#f59e0b',
  amberBg:   '#fffbeb',
  blue:      '#3b82f6',
  border:    '#e5e7eb',
  text:      '#111827',
  muted:     '#6b7280',
  white:     '#ffffff',
  bg:        '#f9fafb',
}

type Appointment = {
  id: string
  patient_id: string
  dentist_id: string
  appointment_date: string
  duration_minutes: number
  reason: string
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled'
  patient_name: string
  dentist_name: string
}

type Patient = {
  id: string
  first_name: string
  last_name: string
  phone: string
}

type Staff = { id: string; full_name: string; role: string }

const isToday = (d: string) => {
  const date  = new Date(d)
  const today = new Date()
  return date.getDate()     === today.getDate() &&
         date.getMonth()    === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

const STATUS = {
  scheduled: { label: 'Scheduled', color: '#3b82f6', bg: '#eff6ff' },
  completed: { label: 'Completed', color: '#22c55e', bg: '#f0fdf4' },
  no_show:   { label: 'No Show',   color: '#ef4444', bg: '#fef2f2' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f9fafb' },
}

// ==================
// RECURRING INTERVALS
// How often to repeat the appointment
// ==================
const INTERVALS = [
  { label: 'No repeat',     days: 0  },
  { label: 'Every week',    days: 7  },
  { label: 'Every 2 weeks', days: 14 },
  { label: 'Every 3 weeks', days: 21 }, // perfect for braces
  { label: 'Every month',   days: 30 },
  { label: 'Every 6 weeks', days: 42 },
  { label: 'Every 2 months',days: 60 },
  { label: 'Every 3 months',days: 90 },
]

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients,     setPatients]     = useState<Patient[]>([])
  const [staff,        setStaff]        = useState<Staff[]>([])
  const [clinicId,     setClinicId]     = useState('')
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [filter,       setFilter]       = useState<'today'|'upcoming'|'all'>('today')

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: staffData } = await supabase
        .from('staff')
        .select('clinic_id')
        .eq('email', user.email)
        .single()

      if (!staffData) { setLoading(false); return }
      const cid = staffData.clinic_id
      setClinicId(cid)

      const [apptRes, patientRes, staffRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, patients(first_name, last_name), staff(full_name)')
          .eq('clinic_id', cid)
          .order('appointment_date', { ascending: true }),

        // Fetch phone number too for search
        supabase
          .from('patients')
          .select('id, first_name, last_name, phone')
          .eq('clinic_id', cid),

        supabase
          .from('staff')
          .select('id, full_name, role')
          .eq('clinic_id', cid),
      ])

      if (apptRes.data) {
        const flat = apptRes.data.map((a: any) => ({
          ...a,
          patient_name: a.patients
            ? `${a.patients.first_name} ${a.patients.last_name}`
            : 'Unknown',
          dentist_name: a.staff?.full_name || 'Unassigned',
        }))
        setAppointments(flat)
      }

      if (patientRes.data) setPatients(patientRes.data as Patient[])
      if (staffRes.data)   setStaff(staffRes.data as Staff[])
      setLoading(false)
    }
    fetchData()
  }, [])

  const updateStatus = async (id: string, status: Appointment['status']) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status } : a)
      )
    }
  }

  const filtered = appointments.filter(a => {
    if (filter === 'today')    return isToday(a.appointment_date)
    if (filter === 'upcoming') return new Date(a.appointment_date) >= new Date()
    return true
  })

  const todayCount = appointments.filter(a => isToday(a.appointment_date)).length

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <PageLayout onLogout={handleLogout}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <p style={{ color: THEME.muted }}>Loading appointments...</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout onLogout={handleLogout}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '24px'
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: '0' }}>
              Appointments
            </h2>
            <p style={{ color: THEME.muted, fontSize: '14px', marginTop: '4px' }}>
              {todayCount} appointment{todayCount !== 1 ? 's' : ''} today
            </p>
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
            + Book Appointment
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {(['today', 'upcoming', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px', borderRadius: '999px', cursor: 'pointer',
                border: `1px solid ${filter === f ? THEME.primary : THEME.border}`,
                background: filter === f ? THEME.primaryBg : THEME.white,
                color: filter === f ? THEME.primary : THEME.muted,
                fontSize: '13px', fontWeight: '500', textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Appointments list */}
        {filtered.length === 0 ? (
          <div style={{
            background: THEME.white, borderRadius: '16px',
            border: `1px solid ${THEME.border}`,
            padding: '48px', textAlign: 'center'
          }}>
            <p style={{ color: THEME.muted, fontSize: '14px' }}>
              {filter === 'today'
                ? 'No appointments today.'
                : 'No appointments found.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(appt => {
              const s     = STATUS[appt.status]
              const today = isToday(appt.appointment_date)

              return (
                <div key={appt.id} style={{
                  background: THEME.white, borderRadius: '16px',
                  border: `1px solid ${today ? '#99f6e4' : THEME.border}`,
                  padding: '18px 20px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    {today && (
                      <span style={{
                        fontSize: '10px', fontWeight: '600', color: THEME.primary,
                        background: THEME.primaryBg, padding: '2px 8px',
                        borderRadius: '4px', display: 'inline-block', marginBottom: '6px'
                      }}>
                        TODAY
                      </span>
                    )}
                    <p
                      onClick={() => router.push(`/patients/${appt.patient_id}`)}
                      style={{
                        fontSize: '15px', fontWeight: '600',
                        color: THEME.text, margin: '0 0 6px', cursor: 'pointer'
                      }}
                    >
                      {appt.patient_name}
                    </p>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: THEME.muted }}>
                        {formatDateTime(appt.appointment_date)}
                      </span>
                      <span style={{ fontSize: '13px', color: THEME.muted }}>
                        {appt.duration_minutes} min
                      </span>
                      <span style={{ fontSize: '13px', color: THEME.muted }}>
                        {appt.dentist_name}
                      </span>
                      {appt.reason && (
                        <span style={{ fontSize: '13px', color: THEME.muted }}>
                          {appt.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: '8px'
                  }}>
                    <span style={{
                      fontSize: '12px', fontWeight: '500',
                      padding: '3px 10px', borderRadius: '999px',
                      background: s.bg, color: s.color
                    }}>
                      {s.label}
                    </span>

                    {appt.status === 'scheduled' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => updateStatus(appt.id, 'completed')}
                          style={{
                            fontSize: '12px', padding: '5px 10px',
                            borderRadius: '8px', border: 'none',
                            background: THEME.greenBg, color: THEME.green,
                            cursor: 'pointer', fontWeight: '500'
                          }}
                        >
                          Done
                        </button>
                        <button
                          onClick={() => updateStatus(appt.id, 'no_show')}
                          style={{
                            fontSize: '12px', padding: '5px 10px',
                            borderRadius: '8px', border: 'none',
                            background: THEME.redBg, color: THEME.red,
                            cursor: 'pointer', fontWeight: '500'
                          }}
                        >
                          No Show
                        </button>
                        <button
                          onClick={() => updateStatus(appt.id, 'cancelled')}
                          style={{
                            fontSize: '12px', padding: '5px 10px',
                            borderRadius: '8px', border: 'none',
                            background: THEME.bg, color: THEME.muted,
                            cursor: 'pointer', fontWeight: '500'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <BookModal
          clinicId={clinicId}
          patients={patients}
          staff={staff}
          onClose={() => setShowForm(false)}
          onSaved={(newAppts) => {
            // Could be multiple appointments if recurring
            setAppointments(prev => [...newAppts, ...prev])
            setShowForm(false)
          }}
        />
      )}
    </PageLayout>
  )
}

// ============================================
// BOOK APPOINTMENT MODAL
// Supports recurring intervals + phone search
// ============================================
function BookModal({ clinicId, patients, staff, onClose, onSaved }: {
  clinicId: string
  patients: Patient[]
  staff: Staff[]
  onClose: () => void
  onSaved: (appts: Appointment[]) => void
}) {
  // Patient search state
  const [phoneSearch,      setPhoneSearch]      = useState('')
  const [searchResults,    setSearchResults]    = useState<Patient[]>([])
  const [selectedPatient,  setSelectedPatient]  = useState<Patient | null>(null)

  // Appointment fields
  const [dentistId, setDentistId] = useState('')
  const [date,      setDate]      = useState('')
  const [time,      setTime]      = useState('09:00')
  const [duration,  setDuration]  = useState('30')
  const [reason,    setReason]    = useState('')
  const [interval,  setInterval]  = useState(0)   // days between recurring appointments
  const [recurring, setRecurring] = useState(1)   // how many total appointments to book
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const supabase = createClient()

  // ==================
  // PHONE SEARCH
  // Filter patients by phone number as user types
  // ==================
  const handlePhoneSearch = (value: string) => {
    setPhoneSearch(value)
    setSelectedPatient(null) // clear selection when searching

    if (!value.trim()) {
      setSearchResults([])
      return
    }

    // Filter patients whose phone contains the search value
    const results = patients.filter(p =>
      p.phone?.replace(/\s/g, '').includes(value.replace(/\s/g, ''))
    )
    setSearchResults(results.slice(0, 5)) // show max 5 results
  }

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p)
    setPhoneSearch(p.phone || '')
    setSearchResults([]) // hide dropdown
  }

  // ==================
  // SAVE — creates multiple appointments
  // if recurring is set
  // ==================
  const handleSave = async () => {
    if (!selectedPatient || !date) {
      setError('Please select a patient and date.')
      return
    }
    setSaving(true)
    setError('')

    // Build array of appointment dates
    // If interval = 0, just one appointment
    // If interval > 0, book multiple spaced out
    const dates: string[] = []
    const baseDate = new Date(`${date}T${time}:00`)

    for (let i = 0; i < recurring; i++) {
      const apptDate = new Date(baseDate)
      apptDate.setDate(apptDate.getDate() + (interval * i))
      dates.push(apptDate.toISOString())
    }

    // Insert all appointments at once
    const inserts = dates.map(d => ({
      clinic_id:        clinicId,
      patient_id:       selectedPatient.id,
      dentist_id:       dentistId || null,
      appointment_date: d,
      duration_minutes: parseInt(duration),
      reason:           reason.trim() || null,
      status:           'scheduled',
    }))

    const { data, error: saveError } = await supabase
      .from('appointments')
      .insert(inserts)
      .select('*, patients(first_name, last_name), staff(full_name)')

    if (saveError) {
      setError('Failed to book. Please try again.')
      setSaving(false)
      return
    }

    // Flatten joined data
    const flat = (data as any[]).map(a => ({
      ...a,
      patient_name: a.patients
        ? `${a.patients.first_name} ${a.patients.last_name}`
        : 'Unknown',
      dentist_name: a.staff?.full_name || 'Unassigned',
    }))

    onSaved(flat)
  }

  const intervalLabel = interval > 0 && recurring > 1
    ? `Will book ${recurring} appointments — ${INTERVALS.find(i => i.days === interval)?.label}`
    : ''

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: THEME.white, borderRadius: '16px',
        width: '100%', maxWidth: '480px',
        overflow: 'hidden', maxHeight: '90vh'
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: `1px solid ${THEME.border}`
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: THEME.text }}>
            Book Appointment
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            fontSize: '20px', cursor: 'pointer', color: THEME.muted
          }}>
            x
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '20px 24px', display: 'flex',
          flexDirection: 'column', gap: '16px',
          overflowY: 'auto', maxHeight: '65vh'
        }}>

          {error && (
            <div style={{
              background: THEME.redBg, color: THEME.red,
              padding: '10px 14px', borderRadius: '8px', fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {/* ── Patient search by phone ── */}
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Search Patient by Phone *</label>
            <input
              value={phoneSearch}
              onChange={e => handlePhoneSearch(e.target.value)}
              placeholder="Type phone number e.g. 0911..."
              style={inputStyle}
            />

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: THEME.white, border: `1px solid ${THEME.border}`,
                borderRadius: '10px', zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                overflow: 'hidden', marginTop: '4px'
              }}>
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: `1px solid ${THEME.border}`,
                      fontSize: '13px'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = THEME.bg)}
                    onMouseLeave={e => (e.currentTarget.style.background = THEME.white)}
                  >
                    <p style={{ margin: '0 0 2px', fontWeight: '500', color: THEME.text }}>
                      {p.first_name} {p.last_name}
                    </p>
                    <p style={{ margin: 0, color: THEME.muted, fontSize: '12px' }}>
                      {p.phone}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* No results message */}
            {phoneSearch.length > 2 && searchResults.length === 0 && !selectedPatient && (
              <p style={{ fontSize: '12px', color: THEME.red, margin: '4px 0 0' }}>
                No patient found with that number.
              </p>
            )}

            {/* Selected patient confirmation */}
            {selectedPatient && (
              <div style={{
                marginTop: '8px', background: THEME.primaryBg,
                border: `1px solid #99f6e4`, borderRadius: '8px',
                padding: '8px 12px', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '13px', color: THEME.primary, fontWeight: '500' }}>
                  Selected: {selectedPatient.first_name} {selectedPatient.last_name}
                </span>
                <button
                  onClick={() => { setSelectedPatient(null); setPhoneSearch('') }}
                  style={{ background: 'none', border: 'none', color: THEME.primary, cursor: 'pointer', fontSize: '16px' }}
                >
                  x
                </button>
              </div>
            )}
          </div>

          {/* Dentist */}
          <div>
            <label style={labelStyle}>Dentist</label>
            <select value={dentistId} onChange={e => setDentistId(e.target.value)} style={inputStyle}>
              <option value="">Unassigned</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          {/* Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>First Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={labelStyle}>Duration</label>
            <select value={duration} onChange={e => setDuration(e.target.value)} style={inputStyle}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          {/* ── Recurring interval ── */}
          <div style={{
            background: THEME.bg, borderRadius: '12px',
            padding: '14px 16px', border: `1px solid ${THEME.border}`
          }}>
            <label style={{ ...labelStyle, marginBottom: '12px' }}>
              Recurring Appointment
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: THEME.muted, display: 'block', marginBottom: '4px' }}>
                  Repeat every
                </label>
                <select
                  value={interval}
                  onChange={e => {
                    const val = parseInt(e.target.value)
                    setInterval(val)
                    // Reset recurring count if no interval
                    if (val === 0) setRecurring(1)
                  }}
                  style={inputStyle}
                >
                  {INTERVALS.map(i => (
                    <option key={i.days} value={i.days}>{i.label}</option>
                  ))}
                </select>
              </div>

              {/* Only show count if interval is set */}
              {interval > 0 && (
                <div>
                  <label style={{ fontSize: '12px', color: THEME.muted, display: 'block', marginBottom: '4px' }}>
                    Number of sessions
                  </label>
                  <select
                    value={recurring}
                    onChange={e => setRecurring(parseInt(e.target.value))}
                    style={inputStyle}
                  >
                    {[2,3,4,5,6,8,10,12,16,20,24].map(n => (
                      <option key={n} value={n}>{n} sessions</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Summary of what will be booked */}
            {intervalLabel && (
              <p style={{
                margin: '10px 0 0', fontSize: '12px',
                color: THEME.primary, fontWeight: '500'
              }}>
                {intervalLabel}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label style={labelStyle}>Reason</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Braces adjustment, Root canal follow-up..."
              style={inputStyle}
            />
          </div>

        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '16px 24px', borderTop: `1px solid ${THEME.border}`
        }}>
          <button onClick={onClose} style={{
            padding: '9px 16px', border: `1px solid ${THEME.border}`,
            borderRadius: '8px', background: 'none',
            fontSize: '13px', color: THEME.muted, cursor: 'pointer'
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 18px', border: 'none', borderRadius: '8px',
            background: saving ? '#99f6e4' : THEME.primary,
            color: THEME.white, fontSize: '13px',
            fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer'
          }}>
            {saving
              ? 'Booking...'
              : interval > 0 && recurring > 1
              ? `Book ${recurring} appointments`
              : 'Book Appointment'
            }
          </button>
        </div>

      </div>
    </div>
  )
}

// ============================================
// SHARED STYLES + LAYOUT
// ============================================
function PageLayout({ children, onLogout }: {
  children: React.ReactNode
  onLogout: () => void
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <Nav activePage="/appointments" />
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #e5e7eb', borderRadius: '8px',
  fontSize: '13px', color: '#111827',
  background: '#f9fafb', outline: 'none', boxSizing: 'border-box'
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '600',
  color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '6px'
}