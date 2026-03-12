'use client'

import { Agent, Need } from '@/lib/world/types'

interface Props {
  agent: Agent
}

const NEED_LABELS: Record<Need, string> = {
  hunger: '🍎 Hunger',
  safety: '🛡️ Safety',
  social: '👥 Social',
  purpose: '⭐ Purpose',
}

export default function AgentCard({ agent }: Props) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${agent.alive ? 'border-gray-700 bg-gray-900' : 'border-red-900 bg-red-950 opacity-60'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{agent.alive ? '🟢' : '💀'}</span>
        <span className="font-bold text-white">{agent.name}</span>
        <span className="text-gray-500 text-xs">age {agent.age}</span>
        <span className="text-gray-600 text-xs ml-auto">({agent.position.x},{agent.position.y})</span>
      </div>

      <p className="text-gray-400 text-xs mb-2 italic line-clamp-2">{agent.personality}</p>

      <div className="space-y-1">
        {(Object.entries(agent.needs) as [Need, number][]).map(([need, value]) => (
          <div key={need} className="flex items-center gap-2">
            <span className="text-xs w-20 text-gray-400">{NEED_LABELS[need]}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  value > 80 ? 'bg-red-500' : value > 60 ? 'bg-orange-400' : value > 40 ? 'bg-yellow-400' : 'bg-green-400'
                }`}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-6">{value}</span>
          </div>
        ))}
      </div>

      {agent.memory.length > 0 && (
        <p className="text-gray-600 text-xs mt-2 line-clamp-1">
          Last: {agent.memory[agent.memory.length - 1]}
        </p>
      )}
    </div>
  )
}
