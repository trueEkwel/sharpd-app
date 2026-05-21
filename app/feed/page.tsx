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
type TrendingPick = FeedPick & { upvotes: number }
type HotPredictor = { username: string; avatar_url: string | null; roi: number; settledPicks: number }

type DiscussionComment = {
  id: string
  pick_id: string
  user_id: string
  content: string
  created_at: string
  commenter_username: string
  commenter_avatar: string | null
  pick_match_name: string
  pick_market: string
  pick_odds: number
  pick_owner_username: string
}

export default function Feed() {
  const router = useRouter()
  const [feedTab, setFeedTab] = useState<'picks' | 'discussion'>('picks')
  const [picks, setPicks] = useState<FeedPick[]>([])
  const [discussions, setDiscussions] = useState<DiscussionComment[]>([])
  const [loading, setLoading] = useState(true)
  const [hasFollows, setHasFollows] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pickVotes, setPickVotes] = useState<Record<string, VoteState>>({})
  const [discVotes, setDiscVotes] = useState<Record<string, { up: number; userVote: 0 | 1 }>>({})
  const [trendingPicks, setTrendingPicks] = useState<TrendingPick[]>([])
  const [hotPredictors, setHotPredictors] = useState<HotPredictor[]>([])
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const now = new Date()
      const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const d7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { data: follows },
        { data: recentPicks },
        { data: weekPicks },
      ] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('picks').select('id, match_name, market, odds, units, status, created_at, competition, analysis, profit_loss, user_id').gte('created_at', h24ago).order('created_at', { ascending: false }).limit(50),
        supabase.from('picks').select('user_id, units, status, profit_loss').gte('created_at', d7ago),
      ])

      // Trending picks (last 24h, most upvoted)
      if (recentPicks && recentPicks.length > 0) {
        const recentIds = recentPicks.map(p => p.id)
        const { data: recentVotes } = await supabase.from('pick_votes').select('pick_id, vote').in('pick_id', recentIds)
        const upMap: Record<string, number> = {}
        for (const v of recentVotes ?? []) {
          if (v.vote === 1) upMap[v.pick_id] = (upMap[v.pick_id] ?? 0) + 1
        }
        const top3ids = recentPicks
          .map(p => ({ ...p, upvotes: upMap[p.id] ?? 0 }))
          .filter(p => (upMap[p.id] ?? 0) > 0)
          .sort((a, b) => b.upvotes - a.upvotes)
          .slice(0, 3)
        if (top3ids.length > 0) {
          const authorIds = [...new Set(top3ids.map(p => p.user_id))]
          const { data: trendProfiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', authorIds)
          const tpm: Record<string, { username: string; avatar_url: string | null }> = {}
          for (const p of trendProfiles ?? []) tpm[p.id] = { username: p.username, avatar_url: p.avatar_url }
          setTrendingPicks(top3ids.map(p => ({ ...p, username: tpm[p.user_id]?.username ?? '', avatar_url: tpm[p.user_id]?.avatar_url ?? null })))
        }
      }

      // Hot predictors (last 7 days, top ROI, min 3 settled)
      if (weekPicks && weekPicks.length > 0) {
        const wpMap: Record<string, { staked: number; profit: number; settled: number }> = {}
        for (const p of weekPicks) {
          if (p.status === 'pending') continue
          if (!wpMap[p.user_id]) wpMap[p.user_id] = { staked: 0, profit: 0, settled: 0 }
          wpMap[p.user_id].staked += p.units
          wpMap[p.user_id].profit += p.profit_loss ?? 0
          wpMap[p.user_id].settled += 1
        }
        const top3hot = Object.entries(wpMap)
          .filter(([, v]) => v.settled >= 3 && v.staked > 0)
          .map(([id, v]) => ({ id, roi: (v.profit / v.staked) * 100, settledPicks: v.settled }))
          .sort((a, b) => b.roi - a.roi)
          .slice(0, 3)
        if (top3hot.length > 0) {
          const hotIds = top3hot.map(e => e.id)
          const { data: hotProfiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', hotIds)
          const hpm: Record<string, { username: string; avatar_url: string | null }> = {}
          for (const p of hotProfiles ?? []) hpm[p.id] = { username: p.username, avatar_url: p.avatar_url }
          setHotPredictors(top3hot.map(e => ({ username: hpm[e.id]?.username ?? '', avatar_url: hpm[e.id]?.avatar_url ?? null, roi: e.roi, settledPicks: e.settledPicks })))
        }
      }

      if (!follows || follows.length === 0) {
        setHasFollows(false)
        setLoading(false)
        return
      }

      setHasFollows(true)
      const followingIds = follows.map((f: { following_id: string }) => f.following_id)

      // Load picks + profiles + discussion comments in parallel
      const [{ data: rawPicks }, { data: profilesData }, { data: rawDiscComments }] = await Promise.all([
        supabase.from('picks')
          .select('id, match_name, market, odds, units, status, created_at, competition, analysis, profit_loss, user_id')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('profiles').select('id, username, avatar_url').in('id', followingIds),
        supabase.from('comments')
          .select('id, pick_id, user_id, content, created_at, profiles(username, avatar_url)')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      // Merge picks with profiles
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

      // Pick votes
      if (rawPicks && rawPicks.length > 0) {
        const pickIds = rawPicks.map(p => p.id)
        const { data: votesData } = await supabase.from('pick_votes').select('pick_id, user_id, vote').in('pick_id', pickIds)
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

      // Build discussion comments
      if (rawDiscComments && rawDiscComments.length > 0) {
        const discPickIds = [...new Set(rawDiscComments.map((c: { pick_id: string }) => c.pick_id))]
        const { data: discPicks } = await supabase.from('picks').select('id, match_name, market, odds, user_id').in('id', discPickIds)

        const pickRefMap: Record<string, { match_name: string; market: string; odds: number; owner_user_id: string }> = {}
        for (const p of discPicks ?? []) {
          pickRefMap[p.id] = { match_name: p.match_name, market: p.market, odds: p.odds, owner_user_id: p.user_id }
        }

        const ownerIds = [...new Set(Object.values(pickRefMap).map(p => p.owner_user_id))]
        const { data: ownerProfs } = ownerIds.length > 0
          ? await supabase.from('profiles').select('id, username').in('id', ownerIds)
          : { data: [] }
        const ownerMap: Record<string, string> = {}
        for (const p of ownerProfs ?? []) ownerMap[p.id] = p.username

        type RawComment = { id: string; pick_id: string; user_id: string; content: string; created_at: string; profiles: { username: string; avatar_url: string | null } | null }
        const discMerged: DiscussionComment[] = (rawDiscComments as unknown as RawComment[]).map(c => ({
          id: c.id,
          pick_id: c.pick_id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          commenter_username: c.profiles?.username ?? '',
          commenter_avatar: c.profiles?.avatar_url ?? null,
          pick_match_name: pickRefMap[c.pick_id]?.match_name ?? '',
          pick_market: pickRefMap[c.pick_id]?.market ?? '',
          pick_odds: pickRefMap[c.pick_id]?.odds ?? 0,
          pick_owner_username: ownerMap[pickRefMap[c.pick_id]?.owner_user_id ?? ''] ?? '',
        }))
        setDiscussions(discMerged)

        // Comment votes
        const commentIds = rawDiscComments.map((c: { id: string }) => c.id)
        const { data: cvData } = await supabase.from('comment_votes').select('comment_id, user_id, vote').in('comment_id', commentIds)
        if (cvData) {
          const cvm: Record<string, { up: number; userVote: 0 | 1 }> = {}
          for (const v of cvData) {
            if (!cvm[v.comment_id]) cvm[v.comment_id] = { up: 0, userVote: 0 }
            if (v.vote === 1) cvm[v.comment_id].up++
            if (v.user_id === user.id) cvm[v.comment_id].userVote = 1
          }
          setDiscVotes(cvm)
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

  const handleDiscVote = async (commentId: string) => {
    if (!currentUserId) return
    const cur = discVotes[commentId] ?? { up: 0, userVote: 0 as 0 | 1 }
    if (cur.userVote === 1) {
      setDiscVotes(prev => ({ ...prev, [commentId]: { up: cur.up - 1, userVote: 0 } }))
      await supabase.from('comment_votes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
    } else {
      setDiscVotes(prev => ({ ...prev, [commentId]: { up: cur.up + 1, userVote: 1 } }))
      await supabase.from('comment_votes').insert({ comment_id: commentId, user_id: currentUserId, vote: 1 })
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your Network</div>
          <h1 style={{ fontSize: '36px', marginBottom: '8px' }}>Feed</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Latest activity from predictors you follow.</p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
          {(['picks', 'discussion'] as const).map(t => (
            <button key={t} onClick={() => setFeedTab(t)} style={{
              padding: '6px 18px', borderRadius: '8px', fontSize: '13px',
              fontFamily: 'var(--font-geist-mono)', fontWeight: 500, cursor: 'pointer', border: '1px solid',
              background: feedTab === t ? 'var(--green-bg)' : 'transparent',
              color: feedTab === t ? 'var(--green)' : 'var(--muted)',
              borderColor: feedTab === t ? 'var(--green-border)' : 'var(--border)', transition: 'all .15s',
            }}>
              {t === 'picks' ? 'Picks' : 'Discussion'}
            </button>
          ))}
        </div>

        {/* Trending section (Picks tab only) */}
        {feedTab === 'picks' && !loading && (trendingPicks.length > 0 || hotPredictors.length > 0) && (
          <div style={{ marginBottom: '32px' }}>
            {trendingPicks.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>🔥 Trending · Last 24h</div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {trendingPicks.map(pick => (
                    <Link key={pick.id} href={`/u/${pick.username}`} style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0, minWidth: '220px', maxWidth: '260px' }}>
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <Avatar url={pick.avatar_url} username={pick.username} size={20} />
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)' }}>@{pick.username}</span>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', marginLeft: 'auto' }}>▲ {pick.upvotes}</span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick.match_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{pick.market} · @{pick.odds}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {hotPredictors.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>⚡ Hot Predictors · 7-Day ROI</div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {hotPredictors.map(p => (
                    <Link key={p.username} href={`/u/${p.username}`} style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0, minWidth: '160px' }}>
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar url={p.avatar_url} username={p.username} size={28} />
                        <div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--text)', marginBottom: '2px' }}>@{p.username}</div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', fontWeight: 500, color: p.roi >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}% ROI
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', fontSize: '13px' }}>Loading...</p>
          </div>
        ) : !hasFollows ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>◈</div>
            <p style={{ fontWeight: 600, marginBottom: '8px', fontSize: '16px' }}>Your feed is empty</p>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
              Follow some predictors to see their picks here
            </p>
            <Link href="/leaderboard" className="btn-pill btn-primary">Browse leaderboard</Link>
          </div>
        ) : feedTab === 'picks' ? (
          picks.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
              <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>No picks yet</p>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No picks from followed predictors yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {picks.map(pick => {
                const pv = pickVotes[pick.id]
                const net = (pv?.up ?? 0) - (pv?.down ?? 0)
                return (
                  <div key={pick.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.2), transparent)' }} />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <button onClick={() => handlePickVote(pick.id, 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', cursor: 'pointer', border: '1px solid', borderColor: pv?.userVote === 1 ? 'var(--green-border)' : 'var(--border)', background: pv?.userVote === 1 ? 'var(--green-bg)' : 'transparent', color: pv?.userVote === 1 ? 'var(--green)' : 'var(--dim)', transition: 'all .15s' }}>▲ {pv?.up ?? 0}</button>
                          <button onClick={() => handlePickVote(pick.id, -1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', cursor: 'pointer', border: '1px solid', borderColor: pv?.userVote === -1 ? 'rgba(248,113,113,0.25)' : 'var(--border)', background: pv?.userVote === -1 ? 'rgba(248,113,113,0.1)' : 'transparent', color: pv?.userVote === -1 ? 'var(--red)' : 'var(--dim)', transition: 'all .15s' }}>▼ {pv?.down ?? 0}</button>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--dim)' }}>{net > 0 ? `+${net}` : net}</span>
                        </div>
                      </div>
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
          )
        ) : (
          /* Discussion tab */
          discussions.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
              <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>No discussion yet</p>
              <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
                No discussion from people you follow yet
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {discussions.map(comment => {
                const cv = discVotes[comment.id]
                return (
                  <div key={comment.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    {/* Author header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <Avatar url={comment.commenter_avatar} username={comment.commenter_username} size={32} />
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link href={`/u/${comment.commenter_username}`} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--green)', textDecoration: 'none', fontWeight: 500 }}>
                          @{comment.commenter_username}
                        </Link>
                        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)' }}>
                          {new Date(comment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDiscVote(comment.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-geist-mono)', cursor: currentUserId ? 'pointer' : 'default', border: '1px solid', borderColor: cv?.userVote === 1 ? 'var(--green-border)' : 'var(--border)', background: cv?.userVote === 1 ? 'var(--green-bg)' : 'transparent', color: cv?.userVote === 1 ? 'var(--green)' : 'var(--dim)', transition: 'all .15s', flexShrink: 0 }}
                      >▲ {cv?.up ?? 0}</button>
                    </div>

                    {/* Comment text */}
                    <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.6', margin: '0 0 12px 0' }}>
                      {comment.content}
                    </p>

                    {/* Pick reference */}
                    {comment.pick_match_name && (
                      <Link href={`/u/${comment.pick_owner_username}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px' }}>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>
                            On pick by @{comment.pick_owner_username}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '2px' }}>{comment.pick_match_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{comment.pick_market} · @{comment.pick_odds}</div>
                        </div>
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
