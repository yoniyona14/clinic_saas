'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'

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
  purple:    '#8b5cf6',
  purpleBg:  '#f5f3ff',
  border:    '#e5e7eb',
  text:      '#111827',
  muted:     '#6b7280',
  white:     '#ffffff',
  bg:        '#f9fafb',
}

const PIE_COLORS = [
  '#0d9488','#3b82f6','#f59e0b',
  '#ef4444','#8b5cf6','#ec4899'
]

const formatETB = (n: number) =>
  `ETB ${Number(n).toLocaleString('en-ET')}`

const formatShort = (n: number) => {
  if (n >= 1000000) return `ETB ${(n/1000000).toFixed(1)}M`
  if (n >= 1000)    return `ETB ${(n/1000).toFixed(0)}K`
  return `ETB ${n}`
}

export default function DashboardPage() {
  const [loading,          setLoading]          = useState(true)
  const [clinicName,       setClinicName]        = useState('')
  const [totalPatients,    setTotalPatients]     = useState(0)
  const [totalRevenue,     setTotalRevenue]      = useState(0)
  const [totalExpenses,    setTotalExpenses]     = useState(0)
  const [noShowRate,       setNoShowRate]        = useState(0)
  const [totalNoShows,     setTotalNoShows]      = useState(0)
  const [monthlyData,      setMonthlyData]       = useState<any[]>([])
  const [treatmentData,    setTreatmentData]     = useState<any[]>([])
  const [appointmentData,  setAppointmentData]   = useState<any[]>([])
  const [patientGrowth,    setPatientGrowth]     = useState<any[]>([])
  const [topPatients,      setTopPatients]       = useState<any[]>([])
  const [outstanding,      setOutstanding]       = useState(0)
  const [completionRate,   setCompletionRate]    = useState(0)
  const [avgRevenuePerPt,  setAvgRevenuePerPt]  = useState(0)
  const [revenueTarget,    setRevenueTarget]     = useState(50000)
  const [dayOfWeekData,    setDayOfWeekData]     = useState<any[]>([])
  const [newPatientsMonth, setNewPatientsMonth]  = useState(0)
  const [paidInvoices,     setPaidInvoices]      = useState(0)
  const [unpaidInvoices,   setUnpaidInvoices]    = useState(0)

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: staff } = await supabase
        .from('staff')
        .select('clinic_id, role, clinics(name)')
        .eq('email', user.email)
        .single()

      if (!staff) { setLoading(false); return }

      // Block non-owners
      if ((staff as any).role !== 'owner') {
        router.push('/patients')
        return
      }

      const clinicId = staff.clinic_id
      setClinicName((staff as any).clinics?.name || 'Your Clinic')

      // Fetch everything in parallel
      const [
        patientRes, invoiceRes, expenseRes,
        apptRes, treatmentRes,
      ] = await Promise.all([
        supabase.from('patients').select('id, created_at').eq('clinic_id', clinicId),
        supabase.from('invoices').select('*').eq('clinic_id', clinicId),
        supabase.from('expenses').select('amount').eq('clinic_id', clinicId),
        supabase.from('appointments').select('status, appointment_date').eq('clinic_id', clinicId),
        supabase.from('treatments').select('treatment_type, cost, status, patient_id').eq('clinic_id', clinicId),
      ])

      const patients   = patientRes.data   || []
      const invoices   = invoiceRes.data   || []
      const expenses   = expenseRes.data   || []
      const appts      = apptRes.data      || []
      const treatments = treatmentRes.data || []

      // ── Basic stats ──
      setTotalPatients(patients.length)

      const revenue = invoices.reduce(
        (s: number, i: any) => s + Number(i.paid_amount), 0
      )
      setTotalRevenue(revenue)

      const expTotal = expenses.reduce(
        (s: number, e: any) => s + Number(e.amount), 0
      )
      setTotalExpenses(expTotal)

      // ── No-show rate ──
      const noShows = appts.filter((a: any) => a.status === 'no_show').length
      setTotalNoShows(noShows)
      setNoShowRate(
        appts.length > 0
          ? Math.round((noShows / appts.length) * 100)
          : 0
      )

      // ── Outstanding payments ──
      const owed = invoices
        .filter((i: any) => i.status !== 'paid')
        .reduce((s: number, i: any) =>
          s + (Number(i.amount) - Number(i.paid_amount)), 0
        )
      setOutstanding(owed)

      // ── Invoice stats ──
      setPaidInvoices(invoices.filter((i: any) => i.status === 'paid').length)
      setUnpaidInvoices(invoices.filter((i: any) => i.status === 'unpaid').length)

      // ── Treatment completion rate ──
      const completed = treatments.filter((t: any) => t.status === 'completed').length
      setCompletionRate(
        treatments.length > 0
          ? Math.round((completed / treatments.length) * 100)
          : 0
      )

      // ── Avg revenue per patient ──
      setAvgRevenuePerPt(
        patients.length > 0 ? Math.round(revenue / patients.length) : 0
      )

      // ── New patients this month ──
      const thisMonth = new Date()
      const newThisMonth = patients.filter((p: any) => {
        const d = new Date(p.created_at)
        return d.getMonth()    === thisMonth.getMonth() &&
               d.getFullYear() === thisMonth.getFullYear()
      }).length
      setNewPatientsMonth(newThisMonth)

      // ── Monthly revenue + expense chart ──
      const monthMap: Record<string, { revenue: number; expenses: number }> = {}
      invoices.forEach((inv: any) => {
        if (!inv.paid_at) return
        const month = new Date(inv.paid_at).toLocaleString('default', {
          month: 'short', year: '2-digit'
        })
        if (!monthMap[month]) monthMap[month] = { revenue: 0, expenses: 0 }
        monthMap[month].revenue += Number(inv.paid_amount)
      })
      setMonthlyData(
        Object.entries(monthMap).map(([month, data]) => ({ month, ...data }))
      )

      // ── Patient growth over time ──
      const growthMap: Record<string, number> = {}
      patients.forEach((p: any) => {
        const month = new Date(p.created_at).toLocaleString('default', {
          month: 'short', year: '2-digit'
        })
        growthMap[month] = (growthMap[month] || 0) + 1
      })
      // Make it cumulative
      let cumulative = 0
      setPatientGrowth(
        Object.entries(growthMap).map(([month, count]) => {
          cumulative += count
          return { month, new: count, total: cumulative }
        })
      )

      // ── Treatment breakdown ──
      const typeMap: Record<string, number> = {}
      treatments.forEach((t: any) => {
        typeMap[t.treatment_type] = (typeMap[t.treatment_type] || 0) + 1
      })
      setTreatmentData(
        Object.entries(typeMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      )

      // ── Appointment status breakdown ──
      const statusMap: Record<string, number> = {
        completed: 0, scheduled: 0, no_show: 0, cancelled: 0
      }
      appts.forEach((a: any) => {
        statusMap[a.status] = (statusMap[a.status] || 0) + 1
      })
      setAppointmentData(
        Object.entries(statusMap).map(([name, value]) => ({
          name: name.replace('_', ' '), value
        }))
      )

      // ── Day of week analysis ──
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayMap: Record<string, number> = {}
      days.forEach(d => { dayMap[d] = 0 })
      appts.forEach((a: any) => {
        const day = days[new Date(a.appointment_date).getDay()]
        dayMap[day] = (dayMap[day] || 0) + 1
      })
      setDayOfWeekData(
        days.map(day => ({ day, appointments: dayMap[day] || 0 }))
      )

      // ── Top patients by spend ──
      const patientSpend: Record<string, number> = {}
      treatments.forEach((t: any) => {
        if (t.status === 'completed') {
          patientSpend[t.patient_id] =
            (patientSpend[t.patient_id] || 0) + Number(t.cost)
        }
      })

      // Get top 5 patient IDs
      const topIds = Object.entries(patientSpend)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id)

      if (topIds.length > 0) {
        const { data: topPts } = await supabase
          .from('patients')
          .select('id, first_name, last_name')
          .in('id', topIds)

        setTopPatients(
          topIds.map(id => {
            const pt = (topPts || []).find((p: any) => p.id === id)
            return {
              name: pt
                ? `${pt.first_name} ${pt.last_name}`
                : 'Unknown',
              spend: patientSpend[id]
            }
          })
        )
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', background: THEME.bg,
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: `4px solid ${THEME.primary}`,
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '16px'
        }} />
        <p style={{ color: THEME.muted, fontSize: '14px' }}>
          Loading analytics...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const netProfit    = totalRevenue - totalExpenses
  const isProfitable = netProfit >= 0
  const targetPct    = Math.min(Math.round((totalRevenue / revenueTarget) * 100), 100)

  return (
    <div style={{
      minHeight: '100vh', background: THEME.bg, fontFamily: 'sans-serif'
    }}>

      {/* ── Nav ── */}
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
          }}>🦷</div>
          <span style={{ fontWeight: '700', color: THEME.text, fontSize: '15px' }}>
            DentaRecord
          </span>
          <span style={{
            fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
            background: THEME.primaryBg, color: THEME.primary, fontWeight: '500'
          }}>
            Owner
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {[
            { label: 'Analytics',    href: '/dashboard'    },
            { label: 'Patients',     href: '/patients'     },
            { label: 'Appointments', href: '/appointments' },
            { label: 'Expenses',     href: '/expenses'     },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              color: link.href === '/dashboard' ? THEME.primary : THEME.muted,
              fontSize: '14px', textDecoration: 'none',
              fontWeight: link.href === '/dashboard' ? '600' : '400'
            }}>
              {link.label}
            </a>
          ))}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            style={{
              background: 'none', border: `1px solid ${THEME.border}`,
              color: THEME.muted, fontSize: '13px',
              cursor: 'pointer', padding: '6px 12px', borderRadius: '8px'
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '28px'
        }}>
          <div>
            <h2 style={{
              fontSize: '24px', fontWeight: '700',
              color: THEME.text, margin: '0'
            }}>
              Good morning, {clinicName}
            </h2>
            <p style={{ color: THEME.muted, fontSize: '14px', marginTop: '4px' }}>
              Here is everything happening in your clinic
            </p>
          </div>
          {/* Revenue target setter */}
          <div style={{
            background: THEME.white, border: `1px solid ${THEME.border}`,
            borderRadius: '12px', padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <span style={{ fontSize: '12px', color: THEME.muted }}>
              Monthly target:
            </span>
            <input
              type="number"
              value={revenueTarget}
              onChange={e => setRevenueTarget(Number(e.target.value))}
              style={{
                border: 'none', outline: 'none', fontSize: '13px',
                fontWeight: '600', color: THEME.primary,
                width: '80px', background: 'transparent'
              }}
            />
            <span style={{ fontSize: '12px', color: THEME.muted }}>ETB</span>
          </div>
        </div>

        {/* ══════════════════════════════════
            OUTSTANDING PAYMENT ALERT
            Show if there's money owed
        ══════════════════════════════════ */}
        {outstanding > 0 && (
          <div style={{
            background: THEME.amberBg,
            border: `1px solid #fcd34d`,
            borderRadius: '14px', padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div>
                <p style={{
                  fontSize: '14px', fontWeight: '600',
                  color: '#92400e', margin: '0 0 2px'
                }}>
                  Outstanding payments
                </p>
                <p style={{ fontSize: '13px', color: THEME.amber, margin: '0' }}>
                  {unpaidInvoices} unpaid invoice{unpaidInvoices !== 1 ? 's' : ''}
                  — patients owe money
                </p>
              </div>
            </div>
            <p style={{
              fontSize: '22px', fontWeight: '700',
              color: '#92400e', margin: '0'
            }}>
              {formatETB(outstanding)}
            </p>
          </div>
        )}

        {/* ══════════════════════════════════
            ROW 1 — KPI CARDS (8 cards)
        ══════════════════════════════════ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px', marginBottom: '20px'
        }}>
          <KpiCard
            label="Total Revenue"
            value={formatShort(totalRevenue)}
            sub="All time collected"
            accent={THEME.primary}
            trend={null}
          />
          <KpiCard
            label="Net Profit"
            value={formatShort(Math.abs(netProfit))}
            sub={isProfitable ? 'Profitable' : 'Running at a loss'}
            accent={isProfitable ? THEME.green : THEME.red}
            trend={isProfitable ? 'up' : 'down'}
          />
          <KpiCard
            label="Total Patients"
            value={totalPatients.toString()}
            sub={`+${newPatientsMonth} this month`}
            accent={THEME.blue}
            trend="up"
          />
          <KpiCard
            label="No-show Rate"
            value={`${noShowRate}%`}
            sub={`${totalNoShows} missed appointments`}
            accent={noShowRate > 15 ? THEME.red : THEME.green}
            trend={noShowRate > 15 ? 'down' : 'up'}
          />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px', marginBottom: '24px'
        }}>
          <KpiCard
            label="Avg Per Patient"
            value={formatShort(avgRevenuePerPt)}
            sub="Revenue per patient"
            accent={THEME.purple}
            trend={null}
          />
          <KpiCard
            label="Outstanding"
            value={formatShort(outstanding)}
            sub={`${unpaidInvoices} unpaid invoices`}
            accent={outstanding > 0 ? THEME.amber : THEME.green}
            trend={outstanding > 0 ? 'down' : null}
          />
          <KpiCard
            label="Completion Rate"
            value={`${completionRate}%`}
            sub="Treatments completed"
            accent={completionRate > 80 ? THEME.green : THEME.amber}
            trend={completionRate > 80 ? 'up' : 'down'}
          />
          <KpiCard
            label="Total Expenses"
            value={formatShort(totalExpenses)}
            sub="All recorded costs"
            accent={THEME.red}
            trend={null}
          />
        </div>

        {/* ══════════════════════════════════
            REVENUE TARGET GAUGE
        ══════════════════════════════════ */}
        <div style={{
          ...cardStyle, marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '32px'
        }}>
          <div style={{ flex: 1 }}>
            <ChartHeader
              title="Revenue Target Progress"
              sub={`${formatETB(totalRevenue)} of ${formatETB(revenueTarget)} goal`}
            />
            {/* Progress bar */}
            <div style={{
              background: THEME.bg, borderRadius: '999px',
              height: '16px', overflow: 'hidden', marginBottom: '8px'
            }}>
              <div style={{
                width: `${targetPct}%`, height: '100%',
                background: targetPct >= 100
                  ? THEME.green
                  : targetPct >= 70
                  ? THEME.primary
                  : THEME.amber,
                borderRadius: '999px',
                transition: 'width 0.8s ease'
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '12px', color: THEME.muted
            }}>
              <span>ETB 0</span>
              <span style={{
                fontWeight: '600',
                color: targetPct >= 100 ? THEME.green : THEME.primary
              }}>
                {targetPct}% achieved
              </span>
              <span>{formatETB(revenueTarget)}</span>
            </div>
          </div>

          {/* Stats beside gauge */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            gap: '12px', flexShrink: 0
          }}>
            <MiniStat
              label="Paid invoices"
              value={paidInvoices.toString()}
              color={THEME.green}
            />
            <MiniStat
              label="Unpaid invoices"
              value={unpaidInvoices.toString()}
              color={THEME.red}
            />
            <MiniStat
              label="Remaining to target"
              value={formatShort(Math.max(revenueTarget - totalRevenue, 0))}
              color={THEME.amber}
            />
          </div>
        </div>

        {/* ══════════════════════════════════
            ROW 2 — REVENUE + PATIENT GROWTH
        ══════════════════════════════════ */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '20px', marginBottom: '20px'
        }}>

          {/* Monthly Revenue Area Chart */}
          <div style={cardStyle}>
            <ChartHeader
              title="Monthly Revenue"
              sub="Revenue collected per month in ETB"
            />
            {monthlyData.length === 0 ? (
              <EmptyChart message="No invoice data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={THEME.primary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={THEME.primary} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: THEME.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: THEME.muted }} />
                  <Tooltip
                    formatter={(v: any) => [formatETB(v), 'Revenue']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: `1px solid ${THEME.border}`
                    }}
                  />
                  <Area
                    type="monotone" dataKey="revenue"
                    stroke={THEME.primary} strokeWidth={2}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Patient Growth Line Chart */}
          <div style={cardStyle}>
            <ChartHeader
              title="Patient Growth"
              sub="Cumulative patients over time"
            />
            {patientGrowth.length === 0 ? (
              <EmptyChart message="No patient data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={patientGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: THEME.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: THEME.muted }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: `1px solid ${THEME.border}`
                    }}
                  />
                  <Line
                    type="monotone" dataKey="total"
                    stroke={THEME.blue} strokeWidth={2}
                    dot={{ fill: THEME.blue, r: 4 }}
                    name="Total patients"
                  />
                  <Line
                    type="monotone" dataKey="new"
                    stroke={THEME.amber} strokeWidth={2}
                    dot={{ fill: THEME.amber, r: 3 }}
                    name="New this month"
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>

        {/* ══════════════════════════════════
            ROW 3 — TREATMENT + APPOINTMENTS
        ══════════════════════════════════ */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '20px', marginBottom: '20px'
        }}>

          {/* Treatment breakdown pie */}
          <div style={cardStyle}>
            <ChartHeader
              title="Treatment Breakdown"
              sub="Most common procedures"
            />
            {treatmentData.length === 0 ? (
              <EmptyChart message="No treatments yet." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={treatmentData}
                    cx="50%" cy="50%"
                    outerRadius={85} innerRadius={40}
                    dataKey="value"
                    label={({ name, percent }) =>
  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
}
                    labelLine={false}
                  >
                    {treatmentData.map((_: any, i: number) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Appointment status bar */}
          <div style={cardStyle}>
            <ChartHeader
              title="Appointment Status"
              sub="Completed vs no-shows vs cancellations"
            />
            {appointmentData.every((d: any) => d.value === 0) ? (
              <EmptyChart message="No appointments yet." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={appointmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: THEME.muted }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: THEME.muted }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: `1px solid ${THEME.border}`
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {appointmentData.map((entry: any, i: number) => (
                      <Cell
                        key={i}
                        fill={
                          entry.name === 'completed'  ? THEME.green  :
                          entry.name === 'no show'    ? THEME.red    :
                          entry.name === 'cancelled'  ? THEME.amber  :
                          THEME.blue
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>

        {/* ══════════════════════════════════
            ROW 4 — BUSIEST DAYS + TOP PATIENTS
        ══════════════════════════════════ */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '20px', marginBottom: '20px'
        }}>

          {/* Busiest days of week */}
          <div style={cardStyle}>
            <ChartHeader
              title="Busiest Days"
              sub="Appointments per day of the week"
            />
            {dayOfWeekData.every((d: any) => d.appointments === 0) ? (
              <EmptyChart message="No appointment data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: THEME.muted }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: THEME.muted }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: `1px solid ${THEME.border}`
                    }}
                  />
                  <Bar
                    dataKey="appointments"
                    fill={THEME.purple}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 5 patients by spend */}
          <div style={cardStyle}>
            <ChartHeader
              title="Top Patients by Revenue"
              sub="Highest spending patients"
            />
            {topPatients.length === 0 ? (
              <EmptyChart message="No treatment data yet." />
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '10px'
              }}>
                {topPatients.map((p: any, i: number) => {
                  const maxSpend = topPatients[0].spend
                  const pct = Math.round((p.spend / maxSpend) * 100)
                  return (
                    <div key={i}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: '13px', marginBottom: '4px',
                        alignItems: 'center'
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                          <span style={{
                            width: '20px', height: '20px',
                            borderRadius: '50%', fontSize: '11px',
                            fontWeight: '700', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            background: i === 0 ? '#fef3c7' :
                                        i === 1 ? '#f3f4f6' : '#fff7ed',
                            color:       i === 0 ? '#92400e' :
                                         i === 1 ? '#374151' : '#c2410c',
                          }}>
                            {i + 1}
                          </span>
                          <span style={{
                            fontWeight: '500', color: THEME.text
                          }}>
                            {p.name}
                          </span>
                        </div>
                        <span style={{
                          fontWeight: '600', color: THEME.primary
                        }}>
                          {formatShort(p.spend)}
                        </span>
                      </div>
                      <div style={{
                        background: THEME.bg, borderRadius: '999px',
                        height: '6px', overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: PIE_COLORS[i % PIE_COLORS.length],
                          borderRadius: '999px'
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* ══════════════════════════════════
            ROW 5 — PROFIT SUMMARY
        ══════════════════════════════════ */}
        <div style={{
          ...cardStyle,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px'
        }}>
          <StatBox
            label="Total Revenue"
            value={formatETB(totalRevenue)}
            bg={THEME.primaryBg}
            color={THEME.primary}
          />
          <StatBox
            label="Total Expenses"
            value={formatETB(totalExpenses)}
            bg={THEME.redBg}
            color={THEME.red}
          />
          <StatBox
            label={isProfitable ? 'Net Profit' : 'Net Loss'}
            value={`${isProfitable ? '+' : '-'}${formatETB(Math.abs(netProfit))}`}
            bg={isProfitable ? THEME.greenBg : THEME.amberBg}
            color={isProfitable ? THEME.green : THEME.amber}
          />
        </div>

      </div>
    </div>
  )
}

// ============================================
// REUSABLE COMPONENTS
// ============================================

function KpiCard({ label, value, sub, accent, trend }: {
  label: string; value: string; sub: string
  accent: string; trend: 'up' | 'down' | null
}) {
  return (
    <div style={{
      background: THEME.white, borderRadius: '16px',
      border: `1px solid ${THEME.border}`, padding: '18px 20px'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '10px'
      }}>
        <div style={{
          width: '8px', height: '8px',
          borderRadius: '50%', background: accent
        }} />
        {trend && (
          <span style={{
            fontSize: '12px', fontWeight: '600',
            color: trend === 'up' ? THEME.green : THEME.red
          }}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <p style={{
        fontSize: '20px', fontWeight: '700',
        color: THEME.text, margin: '0'
      }}>
        {value}
      </p>
      <p style={{
        fontSize: '12px', fontWeight: '500',
        color: THEME.muted, margin: '4px 0 2px'
      }}>
        {label}
      </p>
      <p style={{ fontSize: '11px', color: accent, margin: '0' }}>
        {sub}
      </p>
    </div>
  )
}

function StatBox({ label, value, bg, color }: {
  label: string; value: string; bg: string; color: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: '12px',
      padding: '20px', textAlign: 'center'
    }}>
      <p style={{
        fontSize: '11px', fontWeight: '600', color,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        margin: '0 0 6px'
      }}>
        {label}
      </p>
      <p style={{ fontSize: '20px', fontWeight: '700', color, margin: '0' }}>
        {value}
      </p>
    </div>
  )
}

function MiniStat({ label, value, color }: {
  label: string; value: string; color: string
}) {
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: '11px', color: THEME.muted, margin: '0 0 2px' }}>
        {label}
      </p>
      <p style={{ fontSize: '16px', fontWeight: '700', color, margin: '0' }}>
        {value}
      </p>
    </div>
  )
}

function ChartHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h3 style={{
        fontSize: '15px', fontWeight: '600',
        color: THEME.text, margin: '0 0 4px'
      }}>
        {title}
      </h3>
      <p style={{ fontSize: '12px', color: THEME.muted, margin: '0' }}>
        {sub}
      </p>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div style={{
      height: '180px', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <p style={{ color: THEME.muted, fontSize: '13px' }}>{message}</p>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: THEME.white,
  borderRadius: '16px',
  border: `1px solid ${THEME.border}`,
  padding: '24px',
}