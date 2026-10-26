/** One accent per pillar, shared by the plan, the EBITDA bridge and exports. */
export const PILLAR_COLORS = ['#3f7d5c', '#4b6a9b', '#b5712c', '#8a5a9e', '#2f7f8a', '#a8534a', '#6b7a2f']

export const pillarColor = (num: number) => PILLAR_COLORS[(Math.max(1, num) - 1) % PILLAR_COLORS.length]

/** Neutral used for the EBITDA totals (entry, current, target). */
export const TOTAL_COLOR = '#27272a'
