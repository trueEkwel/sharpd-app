'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Nav } from '@/components/Nav'

type Profile = {
  username: string
  display_name: string
}

type Pick = {
  id: string
  match_name: string
  market: string
  odds: number
  units: number
  status: string
  created_at: string
  competition: string
  profit_loss: number | null
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      const { data: picksData } = await supabase
        .from('picks').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setProfile(profileData)
      setPicks(picksData || [])
      setLoading(false)
    }
    loadData()
  }, [])

  const totalPicks = picks.length
  const settledPicks = picks.filter(p => p.status !== 'pending')
  const wins = picks.filter(p => p.status === 'win').length
  const winrate = settledPicks.length > 0 ? ((wins / settledPicks.length) * 100).toFixed(1) : '—'
  const totalUnitsStaked = picks.reduce((sum, p) => sum + p.units, 0)
  const totalProfit = picks.reduce((sum, p) => sum + (p.profit_loss || 0), 0)
  const roi = totalUnitsStaked > 0 ? ((totalProfit / totalUnitsStaked) * 100).toFixed(1) : '—'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', fontSize: '13px' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Your record
          </div>
          <h1 style={{ fontSize: '32px', marginBottom: '4px' }}>@{profile?.username}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            {totalPicks === 0 ? 'No picks yet — post your first one.' : `${totalPicks} pick${totalPicks !== 1 ? 's' : ''} tracked`}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '32px' }}>
          {[
            { label: 'Total Picks', value: totalPicks.toString() },
            { label: 'Winrate', value: winrate === '—' ? '—' : `${winrate}%` },
            { label: 'ROI', value: roi === '—' ? '—' : `${Number(roi) >= 0 ? '+' : ''}${roi}%` },
            { label: 'Units P/L', value: totalProfit === 0 && totalPicks === 0 ? '—' : `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}u` },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {stat.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '22px', fontWeight: 500,
                color: stat.label === 'ROI' || stat.label === 'Units P/L'
                  ? (stat.value.startsWith('+') ? 'var(--green)' : stat.value.startsWith('-') ? 'var(--red)' : 'var(--text)')
                  : 'var(--text)'
              }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, fontSize: '14px' }}>Pick History</span>
            <Link href="/pick/new" style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', textDecoration: 'none' }}>
              + New Pick
            </Link>
          </div>

          {picks.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>◈</div>
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>No picks yet</p>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
                Post your first pick and start building your verified record.
              </p>
              <Link href="/pick/new" className="btn-pill btn-primary">Post first pick</Link>
            </div>
          ) : (
            picks.map(pick => (
              <div key={pick.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pick.match_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {pick.market} · {pick.odds} · {pick.units}u
                      {pick.competition ? ` · ${pick.competition}` : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '11px', padding: '3px 10px',
                      borderRadius: '4px', fontWeight: 500, marginBottom: '4px', display: 'inline-block',
                      background: pick.status === 'win' ? 'rgba(34,197,94,0.1)' : pick.status === 'loss' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
                      color: pick.status === 'win' ? 'var(--green)' : pick.status === 'loss' ? 'var(--red)' : 'var(--muted)',
                      border: `1px solid ${pick.status === 'win' ? 'rgba(34,197,94,0.25)' : pick.status === 'loss' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
                    }}>
                      {pick.status.toUpperCase()}
                    </div>
                    {pick.profit_loss !== null && (
                      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: pick.profit_loss >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {pick.profit_loss >= 0 ? '+' : ''}{pick.profit_loss.toFixed(2)}u
                      </div>
                    )}
                  </div>
                </div>

                {pick.status === 'pending' && (
                  <div style={{ marginTop: '8px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--green)' }}>◈</span> Auto-settlement pending · Settles after match ends
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}