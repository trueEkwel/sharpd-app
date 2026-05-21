'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Avatar } from '@/components/Avatar'

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

type VoteValue = 1 | -1 | 0
type VoteState = { up: number; down: number; userVote: VoteValue }
type Comment = { id: string; pick_id: string; user_id: string; content: string; created_at: string; profiles: { username: string; avatar_url: string | null } | null }
type CommentVoteState = { up: number; userVote: 0 | 1 }

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pickVotesState, setPickVotesState] = useState<Record<string, VoteState>>({})
  const [pickComments, setPickComments] = useState<Record<string, Comment[]>>({})
  const [commentVotes, setCommentVotes] = useState<Record<string, CommentVoteState>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { data: profileData },
        { data: picksData },
        { data: newFollows },
        { data: notifVotes },
        { data: notifComments },
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

      if (notifVotes && notifVotes.length > 0 && loadedPicks.length > 0) {
        const ownPickIds = new Set(loadedPicks.map(p => p.id))
        const upvotesOnOwn = notifVotes.filter(v => v.vote === 1 && ownPickIds.has(v.pick_id))
        if (upvotesOnOwn.length > 0) {
          const pickMap: Record<string, string> = {}
          for (const p of loadedPicks) pickMap[p.id] = p.match_name
          const byPick: Record<string, number> = {}
          for (const v of upvotesOnOwn) byPick[v.pick_id] = (byPick[v.pick_id] ?? 0) + 1
          for (const [pickId, count] of Object.entries(byPick).slice(0, 2)) {
            notifs.push({ id: `votes-${pickId}`, icon: '▲', text: `${count} upvote${count > 1 ? 's' : ''} on "${pickMap[pickId] ?? 'your pick'}"`, time: upvotesOnOwn[0].created_at })
          }
        }
      }

      if (notifComments && notifComments.length > 0 && loadedPicks.length > 0) {
        const ownPickIds = new Set(loadedPicks.map(p => p.id))
        const commentsOnOwn = notifComments.filter(c => ownPickIds.has(c.pick_id) && c.user_id !== user.id)
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

      // Load votes and full comments for pick history
      if (loadedPicks.length > 0) {
        const pickIds = loadedPicks.map(p => p.id)
        const [{ data: allPickVotesData }, { data: allCommentsData }] = await Promise.all([
          supabase.from('pick_votes').select('pick_id, user_id, vote').in('pick_id', pickIds),
          supabase.from('comments')
            .select('id, pick_id, user_id, content, created_at, profiles(username, avatar_url)')
            .in('pick_id', pickIds)
            .order('created_at', { ascending: true }),
        ])

        if (allPickVotesData) {
          const vm: Record<string, VoteState> = {}
          for (const v of allPickVotesData) {
            if (!vm[v.pick_id]) vm[v.pick_id] = { up: 0, down: 0, userVote: 0 }
            if (v.vote === 1) vm[v.pick_id].up++
            else if (v.vote === -1) vm[v.pick_id].down++
            if (v.user_id === user.id) vm[v.pick_id].userVote = v.vote as VoteValue
          }
          setPickVotesState(vm)
        }

        if (allCommentsData) {
          const grouped: Record<string, Comment[]> = {}
          for (const c of allCommentsData) {
            if (!grouped[c.pick_id]) grouped[c.pick_id] = []
            grouped[c.pick_id].push(c as unknown as Comment)
          }
          setPickComments(grouped)

          const commentIds = allCommentsData.map(c => c.id)
          if (commentIds.length > 0) {
            const { data: cvData } = await supabase
              .from('comment_votes')
              .select('comment_id, user_id, vote')
              .in('comment_id', commentIds)
            if (cvData) {
              const cvm: Record<string, CommentVoteState> = {}
              for (const v of cvData) {
                if (!cvm[v.comment_id]) cvm[v.comment_id] = { up: 0, userVote: 0 }
                if (v.vote === 1) cvm[v.comment_id].up++
                if (v.user_id === user.id) cvm[v.comment_id].userVote = 1
              }
              setCommentVotes(cvm)
            }
          }
        }
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handlePickVote = async (pickId: string, dir: 1 | -1) => {
    if (!currentUserId) return
    const cur = pickVotesState[pickId] ?? { up: 0, down: 0, userVote: 0 as VoteValue }
    if (cur.userVote === dir) {
      setPickVotesState(prev => ({ ...prev, [pickId]: { up: dir === 1 ? cur.up - 1 : cur.up, down: dir === -1 ? cur.down - 1 : cur.down, userVote: 0 } }))
      await supabase.from('pick_votes').delete().eq('pick_id', pickId).eq('user_id', currentUserId)
    } else {
      setPickVotesState(prev => ({ ...prev, [pickId]: { up: dir === 1 ? cur.up + 1 : cur.userVote === 1 ? cur.up - 1 : cur.up, down: dir === -1 ? cur.down + 1 : cur.userVote === -1 ? cur.down - 1 : cur.down, userVote: dir } }))
      if (cur.userVote === 0) {
        await supabase.from('pick_votes').insert({ pick_id: pickId, user_id: currentUserId, vote: dir })
      } else {
        await supabase.from('pick_votes').update({ vote: dir }).eq('pick_id', pickId).eq('user_id', currentUserId)
      }
    }
  }

  const handleCommentVote = async (commentId: string) => {
    if (!currentUserId) return
    const cur = commentVotes[commentId] ?? { up: 0, userVote: 0 as 0 | 1 }
    if (cur.userVote === 1) {
      setCommentVotes(prev => ({ ...prev, [commentId]: { up: cur.up - 1, userVote: 0 } }))
      await supabase.from('comment_votes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
    } else {
      setCommentVotes(prev => ({ ...prev, [commentId]: { up: cur.up + 1, userVote: 1 } }))
      await supabase.from('comment_votes').insert({ comment_id: commentId, user_id: currentUserId, vote: 1 })
    }
  }

  const handleComment = async (pickId: string) => {
    if (!currentUserId) return
    const content = (commentInputs[pickId] || '').trim()
    if (!content) return
    setSubmitting(s => ({ ...s, [pickId]: true }))
    const { data: newComment } = await supabase
      .from('comments')
      .insert({ pick_id: pickId, user_id: currentUserId, content })
      .select('id, pick_id, user_id, content, created_at, profiles(username, avatar_url)')
      .single()
    if (newComment) {
      setPickComments(prev => ({ ...prev, [pickId]: [...(prev[pickId] || []), newComment as unknown as Comment] }))
      setCommentInputs(prev => ({ ...prev, [pickId]: '' }))
    }
    setSubmitting(s => ({ ...s, [pickId]: false }))
  }

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

        {/* Pick History */}
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
            picks.map(pick => {
              const commentList = pickComments[pick.id] || []
              const showCommentSection = commentList.length > 0 || !!currentUserId
              const pv = pickVotesState[pick.id]
              const net = (pv?.up ?? 0) - (pv?.down ?? 0)
              return (
                <div key={pick.id} style={{ borderBottom: '1px solid var(--border)', borderLeft: `4px solid ${pick.status === 'win' ? '#22C55E' : pick.status === 'loss' ? '#F87171' : 'transparent'}` }}>
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pick.match_name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--dim)' }}>
                          {pick.market} · {pick.odds} · {pick.units}u
                          {pick.competition ? ` · ${pick.competition}` : ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <button
                            onClick={() => handlePickVote(pick.id, 1)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', cursor: currentUserId ? 'pointer' : 'default', border: '1px solid', borderColor: pv?.userVote === 1 ? 'var(--green-border)' : 'var(--border)', background: pv?.userVote === 1 ? 'var(--green-bg)' : 'transparent', color: pv?.userVote === 1 ? 'var(--green)' : 'var(--dim)', transition: 'all .15s' }}
                          >▲ {pv?.up ?? 0}</button>
                          <button
                            onClick={() => handlePickVote(pick.id, -1)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', cursor: currentUserId ? 'pointer' : 'default', border: '1px solid', borderColor: pv?.userVote === -1 ? 'rgba(248,113,113,0.25)' : 'var(--border)', background: pv?.userVote === -1 ? 'rgba(248,113,113,0.1)' : 'transparent', color: pv?.userVote === -1 ? 'var(--red)' : 'var(--dim)', transition: 'all .15s' }}
                          >▼ {pv?.down ?? 0}</button>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--dim)' }}>{net > 0 ? `+${net}` : net}</span>
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

                  {/* Comments */}
                  {showCommentSection && (
                    <div style={{ padding: '0 20px 14px', borderTop: '1px solid var(--border)' }}>
                      {commentList.length > 0 && (
                        <div style={{ paddingTop: '12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {commentList.map(comment => {
                            const cv = commentVotes[comment.id]
                            return (
                              <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <Avatar url={comment.profiles?.avatar_url} username={comment.profiles?.username || ''} size={32} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <Link href={`/u/${comment.profiles?.username}`} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>
                                      @{comment.profiles?.username}
                                    </Link>
                                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)' }}>
                                      {new Date(comment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5', margin: 0 }}>{comment.content}</p>
                                </div>
                                <button
                                  onClick={() => handleCommentVote(comment.id)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 7px', borderRadius: '6px', fontSize: '10px', fontFamily: 'var(--font-geist-mono)', cursor: currentUserId ? 'pointer' : 'default', border: '1px solid', borderColor: cv?.userVote === 1 ? 'var(--green-border)' : 'var(--border)', background: cv?.userVote === 1 ? 'var(--green-bg)' : 'transparent', color: cv?.userVote === 1 ? 'var(--green)' : 'var(--dim)', transition: 'all .15s', flexShrink: 0 }}
                                >▲ {cv?.up ?? 0}</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingTop: commentList.length > 0 ? '0' : '12px' }}>
                        <textarea
                          value={commentInputs[pick.id] || ''}
                          onChange={e => setCommentInputs(prev => ({ ...prev, [pick.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(pick.id) } }}
                          placeholder="Add a comment..."
                          maxLength={280}
                          rows={1}
                          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font-geist)', resize: 'none', outline: 'none', lineHeight: '1.4', transition: 'border-color .15s' }}
                          onFocus={e => { e.target.style.borderColor = 'var(--border2)' }}
                          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                        />
                        <button
                          onClick={() => handleComment(pick.id)}
                          disabled={submitting[pick.id] || !(commentInputs[pick.id] || '').trim()}
                          style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-geist)', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--green-border)', background: 'var(--green-bg)', color: 'var(--green)', transition: 'all .15s', opacity: (submitting[pick.id] || !(commentInputs[pick.id] || '').trim()) ? 0.5 : 1 }}
                        >
                          {submitting[pick.id] ? '...' : 'Post'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
