'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Match = {
  id: number
  homeTeam: string
  awayTeam: string
  competition: string
  competitionCode: string
  utcDate: string
}

const COMMON_MARKETS = [
  'Home Win', 'Away Win', 'Draw',
  'Over 1.5', 'Over 2.5', 'Over 3.5',
  'Under 1.5', 'Under 2.5', 'Under 3.5',
  'BTTS', 'BTTS No', '1X', 'X2', '12',
]

export default function NewPick() {
  const [form, setForm] = useState({ market: '', odds: '', units: '1', analysis: '' })
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Match[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setShowDropdown(false); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/matches?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data.matches || [])
        setShowDropdown(true)
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const selectMatch = (match: Match) => {
    setSelectedMatch(match)
    setSearchQuery(`${match.homeTeam} vs ${match.awayTeam}`)
    setShowDropdown(false)
  }

  const clearMatch = () => { setSelectedMatch(null); setSearchQuery(''); setSearchResults([]) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!selectedMatch) { setError('Please search and select a real match.'); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const matchStart = new Date(selectedMatch.utcDate)
    if (matchStart <= new Date()) {
      setError('Match has already started — picks must be posted before kickoff.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('picks').insert({
      user_id: user.id,
      sport: 'Football',
      match_name: `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}`,
      home_team: selectedMatch.homeTeam,
      away_team: selectedMatch.awayTeam,
      competition: selectedMatch.competition,
      competition_code: selectedMatch.competitionCode,
      api_match_id: selectedMatch.id,
      market: form.market,
      odds: parseFloat(form.odds),
      units: parseFloat(form.units),
      analysis: form.analysis || null,
      match_start: matchStart.toISOString(),
      status: 'pending',
    })

    if (insertError) { setError(insertError.message); setLoading(false); return }
    router.push('/dashboard')
  }

  const formatMatchDate = (utcDate: string) =>
    new Date(utcDate).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav>
        <Link href="/" className="logo">Sharp<span>d</span></Link>
        <div className="nav-right">
          <Link href="/dashboard" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>← Back</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px 60px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>New Pick</div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Post a pick</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>Every pick is timestamped and locked before kickoff. Public forever.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Match Search */}
          <div ref={searchRef}>
            <label style={labelStyle}>Match</label>
            {selectedMatch ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--green-border)', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '3px' }}>
                      {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>
                      {selectedMatch.competition} · {formatMatchDate(selectedMatch.utcDate)}
                    </div>
                  </div>
                  <button type="button" onClick={clearMatch} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>
                <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>◈</span> Verified match · Auto-settlement enabled
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search team or competition... e.g. Arsenal, Bayern"
                  style={inputStyle}
                />
                {searching && (
                  <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--dim)' }}>searching...</div>
                )}
                {showDropdown && searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '10px', marginTop: '4px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    {searchResults.map(match => (
                      <div key={match.id} onClick={() => selectMatch(match)}
                        style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '2px' }}>{match.homeTeam} vs {match.awayTeam}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>{match.competition} · {formatMatchDate(match.utcDate)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {showDropdown && searchResults.length === 0 && !searching && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '10px', marginTop: '4px', padding: '16px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
                    No matches found — try a different team name
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Market */}
          <div>
            <label style={labelStyle}>Market / Pick</label>
            <input
              list="markets"
              value={form.market}
              onChange={e => setForm(p => ({ ...p, market: e.target.value }))}
              placeholder="e.g. Over 2.5, Home Win, BTTS"
              required
              style={inputStyle}
            />
            <datalist id="markets">
              {COMMON_MARKETS.map(m => <option key={m} value={m} />)}
            </datalist>
            <p style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '5px', fontFamily: 'var(--font-mono)' }}>
              Standard markets are auto-settled: Home Win, Away Win, Draw, Over/Under X.5, BTTS
            </p>
          </div>

          {/* Odds + Units */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Odds (decimal)</label>
              <input type="number" step="0.01" min="1.01" value={form.odds}
                onChange={e => setForm(p => ({ ...p, odds: e.target.value }))}
                placeholder="e.g. 1.87" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Units</label>
              <input type="number" step="0.5" min="0.5" max="10" value={form.units}
                onChange={e => setForm(p => ({ ...p, units: e.target.value }))}
                placeholder="e.g. 1" required style={inputStyle} />
            </div>
          </div>

          {/* Analysis */}
          <div>
            <label style={labelStyle}>Analysis <span style={{ color: 'var(--dim)' }}>(optional)</span></label>
            <textarea value={form.analysis}
              onChange={e => setForm(p => ({ ...p, analysis: e.target.value }))}
              placeholder="Why are you making this pick? What's the edge?"
              rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px', fontSize: '13px', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="submit" className="btn-submit" style={{ flex: 1 }} disabled={loading || !selectedMatch}>
              {loading ? 'Posting...' : '🔒 Lock & Post Pick'}
            </button>
            <Link href="/dashboard" style={{ padding: '12px 20px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '10px', fontSize: '14px', color: 'var(--muted)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 500,
  color: 'var(--muted)', marginBottom: '6px',
  fontFamily: 'var(--font-mono)', letterSpacing: '.03em', textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: '10px', color: 'var(--text)', fontSize: '14px',
  outline: 'none', fontFamily: 'var(--font-sans)',
}