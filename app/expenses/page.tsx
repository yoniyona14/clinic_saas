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

const CATEGORIES = [
  'supplies', 'equipment', 'rent',
  'salaries', 'utilities', 'other'
]

const CATEGORY_COLORS: Record<string, string> = {
  supplies:  '#3b82f6',
  equipment: '#0d9488',
  rent:      '#f59e0b',
  salaries:  '#ef4444',
  utilities: '#8b5cf6',
  other:     '#6b7280',
}

type Expense = {
  id: string
  category: string
  description: string
  amount: number
  expense_date: string
  created_at: string
}

export default function ExpensesPage() {
  const [expenses,       setExpenses]       = useState<Expense[]>([])
  const [clinicId,       setClinicId]       = useState('')
  const [loading,        setLoading]        = useState(true)
  const [showForm,       setShowForm]       = useState(false)
  const [filterCat,      setFilterCat]      = useState('all')
  const [isReceptionist, setIsReceptionist] = useState(false)

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchExpenses = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: staff } = await supabase
        .from('staff')
        .select('clinic_id, role')
        .eq('email', user.email)
        .single()

      if (!staff) { setLoading(false); return }

      const userRole = (staff as any).role

      // Dentists cannot access expenses at all
      if (userRole === 'dentist') {
        router.push('/patients')
        return
      }

      // Receptionists can add but not view history
      if (userRole === 'receptionist') {
        setIsReceptionist(true)
      }

      setClinicId(staff.clinic_id)

      // Only fetch expense history for owners
      if (userRole === 'owner') {
        const { data } = await supabase
          .from('expenses')
          .select('*')
          .eq('clinic_id', staff.clinic_id)
          .order('expense_date', { ascending: false })

        if (data) setExpenses(data as Expense[])
      }

      setLoading(false)
    }

    fetchExpenses()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filtered = filterCat === 'all'
    ? expenses
    : expenses.filter(e => e.category === filterCat)

  const totalSpend = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    total: expenses
      .filter(e => e.category === cat)
      .reduce((s, e) => s + Number(e.amount), 0)
  }))

  const biggest = byCategory.reduce(
    (max, c) => c.total > max.total ? c : max,
    { cat: 'none', total: 0 }
  )

  if (loading) {
    return (
      <PageLayout onLogout={handleLogout} isReceptionist={isReceptionist}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', height: '60vh'
        }}>
          <p style={{ color: THEME.muted }}>Loading...</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout onLogout={handleLogout} isReceptionist={isReceptionist}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Page Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '24px'
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: THEME.text, margin: '0' }}>
              Expenses
            </h2>
            <p style={{ color: THEME.muted, fontSize: '14px', marginTop: '4px' }}>
              {isReceptionist
                ? 'Log new clinic expenses'
                : 'Track your clinic running costs'}
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
            + Add Expense
          </button>
        </div>

        {/* ══════════════════════════════════
            RECEPTIONIST VIEW
            Just a simple message — no history
        ══════════════════════════════════ */}
        {isReceptionist && (
          <div style={{
            background: THEME.white, borderRadius: '16px',
            border: `1px solid ${THEME.border}`,
            padding: '48px', textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧾</div>
            <p style={{ fontSize: '15px', fontWeight: '500', color: THEME.text, margin: '0 0 8px' }}>
              Log a new expense
            </p>
            <p style={{ color: THEME.muted, fontSize: '13px', margin: '0 0 20px' }}>
              Click the button above to record a clinic expense.
              Only the clinic owner can view expense history and reports.
            </p>
            <button
              onClick={() => setShowForm(true)}
              style={{
                background: THEME.primary, color: THEME.white,
                border: 'none', borderRadius: '10px',
                padding: '10px 24px', fontSize: '14px',
                fontWeight: '500', cursor: 'pointer'
              }}
            >
              + Add Expense
            </button>
          </div>
        )}

        {/* ══════════════════════════════════
            OWNER VIEW
            Full history, charts, breakdown
        ══════════════════════════════════ */}
        {!isReceptionist && (
          <>
            {/* Summary Cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px', marginBottom: '24px'
            }}>
              <SummaryCard
                label="Total Expenses"
                value={`ETB ${totalSpend.toLocaleString()}`}
                sub="All recorded expenses"
                color={THEME.red}
              />
              <SummaryCard
                label="Total Records"
                value={expenses.length.toString()}
                sub="Expense entries logged"
                color={THEME.blue}
              />
              <SummaryCard
                label="Biggest Category"
                value={biggest.total > 0 ? biggest.cat : 'None yet'}
                sub={biggest.total > 0
                  ? `ETB ${biggest.total.toLocaleString()}`
                  : 'Add expenses to see'}
                color={THEME.amber}
              />
            </div>

            {/* Category breakdown */}
            {totalSpend > 0 && (
              <div style={{
                background: THEME.white, borderRadius: '16px',
                border: `1px solid ${THEME.border}`,
                padding: '24px', marginBottom: '24px'
              }}>
                <h3 style={{
                  fontSize: '15px', fontWeight: '600',
                  color: THEME.text, margin: '0 0 16px'
                }}>
                  Spending by Category
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {byCategory.filter(c => c.total > 0).map(c => {
                    const pct = Math.round((c.total / totalSpend) * 100)
                    return (
                      <div key={c.cat}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          fontSize: '13px', marginBottom: '4px'
                        }}>
                          <span style={{
                            fontWeight: '500', color: THEME.text,
                            textTransform: 'capitalize'
                          }}>
                            {c.cat}
                          </span>
                          <span style={{ color: THEME.muted }}>
                            ETB {c.total.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div style={{
                          background: THEME.bg, borderRadius: '999px',
                          height: '8px', overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: CATEGORY_COLORS[c.cat] || THEME.muted,
                            borderRadius: '999px',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Filter tabs */}
            <div style={{
              display: 'flex', gap: '6px',
              marginBottom: '16px', flexWrap: 'wrap'
            }}>
              {['all', ...CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  style={{
                    padding: '6px 14px', borderRadius: '999px',
                    border: `1px solid ${filterCat === cat ? THEME.primary : THEME.border}`,
                    background: filterCat === cat ? THEME.primaryBg : THEME.white,
                    color: filterCat === cat ? THEME.primary : THEME.muted,
                    fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Expenses Table */}
            {filtered.length === 0 ? (
              <div style={{
                background: THEME.white, borderRadius: '16px',
                border: `1px solid ${THEME.border}`,
                padding: '48px', textAlign: 'center'
              }}>
                <p style={{ color: THEME.muted, fontSize: '14px', margin: '0' }}>
                  {filterCat === 'all'
                    ? 'No expenses yet. Add your first expense!'
                    : `No ${filterCat} expenses recorded.`}
                </p>
              </div>
            ) : (
              <div style={{
                background: THEME.white, borderRadius: '16px',
                border: `1px solid ${THEME.border}`, overflow: 'hidden'
              }}>
                {/* Table header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '12px 20px', background: THEME.bg,
                  borderBottom: `1px solid ${THEME.border}`,
                  fontSize: '11px', fontWeight: '600',
                  color: THEME.muted, textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <span>Description</span>
                  <span>Category</span>
                  <span>Date</span>
                  <span style={{ textAlign: 'right' }}>Amount</span>
                </div>

                {/* Rows */}
                {filtered.map((expense, i) => (
                  <div key={expense.id} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < filtered.length - 1
                      ? `1px solid ${THEME.border}` : 'none',
                  }}>
                    <span style={{
                      fontSize: '14px', color: THEME.text, fontWeight: '500'
                    }}>
                      {expense.description || 'No description'}
                    </span>

                    <span style={{
                      display: 'inline-block', fontSize: '12px',
                      fontWeight: '500', padding: '3px 10px',
                      borderRadius: '999px', width: 'fit-content',
                      textTransform: 'capitalize',
                      background: (CATEGORY_COLORS[expense.category] || THEME.muted) + '18',
                      color: CATEGORY_COLORS[expense.category] || THEME.muted,
                    }}>
                      {expense.category}
                    </span>

                    <span style={{ fontSize: '13px', color: THEME.muted }}>
                      {new Date(expense.expense_date + 'T00:00:00')
                        .toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                    </span>

                    <span style={{
                      fontSize: '14px', fontWeight: '700',
                      color: THEME.red, textAlign: 'right'
                    }}>
                      ETB {Number(expense.amount).toLocaleString()}
                    </span>
                  </div>
                ))}

                {/* Total footer */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '14px 20px', background: THEME.redBg,
                  borderTop: `1px solid ${THEME.border}`
                }}>
                  <span style={{
                    fontSize: '13px', fontWeight: '600', color: THEME.text
                  }}>
                    Total ({filtered.length} items)
                  </span>
                  <span /><span />
                  <span style={{
                    fontSize: '15px', fontWeight: '700',
                    color: THEME.red, textAlign: 'right'
                  }}>
                    ETB {filtered
                      .reduce((s, e) => s + Number(e.amount), 0)
                      .toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Add Expense Modal */}
      {showForm && (
        <AddExpenseModal
          clinicId={clinicId}
          onClose={() => setShowForm(false)}
          onSaved={(expense) => {
            // Only add to list if owner (receptionists don't see history)
            if (!isReceptionist) {
              setExpenses([expense, ...expenses])
            }
            setShowForm(false)
          }}
        />
      )}

    </PageLayout>
  )
}

// ============================================
// ADD EXPENSE MODAL
// ============================================
function AddExpenseModal({ clinicId, onClose, onSaved }: {
  clinicId: string
  onClose: () => void
  onSaved: (expense: Expense) => void
}) {
  const [category,    setCategory]    = useState('supplies')
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [date,        setDate]        = useState(
    new Date().toISOString().split('T')[0]
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const supabase = createClient()

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount.')
      return
    }
    setSaving(true)
    setError('')

    const { data, error: saveError } = await supabase
      .from('expenses')
      .insert({
        clinic_id:    clinicId,
        category,
        description:  description.trim() || null,
        amount:       parseFloat(amount),
        expense_date: date,
      })
      .select()
      .single()

    if (saveError) {
      setError('Failed to save. Please try again.')
      setSaving(false)
      return
    }

    onSaved(data as Expense)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: THEME.white, borderRadius: '16px',
        width: '100%', maxWidth: '440px', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: `1px solid ${THEME.border}`
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: THEME.text }}>
            Add Expense
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
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: '14px'
        }}>
          {error && (
            <div style={{
              background: THEME.redBg, border: `1px solid #fecaca`,
              color: THEME.red, padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={inputStyle}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Dental gloves, X-ray machine service..."
              style={inputStyle}
            />
          </div>

          {/* Amount + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Amount (ETB)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>
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
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// REUSABLE COMPONENTS
// ============================================
function SummaryCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string
}) {
  return (
    <div style={{
      background: THEME.white, borderRadius: '16px',
      border: `1px solid ${THEME.border}`, padding: '20px'
    }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: color, marginBottom: '12px'
      }} />
      <p style={{ fontSize: '20px', fontWeight: '700', color: THEME.text, margin: '0' }}>
        {value}
      </p>
      <p style={{ fontSize: '13px', color: THEME.muted, margin: '4px 0 2px' }}>
        {label}
      </p>
      <p style={{ fontSize: '11px', color, margin: '0' }}>{sub}</p>
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

// ============================================
// PAGE LAYOUT
// ============================================
function PageLayout({ children, onLogout, isReceptionist }: {
  children: React.ReactNode
  onLogout: () => void
  isReceptionist: boolean
}) {
  // Receptionists don't see analytics or expense history in nav
  const links = [
    ...(!isReceptionist ? [{ label: 'Analytics', href: '/dashboard' }] : []),
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
          <div style={{
            width: '32px', height: '32px', background: THEME.primary,
            borderRadius: '8px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '16px'
          }}>
            🦷
          </div>
          <span style={{ fontWeight: '700', color: THEME.text, fontSize: '15px' }}>
            DentaRecord
          </span>
          {isReceptionist && (
            <span style={{
              fontSize: '11px', fontWeight: '500',
              padding: '2px 8px', borderRadius: '999px',
              background: '#eff6ff', color: '#3b82f6'
            }}>
              Receptionist
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {links.map(link => (
            <a key={link.href} href={link.href} style={{
              color: link.href === '/expenses' ? THEME.primary : THEME.muted,
              fontSize: '14px', textDecoration: 'none',
              fontWeight: link.href === '/expenses' ? '600' : '400'
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