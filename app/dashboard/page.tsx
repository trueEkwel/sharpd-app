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

type Notification = {
  id: string
  icon: string
  text: string
  time: string
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { data: profileData },
        { data: picksData },
        { data: newFollows },
        { data: pickVotes },
        { data: commentsData },
        { data: allPicks },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('picks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('follows').select('follower_id, created_at').eq('following_id', user.id).gte('created_at', sevenDaysAgo),
        supabase.from('pick_votes').select('pick_id, user_id, vote, created_at').eq('user_id', user.id).gte('created_at', sevenDaysAgo),
        supabase.from('comments').select('pick_id, user_id, created_at').gte('created_at', sevenDaysAgo),
        supabase.from('picks').select('user_id, units, status, profit_loss'),
      ])

      setProfile(profileData)
      const loadedPicks = picksData || []
      setPicks(loadedPicks)

      // Compute rank
      if (allPicks) {
        const userMap: Record<string, { staked: number; profit: number; settled: number }> = {}
        for (const p of allPicks) {
          if (!userMap[p.user_id]) userMap[p.user_id] = { staked: 0, profit: 0, settled: 0 }
          if (p.status !== 'pending') {
            userMap[p.user_id].staked += p.units
            userMap[p.user_id].profit += p.profit_loss ?? 0
            userMap[p.user_id].settled += 1
          }
        }
        const rois = Object.entries(userMap)
          .filter(([, v]) => v.settled >= 5 && v.staked > 0)
          .map(([id, v]) => ({ id, roi: (v.profit / v.staked) * 100 }))
          .sort((a, b) => b.roi - a.roi)
        const myIdx = rois.findIndex(r => r.id === user.id)
        if (myIdx >= 0) setRank(myIdx + 1)
      }

      // Build notifications
      const notifs: Notification[] = []

      // New followers
      if (newFollows && newFollows.length > 0) {
        const followerIds = newFollows.map(f => f.follower_id)
        const { data: followerProfiles } = await supabase.from('profiles').select('id, username').in('id', followerIds)
        const fpm: Record<string, string> = {}
        for (const p of followerProfiles ?? []) fpm[p.id] = p.username
        for (const f of newFollows.slice(0, 2)) {
          notifs.push({ id: `follow-${f.follower_id}`, icon: '👤', text: `@${fpm[f.follower_id] ?? '...'} started following you`, time: f.created_at })
        }
        if (newFollows.length > 2) {
          notifs.push({ id: 'follow-more', icon: '👤', text: `+${newFollows.length - 2} more new followers this week`, time: newFollows[newFollows.length - 1].created_at })
        }
      }

      // Upvotes on own picks
      if (pickVotes && pickVotes.length > 0 && loadedPicks.length > 0) {
        const ownPickIds = new Set(loadedPicks.map(p => p.id))
        const upvotesOnOwn = pickVotes.filter(v => v.vote === 1 && ownPickIds.has(v.pick_id))
        if (upvotesOnOwn.length > 0) {
          const pickMap: Record<string, string> = {}
          for (const p of loadedPicks) pickMap[p.id] = p.match_name
          // Group by pick
          const byPick: Record<string, number> = {}
          for (const v of upvotesOnOwn) byPick[v.pick_id] = (byPick[v.pick_id] ?? 0) + 1
          for (const [pickId, count] of Object.entries(byPick).slice(0, 2)) {
            notifs.push({ id: `votes-${pickId}`, icon: '▲', text: `${count} upvote${count > 1 ? 's' : ''} on "${pickMap[pickId] ?? 'your pick'}"`, time: upvotesOnOwn[0].created_at })
          }
        }
      }

      // Comments on own picks
      if (commentsData && commentsData.length > 0 && loadedPicks.length > 0) {
        const ownPickIds = new Set(loadedPicks.map(p => p.id))
        const commentsOnOwn = commentsData.filter(c => ownPickIds.has(c.pick_id) && c.user_id !== user.id)
        if (commentsOnOwn.length > 0) {
          const commenterIds = [...new Set(commentsOnOwn.map(c => c.user_id))]
          const { data: commenterProfiles } = await supabase.from('profiles').select('id, username').in('id', commenterIds)
          const cpm: Record<string, string> = {}
          for (const p of commenterProfiles ?? []) cpm[p.id] = p.username
          const pickMap: Record<string, string> = {}
          for (const p of loadedPicks) pickMap[p.id] = p.match_name
          for (const c of commentsOnOwn.slice(0, 2)) {
            notifs.push({ id: `comment-${c.pick_id}-${c.user_id}`, icon: '💬', text: `@${cpm[c.user_id] ?? '...'} commented on "${pickMap[c.pick_id] ?? 'your pick'}"`, time: c.created_at })
          }
        }
      }

      notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setNotifications(notifs.slice(0, 5))
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Your record</div>
            {rank !== null && (
              <div style={{ padding: '3px 8px', background: 'rgba(192,160,96,0.1)', border: '1px solid rgba(192,160,96,0.3)', borderRadius: '6px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#C0A060', fontWeight: 500 }}>#{rank} ALL TIME</div>
            )}
          </div>
          <h1 style={{ fontSize: '32px', marginBottom: '4px' }}>@{profile?.username}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            {totalPicks === 0 ? 'No picks yet — post your first one.' : `${totalPicks} pick${totalPicks !== 1 ? 's' : ''} tracked`}
          </p>
        </div>

        {totalPicks === 0 && (
          <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(34,197,94,0.02) 100%)', border: '1px solid var(--green-border)', borderRadius: '16px', padding: '36px 32px', marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>👋</div>
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>Welcome to Sharpd</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px', maxWidth: '380px', margin: '0 auto 24px' }}>
              Build your verified sports prediction record. Every pick is timestamped and public — no edits, no deletes. Your reputation earns itself.
            </p>
            <Link href="/pick/new" className="btn-pill btn-primary" style={{ fontSize: '14px' }}>Post your first pick →</Link>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '32px' }}>
          {[
            { label: 'Total Picks', value: totalPicks.toString(), icon: '📊', topColor: 'var(--border)' },
            { label: 'Winrate', value: winrate === '—' ? '—' : `${winrate}%`, icon: '🏆', topColor: 'var(--border)' },
            { label: 'ROI', value: roi === '—' ? '—' : `${Number(roi) >= 0 ? '+' : ''}${roi}%`, icon: '📈', topColor: roi !== '—' ? (Number(roi) >= 0 ? '#22C55E' : '#F87171') : 'var(--border)' },
            { label: 'Units P/L', value: totalProfit === 0 && totalPicks === 0 ? '—' : `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}u`, icon: '💰', topColor: totalPicks > 0 ? (totalProfit > 0 ? '#22C55E' : totalProfit < 0 ? '#F87171' : 'var(--border)') : 'var(--border)' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', borderTop: `2px solid ${stat.topColor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                <span style={{ fontSize: '11px' }}>{stat.icon}</span>{stat.label}
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

        {/* Notifications */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 500, fontSize: '14px' }}>Recent Activity</span>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--dim)', marginLeft: '10px' }}>Last 7 days</span>
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--dim)', fontSize: '13px', fontFamily: 'var(--font-geist-mono)' }}>No recent activity</p>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0, width: '24px', textAlign: 'center' }}>{n.icon}</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)', flex: 1 }}>{n.text}</span>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', flexShrink: 0 }}>
                  {new Date(n.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, fontSize: '14px' }}>Pick History</span>
            <Link href="/pick/new" style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', textDecoration: 'none' }}>
              + New Pick
            </Link>
          </div>

          {picks.length === 0 ? (
            <div style={{ padding: '70px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>📋</div>
              <p style={{ fontWeight: 600, fontSize: '18px', marginBottom: '8px' }}>Your Record Starts Here</p>
              <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                Post your first pick and begin building your verified reputation
              </p>
              <Link href="/pick/new" className="btn-pill btn-primary">Post your first pick →</Link>
            </div>
          ) : (
            picks.map(pick => (
              <div key={pick.id} style={{ padding: '20px', borderBottom: '1px solid var(--border)', borderLeft: `4px solid ${pick.status === 'win' ? '#22C55E' : pick.status === 'loss' ? '#F87171' : 'transparent'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pick.match_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--dim)' }}>
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
