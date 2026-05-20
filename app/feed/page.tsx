'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Avatar } from '@/components/Avatar'

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
  avatar_url: string | null
}

type VoteValue = 1 | -1 | 0
type VoteState = { up: number; down: number; userVote: VoteValue }

export default function Feed() {
  const router = useRouter()
  const [picks, setPicks] = useState<FeedPick[]>([])
  const [loading, setLoading] = useState(true)
  const [hasFollows, setHasFollows] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pickVotes, setPickVotes] = useState<Record<string, VoteState>>({})
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

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
        supabase.from('profiles').select('id, username, avatar_url').in('id', followingIds),
      ])

      const profileMap: Record<string, { username: string; avatar_url: string | null }> = {}
      profilesData?.forEach((p: { id: string; username: string; avatar_url: string | null }) => {
        profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url }
      })

      const merged = (rawPicks || []).map(p => ({
        ...p,
        username: profileMap[p.user_id]?.username || '',
        avatar_url: profileMap[p.user_id]?.avatar_url ?? null,
      }))
      setPicks(merged)

      if (rawPicks && rawPicks.length > 0) {
        const pickIds = rawPicks.map(p => p.id)
        const { data: votesData } = await supabase
          .from('pick_votes')
          .select('pick_id, user_id, vote')
          .in('pick_id', pickIds)
        if (votesData) {
          const vm: Record<string, VoteState> = {}
          for (const v of votesData) {
            if (!vm[v.pick_id]) vm[v.pick_id] = { up: 0, down: 0, userVote: 0 }
            if (v.vote === 1) vm[v.pick_id].up++
            else if (v.vote === -1) vm[v.pick_id].down++
            if (v.user_id === user.id) vm[v.pick_id].userVote = v.vote as VoteValue
          }
          setPickVotes(vm)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const handlePickVote = async (pickId: string, dir: 1 | -1) => {
    if (!currentUserId) return
    const cur = pickVotes[pickId] ?? { up: 0, down: 0, userVote: 0 as VoteValue }
    if (cur.userVote === dir) {
      setPickVotes(prev => ({ ...prev, [pickId]: { up: dir === 1 ? cur.up - 1 : cur.up, down: dir === -1 ? cur.down - 1 : cur.down, userVote: 0 } }))
      await supabase.from('pick_votes').delete().eq('pick_id', pickId).eq('user_id', currentUserId)
    } else {
      setPickVotes(prev => ({ ...prev, [pickId]: { up: dir === 1 ? cur.up + 1 : cur.userVote === 1 ? cur.up - 1 : cur.up, down: dir === -1 ? cur.down + 1 : cur.userVote === -1 ? cur.down - 1 : cur.down, userVote: dir } }))
      if (cur.userVote === 0) {
        await supabase.from('pick_votes').insert({ pick_id: pickId, user_id: currentUserId, vote: dir })
      } else {
        await supabase.from('pick_votes').update({ vote: dir }).eq('pick_id', pickId).eq('user_id', currentUserId)
      }
    }
  }

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
            {picks.map(pick => {
              const pv = pickVotes[pick.id]
              const net = (pv?.up ?? 0) - (pv?.down ?? 0)
              return (
                <div key={pick.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.2), transparent)' }} />

                  {/* Author row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <Avatar url={pick.avatar_url} username={pick.username} size={32} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Link href={`/u/${pick.username}`} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--green)', textDecoration: 'none', fontWeight: 500 }}>
                        @{pick.username}
                      </Link>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)' }}>
                        {new Date(pick.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  {/* Pick content */}
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
                      {/* Vote buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                        <button
                          onClick={() => handlePickVote(pick.id, 1)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', cursor: 'pointer', border: '1px solid', borderColor: pv?.userVote === 1 ? 'var(--green-border)' : 'var(--border)', background: pv?.userVote === 1 ? 'var(--green-bg)' : 'transparent', color: pv?.userVote === 1 ? 'var(--green)' : 'var(--dim)', transition: 'all .15s' }}
                        >▲ {pv?.up ?? 0}</button>
                        <button
                          onClick={() => handlePickVote(pick.id, -1)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', cursor: 'pointer', border: '1px solid', borderColor: pv?.userVote === -1 ? 'rgba(248,113,113,0.25)' : 'var(--border)', background: pv?.userVote === -1 ? 'rgba(248,113,113,0.1)' : 'transparent', color: pv?.userVote === -1 ? 'var(--red)' : 'var(--dim)', transition: 'all .15s' }}
                        >▼ {pv?.down ?? 0}</button>
                        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--dim)' }}>{net > 0 ? `+${net}` : net}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', padding: '3px 10px', borderRadius: '4px', fontWeight: 500, marginBottom: '4px', display: 'inline-block', background: pick.status === 'win' ? 'rgba(34,197,94,0.1)' : pick.status === 'loss' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)', color: pick.status === 'win' ? 'var(--green)' : pick.status === 'loss' ? 'var(--red)' : 'var(--muted)', border: `1px solid ${pick.status === 'win' ? 'rgba(34,197,94,0.25)' : pick.status === 'loss' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}` }}>
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
