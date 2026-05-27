// ============================================
// ROOT PAGE
// When someone visits your app at /
// redirect them to /login automatically
// ============================================

import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}