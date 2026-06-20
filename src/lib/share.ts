import type { SessionResult } from '../types'

// Shareable scorecard — the growth loop. Renders a branded PNG on a canvas
// (no dependency, no backend) the user can post, plus a caption to copy.

export function buildCaption(r: SessionResult): string {
  const { delivery, arrangement, style, coach } = r
  return [
    `🎤 My Communication Guru scorecard`,
    `Delivery ${delivery.score} · Arrangement ${arrangement.score} · Style ${style.score}`,
    `Working on: ${coach.technique}`,
    `Coach yourself free →`,
  ].join('\n')
}

function color(s: number): string {
  if (s >= 75) return '#059669'
  if (s >= 50) return '#f59e0b'
  return '#ef4444'
}

export function drawScorecard(r: SessionResult): string {
  const W = 800
  const H = 800
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background gradient.
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#f5f3ff')
  g.addColorStop(1, '#eef2ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#6d28d9'
  ctx.font = '800 46px system-ui, sans-serif'
  ctx.fillText('Communication Guru', 60, 100)

  ctx.fillStyle = '#64748b'
  ctx.font = '400 24px system-ui, sans-serif'
  ctx.fillText('My speaking scorecard', 62, 138)

  // Three layer scores.
  const layers: [string, number][] = [
    ['Delivery', r.delivery.score],
    ['Arrangement', r.arrangement.score],
    ['Style', r.style.score],
  ]
  const cardW = 210
  const gap = 25
  const startX = 60
  const y = 220
  layers.forEach(([name, score], i) => {
    const x = startX + i * (cardW + gap)
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, cardW, 200, 20)
    ctx.fill()
    ctx.fillStyle = color(score)
    ctx.font = '800 72px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(score), x + cardW / 2, y + 110)
    ctx.fillStyle = '#475569'
    ctx.font = '600 22px system-ui, sans-serif'
    ctx.fillText(name, x + cardW / 2, y + 155)
  })

  // Coach focus.
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ede9fe'
  roundRect(ctx, 60, 470, W - 120, 130, 20)
  ctx.fill()
  ctx.fillStyle = '#6d28d9'
  ctx.font = '700 20px system-ui, sans-serif'
  ctx.fillText('NOW WORKING ON', 85, 515)
  ctx.fillStyle = '#0f172a'
  ctx.font = '800 34px system-ui, sans-serif'
  ctx.fillText(truncate(r.coach.technique, 32), 85, 558)

  // Footer tagline.
  ctx.fillStyle = '#64748b'
  ctx.font = '500 24px system-ui, sans-serif'
  ctx.fillText("We don't just show what went wrong —", 60, 700)
  ctx.fillStyle = '#6d28d9'
  ctx.font = '700 26px system-ui, sans-serif'
  ctx.fillText('we coach the fix.', 60, 736)

  return canvas.toDataURL('image/png')
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}
