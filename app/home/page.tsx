'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Nav from '@/components/Nav'

const T = {
  primary:'#0d9488', primaryBg:'#f0fdfa', red:'#ef4444', redBg:'#fef2f2',
  green:'#22c55e', greenBg:'#f0fdf4', amber:'#f59e0b',
  blue:'#3b82f6', border:'#e5e7eb', text:'#111827',
  muted:'#6b7280', white:'#ffffff', bg:'#f9fafb',
}

const STATUS: any = {
  scheduled: { label:'Scheduled', color:'#3b82f6', bg:'#eff6ff' },
  completed: { label:'Completed', color:'#22c55e', bg:'#f0fdf4' },
  no_show:   { label:'No Show',   color:'#ef4444', bg:'#fef2f2' },
  cancelled: { label:'Cancelled', color:'#6b7280', bg:'#f9fafb' },
}

export default function HomePage() {
  const [appts,      setAppts]      = useState<any[]>([])
  const [patients,   setPatients]   = useState<any[]>([])
  const [filtered,   setFiltered]   = useState<any[]>([])
  const [search,     setSearch]     = useState('')
  const [name,       setName]       = useState('')
  const [loading,    setLoading]    = useState(true)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: staff } = await supabase.from('staff')
        .select('clinic_id, role, full_name').eq('email', user.email).single()
      if (!staff) { setLoading(false); return }

      if ((staff as any).role === 'owner') { router.push('/dashboard'); return }

      setName((staff as any).full_name || 'there')
      const cid = (staff as any).clinic_id

      const now   = new Date()
      const start = new Date(now); start.setHours(0,0,0,0)
      const end   = new Date(now); end.setHours(23,59,59,0)

      const [aRes, pRes] = await Promise.all([
        supabase.from('appointments')
          .select('*, patients(first_name, last_name), staff(full_name)')
          .eq('clinic_id', cid)
          .gte('appointment_date', start.toISOString())
          .lte('appointment_date', end.toISOString())
          .order('appointment_date', { ascending: true }),
        supabase.from('patients')
          .select('id, first_name, last_name, phone, blood_type, allergies')
          .eq('clinic_id', cid).order('first_name'),
      ])

      if (aRes.data) setAppts(aRes.data.map((a: any) => ({
        ...a,
        patient_name: a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Unknown',
        dentist_name: a.staff?.full_name || 'Unassigned',
      })))
      if (pRes.data) { setPatients(pRes.data); setFiltered(pRes.data) }
      setLoading(false)
    }
    load()
  }, [])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (!v.trim()) { setFiltered(patients); return }
    const q = v.toLowerCase()
    setFiltered(patients.filter((p: any) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    ))
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <p style={{ color:T.muted }}>Loading...</p>
    </div>
  )

  const scheduled = appts.filter(a => a.status === 'scheduled').length
  const completed = appts.filter(a => a.status === 'completed').length

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'sans-serif' }}>
      <Nav activePage="/home" />

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom:'24px' }}>
          <h2 style={{ fontSize:'22px', fontWeight:'700', color:T.text, margin:'0' }}>
            Good morning, {name}
          </h2>
          <p style={{ color:T.muted, fontSize:'14px', marginTop:'4px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>

        {/* Quick stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'24px' }}>
          {[
            { label:"Today's appointments", value:appts.length,  color:T.primary },
            { label:'Remaining',            value:scheduled,      color:T.blue    },
            { label:'Completed',            value:completed,      color:T.green   },
          ].map(s => (
            <div key={s.label} style={{
              background:T.white, borderRadius:'14px', border:`1px solid ${T.border}`,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:'14px'
            }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:s.color }} />
              <div>
                <p style={{ fontSize:'22px', fontWeight:'700', color:T.text, margin:'0' }}>{s.value}</p>
                <p style={{ fontSize:'12px', color:T.muted, margin:'2px 0 0' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

          {/* Today's schedule */}
          <div style={{ background:T.white, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden' }}>
            <div style={{
              padding:'16px 20px', borderBottom:`1px solid ${T.border}`,
              display:'flex', alignItems:'center', justifyContent:'space-between'
            }}>
              <div>
                <h3 style={{ fontSize:'15px', fontWeight:'600', color:T.text, margin:'0 0 2px' }}>Today's Schedule</h3>
                <p style={{ fontSize:'12px', color:T.muted, margin:'0' }}>{appts.length} appointments</p>
              </div>
              <button onClick={() => router.push('/appointments')} style={{
                background:T.primary, color:T.white, border:'none',
                borderRadius:'8px', padding:'7px 14px', fontSize:'12px',
                fontWeight:'500', cursor:'pointer'
              }}>+ Book</button>
            </div>
            <div style={{ maxHeight:'420px', overflowY:'auto' }}>
              {appts.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center' }}>
                  <p style={{ color:T.muted, fontSize:'13px', margin:'0' }}>No appointments today.</p>
                </div>
              ) : appts.map((a, i) => {
                const s = STATUS[a.status] || STATUS.scheduled
                return (
                  <div key={a.id} style={{
                    padding:'14px 20px',
                    borderBottom: i < appts.length-1 ? `1px solid ${T.border}` : 'none',
                    display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px'
                  }}>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:'12px', color:T.primary, fontWeight:'600', margin:'0 0 3px' }}>
                        {new Date(a.appointment_date).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                        <span style={{ color:T.muted, fontWeight:'400', marginLeft:'6px' }}>{a.duration_minutes}min</span>
                      </p>
                      <p onClick={() => router.push(`/patients/${a.patient_id}`)} style={{
                        fontSize:'14px', fontWeight:'500', color:T.text, margin:'0 0 2px', cursor:'pointer'
                      }}>{a.patient_name}</p>
                      {a.reason && <p style={{ fontSize:'12px', color:T.muted, margin:'0' }}>{a.reason}</p>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
                      <span style={{
                        fontSize:'11px', fontWeight:'500', padding:'2px 8px',
                        borderRadius:'999px', background:s.bg, color:s.color
                      }}>{s.label}</span>
                      {a.status === 'scheduled' && (
                        <div style={{ display:'flex', gap:'4px' }}>
                          <button onClick={() => updateStatus(a.id, 'completed')} style={{
                            fontSize:'11px', padding:'3px 8px', borderRadius:'6px',
                            border:'none', background:T.greenBg, color:T.green, cursor:'pointer'
                          }}>Done</button>
                          <button onClick={() => updateStatus(a.id, 'no_show')} style={{
                            fontSize:'11px', padding:'3px 8px', borderRadius:'6px',
                            border:'none', background:T.redBg, color:T.red, cursor:'pointer'
                          }}>No show</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Patient search */}
          <div style={{ background:T.white, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden' }}>
            <div style={{
              padding:'16px 20px', borderBottom:`1px solid ${T.border}`,
              display:'flex', alignItems:'center', justifyContent:'space-between'
            }}>
              <div>
                <h3 style={{ fontSize:'15px', fontWeight:'600', color:T.text, margin:'0 0 2px' }}>Patient Search</h3>
                <p style={{ fontSize:'12px', color:T.muted, margin:'0' }}>{patients.length} registered</p>
              </div>
              <button onClick={() => router.push('/patients')} style={{
                background:T.primary, color:T.white, border:'none',
                borderRadius:'8px', padding:'7px 14px', fontSize:'12px',
                fontWeight:'500', cursor:'pointer'
              }}>+ Add</button>
            </div>
            <div style={{ padding:'12px 20px', borderBottom:`1px solid ${T.border}` }}>
              <input
                type="text" value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search by name or phone..."
                style={{
                  width:'100%', padding:'9px 12px', border:`1px solid ${T.border}`,
                  borderRadius:'10px', fontSize:'13px', outline:'none',
                  boxSizing:'border-box', background:T.bg
                }}
              />
            </div>
            <div style={{ maxHeight:'360px', overflowY:'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center' }}>
                  <p style={{ color:T.muted, fontSize:'13px', margin:'0' }}>
                    {search ? 'No patients found.' : 'Search by name or phone.'}
                  </p>
                </div>
              ) : filtered.slice(0, 20).map((p: any, i: number) => {
                const initials = `${p.first_name[0]}${p.last_name[0]}`.toUpperCase()
                const colors = ['#0d9488','#3b82f6','#8b5cf6','#f59e0b','#ec4899']
                const color  = colors[p.first_name.charCodeAt(0) % colors.length]
                return (
                  <div key={p.id} onClick={() => router.push(`/patients/${p.id}`)}
                    style={{
                      padding:'12px 20px', cursor:'pointer',
                      borderBottom: i < filtered.length-1 ? `1px solid ${T.border}` : 'none',
                      display:'flex', alignItems:'center', gap:'12px'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
                    onMouseLeave={e => (e.currentTarget.style.background = T.white)}
                  >
                    <div style={{
                      width:'34px', height:'34px', borderRadius:'50%',
                      background: color+'20', color, display:'flex',
                      alignItems:'center', justifyContent:'center',
                      fontSize:'12px', fontWeight:'600', flexShrink:0
                    }}>{initials}</div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:'13px', fontWeight:'500', color:T.text, margin:'0 0 2px' }}>
                        {p.first_name} {p.last_name}
                      </p>
                      <p style={{ fontSize:'12px', color:T.muted, margin:'0' }}>{p.phone || 'No phone'}</p>
                    </div>
                    {p.allergies?.length > 0 && (
                      <span style={{ fontSize:'11px', color:T.red, background:T.redBg, padding:'2px 7px', borderRadius:'6px' }}>⚠️</span>
                    )}
                    {p.blood_type && (
                      <span style={{ fontSize:'11px', color:T.red, background:T.redBg, padding:'2px 7px', borderRadius:'6px' }}>{p.blood_type}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}