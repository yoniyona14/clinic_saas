import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================
// PROXY (previously called middleware)
// Runs on every request to check if user
// is logged in before showing any page
// ============================================

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  })

  // Create Supabase client for server side
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage  = req.nextUrl.pathname === '/login'
  const isSignupPage = req.nextUrl.pathname === '/signup'
  const isPublicPage = isLoginPage || isSignupPage

  // Not logged in + trying to access protected page → send to login
  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Already logged in + visiting login page → send to dashboard
  if (user && isPublicPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}