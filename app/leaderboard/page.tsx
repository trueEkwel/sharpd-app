'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Avatar } from '@/components/Avatar'
import { calculateBadges, type Badge } from '@/lib/badges'

type RawPick = {
  user_id: string
  odds: number
  units: number
  status: string
  profit_loss: number | null
  created_at: string
}

type TabEntry = {
  username: string
  avatar_url: string | null
  totalPicks: number
  settledPicks: number
  wins: number
  winrate: number
  roi: number
  totalProfit: number
  avgOdds: number
  currentStreak: number
  last10Roi: number
  followerCount: number
  badges: Badge[]
}

type Tab = 'alltime' | 'week' | 'month' | 'streak' | 'last10' | 'followed'

const MIN_ALL = 5
const MIN_WEEK = 3
const MIN_MONTH = 5
const MIN_STREAK = 3
const MIN_LAST10 = 10

const RANK_COLORS = ['#C0A060', '#9090A0', '#A06040']

function calcEntry(username: string, avatar_url: string | null, userPicks: RawPick[], followerCount: number): TabEntry {
  const settled = userPicks.filter(p => p.status !== 'pending')
  const wins = settled.filter(p => p.status === 'win').length
  const totalStaked = settled.reduce((s, p) => s + p.units, 0)
  const totalProfit = settled.reduce((s, p) => s + (p.profit_loss ?? 0), 0)
  const avgOdds = userPicks.length > 0 ? userPicks.reduce((s, p) => s + p.odds, 0) / userPicks.length : 0

  let streak = 0
  const byDate = [...settled].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  for (const p of byDate) {
    if (p.status === 'win') streak++
    else break
  }

  const last10 = byDate.slice(0, 10)
  const l10staked = last10.reduce((s, p) => s + p.units, 0)
  const l10profit = last10.reduce((s, p) => s + (p.profit_loss ?? 0), 0)
  const last10Roi = l10staked > 0 ? (l10profit / l10staked) * 100 : 0

  return {
    username, avatar_url,
    totalPicks: userPicks.length, settledPicks: settled.length, wins,
    winrate: settled.length > 0 ? (wins / settled.length) * 100 : 0,
    roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
    totalProfit, avgOdds, currentStreak: streak, last10Roi, followerCount,
    badges: calculateBadges(userPicks),
  }
}

