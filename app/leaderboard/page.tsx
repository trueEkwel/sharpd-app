'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Nav } from '@/components/Nav'

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
}

type Tab = 'alltime' | 'week' | 'month' | 'streak' | 'last10' | 'followed'

const MIN_ALL = 5
const MIN_WEEK = 3
const MIN_MONTH = 5
const MIN_STREAK = 3
const MIN_LAST10 = 10

function calcEntry(username: string, userPicks: RawPick[], followerCount: number): TabEntry {
  const settled = userPicks.filter(p => p.status !== 'pending')
  const wins = settled.filter(p => p.status === 'win').length
  const totalStaked = settled.reduce((s, p) => s + p.units, 0)
  const totalProfit = settled.reduce((s, p) => s + (p.profit_loss ?? 0), 0)
  const avgOdds = userPicks.length > 0 ? userPicks.reduce((s, p) => s + p.odds, 0) / userPicks.length : 0

  // Current streak (most recent settled picks)
  let streak = 0
  const byDate = [...settled].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  for (const p of byDate) {
    if (p.status === 'win') streak++
    else break
  }

  // Last 10 settled ROI
  const last10 = byDate.slice(0, 10)
  const l10staked = last10.reduce((s, p) => s + p.units, 0)
  const l10profit = last10.reduce((s, p) => s + (p.profit_loss ?? 0), 0)
  const last10Roi = l10staked > 0 ? (l10profit / l10staked) * 100 : 0

  return {
    username,
    totalPicks: userPicks.length,
    settledPicks: settled.length,
    wins,
    winrate: settled.length > 0 ? (wins / settled.length) * 100 : 0,
    roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
    totalProfit,
    avgOdds,
    currentStreak: streak,
    last10Roi,
    followerCount,
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
        supabase.from('profiles').select('id, username'),
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

      const all = profiles.map(p => {
        const userPicks = picks.filter(pk => pk.user_id === p.id)
        return calcEntry(p.username, userPicks, followerMap[p.id] ?? 0)
      })
      const week = profiles.map(p => {
        const userPicks = picks.filter(pk => pk.user_id === p.id && new Date(pk.created_at) >= weekAgo)
        return calcEntry(p.username, userPicks, followerMap[p.id] ?? 0)
      })
      const month = profiles.map(p => {
        const userPicks = picks.filter(pk => pk.user_id === p.id && new Date(pk.created_at) >= monthStart)
        return calcEntry(p.username, userPicks, followerMap[p.id] ?? 0)
      })

      setAllEntries(all)
      setWeekEntries(week)
      setMonthEntries(month)
      setLoading(false)
    }
    load()
  }, [])

  function getRows(): TabEntry[] {
    if (tab === 'alltime') {
      return [...allEntries].filter(e => e.settledPicks >= MIN_ALL).sort((a, b) =>
        filter === 'roi' ? b.roi - a.roi : filter === 'profit' ? b.totalProfit - a.totalProfit : b.winrate - a.winrate
      )
    }
    if (tab === 'week') {
      return [...weekEntries].filter(e => e.settledPicks >= MIN_WEEK).sort((a, b) => b.roi - a.roi)
    }
    if (tab === 'month') {
      return [...monthEntries].filter(e => e.settledPicks >= MIN_MONTH).sort((a, b) => b.roi - a.roi)
    }
    if (tab === 'streak') {
      return [...allEntries].filter(e => e.currentStreak >= MIN_STREAK).sort((a, b) => b.currentStreak - a.currentStreak)
    }
    if (tab === 'last10') {
      return [...allEntries].filter(e => e.settledPicks >= MIN_LAST10).sort((a, b) => b.last10Roi - a.last10Roi)
    }
    if (tab === 'followed') {
      return [...allEntries].filter(e => e.followerCount > 0).sort((a, b) => b.followerCount - a.followerCount)
    }
    return []
  }

  const rows = getRows()

  const tabs: { id: Tab; label: string }[] = [
    { id: 'alltime', label: 'All Time' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'streak', label: 'Hot Streak' },
    { id: 'last10', label: 'Best Last 10' },
    { id: 'followed', label: 'Most Followed' },
  ]

  function getColHeader() {
    if (tab === 'streak') return ['#', 'Predictor', 'Streak', 'Winrate', 'Avg Odds', 'ROI', 'Units P/L']
    if (tab === 'last10') return ['#', 'Predictor', 'Picks', 'Winrate', 'Avg Odds', 'Last 10 ROI', 'Units P/L']
    if (tab === 'followed') return ['#', 'Predictor', 'Followers', 'Winrate', 'Avg Odds', 'ROI', 'Units P/L']
    return ['#', 'Predictor', 'Picks', 'Winrate', 'Avg Odds', 'ROI', 'Units P/L']
  }

  function getCol3(entry: TabEntry) {
    if (tab === 'streak') return `${entry.currentStreak}W`
    if (tab === 'followed') return entry.followerCount.toString()
    return entry.totalPicks.toString()
  }

  function getCol5(entry: TabEntry) {
    if (tab === 'last10') return entry.last10Roi
    return entry.roi
  }

  function getCol5Label(entry: TabEntry) {
    const v = getCol5(entry)
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  }

  const minLabel = tab === 'alltime' ? `Min. ${MIN_ALL} settled picks` : tab === 'week' ? `Min. ${MIN_WEEK} settled this week` : tab === 'month' ? `Min. ${MIN_MONTH} settled this month` : tab === 'streak' ? `Min. ${MIN_STREAK}-win streak` : tab === 'last10' ? `Min. ${MIN_LAST10} settled picks` : 'Ranked by followers'

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '100px 24px 60px' }}>
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

        {/* Sub-filter for All Time */}
        {tab === 'alltime' && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
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

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px 70px 80px 100px 80px', gap: '8px', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            {getColHeader().map(h => (
              <div key={h} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', fontSize: '13px' }}>Loading rankings...</p>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>◈</div>
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>No rankings yet</p>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>{minLabel} to appear here.</p>
              <Link href="/signup" className="btn-pill btn-primary">Start tracking</Link>
            </div>
          ) : (
            rows.map((entry, i) => (
              <Link key={entry.username} href={`/u/${entry.username}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px 70px 80px 100px 80px', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border)', transition: 'background .12s', cursor: 'pointer', background: i === 0 ? 'rgba(34,197,94,0.03)' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? 'rgba(34,197,94,0.03)' : 'transparent')}
                >
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', fontWeight: 500, color: i === 0 ? 'var(--green)' : i === 1 ? '#C0A060' : i === 2 ? '#9090A0' : 'var(--dim)', alignSelf: 'center' }}>
                    {i === 0 ? '◈' : i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '1px' }}>@{entry.username}</div>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--dim)' }}>{entry.settledPicks} settled</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', alignSelf: 'center', color: tab === 'streak' ? 'var(--green)' : 'inherit' }}>{getCol3(entry)}</div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', alignSelf: 'center' }}>{entry.winrate.toFixed(1)}%</div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', alignSelf: 'center', color: 'var(--muted)' }}>{entry.avgOdds.toFixed(2)}</div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', fontWeight: 500, alignSelf: 'center', color: getCol5(entry) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {getCol5Label(entry)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', alignSelf: 'center', color: entry.totalProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {entry.totalProfit >= 0 ? '+' : ''}{entry.totalProfit.toFixed(2)}u
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <div style={{ marginTop: '16px', padding: '14px 18px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
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
