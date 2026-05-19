'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: '16px', padding: '40px'
      }}>
        <Link href="/" className="logo" style={{ display: 'block', marginBottom: '32px' }}>
          Sharp<span>d</span>
        </Link>

        {sent ? (
          <div>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>✓</div>
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>Check your email</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              We sent a password reset link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              Click the link in the email to reset your password.
            </p>
            <Link href="/login" style={{ color: 'var(--green)', fontSize: '14px', textDecoration: 'none' }}>
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>Reset password</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', lineHeight: '1.6' }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            {error && (
              <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--red)' }}>{error}</p>
            )}

            <p style={{ marginTop: '24px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
              <Link href="/login" style={{ color: 'var(--green)', textDecoration: 'none' }}>← Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  background: 'var(--bg3)', border: '1px solid var(--border2)',
  borderRadius: '10px', color: 'var(--text)', fontSize: '14px',
  outline: 'none', fontFamily: 'var(--font-sans)',
}