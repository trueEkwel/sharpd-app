import { NextRequest, NextResponse } from 'next/server'

// Maps football-data.org competition codes to The Odds API sport keys
const SPORT_MAP: Record<string, string> = {
  PL: 'soccer_epl',
  BL1: 'soccer_germany_bundesliga',
  PD: 'soccer_spain_la_liga',
  SA: 'soccer_italy_serie_a',
  FL1: 'soccer_france_ligue_one',
  CL: 'soccer_uefa_champs_league',
  EL: 'soccer_europa_league',
  PPL: 'soccer_portugal_primeira_liga',
  DED: 'soccer_netherlands_eredivisie',
  BSA: 'soccer_brazil_campeonato',
  MLS: 'soccer_usa_mls',
}

type BookmakerOdds = { name: string; price: number }
type MarketOdds = { best: number; bookmakers: BookmakerOdds[] }

function addOdds(markets: Record<string, MarketOdds>, key: string, bookmakerName: string, price: number) {
  if (!markets[key]) {
    markets[key] = { best: price, bookmakers: [{ name: bookmakerName, price }] }
  } else {
    markets[key].bookmakers.push({ name: bookmakerName, price })
    if (price > markets[key].best) markets[key].best = price
  }
}

const STRIP_SUFFIXES = /\s+(fc|cf|afc|united|city|sc|ac|bc|if|bk|sk|fk|rfc)$/i

function normalise(name: string): string {
  return name.toLowerCase().replace(STRIP_SUFFIXES, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

function teamMatch(a: string, b: string): boolean {
  const na = normalise(a)
  const nb = normalise(b)
  return na.includes(nb) || nb.includes(na)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const home = searchParams.get('home') || ''
  const away = searchParams.get('away') || ''
  const competition = searchParams.get('competition') || ''

  if (!home || !away) {
    return NextResponse.json({ found: false, markets: {} })
  }

  const sportKey = SPORT_MAP[competition.toUpperCase()] ?? 'soccer_epl'

  try {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`)
    url.searchParams.set('apiKey', process.env.ODDS_API_KEY || '')
    url.searchParams.set('regions', 'eu')
    url.searchParams.set('markets', 'h2h,totals')
    url.searchParams.set('oddsFormat', 'decimal')

    console.log('[odds] fetching:', url.toString())
    const res = await fetch(url.toString(), { next: { revalidate: 300 } })
    if (!res.ok) {
      const errorText = await res.text()
      console.log('[odds] error response:', errorText)
      return NextResponse.json({ found: false, markets: {} })
    }

    const games: any[] = await res.json()
    if (!Array.isArray(games)) return NextResponse.json({ found: false, markets: {} })

    if (games.length === 0) {
      console.log(`[odds] no events found for sportKey=${sportKey}`)
      return NextResponse.json({ found: false, markets: {} })
    }

    console.log(`[odds] sportKey=${sportKey} events=${games.length}`)
    console.log(`[odds] searching for: home="${normalise(home)}" away="${normalise(away)}"`)
    games.slice(0, 3).forEach((g, i) =>
      console.log(`[odds] event[${i}]: home="${g.home_team}" away="${g.away_team}"`)
    )

    const game = games.find(g =>
      teamMatch(g.home_team || '', home) && teamMatch(g.away_team || '', away)
    )
    console.log(`[odds] match found: ${game ? `${game.home_team} vs ${game.away_team}` : 'none'}`)

    if (!game) return NextResponse.json({ found: false, markets: {} })

    const markets: Record<string, MarketOdds> = {}

    for (const bookmaker of game.bookmakers || []) {
      const bName: string = bookmaker.title
      for (const market of bookmaker.markets || []) {
        if (market.key === 'h2h') {
          for (const outcome of market.outcomes || []) {
            if (outcome.name === game.home_team) addOdds(markets, 'Home Win', bName, outcome.price)
            else if (outcome.name === game.away_team) addOdds(markets, 'Away Win', bName, outcome.price)
            else if (outcome.name === 'Draw') addOdds(markets, 'Draw', bName, outcome.price)
          }
        } else if (market.key === 'totals') {
          for (const outcome of market.outcomes || []) {
            const line = outcome.point ?? outcome.description ?? ''
            const label = `${outcome.name} ${line}`.trim()
            addOdds(markets, label, bName, outcome.price)
          }
        }
      }
    }

    return NextResponse.json({ found: true, markets })
  } catch {
    return NextResponse.json({ found: false, markets: {} })
  }
}
