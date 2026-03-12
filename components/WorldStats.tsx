'use client'

import { Agent } from '@/lib/world/types'

interface Props {
  tick: number
  agents: Agent[]
  worldName: string
}

export default function WorldStats({ tick, agents, worldName }: Props) {
  const alive = agents.filter((a) => a.alive).length
  const dead = agents.filter((a) => !a.alive).length
  const avgAge = alive > 0
    ? Math.round(agents.filter((a) => a.alive).reduce((s, a) => s + a.age, 0) / alive)
    : 0

  return (
    <div className="flex items-center gap-6 text-sm text-gray-400 border-t border-gray-800 pt-3">
      <span className="text-white font-bold">🌍 {worldName}</span>
      <span>Tick: <strong className="text-green-400">{tick}</strong></span>
      <span>Population: <strong className="text-blue-400">{alive}</strong></span>
      {dead > 0 && <span>Deaths: <strong className="text-red-400">{dead}</strong></span>}
      <span>Avg age: <strong className="text-yellow-400">{avgAge}</strong></span>
    </div>
  )
}
