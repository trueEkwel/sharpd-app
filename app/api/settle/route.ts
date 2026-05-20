import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase Admin Client für Server-side Settlement
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Market-Ergebnis berechnen
function determineResult(market: string, homeGoals: number, awayGoals: number): 'win' | 'loss' | 'void' {
  const total = homeGoals + awayGoals
  const m = market.toLowerCase().trim()

  // 1X2 Märkte
  if (m === 'home win' || m === '1') return homeGoals > awayGoals ? 'win' : 'loss'
  if (m === 'away win' || m === '2') return awayGoals > homeGoals ? 'win' : 'loss'
  if (m === 'draw' || m === 'x') return homeGoals === awayGoals ? 'win' : 'loss'

  // Over/Under
  if (m === 'over 0.5') return total > 0.5 ? 'win' : 'loss'
  if (m === 'over 1.5') return total > 1.5 ? 'win' : 'loss'
  if (m === 'over 2.5') return total > 2.5 ? 'win' : 'loss'
  if (m === 'over 3.5') return total > 3.5 ? 'win' : 'loss'
  if (m === 'over 4.5') return total > 4.5 ? 'win' : 'loss'
  if (m === 'under 0.5') return total < 0.5 ? 'win' : 'loss'
  if (m === 'under 1.5') return total < 1.5 ? 'win' : 'loss'
  if (m === 'under 2.5') return total < 2.5 ? 'win' : 'loss'
  if (m === 'under 3.5') return total < 3.5 ? 'win' : 'loss'
  if (m === 'under 4.5') return total < 4.5 ? 'win' : 'loss'

  // BTTS
  if (m === 'btts' || m === 'btts yes' || m === 'both teams to score') {
    return homeGoals > 0 && awayGoals > 0 ? 'win' : 'loss'
  }
  if (m === 'btts no' || m === 'both teams to score - no') {
    return homeGoals === 0 || awayGoals === 0 ? 'win' : 'loss'
  }

  // Double Chance
  if (m === '1x') return homeGoals >= awayGoals ? 'win' : 'loss'
  if (m === 'x2') return awayGoals >= homeGoals ? 'win' : 'loss'
  if (m === '12') return homeGoals !== awayGoals ? 'win' : 'loss'

  return 'void' // Unbekannter Markt
}

export async function GET(request: NextRequest) {
  // Sicherheit: nur Vercel Cron oder interne Aufrufe
  

  try {
    // Alle pending Picks deren Match bereits begonnen hat
    const { data: pendingPicks, error } = await supabase
      .from('picks')
      .select('*')
      .eq('status', 'pending')
      .not('api_match_id', 'is', null)
      .lt('match_start', new Date().toISOString())

    if (error) throw error
    if (!pendingPicks || pendingPicks.length === 0) {
      return NextResponse.json({ message: 'No pending picks to settle', settled: 0 })
    }

    let settled = 0
    let errors = 0

    for (const pick of pendingPicks) {
      try {
        // Match-Ergebnis von football-data.org holen
        const res = await fetch(
          `https://api.football-data.org/v4/matches/${pick.api_match_id}`,
          { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY || '' } }
        )

        if (!res.ok) continue

        const matchData = await res.json()
        const status = matchData.status

        // Nur fertige Spiele setteln
        if (status !== 'FINISHED') continue

        const homeGoals = matchData.score?.fullTime?.home
        const awayGoals = matchData.score?.fullTime?.away

        if (homeGoals === null || homeGoals === undefined || awayGoals === null || awayGoals === undefined) continue

        const result = determineResult(pick.market, homeGoals, awayGoals)
        const profit_loss =
          result === 'win' ? parseFloat(((pick.odds - 1) * pick.units).toFixed(2)) :
          result === 'loss' ? -pick.units : 0

        await supabase.from('picks').update({
          status: result,
          profit_loss,
          settled_at: new Date().toISOString(),
        }).eq('id', pick.id)

        settled++
      } catch {
        errors++
      }
    }

    return NextResponse.json({
      message: `Settlement complete`,
      settled,
      errors,
      total: pendingPicks.length,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 })
  }
}