'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type LeaderboardEntry = {
  username: string
  totalPicks: number
  settledPicks: number
  wins: number
  winrate: number
  roi: number
  totalProfit: number
  avgOdds: number
}

const MIN_PICKS = 5

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'roi' | 'profit' | 'winrate'>('roi')

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')

      if (!profiles) { setLoading(false); return }

      const { data: picks } = await supabase
        .from('picks')
        .select('user_id, odds, units, status, profit_loss')

      if (!picks) { setLoading(false); return }

      const board: LeaderboardEntry[] = profiles.map(profile => {
        const userPicks = picks.filter(p => p.user_id === profile.id)
        const settled = userPicks.filter(p => p.status !== 'pending')
        const wins = userPicks.filter(p => p.status === 'win').length
        const totalStaked = userPicks.reduce((s, p) => s + p.units, 0)
        const totalProfit = userPicks.reduce((s, p) => s + (p.profit_loss || 0), 0)
        const avgOdds = userPicks.length > 0
          ? userPicks.reduce((s, p) => s + p.odds, 0) / userPicks.length
          : 0

        return {
          username: profile.username,
          totalPicks: userPicks.length,
          settledPicks: settled.length,
          wins,
          winrate: settled.length > 0 ? (wins / settled.length) * 100 : 0,
          roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
          totalProfit,
          avgOdds,
        }
      })
        .filter(e => e.settledPicks >= MIN_PICKS)
        .sort((a, b) => b.roi - a.roi)

      setEntries(board)
      setLoading(false)
    }

    load()
  }, [])

  const sorted = [...entries].sort((a, b) =>
    filter === 'roi' ? b.roi - a.roi :
    filter === 'profit' ? b.totalProfit - a.totalProfit :
    b.winrate - a.winrate
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav>
        <Link href="/" className="logo">Sharp<span>d</span></Link>
        <div className="nav-right">
          <Link href="/login" className="nav-link">Sign in</Link>
          <Link href="/signup" className="btn-pill btn-primary">Sign up</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '100px 24px 60px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Global Rankings
          </div>
          <h1 style={{ fontSize: '36px', marginBottom: '8px' }}>Leaderboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Ranked by verified performance. Minimum {MIN_PICKS} settled picks required.
            <br />Every stat is calculated from public, timestamped picks only.
          </p>
        </div>

        {/* FILTER */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {(['roi', 'profit', 'winrate'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px', borderRadius: '8px', fontSize: '12px',
                fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'pointer',
                border: '1px solid',
                background: filter === f ? 'var(--green-bg)' : 'transparent',
                color: filter === f ? 'var(--green)' : 'var(--muted)',
                borderColor: filter === f ? 'var(--green-border)' : 'var(--border)',
                transition: 'all .15s',
              }}
            >
              {f === 'roi' ? 'ROI %' : f === 'profit' ? 'Units P/L' : 'Winrate'}
            </button>
          ))}
        </div>

        {/* TABLE */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>

          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 70px 70px 80px 90px 80px',
            gap: '8px', padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
          }}>
            {['#', 'Predictor', 'Picks', 'Winrate', 'Avg Odds', 'ROI', 'Units P/L'].map(h => (
              <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>Loading rankings...</p>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>◈</div>
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>No rankings yet</p>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
                Be the first — post {MIN_PICKS} picks and settle them to appear here.
              </p>
              <Link href="/signup" className="btn-pill btn-primary">Start tracking</Link>
            </div>
          ) : (
            sorted.map((entry, i) => (
              <Link
                key={entry.username}
                href={`/u/${entry.username}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 70px 70px 80px 90px 80px',
                  gap: '8px', padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background .12s',
                  cursor: 'pointer',
                  background: i === 0 ? 'rgba(34,197,94,0.03)' : 'transparent',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? 'rgba(34,197,94,0.03)' : 'transparent')}
                >
                  {/* Rank */}
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500,
                    color: i === 0 ? 'var(--green)' : i === 1 ? '#C0A060' : i === 2 ? '#9090A0' : 'var(--dim)',
                  }}>
                    {i === 0 ? '◈' : i + 1}
                  </div>

                  {/* Username */}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '1px' }}>
                      @{entry.username}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)' }}>
                      {entry.settledPicks} settled
                    </div>
                  </div>

                  {/* Picks */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', alignSelf: 'center' }}>
                    {entry.totalPicks}
                  </div>

                  {/* Winrate */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', alignSelf: 'center' }}>
                    {entry.winrate.toFixed(1)}%
                  </div>

                  {/* Avg Odds */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', alignSelf: 'center', color: 'var(--muted)' }}>
                    {entry.avgOdds.toFixed(2)}
                  </div>

                  {/* ROI */}
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, alignSelf: 'center',
                    color: entry.roi >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                  </div>

                  {/* Units P/L */}
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '13px', alignSelf: 'center',
                    color: entry.totalProfit >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    {entry.totalProfit >= 0 ? '+' : ''}{entry.totalProfit.toFixed(2)}u
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* INFO */}
        <div style={{
          marginTop: '16px', padding: '14px 18px',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap'
        }}>
          {[
            { icon: '🔒', text: 'All picks timestamped before kickoff' },
            { icon: '≠', text: 'No edits or deletions possible' },
            { icon: '◈', text: `Min. ${MIN_PICKS} settled picks to rank` },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}