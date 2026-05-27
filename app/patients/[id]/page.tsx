'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  blueBg:    '#eff6ff',
  border:    '#e5e7eb',
  text:      '#111827',
  muted:     '#6b7280',
  white:     '#ffffff',
  bg:        '#f9fafb',
}

type Patient = {
  id: string
  clinic_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  phone: string
  email: string
  blood_type: string
  allergies: string[]
  notes: string
  created_at: string
}

type Treatment = {
  id: string
  treatment_type: string
  tooth_area: string
  notes: string
  cost: number
  status: 'planned' | 'in_progress' | 'completed'
  treatment_date: string
}

type Invoice = {
  id: string
  treatment_id: string
  amount: number
  paid_amount: number
  payment_method: string
  status: 'unpaid' | 'partial' | 'paid'
  created_at: string
}

const TREATMENT_TYPES = [
  'Cleaning', 'Filling', 'Root Canal', 'Extraction',
  'Crown', 'Whitening', 'X-Ray', 'Consultation',
  'Braces', 'Bracket Replacement', 'Implant', 'Other'
]

const PAYMENT_METHODS = [
  { value: 'cash',         label: 'Cash'         },
  { value: 'telebirr',     label: 'Telebirr'     },
  { value: 'cbe_birr',     label: 'CBE Birr'     },
  { value: 'bank_transfer',label: 'Bank Transfer' },
  { value: 'other',        label: 'Other'        },
]

const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

const formatETB = (n: number) =>
  `ETB ${Number(n).toLocaleString('en-ET')}`