export default function Leaderboard() {
  const [allEntries, setAllEntries] = useState<TabEntry[]>([])
  const [weekEntries, setWeekEntries] = useState<TabEntry[]>([])
  const [monthEntries, setMonthEntries] = useState<TabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('alltime')
  const [filter, setFilter] = useState<'roi' | 'profit' | 'winrate'>('roi')
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const [{ data: profiles }, { data: picks }, { data: follows }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url'),
        supabase.from('picks').select('user_id, odds, units, status, profit_loss, created_at'),
        supabase.from('follows').select('following_id'),
      ])
      if (!profiles || !picks) { setLoading(false); return }

      const followerMap: Record<string, number> = {}
      for (const f of follows ?? []) {
        followerMap[f.following_id] = (followerMap[f.following_id] ?? 0) + 1
      }

      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      setAllEntries(profiles.map(p => calcEntry(p.username, p.avatar_url ?? null, picks.filter(pk => pk.user_id === p.id), followerMap[p.id] ?? 0)))
      setWeekEntries(profiles.map(p => calcEntry(p.username, p.avatar_url ?? null, picks.filter(pk => pk.user_id === p.id && new Date(pk.created_at) >= weekAgo), followerMap[p.id] ?? 0)))
      setMonthEntries(profiles.map(p => calcEntry(p.username, p.avatar_url ?? null, picks.filter(pk => pk.user_id === p.id && new Date(pk.created_at) >= monthStart), followerMap[p.id] ?? 0)))
      setLoading(false)
    }
    load()
  }, [])

  function getRows(): TabEntry[] {
    if (tab === 'alltime') return [...allEntries].filter(e => e.settledPicks >= MIN_ALL).sort((a, b) => filter === 'roi' ? b.roi - a.roi : filter === 'profit' ? b.totalProfit - a.totalProfit : b.winrate - a.winrate)
    if (tab === 'week') return [...weekEntries].filter(e => e.settledPicks >= MIN_WEEK).sort((a, b) => b.roi - a.roi)
    if (tab === 'month') return [...monthEntries].filter(e => e.settledPicks >= MIN_MONTH).sort((a, b) => b.roi - a.roi)
    if (tab === 'streak') return [...allEntries].filter(e => e.currentStreak >= MIN_STREAK).sort((a, b) => b.currentStreak - a.currentStreak)
    if (tab === 'last10') return [...allEntries].filter(e => e.settledPicks >= MIN_LAST10).sort((a, b) => b.last10Roi - a.last10Roi)
    if (tab === 'followed') return [...allEntries].filter(e => e.followerCount > 0).sort((a, b) => b.followerCount - a.followerCount)
    return []
  }

  const rows = getRows()
  const maxRoi = rows.length > 0 ? Math.max(...rows.map(e => e.roi), 0.1) : 1

  const tabs: { id: Tab; label: string }[] = [
    { id: 'alltime', label: 'All Time' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'streak', label: 'Hot Streak' },
    { id: 'last10', label: 'Best Last 10' },
    { id: 'followed', label: 'Most Followed' },
  ]

  const minLabel = tab === 'alltime' ? `Min. ${MIN_ALL} settled picks` : tab === 'week' ? `Min. ${MIN_WEEK} settled this week` : tab === 'month' ? `Min. ${MIN_MONTH} settled this month` : tab === 'streak' ? `Min. ${MIN_STREAK}-win streak` : tab === 'last10' ? `Min. ${MIN_LAST10} settled picks` : 'Ranked by followers'

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--green)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Global Rankings</div>
          <h1 style={{ fontSize: '36px', marginBottom: '8px' }}>Leaderboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Ranked by verified performance. Every stat is calculated from public, timestamped picks only.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px',
              fontFamily: 'var(--font-geist-mono)', fontWeight: 500, cursor: 'pointer', border: '1px solid',
              background: tab === t.id ? 'var(--green-bg)' : 'transparent',
              color: tab === t.id ? 'var(--green)' : 'var(--muted)',
              borderColor: tab === t.id ? 'var(--green-border)' : 'var(--border)', transition: 'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sub-filter (All Time only) */}
        {tab === 'alltime' && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
            {(['roi', 'profit', 'winrate'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '11px',
                fontFamily: 'var(--font-geist-mono)', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                background: filter === f ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: filter === f ? 'var(--text)' : 'var(--dim)',
                borderColor: filter === f ? 'var(--border2)' : 'var(--border)', transition: 'all .15s',
              }}>
                {f === 'roi' ? 'ROI %' : f === 'profit' ? 'Units P/L' : 'Winrate'}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', fontSize: '13px' }}>Loading rankings...</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>◈</div>
            <p style={{ fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>No Predictors Ranked Yet</p>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', lineHeight: '1.6' }}>
              Be the first to post 5 picks and claim the #1 spot
            </p>
            <Link href="/signup" className="btn-pill btn-primary">Start tracking</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rows.map((entry, i) => {
              const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--dim)'
              const borderLeft = i < 3 ? `4px solid ${RANK_COLORS[i]}` : '4px solid var(--border)'
              const barWidth = maxRoi > 0 ? Math.max(0, Math.min(100, (entry.roi / maxRoi) * 100)) : 0
              const bgDefault = i === 0 ? 'rgba(192,160,96,0.04)' : 'var(--bg2)'
              return (
                <Link key={entry.username} href={`/u/${entry.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div
                    style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '20px 22px 20px 18px', borderRadius: '14px', background: bgDefault, border: '1px solid var(--border)', borderLeft, transition: 'background .12s', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = bgDefault }}
                  >
                    {/* Rank */}
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: i < 3 ? '20px' : '16px', fontWeight: 700, color: rankColor, minWidth: '28px', textAlign: 'center', paddingTop: '12px', lineHeight: 1, flexShrink: 0 }}>
                      {i === 0 ? '◈' : i + 1}
                    </div>

                    {/* Avatar */}
                    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                      <Avatar url={entry.avatar_url} username={entry.username} size={52} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>@{entry.username}</span>
                        {entry.badges.slice(0, 2).map(b => (
                          <span key={b.id} title={`${b.name} — ${b.description}`} style={{ fontSize: '15px', lineHeight: 1, cursor: 'default' }}>{b.emoji}</span>
                        ))}
                        {entry.currentStreak > 2 && (
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>
                            🔥 {entry.currentStreak}W
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>ROI</div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '15px', fontWeight: 600, color: entry.roi >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Winrate</div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '15px', fontWeight: 600 }}>{entry.winrate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Picks</div>
                          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '15px', fontWeight: 600 }}>{entry.totalPicks}</div>
                        </div>
                        {tab === 'streak' && (
                          <div>
                            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Streak</div>
                            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '15px', fontWeight: 600, color: 'var(--green)' }}>{entry.currentStreak}W</div>
                          </div>
                        )}
                        {tab === 'followed' && (
                          <div>
                            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Followers</div>
                            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '15px', fontWeight: 600 }}>{entry.followerCount}</div>
                          </div>
                        )}
                        {tab === 'last10' && (
                          <div>
                            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Last 10 ROI</div>
                            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '15px', fontWeight: 600, color: entry.last10Roi >= 0 ? 'var(--green)' : 'var(--red)' }}>{entry.last10Roi >= 0 ? '+' : ''}{entry.last10Roi.toFixed(1)}%</div>
                          </div>
                        )}
                      </div>

                      {/* ROI progress bar */}
                      <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{ height: '100%', width: `${barWidth}%`, background: entry.roi >= 0 ? '#22C55E' : '#F87171', borderRadius: '2px' }} />
                      </div>

                      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)' }}>
                        {entry.settledPicks} settled · {entry.totalProfit >= 0 ? '+' : ''}{entry.totalProfit.toFixed(2)}u
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: '20px', padding: '14px 18px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[{ icon: '🔒', text: 'All picks timestamped before kickoff' }, { icon: '≠', text: 'No edits or deletions possible' }, { icon: '◈', text: minLabel }].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
              <span>{item.icon}</span><span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
