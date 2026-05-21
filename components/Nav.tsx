'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'

type NavUser = { username: string } | null

export function Nav() {
  const [user, setUser] = useState<NavUser>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles').select('username').eq('id', authUser.id).single()
        if (profile) setUser(profile)
      }
    }
    load()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  const close = () => setMenuOpen(false)

  return (
    <>
      <nav>
        <Link href="/" className="logo" onClick={close}>Sharp<span>d</span></Link>

        <div className="nav-right nav-desktop">
          <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="nav-link">Dashboard</Link>
              <Link href="/feed" className="nav-link">Feed</Link>
              <Link href="/settings" className="nav-link">Settings</Link>
              <Link href={`/u/${user.username}`} style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', textDecoration: 'none' }}>
                @{user.username} ↗
              </Link>
              <Link href="/pick/new" className="btn-pill btn-primary">+ Post Pick</Link>
              <button onClick={handleLogout} style={{ fontSize: '13px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-geist)' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">Sign in</Link>
              <Link href="/signup" className="btn-pill btn-primary">Sign up</Link>
            </>
          )}
          <ThemeToggle />
        </div>

        <div className="nav-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border2)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <span style={{ width: '14px', height: '1.5px', background: 'var(--muted)', borderRadius: '2px', transition: 'all .2s', transform: menuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
            <span style={{ width: '14px', height: '1.5px', background: 'var(--muted)', borderRadius: '2px', opacity: menuOpen ? 0 : 1, transition: 'opacity .2s' }} />
            <span style={{ width: '14px', height: '1.5px', background: 'var(--muted)', borderRadius: '2px', transition: 'all .2s', transform: menuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div style={{ position: 'fixed', top: '61px', left: 0, right: 0, zIndex: 99, background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', backdropFilter: 'blur(12px)' }}>
          <Link href="/leaderboard" className="nav-link" onClick={close}>Leaderboard</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="nav-link" onClick={close}>Dashboard</Link>
              <Link href="/feed" className="nav-link" onClick={close}>Feed</Link>
              <Link href={`/u/${user.username}`} className="nav-link" onClick={close}>@{user.username} ↗</Link>
              <Link href="/settings" className="nav-link" onClick={close}>Settings</Link>
              <Link href="/pick/new" className="btn-pill btn-primary" style={{ textAlign: 'center' }} onClick={close}>+ Post Pick</Link>
              <button onClick={handleLogout} style={{ fontSize: '13px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font-geist)' }}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link" onClick={close}>Sign in</Link>
              <Link href="/signup" className="btn-pill btn-primary" style={{ textAlign: 'center' }} onClick={close}>Sign up</Link>
            </>
          )}
        </div>
      )}
    </>
  )
}