export default function PatientRecordPage() {
  const [patient,    setPatient]    = useState<Patient | null>(null)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [invoices,   setInvoices]   = useState<Invoice[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<'treatments' | 'invoices' | 'notes'>('treatments')
  const [showTreatmentForm, setShowTreatmentForm] = useState(false)
  const [showInvoiceForm,   setShowInvoiceForm]   = useState(false)
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null)
  const [newNote,    setNewNote]    = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const patientId = params.id as string

  useEffect(() => {
    const fetchData = async () => {
      const [patientRes, treatmentsRes, invoicesRes] = await Promise.all([
        supabase.from('patients').select('*').eq('id', patientId).single(),
        supabase.from('treatments').select('*').eq('patient_id', patientId).order('treatment_date', { ascending: false }),
        supabase.from('invoices').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      ])

      if (patientRes.data)    setPatient(patientRes.data)
      if (treatmentsRes.data) setTreatments(treatmentsRes.data)
      if (invoicesRes.data)   setInvoices(invoicesRes.data)
      setLoading(false)
    }
    fetchData()
  }, [patientId])

  const handleSaveNote = async () => {
    if (!newNote.trim() || !patient) return
    setSavingNote(true)
    const date = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
    const updated = patient.notes
      ? `[${date}] ${newNote.trim()}\n\n${patient.notes}`
      : `[${date}] ${newNote.trim()}`

    const { error } = await supabase
      .from('patients')
      .update({ notes: updated })
      .eq('id', patientId)

    if (!error) {
      setPatient({ ...patient, notes: updated })
      setNewNote('')
    }
    setSavingNote(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <PageLayout onBack={() => router.push('/patients')} onLogout={handleLogout}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <p style={{ color: THEME.muted }}>Loading patient record...</p>
        </div>
      </PageLayout>
    )
  }

  if (!patient) {
    return (
      <PageLayout onBack={() => router.push('/patients')} onLogout={handleLogout}>
        <div style={{ textAlign: 'center', padding: '60px', color: THEME.muted }}>
          Patient not found.
        </div>
      </PageLayout>
    )
  }

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const initials = `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()

  // Total revenue from this patient
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid_amount), 0)

  // Outstanding balance
  const totalOwed = invoices
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0)

  // Treatments that don't have an invoice yet
  const uninvoicedTreatments = treatments.filter(t =>
    t.status === 'completed' &&
    !invoices.find(i => i.treatment_id === t.id)
  )

  return (
    <PageLayout onBack={() => router.push('/patients')} onLogout={handleLogout}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Patient Header ── */}
        <div style={{
          background: THEME.white, borderRadius: '16px',
          border: `1px solid ${THEME.border}`, padding: '24px',
          marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '20px'
        }}>
          {/* Avatar */}
          <div style={{
            width: '60px', height: '60px', borderRadius: '16px',
            background: THEME.primaryBg, color: THEME.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: '700', flexShrink: 0
          }}>
            {initials}
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: '0 0 8px' }}>
              {patient.first_name} {patient.last_name}
            </h2>

            {/* Info chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {age && <Chip label="Age" value={`${age} yrs`} />}
              {patient.phone && <Chip label="Phone" value={patient.phone} />}
              {patient.blood_type && <Chip label="Blood" value={patient.blood_type} color={THEME.red} />}
              {patient.email && <Chip label="Email" value={patient.email} />}
              <Chip label="Visits" value={treatments.length.toString()} />
              <Chip label="Total paid" value={formatETB(totalPaid)} color={THEME.primary} />
              {totalOwed > 0 && (
                <Chip label="Outstanding" value={formatETB(totalOwed)} color={THEME.red} />
              )}
            </div>

            {/* Allergy warning */}
            {patient.allergies && patient.allergies.length > 0 && (
              <div style={{
                background: THEME.redBg, border: `1px solid #fca5a5`,
                borderRadius: '10px', padding: '8px 14px',
                display: 'inline-flex', alignItems: 'center', gap: '8px'
              }}>
                <span style={{ fontSize: '14px' }}>⚠️</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: THEME.red }}>
                  Allergic to: {patient.allergies.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Outstanding balance alert */}
          {totalOwed > 0 && (
            <div style={{
              background: THEME.amberBg, border: `1px solid #fcd34d`,
              borderRadius: '12px', padding: '14px 18px', textAlign: 'center', flexShrink: 0
            }}>
              <p style={{ fontSize: '11px', color: THEME.amber, fontWeight: '600', margin: '0 0 4px', textTransform: 'uppercase' }}>
                Outstanding
              </p>
              <p style={{ fontSize: '20px', fontWeight: '700', color: THEME.amber, margin: '0' }}>
                {formatETB(totalOwed)}
              </p>
            </div>
          )}
        </div>

        {/* ── Uninvoiced treatments alert ── */}
        {uninvoicedTreatments.length > 0 && (
          <div style={{
            background: THEME.amberBg, border: `1px solid #fcd34d`,
            borderRadius: '12px', padding: '14px 18px',
            marginBottom: '20px', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', margin: '0 0 2px' }}>
                {uninvoicedTreatments.length} completed treatment{uninvoicedTreatments.length > 1 ? 's' : ''} not yet invoiced
              </p>
              <p style={{ fontSize: '12px', color: THEME.amber, margin: '0' }}>
                {uninvoicedTreatments.map(t => t.treatment_type).join(', ')}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedTreatment(uninvoicedTreatments[0])
                setShowInvoiceForm(true)
              }}
              style={{
                background: THEME.amber, color: THEME.white,
                border: 'none', borderRadius: '8px',
                padding: '8px 16px', fontSize: '13px',
                fontWeight: '500', cursor: 'pointer', flexShrink: 0
              }}
            >
              Create Invoice
            </button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f3f4f6', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
          {(['treatments', 'invoices', 'notes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 20px', borderRadius: '10px', cursor: 'pointer',
                border: 'none', fontSize: '13px', fontWeight: '500',
                textTransform: 'capitalize',
                background: activeTab === tab ? THEME.white : 'transparent',
                color: activeTab === tab ? THEME.text : THEME.muted,
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              {tab}
              <span style={{
                marginLeft: '6px', fontSize: '11px',
                background: activeTab === tab ? THEME.primaryBg : '#e5e7eb',
                color: activeTab === tab ? THEME.primary : THEME.muted,
                padding: '1px 7px', borderRadius: '999px'
              }}>
                {tab === 'treatments' ? treatments.length
                  : tab === 'invoices' ? invoices.length
                  : patient.notes ? patient.notes.split('\n\n').length : 0}
              </span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════
            TAB: TREATMENTS
        ══════════════════════════════ */}
        {activeTab === 'treatments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
              <button
                onClick={() => setShowTreatmentForm(true)}
                style={{
                  background: THEME.primary, color: THEME.white,
                  border: 'none', borderRadius: '10px',
                  padding: '9px 18px', fontSize: '13px',
                  fontWeight: '500', cursor: 'pointer'
                }}
              >
                + Add Treatment
              </button>
            </div>

            {treatments.length === 0 ? (
              <EmptyCard message="No treatments recorded yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {treatments.map(t => {
                  const hasInvoice = invoices.find(i => i.treatment_id === t.id)
                  const statusColors = {
                    completed:   { bg: THEME.greenBg,  color: THEME.green  },
                    in_progress: { bg: THEME.blueBg,   color: THEME.blue   },
                    planned:     { bg: THEME.amberBg,  color: THEME.amber  },
                  }
                  const sc = statusColors[t.status]

                  return (
                    <div key={t.id} style={{
                      background: THEME.white, borderRadius: '14px',
                      border: `1px solid ${THEME.border}`, padding: '16px 20px',
                      display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', gap: '16px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '12px', fontWeight: '600',
                            padding: '3px 10px', borderRadius: '6px',
                            background: THEME.primaryBg, color: THEME.primary
                          }}>
                            {t.treatment_type}
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: '500',
                            padding: '2px 8px', borderRadius: '6px',
                            background: sc.bg, color: sc.color,
                            textTransform: 'capitalize'
                          }}>
                            {t.status.replace('_', ' ')}
                          </span>
                          {hasInvoice && (
                            <span style={{
                              fontSize: '11px', fontWeight: '500',
                              padding: '2px 8px', borderRadius: '6px',
                              background: THEME.greenBg, color: THEME.green
                            }}>
                              Invoiced
                            </span>
                          )}
                        </div>
                        {t.tooth_area && (
                          <p style={{ fontSize: '12px', color: THEME.muted, margin: '0 0 4px' }}>
                            {t.tooth_area}
                          </p>
                        )}
                        {t.notes && (
                          <p style={{ fontSize: '13px', color: THEME.text, margin: '0 0 6px', lineHeight: 1.5 }}>
                            {t.notes}
                          </p>
                        )}
                        <p style={{ fontSize: '12px', color: THEME.muted, margin: '0' }}>
                          {formatDate(t.treatment_date)}
                        </p>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '16px', fontWeight: '700', color: THEME.text, margin: '0 0 8px' }}>
                          {formatETB(t.cost)}
                        </p>
                        {/* Invoice button — only for completed, uninvoiced treatments */}
                        {t.status === 'completed' && !hasInvoice && (
                          <button
                            onClick={() => {
                              setSelectedTreatment(t)
                              setShowInvoiceForm(true)
                            }}
                            style={{
                              fontSize: '12px', padding: '5px 12px',
                              borderRadius: '8px', border: `1px solid ${THEME.amber}`,
                              background: THEME.amberBg, color: THEME.amber,
                              cursor: 'pointer', fontWeight: '500'
                            }}
                          >
                            + Invoice
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: INVOICES
            This is where revenue is tracked
        ══════════════════════════════ */}
        {activeTab === 'invoices' && (
          <div>
            {invoices.length === 0 ? (
              <EmptyCard message="No invoices yet. Add a treatment and create an invoice from it." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {invoices.map(inv => {
                  const statusConfig = {
                    paid:    { label: 'Paid',     bg: THEME.greenBg,  color: THEME.green  },
                    partial: { label: 'Partial',  bg: THEME.amberBg,  color: THEME.amber  },
                    unpaid:  { label: 'Unpaid',   bg: THEME.redBg,    color: THEME.red    },
                  }
                  const sc = statusConfig[inv.status]
                  const remaining = Number(inv.amount) - Number(inv.paid_amount)

                  return (
                    <div key={inv.id} style={{
                      background: THEME.white, borderRadius: '14px',
                      border: `1px solid ${inv.status === 'unpaid' ? '#fca5a5' : THEME.border}`,
                      padding: '16px 20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '13px', color: THEME.muted }}>
                            {formatDate(inv.created_at)}
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: '600',
                            padding: '2px 10px', borderRadius: '999px',
                            background: sc.bg, color: sc.color
                          }}>
                            {sc.label}
                          </span>
                          {inv.payment_method && (
                            <span style={{
                              fontSize: '11px', color: THEME.muted,
                              background: THEME.bg, padding: '2px 8px',
                              borderRadius: '6px', textTransform: 'capitalize'
                            }}>
                              {inv.payment_method.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '18px', fontWeight: '700', color: THEME.text, margin: '0' }}>
                            {formatETB(inv.amount)}
                          </p>
                        </div>
                      </div>

                      {/* Payment progress bar */}
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: THEME.muted, marginBottom: '4px' }}>
                          <span>Paid: {formatETB(inv.paid_amount)}</span>
                          {remaining > 0 && <span style={{ color: THEME.red }}>Remaining: {formatETB(remaining)}</span>}
                        </div>
                        <div style={{ background: THEME.bg, borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min((Number(inv.paid_amount) / Number(inv.amount)) * 100, 100)}%`,
                            height: '100%',
                            background: inv.status === 'paid' ? THEME.green : THEME.amber,
                            borderRadius: '999px'
                          }} />
                        </div>
                      </div>

                      {/* Record payment button for unpaid/partial */}
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => {
                            setSelectedTreatment({ id: inv.treatment_id } as any)
                            setShowInvoiceForm(true)
                          }}
                          style={{
                            marginTop: '8px', fontSize: '12px',
                            padding: '5px 12px', borderRadius: '8px',
                            border: `1px solid ${THEME.primary}`,
                            background: THEME.primaryBg, color: THEME.primary,
                            cursor: 'pointer', fontWeight: '500'
                          }}
                        >
                          Record Payment
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: NOTES
        ══════════════════════════════ */}
        {activeTab === 'notes' && (
          <div>
            {/* Add note */}
            <div style={{
              background: THEME.white, borderRadius: '14px',
              border: `1px solid ${THEME.border}`, padding: '16px 20px', marginBottom: '14px'
            }}>
              <label style={{ ...labelStyle, marginBottom: '8px' }}>Add Clinical Note</label>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Type your clinical observation or note here..."
                rows={3}
                style={{ ...inputStyle, resize: 'none', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !newNote.trim()}
                  style={{
                    background: THEME.primary, color: THEME.white,
                    border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontSize: '13px',
                    fontWeight: '500', cursor: 'pointer',
                    opacity: !newNote.trim() ? 0.5 : 1
                  }}
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>

            {!patient.notes ? (
              <EmptyCard message="No clinical notes yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {patient.notes.split('\n\n').map((note, i) => (
                  <div key={i} style={{
                    background: THEME.amberBg,
                    borderLeft: `3px solid ${THEME.amber}`,
                    borderRadius: '0 12px 12px 0', padding: '12px 16px'
                  }}>
                    {note.startsWith('[') && (
                      <p style={{ fontSize: '11px', color: THEME.amber, fontWeight: '600', margin: '0 0 4px' }}>
                        {note.match(/\[(.*?)\]/)?.[1]}
                      </p>
                    )}
                    <p style={{ fontSize: '13px', color: THEME.text, margin: '0', lineHeight: 1.6 }}>
                      {note.replace(/\[.*?\]\s*/, '')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Treatment Modal ── */}
      {showTreatmentForm && (
        <AddTreatmentModal
          patientId={patientId}
          clinicId={patient.clinic_id}
          onClose={() => setShowTreatmentForm(false)}
          onSaved={(t) => {
            setTreatments([t, ...treatments])
            setShowTreatmentForm(false)
          }}
        />
      )}

      {/* ── Create Invoice Modal ── */}
      {showInvoiceForm && selectedTreatment && (
        <InvoiceModal
          patientId={patientId}
          clinicId={patient.clinic_id}
          treatment={selectedTreatment}
          existingInvoice={invoices.find(i => i.treatment_id === selectedTreatment.id)}
          onClose={() => { setShowInvoiceForm(false); setSelectedTreatment(null) }}
          onSaved={(inv) => {
            // Update or add invoice
            setInvoices(prev => {
              const exists = prev.find(i => i.id === inv.id)
              if (exists) return prev.map(i => i.id === inv.id ? inv : i)
              return [inv, ...prev]
            })
            setShowInvoiceForm(false)
            setSelectedTreatment(null)
          }}
        />
      )}
    </PageLayout>
  )
}

// ============================================
// ADD TREATMENT MODAL
// ============================================
function AddTreatmentModal({ patientId, clinicId, onClose, onSaved }: {
  patientId: string
  clinicId: string
  onClose: () => void
  onSaved: (t: Treatment) => void
}) {
  const [type,   setType]   = useState('Cleaning')
  const [tooth,  setTooth]  = useState('')
  const [notes,  setNotes]  = useState('')
  const [cost,   setCost]   = useState('')
  const [status, setStatus] = useState<Treatment['status']>('completed')
  const [date,   setDate]   = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const supabase = createClient()

  const handleSave = async () => {
    if (!type) { setError('Please select a treatment type.'); return }
    setSaving(true)

    const { data, error: saveError } = await supabase
      .from('treatments')
      .insert({
        clinic_id:      clinicId,
        patient_id:     patientId,
        treatment_type: type,
        tooth_area:     tooth.trim() || null,
        notes:          notes.trim() || null,
        cost:           parseFloat(cost) || 0,
        status,
        treatment_date: date,
      })
      .select()
      .single()

    if (saveError) { setError('Failed to save.'); setSaving(false); return }
    onSaved(data as Treatment)
  }

  return (
    <Modal title="Add Treatment" onClose={onClose}>
      {error && <ErrorBox message={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Treatment Type</label>
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
            {TREATMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Tooth / Area</label>
        <input value={tooth} onChange={e => setTooth(e.target.value)} placeholder="e.g. Upper left molar, #16" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Clinical Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Procedure details..." rows={3} style={{ ...inputStyle, resize: 'none' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Cost (ETB)</label>
          <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as Treatment['status'])} style={inputStyle}>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="planned">Planned</option>
          </select>
        </div>
      </div>

      <ModalFooter
        onClose={onClose}
        onSave={handleSave}
        saving={saving}
        saveLabel="Save Treatment"
      />
    </Modal>
  )
}

// ============================================
// INVOICE MODAL
// Create invoice + record payment in one step
// ============================================
function InvoiceModal({ patientId, clinicId, treatment, existingInvoice, onClose, onSaved }: {
  patientId: string
  clinicId: string
  treatment: Treatment
  existingInvoice?: Invoice
  onClose: () => void
  onSaved: (inv: Invoice) => void
}) {
  // Pre-fill amount from treatment cost
  const [amount,        setAmount]        = useState(existingInvoice?.amount.toString() || treatment.cost?.toString() || '')
  const [paidAmount,    setPaidAmount]    = useState(existingInvoice?.paid_amount.toString() || '')
  const [paymentMethod, setPaymentMethod] = useState(existingInvoice?.payment_method || 'cash')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  const supabase = createClient()

  // Auto-calculate status based on amounts
  const getStatus = (): Invoice['status'] => {
    const total = parseFloat(amount) || 0
    const paid  = parseFloat(paidAmount) || 0
    if (paid <= 0)       return 'unpaid'
    if (paid >= total)   return 'paid'
    return 'partial'
  }

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter the invoice amount.')
      return
    }
    setSaving(true)
    setError('')

    const status    = getStatus()
    const invoiceData = {
      clinic_id:      clinicId,
      patient_id:     patientId,
      treatment_id:   treatment.id,
      amount:         parseFloat(amount),
      paid_amount:    parseFloat(paidAmount) || 0,
      payment_method: paymentMethod,
      status,
      paid_at:        status === 'paid' ? new Date().toISOString() : null,
    }

    let data, saveError

    if (existingInvoice) {
      // Update existing invoice (recording a payment)
      const res = await supabase
        .from('invoices')
        .update(invoiceData)
        .eq('id', existingInvoice.id)
        .select()
        .single()
      data = res.data
      saveError = res.error
    } else {
      // Create new invoice
      const res = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single()
      data = res.data
      saveError = res.error
    }

    if (saveError) { setError('Failed to save invoice.'); setSaving(false); return }
    onSaved(data as Invoice)
  }

  const status    = getStatus()
  const statusColors = {
    paid:    { bg: THEME.greenBg, color: THEME.green,  label: 'Will be marked Paid'    },
    partial: { bg: THEME.amberBg, color: THEME.amber,  label: 'Will be marked Partial' },
    unpaid:  { bg: THEME.redBg,   color: THEME.red,    label: 'Will be marked Unpaid'  },
  }
  const sc = statusColors[status]

  return (
    <Modal title={existingInvoice ? 'Record Payment' : 'Create Invoice'} onClose={onClose}>
      {error && <ErrorBox message={error} />}

      {/* Treatment summary */}
      {treatment.treatment_type && (
        <div style={{
          background: THEME.bg, borderRadius: '10px',
          padding: '12px 14px', border: `1px solid ${THEME.border}`
        }}>
          <p style={{ fontSize: '12px', color: THEME.muted, margin: '0 0 2px' }}>Treatment</p>
          <p style={{ fontSize: '14px', fontWeight: '600', color: THEME.text, margin: '0' }}>
            {treatment.treatment_type}
            {treatment.tooth_area && ` — ${treatment.tooth_area}`}
          </p>
        </div>
      )}

      {/* Amount */}
      <div>
        <label style={labelStyle}>Invoice Amount (ETB)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
          style={{ ...inputStyle, fontSize: '16px', fontWeight: '600' }}
        />
      </div>

      {/* Paid amount */}
      <div>
        <label style={labelStyle}>Amount Paid Now (ETB)</label>
        <input
          type="number"
          value={paidAmount}
          onChange={e => setPaidAmount(e.target.value)}
          placeholder="0 if not paid yet"
          style={inputStyle}
        />
        <p style={{ fontSize: '11px', color: THEME.muted, margin: '4px 0 0' }}>
          Leave as 0 if patient hasn't paid yet. Enter partial amount if they paid some.
        </p>
      </div>

      {/* Payment method */}
      <div>
        <label style={labelStyle}>Payment Method</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => setPaymentMethod(m.value)}
              style={{
                padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                border: `1px solid ${paymentMethod === m.value ? THEME.primary : THEME.border}`,
                background: paymentMethod === m.value ? THEME.primaryBg : THEME.white,
                color: paymentMethod === m.value ? THEME.primary : THEME.muted,
                fontSize: '13px', fontWeight: '500'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status preview */}
      <div style={{
        background: sc.bg, borderRadius: '10px',
        padding: '10px 14px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '13px', color: sc.color, fontWeight: '500' }}>
          {sc.label}
        </span>
        {parseFloat(paidAmount) > 0 && parseFloat(amount) > 0 && (
          <span style={{ fontSize: '13px', color: sc.color }}>
            {formatETB(parseFloat(amount) - (parseFloat(paidAmount) || 0))} remaining
          </span>
        )}
      </div>

      <ModalFooter
        onClose={onClose}
        onSave={handleSave}
        saving={saving}
        saveLabel={existingInvoice ? 'Update Payment' : 'Create Invoice'}
      />
    </Modal>
  )
}

// ============================================
// SMALL REUSABLE COMPONENTS
// ============================================
function Chip({ label, value, color = THEME.muted }: {
  label: string; value: string; color?: string
}) {
  return (
    <span style={{
      fontSize: '12px', padding: '4px 10px',
      borderRadius: '8px', background: THEME.bg,
      border: `1px solid ${THEME.border}`
    }}>
      <span style={{ color: THEME.muted }}>{label}: </span>
      <span style={{ color, fontWeight: '500' }}>{value}</span>
    </span>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div style={{
      background: THEME.white, borderRadius: '14px',
      border: `1px solid ${THEME.border}`,
      padding: '48px', textAlign: 'center'
    }}>
      <p style={{ color: THEME.muted, fontSize: '14px', margin: '0' }}>{message}</p>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      background: THEME.redBg, color: THEME.red,
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px'
    }}>
      {message}
    </div>
  )
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: THEME.white, borderRadius: '16px',
        width: '100%', maxWidth: '480px',
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: `1px solid ${THEME.border}`, flexShrink: 0
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: THEME.text }}>
            {title}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: THEME.muted }}>
            x
          </button>
        </div>
        <div style={{
          padding: '20px 24px', display: 'flex',
          flexDirection: 'column', gap: '14px', overflowY: 'auto'
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function ModalFooter({ onClose, onSave, saving, saveLabel }: {
  onClose: () => void; onSave: () => void
  saving: boolean; saveLabel: string
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end', gap: '10px',
      paddingTop: '8px', borderTop: `1px solid ${THEME.border}`
    }}>
      <button onClick={onClose} style={{
        padding: '9px 16px', border: `1px solid ${THEME.border}`,
        borderRadius: '8px', background: 'none',
        fontSize: '13px', color: THEME.muted, cursor: 'pointer'
      }}>
        Cancel
      </button>
      <button onClick={onSave} disabled={saving} style={{
        padding: '9px 18px', border: 'none', borderRadius: '8px',
        background: saving ? '#99f6e4' : THEME.primary,
        color: THEME.white, fontSize: '13px',
        fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer'
      }}>
        {saving ? 'Saving...' : saveLabel}
      </button>
    </div>
  )
}

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

function PageLayout({ children, onBack, onLogout }: {
  children: React.ReactNode; onBack: () => void; onLogout: () => void
}) {
  return (
    <div style={{ minHeight: '100vh', background: THEME.bg, fontFamily: 'sans-serif' }}>
      <nav style={{
        background: THEME.white, borderBottom: `1px solid ${THEME.border}`,
        padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '60px',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{
            background: 'none', border: `1px solid ${THEME.border}`,
            borderRadius: '8px', padding: '6px 12px',
            fontSize: '13px', color: THEME.muted, cursor: 'pointer'
          }}>
            Back
          </button>
          <div style={{ width: '1px', height: '20px', background: THEME.border }} />
          <div style={{
            width: '28px', height: '28px', background: THEME.primary,
            borderRadius: '7px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '14px'
          }}>
            🦷
          </div>
          <span style={{ fontWeight: '700', color: THEME.text, fontSize: '15px' }}>DentaRecord</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {[
            { label: 'Analytics',    href: '/dashboard'    },
            { label: 'Patients',     href: '/patients'     },
            { label: 'Appointments', href: '/appointments' },
            { label: 'Expenses',     href: '/expenses'     },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              color: THEME.muted, fontSize: '14px', textDecoration: 'none'
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

