export type Badge = {
  id: string
  name: string
  emoji: string
  description: string
  color: string
}

type Pick = {
  status: string
  units: number
  profit_loss: number | null
}

export const BADGES: Badge[] = [
  { id: 'first_blood', name: 'First Blood', emoji: '🩸', description: 'Settled your first pick', color: '#E05252' },
  { id: 'on_fire', name: 'On Fire', emoji: '🔥', description: '3-win streak', color: '#F97316' },
  { id: 'sharp', name: 'Sharp', emoji: '🎯', description: '5-win streak', color: '#22C55E' },
  { id: 'hot_hand', name: 'Hot Hand', emoji: '⚡', description: '10-win streak', color: '#EAB308' },
  { id: 'unstoppable', name: 'Unstoppable', emoji: '💎', description: '25-win streak', color: '#A855F7' },
  { id: 'picks_10', name: '10 Picks', emoji: '📌', description: '10 settled picks', color: '#6B7280' },
  { id: 'picks_50', name: '50 Picks', emoji: '📊', description: '50 settled picks', color: '#6B7280' },
  { id: 'picks_100', name: '100 Picks', emoji: '💯', description: '100 settled picks', color: '#EAB308' },
  { id: 'marathon', name: 'Marathon', emoji: '🏅', description: '200 settled picks', color: '#C0A060' },
  { id: 'value_hunter', name: 'Value Hunter', emoji: '📈', description: '+20% ROI over 20+ picks', color: '#22C55E' },
  { id: 'elite_sharp', name: 'Elite Sharp', emoji: '🏆', description: '+10% ROI over 50+ picks', color: '#F59E0B' },
  { id: 'profitable', name: 'Profitable', emoji: '💰', description: 'Positive profit over 30+ picks', color: '#22C55E' },
]

export function calculateBadges(picks: Pick[]): Badge[] {
  const settled = picks.filter(p => p.status !== 'pending')
  const wins = settled.filter(p => p.status === 'win')
  const totalStaked = settled.reduce((s, p) => s + p.units, 0)
  const totalProfit = settled.reduce((s, p) => s + (p.profit_loss ?? 0), 0)
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0

  // Current win streak from most recent picks
  let streak = 0
  for (let i = settled.length - 1; i >= 0; i--) {
    if (settled[i].status === 'win') streak++
    else break
  }

  const earned = new Set<string>()
  if (settled.length >= 1) earned.add('first_blood')
  if (streak >= 3) earned.add('on_fire')
  if (streak >= 5) earned.add('sharp')
  if (streak >= 10) earned.add('hot_hand')
  if (streak >= 25) earned.add('unstoppable')
  if (settled.length >= 10) earned.add('picks_10')
  if (settled.length >= 50) earned.add('picks_50')
  if (settled.length >= 100) earned.add('picks_100')
  if (settled.length >= 200) earned.add('marathon')
  if (settled.length >= 20 && roi >= 20) earned.add('value_hunter')
  if (settled.length >= 50 && roi >= 10) earned.add('elite_sharp')
  if (settled.length >= 30 && totalProfit > 0) earned.add('profitable')

  return BADGES.filter(b => earned.has(b.id))
}
