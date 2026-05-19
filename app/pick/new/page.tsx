'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewPick() {
  const [form, setForm] = useState({
    sport: 'Football',
    match_name: '',
    competition: '',
    market: '',
    odds: '',
    units: '1',
    analysis: '',
    match_start: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Prüfen ob Match noch nicht gestartet hat
    const matchStart = new Date(form.match_start)
    if (matchStart <= new Date()) {
      setError('Match has already started — picks must be posted before kickoff.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('picks').insert({
      user_id: user.id,
      sport: form.sport,
      match_name: form.match_name,
      competition: form.competition || null,
      market: form.market,
      odds: parseFloat(form.odds),
      units: parseFloat(form.units),
      analysis: form.analysis || null,
      match_start: matchStart.toISOString(),
      status: 'pending',
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav>
        <Link href="/" className="logo">Sharp<span>d</span></Link>
        <div className="nav-right">
          <Link href="/dashboard" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
            ← Back to dashboard
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px 60px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            New Pick
          </div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Post a pick</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Every pick is timestamped and locked before kickoff. Public forever.
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Sport */}
          <div>
            <label style={labelStyle}>Sport</label>
            <select name="sport" value={form.sport} onChange={handleChange} style={inputStyle}>
              {['Football', 'Basketball', 'Tennis', 'American Football', 'Baseball', 'Hockey', 'Other'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Match */}
          <div>
            <label style={labelStyle}>Match</label>
            <input
              name="match_name"
              value={form.match_name}
              onChange={handleChange}
              placeholder="e.g. Man City vs Arsenal"
              required
              style={inputStyle}
            />
          </div>

          {/* Competition */}
          <div>
            <label style={labelStyle}>Competition <span style={{ color: 'var(--dim)' }}>(optional)</span></label>
            <input
              name="competition"
              value={form.competition}
              onChange={handleChange}
              placeholder="e.g. Premier League, Champions League"
              style={inputStyle}
            />
          </div>

          {/* Market */}
          <div>
            <label style={labelStyle}>Market / Pick</label>
            <input
              name="market"
              value={form.market}
              onChange={handleChange}
              placeholder="e.g. Over 2.5, Home Win, BTTS"
              required
              style={inputStyle}
            />
          </div>

          {/* Odds + Units */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Odds (decimal)</label>
              <input
                name="odds"
                type="number"
                step="0.01"
                min="1.01"
                value={form.odds}
                onChange={handleChange}
                placeholder="e.g. 1.87"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Units</label>
              <input
                name="units"
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={form.units}
                onChange={handleChange}
                placeholder="e.g. 1"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Match Start */}
          <div>
            <label style={labelStyle}>Match Start (local time)</label>
            <input
              name="match_start"
              type="datetime-local"
              value={form.match_start}
              onChange={handleChange}
              required
              style={inputStyle}
            />
            <p style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
              Pick locks automatically at kickoff — cannot be edited after posting.
            </p>
          </div>

          {/* Analysis */}
          <div>
            <label style={labelStyle}>Analysis <span style={{ color: 'var(--dim)' }}>(optional)</span></label>
            <textarea
              name="analysis"
              value={form.analysis}
              onChange={handleChange}
              placeholder="Why are you making this pick? What's the edge?"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px', background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px',
              fontSize: '13px', color: 'var(--red)'
            }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="submit" className="btn-submit" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Posting...' : '🔒 Lock & Post Pick'}
            </button>
            <Link href="/dashboard" style={{
              padding: '12px 20px', background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: '10px', fontSize: '14px', color: 'var(--muted)',
              textDecoration: 'none', display: 'flex', alignItems: 'center'
            }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--muted)',
  marginBottom: '6px',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '.03em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--bg2)',
  border: '1px solid var(--border2)',
  borderRadius: '10px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}