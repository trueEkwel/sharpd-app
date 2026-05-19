'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Profile = {
  id: string
  username: string
  display_name: string
  bio: string | null
  created_at: string
}

type Pick = {
  id: string
  match_name: string
  market: string
  odds: number
  units: number
  status: string
  created_at: string
  competition: string | null
  analysis: string | null
  profit_loss: number | null
  match_start: string
}

export default function PublicProfile() {
  const { username } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const loadProfile = async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (!profileData) { setNotFound(true); setLoading(false); return }

      const { data: picksData } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false })

      setProfile(profileData)
      setPicks(picksData || [])
      setLoading(false)
    }

    loadProfile()
  }, [username])

  // Stats
  const totalPicks = picks.length
  const settledPicks = picks.filter(p => p.status !== 'pending')
  const wins = picks.filter(p => p.status === 'win').length
  const winrate = settledPicks.length > 0 ? ((wins / settledPicks.length) * 100).toFixed(1) : '—'
  const totalUnitsStaked = picks.reduce((sum, p) => sum + p.units, 0)
  const totalProfit = picks.reduce((sum, p) => sum + (p.profit_loss || 0), 0)
  const roi = totalUnitsStaked > 0 ? ((totalProfit / totalUnitsStaked) * 100).toFixed(1) : '—'
  const avgOdds = totalPicks > 0 ? (picks.reduce((sum, p) => sum + p.odds, 0) / totalPicks).toFixed(2) : '—'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>Loading...</p>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '32px' }}>◈</div>
      <h1 style={{ fontSize: '22px' }}>Profile not found</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>This user doesn&apos;t exist on Sharpd.</p>
      <Link href="/" style={{ color: 'var(--green)', fontSize: '14px' }}>← Back to Sharpd</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* NAV */}
      <nav>
        <Link href="/" className="logo">Sharp<span>d</span></Link>
        <div className="nav-right">
          <Link href="/login" className="nav-link">Sign in</Link>
          <Link href="/signup" className="btn-pill btn-primary">Sign up</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '100px 24px 60px' }}>

        {/* PROFILE HEADER */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '32px', marginBottom: '16px',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)'
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--green-bg)', border: '1px solid var(--green-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: '18px', color: 'var(--green)',
              flexShrink: 0
            }}>
              {profile?.username?.slice(0, 2).toUpperCase()}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Verified Predictor
              </div>
              <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>@{profile?.username}</h1>
              {profile?.bio && (
                <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '8px' }}>
                  {profile.bio}
                </p>
              )}
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--dim)' }}>
                Member since {new Date(profile?.created_at || '').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Verified badge */}
            <div style={{
              padding: '6px 12px', background: 'var(--green-bg)',
              border: '1px solid var(--green-border)', borderRadius: '8px',
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)',
              letterSpacing: '.05em', fontWeight: 500
            }}>
              ◈ PUBLIC RECORD
            </div>
          </div>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '24px' }}>
          {[
            { label: 'Picks', value: totalPicks.toString() },
            { label: 'Winrate', value: winrate === '—' ? '—' : `${winrate}%` },
            { label: 'ROI', value: roi === '—' ? '—' : `${Number(roi) >= 0 ? '+' : ''}${roi}%` },
            { label: 'Units P/L', value: totalProfit === 0 && totalPicks === 0 ? '—' : `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}u` },
            { label: 'Avg Odds', value: avgOdds },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '14px 16px'
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {stat.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 500,
                color: stat.label === 'ROI' || stat.label === 'Units P/L'
                  ? (stat.value.startsWith('+') ? 'var(--green)' : stat.value.startsWith('-') ? 'var(--red)' : 'var(--text)')
                  : 'var(--text)'
              }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* PICKS */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, fontSize: '14px' }}>Pick History</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--dim)' }}>
              Every pick is public · No edits · No deletes
            </span>
          </div>

          {picks.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No picks posted yet.</p>
            </div>
          ) : (
            picks.map(pick => (
              <div key={pick.id} style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '3px' }}>
                      {pick.match_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: pick.analysis ? '8px' : '0' }}>
                      {pick.market} · @{pick.odds} · {pick.units}u
                      {pick.competition ? ` · ${pick.competition}` : ''}
                    </div>
                    {pick.analysis && (
                      <div style={{
                        fontSize: '12px', color: 'var(--muted)', lineHeight: '1.55',
                        padding: '8px 12px', background: 'var(--bg3)',
                        borderRadius: '8px', borderLeft: '2px solid var(--green-border)'
                      }}>
                        {pick.analysis}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '3px 10px',
                      borderRadius: '4px', fontWeight: 500, marginBottom: '4px',
                      display: 'inline-block',
                      background: pick.status === 'win' ? 'rgba(34,197,94,0.1)' : pick.status === 'loss' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
                      color: pick.status === 'win' ? 'var(--green)' : pick.status === 'loss' ? 'var(--red)' : 'var(--muted)',
                      border: `1px solid ${pick.status === 'win' ? 'rgba(34,197,94,0.25)' : pick.status === 'loss' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
                    }}>
                      {pick.status.toUpperCase()}
                    </div>
                    {pick.profit_loss !== null && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: pick.profit_loss >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {pick.profit_loss >= 0 ? '+' : ''}{pick.profit_loss.toFixed(2)}u
                      </div>
                    )}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', marginTop: '4px' }}>
                      {new Date(pick.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA für nicht eingeloggte User */}
        <div style={{
          marginTop: '24px', padding: '24px', background: 'var(--bg2)',
          border: '1px solid var(--border)', borderRadius: '16px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
            Build your own verified prediction record on Sharpd.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Link href="/signup" className="btn-pill btn-primary">Create free account</Link>
            <Link href="/" style={{
              padding: '9px 20px', borderRadius: '999px', fontSize: '13px',
              color: 'var(--muted)', textDecoration: 'none',
              border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center'
            }}>
              Learn more
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}