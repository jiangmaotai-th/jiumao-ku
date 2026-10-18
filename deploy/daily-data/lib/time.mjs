/** Asia/Shanghai clock used for issue dates and updatedAt. */

export function shanghaiParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  const hour = parts.hour === '24' ? '00' : parts.hour
  const day = `${parts.year}-${parts.month}-${parts.day}`
  return {
    date: day,
    iso: `${day}T${hour}:${parts.minute}:${parts.second}+08:00`,
  }
}

export function addDays(dateStr, delta) {
  const t = Date.parse(`${dateStr}T12:00:00+08:00`) + delta * 86400000
  return shanghaiParts(new Date(t)).date
}

export function daysBetween(earlier, later) {
  const ms = Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)
  return Math.round(ms / 86400000)
}

/** Arena leaderboard stamp, e.g. Oct 8, 2026. */
export function formatLeaderboardDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (!y || !m || !d) return null
  return `${months[m - 1]} ${d}, ${y}`
}

export function dayFromAny(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return shanghaiParts(date).date
}
