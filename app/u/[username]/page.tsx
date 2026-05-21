'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Nav } from '@/components/Nav'
import { Avatar } from '@/components/Avatar'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { calculateBadges, type Badge } from '@/lib/badges'

type Profile = { id: string; username: string; display_name: string; bio: string | null; created_at: string; avatar_url: string | null }
type Pick = { id: string; match_name: string; market: string; odds: number; units: number; status: string; created_at: string; competition: string | null; analysis: string | null; profit_loss: number | null; match_start: string }
type Comment = { id: string; pick_id: string; user_id: string; content: string; created_at: string; profiles: { username: string; avatar_url: string | null } | null }
type VoteValue = 1 | -1 | 0
type VoteState = { up: number; down: number; userVote: VoteValue }
type CommentVoteState = { up: number; userVote: 0 | 1 }

export default function PublicProfile() {
  const { username } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [pickVotes, setPickVotes] = useState<Record<string, VoteState>>({})
  const [commentVotes, setCommentVotes] = useState<Record<string, CommentVoteState>>({})
  const [badges, setBadges] = useState<Badge[]>([])
  const [rank, setRank] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const userId = authUser?.id ?? null
      setCurrentUserId(userId)

      const { data: profileData } = await supabase.from('profiles').select('*').eq('username', username).single()
      if (!profileData) { setNotFound(true); setLoading(false); return }

      const [
        { data: picksData },
        { count: followerCnt },
        { count: followingCnt },
      ] = await Promise.all([
        supabase.from('picks').select('*').eq('user_id', profileData.id).order('created_at', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id),
      ])

      setProfile(profileData)
      const loadedPicks = picksData || []
      setPicks(loadedPicks)
      setFollowerCount(followerCnt ?? 0)
      setFollowingCount(followingCnt ?? 0)

      setBadges(calculateBadges(loadedPicks))

      // Compute rank: fetch all picks for all users, compare ROI
      const { data: allPicks } = await supabase.from('picks').select('user_id, units, status, profit_loss')
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
        const myIdx = rois.findIndex(r => r.id === profileData.id)
        if (myIdx >= 0) setRank(myIdx + 1)
      }

      if (userId && userId !== profileData.id) {
        const { data: followRow } = await supabase
          .from('follows').select('id')
          .eq('follower_id', userId)
          .eq('following_id', profileData.id)
          .maybeSingle()
        setIsFollowing(!!followRow)
      }

      if (picksData && picksData.length > 0) {
        const pickIds = picksData.map((p: Pick) => p.id)

        const [{ data: commentsData }, { data: pickVotesData }] = await Promise.all([
          supabase.from('comments')
            .select('id, pick_id, user_id, content, created_at, profiles(username, avatar_url)')
            .in('pick_id', pickIds)
            .order('created_at', { ascending: true }),
          supabase.from('pick_votes')
            .select('pick_id, user_id, vote')
            .in('pick_id', pickIds),
        ])

        if (pickVotesData) {
          const vm: Record<string, VoteState> = {}
          for (const v of pickVotesData) {
            if (!vm[v.pick_id]) vm[v.pick_id] = { up: 0, down: 0, userVote: 0 }
            if (v.vote === 1) vm[v.pick_id].up++
            else if (v.vote === -1) vm[v.pick_id].down++
            if (userId && v.user_id === userId) vm[v.pick_id].userVote = v.vote as VoteValue
          }
          setPickVotes(vm)
        }

        if (commentsData) {
          const grouped: Record<string, Comment[]> = {}
          for (const c of commentsData) {
            if (!grouped[c.pick_id]) grouped[c.pick_id] = []
            grouped[c.pick_id].push(c as unknown as Comment)
          }
          setComments(grouped)

          const commentIds = commentsData.map(c => c.id)
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
                if (userId && v.user_id === userId) cvm[v.comment_id].userVote = 1
              }
              setCommentVotes(cvm)
            }
          }
        }
      }

      setLoading(false)
    }
    loadProfile()
  }, [username])

  const handleFollow = async () => {
    if (!currentUserId || !profile || followLoading) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', profile.id)
      setIsFollowing(false)
      setFollowerCount(c => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: profile.id })
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
    }
    setFollowLoading(false)
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
      setComments(prev => ({ ...prev, [pickId]: [...(prev[pickId] || []), newComment as unknown as Comment] }))
      setCommentInputs(prev => ({ ...prev, [pickId]: '' }))
    }
    setSubmitting(s => ({ ...s, [pickId]: false }))
  }

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

  const totalPicks = picks.length
  const settledPicks = picks.filter(p => p.status !== 'pending')
  const wins = picks.filter(p => p.status === 'win').length
  const winrate = settledPicks.length > 0 ? ((wins / settledPicks.length) * 100).toFixed(1) : '—'
  const totalUnitsStaked = picks.reduce((sum, p) => sum + p.units, 0)
  const totalProfit = picks.reduce((sum, p) => sum + (p.profit_loss || 0), 0)
  const roi = totalUnitsStaked > 0 ? ((totalProfit / totalUnitsStaked) * 100).toFixed(1) : '—'
  const avgOdds = totalPicks > 0 ? (picks.reduce((sum, p) => sum + p.odds, 0) / totalPicks).toFixed(2) : '—'

  const sortedSettled = [...settledPicks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  let currentStreak = 0
  for (const p of sortedSettled) {
    if (p.status === 'win') currentStreak++
    else break
  }
  let bestStreak = 0
  let tempStreak = 0
  for (const p of [...settledPicks].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    if (p.status === 'win') { tempStreak++; bestStreak = Math.max(bestStreak, tempStreak) }
    else tempStreak = 0
  }

  const chartData = [...picks]
    .filter(p => p.status !== 'pending' && p.profit_loss !== null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .reduce((acc: { pick: number; cumulative: number; date: string }[], pick, i) => {
      const prev = acc[i - 1]?.cumulative ?? 0
      return [...acc, { pick: i + 1, cumulative: parseFloat((prev + (pick.profit_loss || 0)).toFixed(2)), date: new Date(pick.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }]
    }, [])

  const handleShare = () => {
    const roiStr = roi === '—' ? 'New account' : `${Number(roi) >= 0 ? '+' : ''}${roi}% ROI`
    const wrStr = winrate === '—' ? '' : ` | ${winrate}% Winrate`
    const text = `🎯 @${profile?.username} on Sharpd\n\n${roiStr}${wrStr} | ${totalPicks} picks\n\nAll picks verified & timestamped before kickoff.\nNo edits. No deletes. No fake screenshots.\n\n🔗 sharpd.bet/u/${profile?.username}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out @${profile?.username}'s verified prediction record on Sharpd 🎯\n\nsharpd.bet/u/${profile?.username}`)}`

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', fontSize: '13px' }}>Loading...</p></div>

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '32px' }}>◈</div>
      <h1 style={{ fontSize: '22px' }}>Profile not found</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>This user doesn&apos;t exist on Sharpd.</p>
      <Link href="/" style={{ color: 'var(--green)', fontSize: '14px' }}>← Back to Sharpd</Link>
    </div>
  )

  const isOwnProfile = currentUserId === profile?.id
  const canFollow = !!currentUserId && !isOwnProfile

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '100px 24px 60px' }}>

        {/* Profile header */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
            <Avatar url={profile?.avatar_url} username={profile?.username || ''} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Verified Predictor</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '24px', margin: 0 }}>@{profile?.username}</h1>
                {canFollow && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    style={{ padding: '5px 16px', borderRadius: '999px', fontSize: '13px', fontFamily: 'var(--font-geist)', fontWeight: 500, cursor: followLoading ? 'default' : 'pointer', border: '1px solid', borderColor: isFollowing ? 'var(--border2)' : 'var(--green-border)', background: isFollowing ? 'var(--bg3)' : 'var(--green-bg)', color: isFollowing ? 'var(--muted)' : 'var(--green)', transition: 'all .15s', opacity: followLoading ? 0.6 : 1 }}
                  >
                    {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                )}
              </div>
              {profile?.bio && <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '8px' }}>{profile.bio}</p>}
              {badges.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {badges.map(b => (
                    <span key={b.id} title={b.description} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', border: '1px solid', borderColor: `${b.color}40`, background: `${b.color}15`, color: b.color, cursor: 'default' }}>
                      {b.emoji} {b.name}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--dim)', margin: 0 }}>
                  Member since {new Date(profile?.created_at || '').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{followerCount}</span> followers
                </span>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{followingCount}</span> following
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ padding: '6px 12px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: '8px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--green)', letterSpacing: '.05em', fontWeight: 500 }}>◈ PUBLIC RECORD</div>
              {rank !== null && (
                <div style={{ padding: '5px 10px', background: 'rgba(192,160,96,0.1)', border: '1px solid rgba(192,160,96,0.3)', borderRadius: '8px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#C0A060', letterSpacing: '.05em', fontWeight: 500 }}>#{rank} ALL TIME</div>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={handleShare} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-geist-mono)', cursor: 'pointer', border: '1px solid var(--border2)', background: copied ? 'var(--green-bg)' : 'var(--bg3)', color: copied ? 'var(--green)' : 'var(--muted)', transition: 'all .2s' }}>
                  {copied ? '✓ Copied!' : '⎘ Copy'}
                </button>
                <a href={tweetUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-geist-mono)', cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  𝕏 Tweet
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
          {[
            { label: 'Picks', value: totalPicks.toString() },
            { label: 'Winrate', value: winrate === '—' ? '—' : `${winrate}%` },
            { label: 'ROI', value: roi === '—' ? '—' : `${Number(roi) >= 0 ? '+' : ''}${roi}%` },
            { label: 'Units P/L', value: totalProfit === 0 && totalPicks === 0 ? '—' : `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}u` },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{stat.label}</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '18px', fontWeight: 500, color: stat.label === 'ROI' || stat.label === 'Units P/L' ? (stat.value.startsWith('+') ? 'var(--green)' : stat.value.startsWith('-') ? 'var(--red)' : 'var(--text)') : 'var(--text)' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: 'Avg Odds', value: avgOdds },
            { label: 'Win Streak', value: settledPicks.length > 0 ? `${currentStreak}W` : '—' },
            { label: 'Best Streak', value: bestStreak > 0 ? `${bestStreak}W` : '—' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{stat.label}</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '18px', fontWeight: 500, color: stat.label === 'Win Streak' && currentStreak >= 3 ? 'var(--green)' : 'var(--text)' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        {chartData.length >= 2 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontWeight: 500, fontSize: '14px' }}>Profit Graph</span>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--dim)' }}>Units P/L over time</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                <XAxis dataKey="pick" tick={{ fontFamily: 'monospace', fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontFamily: 'monospace', fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} tickFormatter={v => `${v > 0 ? '+' : ''}${v}u`} />
                <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px' }} formatter={(value: any) => [`${value > 0 ? '+' : ''}${value}u`, 'P/L']} labelFormatter={(label: any) => `Pick #${label} · ${chartData[label - 1]?.date || ''}`} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="cumulative" stroke="#22C55E" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#22C55E', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Picks */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, fontSize: '14px' }}>Pick History</span>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--dim)' }}>Every pick is public · No edits · No deletes</span>
          </div>

          {picks.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}><p style={{ color: 'var(--muted)', fontSize: '14px' }}>No picks posted yet.</p></div>
          ) : (
            picks.map(pick => {
              const pickComments = comments[pick.id] || []
              const showCommentSection = pickComments.length > 0 || !!currentUserId
              const pv = pickVotes[pick.id]
              const net = (pv?.up ?? 0) - (pv?.down ?? 0)
              return (
                <div key={pick.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '3px' }}>{pick.match_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: pick.analysis ? '8px' : '0' }}>
                          {pick.market} · @{pick.odds} · {pick.units}u{pick.competition ? ` · ${pick.competition}` : ''}
                        </div>
                        {pick.analysis && <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.55', padding: '8px 12px', background: 'var(--bg3)', borderRadius: '8px', borderLeft: '2px solid var(--green-border)' }}>{pick.analysis}</div>}
                        {/* Vote buttons */}
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
                        <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', padding: '3px 10px', borderRadius: '4px', fontWeight: 500, marginBottom: '4px', display: 'inline-block', background: pick.status === 'win' ? 'rgba(34,197,94,0.1)' : pick.status === 'loss' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)', color: pick.status === 'win' ? 'var(--green)' : pick.status === 'loss' ? 'var(--red)' : 'var(--muted)', border: `1px solid ${pick.status === 'win' ? 'rgba(34,197,94,0.25)' : pick.status === 'loss' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}` }}>
                          {pick.status.toUpperCase()}
                        </div>
                        {pick.profit_loss !== null && <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: pick.profit_loss >= 0 ? 'var(--green)' : 'var(--red)' }}>{pick.profit_loss >= 0 ? '+' : ''}{pick.profit_loss.toFixed(2)}u</div>}
                        <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', marginTop: '4px' }}>{new Date(pick.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                      </div>
                    </div>
                  </div>

                  {/* Comments */}
                  {showCommentSection && (
                    <div style={{ padding: '0 20px 14px', borderTop: '1px solid var(--border)' }}>
                      {pickComments.length > 0 && (
                        <div style={{ paddingTop: '12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {pickComments.map(comment => {
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
                      {currentUserId && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingTop: pickComments.length > 0 ? '0' : '12px' }}>
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
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* CTA */}
        <div style={{ marginTop: '24px', padding: '24px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Build your own verified prediction record on Sharpd.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Link href="/signup" className="btn-pill btn-primary">Create free account</Link>
            <Link href="/" style={{ padding: '9px 20px', borderRadius: '999px', fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center' }}>Learn more</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
