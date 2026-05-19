'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    })

    if (error) setMessage(error.message)
    else setMessage('Check your email to confirm your account.')
    setLoading(false)
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

        <h2 style={{ marginBottom: '8px', fontSize: '22px' }}>Create your account</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px' }}>
          Build your verified prediction record.
        </p>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={inputStyle}
          />
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: '16px', fontSize: '13px', color: message.includes('Check') ? 'var(--green)' : 'var(--red)' }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: '24px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--green)', textDecoration: 'none' }}>Sign in</Link>
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