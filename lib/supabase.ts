// ============================================
// SUPABASE CLIENT SETUP
// Uses @supabase/ssr — the current recommended
// package for Next.js App Router projects
// ============================================

import { createBrowserClient } from '@supabase/ssr'

// ==================
// CLIENT SIDE CLIENT
// Use this in any file that has 'use client'
// at the top. Works in the browser.
// ==================
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

// ==================
// TYPE DEFINITIONS
// These mirror your database tables exactly.
// TypeScript uses these to catch errors early.
// ==================

export type Clinic = {
  id: string
  name: string
  owner_name: string
  email: string
  phone: string
  address: string
  created_at: string
}

export type Patient = {
  id: string
  clinic_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: 'male' | 'female' | 'other'
  phone: string
  email: string
  blood_type: string
  allergies: string[]
  notes: string
  created_at: string
}

export type Staff = {
  id: string
  clinic_id: string
  full_name: string
  role: 'owner' | 'dentist' | 'receptionist'
  email: string
  phone: string
}

export type Treatment = {
  id: string
  clinic_id: string
  patient_id: string
  dentist_id: string
  treatment_type: string
  tooth_area: string
  notes: string
  cost: number
  status: 'planned' | 'in_progress' | 'completed'
  treatment_date: string
  created_at: string
}

export type Appointment = {
  id: string
  clinic_id: string
  patient_id: string
  dentist_id: string
  appointment_date: string
  duration_minutes: number
  reason: string
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled'
  created_at: string
}

export type Invoice = {
  id: string
  clinic_id: string
  patient_id: string
  treatment_id: string
  amount: number
  paid_amount: number
  payment_method: 'cash' | 'telebirr' | 'cbe_birr' | 'bank_transfer' | 'other'
  status: 'unpaid' | 'partial' | 'paid'
  due_date: string
  paid_at: string
  created_at: string
}

export type Expense = {
  id: string
  clinic_id: string
  category: 'supplies' | 'equipment' | 'rent' | 'salaries' | 'utilities' | 'other'
  description: string
  amount: number
  expense_date: string
  created_at: string
}

export type MonthlyRevenue = {
  clinic_id: string
  month: string
  total_revenue: number
  total_invoices: number
}

export type TreatmentRevenue = {
  clinic_id: string
  treatment_type: string
  total_done: number
  total_revenue: number
  avg_cost: number
}

export type DentistPerformance = {
  clinic_id: string
  dentist_id: string
  dentist_name: string
  treatments_done: number
  revenue_generated: number
}

export type NoShowStats = {
  clinic_id: string
  noshows: number
  total_appointments: number
  noshow_rate_percent: number
}