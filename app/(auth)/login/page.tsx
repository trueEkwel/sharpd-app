'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: '16px', padding: '40px'
      }}>
        <a href="/" className="logo" style={{ display: 'block', marginBottom: '32px' }}>
          Sharp<span>d</span>
        </a>

        <h2 style={{ marginBottom: '8px', fontSize: '22px' }}>Welcome back</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px' }}>
          Sign in to your account.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" className="btn-submit" style={{ marginTop: '8px' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px' }}>
          <Link href="/forgot-password" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </p>

        {error && (
          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--red)' }}>{error}</p>
        )}

        <p style={{ marginTop: '24px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
          No account yet?{' '}
          <Link href="/signup" style={{ color: 'var(--green)', textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: '10px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  width: '100%'
}