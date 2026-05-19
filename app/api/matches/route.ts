import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.toLowerCase() || ''

  // Nächste 14 Tage
  const today = new Date()
  const future = new Date()
  future.setDate(future.getDate() + 9)

  const dateFrom = today.toISOString().split('T')[0]
  const dateTo = future.toISOString().split('T')[0]

  try {
    const res = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY || '',
        },
        next: { revalidate: 300 }, // 5 Minuten cachen
      }
    )

if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: 'API error', status: res.status, details: text, hasKey: !!process.env.FOOTBALL_DATA_API_KEY }, { status: 500 })
    }

    const data = await res.json()
    const matches = data.matches || []

    // Nach Teamnamen filtern
    const filtered = matches
      .filter((m: any) => {
        if (!query) return true
        const home = m.homeTeam?.name?.toLowerCase() || ''
        const away = m.awayTeam?.name?.toLowerCase() || ''
        const competition = m.competition?.name?.toLowerCase() || ''
        return home.includes(query) || away.includes(query) || competition.includes(query)
      })
      .slice(0, 10)
      .map((m: any) => ({
        id: m.id,
        homeTeam: m.homeTeam?.name,
        awayTeam: m.awayTeam?.name,
        competition: m.competition?.name,
        competitionCode: m.competition?.code,
        utcDate: m.utcDate,
        status: m.status,
      }))

    return NextResponse.json({ matches: filtered })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}