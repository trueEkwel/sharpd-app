'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Nav } from '@/components/Nav'

type FeedPick = {
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
  user_id: string
  username: string
}

export default function Feed() {
  const router = useRouter()
  const [picks, setPicks] = useState<FeedPick[]>([])
  const [loading, setLoading] = useState(true)
  const [hasFollows, setHasFollows] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      if (!follows || follows.length === 0) {
        setHasFollows(false)
        setLoading(false)
        return
      }

      setHasFollows(true)
      const followingIds = follows.map((f: { following_id: string }) => f.following_id)

      const [{ data: rawPicks }, { data: profilesData }] = await Promise.all([
        supabase.from('picks')
          .select('id, match_name, market, odds, units, status, created_at, competition, analysis, profit_loss, user_id')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('profiles').select('id, username').in('id', followingIds),
      ])

      const usernameMap: Record<string, string> = {}
      profilesData?.forEach((p: { id: string; username: string }) => { usernameMap[p.id] = p.username })

      setPicks((rawPicks || []).map(p => ({ ...p, username: usernameMap[p.user_id] || '' })))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your Network</div>
          <h1 style={{ fontSize: '36px', marginBottom: '8px' }}>Feed</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Latest picks from predictors you follow.</p>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', fontSize: '13px' }}>Loading...</p>
          </div>
        ) : !hasFollows ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>◈</div>
            <p style={{ fontWeight: 500, marginBottom: '8px', fontSize: '16px' }}>Your feed is empty</p>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
              Follow some predictors to see their picks here
            </p>
            <Link href="/leaderboard" className="btn-pill btn-primary">Browse leaderboard</Link>
          </div>
        ) : picks.length === 0 ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No picks from followed predictors yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {picks.map(pick => (
              <div key={pick.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.2), transparent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Link href={`/u/${pick.username}`} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--green)', textDecoration: 'none', fontWeight: 500 }}>
                    @{pick.username}
                  </Link>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)' }}>
                    {new Date(pick.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '3px' }}>{pick.match_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: pick.analysis ? '8px' : '0' }}>
                      {pick.market} · @{pick.odds} · {pick.units}u{pick.competition ? ` · ${pick.competition}` : ''}
                    </div>
                    {pick.analysis && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.55', padding: '8px 12px', background: 'var(--bg3)', borderRadius: '8px', borderLeft: '2px solid var(--green-border)' }}>
                        {pick.analysis}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '11px', padding: '3px 10px', borderRadius: '4px',
                      fontWeight: 500, marginBottom: '4px', display: 'inline-block',
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
