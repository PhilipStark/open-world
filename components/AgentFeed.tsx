'use client'

import { WorldEvent } from '@/lib/world/types'

interface Props {
  events: WorldEvent[]
}

const EVENT_ICONS: Record<string, string> = {
  speech: '💬',
  combat: '⚔️',
  trade: '🤝',
  death: '💀',
  meeting: '👋',
  action: '▶️',
}

export default function AgentFeed({ events }: Props) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto h-full">
      {events.length === 0 && (
        <p className="text-gray-500 text-sm italic">Waiting for the world to begin...</p>
      )}
      {[...events].reverse().map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-2 text-sm border-b border-gray-800 pb-1"
        >
          <span className="text-gray-500 text-xs min-w-[40px]">T{event.tick}</span>
          <span>{EVENT_ICONS[event.type] ?? '▶️'}</span>
          <span className="text-gray-200">{event.description}</span>
        </div>
      ))}
    </div>
  )
}
