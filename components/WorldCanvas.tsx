'use client'

import { useEffect, useRef } from 'react'
import { Agent, Tile } from '@/lib/world/types'

interface Props {
  map: Tile[][]
  agents: Agent[]
  mapSize: number
}

const TILE_COLORS: Record<string, number> = {
  grass: 0x4a7c59,
  forest: 0x2d5a27,
  water: 0x2e86ab,
  mountain: 0x8b7355,
  desert: 0xd4a853,
  settlement: 0x8b6914,
}

const NEED_COLOR = (agent: Agent): string => {
  const maxNeed = Math.max(...Object.values(agent.needs))
  if (maxNeed > 80) return '#ff4444'
  if (maxNeed > 60) return '#ff8c00'
  if (maxNeed > 40) return '#ffdd00'
  return '#44ff88'
}

export default function WorldCanvas({ map, agents, mapSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !map.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tileSize = Math.floor(canvas.width / mapSize)

    // Draw tiles
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x]
        const color = TILE_COLORS[tile.type] ?? 0x888888
        const r = (color >> 16) & 0xff
        const g = (color >> 8) & 0xff
        const b = color & 0xff
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
      }
    }

    // Draw agents
    for (const agent of agents) {
      if (!agent.alive) continue
      const px = agent.position.x * tileSize + tileSize / 2
      const py = agent.position.y * tileSize + tileSize / 2
      const radius = Math.max(3, tileSize / 2)

      // Agent dot
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fillStyle = NEED_COLOR(agent)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.stroke()

      // Name label (only if tiles are big enough)
      if (tileSize >= 10) {
        ctx.fillStyle = '#fff'
        ctx.font = `${Math.max(8, tileSize / 2)}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(agent.name[0], px, py + radius + tileSize / 2)
      }
    }
  }, [map, agents, mapSize])

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      className="border border-gray-700 rounded-lg cursor-crosshair"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
