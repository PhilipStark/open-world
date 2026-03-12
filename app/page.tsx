'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Agent, WorldEvent, Tile } from '@/lib/world/types'
import WorldRenderer from '@/components/WorldRenderer'

const WORLD_ID = process.env.NEXT_PUBLIC_WORLD_ID ?? ''
const MAP_SIZE = parseInt(process.env.NEXT_PUBLIC_MAP_SIZE ?? '50')

const EVENT_ICONS: Record<string, string> = {
  speech: '💬', combat: '⚔️', trade: '🤝', death: '💀', meeting: '👋', action: '▶️',
}

export default function WorldPage() {
  const [tick, setTick] = useState(0)
  const [worldName, setWorldName] = useState('Genesis')
  const [agents, setAgents] = useState<Agent[]>([])
  const [events, setEvents] = useState<WorldEvent[]>([])
  const [map, setMap] = useState<Tile[][]>([])
  const [ticking, setTicking] = useState(false)
  const [autoTick, setAutoTick] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // Scroll feed to bottom on new events
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [events])

  useEffect(() => {
    if (!WORLD_ID) return
    fetch(`/api/world/state?worldId=${WORLD_ID}`)
      .then(r => r.json())
      .then(({ world, agents, events }) => {
        if (world) { setTick(world.tick); setWorldName(world.name); setMap(world.map ?? []) }
        setAgents((agents ?? []).map((a: any) => ({ ...a, worldId: a.world_id, createdAt: a.created_at })))
        setEvents((events ?? []).reverse().map((e: any) => ({ ...e, worldId: e.world_id, involvedAgents: e.involved_agents, createdAt: e.created_at })))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!WORLD_ID) return
    const agentSub = supabase.channel('agents-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents', filter: `world_id=eq.${WORLD_ID}` },
        (payload) => {
          const a = payload.new as any
          const agent: Agent = { ...a, worldId: a.world_id, createdAt: a.created_at }
          setAgents(prev => { const i = prev.findIndex(x => x.id === agent.id); if (i >= 0) { const n = [...prev]; n[i] = agent; return n } return [...prev, agent] })
        }).subscribe()

    const eventSub = supabase.channel('events-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_events', filter: `world_id=eq.${WORLD_ID}` },
        (payload) => {
          const e = payload.new as any
          const event: WorldEvent = { ...e, worldId: e.world_id, involvedAgents: e.involved_agents, createdAt: e.created_at }
          setEvents(prev => [...prev, event].slice(-200))
          setTick(e.tick)
        }).subscribe()

    return () => { supabase.removeChannel(agentSub); supabase.removeChannel(eventSub) }
  }, [])

  const runTick = useCallback(async () => {
    if (ticking || !WORLD_ID) return
    setTicking(true)
    try {
      const res = await fetch('/api/world/tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ worldId: WORLD_ID }) })
      const data = await res.json()
      if (data.tick) setTick(data.tick)
    } finally { setTicking(false) }
  }, [ticking])

  useEffect(() => {
    if (!autoTick) return
    const interval = setInterval(runTick, 30_000)
    return () => clearInterval(interval)
  }, [autoTick, runTick])

  const alive = agents.filter(a => a.alive)
  const selected = agents.find(a => a.id === selectedAgent)

  if (!WORLD_ID) return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="text-center">
        <p className="text-red-400 mb-2">⚠️ No world configured</p>
        <code className="text-gray-400 text-sm">npm run seed</code>
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden" style={{ fontFamily: 'monospace' }}>

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg tracking-widest">🌍 OPEN WORLD</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400 text-sm">{worldName}</span>
          <span className="bg-green-900 text-green-400 text-xs px-2 py-0.5 rounded font-bold">LIVE</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Tick <span className="text-green-400 font-bold">{tick}</span></span>
          <span className="text-gray-500">Population <span className="text-blue-400 font-bold">{alive.length}</span></span>
          <button onClick={runTick} disabled={ticking}
            className="px-3 py-1 bg-green-800 hover:bg-green-700 disabled:opacity-40 text-green-300 rounded text-xs font-bold border border-green-700">
            {ticking ? '⏳ TICKING' : '▶ RUN TICK'}
          </button>
          <button onClick={() => setAutoTick(!autoTick)}
            className={`px-3 py-1 rounded text-xs font-bold border ${autoTick ? 'bg-red-900 border-red-700 text-red-300' : 'bg-gray-800 border-gray-600 text-gray-300'}`}>
            {autoTick ? '⏹ STOP' : '🔄 AUTO'}
          </button>
          <Link href="/join"
            className="px-3 py-1 bg-yellow-900 hover:bg-yellow-800 text-yellow-300 rounded text-xs font-bold border border-yellow-700">
            + Connect OpenClaw
          </Link>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT: MAP */}
        <div className="flex-shrink-0 p-3 border-r border-gray-800 bg-gray-950">
          {loading ? (
            <div className="w-[600px] h-[600px] bg-gray-900 rounded-lg flex items-center justify-center text-gray-600 text-sm">
              Loading world...
            </div>
          ) : (
            <WorldRenderer map={map} agents={agents} mapSize={MAP_SIZE}
              selectedAgent={selectedAgent}
              onSelectAgent={id => setSelectedAgent(prev => prev === id ? null : id)} />
          )}

          {/* Zone legend */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            <span>🟢 Grass</span><span>🟤 Mountain</span><span>🔵 Water</span>
            <span>🌲 Forest</span><span>🟡 Desert</span>
          </div>
        </div>

        {/* CENTER: EVENT FEED */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800">
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 text-xs text-gray-400 uppercase tracking-widest font-bold flex items-center justify-between">
            <span>World Feed</span>
            <span className="text-gray-600 normal-case">{events.length} events</span>
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-1">
            {events.length === 0 && (
              <p className="text-gray-600 text-sm italic text-center mt-8">
                The world is quiet... for now.
              </p>
            )}
            {events.map((event) => (
              <div key={event.id} className={`flex gap-2 text-sm py-1 border-b border-gray-900 hover:bg-gray-900 px-2 rounded transition-colors ${event.type === 'death' ? 'bg-red-950/30' : event.type === 'combat' ? 'bg-orange-950/20' : ''}`}>
                <span className="text-gray-600 text-xs min-w-[32px] pt-0.5">T{event.tick}</span>
                <span className="text-base leading-none pt-0.5">{EVENT_ICONS[event.type] ?? '▶️'}</span>
                <span className={`${event.type === 'death' ? 'text-red-400' : event.type === 'combat' ? 'text-orange-400' : event.type === 'meeting' ? 'text-blue-400' : event.type === 'trade' ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {event.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: AGENT PANEL */}
        <div className="w-64 flex flex-col flex-shrink-0">
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 text-xs text-gray-400 uppercase tracking-widest font-bold">
            Agents
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {agents.map(agent => (
              <button key={agent.id} onClick={() => setSelectedAgent(prev => prev === agent.id ? null : agent.id)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${agent.id === selectedAgent ? 'border-green-600 bg-green-950/30' : agent.alive ? 'border-gray-700 bg-gray-900 hover:border-gray-500' : 'border-red-900 bg-red-950/20 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {{ Alice: '🧭', Bob: '⚒️', Charlie: '🤝', Diana: '👑', Eve: '📜', MeuKraken: '🦑' }[agent.name] ?? '⚔️'}
                  </span>
                  <span className="font-bold text-white text-sm">{agent.name}</span>
                  <span className={`ml-auto text-xs ${agent.alive ? 'text-green-400' : 'text-red-400'}`}>
                    {agent.alive ? `⚡${agent.age}` : '💀'}
                  </span>
                </div>

                {/* Need bars */}
                <div className="space-y-1">
                  {(Object.entries(agent.needs) as [string, number][]).map(([need, val]) => (
                    <div key={need} className="flex items-center gap-1">
                      <span className="text-gray-600 text-xs w-12 capitalize">{need.slice(0,4)}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-1">
                        <div className={`h-1 rounded-full ${val > 80 ? 'bg-red-500' : val > 60 ? 'bg-orange-400' : val > 40 ? 'bg-yellow-400' : 'bg-green-400'}`}
                          style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Last action */}
                {agent.memory.length > 0 && (
                  <p className="text-gray-600 text-xs mt-2 line-clamp-1 italic">
                    {agent.memory[agent.memory.length - 1]}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Selected agent detail */}
          {selected && (
            <div className="border-t border-gray-700 p-3 bg-gray-900 flex-shrink-0">
              <p className="text-white text-xs font-bold mb-1">📍 ({selected.position.x}, {selected.position.y})</p>
              <p className="text-gray-500 text-xs italic line-clamp-3">{selected.personality}</p>
              <div className="mt-2">
                <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Inventory</p>
                <p className="text-gray-400 text-xs">{Object.entries(selected.inventory ?? {}).map(([k,v]) => `${k}:${v}`).join(', ') || 'empty'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
