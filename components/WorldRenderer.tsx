'use client'

import { useEffect, useRef } from 'react'
import { Agent, Tile } from '@/lib/world/types'

interface Props {
  map: Tile[][]
  agents: Agent[]
  mapSize: number
  selectedAgent?: string | null
  onSelectAgent?: (id: string) => void
}

// Zone definitions
const ZONES: Array<{ name: string; x: number; y: number; w: number; h: number; color: string }> = [
  { name: 'The Crossing', x: 20, y: 20, w: 10, h: 10, color: 'rgba(255,220,100,0.12)' },
  { name: 'Dark Forest',  x: 2,  y: 2,  w: 14, h: 20, color: 'rgba(30,80,30,0.18)' },
  { name: 'Iron Peaks',   x: 38, y: 2,  w: 10, h: 16, color: 'rgba(100,80,60,0.18)' },
  { name: 'Green Fields', x: 2,  y: 35, w: 16, h: 13, color: 'rgba(80,180,80,0.15)' },
  { name: 'The Wastes',   x: 35, y: 35, w: 13, h: 13, color: 'rgba(180,80,30,0.15)' },
  { name: 'The Market',   x: 21, y: 38, w: 8,  h: 8,  color: 'rgba(220,180,60,0.18)' },
]

const TILE_COLORS: Record<string, string> = {
  grass:      '#3a6b3e',
  forest:     '#1e4a1e',
  water:      '#1a4a6e',
  mountain:   '#5a4a3a',
  desert:     '#8a6a2a',
  settlement: '#5a4a1a',
}

const TILE_ACCENT: Record<string, string> = {
  grass:      '#4a8a50',
  forest:     '#2a6a2a',
  water:      '#2a6a9a',
  mountain:   '#7a6a4a',
  desert:     '#aa8a3a',
  settlement: '#7a6a2a',
}

function needColor(agent: Agent): string {
  const max = Math.max(...Object.values(agent.needs))
  if (max > 80) return '#ff3333'
  if (max > 60) return '#ff8800'
  if (max > 40) return '#ffdd00'
  return '#44ff88'
}

function agentEmoji(agent: Agent): string {
  const names: Record<string, string> = {
    Alice: '🧭', Bob: '⚒️', Charlie: '🤝', Diana: '👑', Eve: '📜',
    MeuKraken: '🦑',
  }
  return names[agent.name] ?? '⚔️'
}

export default function WorldRenderer({ map, agents, mapSize, selectedAgent, onSelectAgent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !map.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const ts = W / mapSize // tile size

    ctx.clearRect(0, 0, W, H)

    // Draw tiles
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x]
        ctx.fillStyle = TILE_COLORS[tile.type] ?? '#333'
        ctx.fillRect(x * ts, y * ts, ts, ts)

        // Subtle texture dots
        if (ts >= 6 && (x + y) % 3 === 0) {
          ctx.fillStyle = TILE_ACCENT[tile.type] ?? '#444'
          ctx.fillRect(x * ts + ts * 0.3, y * ts + ts * 0.3, ts * 0.2, ts * 0.2)
        }
      }
    }

    // Draw zone overlays
    for (const zone of ZONES) {
      ctx.fillStyle = zone.color
      ctx.fillRect(zone.x * ts, zone.y * ts, zone.w * ts, zone.h * ts)

      // Zone border
      ctx.strokeStyle = zone.color.replace('0.1', '0.4').replace('0.12', '0.5').replace('0.15', '0.5').replace('0.18', '0.5')
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.strokeRect(zone.x * ts + 0.5, zone.y * ts + 0.5, zone.w * ts - 1, zone.h * ts - 1)
      ctx.setLineDash([])

      // Zone name
      if (ts >= 8) {
        ctx.font = `bold ${Math.max(8, ts * 0.9)}px monospace`
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.textAlign = 'center'
        ctx.fillText(zone.name, (zone.x + zone.w / 2) * ts, (zone.y + 0.9) * ts)
      }
    }

    // Grid lines (subtle)
    if (ts >= 8) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= mapSize; x++) {
        ctx.beginPath(); ctx.moveTo(x * ts, 0); ctx.lineTo(x * ts, H); ctx.stroke()
      }
      for (let y = 0; y <= mapSize; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * ts); ctx.lineTo(W, y * ts); ctx.stroke()
      }
    }

    // Draw agents
    for (const agent of agents) {
      if (!agent.alive) continue
      const px = (agent.position.x + 0.5) * ts
      const py = (agent.position.y + 0.5) * ts
      const r = Math.max(4, ts * 0.45)
      const isSelected = agent.id === selectedAgent

      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(px, py, r + 4, 0, Math.PI * 2)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Shadow
      ctx.beginPath()
      ctx.arc(px + 1, py + 1, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fill()

      // Agent circle
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fillStyle = needColor(agent)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Emoji icon (if tiles big enough)
      if (ts >= 14) {
        ctx.font = `${r * 1.1}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(agentEmoji(agent), px, py)
      }

      // Name label
      if (ts >= 10) {
        ctx.font = `bold ${Math.max(8, ts * 0.7)}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'
        ctx.lineWidth = 2
        ctx.strokeText(agent.name, px, py + r + 2)
        ctx.fillText(agent.name, px, py + r + 2)
      }

      // Need bar
      if (ts >= 10) {
        const barW = r * 2.2
        const barH = 3
        const barX = px - barW / 2
        const barY = py - r - 6
        const maxNeed = Math.max(...Object.values(agent.needs)) / 100
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(barX, barY, barW, barH)
        ctx.fillStyle = needColor(agent)
        ctx.fillRect(barX, barY, barW * maxNeed, barH)
      }
    }
  }, [map, agents, mapSize, selectedAgent])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onSelectAgent || !map.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const ts = e.currentTarget.width / mapSize
    const gx = Math.floor(mx / ts)
    const gy = Math.floor(my / ts)
    const hit = agents.find(a => a.alive && a.position.x === gx && a.position.y === gy)
    if (hit) onSelectAgent(hit.id)
  }

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      onClick={handleClick}
      className="rounded-lg cursor-crosshair border border-gray-800"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
